create or replace function private.esg_answer_points(
  p_session_id uuid,
  p_question_id uuid,
  p_option_id uuid,
  p_answer_numeric numeric,
  p_answer_text text,
  p_answer_json jsonb
) returns numeric
language plpgsql
stable
set search_path = public, private
as $$
declare
  v_order integer;
  v_type text;
  v_code text;
  v_count integer := 0;
  v_points numeric := 0;
begin
  select qq.ordre, qt.type_questionnaire, qo.code
    into v_order, v_type, v_code
  from questionnaire_questions qq
  join questionnaire_templates qt on qt.id = qq.template_id
  left join questionnaire_options qo on qo.id = p_option_id
  where qq.id = p_question_id
    and exists (
      select 1 from questionnaire_sessions qs
      where qs.id = p_session_id and qs.template_id = qq.template_id
    );

  if v_type is distinct from 'ESG' then
    return null;
  end if;

  case v_order
    when 1 then
      v_points := case upper(coalesce(v_code,'')) when 'ALLOCATION' then 10 when 'PRODUIT' then 6 when 'AUTRE' then 4 else 0 end;
    when 2, 5, 8 then
      v_points := case upper(coalesce(v_code,'')) when 'OUI' then 10 when 'INDETERMINE' then 3 else 0 end;
    when 3, 6 then
      if v_code ~ '^[0-9]+([.][0-9]+)?$' then
        v_points := case
          when v_code::numeric >= 30 then 10
          when v_code::numeric >= 20 then 7
          when v_code::numeric >= 10 then 4
          when v_code::numeric >= 5 then 2
          else 0 end;
      elsif upper(coalesce(v_code,'')) = 'AUTRE' and p_answer_numeric is not null then
        v_points := least(10, greatest(0, p_answer_numeric / 3));
      else
        v_points := 0;
      end if;
    when 4 then
      v_count := case when jsonb_typeof(p_answer_json) = 'array' then jsonb_array_length(p_answer_json) else 0 end;
      v_points := least(8, v_count * 2);
    when 7 then
      v_count := case when jsonb_typeof(p_answer_json) = 'array' then jsonb_array_length(p_answer_json) else 0 end;
      v_points := least(6, v_count * 2);
    when 9 then
      v_count := case when jsonb_typeof(p_answer_json) = 'array' then jsonb_array_length(p_answer_json) else 0 end;
      if p_answer_json ? 'AUCUNE' then v_count := 0; end if;
      v_points := least(6, v_count * 2);
    when 10 then
      v_count := case when jsonb_typeof(p_answer_json) = 'array' then jsonb_array_length(p_answer_json) else case when p_option_id is not null then 1 else 0 end end;
      v_points := least(6, v_count * 2);
    when 11 then
      v_count := case when jsonb_typeof(p_answer_json) = 'array' then jsonb_array_length(p_answer_json) else 0 end;
      if p_answer_json ? 'AUCUNE' then v_count := 0; end if;
      v_points := least(6, v_count);
    when 12 then
      if p_answer_json ? 'AUCUNE' then
        v_points := 0;
      else
        v_count := case when jsonb_typeof(p_answer_json) = 'array' then jsonb_array_length(p_answer_json) else 0 end;
        v_points := least(6, v_count * 3);
      end if;
    when 13 then
      v_points := case when nullif(btrim(coalesce(p_answer_text,'')), '') is not null then 2 else 0 end;
    else
      v_points := 0;
  end case;

  return round(v_points, 2);
end;
$$;

create or replace function private.set_esg_answer_points()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  new.points_awarded := private.esg_answer_points(
    new.session_id, new.question_id, new.option_id,
    new.answer_numeric, new.answer_text, new.answer_json
  );
  return new;
end;
$$;

drop trigger if exists questionnaire_answers_esg_points on public.questionnaire_answers;
create trigger questionnaire_answers_esg_points
before insert or update of option_id, answer_numeric, answer_text, answer_json, question_id, session_id
on public.questionnaire_answers
for each row execute function private.set_esg_answer_points();

create or replace function private.esg_score_label(p_score numeric)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_score,0) >= 80 then 'Très forte'
    when coalesce(p_score,0) >= 60 then 'Forte'
    when coalesce(p_score,0) >= 40 then 'Modérée'
    when coalesce(p_score,0) >= 20 then 'Faible'
    else 'Très faible'
  end;
$$;

create or replace function private.decorate_esg_preferences_score()
returns trigger
language plpgsql
set search_path = public, private
as $$
declare
  v_score numeric := 0;
  v_base text;
begin
  select coalesce(sum(coalesce(qa.points_awarded,0)),0)
    into v_score
  from questionnaire_answers qa
  where qa.session_id = new.session_id;

  v_base := regexp_replace(
    coalesce(new.synthese_reglementaire,''),
    '^Indicateur interne de sensibilité à la durabilité \(outil cabinet, non réglementaire\) : [0-9.,]+ / 100 - niveau [^.]+\.\s*',
    '',
    'i'
  );

  new.synthese_reglementaire := format(
    'Indicateur interne de sensibilité à la durabilité (outil cabinet, non réglementaire) : %s / 100 - niveau %s. %s',
    trim(to_char(v_score, 'FM999990.##')),
    private.esg_score_label(v_score),
    v_base
  );
  return new;
end;
$$;

drop trigger if exists esg_preferences_score_summary on public.esg_preferences;
create trigger esg_preferences_score_summary
before insert or update of session_id, synthese_reglementaire
on public.esg_preferences
for each row execute function private.decorate_esg_preferences_score();

update public.questionnaire_answers qa
set points_awarded = private.esg_answer_points(
  qa.session_id, qa.question_id, qa.option_id,
  qa.answer_numeric, qa.answer_text, qa.answer_json
)
where exists (
  select 1
  from questionnaire_questions qq
  join questionnaire_templates qt on qt.id = qq.template_id
  where qq.id = qa.question_id and qt.type_questionnaire = 'ESG'
);

update public.esg_preferences ep
set synthese_reglementaire = ep.synthese_reglementaire;
