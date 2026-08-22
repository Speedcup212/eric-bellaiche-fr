update public.questionnaire_questions q
set libelle = 'Quelles conséquences éventuelles de vos critères de durabilité acceptez-vous ?',
    updated_at = now()
where q.code = 'ESG_LIMITATIONS'
and exists (
  select 1 from public.questionnaire_templates t
  where t.id = q.template_id and t.code = 'ESG' and t.actif = true
);

update public.questionnaire_options o
set libelle = case o.code
  when 'OFFRE' then 'Un choix de placements plus limité'
  when 'RENDEMENT' then 'Un rendement potentiel différent'
  when 'AUCUNE' then 'Aucune de ces conséquences'
  else o.libelle
end
where o.question_id in (
  select q.id from public.questionnaire_questions q
  join public.questionnaire_templates t on t.id = q.template_id
  where q.code = 'ESG_LIMITATIONS' and t.code = 'ESG' and t.actif = true
)
and o.code in ('OFFRE', 'RENDEMENT', 'AUCUNE');
