create or replace function private.enforce_qpi_result_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scored_count integer := 0;
  v_capacity_count integer := 0;
  v_tolerance_rank integer;
  v_capacity_rank integer;
  v_expected_rank integer;
  v_expected_profile text;
begin
  select count(*)
    into v_scored_count
  from public.questionnaire_answers qa
  join public.questionnaire_questions qq on qq.id = qa.question_id
  where qa.session_id = new.session_id
    and qq.scoree = true
    and qa.points_awarded is not null;

  select count(distinct qq.code)
    into v_capacity_count
  from public.questionnaire_answers qa
  join public.questionnaire_questions qq on qq.id = qa.question_id
  where qa.session_id = new.session_id
    and qq.code in ('Q3','Q4','Q9','Q10')
    and qa.option_id is not null;

  v_tolerance_rank := nullif(new.synthese_dimensions #>> '{tolerance,rang}', '')::integer;
  v_capacity_rank := nullif(new.synthese_dimensions #>> '{capacite_perte,rang}', '')::integer;

  if v_scored_count <> 5 or v_capacity_count <> 4 or v_tolerance_rank not between 1 and 7 or v_capacity_rank not between 1 and 7 then
    new.profil_operationnel_final := null;
    new.ecart_declared_objective := null;
    new.justification_ecart := null;
    new.synthese_dimensions := jsonb_set(coalesce(new.synthese_dimensions, '{}'::jsonb), '{profil_operationnel}', jsonb_build_object('rang', null, 'profil', null), true);
    return new;
  end if;

  v_expected_rank := least(v_tolerance_rank, v_capacity_rank);
  v_expected_profile := case v_expected_rank
    when 1 then 'Très prudent'
    when 2 then 'Prudent'
    when 3 then 'Prudent défensif'
    when 4 then 'Équilibré prudent'
    when 5 then 'Équilibré dynamique'
    when 6 then 'Dynamique'
    when 7 then 'Offensif'
  end;

  new.profil_operationnel_final := v_expected_profile;
  new.ecart_declared_objective := v_tolerance_rank > v_capacity_rank;
  new.justification_ecart := case when v_tolerance_rank > v_capacity_rank then 'Le profil a été automatiquement limité par la capacité de perte la plus prudente.' else null end;
  new.synthese_dimensions := jsonb_set(coalesce(new.synthese_dimensions, '{}'::jsonb), '{profil_operationnel}', jsonb_build_object('rang', v_expected_rank, 'profil', v_expected_profile), true);
  return new;
end;
$$;

drop trigger if exists trg_enforce_qpi_result_integrity on public.qpi_results;
create trigger trg_enforce_qpi_result_integrity
before insert or update on public.qpi_results
for each row execute function private.enforce_qpi_result_integrity();
