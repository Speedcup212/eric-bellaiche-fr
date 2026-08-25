create or replace function private.validate_credit_recueil_payload()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_has_credits boolean;
  v_items jsonb := coalesce(new.payload->'items', '[]'::jsonb);
  v_item jsonb;
  v_amount text;
begin
  if new.section_code <> 'credits' or new.completed_at is null then
    return new;
  end if;

  if jsonb_typeof(new.payload->'has_credits') <> 'boolean' then
    raise exception 'Indiquez si vous avez un ou plusieurs crédits en cours.';
  end if;
  v_has_credits := (new.payload->>'has_credits')::boolean;

  if jsonb_typeof(v_items) <> 'array' then
    raise exception 'La liste des crédits est invalide.';
  end if;
  if not v_has_credits and jsonb_array_length(v_items) <> 0 then
    raise exception 'Aucun crédit ne doit être renseigné lorsque la réponse est Non.';
  end if;
  if v_has_credits and jsonb_array_length(v_items) = 0 then
    raise exception 'Ajoutez au moins un crédit.';
  end if;
  if jsonb_array_length(v_items) > 30 then
    raise exception 'Le nombre de crédits déclaré est trop élevé.';
  end if;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    if nullif(trim(coalesce(v_item->>'type_credit', '')), '') is null
       or nullif(trim(coalesce(v_item->>'emprunteur', '')), '') is null then
      raise exception 'Complétez le type et l’emprunteur de chaque crédit.';
    end if;

    v_amount := replace(trim(coalesce(v_item->>'capital_restant_du', '')), ',', '.');
    if v_amount = '' or v_amount !~ '^[0-9]+([.][0-9]{1,2})?$' then
      raise exception 'Indiquez un capital restant dû valide, positif ou nul, pour chaque crédit.';
    end if;

    v_amount := replace(trim(coalesce(v_item->>'mensualite', '')), ',', '.');
    if v_amount = '' or v_amount !~ '^[0-9]+([.][0-9]{1,2})?$' then
      raise exception 'Indiquez une mensualité valide, positive ou nulle, pour chaque crédit.';
    end if;
  end loop;

  return new;
end;
$function$;

revoke all on function private.validate_credit_recueil_payload() from public, anon, authenticated;

drop trigger if exists recueil_sections_validate_credits on public.recueil_sections;
create trigger recueil_sections_validate_credits
before insert or update of payload, completed_at on public.recueil_sections
for each row
when (new.section_code = 'credits')
execute function private.validate_credit_recueil_payload();

create or replace function private.sync_document_credit_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_has_credits boolean := case
    when jsonb_typeof(new.payload->'has_credits') = 'boolean'
      then (new.payload->>'has_credits')::boolean
    else jsonb_array_length(coalesce(new.payload->'items', '[]'::jsonb)) > 0
  end;
begin
  insert into public.document_context_answers(
    dossier_id, investisseur_id, has_credits, updated_at
  ) values (
    new.dossier_id, new.investisseur_id, v_has_credits, now()
  )
  on conflict(dossier_id, investisseur_id) do update
    set has_credits = excluded.has_credits,
        updated_at = now();

  return new;
end;
$function$;

revoke all on function private.sync_document_credit_context() from public, anon, authenticated;

drop trigger if exists recueil_sections_sync_document_credits on public.recueil_sections;
create trigger recueil_sections_sync_document_credits
after insert or update of payload on public.recueil_sections
for each row
when (new.section_code = 'credits')
execute function private.sync_document_credit_context();

create or replace function private.require_credit_recueil_before_validation()
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
         and rs.section_code = 'credits'
         and rs.completed_at is not null
     ) then
    raise exception 'Recueil incomplet : terminez la section Crédits.';
  end if;

  return new;
end;
$function$;

revoke all on function private.require_credit_recueil_before_validation() from public, anon, authenticated;

drop trigger if exists dossier_investisseurs_require_credit_recueil on public.dossier_investisseurs;
create trigger dossier_investisseurs_require_credit_recueil
before update of recueil_status on public.dossier_investisseurs
for each row
execute function private.require_credit_recueil_before_validation();

insert into public.document_context_answers(
  dossier_id, investisseur_id, has_credits, updated_at
)
select rs.dossier_id,
       rs.investisseur_id,
       case
         when jsonb_typeof(rs.payload->'has_credits') = 'boolean'
           then (rs.payload->>'has_credits')::boolean
         else jsonb_array_length(coalesce(rs.payload->'items', '[]'::jsonb)) > 0
       end,
       now()
from public.recueil_sections rs
where rs.section_code = 'credits'
on conflict(dossier_id, investisseur_id) do update
  set has_credits = excluded.has_credits,
      updated_at = now();
