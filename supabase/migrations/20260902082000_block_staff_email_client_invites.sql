create or replace function private.email_belongs_to_staff(p_email text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join public.app_users au on au.auth_user_id = u.id
    where lower(trim(u.email)) = lower(trim(p_email))
      and au.actif = true
      and au.role in ('cif','admin')
  );
$$;

create or replace function private.create_client_invite_core(
  p_dossier_id uuid,
  p_investisseur_id uuid,
  p_email text,
  p_validity_days integer default 7
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
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

  v_token := encode(extensions.gen_random_bytes(32),'hex');
  v_hash := encode(extensions.digest(v_token,'sha256'),'hex');
  insert into public.client_invites(dossier_id,investisseur_id,email,token_hash,expires_at,created_by)
  values(p_dossier_id,p_investisseur_id,v_email,v_hash,now()+make_interval(days=>p_validity_days),(select auth.uid()));
  return v_token;
end;
$$;

create or replace function private.claim_client_invite_core(p_token text)
returns table(dossier_id uuid, investisseur_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

create or replace function private.service_activate_client_invite_core(
  p_token text,
  p_email text,
  p_auth_user_id uuid
)
returns table(dossier_id uuid, investisseur_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

update public.client_invites ci
set expires_at = least(ci.expires_at, now())
where ci.used_at is null
  and private.email_belongs_to_staff(ci.email);
