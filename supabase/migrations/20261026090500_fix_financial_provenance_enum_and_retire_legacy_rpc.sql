create or replace function public.link_financial_source_document(
  p_document_id uuid,
  p_investisseur_id uuid,
  p_confirm_other_holder boolean,
  p_item_index integer default null,
  p_type_placement text default null,
  p_organisme text default null,
  p_montant numeric default null,
  p_date_valeur date default null,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_doc public.documents_sources%rowtype;
  v_section public.recueil_sections%rowtype;
  v_role text;
  v_items jsonb;
  v_item jsonb;
  v_ids jsonb;
  v_idx integer;
  v_label text;
  v_new boolean := p_item_index is null;
  v_manual_review jsonb;
  v_count integer := 0;
  v_cross_holder boolean := false;
begin
  if not private.is_staff() then
    raise exception 'Accès réservé au cabinet';
  end if;
  select * into v_doc from public.documents_sources
  where id=p_document_id for update;
  if not found or v_doc.categorie <> 'patrimoine_financier' then
    raise exception 'Justificatif financier introuvable';
  end if;
  if v_doc.statut_analyse in ('rejected','processing') then
    raise exception 'Document non disponible pour validation';
  end if;
  -- The uploader/registered owner can differ from the actual contract holder.
  -- Staff must explicitly confirm the reassignment; the initial uploader is preserved.
  v_cross_holder := v_doc.portee_document='investisseur'
    and not (v_doc.investisseur_id=p_investisseur_id
      or p_investisseur_id=any(coalesce(v_doc.concerne_investisseur_ids,array[]::uuid[])));
  if v_cross_holder and not coalesce(p_confirm_other_holder,false) then
    raise exception 'Confirme explicitement le changement de titulaire après vérification du document';
  end if;
  if not exists(select 1 from public.dossier_investisseurs di
     where di.dossier_id=v_doc.dossier_id and di.investisseur_id=p_investisseur_id) then
    raise exception 'Investisseur hors du dossier';
  end if;

  select role_dossier into v_role from public.dossier_investisseurs
  where dossier_id=v_doc.dossier_id and investisseur_id=p_investisseur_id;

  select * into v_section from public.recueil_sections
  where dossier_id=v_doc.dossier_id and investisseur_id=p_investisseur_id
    and section_code='financial' for update;
  if not found then raise exception 'Section financière absente du recueil'; end if;

  v_items := case when jsonb_typeof(v_section.payload->'items')='array'
     then v_section.payload->'items' else '[]'::jsonb end;

  if v_new then
    if nullif(trim(coalesce(p_type_placement,'')),'') is null
      or p_type_placement not in (
       'Livrets et épargne bancaire','Assurance-vie / capitalisation',
       'PER / épargne retraite','Épargne salariale','PEA / compte-titres',
       'SCPI / OPCI','Autres placements'
      ) then
      raise exception 'Type de placement manquant ou invalide';
    end if;
    if nullif(trim(coalesce(p_organisme,'')),'') is null or length(p_organisme)>150 then
      raise exception 'Organisme ou dénomination du placement obligatoire (150 caractères maximum)';
    end if;
    if p_montant is not null and (p_montant<0 or p_montant>1000000000 or p_date_valeur is null) then
      raise exception 'Le montant doit être plausible et accompagné de sa date de valorisation';
    end if;
    v_idx:=jsonb_array_length(v_items);
    v_item:=jsonb_build_object(
      'type_placement',trim(p_type_placement),
      'organisme',trim(p_organisme),
      'proprietaire',case when v_role='investisseur_2' then 'Identifiant 2' else 'Identifiant 1' end,
      'source_document_id',p_document_id::text,
      'source_document_ids',jsonb_build_array(p_document_id::text),
      'source_file',v_doc.nom_fichier,
      'saisie_conseiller',true
    );
    if p_montant is not null then
      v_item:=v_item||jsonb_build_object('montant',p_montant,'date_valorisation',p_date_valeur);
      v_count:=1;
    end if;
    v_items:=v_items||jsonb_build_array(v_item);
  else
    if p_item_index<0 or p_item_index>=jsonb_array_length(v_items) then
      raise exception 'Placement sélectionné introuvable';
    end if;
    if p_montant is not null or p_date_valeur is not null
      or nullif(trim(coalesce(p_type_placement,'')),'') is not null
      or nullif(trim(coalesce(p_organisme,'')),'') is not null then
      raise exception 'Le rattachement à un placement existant ne modifie pas sa valorisation';
    end if;
    v_idx:=p_item_index;
    v_item:=v_items->v_idx;
    v_ids:=case when jsonb_typeof(v_item->'source_document_ids')='array'
       then v_item->'source_document_ids' else '[]'::jsonb end;
    if v_item ? 'source_document_id'
       and jsonb_typeof(v_item->'source_document_id')='string'
       and not v_ids ? (v_item->>'source_document_id') then
      v_ids:=v_ids||jsonb_build_array(v_item->>'source_document_id');
    end if;
    if not v_ids ? p_document_id::text then
      v_ids:=v_ids||jsonb_build_array(p_document_id::text);
    end if;
    v_item:=jsonb_set(v_item,'{source_document_ids}',v_ids,true);
    v_items:=jsonb_set(v_items,array[v_idx::text],v_item,true);
  end if;

  v_label:=coalesce(nullif(trim(v_item->>'type_placement'),''),
    nullif(trim(v_item->>'type'),''),'Placement')||
    ' · '||coalesce(nullif(trim(v_item->>'organisme'),''),
      nullif(trim(v_item->>'etablissement'),''),'Établissement à préciser');

  update public.recueil_sections set
    payload=jsonb_set(payload,'{items}',v_items,true),
    updated_at=now()
  where id=v_section.id;

  if v_new then
    insert into public.data_provenance(
      dossier_id, investisseur_id, source_document_id, entity_table, entity_id,
      field_name, methode_collecte, statut_validation, valeur_source, valeur_retenue,
      justification_ecart, valide_par, date_validation, retained_by, retained_at
    ) values (
      v_doc.dossier_id,p_investisseur_id,p_document_id,'recueil_sections',v_section.id,
      'financial.items['||v_idx::text||']',
      'saisie_cif','retenu_cif',
      v_item::text,v_item::text,
      case when p_montant is not null
         then 'Placement et montant saisis puis validés par le conseiller à partir du justificatif ; date de valorisation renseignée.'
         else 'Placement créé et rattaché au justificatif ; aucun montant supposé ou intégré.' end,
      auth.uid(),now(),auth.uid(),now()
    );
  end if;

  v_manual_review:=jsonb_build_object(
    'decision','validated_linked',
    'note',nullif(trim(coalesce(p_note,'')),''),
    'target',jsonb_build_object('kind','financial','key',
       p_investisseur_id::text||':'||v_idx::text,'label',v_label),
    'created_placement',v_new,
    'amount_entered_manually',p_montant is not null,
    'holder_corrected_from_upload',v_cross_holder,
    'holder_verified_by_cif',v_cross_holder and coalesce(p_confirm_other_holder,false),
    'original_registered_investisseur_id',v_doc.investisseur_id,
    'original_concerned_investisseur_ids',to_jsonb(v_doc.concerne_investisseur_ids),
    'verified_investisseur_id',p_investisseur_id,
    'automatic_fields_applied',coalesce((v_doc.metadata->>'fields_applied')::integer,0),
    'reviewed_at',now(),'reviewer_id',auth.uid()
  );

  update public.documents_sources set
    statut_analyse='validated',
    -- Keep the original uploader for provenance, correct only the document's
    -- explicitly verified beneficiary.
    concerne_investisseur_ids=case
      when v_cross_holder then array[p_investisseur_id]::uuid[]
      else concerne_investisseur_ids
    end,
    metadata=coalesce(metadata,'{}'::jsonb)||
      jsonb_build_object('manual_review',v_manual_review),
    updated_at=now()
  where id=p_document_id;

  return jsonb_build_object('ok',true,'status','validated',
    'created_placement',v_new,'financial_item_index',v_idx,
    'placement_label',v_label,'amount_entered_manually',p_montant is not null);
end;
$function$;
revoke all on function public.link_financial_source_document(uuid,uuid,boolean,integer,text,text,numeric,date,text)
  from public,anon;
grant execute on function public.link_financial_source_document(uuid,uuid,boolean,integer,text,text,numeric,date,text)
  to authenticated,service_role;

-- Remove the obsolete eight-argument overload: it predates mandatory holder confirmation.
drop function if exists public.link_financial_source_document(uuid,uuid,integer,text,text,numeric,date,text);
