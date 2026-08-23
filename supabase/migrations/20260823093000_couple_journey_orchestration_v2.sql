create or replace function public.sync_my_spouse_from_family(
  p_dossier_id uuid,
  p_situation text,
  p_civilite text default null,
  p_prenom text default null,
  p_nom text default null,
  p_email text default null,
  p_mobile text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_primary uuid;
  v_foyer uuid;
  v_spouse uuid;
  v_spouse_auth uuid;
  v_requires_spouse boolean;
  v_primary_email text;
  v_has_activity boolean;
  v_family_payload jsonb;
  v_identity_payload jsonb;
  v_primary_address jsonb;
begin
  if v_uid is null then raise exception 'Authentification requise'; end if;

  select i.id, i.foyer_id, lower(trim(coalesce(i.email,'')))
    into v_primary, v_foyer, v_primary_email
  from public.investisseurs i
  join public.dossier_investisseurs di on di.investisseur_id=i.id
  where di.dossier_id=p_dossier_id and i.auth_user_id=v_uid
  limit 1;

  if v_primary is null then raise exception 'Accès refusé'; end if;

  v_requires_spouse := lower(trim(coalesce(p_situation,''))) in ('marié','marie','pacsé','pacse','concubinage');

  select i.id, i.auth_user_id
    into v_spouse, v_spouse_auth
  from public.dossier_investisseurs di
  join public.investisseurs i on i.id=di.investisseur_id
  where di.dossier_id=p_dossier_id and di.investisseur_id<>v_primary
  order by di.role_dossier
  limit 1;

  if v_requires_spouse then
    if coalesce(trim(p_prenom),'')='' or coalesce(trim(p_nom),'')='' or coalesce(trim(p_email),'')='' then
      raise exception 'Pour un dossier couple, renseignez le prénom, le nom et l’email de la deuxième personne.';
    end if;
    if lower(trim(p_email)) = v_primary_email then
      raise exception 'La deuxième personne doit disposer d’une adresse email personnelle différente.';
    end if;

    if v_spouse is null then
      insert into public.investisseurs(foyer_id,civilite,prenom,nom,email,mobile)
      values(v_foyer,nullif(trim(p_civilite),''),trim(p_prenom),trim(p_nom),lower(trim(p_email)),nullif(trim(p_mobile),''))
      returning id into v_spouse;

      insert into public.dossier_investisseurs(dossier_id,investisseur_id,role_dossier,esg_status)
      values(p_dossier_id,v_spouse,'investisseur_2','not_applicable');
    elsif v_spouse_auth is null then
      update public.investisseurs
         set civilite=nullif(trim(p_civilite),''), prenom=trim(p_prenom), nom=trim(p_nom),
             email=lower(trim(p_email)), mobile=nullif(trim(p_mobile),''), updated_at=now()
       where id=v_spouse;
    end if;

    select rs.payload into v_family_payload
    from public.recueil_sections rs
    where rs.dossier_id=p_dossier_id and rs.investisseur_id=v_primary and rs.section_code='family'
    limit 1;

    if v_family_payload is not null then
      insert into public.recueil_sections(dossier_id,investisseur_id,section_code,payload,completed_at)
      values(p_dossier_id,v_spouse,'family',v_family_payload,now())
      on conflict(dossier_id,investisseur_id,section_code) do update
      set payload=excluded.payload, completed_at=coalesce(public.recueil_sections.completed_at,excluded.completed_at), updated_at=now();
    end if;

    select coalesce(rs.payload->'address','{}'::jsonb) into v_primary_address
    from public.recueil_sections rs
    where rs.dossier_id=p_dossier_id and rs.investisseur_id=v_primary and rs.section_code='identity'
    limit 1;

    v_identity_payload := jsonb_build_object(
      'civilite',coalesce(p_civilite,''),
      'prenom',coalesce(p_prenom,''),
      'nom',coalesce(p_nom,''),
      'mobile',coalesce(p_mobile,''),
      'pays_naissance','France',
      'nationalite','Française',
      'address',coalesce(v_primary_address,'{}'::jsonb)
    );

    insert into public.recueil_sections(dossier_id,investisseur_id,section_code,payload,completed_at)
    values(p_dossier_id,v_spouse,'identity',v_identity_payload,null)
    on conflict(dossier_id,investisseur_id,section_code) do nothing;

    return jsonb_build_object('couple',true,'spouse_id',v_spouse,'spouse_activated',v_spouse_auth is not null,'spouse_needs_invite',v_spouse_auth is null);
  end if;

  if v_spouse is not null then
    select exists(
      select 1 from public.recueil_sections rs where rs.dossier_id=p_dossier_id and rs.investisseur_id=v_spouse and rs.section_code<>'family'
      union all
      select 1 from public.questionnaire_sessions qs where qs.dossier_id=p_dossier_id and qs.investisseur_id=v_spouse
      union all
      select 1 from public.client_invites ci where ci.dossier_id=p_dossier_id and ci.investisseur_id=v_spouse
    ) into v_has_activity;

    if v_spouse_auth is null and not coalesce(v_has_activity,false) then
      delete from public.recueil_sections where dossier_id=p_dossier_id and investisseur_id=v_spouse;
      delete from public.dossier_investisseurs where dossier_id=p_dossier_id and investisseur_id=v_spouse;
      delete from public.investisseurs where id=v_spouse;
      v_spouse := null;
    end if;
  end if;

  return jsonb_build_object('couple',false,'spouse_id',v_spouse);
end;
$function$;

create or replace function private.validate_my_recueil_core(p_dossier_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_investisseur_id uuid;
  v_role text;
  v_total int;
  v_valides int;
  v_esg_opt_in boolean;
  v_missing_sections text;
  v_qpi_template uuid;
begin
  if v_uid is null then raise exception 'Authentification requise'; end if;
  select i.id,di.role_dossier,di.esg_opt_in
    into v_investisseur_id,v_role,v_esg_opt_in
  from public.investisseurs i
  join public.dossier_investisseurs di on di.investisseur_id=i.id
  where di.dossier_id=p_dossier_id and i.auth_user_id=v_uid
  limit 1;
  if v_investisseur_id is null then raise exception 'Aucun investisseur du dossier n’est rattaché au compte authentifié'; end if;
  if v_esg_opt_in is null then raise exception 'Indiquez si vous souhaitez exprimer des préférences de durabilité'; end if;

  select string_agg(required.section_code,', ' order by required.ord) into v_missing_sections
  from (values
    (1,'identity'),(2,'family'),(3,'professional'),(4,'objectives'),(5,'capacity'),
    (6,'regulatory'),(7,'patrimony')
  ) as required(ord,section_code)
  where not (v_role='investisseur_2' and required.section_code='family')
    and not exists(
      select 1 from public.recueil_sections rs
      where rs.dossier_id=p_dossier_id and rs.investisseur_id=v_investisseur_id
        and rs.section_code=required.section_code and rs.completed_at is not null
    );
  if v_missing_sections is not null then raise exception 'Recueil incomplet : section(s) à terminer : %',v_missing_sections; end if;

  if not exists(select 1 from public.objectifs_patrimoniaux o where o.dossier_id=p_dossier_id and o.portee=v_role) then
    raise exception 'Au moins un objectif patrimonial doit être renseigné avant validation du recueil';
  end if;
  if exists(select 1 from public.objectifs_patrimoniaux o where o.dossier_id=p_dossier_id and o.portee=v_role and (o.horizon_annees is null or o.horizon_annees<0)) then
    raise exception 'Un horizon doit être renseigné pour chaque objectif patrimonial';
  end if;
  if not exists(select 1 from public.situations_professionnelles sp where sp.dossier_id=p_dossier_id and sp.investisseur_id=v_investisseur_id and nullif(trim(sp.profession_actuelle),'') is not null and nullif(trim(sp.statut),'') is not null) then
    raise exception 'Renseignez votre profession actuelle et votre statut professionnel';
  end if;
  if not exists(select 1 from public.capacites_financieres cf where cf.dossier_id=p_dossier_id and cf.investisseur_id=v_investisseur_id and cf.capacite_epargne_mensuelle is not null and cf.epargne_precaution_cible is not null) then
    raise exception 'Renseignez votre épargne mensuelle disponible et votre épargne de précaution cible';
  end if;

  update public.dossier_investisseurs
     set recueil_status='validated',recueil_validated_at=now(),updated_at=now()
   where dossier_id=p_dossier_id and investisseur_id=v_investisseur_id;

  insert into public.validations(dossier_id,investisseur_id,objet_type,objet_id,type_validation,statut,methode,valide_par,validated_at)
  values(p_dossier_id,v_investisseur_id,'recueil',p_dossier_id,'validation_recueil_client','accepted','parcours_securise',v_uid,now());

  select id into v_qpi_template
  from public.questionnaire_templates
  where type_questionnaire='QPI' and actif=true
  order by date_revision desc nulls last,created_at desc
  limit 1;
  if v_qpi_template is not null then
    insert into public.questionnaire_sessions(dossier_id,investisseur_id,template_id,statut)
    values(p_dossier_id,v_investisseur_id,v_qpi_template,'not_started')
    on conflict do nothing;
  end if;

  select count(*),count(*) filter(where recueil_status='validated') into v_total,v_valides
  from public.dossier_investisseurs where dossier_id=p_dossier_id;
  if v_total>0 and v_total=v_valides then
    update public.dossiers set recueil_status='validated',updated_at=now() where id=p_dossier_id;
  else
    update public.dossiers set recueil_status='in_progress',updated_at=now() where id=p_dossier_id;
  end if;

  return jsonb_build_object('dossier_id',p_dossier_id,'investisseur_id',v_investisseur_id,'validated_investors',v_valides,'total_investors',v_total,'dossier_recueil_validated',(v_total>0 and v_total=v_valides));
end;
$function$;

create or replace function private.complete_my_documents_core(p_dossier_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_investisseur_id uuid;
  v_count integer;
  v_total integer;
  v_ready integer;
  v_now timestamptz := now();
  v_progress jsonb;
begin
  if v_uid is null then raise exception 'Authentification requise'; end if;
  select i.id into v_investisseur_id
  from public.investisseurs i
  join public.dossier_investisseurs di on di.investisseur_id=i.id
  where di.dossier_id=p_dossier_id and i.auth_user_id=v_uid
  limit 1;
  if v_investisseur_id is null then raise exception 'Accès refusé'; end if;

  select count(*), count(*) filter(where di.recueil_status='validated' and di.qpi_status in ('completed','validated') and (di.esg_opt_in is not true or di.esg_status in ('completed','validated')))
    into v_total,v_ready
  from public.dossier_investisseurs di
  where di.dossier_id=p_dossier_id;

  if v_total=0 or v_ready<>v_total then
    raise exception 'Le dossier ne peut pas encore être transmis : chaque personne doit avoir terminé son recueil, son profil investisseur et, le cas échéant, ses préférences de durabilité.';
  end if;

  select count(*) into v_count from public.documents_sources ds where ds.dossier_id=p_dossier_id;
  if v_count=0 then raise exception 'Transmettez au moins un document avant de terminer cette étape.'; end if;

  select jsonb_build_object(
    'dossier_id',p_dossier_id,'members_total',v_total,'members_ready',v_ready,
    'documents_count',v_count,'transmitted_at',v_now
  ) into v_progress;

  update public.dossier_investisseurs
     set documents_status='completed',documents_completed_at=v_now,transmitted_at=v_now,transmission_snapshot=v_progress,updated_at=v_now
   where dossier_id=p_dossier_id;

  insert into public.validations(dossier_id,investisseur_id,objet_type,objet_id,type_validation,statut,methode,commentaire,valide_par,validated_at)
  values(p_dossier_id,v_investisseur_id,'dossier',p_dossier_id,'transmission_finale_dossier','accepted','parcours_securise','Transmission finale du dossier commun après complétion de tous les parcours individuels',v_uid,v_now);
end;
$function$;

create or replace view public.portal_progress as
select
  d.id as dossier_id,
  di.investisseur_id,
  di.role_dossier,
  d.reference,
  d.libelle,
  d.recueil_status,
  di.qpi_status,
  di.esg_opt_in,
  di.esg_status,
  qpi.id as qpi_session_id,
  esg.id as esg_session_id,
  case
    when di.recueil_status <> 'validated' then 'RECUEIL'::text
    when di.qpi_status not in ('completed','validated') then 'QPI'::text
    when di.esg_opt_in is true and di.esg_status not in ('completed','validated') then 'ESG'::text
    when di.documents_status <> 'completed' then 'DOCUMENTS'::text
    else 'TERMINE'::text
  end as next_step,
  di.recueil_status as recueil_individual_status,
  di.recueil_validated_at,
  di.documents_status,
  di.documents_completed_at,
  di.transmitted_at,
  agg.members_total as dossier_members_total,
  agg.members_ready as dossier_members_ready,
  (agg.members_total > 0 and agg.members_total = agg.members_ready) as dossier_ready_for_documents,
  (agg.members_total > 1) as is_couple,
  agg.partner_activated
from public.dossiers d
join public.dossier_investisseurs di on di.dossier_id=d.id
join public.investisseurs i on i.id=di.investisseur_id
left join lateral (
  select qs.id
  from public.questionnaire_sessions qs
  join public.questionnaire_templates qt on qt.id=qs.template_id
  where qs.dossier_id=d.id and qs.investisseur_id=di.investisseur_id and qt.type_questionnaire='QPI'
  order by qs.created_at desc limit 1
) qpi on true
left join lateral (
  select qs.id
  from public.questionnaire_sessions qs
  join public.questionnaire_templates qt on qt.id=qs.template_id
  where qs.dossier_id=d.id and qs.investisseur_id=di.investisseur_id and qt.type_questionnaire='ESG'
  order by qs.created_at desc limit 1
) esg on true
left join lateral (
  select
    count(*)::int as members_total,
    count(*) filter(where dx.recueil_status='validated' and dx.qpi_status in ('completed','validated') and (dx.esg_opt_in is not true or dx.esg_status in ('completed','validated')))::int as members_ready,
    coalesce(bool_or(ix.auth_user_id is not null) filter(where dx.investisseur_id<>di.investisseur_id),false) as partner_activated
  from public.dossier_investisseurs dx
  join public.investisseurs ix on ix.id=dx.investisseur_id
  where dx.dossier_id=d.id
) agg on true
where (select private.is_staff()) or i.auth_user_id=(select auth.uid());

grant select on public.portal_progress to authenticated;

insert into public.recueil_sections(dossier_id,investisseur_id,section_code,payload,completed_at)
select di2.dossier_id,di2.investisseur_id,'family',rs.payload,coalesce(rs.completed_at,now())
from public.dossier_investisseurs di2
join public.dossier_investisseurs di1 on di1.dossier_id=di2.dossier_id and di1.role_dossier='investisseur_1'
join public.recueil_sections rs on rs.dossier_id=di1.dossier_id and rs.investisseur_id=di1.investisseur_id and rs.section_code='family'
where di2.role_dossier='investisseur_2'
on conflict(dossier_id,investisseur_id,section_code) do update
set payload=excluded.payload, completed_at=coalesce(public.recueil_sections.completed_at,excluded.completed_at), updated_at=now();
