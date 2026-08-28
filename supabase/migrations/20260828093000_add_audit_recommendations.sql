create table if not exists public.audit_recommendations (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null unique references public.dossiers(id) on delete cascade,
  statut text not null default 'draft' check (statut in ('draft','validated')),
  diagnostic text,
  projet_a_preserver text,
  reserve_securite numeric(15,2),
  epargne_a_arbitrer numeric(15,2),
  allocation jsonb not null default '[]'::jsonb,
  supports jsonb not null default '{}'::jsonb,
  sequencing jsonb not null default '[]'::jsonb,
  fiscal_notes jsonb not null default '[]'::jsonb,
  protection_notes text,
  controls jsonb not null default '[]'::jsonb,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists audit_recommendations_dossier_idx on public.audit_recommendations(dossier_id);

alter table public.audit_recommendations enable row level security;

create policy "audit recommendations cabinet read" on public.audit_recommendations
for select to authenticated
using (exists (select 1 from public.app_users u where u.user_id = auth.uid() and u.actif = true and u.role in ('cif','admin')));

create policy "audit recommendations cabinet write" on public.audit_recommendations
for all to authenticated
using (exists (select 1 from public.app_users u where u.user_id = auth.uid() and u.actif = true and u.role in ('cif','admin')))
with check (exists (select 1 from public.app_users u where u.user_id = auth.uid() and u.actif = true and u.role in ('cif','admin')));
