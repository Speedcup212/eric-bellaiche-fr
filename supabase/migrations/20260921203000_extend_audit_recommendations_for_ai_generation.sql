alter table public.audit_recommendations
  add column if not exists audit_markdown text,
  add column if not exists anomalies jsonb not null default '[]'::jsonb,
  add column if not exists research_sources jsonb not null default '[]'::jsonb,
  add column if not exists generation_meta jsonb not null default '{}'::jsonb;
