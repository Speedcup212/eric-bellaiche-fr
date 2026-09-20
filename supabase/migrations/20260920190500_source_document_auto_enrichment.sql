-- Automatic enrichment of the recueil from client source documents.
-- Extracted values fill only empty fields. Existing client declarations are never silently overwritten.
create index if not exists idx_documents_sources_dossier_investor_created
  on public.documents_sources(dossier_id,investisseur_id,created_at desc);

create index if not exists idx_data_provenance_source_document
  on public.data_provenance(source_document_id)
  where source_document_id is not null;

undefined;

revoke all on function public.apply_source_document_extraction(uuid,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.apply_source_document_extraction(uuid,jsonb,text,text) to service_role;
