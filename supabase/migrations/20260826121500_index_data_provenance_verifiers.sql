create index if not exists data_provenance_verified_by_idx
  on public.data_provenance (verified_by)
  where verified_by is not null;

create index if not exists data_provenance_retained_by_idx
  on public.data_provenance (retained_by)
  where retained_by is not null;
