-- Permettre aux clients de reconnaître honnêtement une absence de connaissance
-- sans les forcer à choisir une réponse au hasard.
insert into public.questionnaire_options (question_id, code, libelle, ordre, points, metadata)
select
  qq.id,
  'NSP',
  'Je ne sais pas',
  coalesce((
    select max(existing.ordre) + 1
    from public.questionnaire_options existing
    where existing.question_id = qq.id
  ), 1),
  0,
  '{"unknown": true}'::jsonb
from public.questionnaire_templates qt
join public.questionnaire_questions qq on qq.template_id = qt.id
where qt.code = 'QPI'
  and qt.actif = true
  and qq.type_reponse = 'single'
  and qq.metadata ? 'correct_option'
on conflict (question_id, code) do update
set libelle = excluded.libelle,
    ordre = excluded.ordre,
    points = 0,
    metadata = excluded.metadata;
