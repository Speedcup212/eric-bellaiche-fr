-- Automatic enrichment of the recueil from client source documents.
-- Extracted values fill only empty fields. Existing client declarations are never silently overwritten.
create index if not exists idx_documents_sources_dossier_investor_created
  on public.documents_sources(dossier_id,investisseur_id,created_at desc);

create index if not exists idx_data_provenance_source_document
  on public.data_provenance(source_document_id)
  where source_document_id is not null;

CREATE OR REPLACE FUNCTION public.apply_source_document_extraction(p_document_id uuid, p_extraction jsonb, p_status text, p_hash_sha256 text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_doc public.documents_sources%rowtype;
  v_patch jsonb;
  v_section_code text;
  v_fields jsonb;
  v_pages jsonb;
  v_section public.recueil_sections%rowtype;
  v_field text;
  v_value jsonb;
  v_existing jsonb;
  v_payload jsonb;
  v_current_array jsonb;
  v_item jsonb;
  v_applied integer := 0;
  v_conflicts integer := 0;
  v_provenance integer := 0;
  v_source_page text;
  v_status text;
  v_existing_text text;
  v_value_text text;
begin
  if coalesce((select auth.role()),'') <> 'service_role' then
    raise exception 'Appel réservé au service interne';
  end if;

  select * into v_doc
  from public.documents_sources
  where id=p_document_id
  for update;

  if v_doc.id is null then raise exception 'Document source introuvable'; end if;
  if p_status not in ('extracted','to_review') then raise exception 'Statut analyse invalide'; end if;

  p_extraction := coalesce(p_extraction,'{}'::jsonb);

  delete from public.data_provenance
   where source_document_id=p_document_id
     and methode_collecte='extraction_document';

  for v_patch in
    select value from jsonb_array_elements(coalesce(p_extraction->'patches','[]'::jsonb))
  loop
    v_section_code := nullif(trim(v_patch->>'section_code'),'');
    v_fields := coalesce(v_patch->'fields','{}'::jsonb);
    v_pages := coalesce(v_patch->'source_pages','{}'::jsonb);
    if v_section_code is null or jsonb_typeof(v_fields) <> 'object' then continue; end if;

    insert into public.recueil_sections(dossier_id,investisseur_id,section_code,payload,completed_at)
    values(v_doc.dossier_id,v_doc.investisseur_id,v_section_code,'{}'::jsonb,null)
    on conflict(dossier_id,investisseur_id,section_code) do nothing;

    select * into v_section
      from public.recueil_sections
     where dossier_id=v_doc.dossier_id
       and investisseur_id=v_doc.investisseur_id
       and section_code=v_section_code
     for update;

    v_payload := coalesce(v_section.payload,'{}'::jsonb);

    for v_field,v_value in select key,value from jsonb_each(v_fields)
    loop
      v_source_page := nullif(v_pages->>v_field,'');
      v_existing := v_payload->v_field;
      v_existing_text := case
        when v_existing is null or v_existing='null'::jsonb then null
        when jsonb_typeof(v_existing)='string' then nullif(trim(v_existing#>>'{}'),'')
        else v_existing::text
      end;
      v_value_text := case
        when v_value is null or v_value='null'::jsonb then null
        when jsonb_typeof(v_value)='string' then nullif(trim(v_value#>>'{}'),'')
        else v_value::text
      end;

      if v_value_text is null then continue; end if;

      if v_field like 'documented_%' and jsonb_typeof(v_value)='array' then
        v_current_array := case when jsonb_typeof(v_existing)='array' then v_existing else '[]'::jsonb end;
        for v_item in select value from jsonb_array_elements(v_value)
        loop
          if not exists (
            select 1 from jsonb_array_elements(v_current_array) x
            where x->>'source_document_id'=p_document_id::text
              and coalesce(x->>'fact_key','')=coalesce(v_item->>'fact_key','')
          ) then
            v_current_array := v_current_array || jsonb_build_array(v_item);
            v_applied := v_applied + 1;
          end if;
        end loop;
        v_payload := jsonb_set(v_payload,array[v_field],v_current_array,true);
        v_status := 'extrait';

      elsif v_existing_text is null
         or v_existing='[]'::jsonb
         or v_existing='{}'::jsonb then
        v_payload := jsonb_set(v_payload,array[v_field],v_value,true);
        v_applied := v_applied + 1;
        v_status := 'extrait';

      elsif lower(regexp_replace(coalesce(v_existing_text,''),'[[:space:]]','','g'))
          = lower(regexp_replace(coalesce(v_value_text,''),'[[:space:]]','','g')) then
        v_status := 'extrait';

      else
        v_status := 'a_verifier';
        v_conflicts := v_conflicts + 1;
      end if;

      insert into public.data_provenance(
        dossier_id,investisseur_id,source_document_id,
        entity_table,entity_id,field_name,source_page,
        methode_collecte,statut_validation,valeur_source,valeur_retenue,justification_ecart
      ) values(
        v_doc.dossier_id,v_doc.investisseur_id,p_document_id,
        'recueil_sections',v_section.id,v_section_code||'.'||v_field,v_source_page,
        'extraction_document',v_status,v_value_text,
        case when v_status='a_verifier' then v_existing_text else v_value_text end,
        case
          when v_status='a_verifier' then 'Valeur du document différente de la valeur déjà déclarée : la déclaration client est conservée jusqu’au contrôle CIF.'
          when v_existing_text is null then 'Champ complété automatiquement à partir du justificatif reçu ; contrôle CIF recommandé.'
          else 'Valeur extraite du justificatif concordante avec la donnée déjà présente.'
        end
      );
      v_provenance := v_provenance + 1;
    end loop;

    update public.recueil_sections
       set payload=v_payload,
           completed_at=case
             when v_section_code='tax'
              and coalesce(nullif(trim(v_payload->>'annee_imposition'),''),'')<>''
              and coalesce(nullif(trim(v_payload->>'revenu_imposable'),''),'')<>''
              and coalesce(nullif(trim(v_payload->>'revenu_fiscal_reference'),''),'')<>''
              and coalesce(nullif(trim(v_payload->>'nombre_parts'),''),'')<>''
              and coalesce(nullif(trim(v_payload->>'tmi'),''),'')<>''
              and coalesce(nullif(trim(v_payload->>'impot_revenu_net'),''),'')<>''
             then coalesce(v_section.completed_at,now())
             else v_section.completed_at
           end,
           updated_at=now()
     where id=v_section.id;
  end loop;

  update public.documents_sources
     set statut_analyse=case when v_conflicts>0 then 'to_review' else p_status end,
         hash_sha256=coalesce(p_hash_sha256,hash_sha256),
         metadata=coalesce(metadata,'{}'::jsonb)
           || jsonb_build_object(
                'extraction',p_extraction - 'patches',
                'analysis_completed_at',now(),
                'fields_applied',v_applied,
                'conflicts_detected',v_conflicts,
                'provenance_rows',v_provenance
              ),
         updated_at=now()
   where id=p_document_id;

  return jsonb_build_object(
    'ok',true,'document_id',p_document_id,'fields_applied',v_applied,
    'conflicts',v_conflicts,'provenance_rows',v_provenance,
    'status',case when v_conflicts>0 then 'to_review' else p_status end
  );
end;
$function$
;

revoke all on function public.apply_source_document_extraction(uuid,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.apply_source_document_extraction(uuid,jsonb,text,text) to service_role;
