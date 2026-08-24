alter table public.document_context_answers
  add column if not exists tax_absence_reason text,
  add column if not exists tax_absence_other text;

alter table public.document_context_answers
  drop constraint if exists document_context_answers_tax_absence_reason_check;

alter table public.document_context_answers
  add constraint document_context_answers_tax_absence_reason_check
  check (tax_absence_reason is null or tax_absence_reason in ('first_declaration','recent_arrival','former_non_resident','notice_not_issued','other'));

update public.document_context_answers
set tax_absence_reason = null,
    tax_absence_other = null
where tax_status is distinct from 'no_personal_notice';
