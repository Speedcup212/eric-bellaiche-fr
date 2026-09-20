-- One authoritative recueil completeness engine + document ownership scope.
alter table public.documents_sources
  add column if not exists portee_document text not null default 'auto',
  add column if not exists concerne_investisseur_ids uuid[] not null default '{}'::uuid[];

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.documents_sources'::regclass
      and conname='documents_sources_portee_document_check'
  ) then
    alter table public.documents_sources
      add constraint documents_sources_portee_document_check
      check (portee_document in ('auto','investisseur','foyer'));
  end if;
end $$;

update public.documents_sources
set concerne_investisseur_ids = case
  when investisseur_id is null then '{}'::uuid[]
  else array[investisseur_id]
end
where cardinality(concerne_investisseur_ids)=0;

CREATE OR REPLACE FUNCTION private.recueil_section_missing_fields(p_section_code text, p_payload jsonb, p_role text, p_is_couple boolean)
 RETURNS text[]
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  v_missing text[] := '{}'::text[];
  v_situation text := lower(trim(coalesce(p_payload->>'situation','')));
  v_status text := lower(trim(coalesce(p_payload->>'statut','')));
  v_item jsonb;
  v_categories jsonb := coalesce(p_payload->'categories','[]'::jsonb);
  v_children jsonb := coalesce(p_payload->'enfants','[]'::jsonb);
  v_address jsonb := coalesce(p_payload->'address','{}'::jsonb);
  v_current_intent text := coalesce(p_payload->>'current_accounts_intentional','');
  v_has_real_estate text := coalesce(p_payload->>'has_real_estate','');
  v_has_credits text := coalesce(p_payload->>'has_credits','');
begin
  p_payload := coalesce(p_payload,'{}'::jsonb);

  if p_section_code='identity' then
    if nullif(trim(p_payload->>'civilite'),'') is null then v_missing:=array_append(v_missing,'civilite'); end if;
    if nullif(trim(p_payload->>'prenom'),'') is null then v_missing:=array_append(v_missing,'prenom'); end if;
    if nullif(trim(p_payload->>'nom'),'') is null then v_missing:=array_append(v_missing,'nom'); end if;
    if nullif(trim(p_payload->>'date_naissance'),'') is null then v_missing:=array_append(v_missing,'date_naissance'); end if;
    if nullif(trim(p_payload->>'lieu_naissance'),'') is null then v_missing:=array_append(v_missing,'lieu_naissance'); end if;
    if nullif(trim(p_payload->>'pays_naissance'),'') is null then v_missing:=array_append(v_missing,'pays_naissance'); end if;
    if nullif(trim(p_payload->>'nationalite'),'') is null then v_missing:=array_append(v_missing,'nationalite'); end if;
    if nullif(trim(p_payload->>'mobile'),'') is null then v_missing:=array_append(v_missing,'mobile'); end if;
    if lower(trim(coalesce(p_payload->>'civilite',''))) in ('mme','madame')
       and nullif(trim(p_payload->>'nom_naissance'),'') is null
    then v_missing:=array_append(v_missing,'nom_naissance'); end if;
    if nullif(trim(v_address->>'numero_voie'),'') is null then v_missing:=array_append(v_missing,'address.numero_voie'); end if;
    if nullif(trim(v_address->>'code_postal'),'') is null then v_missing:=array_append(v_missing,'address.code_postal'); end if;
    if nullif(trim(v_address->>'ville'),'') is null then v_missing:=array_append(v_missing,'address.ville'); end if;
    if nullif(trim(v_address->>'pays'),'') is null then v_missing:=array_append(v_missing,'address.pays'); end if;
    if nullif(trim(v_address->>'type_logement'),'') is null then v_missing:=array_append(v_missing,'address.type_logement'); end if;

  elsif p_section_code='family' then
    if nullif(trim(p_payload->>'situation'),'') is null then v_missing:=array_append(v_missing,'situation'); end if;
    if (v_situation like '%mari%' or v_situation like '%pacs%' or v_situation like '%divorc%')
       and nullif(trim(p_payload->>'date_evenement'),'') is null
    then v_missing:=array_append(v_missing,'date_evenement'); end if;
    if (v_situation like '%mari%' or v_situation like '%pacs%')
       and nullif(trim(p_payload->>'regime_convention'),'') is null
    then v_missing:=array_append(v_missing,'regime_convention'); end if;
    if v_situation like '%mari%'
       and nullif(trim(p_payload->>'avantage_matrimonial'),'') is null
    then v_missing:=array_append(v_missing,'avantage_matrimonial'); end if;
    if jsonb_typeof(v_children)='array' then
      for v_item in select value from jsonb_array_elements(v_children) loop
        if nullif(trim(v_item->>'prenom'),'') is null
           or nullif(trim(v_item->>'nom'),'') is null
           or nullif(trim(v_item->>'annee_naissance'),'') is null
        then
          v_missing:=array_append(v_missing,'enfants');
          exit;
        end if;
      end loop;
    end if;

  elsif p_section_code='professional' then
    if nullif(trim(p_payload->>'profession_actuelle'),'') is null then v_missing:=array_append(v_missing,'profession_actuelle'); end if;
    if nullif(trim(p_payload->>'secteur_activite'),'') is null then v_missing:=array_append(v_missing,'secteur_activite'); end if;
    if nullif(trim(p_payload->>'statut'),'') is null then v_missing:=array_append(v_missing,'statut'); end if;
    if not (v_status like '%retrait%' or v_status like '%sans activit%' or v_status like '%étudiant%' or v_status like '%etudiant%') then
      if nullif(trim(p_payload->>'societe'),'') is null then v_missing:=array_append(v_missing,'societe'); end if;
      if nullif(trim(p_payload->>'date_entree'),'') is null then v_missing:=array_append(v_missing,'date_entree'); end if;
    end if;
    if (v_status like '%sans activit%') and nullif(trim(p_payload->>'origine_revenus_sans_activite'),'') is null
      then v_missing:=array_append(v_missing,'origine_revenus_sans_activite'); end if;
    if not (v_status like '%retrait%') and coalesce(p_payload->>'changement_professionnel_prevu','') not in ('true','false')
      then v_missing:=array_append(v_missing,'changement_professionnel_prevu'); end if;
    if coalesce(p_payload->>'changement_professionnel_prevu','')='true'
       and nullif(trim(p_payload->>'changement_professionnel_details'),'') is null
      then v_missing:=array_append(v_missing,'changement_professionnel_details'); end if;

  elsif p_section_code='objectives' then
    if jsonb_typeof(coalesce(p_payload->'items','null'::jsonb))<>'array'
       or jsonb_array_length(coalesce(p_payload->'items','[]'::jsonb))=0
    then
      v_missing:=array_append(v_missing,'items');
    else
      for v_item in select value from jsonb_array_elements(p_payload->'items') loop
        if nullif(trim(v_item->>'horizon_annees'),'') is null then
          v_missing:=array_append(v_missing,'items.horizon_annees');
          exit;
        end if;
        if coalesce(v_item->>'code_objectif','')='autre'
           and nullif(trim(v_item->>'libelle_autre'),'') is null then
          v_missing:=array_append(v_missing,'items.libelle_autre');
          exit;
        end if;
      end loop;
    end if;

  elsif p_section_code='capacity' then
    if nullif(trim(p_payload->>'estimation_revenus_travail_annuels'),'') is null then v_missing:=array_append(v_missing,'estimation_revenus_travail_annuels'); end if;
    if nullif(trim(p_payload->>'estimation_revenus_fonciers_annuels'),'') is null then v_missing:=array_append(v_missing,'estimation_revenus_fonciers_annuels'); end if;
    if nullif(trim(p_payload->>'epargne_precaution_cible'),'') is null then v_missing:=array_append(v_missing,'epargne_precaution_cible'); end if;
    if nullif(trim(p_payload->>'capacite_epargne_mensuelle'),'') is null then v_missing:=array_append(v_missing,'capacite_epargne_mensuelle'); end if;

  elsif p_section_code='tax' then
    if nullif(trim(p_payload->>'annee_imposition'),'') is null then v_missing:=array_append(v_missing,'annee_imposition'); end if;
    if nullif(trim(p_payload->>'revenu_imposable'),'') is null then v_missing:=array_append(v_missing,'revenu_imposable'); end if;
    if nullif(trim(p_payload->>'revenu_fiscal_reference'),'') is null then v_missing:=array_append(v_missing,'revenu_fiscal_reference'); end if;
    if nullif(trim(p_payload->>'nombre_parts'),'') is null then v_missing:=array_append(v_missing,'nombre_parts'); end if;
    if nullif(trim(p_payload->>'tmi'),'') is null then v_missing:=array_append(v_missing,'tmi'); end if;
    if nullif(trim(p_payload->>'impot_revenu_net'),'') is null then v_missing:=array_append(v_missing,'impot_revenu_net'); end if;
    if coalesce(p_payload->>'ifi_concerne','false')='true' then
      if nullif(trim(p_payload->>'ifi_base_imposable'),'') is null then v_missing:=array_append(v_missing,'ifi_base_imposable'); end if;
      if nullif(trim(p_payload->>'ifi_net_a_payer'),'') is null then v_missing:=array_append(v_missing,'ifi_net_a_payer'); end if;
    end if;

  elsif p_section_code='regulatory' then
    if nullif(trim(p_payload->>'pays_residence_fiscale'),'') is null then v_missing:=array_append(v_missing,'pays_residence_fiscale'); end if;
    if coalesce(p_payload->>'citoyen_ou_resident_us','') not in ('true','false') then v_missing:=array_append(v_missing,'citoyen_ou_resident_us'); end if;
    if coalesce(p_payload->>'sanctions_declarees','') not in ('true','false') then v_missing:=array_append(v_missing,'sanctions_declarees'); end if;
    if coalesce(p_payload->>'ppe_declaree','') not in ('true','false') then v_missing:=array_append(v_missing,'ppe_declaree'); end if;
    if coalesce(p_payload->>'esg_opt_in','') not in ('true','false') then v_missing:=array_append(v_missing,'esg_opt_in'); end if;
    if coalesce(p_payload->>'citoyen_ou_resident_us','')='true' and nullif(trim(p_payload->>'code_tin'),'') is null then v_missing:=array_append(v_missing,'code_tin'); end if;
    if coalesce(p_payload->>'sanctions_declarees','')='true' and nullif(trim(p_payload->>'commentaire_lcbft'),'') is null then v_missing:=array_append(v_missing,'commentaire_lcbft'); end if;
    if coalesce(p_payload->>'ppe_declaree','')='true' then
      if nullif(trim(p_payload->>'ppe_personne_exposee'),'') is null then v_missing:=array_append(v_missing,'ppe_personne_exposee'); end if;
      if nullif(trim(p_payload->>'ppe_motif'),'') is null then v_missing:=array_append(v_missing,'ppe_motif'); end if;
      if nullif(trim(p_payload->>'ppe_pays_exercice'),'') is null then v_missing:=array_append(v_missing,'ppe_pays_exercice'); end if;
      if nullif(trim(p_payload->>'ppe_anciennete'),'') is null then v_missing:=array_append(v_missing,'ppe_anciennete'); end if;
    end if;

  elsif p_section_code='patrimony' then
    if v_has_real_estate not in ('true','false') then
      v_missing:=array_append(v_missing,'has_real_estate');
    elsif v_has_real_estate='true' then
      if jsonb_typeof(coalesce(p_payload->'immobilier','null'::jsonb))<>'array'
         or jsonb_array_length(coalesce(p_payload->'immobilier','[]'::jsonb))=0 then
        v_missing:=array_append(v_missing,'immobilier');
      else
        for v_item in select value from jsonb_array_elements(p_payload->'immobilier') loop
          if nullif(trim(v_item->>'type_bien'),'') is null
             or nullif(trim(v_item->>'usage'),'') is null
             or nullif(trim(v_item->>'proprietaire'),'') is null
             or nullif(trim(v_item->>'projet_bien'),'') is null
             or nullif(trim(v_item->>'valeur_actuelle'),'') is null
             or nullif(trim(v_item->>'ville'),'') is null
          then
            v_missing:=array_append(v_missing,'immobilier.champs_essentiels');
            exit;
          end if;
          if coalesce(v_item->>'usage','')='Locatif'
             and nullif(trim(coalesce(v_item->>'loyer_mensuel',v_item->>'loyer_annuel')),'') is null
          then
            v_missing:=array_append(v_missing,'immobilier.loyer');
            exit;
          end if;
        end loop;
      end if;
    end if;

  elsif p_section_code='financial' then
    if v_current_intent not in ('true','false') then v_missing:=array_append(v_missing,'current_accounts_intentional'); end if;
    if v_current_intent='true' and nullif(trim(p_payload->>'current_accounts_amount'),'') is null then v_missing:=array_append(v_missing,'current_accounts_amount'); end if;
    if jsonb_typeof(v_categories)<>'array' or jsonb_array_length(v_categories)=0 then v_missing:=array_append(v_missing,'categories'); end if;
    if jsonb_typeof(v_categories)='array'
       and not (v_categories ? 'none')
       and nullif(trim(p_payload->>'total_band'),'') is null
    then v_missing:=array_append(v_missing,'total_band'); end if;
    if coalesce(p_payload->>'completeness_confirmed','') <> 'true' then v_missing:=array_append(v_missing,'completeness_confirmed'); end if;

  elsif p_section_code='credits' then
    if v_has_credits not in ('true','false') then
      v_missing:=array_append(v_missing,'has_credits');
    elsif v_has_credits='true' then
      if jsonb_typeof(coalesce(p_payload->'items','null'::jsonb))<>'array'
         or jsonb_array_length(coalesce(p_payload->'items','[]'::jsonb))=0 then
        v_missing:=array_append(v_missing,'items');
      else
        for v_item in select value from jsonb_array_elements(p_payload->'items') loop
          if nullif(trim(v_item->>'type_credit'),'') is null
             or nullif(trim(v_item->>'taux_credit'),'') is null
             or nullif(trim(v_item->>'credit_rattache_a'),'') is null
          then
            v_missing:=array_append(v_missing,'items.champs_essentiels');
            exit;
          end if;
          if p_is_couple and p_role='investisseur_1'
             and nullif(trim(v_item->>'emprunteur'),'') is null
          then
            v_missing:=array_append(v_missing,'items.emprunteur');
            exit;
          end if;
        end loop;
      end if;
    end if;
  end if;

  return v_missing;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.recueil_completeness_core(p_dossier_id uuid, p_investisseur_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text;
  v_recueil_status text;
  v_member_count integer;
  v_is_couple boolean;
  v_code text;
  v_payload jsonb;
  v_missing text[];
  v_sections jsonb := '[]'::jsonb;
  v_complete_count integer := 0;
  v_total integer := 10;
  v_percentage integer;
  v_primary_id uuid;
  v_source_updated_at timestamptz;
  v_shared_ok boolean;
begin
  select di.role_dossier,di.recueil_status
  into v_role,v_recueil_status
  from public.dossier_investisseurs di
  where di.dossier_id=p_dossier_id and di.investisseur_id=p_investisseur_id;

  if v_role is null then raise exception 'Investisseur non rattaché au dossier'; end if;

  select count(*) into v_member_count
  from public.dossier_investisseurs
  where dossier_id=p_dossier_id;
  v_is_couple := v_member_count>1;

  select investisseur_id into v_primary_id
  from public.dossier_investisseurs
  where dossier_id=p_dossier_id and role_dossier='investisseur_1'
  limit 1;

  foreach v_code in array array[
    'identity','family','professional','objectives','capacity',
    'tax','patrimony','financial','credits','regulatory'
  ]
  loop
    v_payload := '{}'::jsonb;
    v_missing := '{}'::text[];
    v_shared_ok := false;

    if v_role='investisseur_2' and v_code in ('family','patrimony','credits') then
      select rs.payload,rs.updated_at
      into v_payload,v_source_updated_at
      from public.recueil_sections rs
      where rs.dossier_id=p_dossier_id
        and rs.investisseur_id=v_primary_id
        and rs.section_code=v_code
      limit 1;

      if v_payload is null then
        v_missing:=array['section_foyer_absente'];
      else
        select exists(
          select 1
          from public.household_section_confirmations hc
          where hc.dossier_id=p_dossier_id
            and hc.confirmer_investisseur_id=p_investisseur_id
            and hc.source_investisseur_id=v_primary_id
            and hc.section_code=v_code
            and hc.status='confirmed'
            and hc.source_updated_at>=v_source_updated_at
        ) into v_shared_ok;

        if not v_shared_ok then
          v_missing:=array['confirmation_foyer'];
        end if;
      end if;

      v_sections := v_sections || jsonb_build_array(jsonb_build_object(
        'section_code',v_code,
        'complete',cardinality(v_missing)=0,
        'missing_fields',to_jsonb(v_missing),
        'source','foyer'
      ));
    else
      select rs.payload into v_payload
      from public.recueil_sections rs
      where rs.dossier_id=p_dossier_id
        and rs.investisseur_id=p_investisseur_id
        and rs.section_code=v_code
      limit 1;

      if v_payload is null then
        v_missing:=array['section_absente'];
      else
        v_missing:=private.recueil_section_missing_fields(v_code,v_payload,v_role,v_is_couple);
      end if;

      v_sections := v_sections || jsonb_build_array(jsonb_build_object(
        'section_code',v_code,
        'complete',cardinality(v_missing)=0,
        'missing_fields',to_jsonb(v_missing),
        'source','individuel'
      ));
    end if;

    if cardinality(v_missing)=0 then v_complete_count:=v_complete_count+1; end if;
  end loop;

  v_percentage := round((v_complete_count::numeric / v_total::numeric) * 100)::int;

  return jsonb_build_object(
    'dossier_id',p_dossier_id,
    'investisseur_id',p_investisseur_id,
    'role_dossier',v_role,
    'percentage',v_percentage,
    'complete',v_complete_count=v_total,
    'complete_sections',v_complete_count,
    'total_sections',v_total,
    'sections',v_sections,
    'recueil_status',v_recueil_status,
    'validated_with_current_gaps',(v_recueil_status='validated' and v_complete_count<v_total)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_recueil_completeness(p_dossier_id uuid, p_investisseur_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not (select private.has_dossier_access(p_dossier_id))
     and not (select private.is_staff())
  then
    raise exception 'Accès refusé';
  end if;
  return private.recueil_completeness_core(p_dossier_id,p_investisseur_id);
end;
$function$
;
grant execute on function public.get_recueil_completeness(uuid,uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.get_all_recueil_completeness()
 RETURNS TABLE(dossier_id uuid, investisseur_id uuid, percentage integer, complete boolean, details jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not (select private.is_staff()) then raise exception 'Accès réservé au cabinet'; end if;
  return query
  select di.dossier_id,di.investisseur_id,
         (private.recueil_completeness_core(di.dossier_id,di.investisseur_id)->>'percentage')::int,
         (private.recueil_completeness_core(di.dossier_id,di.investisseur_id)->>'complete')::boolean,
         private.recueil_completeness_core(di.dossier_id,di.investisseur_id)
  from public.dossier_investisseurs di;
end;
$function$
;
grant execute on function public.get_all_recueil_completeness() to authenticated;

CREATE OR REPLACE FUNCTION public.register_source_document_v2(p_dossier_id uuid, p_investisseur_id uuid, p_categorie text, p_nom_fichier text, p_storage_path text, p_portee_document text DEFAULT 'investisseur'::text, p_concerne_investisseur_ids uuid[] DEFAULT NULL::uuid[], p_date_document date DEFAULT NULL::date, p_annee_reference integer DEFAULT NULL::integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid;
  v_uid uuid := (select auth.uid());
  v_concernes uuid[];
begin
  if v_uid is null then raise exception 'Authentification requise'; end if;
  if not (select private.has_dossier_access(p_dossier_id)) then raise exception 'Accès refusé'; end if;
  if p_portee_document not in ('auto','investisseur','foyer') then raise exception 'Portée documentaire invalide'; end if;
  if p_investisseur_id is not null and not exists(
    select 1 from public.dossier_investisseurs di
    where di.dossier_id=p_dossier_id and di.investisseur_id=p_investisseur_id
  ) then raise exception 'Investisseur non rattaché au dossier'; end if;
  if split_part(p_storage_path,'/',1) <> p_dossier_id::text then raise exception 'Chemin de stockage invalide'; end if;

  if p_portee_document='foyer' then
    select array_agg(investisseur_id order by role_dossier)
    into v_concernes
    from public.dossier_investisseurs
    where dossier_id=p_dossier_id;
  else
    v_concernes := coalesce(p_concerne_investisseur_ids,
      case when p_investisseur_id is null then '{}'::uuid[] else array[p_investisseur_id] end);
  end if;

  if exists(
    select 1 from unnest(coalesce(v_concernes,'{}'::uuid[])) x
    where not exists(
      select 1 from public.dossier_investisseurs di
      where di.dossier_id=p_dossier_id and di.investisseur_id=x
    )
  ) then
    raise exception 'Un destinataire documentaire ne fait pas partie du dossier';
  end if;

  insert into public.documents_sources(
    dossier_id,investisseur_id,categorie,nom_fichier,storage_bucket,storage_path,
    date_document,annee_reference,statut_analyse,metadata,portee_document,concerne_investisseur_ids
  )
  values(
    p_dossier_id,p_investisseur_id,p_categorie,p_nom_fichier,'client-source-docs',p_storage_path,
    p_date_document,p_annee_reference,'uploaded',
    jsonb_build_object('registered_by',v_uid,'registered_via','portal_v2'),
    p_portee_document,coalesce(v_concernes,'{}'::uuid[])
  )
  returning id into v_id;

  return v_id;
end;
$function$
;
grant execute on function public.register_source_document_v2(uuid,uuid,text,text,text,text,uuid[],date,integer) to authenticated;
