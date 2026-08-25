create or replace function private.validate_financial_recueil_payload()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_categories jsonb := new.payload->'categories';
  v_has_none boolean;
  v_has_other boolean;
begin
  if new.section_code <> 'financial' or new.completed_at is null then
    return new;
  end if;

  if jsonb_typeof(v_categories) <> 'array' or jsonb_array_length(v_categories) = 0 then
    raise exception 'Sélectionnez au moins une catégorie financière ou indiquez que vous ne détenez aucun compte ni placement.';
  end if;

  select exists(select 1 from jsonb_array_elements_text(v_categories) as item(value) where item.value = 'none'),
         exists(select 1 from jsonb_array_elements_text(v_categories) as item(value) where item.value = 'other')
    into v_has_none, v_has_other;

  if v_has_none and jsonb_array_length(v_categories) <> 1 then
    raise exception 'Le choix « Aucun compte ni placement » ne peut pas être associé à une autre catégorie.';
  end if;
  if v_has_other and nullif(trim(coalesce(new.payload->>'other_details', '')), '') is null then
    raise exception 'Précisez la nature de vos autres placements.';
  end if;
  if not v_has_none and coalesce(new.payload->>'total_band', '') not in ('under_10k','10k_50k','50k_100k','100k_250k','250k_500k','over_500k') then
    raise exception 'Indiquez une fourchette valide pour l’encours financier total.';
  end if;
  if lower(trim(coalesce(new.payload->>'completeness_confirmed', ''))) <> 'true' then
    raise exception 'Confirmez que la déclaration couvre l’ensemble de vos comptes et placements.';
  end if;

  return new;
end;
$function$;

revoke all on function private.validate_financial_recueil_payload() from public, anon, authenticated;

drop trigger if exists recueil_sections_validate_financial on public.recueil_sections;
create trigger recueil_sections_validate_financial
before insert or update of payload, completed_at on public.recueil_sections
for each row
when (new.section_code = 'financial')
execute function private.validate_financial_recueil_payload();

create or replace function private.sync_document_financial_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_has_liquidities boolean;
  v_has_financial_assets boolean;
begin
  select exists(
           select 1 from jsonb_array_elements_text(coalesce(new.payload->'categories', '[]'::jsonb)) as item(value)
           where item.value = 'current_accounts'
         ),
         exists(
           select 1 from jsonb_array_elements_text(coalesce(new.payload->'categories', '[]'::jsonb)) as item(value)
           where item.value in ('savings','life_insurance','retirement','securities','paper_real_estate','employee_savings','other')
         )
    into v_has_liquidities, v_has_financial_assets;

  insert into public.document_context_answers(
    dossier_id, investisseur_id, has_liquidities, has_financial_assets, updated_at
  ) values (
    new.dossier_id, new.investisseur_id, v_has_liquidities, v_has_financial_assets, now()
  )
  on conflict(dossier_id, investisseur_id) do update
    set has_liquidities = excluded.has_liquidities,
        has_financial_assets = excluded.has_financial_assets,
        updated_at = now();

  return new;
end;
$function$;

revoke all on function private.sync_document_financial_context() from public, anon, authenticated;

drop trigger if exists recueil_sections_sync_document_financial on public.recueil_sections;
create trigger recueil_sections_sync_document_financial
after insert or update of payload on public.recueil_sections
for each row
when (new.section_code = 'financial')
execute function private.sync_document_financial_context();

create or replace function private.require_financial_recueil_before_validation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.recueil_status = 'validated'
     and old.recueil_status is distinct from 'validated'
     and not exists (
       select 1
       from public.recueil_sections rs
       where rs.dossier_id = new.dossier_id
         and rs.investisseur_id = new.investisseur_id
         and rs.section_code = 'financial'
         and rs.completed_at is not null
     ) then
    raise exception 'Recueil incomplet : terminez la section Financier.';
  end if;

  return new;
end;
$function$;

revoke all on function private.require_financial_recueil_before_validation() from public, anon, authenticated;

drop trigger if exists dossier_investisseurs_require_financial_recueil on public.dossier_investisseurs;
create trigger dossier_investisseurs_require_financial_recueil
before update of recueil_status on public.dossier_investisseurs
for each row
execute function private.require_financial_recueil_before_validation();

insert into public.document_context_answers(
  dossier_id, investisseur_id, has_liquidities, has_financial_assets, updated_at
)
select rs.dossier_id,
       rs.investisseur_id,
       exists(
         select 1 from jsonb_array_elements_text(coalesce(rs.payload->'categories', '[]'::jsonb)) as item(value)
         where item.value = 'current_accounts'
       ),
       exists(
         select 1 from jsonb_array_elements_text(coalesce(rs.payload->'categories', '[]'::jsonb)) as item(value)
         where item.value in ('savings','life_insurance','retirement','securities','paper_real_estate','employee_savings','other')
       ),
       now()
from public.recueil_sections rs
where rs.section_code = 'financial'
on conflict(dossier_id, investisseur_id) do update
  set has_liquidities = excluded.has_liquidities,
      has_financial_assets = excluded.has_financial_assets,
      updated_at = now();
