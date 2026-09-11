alter table public.dossiers
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid;

create index if not exists dossiers_archived_at_idx
  on public.dossiers (archived_at);

-- Keep a useful dossier link for normal updates/deletions, but avoid FK failures
-- during a cascading dossier deletion. The deleted dossier id remains in metadata.
create or replace function private.audit_sensitive_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_row jsonb;
  v_dossier uuid;
  v_original_dossier uuid;
  v_entity uuid;
  v_metadata jsonb := jsonb_build_object('source','db_trigger');
begin
  v_row := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;

  begin
    if tg_table_name = 'dossiers' then
      v_original_dossier := nullif(v_row->>'id','')::uuid;
    else
      v_original_dossier := nullif(v_row->>'dossier_id','')::uuid;
    end if;
  exception when others then
    v_original_dossier := null;
  end;

  begin
    v_entity := nullif(v_row->>'id','')::uuid;
  exception when others then
    v_entity := null;
  end;

  v_dossier := v_original_dossier;
  if tg_op = 'DELETE' and v_original_dossier is not null
     and not exists (select 1 from public.dossiers where id = v_original_dossier) then
    v_dossier := null;
  end if;

  if v_original_dossier is not null then
    v_metadata := v_metadata || jsonb_build_object('original_dossier_id', v_original_dossier);
  end if;

  insert into public.audit_log(
    dossier_id, actor_user_id, action, entity_table, entity_id, before_data, after_data, metadata
  ) values (
    v_dossier, auth.uid(), lower(tg_op), tg_table_name, v_entity, null, null, v_metadata
  );

  return case when tg_op='DELETE' then old else new end;
end;
$$;

create or replace function public.archive_client_dossier(
  p_dossier_id uuid,
  p_archived boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_updated integer := 0;
begin
  if not private.is_staff() then
    raise exception 'Accès refusé';
  end if;

  update public.dossiers
  set archived_at = case when p_archived then now() else null end,
      archived_by = case when p_archived then auth.uid() else null end
  where id = p_dossier_id;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'Dossier introuvable';
  end if;

  return jsonb_build_object(
    'ok', true,
    'dossier_id', p_dossier_id,
    'archived', p_archived
  );
end;
$$;

revoke all on function public.archive_client_dossier(uuid, boolean) from public;
grant execute on function public.archive_client_dossier(uuid, boolean) to authenticated;

create or replace function public.delete_client_dossier(p_dossier_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_deleted integer := 0;
begin
  if not private.is_staff() then
    raise exception 'Accès refusé';
  end if;

  -- Permanent deletion is reserved for empty/test/duplicate dossiers.
  -- Once source documents, generated regulatory documents or validations exist,
  -- the dossier must be archived instead.
  if exists (
    select 1 from public.documents_sources where dossier_id = p_dossier_id
  ) or exists (
    select 1
    from public.documents_reglementaires
    where dossier_id = p_dossier_id
      and (storage_path_pdf is not null or storage_path_docx is not null)
  ) or exists (
    select 1 from public.validations where dossier_id = p_dossier_id
  ) then
    raise exception 'Suppression définitive impossible : ce dossier contient des données ou documents à conserver. Archive-le.';
  end if;

  delete from public.dossiers
  where id = p_dossier_id;

  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then
    raise exception 'Dossier introuvable ou déjà supprimé';
  end if;

  return jsonb_build_object('ok', true, 'deleted_id', p_dossier_id);
end;
$$;

revoke all on function public.delete_client_dossier(uuid) from public;
grant execute on function public.delete_client_dossier(uuid) to authenticated;
