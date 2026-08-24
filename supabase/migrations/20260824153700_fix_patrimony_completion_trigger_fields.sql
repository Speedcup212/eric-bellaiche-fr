do $$
declare
  fn text;
  old_block text := $old$
    if jsonb_typeof(p->'immobilier') = 'array' then
      for item in select value from jsonb_array_elements(p->'immobilier') loop
        if nullif(trim(item->>'libelle'),'') is null
           or nullif(trim(item->>'adresse'),'') is null
           or nullif(item->>'valeur_actuelle','') is null
           or nullif(trim(item->>'usage_bien'),'') is null
           or nullif(trim(item->>'mode_detention'),'') is null then
          raise exception 'Complétez les informations obligatoires de chaque bien immobilier.';
        end if;
      end loop;
    end if;
$old$;
  new_block text := $new$
    if jsonb_typeof(p->'immobilier') = 'array' then
      for item in select value from jsonb_array_elements(p->'immobilier') loop
        if nullif(trim(item->>'proprietaire'),'') is null then
          raise exception 'Choisissez le propriétaire de chaque bien immobilier.';
        end if;
        if nullif(trim(item->>'intitule'),'') is null then
          raise exception 'Indiquez un nom pour chaque bien immobilier.';
        end if;
        if nullif(trim(item->>'type_bien'),'') is null then
          raise exception 'Choisissez le type de chaque bien immobilier.';
        end if;
        if item->>'type_bien' = 'Autre' and nullif(trim(item->>'type_bien_autre'),'') is null then
          raise exception 'Précisez le type de bien lorsque vous choisissez « Autre ».';
        end if;
        if nullif(trim(item->>'usage'),'') is null then
          raise exception 'Choisissez l’usage de chaque bien immobilier.';
        end if;
        if item->>'usage' = 'Autre' and nullif(trim(item->>'usage_autre'),'') is null then
          raise exception 'Précisez l’usage du bien lorsque vous choisissez « Autre ».';
        end if;
        if nullif(trim(item->>'ville'),'') is null then
          raise exception 'Indiquez la ville de chaque bien immobilier.';
        end if;
        if nullif(trim(item->>'mode_detention'),'') is null then
          raise exception 'Indiquez comment chaque bien immobilier est détenu.';
        end if;
        if item->>'mode_detention' = 'Autre' and nullif(trim(item->>'mode_detention_autre'),'') is null then
          raise exception 'Précisez le mode de détention lorsque vous choisissez « Autre ».';
        end if;
        if nullif(item->>'valeur_actuelle','') is null then
          raise exception 'Indiquez la valeur estimée actuelle de chaque bien immobilier.';
        end if;
        if (item->>'proprietaire' = 'Identifiant 1 et 2' or item->>'mode_detention' = 'En indivision')
           and nullif(regexp_replace(coalesce(item->>'quote_part',''), '[^0-9,.-]', '', 'g'),'') is null then
          raise exception 'Indiquez la quote-part lorsque le bien est détenu à plusieurs.';
        end if;
        if item->>'usage' = 'Locatif' and nullif(regexp_replace(coalesce(item->>'loyer_annuel',''), '[^0-9,.-]', '', 'g'),'') is null then
          raise exception 'Indiquez le loyer annuel hors charges pour chaque bien locatif.';
        end if;
      end loop;
    end if;
$new$;
begin
  select pg_get_functiondef(p.oid)
    into fn
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='private'
    and p.proname='validate_completed_recueil_section'
    and p.prokind='f'
  limit 1;

  if fn is null then
    raise exception 'validate_completed_recueil_section not found';
  end if;
  if position(old_block in fn) = 0 then
    raise exception 'legacy patrimony validation block not found';
  end if;

  fn := replace(fn, old_block, new_block);
  execute fn;
end $$;
