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
  v_current_accounts_intentional boolean := coalesce((new.payload->>'current_accounts_intentional')::boolean, false);
  v_current_accounts_amount text := replace(trim(coalesce(new.payload->>'current_accounts_amount', '')), ',', '.');
begin
  if new.section_code <> 'financial' or new.completed_at is null then
    return new;
  end if;

  if new.payload->>'current_accounts_intentional' is null then
    raise exception 'Indiquez si vous conservez volontairement une part importante de vos liquidités sur vos comptes courants.';
  end if;

  if v_current_accounts_intentional and (v_current_accounts_amount = '' or v_current_accounts_amount !~ '^[0-9]+([.][0-9]{1,2})?$') then
    raise exception 'Indiquez un montant approximatif de liquidités concerné.';
  end if;

  if jsonb_typeof(v_categories) <> 'array' or jsonb_array_length(v_categories) = 0 then
    raise exception 'Sélectionnez au moins une catégorie de placement ou indiquez que vous ne détenez aucun placement.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(v_categories) as item(value)
    where item.value not in ('savings','life_insurance','retirement','securities','paper_real_estate','employee_savings','other','none')
  ) then
    raise exception 'Une catégorie de placement sélectionnée est invalide.';
  end if;

  select exists(select 1 from jsonb_array_elements_text(v_categories) as item(value) where item.value = 'none'),
         exists(select 1 from jsonb_array_elements_text(v_categories) as item(value) where item.value = 'other')
    into v_has_none, v_has_other;

  if v_has_none and jsonb_array_length(v_categories) <> 1 then
    raise exception 'Le choix « Aucun placement » ne peut pas être associé à une autre catégorie.';
  end if;
  if v_has_other and nullif(trim(coalesce(new.payload->>'other_details', '')), '') is null then
    raise exception 'Précisez la nature de vos autres placements.';
  end if;
  if not v_has_none and coalesce(new.payload->>'total_band', '') not in ('under_10k','10k_50k','50k_100k','100k_250k','250k_500k','over_500k') then
    raise exception 'Indiquez une fourchette valide pour l’encours total des placements.';
  end if;
  if lower(trim(coalesce(new.payload->>'completeness_confirmed', ''))) <> 'true' then
    raise exception 'Confirmez que la déclaration couvre l’ensemble de vos comptes courants et placements.';
  end if;

  return new;
end;
$function$;

revoke all on function private.validate_financial_recueil_payload() from public, anon, authenticated;
