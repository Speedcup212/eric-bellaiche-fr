alter table public.data_provenance
  add column if not exists investisseur_id uuid references public.investisseurs(id) on delete set null;

create index if not exists data_provenance_investisseur_idx
  on public.data_provenance (dossier_id, investisseur_id, created_at desc);
