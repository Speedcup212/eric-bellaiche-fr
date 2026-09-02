update public.investisseurs i
set auth_user_id = null,
    updated_at = now()
where i.auth_user_id is not null
  and exists (
    select 1
    from public.app_users au
    where au.auth_user_id = i.auth_user_id
      and au.actif = true
      and au.role in ('cif','admin')
  );

create or replace function private.guard_investor_staff_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.auth_user_id is not null and exists (
    select 1 from public.app_users au
    where au.auth_user_id = new.auth_user_id
      and au.actif = true
      and au.role in ('cif','admin')
  ) then
    raise exception 'Un compte cabinet ne peut pas être lié à une identité client';
  end if;

  if nullif(trim(coalesce(new.email,'')), '') is not null
     and private.email_belongs_to_staff(new.email) then
    raise exception 'Cette adresse email est réservée à un compte cabinet';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_investor_staff_identity on public.investisseurs;
create trigger trg_guard_investor_staff_identity
before insert or update of auth_user_id, email on public.investisseurs
for each row execute function private.guard_investor_staff_identity();

revoke execute on function public.get_client_invite_statuses() from anon;
revoke execute on function public.mark_client_invite_sent(uuid, uuid, timestamptz, text) from anon;
