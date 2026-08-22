-- Reformulation accessible de la question Q3 sur le besoin de liquidité.
update public.questionnaire_questions qq
set libelle = 'Souhaitez-vous pouvoir récupérer rapidement tout ou partie de l’épargne que vous envisagez d’investir ?',
    updated_at = now()
from public.questionnaire_templates qt
where qq.template_id = qt.id
  and qt.code = 'QPI'
  and qt.actif = true
  and qq.code = 'Q3';

update public.questionnaire_options qo
set libelle = case qo.code
  when 'A' then 'Oui, à tout moment'
  when 'B' then 'Oui, dans un délai de quelques mois'
  when 'C' then 'Pas nécessairement, je peux la laisser investie plusieurs années'
  when 'D' then 'Non, je n’envisage pas de retrait pendant la durée prévue'
end
from public.questionnaire_questions qq
join public.questionnaire_templates qt on qt.id = qq.template_id
where qo.question_id = qq.id
  and qt.code = 'QPI'
  and qt.actif = true
  and qq.code = 'Q3'
  and qo.code in ('A','B','C','D');
