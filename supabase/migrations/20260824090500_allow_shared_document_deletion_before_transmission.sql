drop policy if exists client_documents_sources_delete on public.documents_sources;
create policy client_documents_sources_delete
on public.documents_sources
for delete
to authenticated
using (
  (select private.has_dossier_access(documents_sources.dossier_id))
  and exists (
    select 1
    from public.dossier_investisseurs di
    join public.investisseurs i on i.id = di.investisseur_id
    where di.dossier_id = documents_sources.dossier_id
      and i.auth_user_id = auth.uid()
      and di.transmitted_at is null
  )
);

drop policy if exists client_source_docs_delete on storage.objects;
create policy client_source_docs_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'client-source-docs'
  and (select private.has_dossier_access(private.storage_dossier_id(name)))
  and exists (
    select 1
    from public.dossier_investisseurs di
    join public.investisseurs i on i.id = di.investisseur_id
    where di.dossier_id = private.storage_dossier_id(storage.objects.name)
      and i.auth_user_id = auth.uid()
      and di.transmitted_at is null
  )
);
