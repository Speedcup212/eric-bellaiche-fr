-- Prevent duplicate QPI/ESG sessions for the same dossier member and questionnaire template.
create unique index if not exists questionnaire_sessions_one_per_template_idx
on public.questionnaire_sessions(dossier_id,investisseur_id,template_id);
