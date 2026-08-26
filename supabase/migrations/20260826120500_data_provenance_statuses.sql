alter table public.data_provenance
  add column if not exists valeur_retenue text,
  add column if not exists justification_ecart text,
  add column if not exists verified_at timestamptz,
  add column if not exists retained_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id),
  add column if not exists retained_by uuid references auth.users(id);

alter table public.data_provenance
  drop constraint if exists data_provenance_statut_validation_check;

alter table public.data_provenance
  add constraint data_provenance_statut_validation_check
  check (statut_validation = any (array[
    'declare'::text,
    'extrait'::text,
    'a_verifier'::text,
    'verifie'::text,
    'retenu_cif'::text,
    'valide_client'::text,
    'valide_cif'::text,
    'rejete'::text
  ]));

create index if not exists data_provenance_dossier_field_idx
  on public.data_provenance (dossier_id, entity_table, entity_id, field_name, created_at desc);

comment on column public.data_provenance.valeur_retenue is 'Valeur finale retenue par le CIF lorsqu’elle diffère de la valeur déclarée ou vérifiée.';
comment on column public.data_provenance.justification_ecart is 'Justification obligatoire en pratique lorsqu’une valeur CIF retenue diffère de la source.';
comment on column public.data_provenance.verified_at is 'Date de vérification de la donnée contre une source ou un justificatif.';
comment on column public.data_provenance.retained_at is 'Date à laquelle le CIF retient la valeur pour l’analyse et les documents réglementaires.';
