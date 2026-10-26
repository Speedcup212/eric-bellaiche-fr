-- Source: user-provided Word, confirmed duplicate joint life insurance on 2026-10-26.
-- Document has no valuation date; rows remain adviser-review pending, not certified.
DO $reconcile$
DECLARE
  v_dossier uuid := '8e7611b0-3a98-452c-9bf7-c8a44985c48b';
  v_source uuid := '4bc403c2-6047-4477-80eb-dfdc8d8d1862';
  v_primary uuid := 'e50fc4a0-94a4-4d01-9f29-18e926c5b206';
  v_secondary uuid := 'fadc7c6d-62d6-48c0-96eb-4c5c4eb5ce40';
  v_joint_pdf uuid := 'f1e98b51-b323-47c7-b5fb-e62e8af89840';
  v_section public.recueil_sections%rowtype;
  v_items jsonb;
  v_new jsonb;
  v_row record;
  v_position int;
  v_added int := 0;
  v_joint_count int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.documents_sources
    WHERE id=v_source AND dossier_id=v_dossier
      AND nom_fichier='Epargne_document de synthèse.docx'
      AND categorie='patrimoine_financier') THEN
    RAISE EXCEPTION 'Document Word source introuvable, rapprochement annulé';
  END IF;
  FOR v_row IN
    SELECT * FROM (VALUES
      ('Identifiant 1','Livret A',24650,1),
      ('Identifiant 1','LDD',13200,2),
      ('Identifiant 1','LEL',16750,3),
      ('Identifiant 1','PEL Quadreto',19300,4),
      ('Identifiant 1','Livret vert',46400,5),
      ('Identifiant 1','Quadreto',750,6),
      ('Identifiant 1','Parts sociales CERA',200,7),
      ('Identifiant 1','AFER',8500,8),
      ('Identifiant 1','PERI Millevie',19600,9),
      ('Identifiant 1','Compte pro',3000,10),
      ('Identifiant 2','Livret A',23950,11),
      ('Identifiant 2','LDD',13100,12),
      ('Identifiant 2','LEL',15900,13),
      ('Identifiant 2','Parts sociales CERA',200,14),
      ('Identifiant 2','PERI Millevie',19000,15),
      ('Identifiant 2','Livret B',25000,16),
      ('Identifiant 2','Assurance vie Millevie essentielle',18000,17),
      ('Identifiant 2','PEE',12000,18)
    ) AS source_lines(holder, label, amount, source_row)
  LOOP
    SELECT * INTO STRICT v_section FROM public.recueil_sections
      WHERE dossier_id=v_dossier AND section_code='financial'
        AND investisseur_id=CASE WHEN v_row.holder='Identifiant 1' THEN v_primary ELSE v_secondary END
      FOR UPDATE;
    v_items:=COALESCE(v_section.payload->'items','[]'::jsonb);
    IF jsonb_typeof(v_items) <> 'array' THEN RAISE EXCEPTION 'Structure financière incorrecte'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_items) entry
      WHERE entry->>'source_document_id'=v_source::text
        AND entry->>'source_row_number'=v_row.source_row::text) THEN
      CONTINUE;
    END IF;
    v_position:=jsonb_array_length(v_items);
    v_new:=jsonb_build_object(
      'type_placement',v_row.label,
      'organisme',CASE
        WHEN v_row.label IN ('PERI Millevie','Assurance vie Millevie essentielle') THEN 'Millevie / à vérifier'
        WHEN v_row.label='AFER' THEN 'AFER'
        WHEN v_row.label LIKE '%CERA%' THEN 'CERA'
        ELSE 'Établissement non renseigné' END,
      'montant',v_row.amount,
      'proprietaire',v_row.holder,
      'source_type','declaration_docx_conseiller',
      'source_document_id',v_source::text,
      'source_document_ids',jsonb_build_array(v_source::text),
      'source_file','Epargne_document de synthèse.docx',
      'source_row_number',v_row.source_row,
      'source_date_status','absente_du_document',
      'validation_status','a_verifier',
      'source_note','Solde déclaré dans le Word, date non indiquée, rapprochement documentaire à valider.'
    );
    IF v_row.label='Assurance vie Millevie essentielle' THEN
      v_new:=v_new||jsonb_build_object(
        'possible_overlap_to_review','Contrat AEF / Groupe Dauphine Finance déjà créé sans montant'
      );
    END IF;
    UPDATE public.recueil_sections SET
      payload=jsonb_set(payload,'{items}',v_items||jsonb_build_array(v_new),true),
      updated_at=now()
    WHERE id=v_section.id;
    INSERT INTO public.data_provenance(
      dossier_id,investisseur_id,source_document_id,entity_table,entity_id,
      field_name,methode_collecte,statut_validation,valeur_source,
      justification_ecart
    ) VALUES(
      v_dossier,v_section.investisseur_id,v_source,'recueil_sections',v_section.id,
      'financial.items['||v_position||']','extraction_document','a_verifier',
      v_new::text,'Détail repris du Word fourni par le client sans date des soldes. À contrôler par le CIF.'
    );
    v_added:=v_added+1;
  END LOOP;

  -- The user confirmed the Word's joint co-subscription 69,700 EUR
  -- and the separately entered 69,702 EUR contract are one and the same.
  SELECT * INTO STRICT v_section FROM public.recueil_sections
    WHERE dossier_id=v_dossier AND investisseur_id=v_primary
      AND section_code='financial' FOR UPDATE;
  v_items:=v_section.payload->'items';
  SELECT count(*) INTO v_joint_count FROM jsonb_array_elements(v_items) elem
    WHERE elem->>'source_document_id'=v_joint_pdf::text
      AND (elem->>'montant')::numeric=69702;
  IF v_joint_count<>1 THEN
    RAISE EXCEPTION 'Contrat commun de 69 702 EUR non unique ou absent : %',v_joint_count;
  END IF;
  SELECT ordinality-1 INTO v_position
  FROM jsonb_array_elements(v_items) WITH ORDINALITY AS t(elem,ordinality)
  WHERE elem->>'source_document_id'=v_joint_pdf::text
    AND (elem->>'montant')::numeric=69702 LIMIT 1;
  v_new := (v_items->v_position)||
    jsonb_build_object(
      'proprietaire','Identifiant 1 et 2',
      'mode_detention','Co-souscription',
      'joint_contract_duplicate_confirmed',true,
      'duplicate_word_amount_excluded',69700,
      'duplicate_word_source_document_id',v_source::text,
      'reconciliation_note','La ligne commune 69 700 EUR du Word est déjà portée par le contrat existant de 69 702 EUR : aucun nouveau contrat créé.'
    );
  v_items:=jsonb_set(v_items,ARRAY[v_position::text],v_new,true);
  UPDATE public.recueil_sections
    SET payload=jsonb_set(payload,'{items}',v_items,true),updated_at=now()
    WHERE id=v_section.id;
  IF NOT EXISTS(SELECT 1 FROM public.data_provenance
    WHERE dossier_id=v_dossier AND source_document_id=v_source
      AND field_name='financial.joint_co_subscription_dedup') THEN
    INSERT INTO public.data_provenance(
      dossier_id,investisseur_id,source_document_id,entity_table,entity_id,
      field_name,methode_collecte,statut_validation,valeur_source,justification_ecart
    ) VALUES(
      v_dossier,v_primary,v_source,'recueil_sections',v_section.id,
      'financial.joint_co_subscription_dedup','saisie_cif','a_verifier',
      jsonb_build_object('word_joint_amount',69700,'existing_contract_amount',69702,
        'joint_confirmed_by_user',true,'existing_contract_document_id',v_joint_pdf)::text,
      'Doublon confirmé par le conseiller ; ligne commune du Word exclue du total ; co-souscription notée, date et contrat à conserver.'
    );
  END IF;
  UPDATE public.documents_sources SET
    metadata=coalesce(metadata,'{}'::jsonb)||
      jsonb_build_object(
        'manual_reconciliation',jsonb_build_object(
          'status','integrated_pending_document_date_and_cif_review',
          'source','uploaded_docx_same_named_as_original',
          'individual_lines_integrated',18,
          'catherine_amount',152350,'eric_amount',127150,
          'third_party_owners_excluded',jsonb_build_array(
            jsonb_build_object('owner','Anahid','amount',65500),
            jsonb_build_object('owner','Louis','amount',55200)
          ),
          'joint_word_amount',69700,
          'joint_existing_amount',69702,
          'joint_duplicate_not_created',true,
          'date_missing',true,'checked_at',now(),
          'notes','La synthèse patrimoniale reste déclarative jusqu’à validation des dates et contrôles de doublons.'
        ),
        'previous_analysis_error',metadata->>'analysis_error'
      ),
    updated_at=now()
  WHERE id=v_source;

  INSERT INTO public.audit_log(
    dossier_id,action,entity_table,entity_id,metadata
  ) VALUES(
    v_dossier,'financial_docx_reconciliation_pending_review','recueil_sections',v_source,
    jsonb_build_object('source_document_id',v_source,'added_items',v_added,
      'source_date_missing',true,'excluded_third_party_total',120700,
      'joint_duplicate_69700_excluded',true,'joint_existing_69702_retained',true,
      'requested_by_user',true)
  );
END;
$reconcile$;
