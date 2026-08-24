alter table public.biens_immobiliers
  add column if not exists type_bien text,
  add column if not exists proprietaire text,
  add column if not exists ville text,
  add column if not exists annee_acquisition integer,
  add column if not exists loyer_hors_charges_annuel numeric;

create or replace function public.save_my_recueil_section(
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
  v_auth_email text;
  v_investisseur_id uuid;
  v_role text;
  v_status text;
  v_date_text text;
  v_item jsonb;
  v_year int;
  v_annual_rent numeric;
begin
  if v_uid is null then raise exception 'Authentification requise'; end if;
  p_payload := coalesce(p_payload,'{}'::jsonb);

  select i.id, di.role_dossier, di.recueil_status
    into v_investisseur_id, v_role, v_status
  from public.investisseurs i
  join public.dossier_investisseurs di on di.investisseur_id = i.id
  where di.dossier_id = p_dossier_id and i.auth_user_id = v_uid
  limit 1;
  if v_investisseur_id is null then raise exception 'Accès refusé'; end if;
  if v_status = 'validated' then raise exception 'Votre recueil est déjà validé et ne peut plus être modifié'; end if;

  if p_section_code = 'identity' then
    if lower(trim(coalesce(p_payload->>'civilite',''))) in ('mme','madame')
       and nullif(trim(coalesce(p_payload->>'nom_naissance','')), '') is null then
      raise exception 'Indiquez votre nom de naissance. Ce champ est obligatoire lorsque la civilité est Mme.';
    end if;

    select u.email into v_auth_email from auth.users u where u.id = v_uid;
    perform private.assert_valid_contact(p_payload->>'mobile', v_auth_email);

    update public.investisseurs
       set email = lower(trim(v_auth_email)), updated_at = now()
     where id = v_investisseur_id;
  end if;

  if p_section_code = 'professional' then
    v_date_text := trim(coalesce(p_payload->>'date_entree',''));
    if v_date_text <> '' then
      if v_date_text ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
        p_payload := jsonb_set(p_payload, '{date_entree}', to_jsonb(v_date_text || '-01'));
      elsif v_date_text ~ '^[0-9]{4}-(0[1-9]|1[0-2])-01$' then
        null;
      else
        raise exception 'Sélectionnez une date d’entrée valide en choisissant le mois et l’année.';
      end if;
    end if;
  end if;

  if p_section_code = 'patrimony' then
    delete from public.biens_immobiliers
     where dossier_id = p_dossier_id and portee = v_role;

    if jsonb_typeof(p_payload->'immobilier') = 'array' then
      for v_item in select value from jsonb_array_elements(p_payload->'immobilier') loop
        if nullif(trim(v_item->>'intitule'),'') is not null then
          v_year := null;
          if nullif(trim(v_item->>'date_acquisition'),'') is not null then
            if trim(v_item->>'date_acquisition') !~ '^[0-9]{4}$' then
              raise exception 'L’année d’acquisition doit comporter 4 chiffres.';
            end if;
            v_year := (v_item->>'date_acquisition')::int;
            if v_year < 1800 or v_year > extract(year from current_date)::int then
              raise exception 'L’année d’acquisition doit être comprise entre 1800 et l’année en cours.';
            end if;
          end if;

          v_annual_rent := nullif(trim(v_item->>'loyer_annuel'),'')::numeric;

          insert into public.biens_immobiliers(
            dossier_id, portee, libelle, adresse, valeur_acquisition, valeur_actuelle,
            date_acquisition, loyer_hors_charges_mensuel, mode_detention, quote_part,
            usage_bien, commentaire, type_bien, proprietaire, ville,
            annee_acquisition, loyer_hors_charges_annuel
          ) values (
            p_dossier_id,
            v_role,
            trim(v_item->>'intitule'),
            nullif(trim(v_item->>'ville'),''),
            nullif(trim(v_item->>'prix_acquisition'),'')::numeric,
            nullif(trim(v_item->>'valeur_actuelle'),'')::numeric,
            case when v_year is null then null else make_date(v_year,1,1) end,
            case when v_annual_rent is null then null else round(v_annual_rent / 12, 2) end,
            nullif(trim(v_item->>'mode_detention'),''),
            nullif(trim(v_item->>'quote_part'),'')::numeric,
            nullif(trim(v_item->>'usage'),''),
            nullif(v_item->>'commentaire',''),
            nullif(trim(v_item->>'type_bien'),''),
            nullif(trim(v_item->>'proprietaire'),''),
            nullif(trim(v_item->>'ville'),''),
            v_year,
            v_annual_rent
          );
        end if;
      end loop;
    end if;

    insert into public.recueil_sections(dossier_id,investisseur_id,section_code,payload,completed_at)
    values(p_dossier_id,v_investisseur_id,p_section_code,p_payload,case when p_completed then now() else null end)
    on conflict(dossier_id,investisseur_id,section_code) do update
      set payload = excluded.payload,
          completed_at = case when p_completed then now() else public.recueil_sections.completed_at end,
          updated_at = now();

    update public.dossier_investisseurs
       set recueil_status='in_progress', updated_at=now()
     where dossier_id=p_dossier_id and investisseur_id=v_investisseur_id and recueil_status<>'validated';
    return;
  end if;

  perform private.save_my_recueil_section_core(p_dossier_id,p_section_code,p_payload,p_completed);
end;
$function$;
