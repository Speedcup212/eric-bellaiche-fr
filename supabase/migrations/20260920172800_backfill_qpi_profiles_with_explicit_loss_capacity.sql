update public.qpi_results qr
set updated_at = now()
from public.questionnaire_sessions qs
join public.questionnaire_templates qt on qt.id = qs.template_id
where qr.session_id = qs.id
  and qt.type_questionnaire = 'QPI';
