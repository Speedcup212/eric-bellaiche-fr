create or replace function public.sync_my_spouse_from_family(
  p_dossier_id uuid,
  p_situation text,
  p_civilite text default null,
  p_prenom text default null,
  p_nom text default null,
  p_email text default null,
  p_mobile text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_primary uuid;
  v_role text;
  v_foyer uuid;
  v_spouse uuid;
  v_spouse_auth uuid;
  v_requires_spouse boolean;
  v_primary_email text;
  v_has_activity boolean := false;
  v_family_payload jsonb;
  v_primary_address jsonb;
  v_identity_payload jsonb;
begin
  if v_uid is null then
    raise exception 'Authentification requise';
  end if;

  select i.id, di.role_dossier, i.foyer_id, lower(trim(coalesce(i.email, '')))
    into v_primary, v_role, v_foyer, v_primary_email
  from public.investisseurs i
  join public.dossier_investisseurs di on di.investisseur_id = i.id
  where di.dossier_id = p_dossier_id
    and i.auth_user_id = v_uid
  limit 1;

  if v_primary is null then
    raise exception 'Accès refusé';
  end if;

  -- La structure du foyer est pilotée uniquement par l'Identifiant 1.
  -- L'Identifiant 2 dispose ensuite de son propre parcours individuel.
  if v_role <> 'investisseur_1' then
    raise exception 'La composition du dossier est gérée par l’Identifiant 1.';
  end if;

  v_requires_spouse := lower(trim(coalesce(p_situation, ''))) in
    ('marié', 'marie', 'pacsé', 'pacse', 'concubinage');

  select i.id, i.auth_user_id
    into v_spouse, v_spouse_auth
  from public.dossier_investisseurs di
  join public.investisseurs i on i.id = di.investisseur_id
  where di.dossier_id = p_dossier_id
    and di.investisseur_id <> v_primary
  order by case when di.role_dossier = 'investisseur_2' then 0 else 1 end, di.role_dossier
  limit 1;

  if v_requires_spouse then
    if coalesce(trim(p_prenom), '') = ''
       or coalesce(trim(p_nom), '') = ''
       or coalesce(trim(p_email), '') = '' then
      raise exception 'Pour un dossier couple, renseignez le prénom, le nom et l’email de la deuxième personne.';
    end if;

    if lower(trim(p_email)) = v_primary_email then
      raise exception 'La deuxième personne doit disposer d’une adresse email personnelle différente.';
    end if;

    if v_spouse is null then
      insert into public.investisseurs(
        foyer_id, civilite, prenom, nom, email, mobile
      )
      values(
        v_foyer,
        nullif(trim(p_civilite), ''),
        trim(p_prenom),
        trim(p_nom),
        lower(trim(p_email)),
        nullif(trim(p_mobile), '')
      )
      returning id into v_spouse;

      insert into public.dossier_investisseurs(
        dossier_id, investisseur_id, role_dossier, esg_status
      )
      values(
        p_dossier_id, v_spouse, 'investisseur_2', 'not_applicable'
      );
    elsif v_spouse_auth is null then
      -- Avant activation, l'Identifiant 1 peut corriger une erreur de saisie.
      update public.investisseurs
         set civilite = nullif(trim(p_civilite), ''),
             prenom = trim(p_prenom),
             nom = trim(p_nom),
             email = lower(trim(p_email)),
             mobile = nullif(trim(p_mobile), ''),
             updated_at = now()
       where id = v_spouse;
    end if;

    -- Les données strictement communes du foyer sont recopiées pour éviter une
    -- seconde saisie et garantir une lecture cohérente côté conseiller.
    select rs.payload
      into v_family_payload
    from public.recueil_sections rs
    where rs.dossier_id = p_dossier_id
      and rs.investisseur_id = v_primary
      and rs.section_code = 'family'
    limit 1;

    if v_family_payload is not null then
      insert into public.recueil_sections(
        dossier_id, investisseur_id, section_code, payload, completed_at
      )
      values(
        p_dossier_id, v_spouse, 'family', v_family_payload, now()
      )
      on conflict(dossier_id, investisseur_id, section_code) do update
        set payload = excluded.payload,
            completed_at = coalesce(public.recueil_sections.completed_at, excluded.completed_at),
            updated_at = now();
    end if;

    -- L'adresse fiscale du foyer est préremplie pour l'Identifiant 2. Les
    -- autres données d'identité restent personnelles et doivent être validées
    -- depuis son propre accès.
    select coalesce(rs.payload->'address', '{}'::jsonb)
      into v_primary_address
    from public.recueil_sections rs
    where rs.dossier_id = p_dossier_id
      and rs.investisseur_id = v_primary
      and rs.section_code = 'identity'
    limit 1;

    v_identity_payload := jsonb_build_object(
      'civilite', coalesce(p_civilite, ''),
      'prenom', coalesce(p_prenom, ''),
      'nom', coalesce(p_nom, ''),
      'mobile', coalesce(p_mobile, ''),
      'pays_naissance', 'France',
      'nationalite', 'Française',
      'address', coalesce(v_primary_address, '{}'::jsonb)
    );

    insert into public.recueil_sections(
      dossier_id, investisseur_id, section_code, payload, completed_at
    )
    values(
      p_dossier_id, v_spouse, 'identity', v_identity_payload, null
    )
    on conflict(dossier_id, investisseur_id, section_code) do nothing;

    return jsonb_build_object(
      'couple', true,
      'spouse_id', v_spouse,
      'spouse_activated', v_spouse_auth is not null,
      'spouse_needs_invite', v_spouse_auth is null
    );
  end if;

  if v_spouse is not null then
    -- Ne jamais supprimer silencieusement une personne qui a déjà commencé son
    -- parcours ou reçu une invitation : cela créerait des données orphelines.
    select (
      v_spouse_auth is not null
      or exists(
        select 1 from public.questionnaire_sessions qs
        where qs.dossier_id = p_dossier_id and qs.investisseur_id = v_spouse
      )
      or exists(
        select 1 from public.client_invites ci
        where ci.dossier_id = p_dossier_id and ci.investisseur_id = v_spouse
      )
      or exists(
        select 1 from public.validations v
        where v.dossier_id = p_dossier_id and v.investisseur_id = v_spouse
      )
      or exists(
        select 1 from public.recueil_sections rs
        where rs.dossier_id = p_dossier_id
          and rs.investisseur_id = v_spouse
          and rs.section_code not in ('identity', 'family')
      )
    ) into v_has_activity;

    if coalesce(v_has_activity, false) then
      raise exception 'La deuxième personne a déjà été invitée ou a commencé son parcours. Le passage en dossier individuel doit être traité par le cabinet afin de préserver la traçabilité.';
    end if;

    delete from public.recueil_sections
     where dossier_id = p_dossier_id and investisseur_id = v_spouse;

    delete from public.dossier_investisseurs
     where dossier_id = p_dossier_id and investisseur_id = v_spouse;

    delete from public.investisseurs
     where id = v_spouse;

    v_spouse := null;
  end if;

  return jsonb_build_object('couple', false, 'spouse_id', v_spouse);
end;
$function$;
