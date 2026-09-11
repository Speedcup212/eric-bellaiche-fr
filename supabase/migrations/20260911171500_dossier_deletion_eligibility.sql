create or replace function public.get_dossier_deletion_eligibility()
returns table (
  dossier_id uuid,
  can_delete boolean,
  reason text
)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.is_staff() then
    raise exception 'Accès refusé';
  end if;

  return query
  select
    d.id,
    not (
      exists (select 1 from public.documents_sources ds where ds.dossier_id = d.id)
      or exists (
        select 1 from public.documents_reglementaires dr
        where dr.dossier_id = d.id
          and (dr.storage_path_pdf is not null or dr.storage_path_docx is not null)
      )
      or exists (select 1 from public.validations v where v.dossier_id = d.id)
    ) as can_delete,
    case
      when exists (select 1 from public.documents_sources ds where ds.dossier_id = d.id)
        then 'Documents sources présents'
      when exists (
        select 1 from public.documents_reglementaires dr
        where dr.dossier_id = d.id
          and (dr.storage_path_pdf is not null or dr.storage_path_docx is not null)
      ) then 'Documents réglementaires générés'
      when exists (select 1 from public.validations v where v.dossier_id = d.id)
        then 'Validations réglementaires présentes'
      else null
    end as reason
  from public.dossiers d;
end;
$$;

revoke all on function public.get_dossier_deletion_eligibility() from public;
grant execute on function public.get_dossier_deletion_eligibility() to authenticated;
