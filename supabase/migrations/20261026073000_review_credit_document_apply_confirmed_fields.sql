create or replace function public.review_source_document(
 p_document_id uuid, p_decision text, p_note text default null,
 p_target_kind text default null, p_target_key text default null, p_target_label text default null
) returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  v_doc public.documents_sources%rowtype;
  v_section public.recueil_sections%rowtype;
  v_fact jsonb;
  v_item jsonb;
  v_merged jsonb;
  v_value jsonb;
  v_existing jsonb;
  v_field text;
  v_status text;
  v_review jsonb;
  v_investor uuid;
  v_index int;
  v_applied int := 0;
  v_conflicts int := 0;
  v_source_id uuid;
begin
  if not private.is_staff() then raise exception 'Accès réservé au cabinet'; end if;
  if p_decision not in ('validated','rejected') then
    raise exception 'Décision documentaire invalide';
  end if;
  select * into v_doc from public.documents_sources
  where id=p_document_id for update;
  if not found then raise exception 'Document introuvable'; end if;
  if v_doc.statut_analyse='rejected' and p_decision='validated' then
    raise exception 'Une pièce rejetée exige une nouvelle analyse avant réintégration';
  end if;

  if p_decision='validated' and v_doc.categorie='tableau_amortissement'
    and coalesce((v_doc.metadata->>'fields_applied')::integer,0)=0
    and coalesce(p_target_kind,'') <> 'credit' then
    raise exception 'Sélectionne le crédit concerné pour intégrer les données, ou conserve la pièce à contrôler';
  end if;

  if p_decision='validated' and p_target_kind='credit' then
    if v_doc.categorie <> 'tableau_amortissement' then
      raise exception 'Rattachement à un crédit réservé au tableau d’amortissement';
    end if;
    if p_target_key is null or p_target_key !~ '^[0-9a-fA-F-]{36}:[0-9]{1,4}$' then
      raise exception 'Identifiant de crédit invalide';
    end if;
    v_investor := split_part(p_target_key,':',1)::uuid;
    v_index := split_part(p_target_key,':',2)::int;
    select * into v_section from public.recueil_sections
    where dossier_id=v_doc.dossier_id and investisseur_id=v_investor and section_code='credits'
    for update;
    if not found or jsonb_typeof(v_section.payload->'items') <> 'array'
      or v_index >= jsonb_array_length(v_section.payload->'items') then
      raise exception 'Crédit introuvable dans ce dossier';
    end if;
    select id, valeur_source::jsonb into v_source_id, v_fact
    from public.data_provenance
    where dossier_id=v_doc.dossier_id and source_document_id=p_document_id
       and entity_table='recueil_sections' and field_name='credits.items'
       and methode_collecte='extraction_document'
    order by created_at desc limit 1;
    if v_source_id is null or jsonb_typeof(v_fact)<>'object' then
      raise exception 'Aucune donnée de crédit exploitable dans le document : relance l’analyse';
    end if;
    v_item := v_section.payload->'items'->v_index;
    v_merged := v_item;
    for v_field,v_value in select key,value from jsonb_each(v_fact)
    loop
      if v_field not in (
        'montant_initial','taux_credit','capital_restant_du','capital_restant_du_date',
        'mensualite_actuelle','date_pret','date_ouverture','date_fin','duree_mois',
        'duree_initiale_mois','duree_actualisee_restante_mois','contrat','reference_pret',
        'date_constitution_tableau','date_premiere_echeance_tableau','nombre_echeances_tableau',
        'montant_derniere_echeance','mensualite_future','mensualite_future_date',
        'banque','organisme','taeg','assurance_mode','assurance_externe','taux_assurance',
        'cotisation_assurance','cout_total_assurance','cout_total_credit',
        'jour_echeance','phase_credit','taux_type','taux_hors_assurance',
        'solde_historique_reference','devise','frais_tableau'
      ) then continue; end if;
      if v_value is null or v_value='null'::jsonb or v_value='""'::jsonb then continue; end if;
      v_existing := v_merged->v_field;
      if v_existing is null or v_existing='null'::jsonb or v_existing='""'::jsonb then
        v_merged := jsonb_set(v_merged,array[v_field],v_value,true);
        v_applied := v_applied+1;
      elsif v_existing <> v_value then
        v_conflicts := v_conflicts+1;
      end if;
    end loop;
    if v_conflicts>0 then
      raise exception 'Données contradictoires : corrige ou vérifie les valeurs déclarées avant validation (% conflit(s))', v_conflicts;
    end if;
    v_merged := jsonb_set(v_merged,'{source_document_id}',to_jsonb(p_document_id::text),true);
    update public.recueil_sections
    set payload=jsonb_set(payload,array['items',v_index::text],v_merged,true),updated_at=now()
    where id=v_section.id;
    update public.data_provenance
    set statut_validation='retenu_cif',valeur_retenue=v_merged::text,
        retained_at=now(),retained_by=auth.uid(),date_validation=now(),valide_par=auth.uid()
    where id=v_source_id;
  end if;

  v_status := case when p_decision='validated' then 'validated' else 'rejected' end;
  v_review := jsonb_build_object(
    'decision',case when p_decision='rejected' then 'rejected'
                    when nullif(trim(coalesce(p_target_kind,'')),'') is not null then 'validated_linked'
                    when coalesce((v_doc.metadata->>'fields_applied')::int,0)>0 then 'validated_after_control'
                    else 'validated_without_integration' end,
    'note',nullif(trim(coalesce(p_note,'')),''),
    'target',case when nullif(trim(coalesce(p_target_kind,'')),'') is null then null
                 else jsonb_build_object('kind',p_target_kind,'key',p_target_key,'label',p_target_label) end,
    'fields_applied',v_applied,'conflicts_detected',v_conflicts,
    'reviewed_at',now(),'reviewer_id',auth.uid()
  );
  update public.documents_sources
  set statut_analyse=v_status,
      metadata=coalesce(metadata,'{}'::jsonb)||
        jsonb_build_object('manual_review',v_review,
          'fields_applied',coalesce((metadata->>'fields_applied')::int,0)+v_applied),
      updated_at=now()
  where id=p_document_id;
  return jsonb_build_object('ok',true,'document_id',p_document_id,'status',v_status,
     'applied_fields',v_applied,'manual_review',v_review);
end;
$function$;
revoke all on function public.review_source_document(uuid,text,text,text,text,text) from public,anon;
grant execute on function public.review_source_document(uuid,text,text,text,text,text) to authenticated,service_role;
