create or replace function public.save_my_family_setup(
  p_dossier_id uuid,
  p_payload jsonb,
  p_situation text,
  p_civilite text default null,
  p_prenom text default null,
  p_nom text default null,
  p_email text default null,
  p_mobile text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  perform public.save_my_recueil_section(
    p_dossier_id,
    'family',
    coalesce(p_payload, '{}'::jsonb),
    true
  );

  select public.sync_my_spouse_from_family(
    p_dossier_id,
    p_situation,
    p_civilite,
    p_prenom,
    p_nom,
    p_email,
    p_mobile
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.save_my_family_setup(uuid,jsonb,text,text,text,text,text,text) from public;
revoke all on function public.save_my_family_setup(uuid,jsonb,text,text,text,text,text,text) from anon;
grant execute on function public.save_my_family_setup(uuid,jsonb,text,text,text,text,text,text) to authenticated;

create or replace function private.sync_document_real_estate_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_has_real_estate boolean;
begin
  if new.section_code <> 'patrimony' then return new; end if;

  v_has_real_estate := case lower(trim(coalesce(new.payload->>'has_real_estate', '')))
    when 'true' then true
    when 'false' then false
    else null
  end;

  if v_has_real_estate is not null then
    insert into public.document_context_answers(dossier_id, investisseur_id, has_real_estate, updated_at)
    values(new.dossier_id, new.investisseur_id, v_has_real_estate, now())
    on conflict(dossier_id, investisseur_id) do update
      set has_real_estate = excluded.has_real_estate,
          updated_at = now();
  end if;

  return new;
end;
$function$;

drop trigger if exists recueil_sections_sync_document_real_estate on public.recueil_sections;
create trigger recueil_sections_sync_document_real_estate
after insert or update of payload on public.recueil_sections
for each row
when (new.section_code = 'patrimony')
execute function private.sync_document_real_estate_context();

insert into public.document_context_answers(dossier_id, investisseur_id, has_real_estate, updated_at)
select rs.dossier_id,
       rs.investisseur_id,
       case lower(trim(rs.payload->>'has_real_estate')) when 'true' then true when 'false' then false end,
       now()
from public.recueil_sections rs
where rs.section_code = 'patrimony'
  and lower(trim(coalesce(rs.payload->>'has_real_estate', ''))) in ('true', 'false')
on conflict(dossier_id, investisseur_id) do update
  set has_real_estate = excluded.has_real_estate,
      updated_at = now();
