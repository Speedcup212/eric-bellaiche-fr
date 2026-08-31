alter table public.qpi_results add column if not exists investisseur_id uuid;
alter table public.qpi_results add column if not exists niveau_connaissances text;
alter table public.qpi_results add column if not exists capacite_perte text;

update public.qpi_results qr
set investisseur_id = qs.investisseur_id,
    niveau_connaissances = coalesce(qr.synthese_dimensions->'connaissances'->>'niveau', qr.niveau_connaissances),
    capacite_perte = case
      when qr.capacite_perte_retenue_pct is not null then trim(to_char(qr.capacite_perte_retenue_pct,'FM999990D##')) || ' % maximum'
      when qr.perte_max_declairee_pct is not null then trim(to_char(qr.perte_max_declairee_pct,'FM999990D##')) || ' % maximum'
      else qr.capacite_perte
    end
from public.questionnaire_sessions qs
where qs.id = qr.session_id;

create or replace function private.sync_qpi_result_adequation_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_investisseur uuid;
begin
  select qs.investisseur_id into v_investisseur
  from public.questionnaire_sessions qs
  where qs.id = new.session_id;

  new.investisseur_id := v_investisseur;
  new.niveau_connaissances := coalesce(new.synthese_dimensions->'connaissances'->>'niveau', new.niveau_connaissances);
  new.capacite_perte := case
    when new.capacite_perte_retenue_pct is not null then trim(to_char(new.capacite_perte_retenue_pct,'FM999990D##')) || ' % maximum'
    when new.perte_max_declairee_pct is not null then trim(to_char(new.perte_max_declairee_pct,'FM999990D##')) || ' % maximum'
    else new.capacite_perte
  end;
  return new;
end;
$$;

drop trigger if exists qpi_results_sync_adequation_fields on public.qpi_results;
create trigger qpi_results_sync_adequation_fields
before insert or update of session_id, synthese_dimensions, capacite_perte_retenue_pct, perte_max_declairee_pct
on public.qpi_results
for each row execute function private.sync_qpi_result_adequation_fields();

create index if not exists qpi_results_investisseur_idx on public.qpi_results(investisseur_id);
