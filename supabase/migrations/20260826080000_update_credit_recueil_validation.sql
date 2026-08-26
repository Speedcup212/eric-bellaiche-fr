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
  v_rate text;
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
       or nullif(trim(coalesce(v_item->>'credit_rattache_a', '')), '') is null then
      raise exception 'Complétez le type et le rattachement de chaque crédit.';
    end if;

    v_rate := replace(trim(coalesce(v_item->>'taux_credit', '')), ',', '.');
    if v_rate = '' or v_rate !~ '^[0-9]+([.][0-9]{1,3})?$' then
      raise exception 'Indiquez un taux de crédit valide, positif ou nul, pour chaque crédit.';
    end if;
  end loop;

  return new;
end;
$function$;

revoke all on function private.validate_credit_recueil_payload() from public, anon, authenticated;
