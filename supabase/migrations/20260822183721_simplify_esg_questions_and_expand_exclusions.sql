update public.questionnaire_questions q
set libelle = case q.code
  when 'ESG_SFDR_PREF' then 'Souhaitez-vous réserver une partie de vos placements à des entreprises ou projets qui contribuent concrètement à l’environnement ou à la société ?'
  when 'ESG_SFDR_MIN' then 'Si oui, quelle part minimale de vos placements souhaitez-vous leur réserver ?'
  when 'ESG_SFDR_THEMES' then 'Quels domaines souhaitez-vous soutenir en priorité ?'
  when 'ESG_PAI_PREF' then 'Souhaitez-vous éviter les placements dont les activités peuvent avoir des effets importants sur l’environnement ou la société ?'
  when 'ESG_PAI_PRIORITIES' then 'Quels effets négatifs souhaitez-vous limiter en priorité ?'
  when 'ESG_PAI_MODALITIES' then 'Comment souhaitez-vous que le cabinet en tienne compte ?'
  when 'ESG_EXCLUSIONS' then 'Y a-t-il des secteurs ou des activités dans lesquels vous ne souhaitez pas investir ?'
  when 'ESG_LIMITATIONS' then 'Acceptez-vous que vos critères de durabilité puissent réduire le choix de placements ou modifier leur rendement potentiel ?'
  else q.libelle
end,
updated_at = now()
where q.code in (
  'ESG_SFDR_PREF', 'ESG_SFDR_MIN', 'ESG_SFDR_THEMES',
  'ESG_PAI_PREF', 'ESG_PAI_PRIORITIES', 'ESG_PAI_MODALITIES',
  'ESG_EXCLUSIONS', 'ESG_LIMITATIONS'
)
and exists (
  select 1 from public.questionnaire_templates t
  where t.id = q.template_id and t.code = 'ESG' and t.actif = true
);

update public.questionnaire_options o
set libelle = case o.code
  when 'EXCLUSION' then 'Éviter les entreprises les plus concernées'
  when 'SEUIL' then 'Fixer des limites précises à ne pas dépasser'
  when 'ENGAGEMENT' then 'Privilégier les entreprises qui s’engagent à progresser'
  else o.libelle
end
where o.question_id in (
  select q.id from public.questionnaire_questions q
  join public.questionnaire_templates t on t.id = q.template_id
  where q.code = 'ESG_PAI_MODALITIES' and t.code = 'ESG' and t.actif = true
)
and o.code in ('EXCLUSION', 'SEUIL', 'ENGAGEMENT');

with q as (
  select qq.id
  from public.questionnaire_questions qq
  join public.questionnaire_templates qt on qt.id = qq.template_id
  where qq.code = 'ESG_EXCLUSIONS' and qt.code = 'ESG' and qt.actif = true
), options(code, ordre, libelle, metadata) as (values
  ('ARMES', 1, 'Armes controversées', '{}'::jsonb),
  ('ARMES_CONVENTIONNELLES', 2, 'Armes militaires conventionnelles', '{}'::jsonb),
  ('TABAC', 3, 'Tabac', '{}'::jsonb),
  ('JEUX_HASARD', 4, 'Jeux de hasard', '{}'::jsonb),
  ('DIVERTISSEMENTS_ADULTES', 5, 'Divertissements pour adultes', '{}'::jsonb),
  ('CHARBON_THERMIQUE', 6, 'Charbon thermique', '{}'::jsonb),
  ('FOSSILES', 7, 'Énergies fossiles', '{}'::jsonb),
  ('HUILE_PALME', 8, 'Huile de palme', '{}'::jsonb),
  ('PESTICIDES', 9, 'Pesticides', '{}'::jsonb),
  ('EMBRYONS_HUMAINS', 10, 'Recherche sur les embryons humains', '{}'::jsonb),
  ('ARMES_NUCLEAIRES', 11, 'Armes nucléaires', '{}'::jsonb),
  ('ALCOOL', 12, 'Alcool', '{}'::jsonb),
  ('OPIOIDES', 13, 'Opioïdes', '{}'::jsonb),
  ('PRISONS_PRIVEES', 14, 'Prisons privées', '{}'::jsonb),
  ('MATERIELS_RADIOACTIFS', 15, 'Production ou extraction de matériels radioactifs', '{}'::jsonb),
  ('ESPECES_MENACEES', 16, 'Trafic d’espèces animales menacées', '{}'::jsonb),
  ('AUTRE', 17, 'Autre secteur ou activité — à préciser', '{"requires_text":true}'::jsonb),
  ('AUCUNE', 18, 'Aucune exclusion particulière', '{"exclusive":true}'::jsonb)
)
insert into public.questionnaire_options(question_id, code, ordre, libelle, metadata)
select q.id, options.code, options.ordre, options.libelle, options.metadata
from q cross join options
on conflict (question_id, code) do update
set ordre = excluded.ordre,
    libelle = excluded.libelle,
    metadata = excluded.metadata;
