alter table public.client_invites add column if not exists sent_at timestamptz;
alter table public.client_invites add column if not exists smtp_reply text;

create or replace function public.mark_client_invite_sent(
  p_dossier_id uuid,
  p_investisseur_id uuid,
  p_sent_at timestamptz default now(),
  p_smtp_reply text default null
) returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sent_at timestamptz;
begin
  if not exists (
    select 1 from public.app_users
    where auth_user_id = auth.uid()
      and actif = true
      and role in ('cif','admin')
  ) then
    raise exception 'Accès cabinet requis';
  end if;

  update public.client_invites ci
     set sent_at = coalesce(p_sent_at, now()),
         smtp_reply = left(p_smtp_reply, 1000)
   where ci.id = (
     select id
       from public.client_invites
      where dossier_id = p_dossier_id
        and investisseur_id = p_investisseur_id
      order by created_at desc
      limit 1
   )
  returning sent_at into v_sent_at;

  if v_sent_at is null then
    raise exception 'Invitation introuvable';
  end if;

  return v_sent_at;
end;
$$;

create or replace function public.get_client_invite_statuses()
returns table (
  dossier_id uuid,
  investisseur_id uuid,
  email text,
  last_sent_at timestamptz,
  send_count bigint
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select ci.dossier_id,
         ci.investisseur_id,
         max(ci.email) filter (where ci.created_at = x.max_created_at) as email,
         max(ci.sent_at) as last_sent_at,
         count(*) filter (where ci.sent_at is not null) as send_count
    from public.client_invites ci
    join (
      select dossier_id, investisseur_id, max(created_at) as max_created_at
        from public.client_invites
       group by dossier_id, investisseur_id
    ) x on x.dossier_id = ci.dossier_id and x.investisseur_id = ci.investisseur_id
   where exists (
     select 1 from public.app_users
      where auth_user_id = auth.uid()
        and actif = true
        and role in ('cif','admin')
   )
   group by ci.dossier_id, ci.investisseur_id;
$$;

grant execute on function public.mark_client_invite_sent(uuid,uuid,timestamptz,text) to authenticated;
grant execute on function public.get_client_invite_statuses() to authenticated;
