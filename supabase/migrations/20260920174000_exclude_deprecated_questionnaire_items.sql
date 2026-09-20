do $$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid)
    into v_def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='complete_questionnaire_session_core'
  limit 1;

  if v_def is null then
    raise exception 'complete_questionnaire_session_core introuvable';
  end if;

  v_def := replace(
    v_def,
    'and qq.obligatoire=true',
    'and qq.obligatoire=true
    and coalesce((qq.metadata->>''deprecated'')::boolean,false)=false'
  );
  execute v_def;
end $$;

do $$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid)
    into v_def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='refresh_qpi_assessment_core'
  limit 1;

  if v_def is null then
    raise exception 'refresh_qpi_assessment_core introuvable';
  end if;

  v_def := replace(
    v_def,
    'where qa.session_id = p_session_id and qq.scoree = true and qa.points_awarded is not null;',
    'where qa.session_id = p_session_id
    and qq.scoree = true
    and coalesce((qq.metadata->>''deprecated'')::boolean,false)=false
    and qa.points_awarded is not null;'
  );
  execute v_def;
end $$;
