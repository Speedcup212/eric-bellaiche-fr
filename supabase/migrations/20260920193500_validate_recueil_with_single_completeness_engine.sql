-- Validation now uses the same 10-section completeness engine as the cockpit.
CREATE OR REPLACE FUNCTION private.validate_my_recueil_core(p_dossier_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_investisseur_id uuid;
  v_role text;
  v_total int;
  v_valides int;
  v_esg_opt_in boolean;
  v_qpi_template uuid;
  v_completeness jsonb;
  v_missing_sections text;
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

  v_completeness := private.recueil_completeness_core(p_dossier_id,v_investisseur_id);

  if coalesce((v_completeness->>'complete')::boolean,false)=false then
    select string_agg(section_code,', ' order by ord)
      into v_missing_sections
    from (
      select
        row_number() over () as ord,
        value->>'section_code' as section_code
      from jsonb_array_elements(v_completeness->'sections')
      where coalesce((value->>'complete')::boolean,false)=false
    ) x;

    raise exception 'Recueil incomplet (% %%). Section(s) à terminer ou confirmer : %',
      coalesce(v_completeness->>'percentage','0'),coalesce(v_missing_sections,'inconnues');
  end if;

  if not exists(
    select 1 from public.objectifs_patrimoniaux o
    where o.dossier_id=p_dossier_id and o.portee=v_role
  ) then
    raise exception 'Au moins un objectif patrimonial doit être renseigné avant validation du recueil';
  end if;

  if exists(
    select 1 from public.objectifs_patrimoniaux o
    where o.dossier_id=p_dossier_id and o.portee=v_role
      and (o.horizon_annees is null or o.horizon_annees<0)
  ) then
    raise exception 'Un horizon doit être renseigné pour chaque objectif patrimonial';
  end if;

  if not exists(
    select 1 from public.situations_professionnelles sp
    where sp.dossier_id=p_dossier_id and sp.investisseur_id=v_investisseur_id
      and nullif(trim(sp.profession_actuelle),'') is not null
      and nullif(trim(sp.statut),'') is not null
  ) then
    raise exception 'Renseignez votre profession actuelle et votre statut professionnel';
  end if;

  if not exists(
    select 1 from public.capacites_financieres cf
    where cf.dossier_id=p_dossier_id and cf.investisseur_id=v_investisseur_id
      and cf.capacite_epargne_mensuelle is not null
      and cf.epargne_precaution_cible is not null
  ) then
    raise exception 'Renseignez votre épargne mensuelle disponible et votre épargne de précaution cible';
  end if;

  update public.dossier_investisseurs
     set recueil_status='validated',recueil_validated_at=now(),updated_at=now()
   where dossier_id=p_dossier_id and investisseur_id=v_investisseur_id;

  insert into public.validations(
    dossier_id,investisseur_id,objet_type,objet_id,type_validation,statut,methode,valide_par,validated_at
  )
  values(
    p_dossier_id,v_investisseur_id,'recueil',p_dossier_id,
    'validation_recueil_client','accepted','parcours_securise',v_uid,now()
  );

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

  select count(*),count(*) filter(where recueil_status='validated')
    into v_total,v_valides
  from public.dossier_investisseurs
  where dossier_id=p_dossier_id;

  if v_total>0 and v_total=v_valides then
    update public.dossiers set recueil_status='validated',updated_at=now() where id=p_dossier_id;
  else
    update public.dossiers set recueil_status='in_progress',updated_at=now() where id=p_dossier_id;
  end if;

  return jsonb_build_object(
    'dossier_id',p_dossier_id,
    'investisseur_id',v_investisseur_id,
    'validated_investors',v_valides,
    'total_investors',v_total,
    'dossier_recueil_validated',(v_total>0 and v_total=v_valides),
    'completeness',v_completeness
  );
end;
$function$
;
