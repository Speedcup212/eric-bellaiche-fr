-- QPI 2026: parcours resserré, 5 questions de connaissance, 5 familles d'expérience et 5 scénarios comportementaux.
update public.questionnaire_templates
set version='2026-PREMIUM-1.6', date_revision=date '2026-08-26',
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('screen_count_max',15,'knowledge_question_count',5,'experience_family_count',5,'behavioral_question_count',5,'recueil_is_source_of_truth',true),
    updated_at=now()
where code='QPI' and actif=true;

update public.questionnaire_questions qq
set obligatoire=false, metadata=coalesce(qq.metadata,'{}'::jsonb)||'{"deprecated":true}'::jsonb, updated_at=now()
from public.questionnaire_templates qt
where qq.template_id=qt.id and qt.code='QPI' and qt.actif=true and qq.code in ('Q11','Q12','Q18','Q19','Q20');

with wording(code,libelle) as (values
('Q3','Aurez-vous besoin de récupérer une partie de cette épargne rapidement ?'),
('Q4','Un projet pourrait-il nécessiter une partie de cet argent dans les 5 prochaines années ?'),
('Q9','Si votre patrimoine financier baissait, cela pourrait-il vous obliger à réduire vos dépenses ou reporter un projet ?'),
('Q10','Quelle baisse pourriez-vous absorber sans réduire votre niveau de vie ni renoncer à un projet important ?'),
('Q13','Quel est généralement l’effet de la diversification d’un portefeuille ?'),
('Q14','Un rendement potentiel plus élevé implique généralement :'),
('Q15','Concernant une SCPI ou un fonds immobilier non coté, quelle affirmation est correcte ?'),
('Q16','Concernant les unités de compte d’une assurance-vie ou d’un PER, quelle affirmation est correcte ?'),
('Q17','Dans quelle situation une obligation peut-elle perdre de la valeur ?'),
('Q21','Votre portefeuille de 100 000 € baisse temporairement à 85 000 €. Que faites-vous ?'),
('Q22','À partir de quelle baisse temporaire commenceriez-vous réellement à envisager de modifier votre stratégie ?'),
('Q23','Une baisse de 20 % dure deux ans. Quelle serait votre réaction la plus probable ?'),
('Q24','Pour un placement à long terme, quel compromis choisiriez-vous concrètement ?'),
('Q25','Quelle part de votre épargne accepteriez-vous d’exposer à des placements pouvant connaître de fortes baisses ?'))
update public.questionnaire_questions qq set libelle=wording.libelle,updated_at=now()
from wording join public.questionnaire_templates qt on qt.code='QPI' and qt.actif=true
where qq.template_id=qt.id and qq.code=wording.code;

update public.questionnaire_options qo set libelle=case qo.code
when 'A' then 'Je vendrais rapidement pour limiter la perte'
when 'B' then 'Je réduirais une partie de mes placements risqués'
when 'C' then 'Je prendrais conseil avant de décider'
when 'D' then 'Je conserverais mes placements si la stratégie reste adaptée'
when 'E' then 'J’investirais davantage si ma situation le permet' end
from public.questionnaire_questions qq join public.questionnaire_templates qt on qt.id=qq.template_id
where qo.question_id=qq.id and qt.code='QPI' and qt.actif=true and qq.code='Q21';

update public.questionnaire_options qo set libelle=case qo.code
when 'A' then 'Je privilégierais une forte stabilité, même avec un rendement limité'
when 'B' then 'J’accepterais de petites fluctuations pour améliorer légèrement le rendement potentiel'
when 'C' then 'J’accepterais des fluctuations modérées pour rechercher une progression à moyen / long terme'
when 'D' then 'J’accepterais des fluctuations importantes pour viser une performance supérieure'
when 'E' then 'J’accepterais de très fortes fluctuations sur une partie de mon patrimoine pour viser une performance élevée' end
from public.questionnaire_questions qq join public.questionnaire_templates qt on qt.id=qq.template_id
where qo.question_id=qq.id and qt.code='QPI' and qt.actif=true and qq.code='Q24';

do $$ declare v_definition text; v_new text; begin
select pg_get_functiondef('private.refresh_qpi_assessment_core(uuid)'::regprocedure) into v_definition; v_new:=v_definition;
v_new:=replace(v_new,'qq.code between ''Q13'' and ''Q20''','qq.code in (''Q13'',''Q14'',''Q15'',''Q16'',''Q17'')');
v_new:=replace(v_new,'when v_knowledge_answers < 8 then ''À compléter''','when v_knowledge_answers < 5 then ''À compléter''');
v_new:=replace(v_new,'when v_knowledge_correct >= 7 then ''Suffisant''','when v_knowledge_correct >= 4 then ''Suffisant''');
v_new:=replace(v_new,'when v_knowledge_correct >= 5 then ''Intermédiaire''','when v_knowledge_correct >= 3 then ''Intermédiaire''');
v_new:=replace(v_new,'and famille_produit in (''liquidites'',''obligations'',''actions'',''diversifies'',''immobilier_papier'',''av_per'',''structures'',''non_cote'')','and famille_produit in (''liquidites'',''obligations'',''actions'',''immobilier_papier'',''structures'')');
v_new:=replace(v_new,'''total'', 8','''total'', 5');
v_new:=replace(v_new,'v_knowledge_answers = 8 and','v_knowledge_answers = 5 and');
if v_new=v_definition then raise exception 'Moteur QPI non adapté'; end if; execute v_new; end $$;

do $$ declare v_definition text; v_new text; begin
select pg_get_functiondef('private.complete_questionnaire_session_core(uuid)'::regprocedure) into v_definition;
v_new:=replace(v_definition,'if v_count<8 then raise exception ''Questionnaire incomplet : expérience produits à compléter (%/8)'',v_count; end if;','if v_count<5 then raise exception ''Questionnaire incomplet : expérience produits à compléter (%/5)'',v_count; end if;');
if v_new<>v_definition then execute v_new; end if; end $$;
