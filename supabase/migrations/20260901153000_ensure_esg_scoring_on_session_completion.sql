create or replace function private.refresh_esg_session_score(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  update public.questionnaire_answers qa
  set points_awarded = private.esg_answer_points(
    qa.session_id,
    qa.question_id,
    qa.option_id,
    qa.answer_numeric,
    qa.answer_text,
    qa.answer_json
  )
  where qa.session_id = p_session_id
    and exists (
      select 1
      from public.questionnaire_sessions qs
      join public.questionnaire_templates qt on qt.id = qs.template_id
      where qs.id = qa.session_id
        and qt.type_questionnaire = 'ESG'
    );

  update public.esg_preferences ep
  set synthese_reglementaire = ep.synthese_reglementaire
  where ep.session_id = p_session_id;

  update public.esg_results er
  set synthese = ep.synthese_reglementaire
  from public.esg_preferences ep
  where er.session_id = p_session_id
    and ep.session_id = er.session_id;
end;
$$;

create or replace function private.ensure_esg_score_on_session_completion()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_type text;
begin
  select qt.type_questionnaire
    into v_type
  from public.questionnaire_templates qt
  where qt.id = new.template_id;

  if v_type = 'ESG' and new.statut in ('completed','validated') then
    if tg_op = 'INSERT' or old.statut is distinct from new.statut then
      perform private.refresh_esg_session_score(new.id);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists questionnaire_sessions_ensure_esg_score on public.questionnaire_sessions;
create trigger questionnaire_sessions_ensure_esg_score
after insert or update of statut
on public.questionnaire_sessions
for each row execute function private.ensure_esg_score_on_session_completion();

do $$
declare
  r record;
begin
  for r in
    select qs.id
    from public.questionnaire_sessions qs
    join public.questionnaire_templates qt on qt.id = qs.template_id
    where qt.type_questionnaire = 'ESG'
      and qs.statut in ('completed','validated')
  loop
    perform private.refresh_esg_session_score(r.id);
  end loop;
end;
$$;