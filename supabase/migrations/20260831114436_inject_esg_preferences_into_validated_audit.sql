create or replace function private.inject_esg_into_audit_controls()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_controls jsonb := '[]'::jsonb;
  v_item jsonb;
  v_summary text;
  v_name text;
begin
  if new.statut <> 'validated' then
    return new;
  end if;

  if jsonb_typeof(coalesce(new.controls, '[]'::jsonb)) = 'array' then
    select coalesce(jsonb_agg(value), '[]'::jsonb)
      into v_controls
    from jsonb_array_elements(coalesce(new.controls, '[]'::jsonb))
    where jsonb_typeof(value) <> 'string'
       or value #>> '{}' not like 'ESG — %';
  end if;

  for v_summary, v_name in
    select ep.synthese_reglementaire,
           trim(concat_ws(' ', i.prenom, i.nom))
    from public.questionnaire_sessions qs
    join public.esg_preferences ep on ep.session_id = qs.id
    left join public.investisseurs i on i.id = qs.investisseur_id
    where qs.dossier_id = new.dossier_id
    order by qs.created_at
  loop
    if nullif(trim(coalesce(v_summary, '')), '') is not null then
      v_item := to_jsonb('ESG — ' || coalesce(nullif(v_name, ''), 'Investisseur') || ' : ' || v_summary);
      v_controls := v_controls || jsonb_build_array(v_item);
    end if;
  end loop;

  new.controls := v_controls;
  return new;
end;
$$;

drop trigger if exists audit_recommendations_inject_esg on public.audit_recommendations;
create trigger audit_recommendations_inject_esg
before insert or update of statut, controls
on public.audit_recommendations
for each row execute function private.inject_esg_into_audit_controls();

update public.audit_recommendations
set controls = controls
where statut = 'validated';
