-- Remplace la question technique sur les produits structurés par une question
-- générale et accessible sur l'incidence des frais.
-- Les codes de réponse sont conservés afin de préserver le barème et les réponses existantes.

with target_question as (
  select qq.id
  from public.questionnaire_questions qq
  join public.questionnaire_templates qt on qt.id = qq.template_id
  where qt.code = 'QPI'
    and qt.actif = true
    and qq.code = 'Q18'
)
update public.questionnaire_questions qq
set libelle = 'Les frais d’un placement réduisent-ils ce que vous gagnez réellement ?',
    updated_at = now()
from target_question tq
where qq.id = tq.id;

with target_question as (
  select qq.id
  from public.questionnaire_questions qq
  join public.questionnaire_templates qt on qt.id = qq.template_id
  where qt.code = 'QPI'
    and qt.actif = true
    and qq.code = 'Q18'
),
new_labels(code, libelle) as (
  values
    ('A', 'Non, les frais n’ont aucun effet'),
    ('B', 'Oui, ils diminuent le rendement réellement obtenu'),
    ('C', 'Seulement si le placement baisse'),
    ('D', 'Non, ils sont toujours remboursés')
)
update public.questionnaire_options qo
set libelle = nl.libelle
from target_question tq, new_labels nl
where qo.question_id = tq.id
  and qo.code = nl.code;
