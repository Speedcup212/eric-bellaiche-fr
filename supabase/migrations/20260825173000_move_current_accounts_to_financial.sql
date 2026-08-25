create or replace function private.validate_financial_recueil_payload()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_categories jsonb := new.payload->'categories';
  v_has_none boolean;
  v_has_other boolean;
  v_current_accounts_amount text := replace(trim(coalesce(new.payload->>'current_accounts_amount', '')), ',', '.');
begin
  if new.section_code <> 'financial' or new.completed_at is null then
    return new;
  end if;

  if v_current_accounts_amount = '' or v_current_accounts_amount !~ '^[0-9]+([.][0-9]{1,2})?$' then
    raise exception 'Indiquez un montant valide, positif ou nul, pour les comptes courants.';
  end if;

  if jsonb_typeof(v_categories) <> 'array' or jsonb_array_length(v_categories) = 0 then
    raise exception 'Sélectionnez au moins une catégorie de placement ou indiquez que vous ne détenez aucun placement.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(v_categories) as item(value)
    where item.value not in ('savings','life_insurance','retirement','securities','paper_real_estate','employee_savings','other','none')
  ) then
    raise exception 'Une catégorie de placement sélectionnée est invalide.';
  end if;

  select exists(select 1 from jsonb_array_elements_text(v_categories) as item(value) where item.value = 'none'),
         exists(select 1 from jsonb_array_elements_text(v_categories) as item(value) where item.value = 'other')
    into v_has_none, v_has_other;

  if v_has_none and jsonb_array_length(v_categories) <> 1 then
    raise exception 'Le choix « Aucun placement » ne peut pas être associé à une autre catégorie.';
  end if;
  if v_has_other and nullif(trim(coalesce(new.payload->>'other_details', '')), '') is null then
    raise exception 'Précisez la nature de vos autres placements.';
  end if;
  if not v_has_none and coalesce(new.payload->>'total_band', '') not in ('under_10k','10k_50k','50k_100k','100k_250k','250k_500k','over_500k') then
    raise exception 'Indiquez une fourchette valide pour l’encours total des placements.';
  end if;
  if lower(trim(coalesce(new.payload->>'completeness_confirmed', ''))) <> 'true' then
    raise exception 'Confirmez que la déclaration couvre l’ensemble de vos comptes courants et placements.';
  end if;

  return new;
end;
$function$;

revoke all on function private.validate_financial_recueil_payload() from public, anon, authenticated;

create or replace function private.sync_document_financial_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_has_financial_assets boolean;
begin
  select exists(
           select 1 from jsonb_array_elements_text(coalesce(new.payload->'categories', '[]'::jsonb)) as item(value)
           where item.value in ('savings','life_insurance','retirement','securities','paper_real_estate','employee_savings','other')
         )
    into v_has_financial_assets;

  insert into public.document_context_answers(
    dossier_id, investisseur_id, has_liquidities, has_financial_assets, updated_at
  ) values (
    new.dossier_id, new.investisseur_id, false, v_has_financial_assets, now()
  )
  on conflict(dossier_id, investisseur_id) do update
    set has_liquidities = false,
        has_financial_assets = excluded.has_financial_assets,
        updated_at = now();

  return new;
end;
$function$;

revoke all on function private.sync_document_financial_context() from public, anon, authenticated;

update public.document_context_answers
set has_liquidities = false,
    updated_at = now()
where has_liquidities is distinct from false;

create or replace function private.complete_my_documents_core(p_dossier_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_investisseur_id uuid;
  v_count integer;
  v_total integer;
  v_ready integer;
  v_context_ready integer;
  v_identity_count integer;
  v_required_tax boolean;
  v_required_assets boolean;
  v_required_real_estate boolean;
  v_required_credits boolean;
  v_required_sci boolean;
  v_now timestamptz := now();
  v_progress jsonb;
begin
  if v_uid is null then raise exception 'Authentification requise'; end if;
  select i.id into v_investisseur_id
  from public.investisseurs i
  join public.dossier_investisseurs di on di.investisseur_id=i.id
  where di.dossier_id=p_dossier_id and i.auth_user_id=v_uid
  limit 1;
  if v_investisseur_id is null then raise exception 'Accès refusé'; end if;

  select count(*), count(*) filter(where di.recueil_status='validated' and di.qpi_status in ('completed','validated') and (di.esg_opt_in is not true or di.esg_status in ('completed','validated')))
    into v_total,v_ready
  from public.dossier_investisseurs di
  where di.dossier_id=p_dossier_id;

  if v_total=0 or v_ready<>v_total then
    raise exception 'Le dossier ne peut pas encore être transmis : chaque personne doit avoir terminé son recueil, son profil investisseur et, le cas échéant, ses préférences de durabilité.';
  end if;

  select count(*) into v_context_ready
  from public.document_context_answers dca
  where dca.dossier_id=p_dossier_id
    and dca.tax_status is not null
    and dca.has_financial_assets is not null
    and dca.has_real_estate is not null
    and dca.has_credits is not null
    and dca.has_sci_company is not null
    and (
      dca.tax_status <> 'no_personal_notice'
      or (
        dca.tax_absence_reason is not null
        and (dca.tax_absence_reason <> 'other' or nullif(btrim(dca.tax_absence_other),'') is not null)
      )
    );

  if v_context_ready<>v_total then
    raise exception 'Chaque personne du dossier doit préciser sa situation documentaire et, en l’absence d’avis d’imposition, le motif correspondant.';
  end if;

  select count(distinct ds.investisseur_id) into v_identity_count
  from public.documents_sources ds
  join public.dossier_investisseurs di on di.dossier_id=p_dossier_id and di.investisseur_id=ds.investisseur_id
  where ds.dossier_id=p_dossier_id and ds.categorie='identite';
  if v_identity_count<v_total then raise exception 'Ajoutez une pièce d’identité pour chaque personne du dossier.'; end if;

  if not exists(select 1 from public.documents_sources ds where ds.dossier_id=p_dossier_id and ds.categorie='justificatif_domicile') then
    raise exception 'Ajoutez au moins un justificatif de domicile pour le dossier.';
  end if;

  select bool_or(dca.tax_status='personal_notice'), bool_or(dca.has_financial_assets), bool_or(dca.has_real_estate), bool_or(dca.has_credits), bool_or(dca.has_sci_company)
  into v_required_tax,v_required_assets,v_required_real_estate,v_required_credits,v_required_sci
  from public.document_context_answers dca where dca.dossier_id=p_dossier_id;

  if coalesce(v_required_tax,false) and not exists(select 1 from public.documents_sources ds where ds.dossier_id=p_dossier_id and ds.categorie='avis_imposition') then raise exception 'Ajoutez l’avis d’imposition indiqué comme disponible.'; end if;
  if coalesce(v_required_assets,false) and not exists(select 1 from public.documents_sources ds where ds.dossier_id=p_dossier_id and ds.categorie='patrimoine_financier') then raise exception 'Ajoutez un relevé d’épargne ou de placement.'; end if;
  if coalesce(v_required_real_estate,false) and not exists(select 1 from public.documents_sources ds where ds.dossier_id=p_dossier_id and ds.categorie='patrimoine_immobilier') then raise exception 'Ajoutez un justificatif de patrimoine immobilier.'; end if;
  if coalesce(v_required_credits,false) and not exists(select 1 from public.documents_sources ds where ds.dossier_id=p_dossier_id and ds.categorie='tableau_amortissement') then raise exception 'Ajoutez le tableau d’amortissement ou le justificatif du crédit en cours.'; end if;
  if coalesce(v_required_sci,false) and not exists(select 1 from public.documents_sources ds where ds.dossier_id=p_dossier_id and ds.categorie='sci_societe') then raise exception 'Ajoutez les documents utiles concernant la SCI ou la société.'; end if;

  select count(*) into v_count from public.documents_sources ds where ds.dossier_id=p_dossier_id;
  if v_count=0 then raise exception 'Transmettez au moins un document avant de terminer cette étape.'; end if;

  select jsonb_build_object('dossier_id',p_dossier_id,'members_total',v_total,'members_ready',v_ready,'document_context_ready',v_context_ready,'documents_count',v_count,'required',jsonb_build_object('identity_count',v_total,'domicile',true,'tax',coalesce(v_required_tax,false),'liquidities',false,'financial_assets',coalesce(v_required_assets,false),'real_estate',coalesce(v_required_real_estate,false),'credits',coalesce(v_required_credits,false),'sci_company',coalesce(v_required_sci,false)),'transmitted_at',v_now)
  into v_progress;

  update public.dossier_investisseurs set documents_status='completed',documents_completed_at=v_now,transmitted_at=v_now,transmission_snapshot=v_progress,updated_at=v_now where dossier_id=p_dossier_id;

  insert into public.validations(dossier_id,investisseur_id,objet_type,objet_id,type_validation,statut,methode,commentaire,valide_par,validated_at)
  values(p_dossier_id,v_investisseur_id,'dossier',p_dossier_id,'transmission_finale_dossier','accepted','parcours_securise','Transmission finale du dossier commun après complétion de tous les parcours individuels et contrôle des justificatifs attendus',v_uid,v_now);
end;
$function$;

revoke all on function private.complete_my_documents_core(uuid) from public, anon, authenticated;
