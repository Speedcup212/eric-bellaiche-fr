update public.questionnaire_questions
set libelle = case code
  when 'ESG_TAX_PREF' then 'Souhaitez-vous qu’une partie de vos placements finance des activités considérées comme durables pour l’environnement par l’Union européenne ?'
  when 'ESG_TAX_MIN' then 'Si oui, quelle part minimale de vos placements souhaitez-vous consacrer à ces activités durables ?'
  else libelle
end
where code in ('ESG_TAX_PREF', 'ESG_TAX_MIN');
