create table if not exists public.credit_pdf_page_cache (
  document_id uuid not null references public.documents_sources(id) on delete cascade,
  page_number integer not null check (page_number between 1 and 120),
  page_count integer not null check (page_count between 1 and 120),
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  lines jsonb not null check (jsonb_typeof(lines)='array'),
  created_at timestamptz not null default now(),
  primary key(document_id,page_number),
  constraint credit_pdf_page_cache_index check (page_number<=page_count)
);
alter table public.credit_pdf_page_cache enable row level security;
revoke all on table public.credit_pdf_page_cache from anon,authenticated,public;
grant select,insert,update,delete on public.credit_pdf_page_cache to service_role;
create index if not exists credit_pdf_page_cache_hash on public.credit_pdf_page_cache(document_id,source_sha256,created_at);
