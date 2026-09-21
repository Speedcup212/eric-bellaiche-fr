-- Keep downstream document context aligned with shared household confirmations and tax data.
create or replace function private.sync_household_confirmation_document_context()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_payload jsonb;
  v_value boolean;
begin
  if new.status <> 'confirmed' then return new; end if;
  if new.section_code not in ('patrimony','credits') then return new; end if;

  select rs.payload into v_payload
  from public.recueil_sections rs
  where rs.dossier_id=new.dossier_id
    and rs.investisseur_id=new.source_investisseur_id
    and rs.section_code=new.section_code
  limit 1;

  if v_payload is null then return new; end if;

  if new.section_code='patrimony' then
    v_value := case
      when jsonb_typeof(v_payload->'has_real_estate')='boolean' then (v_payload->>'has_real_estate')::boolean
      else jsonb_array_length(coalesce(v_payload->'immobilier','[]'::jsonb)) > 0
    end;
    insert into public.document_context_answers(dossier_id,investisseur_id,has_real_estate,updated_at)
    values(new.dossier_id,new.confirmer_investisseur_id,v_value,now())
    on conflict(dossier_id,investisseur_id) do update
      set has_real_estate=excluded.has_real_estate,updated_at=now();
  elsif new.section_code='credits' then
    v_value := case
      when jsonb_typeof(v_payload->'has_credits')='boolean' then (v_payload->>'has_credits')::boolean
      else jsonb_array_length(coalesce(v_payload->'items','[]'::jsonb)) > 0
    end;
    insert into public.document_context_answers(dossier_id,investisseur_id,has_credits,updated_at)
    values(new.dossier_id,new.confirmer_investisseur_id,v_value,now())
    on conflict(dossier_id,investisseur_id) do update
      set has_credits=excluded.has_credits,updated_at=now();
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_sync_household_confirmation_document_context on public.household_section_confirmations;
create trigger trg_sync_household_confirmation_document_context
after insert or update of status,source_updated_at
on public.household_section_confirmations
for each row execute function private.sync_household_confirmation_document_context();

create or replace function private.sync_document_tax_context()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.section_code <> 'tax' then return new; end if;

  if nullif(trim(coalesce(new.payload->>'reference_avis','')),'') is null
     and nullif(trim(coalesce(new.payload->>'reference_foyer','')),'') is null then
    return new;
  end if;

  insert into public.document_context_answers(dossier_id,investisseur_id,tax_status,updated_at)
  values(new.dossier_id,new.investisseur_id,'personal_notice',now())
  on conflict(dossier_id,investisseur_id) do update
    set tax_status=coalesce(public.document_context_answers.tax_status,excluded.tax_status),
        updated_at=now();

  return new;
end;
$function$;

drop trigger if exists trg_sync_document_tax_context on public.recueil_sections;
create trigger trg_sync_document_tax_context
after insert or update of payload
on public.recueil_sections
for each row
when (new.section_code='tax')
execute function private.sync_document_tax_context();

-- Backfill existing dossiers.
insert into public.document_context_answers(dossier_id,investisseur_id,has_real_estate,updated_at)
select hc.dossier_id,hc.confirmer_investisseur_id,
       case
         when jsonb_typeof(rs.payload->'has_real_estate')='boolean' then (rs.payload->>'has_real_estate')::boolean
         else jsonb_array_length(coalesce(rs.payload->'immobilier','[]'::jsonb)) > 0
       end,
       now()
from public.household_section_confirmations hc
join public.recueil_sections rs
  on rs.dossier_id=hc.dossier_id
 and rs.investisseur_id=hc.source_investisseur_id
 and rs.section_code='patrimony'
where hc.section_code='patrimony'
  and hc.status='confirmed'
  and hc.source_updated_at>=rs.updated_at
on conflict(dossier_id,investisseur_id) do update
set has_real_estate=excluded.has_real_estate,updated_at=now();

insert into public.document_context_answers(dossier_id,investisseur_id,has_credits,updated_at)
select hc.dossier_id,hc.confirmer_investisseur_id,
       case
         when jsonb_typeof(rs.payload->'has_credits')='boolean' then (rs.payload->>'has_credits')::boolean
         else jsonb_array_length(coalesce(rs.payload->'items','[]'::jsonb)) > 0
       end,
       now()
from public.household_section_confirmations hc
join public.recueil_sections rs
  on rs.dossier_id=hc.dossier_id
 and rs.investisseur_id=hc.source_investisseur_id
 and rs.section_code='credits'
where hc.section_code='credits'
  and hc.status='confirmed'
  and hc.source_updated_at>=rs.updated_at
on conflict(dossier_id,investisseur_id) do update
set has_credits=excluded.has_credits,updated_at=now();

insert into public.document_context_answers(dossier_id,investisseur_id,tax_status,updated_at)
select rs.dossier_id,rs.investisseur_id,'personal_notice',now()
from public.recueil_sections rs
where rs.section_code='tax'
  and (
    nullif(trim(coalesce(rs.payload->>'reference_avis','')),'') is not null
    or nullif(trim(coalesce(rs.payload->>'reference_foyer','')),'') is not null
  )
on conflict(dossier_id,investisseur_id) do update
set tax_status=coalesce(public.document_context_answers.tax_status,excluded.tax_status),updated_at=now();
