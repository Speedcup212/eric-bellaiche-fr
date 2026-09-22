alter table public.audit_recommendations
  add column if not exists uploaded_pdf_bucket text,
  add column if not exists uploaded_pdf_path text,
  add column if not exists uploaded_pdf_name text,
  add column if not exists uploaded_pdf_at timestamptz;
