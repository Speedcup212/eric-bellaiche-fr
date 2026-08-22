update public.questionnaire_questions q
set libelle = 'À quels placements souhaitez-vous appliquer vos préférences de durabilité ?'
where q.code = 'ESG_SCOPE'
  and exists (
    select 1
    from public.questionnaire_templates t
    where t.id = q.template_id
      and t.code = 'ESG'
      and t.actif = true
  );

update public.questionnaire_options o
set
  libelle = case o.code
    when 'ALLOCATION' then 'À tous mes placements'
    when 'AUTRE' then 'À certains placements seulement — à préciser'
    when 'PRODUIT' then 'Je souhaite décider séparément pour chaque placement'
    else o.libelle
  end,
  ordre = case o.code
    when 'ALLOCATION' then 1
    when 'AUTRE' then 2
    when 'PRODUIT' then 3
    else o.ordre
  end
where o.question_id in (
  select q.id
  from public.questionnaire_questions q
  join public.questionnaire_templates t on t.id = q.template_id
  where q.code = 'ESG_SCOPE'
    and t.code = 'ESG'
    and t.actif = true
)
and o.code in ('ALLOCATION', 'AUTRE', 'PRODUIT');
