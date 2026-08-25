create or replace function private.save_my_recueil_section_core(
  p_dossier_id uuid,
  p_section_code text,
  p_payload jsonb,
  p_completed boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_inv uuid;
  v_role text;
  v_status text;
begin
  if v_uid is null then raise exception 'Authentification requise'; end if;
  if p_section_code not in ('identity','family','professional','objectives','capacity','tax','regulatory','patrimony','financial','credits') then
    raise exception 'Section de recueil inconnue';
  end if;

  select i.id, di.role_dossier, di.recueil_status
    into v_inv, v_role, v_status
  from public.investisseurs i
  join public.dossier_investisseurs di on di.investisseur_id = i.id
  where di.dossier_id = p_dossier_id
    and i.auth_user_id = v_uid
  limit 1;

  if v_inv is null then raise exception 'Accès refusé'; end if;
  if v_status = 'validated' then raise exception 'Votre recueil est déjà validé et ne peut plus être modifié'; end if;

  perform private.materialize_my_recueil_section_core(
    p_dossier_id,
    v_inv,
    v_role,
    p_section_code,
    coalesce(p_payload, '{}'::jsonb)
  );

  insert into public.recueil_sections(dossier_id, investisseur_id, section_code, payload, completed_at)
  values(
    p_dossier_id,
    v_inv,
    p_section_code,
    coalesce(p_payload, '{}'::jsonb),
    case when p_completed then now() else null end
  )
  on conflict(dossier_id, investisseur_id, section_code) do update
    set payload = excluded.payload,
        completed_at = case when p_completed then now() else public.recueil_sections.completed_at end,
        updated_at = now();

  update public.dossier_investisseurs
     set recueil_status = 'in_progress', updated_at = now()
   where dossier_id = p_dossier_id
     and investisseur_id = v_inv
     and recueil_status <> 'validated';
end;
$function$;

revoke all on function private.save_my_recueil_section_core(uuid, text, jsonb, boolean) from public, anon, authenticated;
