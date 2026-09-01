create table if not exists public.calendly_prospect_imports (
  id uuid primary key default extensions.gen_random_uuid(),
  calendly_event_uri text not null,
  calendly_invitee_uri text not null unique,
  event_name text,
  event_start_at timestamptz,
  first_name text not null,
  last_name text not null,
  email text not null,
  mobile text,
  city text,
  needs text,
  dossier_id uuid references public.dossiers(id) on delete set null,
  investisseur_id uuid references public.investisseurs(id) on delete set null,
  import_status text not null default 'created' check (import_status in ('created','existing','ignored')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendly_prospect_imports enable row level security;
revoke all on public.calendly_prospect_imports from anon, authenticated;

create or replace function public.sync_calendly_prospect(
  p_secret text,
  p_event_uri text,
  p_invitee_uri text,
  p_event_name text,
  p_event_start_at timestamptz,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_mobile text default null,
  p_city text default null,
  p_needs text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_secret_hash constant text := 'cf72f26fb162fd0a753145621bc7c1a2c30e519d5340d94587526145ff0c34dc';
  v_email text := lower(trim(coalesce(p_email,'')));
  v_existing_dossier uuid;
  v_existing_investor uuid;
  v_foyer uuid;
  v_dossier uuid;
  v_investor uuid;
  v_reference text;
  v_prior public.calendly_prospect_imports%rowtype;
begin
  if encode(extensions.digest(coalesce(p_secret,''), 'sha256'), 'hex') <> v_secret_hash then
    raise exception 'Calendly sync unauthorized';
  end if;
  if coalesce(trim(p_invitee_uri),'') = '' or coalesce(trim(p_event_uri),'') = '' then
    raise exception 'Calendly event/invitee identifiers required';
  end if;
  if coalesce(trim(p_first_name),'') = '' or coalesce(trim(p_last_name),'') = '' or v_email = '' then
    raise exception 'Calendly prospect identity incomplete';
  end if;

  select * into v_prior from public.calendly_prospect_imports where calendly_invitee_uri = trim(p_invitee_uri);
  if found then
    return jsonb_build_object('ok', true, 'action', 'already_synced', 'dossier_id', v_prior.dossier_id, 'investisseur_id', v_prior.investisseur_id);
  end if;

  select di.dossier_id, i.id into v_existing_dossier, v_existing_investor
  from public.investisseurs i
  join public.dossier_investisseurs di on di.investisseur_id = i.id
  where lower(trim(i.email)) = v_email
  order by di.created_at nulls last
  limit 1;

  if v_existing_investor is not null then
    insert into public.calendly_prospect_imports(
      calendly_event_uri, calendly_invitee_uri, event_name, event_start_at,
      first_name, last_name, email, mobile, city, needs,
      dossier_id, investisseur_id, import_status
    ) values (
      trim(p_event_uri), trim(p_invitee_uri), nullif(trim(p_event_name),''), p_event_start_at,
      trim(p_first_name), trim(p_last_name), v_email, nullif(trim(p_mobile),''), nullif(trim(p_city),''), nullif(trim(p_needs),''),
      v_existing_dossier, v_existing_investor, 'existing'
    );
    return jsonb_build_object('ok', true, 'action', 'existing_client', 'dossier_id', v_existing_dossier, 'investisseur_id', v_existing_investor);
  end if;

  v_reference := 'CAL-' || to_char(clock_timestamp(),'YYYYMMDD-HH24MISS') || '-' || upper(substr(encode(extensions.gen_random_bytes(3),'hex'),1,6));
  insert into public.foyers(libelle) values(trim(p_first_name) || ' ' || trim(p_last_name)) returning id into v_foyer;
  insert into public.investisseurs(foyer_id, prenom, nom, email, mobile)
  values(v_foyer, trim(p_first_name), trim(p_last_name), v_email, nullif(trim(p_mobile),'')) returning id into v_investor;
  insert into public.dossiers(foyer_id, reference, libelle, statut, recueil_status, date_entree_relation)
  values(v_foyer, v_reference, trim(p_first_name) || ' ' || trim(p_last_name), 'collecte', 'not_started', current_date) returning id into v_dossier;
  insert into public.dossier_investisseurs(dossier_id, investisseur_id, role_dossier, esg_status)
  values(v_dossier, v_investor, 'investisseur_1', 'not_applicable');

  insert into public.calendly_prospect_imports(
    calendly_event_uri, calendly_invitee_uri, event_name, event_start_at,
    first_name, last_name, email, mobile, city, needs,
    dossier_id, investisseur_id, import_status
  ) values (
    trim(p_event_uri), trim(p_invitee_uri), nullif(trim(p_event_name),''), p_event_start_at,
    trim(p_first_name), trim(p_last_name), v_email, nullif(trim(p_mobile),''), nullif(trim(p_city),''), nullif(trim(p_needs),''),
    v_dossier, v_investor, 'created'
  );

  return jsonb_build_object('ok', true, 'action', 'created', 'dossier_id', v_dossier, 'investisseur_id', v_investor, 'reference', v_reference);
end;
$function$;

revoke all on function public.sync_calendly_prospect(text,text,text,text,timestamptz,text,text,text,text,text,text) from public;
grant execute on function public.sync_calendly_prospect(text,text,text,text,timestamptz,text,text,text,text,text,text) to anon;
