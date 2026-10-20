-- Support des coordonnées communes de couple sans partage de compte d'authentification.
-- Les tokens d'activation du second investisseur sont bloqués tant que l'email est partagé.
begin;

-- API explicite du cabinet : préserve la fonction historique à 10 arguments,
-- et exige un choix volontaire pour partager email et téléphone.
create or replace function public.create_client_dossier(
  p_reference text,
  p_libelle text,
  p_inv1_prenom text,
  p_inv1_nom text,
  p_inv1_email text,
  p_inv1_mobile text,
  p_inv2_prenom text,
  p_inv2_nom text,
  p_inv2_email text,
  p_inv2_mobile text,
  p_shared_contacts boolean
)
returns jsonb
language plpgsql
security invoker
set search_path to ''
as $function$
begin
  if coalesce(p_shared_contacts, false) then
    if nullif(trim(coalesce(p_inv2_prenom, '')), '') is null
       or nullif(trim(coalesce(p_inv2_nom, '')), '') is null then
      raise exception 'Le partage des coordonnées nécessite deux investisseurs identifiés';
    end if;
    if nullif(trim(coalesce(p_inv1_email, '')), '') is null then
      raise exception 'Adresse email du foyer requise';
    end if;
  elsif nullif(trim(coalesce(p_inv2_email, '')), '') is not null
        and lower(trim(p_inv1_email)) = lower(trim(p_inv2_email)) then
    raise exception 'Deux emails identiques : activez « Coordonnées communes au couple »';
  end if;

  return private.create_client_dossier_core(
    p_reference, p_libelle, p_inv1_prenom, p_inv1_nom, p_inv1_email, p_inv1_mobile,
    p_inv2_prenom, p_inv2_nom,
    case when coalesce(p_shared_contacts, false) then p_inv1_email else p_inv2_email end,
    case when coalesce(p_shared_contacts, false) then p_inv1_mobile else p_inv2_mobile end
  );
end;
$function$;

revoke all on function public.create_client_dossier(text,text,text,text,text,text,text,text,text,text,boolean) from public, anon;
grant execute on function public.create_client_dossier(text,text,text,text,text,text,text,text,text,text,boolean) to authenticated;

CREATE OR REPLACE FUNCTION private.sync_my_spouse_from_family_impl(p_dossier_id uuid, p_situation text, p_civilite text DEFAULT NULL::text, p_prenom text DEFAULT NULL::text, p_nom text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_mobile text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    -- Un contact familial commun est autorisé, mais chaque investisseur conserve son identité.

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
$function$
;

CREATE OR REPLACE FUNCTION private.create_client_invite_core(p_dossier_id uuid, p_investisseur_id uuid, p_email text, p_validity_days integer DEFAULT 7)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_token text;
  v_hash text;
  v_email text := lower(trim(p_email));
begin
  if not (select private.is_staff()) then raise exception 'Accès refusé'; end if;
  if p_validity_days < 1 or p_validity_days > 30 then raise exception 'Durée de validité invalide'; end if;
  if not exists (
    select 1 from public.dossier_investisseurs di
    where di.dossier_id = p_dossier_id and di.investisseur_id = p_investisseur_id
  ) then
    raise exception 'Investisseur non rattaché au dossier';
  end if;
  if v_email is null or v_email = '' then
    raise exception 'Adresse email requise';
  end if;
  if private.email_belongs_to_staff(v_email) then
    raise exception 'Cette adresse email appartient à un compte cabinet et ne peut pas être utilisée pour un accès client';
  end if;

  if exists (
    select 1 from public.dossier_investisseurs secondary_member
    join public.investisseurs secondary_identity on secondary_identity.id = secondary_member.investisseur_id
    join public.dossier_investisseurs primary_member
      on primary_member.dossier_id = secondary_member.dossier_id and primary_member.role_dossier = 'investisseur_1'
    join public.investisseurs primary_identity on primary_identity.id = primary_member.investisseur_id
    where secondary_member.dossier_id = p_dossier_id
      and secondary_member.investisseur_id = p_investisseur_id
      and secondary_member.role_dossier = 'investisseur_2'
      and nullif(trim(primary_identity.email), '') is not null
      and lower(trim(secondary_identity.email)) = lower(trim(primary_identity.email))
  ) then
    raise exception 'Adresse partagée : un email distinct est nécessaire pour activer l’accès personnel du deuxième investisseur';
  end if;

  v_token := encode(extensions.gen_random_bytes(32),'hex');
  v_hash := encode(extensions.digest(v_token,'sha256'),'hex');
  insert into public.client_invites(dossier_id,investisseur_id,email,token_hash,expires_at,created_by)
  values(p_dossier_id,p_investisseur_id,v_email,v_hash,now()+make_interval(days=>p_validity_days),(select auth.uid()));
  return v_token;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.claim_client_invite_core(p_token text)
 RETURNS TABLE(dossier_id uuid, investisseur_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_email text;
  v_inv public.client_invites%rowtype;
  v_role text;
begin
  if v_uid is null then raise exception 'Authentification requise'; end if;

  select lower(email) into v_email from auth.users where id = v_uid;
  select role into v_role from public.app_users where auth_user_id = v_uid and actif = true;
  if v_role in ('cif','admin') then
    raise exception 'Un compte cabinet ne peut pas activer une invitation client';
  end if;

  select * into v_inv from public.client_invites ci
  where ci.token_hash = encode(extensions.digest(p_token,'sha256'),'hex')
    and ci.used_at is null and ci.expires_at > now()
  limit 1;

  if v_inv.id is null then raise exception 'Invitation invalide ou expirée'; end if;
  if private.email_belongs_to_staff(v_inv.email) then
    raise exception 'Cette invitation utilise une adresse réservée au cabinet';
  end if;
  if v_email is null or v_email <> lower(trim(v_inv.email)) then
    raise exception 'Cette invitation ne correspond pas au compte authentifié';
  end if;
  if exists(
    select 1 from public.investisseurs i
    where i.id = v_inv.investisseur_id
      and i.auth_user_id is not null
      and i.auth_user_id <> v_uid
  ) then
    raise exception 'Ce dossier est déjà lié à un autre compte';
  end if;

  if exists (
    select 1 from public.dossier_investisseurs secondary_member
    join public.investisseurs secondary_identity on secondary_identity.id = secondary_member.investisseur_id
    join public.dossier_investisseurs primary_member
      on primary_member.dossier_id = secondary_member.dossier_id and primary_member.role_dossier = 'investisseur_1'
    join public.investisseurs primary_identity on primary_identity.id = primary_member.investisseur_id
    where secondary_member.dossier_id = v_inv.dossier_id
      and secondary_member.investisseur_id = v_inv.investisseur_id
      and secondary_member.role_dossier = 'investisseur_2'
      and nullif(trim(primary_identity.email), '') is not null
      and lower(trim(secondary_identity.email)) = lower(trim(primary_identity.email))
  ) then
    raise exception 'Adresse partagée : un email distinct est nécessaire pour activer l’accès personnel du deuxième investisseur';
  end if;

  update public.investisseurs set auth_user_id = v_uid, updated_at = now() where id = v_inv.investisseur_id;
  insert into public.app_users(auth_user_id,role,actif,display_name)
  select v_uid,'client',true,coalesce(nullif(trim(i.prenom||' '||i.nom),''),v_email)
  from public.investisseurs i where i.id = v_inv.investisseur_id
  on conflict(auth_user_id) do update
    set actif = true, display_name = excluded.display_name, role = 'client', updated_at = now();

  update public.client_invites set used_at = now() where id = v_inv.id;
  dossier_id := v_inv.dossier_id;
  investisseur_id := v_inv.investisseur_id;
  return next;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.service_activate_client_invite_core(p_token text, p_email text, p_auth_user_id uuid)
 RETURNS TABLE(dossier_id uuid, investisseur_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_inv public.client_invites%rowtype;
  v_auth_email text;
  v_role text;
begin
  if p_auth_user_id is null then raise exception 'Utilisateur requis'; end if;

  select lower(email) into v_auth_email from auth.users where id = p_auth_user_id;
  if v_auth_email is null then raise exception 'Compte authentifié introuvable'; end if;

  select role into v_role from public.app_users where auth_user_id = p_auth_user_id and actif = true;
  if v_role in ('cif','admin') then
    raise exception 'Un compte cabinet ne peut pas activer une invitation client';
  end if;
  if private.email_belongs_to_staff(p_email) then
    raise exception 'Cette adresse email appartient à un compte cabinet et ne peut pas être utilisée pour un accès client';
  end if;
  if v_auth_email <> lower(trim(p_email)) then raise exception 'Adresse email incohérente'; end if;

  select * into v_inv from public.client_invites ci
  where ci.token_hash = encode(extensions.digest(p_token,'sha256'),'hex')
    and ci.used_at is null
    and ci.expires_at > now()
  limit 1;

  if v_inv.id is null then raise exception 'Invitation invalide ou expirée'; end if;
  if private.email_belongs_to_staff(v_inv.email) then
    raise exception 'Cette invitation utilise une adresse réservée au cabinet';
  end if;
  if lower(trim(v_inv.email)) <> lower(trim(p_email)) then
    raise exception 'Cette invitation ne correspond pas à cette adresse email';
  end if;
  if exists(
    select 1 from public.investisseurs i
    where i.id = v_inv.investisseur_id
      and i.auth_user_id is not null
      and i.auth_user_id <> p_auth_user_id
  ) then
    raise exception 'Ce dossier est déjà lié à un autre compte';
  end if;

  if exists (
    select 1 from public.dossier_investisseurs secondary_member
    join public.investisseurs secondary_identity on secondary_identity.id = secondary_member.investisseur_id
    join public.dossier_investisseurs primary_member
      on primary_member.dossier_id = secondary_member.dossier_id and primary_member.role_dossier = 'investisseur_1'
    join public.investisseurs primary_identity on primary_identity.id = primary_member.investisseur_id
    where secondary_member.dossier_id = v_inv.dossier_id
      and secondary_member.investisseur_id = v_inv.investisseur_id
      and secondary_member.role_dossier = 'investisseur_2'
      and nullif(trim(primary_identity.email), '') is not null
      and lower(trim(secondary_identity.email)) = lower(trim(primary_identity.email))
  ) then
    raise exception 'Adresse partagée : un email distinct est nécessaire pour activer l’accès personnel du deuxième investisseur';
  end if;

  update public.investisseurs
  set auth_user_id = p_auth_user_id, updated_at = now()
  where id = v_inv.investisseur_id;

  insert into public.app_users(auth_user_id, role, actif, display_name)
  select p_auth_user_id, 'client', true,
         coalesce(nullif(trim(i.prenom || ' ' || i.nom),''), lower(trim(p_email)))
  from public.investisseurs i
  where i.id = v_inv.investisseur_id
  on conflict(auth_user_id) do update
    set actif = true,
        display_name = excluded.display_name,
        role = 'client',
        updated_at = now();

  update public.client_invites set used_at = now() where id = v_inv.id;
  dossier_id := v_inv.dossier_id;
  investisseur_id := v_inv.investisseur_id;
  return next;
end;
$function$
;

commit;