do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('private.validate_completed_recueil_section()'::regprocedure)
    into v_definition;

  v_definition := replace(
    v_definition,
    '         or nullif(item->>''montant_cible'','''') is null' || chr(10),
    ''
  );
  v_definition := replace(
    v_definition,
    'Chaque objectif doit comporter un montant cible et un horizon.',
    'Chaque objectif doit comporter un horizon.'
  );

  if position('montant cible' in lower(v_definition)) > 0 then
    raise exception 'La règle montant cible est toujours présente après modification';
  end if;

  execute v_definition;
end;
$$;
