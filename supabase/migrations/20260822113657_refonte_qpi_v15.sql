-- Refonte du profil investisseur : questionnaire plus court, calcul prudent et résultat explicite.

update public.questionnaire_templates
set version = '2026-PREMIUM-1.5',
    date_revision = date '2026-08-22',
    libelle = 'Profil investisseur Premium 2026',
    metadata = jsonb_build_object(
      'source', 'Questionnaire_Profil_Investisseur_Premium_2026_V1.5',
      'score_max', 25,
      'score_scope', 'Q21-Q25',
      'screen_count_max', 31,
      'recueil_is_source_of_truth', true
    ),
    updated_at = now()
where code = 'QPI' and actif = true;

-- Les objectifs, l'horizon, les revenus et la capacité d'épargne sont déjà recueillis.
-- Les anciennes questions restent archivées si des réponses historiques les référencent.
update public.questionnaire_questions qq
set obligatoire = false,
    metadata = coalesce(qq.metadata, '{}'::jsonb) || '{"deprecated":true}'::jsonb,
    updated_at = now()
from public.questionnaire_templates qt
where qq.template_id = qt.id and qt.code = 'QPI' and qt.actif = true
  and qq.code in ('Q1','Q2','Q5','Q6','Q7','Q8');

update public.questionnaire_questions qq
set metadata = coalesce(qq.metadata, '{}'::jsonb) || '{"show_if":{"question":"Q11","not_equals":"A"}}'::jsonb,
    obligatoire = false,
    updated_at = now()
from public.questionnaire_templates qt
where qq.template_id = qt.id and qt.code = 'QPI' and qt.actif = true and qq.code = 'Q12';

update public.questionnaire_options qo
set libelle = '30 % ou plus'
from public.questionnaire_questions qq
join public.questionnaire_templates qt on qt.id = qq.template_id
where qo.question_id = qq.id and qt.code = 'QPI' and qt.actif = true and qq.code = 'Q10' and qo.code = 'F';

update public.questionnaire_questions qq
set libelle = 'Quelle part de la somme investie accepteriez-vous d’exposer à des placements pouvant connaître des baisses supérieures à 30 % ?',
    updated_at = now()
from public.questionnaire_templates qt
where qq.template_id = qt.id and qt.code = 'QPI' and qt.actif = true and qq.code = 'Q25';

update public.questionnaire_options qo
set libelle = case qo.code
    when 'A' then 'Aucune part'
    when 'B' then 'Jusqu’à 10 %'
    when 'C' then 'De 10 % à 25 %'
    when 'D' then 'De 25 % à 50 %'
  end,
  points = case qo.code when 'A' then 1 when 'B' then 2 when 'C' then 3 when 'D' then 4 end
from public.questionnaire_questions qq
join public.questionnaire_templates qt on qt.id = qq.template_id
where qo.question_id = qq.id and qt.code = 'QPI' and qt.actif = true and qq.code = 'Q25' and qo.code in ('A','B','C','D');

insert into public.questionnaire_options(question_id, code, libelle, ordre, points, metadata)
select qq.id, 'E', 'Plus de 50 %', 5, 5, '{}'::jsonb
from public.questionnaire_questions qq
join public.questionnaire_templates qt on qt.id = qq.template_id
where qt.code = 'QPI' and qt.actif = true and qq.code = 'Q25'
on conflict (question_id, code) do update
set libelle = excluded.libelle, ordre = excluded.ordre, points = excluded.points;

create or replace function public.qpi_profile_from_score(p_score integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_score between 5 and 7 then 'Très prudent'
    when p_score between 8 and 10 then 'Prudent'
    when p_score between 11 and 13 then 'Prudent défensif'
    when p_score between 14 and 16 then 'Équilibré prudent'
    when p_score between 17 and 19 then 'Équilibré dynamique'
    when p_score between 20 and 22 then 'Dynamique'
    when p_score between 23 and 25 then 'Offensif'
    else null
  end
$$;

create or replace function private.qpi_profile_from_rank(p_rank integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_rank
    when 1 then 'Très prudent'
    when 2 then 'Prudent'
    when 3 then 'Prudent défensif'
    when 4 then 'Équilibré prudent'
    when 5 then 'Équilibré dynamique'
    when 6 then 'Dynamique'
    when 7 then 'Offensif'
    else null
  end
$$;

create or replace function private.refresh_qpi_assessment_core(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_qpi boolean;
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
  v_q21 text;
  v_q22 text;
  v_q24 text;
  v_loss_amount numeric(16,2);
  v_loss_pct numeric(7,4);
  v_knowledge_answers integer := 0;
  v_knowledge_correct integer := 0;
  v_knowledge_level text;
  v_experience_count integer := 0;
  v_gap boolean := false;
begin
  select qt.type_questionnaire = 'QPI'
  into v_is_qpi
  from public.questionnaire_sessions qs
  join public.questionnaire_templates qt on qt.id = qs.template_id
  where qs.id = p_session_id;

  if not coalesce(v_is_qpi, false) then return; end if;

  select count(*), coalesce(sum(qa.points_awarded), 0)::integer
  into v_scored_count, v_score
  from public.questionnaire_answers qa
  join public.questionnaire_questions qq on qq.id = qa.question_id
  where qa.session_id = p_session_id and qq.scoree = true and qa.points_awarded is not null;

  select
    max(qo.code) filter (where qq.code = 'Q3'),
    max(qo.code) filter (where qq.code = 'Q4'),
    max(qo.code) filter (where qq.code = 'Q9'),
    max(qo.code) filter (where qq.code = 'Q10'),
    max(qo.code) filter (where qq.code = 'Q21'),
    max(qo.code) filter (where qq.code = 'Q22'),
    max(qo.code) filter (where qq.code = 'Q24'),
    max(nullif(qa.answer_json->>'perte_max_declairee_montant','')::numeric) filter (where qq.code = 'Q10')
  into v_q3, v_q4, v_q9, v_q10, v_q21, v_q22, v_q24, v_loss_amount
  from public.questionnaire_answers qa
  join public.questionnaire_questions qq on qq.id = qa.question_id
  left join public.questionnaire_options qo on qo.id = qa.option_id
  where qa.session_id = p_session_id;

  v_loss_pct := case v_q10 when 'A' then 0 when 'B' then 5 when 'C' then 10 when 'D' then 20 when 'E' then 30 when 'F' then 30 else null end;

  if v_scored_count = 5 then
    v_tolerance_profile := public.qpi_profile_from_score(v_score);
    v_tolerance_rank := case
      when v_score between 5 and 7 then 1 when v_score between 8 and 10 then 2
      when v_score between 11 and 13 then 3 when v_score between 14 and 16 then 4
      when v_score between 17 and 19 then 5 when v_score between 20 and 22 then 6
      when v_score between 23 and 25 then 7 end;
  end if;

  select min(rank_value) into v_capacity_rank
  from unnest(array[
    case v_q3 when 'A' then 1 when 'B' then 2 when 'C' then 4 when 'D' then 6 end,
    case v_q4 when 'A' then 7 when 'B' then 2 when 'C' then 3 when 'D' then 4 end,
    case v_q9 when 'A' then 1 when 'B' then 2 when 'C' then 4 when 'D' then 7 end,
    case v_q10 when 'A' then 1 when 'B' then 2 when 'C' then 3 when 'D' then 4 when 'E' then 5 when 'F' then 6 end
  ]) as ranks(rank_value)
  where rank_value is not null;

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
  where qa.session_id = p_session_id and qq.code between 'Q13' and 'Q20';

  v_knowledge_level := case
    when v_knowledge_answers < 8 then 'À compléter'
    when v_knowledge_correct >= 7 then 'Suffisant'
    when v_knowledge_correct >= 5 then 'Intermédiaire'
    else 'Insuffisant'
  end;

  select count(*) filter (where niveau_experience <> 'jamais')
  into v_experience_count
  from public.qpi_product_experience
  where session_id = p_session_id
    and famille_produit in ('liquidites','obligations','actions','diversifies','immobilier_papier','av_per','structures','non_cote');

  insert into public.qpi_results(
    session_id, score_tolerance, score_max, profil_indicatif, niveau_tolerance_retenu,
    profil_operationnel_final, perte_max_declairee_montant, perte_max_declairee_pct,
    capacite_perte_objectivee_pct, capacite_perte_retenue_pct, ecart_declared_objective,
    justification_ecart, synthese_dimensions
  ) values (
    p_session_id, case when v_scored_count > 0 then v_score end, 25, v_tolerance_profile, v_tolerance_rank,
    v_operational_profile, v_loss_amount, v_loss_pct, v_loss_pct, v_loss_pct, v_gap,
    case when v_gap then 'Le profil a été automatiquement limité par la capacité de perte la plus prudente.' end,
    jsonb_build_object(
      'tolerance', jsonb_build_object('rang', v_tolerance_rank, 'profil', v_tolerance_profile, 'score', case when v_scored_count > 0 then v_score end, 'score_max', 25),
      'capacite_perte', jsonb_build_object('rang', v_capacity_rank, 'profil_plafond', private.qpi_profile_from_rank(v_capacity_rank), 'pourcentage_declare', v_loss_pct),
      'connaissances', jsonb_build_object('bonnes_reponses', v_knowledge_correct, 'total', 8, 'niveau', v_knowledge_level),
      'experience', jsonb_build_object('familles_pratiquees', v_experience_count, 'total', 8),
      'profil_operationnel', jsonb_build_object('rang', v_operational_rank, 'profil', v_operational_profile)
    )
  )
  on conflict (session_id) do update set
    score_tolerance = excluded.score_tolerance, score_max = 25,
    profil_indicatif = excluded.profil_indicatif, niveau_tolerance_retenu = excluded.niveau_tolerance_retenu,
    profil_operationnel_final = excluded.profil_operationnel_final,
    perte_max_declairee_montant = excluded.perte_max_declairee_montant,
    perte_max_declairee_pct = excluded.perte_max_declairee_pct,
    capacite_perte_objectivee_pct = excluded.capacite_perte_objectivee_pct,
    capacite_perte_retenue_pct = excluded.capacite_perte_retenue_pct,
    ecart_declared_objective = excluded.ecart_declared_objective,
    justification_ecart = excluded.justification_ecart,
    synthese_dimensions = excluded.synthese_dimensions,
    updated_at = now();

  insert into public.qpi_controls(session_id, control_code, alerte, traite, commentaire)
  values
    (p_session_id, 'TOLERANCE_VS_CAPACITE_PERTE', v_gap, true, case when v_gap then 'Écart traité automatiquement : le profil opérationnel est plafonné par la capacité de perte.' else 'Tolérance compatible avec la capacité de perte.' end),
    (p_session_id, 'RENDEMENT_VS_FLUCTUATIONS', coalesce(v_q24 in ('D','E') and v_q22 in ('A','B'), false), true, 'Contrôle automatique de cohérence entre rendement recherché et inconfort face aux baisses.'),
    (p_session_id, 'CONNAISSANCE_EXPERIENCE_VS_PRODUIT', coalesce(v_knowledge_answers = 8 and (v_knowledge_correct < 5 or v_experience_count = 0), false), true, 'Les produits non compris ou jamais pratiqués seront automatiquement exclus des recommandations sans explication préalable.'),
    (p_session_id, 'EPARGNE_PRECAUTION', coalesce(v_q3 in ('A','B'), false), true, 'Le besoin de liquidité limite automatiquement les supports illiquides.'),
    (p_session_id, 'PROJET_FUTUR_VS_HORIZON', coalesce(v_q4 in ('B','C','D'), false), true, 'Le projet futur limite automatiquement la durée d’immobilisation.'),
    (p_session_id, 'HORIZON_LIQUIDITE_VS_PRODUIT', false, true, 'Contrôle automatique appliqué à chaque solution lors de la recommandation.'),
    (p_session_id, 'CONCENTRATION', false, true, 'Contrôle automatique appliqué à l’allocation proposée.'),
    (p_session_id, 'DIVERGENCE_CO_INVESTISSEURS', false, true, 'Chaque investisseur conserve son profil propre ; le profil le plus prudent est retenu pour une opération commune.')
  on conflict (session_id, control_code) do update set
    alerte = excluded.alerte, traite = excluded.traite, commentaire = excluded.commentaire, updated_at = now();
end;
$$;

create or replace function public.recompute_qpi_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session uuid := coalesce(new.session_id, old.session_id);
begin
  perform private.refresh_qpi_assessment_core(v_session);
  return coalesce(new, old);
end;
$$;

-- Adaptation ciblée de la procédure existante : 8 familles et profil opérationnel obligatoire.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('private.complete_questionnaire_session_core(uuid)'::regprocedure) into v_definition;
  v_definition := replace(v_definition,
    'if v_count<10 then raise exception ''Questionnaire incomplet : expérience produits à compléter (%/10)'',v_count; end if;',
    'if v_count<8 then raise exception ''Questionnaire incomplet : expérience produits à compléter (%/8)'',v_count; end if;');
  v_definition := replace(v_definition,
    'if not exists(select 1 from public.qpi_results where session_id=p_session_id and profil_indicatif is not null) then
      raise exception ''Questionnaire incomplet : score de tolérance non calculable'';
    end if;',
    'perform private.refresh_qpi_assessment_core(p_session_id);
    if not exists(select 1 from public.qpi_results where session_id=p_session_id and profil_operationnel_final is not null) then
      raise exception ''Questionnaire incomplet : profil opérationnel non calculable'';
    end if;');
  execute v_definition;
end;
$$;

-- Le seul questionnaire QPI encore en cours est remis à zéro ; le recueil reste intact.
delete from public.questionnaire_answers qa
using public.questionnaire_sessions qs, public.questionnaire_templates qt
where qa.session_id = qs.id and qs.template_id = qt.id and qt.code = 'QPI'
  and qs.statut in ('not_started','in_progress');

delete from public.qpi_product_experience qpe
using public.questionnaire_sessions qs, public.questionnaire_templates qt
where qpe.session_id = qs.id and qs.template_id = qt.id and qt.code = 'QPI'
  and qs.statut in ('not_started','in_progress');

delete from public.qpi_experience_details qed
using public.questionnaire_sessions qs, public.questionnaire_templates qt
where qed.session_id = qs.id and qs.template_id = qt.id and qt.code = 'QPI'
  and qs.statut in ('not_started','in_progress');

delete from public.qpi_results qr
using public.questionnaire_sessions qs, public.questionnaire_templates qt
where qr.session_id = qs.id and qs.template_id = qt.id and qt.code = 'QPI'
  and qs.statut in ('not_started','in_progress');

update public.questionnaire_sessions qs
set statut = 'not_started', started_at = null, completed_at = null, validated_at = null, updated_at = now()
from public.questionnaire_templates qt
where qs.template_id = qt.id and qt.code = 'QPI' and qs.statut in ('not_started','in_progress');

-- Catalogue V1.5 idempotent. Il permet de rejouer la migration sur une base vierge ou existante.
with t as (select id from public.questionnaire_templates where code='QPI' and actif=true limit 1)
insert into public.questionnaire_questions(template_id,code,section_code,ordre,libelle,type_reponse,obligatoire,scoree,metadata)
select t.id,v.code,v.section_code,v.ordre,v.libelle,'single',v.obligatoire,v.scoree,v.metadata
from t cross join (values
 ('Q3','situation',3,'Quel besoin de disponibilité de cette épargne anticipez-vous ?',true,false,'{}'::jsonb),
 ('Q4','situation',4,'Avez-vous un projet important susceptible de nécessiter des liquidités dans les 5 prochaines années ?',true,false,'{"extra_fields":["montant_besoin_futur","echeance"]}'::jsonb),
 ('Q9','capacite',9,'Si la valeur de vos placements diminuait durablement de 10 %, cette perte aurait-elle une conséquence concrète sur votre situation ?',true,false,'{}'::jsonb),
 ('Q10','capacite',10,'Selon votre propre appréciation, quelle perte définitive maximale pensez-vous pouvoir absorber sur le montant investi sans remettre en cause vos engagements, votre niveau de vie ou vos projets ?',true,false,'{"extra_fields":["perte_max_declairee_montant"]}'::jsonb),
 ('Q11','experience',11,'Avez-vous déjà subi une perte significative sur un investissement ?',true,false,'{}'::jsonb),
 ('Q12','experience',12,'Lors de la perte la plus marquante que vous avez connue, quelle a été votre réaction principale ?',false,false,'{"show_if":{"question":"Q11","not_equals":"A"}}'::jsonb),
 ('Q13','connaissances',13,'Diversifier ses placements permet principalement de :',true,false,'{"correct_option":"B"}'::jsonb),
 ('Q14','connaissances',14,'Un placement présentant un potentiel de rendement plus élevé implique généralement :',true,false,'{"correct_option":"B"}'::jsonb),
 ('Q15','connaissances',15,'Une SCPI ou un fonds immobilier non coté :',true,false,'{"correct_option":"B"}'::jsonb),
 ('Q16','connaissances',16,'Sur une assurance-vie ou un PER investi en unités de compte :',true,false,'{"correct_option":"B"}'::jsonb),
 ('Q17','connaissances',17,'Une obligation ou un fonds obligataire peut perdre de la valeur notamment :',true,false,'{"correct_option":"B"}'::jsonb),
 ('Q18','connaissances',18,'Un produit structuré peut comporter :',true,false,'{"correct_option":"B"}'::jsonb),
 ('Q19','connaissances',19,'Une performance passée positive :',true,false,'{"correct_option":"C"}'::jsonb),
 ('Q20','connaissances',20,'Un horizon long :',true,false,'{"correct_option":"B"}'::jsonb),
 ('Q21','tolerance',21,'Un placement de 100 000 € vaut 90 000 € après une période défavorable. Que faites-vous le plus probablement ?',true,true,'{}'::jsonb),
 ('Q22','tolerance',22,'À partir de quelle baisse temporaire de votre portefeuille commenceriez-vous à ressentir un inconfort important ?',true,true,'{}'::jsonb),
 ('Q23','tolerance',23,'Si une baisse de 20 % persistait pendant deux ans avant une éventuelle reprise, votre réaction serait plutôt :',true,true,'{}'::jsonb),
 ('Q24','tolerance',24,'Quelle proposition vous correspond le mieux ?',true,true,'{}'::jsonb),
 ('Q25','tolerance',25,'Quelle part de la somme investie accepteriez-vous d’exposer à des placements pouvant connaître des baisses supérieures à 30 % ?',true,true,'{}'::jsonb)
) as v(code,section_code,ordre,libelle,obligatoire,scoree,metadata)
on conflict(template_id,code) do update set section_code=excluded.section_code,ordre=excluded.ordre,libelle=excluded.libelle,obligatoire=excluded.obligatoire,scoree=excluded.scoree,metadata=excluded.metadata,updated_at=now();

with t as (select id from public.questionnaire_templates where code='ESG' and actif=true limit 1)
insert into public.questionnaire_questions(template_id,code,section_code,ordre,libelle,type_reponse,obligatoire,scoree,metadata)
select t.id,v.code,'durabilite',v.ordre,v.libelle,v.type_reponse,v.obligatoire,false,v.metadata
from t cross join (values
 ('ESG_SCOPE',1,'Sur quel périmètre souhaitez-vous appliquer vos préférences de durabilité ?','single',true,'{}'::jsonb),
 ('ESG_TAX_PREF',2,'Souhaitez-vous qu’une part de vos placements contribue à des activités durables au sens de la Taxonomie européenne ?','single',true,'{}'::jsonb),
 ('ESG_TAX_MIN',3,'Quelle part minimale souhaitez-vous consacrer aux activités alignées avec la Taxonomie ?','single',false,'{"show_if":{"question":"ESG_TAX_PREF","equals":"OUI"}}'::jsonb),
 ('ESG_TAX_OBJECTIVES',4,'Quels objectifs environnementaux souhaitez-vous privilégier ?','multiple',false,'{"show_if":{"question":"ESG_TAX_PREF","equals":"OUI"}}'::jsonb),
 ('ESG_SFDR_PREF',5,'Souhaitez-vous qu’une part de vos placements soit constituée d’investissements durables au sens du règlement SFDR ?','single',true,'{}'::jsonb),
 ('ESG_SFDR_MIN',6,'Quelle part minimale d’investissements durables SFDR souhaitez-vous ?','single',false,'{"show_if":{"question":"ESG_SFDR_PREF","equals":"OUI"}}'::jsonb),
 ('ESG_SFDR_THEMES',7,'Quelles thématiques durables souhaitez-vous privilégier ?','multiple',false,'{"show_if":{"question":"ESG_SFDR_PREF","equals":"OUI"}}'::jsonb),
 ('ESG_PAI_PREF',8,'Souhaitez-vous prendre en compte les principales incidences négatives sur les facteurs de durabilité (PAI) ?','single',true,'{}'::jsonb),
 ('ESG_PAI_PRIORITIES',9,'Quelles incidences négatives souhaitez-vous limiter en priorité ?','multiple',false,'{"show_if":{"question":"ESG_PAI_PREF","equals":"OUI"}}'::jsonb),
 ('ESG_PAI_MODALITIES',10,'Comment souhaitez-vous que ces incidences soient prises en compte ?','multiple',false,'{"show_if":{"question":"ESG_PAI_PREF","equals":"OUI"}}'::jsonb),
 ('ESG_EXCLUSIONS',11,'Souhaitez-vous exclure certains secteurs ou activités ?','multiple',false,'{}'::jsonb),
 ('ESG_LIMITATIONS',12,'Acceptez-vous certaines limites dans l’application de vos préférences ?','multiple',false,'{}'::jsonb),
 ('ESG_NEEDS',13,'Avez-vous d’autres besoins ou précisions concernant la durabilité ?','text',false,'{}'::jsonb)
) as v(code,ordre,libelle,type_reponse,obligatoire,metadata)
on conflict(template_id,code) do update set ordre=excluded.ordre,libelle=excluded.libelle,type_reponse=excluded.type_reponse,obligatoire=excluded.obligatoire,metadata=excluded.metadata,updated_at=now();

with options(qcode,code,ordre,libelle,points) as (values
 ('Q3','A',1,'Forte : possibilité de retrait à tout moment',null),('Q3','B',2,'Moyenne : disponibilité souhaitée sous quelques mois',null),('Q3','C',3,'Faible : je peux immobiliser cette épargne plusieurs années',null),('Q3','D',4,'Très faible : je n’anticipe pas de besoin de retrait pendant l’horizon prévu',null),
 ('Q4','A',1,'Non',null),('Q4','B',2,'Oui, dans moins de 2 ans',null),('Q4','C',3,'Oui, dans 2 à 5 ans',null),('Q4','D',4,'Projet possible mais montant/date non déterminés',null),
 ('Q9','A',1,'Oui : elle mettrait en difficulté mon budget ou un projet essentiel',null),('Q9','B',2,'Oui : elle m’obligerait à réduire ou décaler certains projets',null),('Q9','C',3,'Impact limité : je pourrais l’absorber sans modifier sensiblement mon niveau de vie',null),('Q9','D',4,'Aucun impact significatif sur mon niveau de vie ou mes projets',null),
 ('Q10','A',1,'Aucune perte significative',null),('Q10','B',2,'Jusqu’à 5 %',null),('Q10','C',3,'Jusqu’à 10 %',null),('Q10','D',4,'Jusqu’à 20 %',null),('Q10','E',5,'Jusqu’à 30 %',null),('Q10','F',6,'30 % ou plus',null),
 ('Q11','A',1,'Non / jamais',null),('Q11','B',2,'Oui, inférieure à 10 %',null),('Q11','C',3,'Oui, comprise entre 10 % et 25 %',null),('Q11','D',4,'Oui, supérieure à 25 %',null),
 ('Q12','A',1,'J’ai vendu rapidement pour arrêter la perte',null),('Q12','B',2,'J’ai réduit progressivement mon exposition',null),('Q12','C',3,'J’ai conservé l’investissement en attendant',null),('Q12','D',4,'J’ai renforcé après analyse',null),
 ('Q13','A',1,'Supprimer tout risque de perte',null),('Q13','B',2,'Réduire le risque de concentration sans supprimer tous les risques',null),('Q13','C',3,'Garantir une performance positive',null),('Q13','D',4,'Éviter toute baisse temporaire',null),
 ('Q14','A',1,'Un risque identique',null),('Q14','B',2,'Un risque de perte ou de fluctuation généralement plus élevé',null),('Q14','C',3,'Une garantie du capital',null),('Q14','D',4,'Une disponibilité immédiate',null),
 ('Q15','A',1,'Garantit le capital investi',null),('Q15','B',2,'Peut subir une baisse de valeur et présenter un délai de revente',null),('Q15','C',3,'Est équivalent à un livret bancaire',null),('Q15','D',4,'Assure un revenu fixe et garanti',null),
 ('Q16','A',1,'Toutes les unités de compte sont garanties par l’assureur',null),('Q16','B',2,'La valeur peut évoluer à la hausse comme à la baisse et le capital n’est pas garanti sur les UC',null),('Q16','C',3,'Les frais n’ont pas d’incidence',null),('Q16','D',4,'La durée de détention est sans importance',null),
 ('Q17','A',1,'Uniquement si la Bourse baisse',null),('Q17','B',2,'En cas de hausse des taux, de dégradation du crédit ou de défaut',null),('Q17','C',3,'Jamais si elle verse un coupon',null),('Q17','D',4,'Seulement à l’échéance',null),
 ('Q18','A',1,'Une protection ou garantie toujours inconditionnelle',null),('Q18','B',2,'Des conditions de remboursement, un risque de perte et un risque lié à l’émetteur',null),('Q18','C',3,'Aucun risque si le rendement est annoncé',null),('Q18','D',4,'Une liquidité toujours quotidienne sans décote',null),
 ('Q19','A',1,'Garantit une performance future comparable',null),('Q19','B',2,'Réduit à zéro le risque de perte future',null),('Q19','C',3,'Ne préjuge pas des performances futures',null),('Q19','D',4,'Garantit au moins le capital initial',null),
 ('Q20','A',1,'Supprime mécaniquement tout risque de perte',null),('Q20','B',2,'Peut permettre d’absorber certaines fluctuations mais ne garantit pas le capital',null),('Q20','C',3,'Rend tous les produits liquides',null),('Q20','D',4,'Rend inutile la diversification',null),
 ('Q21','A',1,'Je vends immédiatement pour éviter une perte supplémentaire',1),('Q21','B',2,'Je réduis nettement l’exposition au risque',2),('Q21','C',3,'Je prends conseil et j’attends avant de décider',3),('Q21','D',4,'Je conserve si le raisonnement d’investissement reste valable',4),('Q21','E',5,'Je reste à l’aise avec cette baisse et peux conserver si la stratégie reste cohérente',5),
 ('Q22','A',1,'Dès -2 % à -3 %',1),('Q22','B',2,'Vers -5 %',2),('Q22','C',3,'Vers -10 %',3),('Q22','D',4,'Vers -20 %',4),('Q22','E',5,'Au-delà de -30 %',5),
 ('Q23','A',1,'Je ne supporterais pas cette situation et souhaiterais sortir rapidement',1),('Q23','B',2,'Je réduirais fortement mon risque même au prix d’une perte',2),('Q23','C',3,'Je serais inquiet mais pourrais conserver avec accompagnement',3),('Q23','D',4,'Je pourrais conserver si l’horizon et la stratégie restent cohérents',4),('Q23','E',5,'Je pourrais conserver durablement malgré cette baisse si la stratégie reste cohérente',5),
 ('Q24','A',1,'Je privilégie la stabilité du capital, même avec un rendement très limité',1),('Q24','B',2,'J’accepte de faibles fluctuations pour améliorer légèrement le rendement potentiel',2),('Q24','C',3,'J’accepte des fluctuations modérées pour rechercher une progression à moyen/long terme',3),('Q24','D',4,'J’accepte des fluctuations importantes pour viser une performance supérieure',4),('Q24','E',5,'Je peux accepter de très fortes fluctuations et des pertes importantes sur une partie de mon patrimoine',5),
 ('Q25','A',1,'Aucune part',1),('Q25','B',2,'Jusqu’à 10 %',2),('Q25','C',3,'De 10 % à 25 %',3),('Q25','D',4,'De 25 % à 50 %',4),('Q25','E',5,'Plus de 50 %',5)
), q as (select qq.id,qq.code from public.questionnaire_questions qq join public.questionnaire_templates qt on qt.id=qq.template_id where qt.code='QPI' and qt.actif=true)
insert into public.questionnaire_options(question_id,code,ordre,libelle,points,metadata)
select q.id,o.code,o.ordre,o.libelle,o.points,'{}'::jsonb from options o join q on q.code=o.qcode
on conflict(question_id,code) do update set ordre=excluded.ordre,libelle=excluded.libelle,points=excluded.points;

with options(qcode,code,ordre,libelle,metadata) as (values
 ('ESG_SCOPE','PRODUIT',1,'Pour chaque produit','{}'::jsonb),('ESG_SCOPE','ALLOCATION',2,'Pour l’ensemble de mon allocation','{}'::jsonb),('ESG_SCOPE','AUTRE',3,'Autre périmètre — à préciser','{"requires_text":true}'::jsonb),
 ('ESG_TAX_PREF','OUI',1,'Oui','{}'::jsonb),('ESG_TAX_PREF','NON',2,'Non','{}'::jsonb),('ESG_TAX_PREF','INDETERMINE',3,'Je ne sais pas encore','{}'::jsonb),
 ('ESG_TAX_MIN','5',1,'Au moins 5 %','{}'::jsonb),('ESG_TAX_MIN','10',2,'Au moins 10 %','{}'::jsonb),('ESG_TAX_MIN','20',3,'Au moins 20 %','{}'::jsonb),('ESG_TAX_MIN','30',4,'Au moins 30 %','{}'::jsonb),('ESG_TAX_MIN','AUTRE',5,'Autre pourcentage','{}'::jsonb),
 ('ESG_TAX_OBJECTIVES','CLIMAT',1,'Atténuation et adaptation au changement climatique','{}'::jsonb),('ESG_TAX_OBJECTIVES','EAU',2,'Protection de l’eau et des ressources marines','{}'::jsonb),('ESG_TAX_OBJECTIVES','CIRCULAIRE',3,'Économie circulaire','{}'::jsonb),('ESG_TAX_OBJECTIVES','POLLUTION',4,'Prévention de la pollution et biodiversité','{}'::jsonb),
 ('ESG_SFDR_PREF','OUI',1,'Oui','{}'::jsonb),('ESG_SFDR_PREF','NON',2,'Non','{}'::jsonb),('ESG_SFDR_PREF','INDETERMINE',3,'Je ne sais pas encore','{}'::jsonb),
 ('ESG_SFDR_MIN','5',1,'Au moins 5 %','{}'::jsonb),('ESG_SFDR_MIN','10',2,'Au moins 10 %','{}'::jsonb),('ESG_SFDR_MIN','20',3,'Au moins 20 %','{}'::jsonb),('ESG_SFDR_MIN','30',4,'Au moins 30 %','{}'::jsonb),('ESG_SFDR_MIN','AUTRE',5,'Autre pourcentage','{}'::jsonb),
 ('ESG_SFDR_THEMES','ENVIRONNEMENT',1,'Environnement et climat','{}'::jsonb),('ESG_SFDR_THEMES','SOCIAL',2,'Enjeux sociaux et droits humains','{}'::jsonb),('ESG_SFDR_THEMES','GOUVERNANCE',3,'Gouvernance responsable','{}'::jsonb),
 ('ESG_PAI_PREF','OUI',1,'Oui','{}'::jsonb),('ESG_PAI_PREF','NON',2,'Non','{}'::jsonb),('ESG_PAI_PREF','INDETERMINE',3,'Je ne sais pas encore','{}'::jsonb),
 ('ESG_PAI_PRIORITIES','GES',1,'Émissions de gaz à effet de serre','{}'::jsonb),('ESG_PAI_PRIORITIES','BIODIVERSITE',2,'Biodiversité, eau et déchets','{}'::jsonb),('ESG_PAI_PRIORITIES','SOCIAL',3,'Droits humains, égalité et conditions de travail','{}'::jsonb),('ESG_PAI_PRIORITIES','AUCUNE',4,'Aucune priorité particulière','{"exclusive":true}'::jsonb),
 ('ESG_PAI_MODALITIES','EXCLUSION',1,'Exclure les émetteurs les moins vertueux','{}'::jsonb),('ESG_PAI_MODALITIES','SEUIL',2,'Appliquer des seuils mesurables','{}'::jsonb),('ESG_PAI_MODALITIES','ENGAGEMENT',3,'Privilégier l’engagement actionnarial','{}'::jsonb),
 ('ESG_EXCLUSIONS','TABAC',1,'Tabac','{}'::jsonb),('ESG_EXCLUSIONS','ARMES',2,'Armes controversées','{}'::jsonb),('ESG_EXCLUSIONS','FOSSILES',3,'Énergies fossiles','{}'::jsonb),('ESG_EXCLUSIONS','AUCUNE',4,'Aucune exclusion particulière','{"exclusive":true}'::jsonb),
 ('ESG_LIMITATIONS','OFFRE',1,'J’accepte une offre de produits plus restreinte','{}'::jsonb),('ESG_LIMITATIONS','RENDEMENT',2,'J’accepte un rendement potentiel différent','{}'::jsonb),('ESG_LIMITATIONS','AUCUNE',3,'Aucune limite particulière','{"exclusive":true}'::jsonb)
), q as (select qq.id,qq.code from public.questionnaire_questions qq join public.questionnaire_templates qt on qt.id=qq.template_id where qt.code='ESG' and qt.actif=true)
insert into public.questionnaire_options(question_id,code,ordre,libelle,metadata)
select q.id,o.code,o.ordre,o.libelle,o.metadata from options o join q on q.code=o.qcode
on conflict(question_id,code) do update set ordre=excluded.ordre,libelle=excluded.libelle,metadata=excluded.metadata;
