-- Unify QPI capacity logic, make alerts actionable, and calculate a long-term investable-capital range.
-- Q10 is the direct loss-capacity ceiling; Q3/Q4/Q9 remain separate suitability constraints.

alter table public.qpi_controls
  add column if not exists details jsonb not null default '{}'::jsonb,
  add column if not exists source_hash text,
  add column if not exists resolution_code text,
  add column if not exists resolution_note text,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid;

create or replace function private.upsert_qpi_control(
  p_session_id uuid,
  p_control_code text,
  p_alerte boolean,
  p_commentaire text,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_hash text := md5(coalesce(p_details,'{}'::jsonb)::text || '|' || coalesce(p_alerte,false)::text);
begin
  insert into public.qpi_controls(
    session_id, control_code, alerte, traite, commentaire, details, source_hash,
    resolution_code, resolution_note, resolved_at, resolved_by
  )
  values(
    p_session_id, p_control_code, coalesce(p_alerte,false), not coalesce(p_alerte,false),
    p_commentaire, coalesce(p_details,'{}'::jsonb), v_hash,
    null, null, null, null
  )
  on conflict (session_id, control_code) do update set
    alerte = excluded.alerte,
    commentaire = excluded.commentaire,
    details = excluded.details,
    source_hash = excluded.source_hash,
    traite = case
      when excluded.alerte = false then true
      when public.qpi_controls.alerte = true
        and public.qpi_controls.traite = true
        and public.qpi_controls.source_hash = excluded.source_hash then true
      else false
    end,
    resolution_code = case
      when excluded.alerte = true
        and public.qpi_controls.alerte = true
        and public.qpi_controls.traite = true
        and public.qpi_controls.source_hash = excluded.source_hash
      then public.qpi_controls.resolution_code else null end,
    resolution_note = case
      when excluded.alerte = true
        and public.qpi_controls.alerte = true
        and public.qpi_controls.traite = true
        and public.qpi_controls.source_hash = excluded.source_hash
      then public.qpi_controls.resolution_note else null end,
    resolved_at = case
      when excluded.alerte = true
        and public.qpi_controls.alerte = true
        and public.qpi_controls.traite = true
        and public.qpi_controls.source_hash = excluded.source_hash
      then public.qpi_controls.resolved_at else null end,
    resolved_by = case
      when excluded.alerte = true
        and public.qpi_controls.alerte = true
        and public.qpi_controls.traite = true
        and public.qpi_controls.source_hash = excluded.source_hash
      then public.qpi_controls.resolved_by else null end,
    updated_at = now();
end;
$$;

create or replace function private.refresh_qpi_assessment_core(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_is_qpi boolean;
  v_dossier_id uuid;
  v_investisseur_id uuid;
  v_scored_count integer := 0;
  v_score integer := 0;
  v_tolerance_rank integer;
  v_capacity_rank integer;
  v_operational_rank integer;
  v_tolerance_profile text;
  v_operational_profile text;
  v_q3 text;
  v_q4 text;
  v_q9 text;
  v_q10 text;
  v_q15 text;
  v_q16 text;
  v_q17 text;
  v_q21 text;
  v_q22 text;
  v_q24 text;
  v_q4_json jsonb := '{}'::jsonb;
  v_loss_amount numeric(16,2);
  v_loss_pct numeric(7,4);
  v_knowledge_answers integer := 0;
  v_knowledge_correct integer := 0;
  v_knowledge_level text;
  v_experience_count integer := 0;
  v_exp_obligations text;
  v_exp_immobilier text;
  v_exp_actions text;
  v_gap boolean := false;
  v_precaution numeric(16,2);
  v_project_amount numeric(16,2);
  v_project_date date;
  v_project_overlap text;
  v_financial_band text;
  v_band_min numeric(16,2);
  v_band_max numeric(16,2);
  v_constrained_min numeric(16,2) := 0;
  v_constrained_max numeric(16,2) := 0;
  v_investable_min numeric(16,2);
  v_investable_max numeric(16,2);
begin
  select qt.type_questionnaire = 'QPI', qs.dossier_id, qs.investisseur_id
  into v_is_qpi, v_dossier_id, v_investisseur_id
  from public.questionnaire_sessions qs
  join public.questionnaire_templates qt on qt.id = qs.template_id
  where qs.id = p_session_id;

  if not coalesce(v_is_qpi, false) then return; end if;

  select count(*), coalesce(sum(qa.points_awarded), 0)::integer
  into v_scored_count, v_score
  from public.questionnaire_answers qa
  join public.questionnaire_questions qq on qq.id = qa.question_id
  where qa.session_id = p_session_id
    and qq.scoree = true
    and coalesce((qq.metadata->>'deprecated')::boolean,false)=false
    and qa.points_awarded is not null;

  select
    max(qo.code) filter (where qq.code = 'Q3'),
    max(qo.code) filter (where qq.code = 'Q4'),
    max(qo.code) filter (where qq.code = 'Q9'),
    max(qo.code) filter (where qq.code = 'Q10'),
    max(qo.code) filter (where qq.code = 'Q15'),
    max(qo.code) filter (where qq.code = 'Q16'),
    max(qo.code) filter (where qq.code = 'Q17'),
    max(qo.code) filter (where qq.code = 'Q21'),
    max(qo.code) filter (where qq.code = 'Q22'),
    max(qo.code) filter (where qq.code = 'Q24'),
    max(qa.answer_json::text) filter (where qq.code = 'Q4')::jsonb,
    max(nullif(qa.answer_json->>'perte_max_declairee_montant','')::numeric) filter (where qq.code = 'Q10')
  into v_q3, v_q4, v_q9, v_q10, v_q15, v_q16, v_q17, v_q21, v_q22, v_q24, v_q4_json, v_loss_amount
  from public.questionnaire_answers qa
  join public.questionnaire_questions qq on qq.id = qa.question_id
  left join public.questionnaire_options qo on qo.id = qa.option_id
  where qa.session_id = p_session_id;

  v_q4_json := coalesce(v_q4_json,'{}'::jsonb);
  v_loss_pct := case v_q10 when 'A' then 0 when 'B' then 5 when 'C' then 10 when 'D' then 20 when 'E' then 30 when 'F' then 30 else null end;

  if v_scored_count = 5 then
    v_tolerance_profile := public.qpi_profile_from_score(v_score);
    v_tolerance_rank := case
      when v_score between 5 and 7 then 1 when v_score between 8 and 10 then 2
      when v_score between 11 and 13 then 3 when v_score between 14 and 16 then 4
      when v_score between 17 and 19 then 5 when v_score between 20 and 22 then 6
      when v_score between 23 and 25 then 7 end;
  end if;

  v_capacity_rank := case v_q10
    when 'A' then 1 when 'B' then 2 when 'C' then 3 when 'D' then 4 when 'E' then 5 when 'F' then 6
    else null end;

  if v_tolerance_rank is not null and v_capacity_rank is not null then
    v_operational_rank := least(v_tolerance_rank, v_capacity_rank);
    v_operational_profile := private.qpi_profile_from_rank(v_operational_rank);
    v_gap := v_tolerance_rank > v_capacity_rank;
  end if;

  select count(*), count(*) filter (where qo.code = qq.metadata->>'correct_option')
  into v_knowledge_answers, v_knowledge_correct
  from public.questionnaire_answers qa
  join public.questionnaire_questions qq on qq.id = qa.question_id
  left join public.questionnaire_options qo on qo.id = qa.option_id
  where qa.session_id = p_session_id
    and qq.code in ('Q13','Q14','Q15','Q16','Q17')
    and coalesce((qq.metadata->>'deprecated')::boolean,false)=false;

  v_knowledge_level := case
    when v_knowledge_answers < 5 then 'À compléter'
    when v_knowledge_correct >= 4 then 'Suffisant'
    when v_knowledge_correct >= 3 then 'Intermédiaire'
    else 'Insuffisant'
  end;

  select count(*) filter (where niveau_experience <> 'jamais'),
         max(niveau_experience) filter (where famille_produit='obligations'),
         max(niveau_experience) filter (where famille_produit='immobilier_papier'),
         max(niveau_experience) filter (where famille_produit='actions')
  into v_experience_count, v_exp_obligations, v_exp_immobilier, v_exp_actions
  from public.qpi_product_experience
  where session_id = p_session_id
    and famille_produit in ('liquidites','obligations','actions','immobilier_papier','structures');

  select case when coalesce(rs.payload->>'epargne_precaution_cible','') ~ '^[0-9]+([.,][0-9]+)?$'
      then replace(rs.payload->>'epargne_precaution_cible',',','.')::numeric else null end
  into v_precaution
  from public.recueil_sections rs
  where rs.dossier_id=v_dossier_id and rs.investisseur_id=v_investisseur_id and rs.section_code='capacity'
  limit 1;

  select rs.payload->>'total_band'
  into v_financial_band
  from public.recueil_sections rs
  where rs.dossier_id=v_dossier_id and rs.investisseur_id=v_investisseur_id and rs.section_code='financial'
  limit 1;

  v_project_amount := case when coalesce(v_q4_json->>'montant_besoin_futur','') ~ '^[0-9]+([.,][0-9]+)?$'
    then replace(v_q4_json->>'montant_besoin_futur',',','.')::numeric else null end;
  v_project_date := case when coalesce(v_q4_json->>'echeance','') ~ '^\d{4}-\d{2}-\d{2}$'
    then (v_q4_json->>'echeance')::date else null end;
  v_project_overlap := nullif(v_q4_json->>'reserve_overlap','');

  v_band_min := case v_financial_band
    when 'under_10k' then 0 when '10k_50k' then 10000 when '50k_100k' then 50000
    when '100k_250k' then 100000 when '250k_500k' then 250000 when 'over_500k' then 500000
    else null end;
  v_band_max := case v_financial_band
    when 'under_10k' then 10000 when '10k_50k' then 50000 when '50k_100k' then 100000
    when '100k_250k' then 250000 when '250k_500k' then 500000 else null end;

  if coalesce(v_precaution,0)>0 and coalesce(v_project_amount,0)>0 then
    if v_project_overlap='included' then
      v_constrained_min := greatest(v_precaution,v_project_amount);
      v_constrained_max := v_constrained_min;
    elsif v_project_overlap='separate' then
      v_constrained_min := v_precaution + v_project_amount;
      v_constrained_max := v_constrained_min;
    else
      v_constrained_min := greatest(v_precaution,v_project_amount);
      v_constrained_max := v_precaution + v_project_amount;
    end if;
  else
    v_constrained_min := coalesce(v_precaution,0) + coalesce(v_project_amount,0);
    v_constrained_max := v_constrained_min;
  end if;

  if v_band_min is not null then v_investable_min := greatest(0,v_band_min-v_constrained_max); end if;
  if v_band_max is not null then v_investable_max := greatest(0,v_band_max-v_constrained_min); end if;

  insert into public.qpi_results(
    session_id, score_tolerance, score_max, profil_indicatif, niveau_tolerance_retenu,
    profil_operationnel_final, perte_max_declairee_montant, perte_max_declairee_pct,
    capacite_perte_objectivee_montant, capacite_perte_objectivee_pct,
    capacite_perte_retenue_montant, capacite_perte_retenue_pct,
    ecart_declared_objective, justification_ecart, synthese_dimensions
  ) values (
    p_session_id, case when v_scored_count > 0 then v_score end, 25, v_tolerance_profile, v_tolerance_rank,
    v_operational_profile, v_loss_amount, v_loss_pct,
    v_loss_amount, v_loss_pct, v_loss_amount, v_loss_pct, v_gap,
    case when v_gap then 'Le profil a été limité par la perte financière maximale que le client déclare pouvoir supporter.' end,
    jsonb_build_object(
      'tolerance', jsonb_build_object('rang', v_tolerance_rank, 'profil', v_tolerance_profile, 'score', case when v_scored_count > 0 then v_score end, 'score_max', 25),
      'capacite_perte', jsonb_build_object('rang', v_capacity_rank, 'profil_plafond', private.qpi_profile_from_rank(v_capacity_rank), 'pourcentage_declare', v_loss_pct),
      'connaissances', jsonb_build_object('bonnes_reponses', v_knowledge_correct, 'total', 5, 'niveau', v_knowledge_level),
      'experience', jsonb_build_object('familles_pratiquees', v_experience_count, 'total', 5),
      'profil_operationnel', jsonb_build_object('rang', v_operational_rank, 'profil', v_operational_profile),
      'liquidite', jsonb_build_object(
        'projet_montant', v_project_amount,
        'projet_echeance', v_project_date,
        'epargne_precaution', v_precaution,
        'projet_inclus_dans_precaution', v_project_overlap,
        'patrimoine_financier_fourchette', v_financial_band,
        'capital_contraint_min', v_constrained_min,
        'capital_contraint_max', v_constrained_max,
        'capital_investissable_lt_min', v_investable_min,
        'capital_investissable_lt_max', v_investable_max,
        'estimation', case when v_financial_band is null then 'non_calculable' when v_project_overlap in ('included','separate') or coalesce(v_precaution,0)=0 or coalesce(v_project_amount,0)=0 then 'fourchette' else 'fourchette_a_confirmer' end
      )
    )
  )
  on conflict (session_id) do update set
    score_tolerance = excluded.score_tolerance, score_max = 25,
    profil_indicatif = excluded.profil_indicatif, niveau_tolerance_retenu = excluded.niveau_tolerance_retenu,
    profil_operationnel_final = excluded.profil_operationnel_final,
    perte_max_declairee_montant = excluded.perte_max_declairee_montant,
    perte_max_declairee_pct = excluded.perte_max_declairee_pct,
    capacite_perte_objectivee_montant = excluded.capacite_perte_objectivee_montant,
    capacite_perte_objectivee_pct = excluded.capacite_perte_objectivee_pct,
    capacite_perte_retenue_montant = excluded.capacite_perte_retenue_montant,
    capacite_perte_retenue_pct = excluded.capacite_perte_retenue_pct,
    ecart_declared_objective = excluded.ecart_declared_objective,
    justification_ecart = excluded.justification_ecart,
    synthese_dimensions = excluded.synthese_dimensions,
    updated_at = now();

  perform private.upsert_qpi_control(p_session_id,'TOLERANCE_VS_CAPACITE_PERTE',v_gap,
    case when v_gap then 'La tolérance comportementale dépasse la capacité de perte déclarée : le profil opérationnel est plafonné.' else 'Tolérance compatible avec la capacité de perte déclarée.' end,
    jsonb_build_object('tolerance_rank',v_tolerance_rank,'capacity_rank',v_capacity_rank,'q10',v_q10));

  perform private.upsert_qpi_control(p_session_id,'PROJET_FUTUR_VS_HORIZON',coalesce(v_q4 in ('B','C','D'),false),
    'Le projet futur doit être isolé du capital investi à long terme et confronté à la liquidité des solutions recommandées.',
    jsonb_build_object('q4',v_q4,'montant',v_project_amount,'echeance',v_project_date));

  perform private.upsert_qpi_control(p_session_id,'IMPACT_PERTE_SUR_PROJETS',coalesce(v_q9 in ('A','B'),false),
    'Le client indique qu’une baisse du patrimoine financier pourrait affecter son budget ou ses projets : ce point doit être traité dans l’allocation.',
    jsonb_build_object('q9',v_q9));

  perform private.upsert_qpi_control(p_session_id,'PROJECT_RESERVE_OVERLAP',
    coalesce(v_precaution,0)>0 and coalesce(v_project_amount,0)>0 and coalesce(v_project_overlap,'unknown') not in ('included','separate'),
    'Préciser si le besoin futur est inclus dans l’épargne de précaution afin d’éviter un double comptage.',
    jsonb_build_object('epargne_precaution',v_precaution,'projet_montant',v_project_amount,'overlap',coalesce(v_project_overlap,'unknown')));

  perform private.upsert_qpi_control(p_session_id,'KNOWLEDGE_EXPERIENCE_OBLIGATIONS',coalesce(v_q17,'') <> 'B',
    case when coalesce(v_exp_obligations,'jamais') <> 'jamais' then 'Contradiction à vérifier : expérience obligataire déclarée mais connaissance du risque obligataire non démontrée.' else 'Connaissance du risque obligataire à compléter avant recommandation d’obligations ou fonds obligataires.' end,
    jsonb_build_object('q17',v_q17,'experience',coalesce(v_exp_obligations,'jamais')));

  perform private.upsert_qpi_control(p_session_id,'KNOWLEDGE_EXPERIENCE_IMMOBILIER_PAPIER',coalesce(v_q15,'') <> 'B',
    case when coalesce(v_exp_immobilier,'jamais') <> 'jamais' then 'Contradiction à vérifier : expérience en immobilier papier déclarée mais connaissance de ses risques non démontrée.' else 'Connaissance des SCPI / fonds immobiliers non cotés à compléter avant recommandation de cette classe d’actifs.' end,
    jsonb_build_object('q15',v_q15,'experience',coalesce(v_exp_immobilier,'jamais')));

  perform private.upsert_qpi_control(p_session_id,'KNOWLEDGE_EXPERIENCE_UC',coalesce(v_q16,'') <> 'B',
    'Connaissance des unités de compte à compléter avant recommandation de supports concernés.',
    jsonb_build_object('q16',v_q16,'experience_actions',coalesce(v_exp_actions,'jamais')));

  perform private.upsert_qpi_control(p_session_id,'RENDEMENT_VS_FLUCTUATIONS',coalesce(v_q24 in ('D','E') and v_q22 in ('A','B'),false),
    'Contrôle de cohérence entre rendement recherché et inconfort face aux baisses.',
    jsonb_build_object('q22',v_q22,'q24',v_q24));

  perform private.upsert_qpi_control(p_session_id,'HORIZON_LIQUIDITE_VS_PRODUIT',false,'Contrôle à appliquer à chaque solution lors de la recommandation.','{}'::jsonb);
  perform private.upsert_qpi_control(p_session_id,'CONCENTRATION',false,'Contrôle à appliquer à l’allocation proposée.','{}'::jsonb);
  perform private.upsert_qpi_control(p_session_id,'DIVERGENCE_CO_INVESTISSEURS',false,'Chaque investisseur conserve son profil propre ; la compatibilité d’une opération commune doit être vérifiée pour chacun.','{}'::jsonb);

  delete from public.qpi_controls
  where session_id=p_session_id and control_code in ('CONNAISSANCE_EXPERIENCE_VS_PRODUIT','EPARGNE_PRECAUTION');
end;
$$;

create or replace function public.resolve_qpi_control(p_control_id uuid,p_resolution_code text,p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_control public.qpi_controls%rowtype;
  v_answer_id uuid;
  v_json jsonb;
begin
  if not (select private.is_staff()) then raise exception 'Accès réservé au cabinet'; end if;
  select * into v_control from public.qpi_controls where id=p_control_id;
  if v_control.id is null then raise exception 'Contrôle introuvable'; end if;
  if not v_control.alerte then raise exception 'Ce contrôle ne présente pas d’alerte active'; end if;

  if v_control.control_code='PROJECT_RESERVE_OVERLAP' and p_resolution_code in ('project_included_in_precaution','project_separate_from_precaution') then
    select qa.id, coalesce(qa.answer_json,'{}'::jsonb)
      into v_answer_id, v_json
    from public.questionnaire_answers qa
    join public.questionnaire_questions qq on qq.id=qa.question_id
    where qa.session_id=v_control.session_id and qq.code='Q4'
    limit 1;
    if v_answer_id is null then raise exception 'Réponse Q4 introuvable'; end if;
    v_json := jsonb_set(v_json,'{reserve_overlap}',to_jsonb(case when p_resolution_code='project_included_in_precaution' then 'included' else 'separate' end::text),true);
    update public.questionnaire_answers set answer_json=v_json where id=v_answer_id;
    perform private.refresh_qpi_assessment_core(v_control.session_id);
  else
    if p_resolution_code not in ('pocket_secured','explanation_completed','information_and_understanding_confirmed','product_excluded','client_answer_confirmed','client_answer_corrected','other') then raise exception 'Code de résolution invalide'; end if;
    if p_resolution_code='other' and coalesce(trim(p_note),'')='' then raise exception 'Une note est requise'; end if;
    update public.qpi_controls
    set traite=true,resolution_code=p_resolution_code,resolution_note=nullif(trim(coalesce(p_note,'')),''),
        resolved_at=now(),resolved_by=auth.uid(),updated_at=now()
    where id=p_control_id;
  end if;
  return jsonb_build_object('ok',true,'control_id',p_control_id);
end;
$$;

grant execute on function public.resolve_qpi_control(uuid,text,text) to authenticated;

do $$
declare r record;
begin
  for r in select qs.id from public.questionnaire_sessions qs join public.questionnaire_templates qt on qt.id=qs.template_id where qt.type_questionnaire='QPI' and qs.statut in ('completed','validated')
  loop
    perform private.refresh_qpi_assessment_core(r.id);
  end loop;
end $$;
