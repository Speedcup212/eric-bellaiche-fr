create or replace function public.sync_questionnaire_session_status()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_type text;
  v_mapped text;
begin
  select qt.type_questionnaire into v_type
  from public.questionnaire_templates qt
  where qt.id = new.template_id;

  if v_type = 'QPI' then
    v_mapped := case new.statut
      when 'not_started' then 'not_started'
      when 'in_progress' then 'in_progress'
      when 'completed' then 'completed'
      when 'validated' then 'validated'
      when 'cancelled' then 'not_started'
    end;

    update public.dossier_investisseurs
       set qpi_status = v_mapped,
           updated_at = now()
     where dossier_id = new.dossier_id
       and investisseur_id = new.investisseur_id;

    if new.statut in ('completed','validated') then
      perform public.ensure_esg_session(new.dossier_id, new.investisseur_id);
    end if;

  elsif v_type = 'ESG' then
    v_mapped := case new.statut
      when 'not_started' then 'pending'
      when 'in_progress' then 'in_progress'
      when 'completed' then 'completed'
      when 'validated' then 'validated'
      when 'cancelled' then 'pending'
    end;

    update public.dossier_investisseurs
       set esg_status = v_mapped,
           updated_at = now()
     where dossier_id = new.dossier_id
       and investisseur_id = new.investisseur_id;
  end if;

  return new;
end;
$function$;

update public.dossier_investisseurs di
set qpi_status = case qs.statut
  when 'not_started' then 'not_started'
  when 'in_progress' then 'in_progress'
  when 'completed' then 'completed'
  when 'validated' then 'validated'
  when 'cancelled' then 'not_started'
end,
updated_at = now()
from public.questionnaire_sessions qs
join public.questionnaire_templates qt on qt.id = qs.template_id and qt.type_questionnaire = 'QPI'
where di.dossier_id = qs.dossier_id
  and di.investisseur_id = qs.investisseur_id;

update public.dossier_investisseurs di
set esg_status = case qs.statut
  when 'not_started' then 'pending'
  when 'in_progress' then 'in_progress'
  when 'completed' then 'completed'
  when 'validated' then 'validated'
  when 'cancelled' then 'pending'
end,
updated_at = now()
from public.questionnaire_sessions qs
join public.questionnaire_templates qt on qt.id = qs.template_id and qt.type_questionnaire = 'ESG'
where di.dossier_id = qs.dossier_id
  and di.investisseur_id = qs.investisseur_id;
