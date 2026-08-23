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
    else
      if v_spouse_auth is not null then
        raise exception 'La deuxième personne a déjà activé son accès. Toute modification de son identité doit être effectuée depuis son propre espace ou par le cabinet.';
      end if;
      update public.investisseurs
         set civilite=nullif(trim(p_civilite),''), prenom=trim(p_prenom), nom=trim(p_nom),
             email=lower(trim(p_email)), mobile=nullif(trim(p_mobile),''), updated_at=now()
       where id=v_spouse;
    end if;

    return jsonb_build_object('couple',true,'spouse_id',v_spouse);
  end if;

  if v_spouse is not null then
    select exists(
      select 1 from public.recueil_sections rs where rs.dossier_id=p_dossier_id and rs.investisseur_id=v_spouse
      union all
      select 1 from public.questionnaire_sessions qs where qs.dossier_id=p_dossier_id and qs.investisseur_id=v_spouse
      union all
      select 1 from public.client_invites ci where ci.dossier_id=p_dossier_id and ci.investisseur_id=v_spouse
    ) into v_has_activity;

    if v_spouse_auth is null and not coalesce(v_has_activity,false) then
      delete from public.dossier_investisseurs where dossier_id=p_dossier_id and investisseur_id=v_spouse;
      delete from public.investisseurs where id=v_spouse;
      v_spouse := null;
    end if;
  end if;

  return jsonb_build_object('couple',false,'spouse_id',v_spouse);
end;
$function$;
