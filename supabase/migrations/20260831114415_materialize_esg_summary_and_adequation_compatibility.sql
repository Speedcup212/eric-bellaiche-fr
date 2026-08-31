create or replace function private.fill_esg_regulatory_summary()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_parts text[] := '{}';
  v_has_pref boolean := false;
begin
  if new.taxonomie_choix = 'oui' then
    v_has_pref := true;
    v_parts := array_append(v_parts, 'Taxonomie européenne : minimum ' || coalesce(trim(to_char(new.taxonomie_min_pct, 'FM999990D##')), 'à préciser') || ' %');
  elsif new.taxonomie_choix is not null then
    v_parts := array_append(v_parts, 'Taxonomie européenne : ' || new.taxonomie_choix);
  end if;

  if new.sfdr_choix = 'oui' then
    v_has_pref := true;
    v_parts := array_append(v_parts, 'Investissements durables SFDR : minimum ' || coalesce(trim(to_char(new.sfdr_min_pct, 'FM999990D##')), 'à préciser') || ' %');
  elsif new.sfdr_choix is not null then
    v_parts := array_append(v_parts, 'Investissements durables SFDR : ' || new.sfdr_choix);
  end if;

  if new.pai_choix = 'oui' then
    v_has_pref := true;
    v_parts := array_append(v_parts, 'PAI : prise en compte demandée');
  elsif new.pai_choix is not null then
    v_parts := array_append(v_parts, 'PAI : ' || new.pai_choix);
  end if;

  if coalesce(array_length(new.exclusions_sectorielles, 1), 0) > 0 then
    v_has_pref := true;
    v_parts := array_append(v_parts, 'Exclusions : ' || array_to_string(new.exclusions_sectorielles, ', '));
  end if;

  if coalesce(array_length(new.limitations_sectorielles, 1), 0) > 0 then
    v_has_pref := true;
    v_parts := array_append(v_parts, 'Limitations : ' || array_to_string(new.limitations_sectorielles, ', '));
  end if;

  if nullif(trim(coalesce(new.besoins_specifiques, '')), '') is not null then
    v_has_pref := true;
    v_parts := array_append(v_parts, 'Besoins spécifiques : ' || trim(new.besoins_specifiques));
  end if;

  new.synthese_reglementaire := case
    when coalesce(array_length(v_parts, 1), 0) = 0 then 'Préférences de durabilité non précisées.'
    when not v_has_pref then 'Aucune préférence de durabilité contraignante exprimée. ' || array_to_string(v_parts, ' ; ') || '.'
    else 'Préférences de durabilité exprimées. ' || array_to_string(v_parts, ' ; ') || '.'
  end;
  return new;
end;
$$;

drop trigger if exists esg_preferences_build_summary on public.esg_preferences;
create trigger esg_preferences_build_summary
before insert or update of perimetre, perimetre_autre, taxonomie_choix, taxonomie_min_pct, taxonomie_objectifs, sfdr_choix, sfdr_min_pct, sfdr_thematiques, pai_choix, pai_priorites, pai_modalites, exclusions_sectorielles, limitations_sectorielles, besoins_specifiques
on public.esg_preferences
for each row execute function private.fill_esg_regulatory_summary();

update public.esg_preferences
set updated_at = updated_at;

create or replace view public.esg_results
with (security_invoker = true)
as
select
  ep.id,
  ep.session_id,
  case
    when ep.synthese_reglementaire like 'Préférences de durabilité exprimées.%' then 'Préférences de durabilité exprimées'
    when ep.synthese_reglementaire like 'Aucune préférence de durabilité contraignante%' then 'Sans contrainte ESG spécifique'
    else 'Préférences ESG à confirmer'
  end as profil_final,
  ep.synthese_reglementaire as synthese,
  ep.perimetre,
  ep.taxonomie_choix,
  ep.taxonomie_min_pct,
  ep.taxonomie_objectifs,
  ep.sfdr_choix,
  ep.sfdr_min_pct,
  ep.sfdr_thematiques,
  ep.pai_choix,
  ep.pai_priorites,
  ep.pai_modalites,
  ep.exclusions_sectorielles,
  ep.limitations_sectorielles,
  ep.besoins_specifiques
from public.esg_preferences ep;

grant select on public.esg_results to authenticated;
