-- Exact financial total only includes holdings backed by a source document.
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
  v_target_ids uuid[];
  v_target_id uuid;
  v_section public.recueil_sections%rowtype;
  v_field text;
  v_value jsonb;
  v_existing jsonb;
  v_payload jsonb;
  v_existing_text text;
  v_value_text text;
  v_source_page text;
  v_status text;
  v_applied integer := 0;
  v_conflicts integer := 0;
  v_provenance integer := 0;
  v_role text;
  v_is_couple boolean;
  v_missing text[];
  v_items jsonb;
  v_incoming jsonb;
  v_existing_item jsonb;
  v_new_item jsonb;
  v_idx integer;
  v_match_idx integer;
  v_rate numeric;
  v_existing_rate numeric;
  v_credit_conflict boolean;
  v_total_financial numeric;
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

    if v_section_code is null or jsonb_typeof(v_fields) <> 'object' then
      continue;
    end if;

    if jsonb_typeof(v_patch->'target_investisseur_ids')='array' then
      select coalesce(array_agg(value::text::uuid),'{}'::uuid[])
      into v_target_ids
      from jsonb_array_elements_text(v_patch->'target_investisseur_ids');
    else
      v_target_ids := case
        when cardinality(v_doc.concerne_investisseur_ids)>0 then v_doc.concerne_investisseur_ids
        when v_doc.investisseur_id is not null then array[v_doc.investisseur_id]
        else '{}'::uuid[]
      end;
    end if;

    foreach v_target_id in array coalesce(v_target_ids,'{}'::uuid[])
    loop
      if not exists(
        select 1 from public.dossier_investisseurs di
        where di.dossier_id=v_doc.dossier_id and di.investisseur_id=v_target_id
      ) then
        continue;
      end if;

      select di.role_dossier,
             (select count(*) from public.dossier_investisseurs x where x.dossier_id=v_doc.dossier_id)>1
      into v_role,v_is_couple
      from public.dossier_investisseurs di
      where di.dossier_id=v_doc.dossier_id and di.investisseur_id=v_target_id;

      insert into public.recueil_sections(dossier_id,investisseur_id,section_code,payload,completed_at)
      values(v_doc.dossier_id,v_target_id,v_section_code,'{}'::jsonb,null)
      on conflict(dossier_id,investisseur_id,section_code) do nothing;

      select * into v_section
      from public.recueil_sections
      where dossier_id=v_doc.dossier_id
        and investisseur_id=v_target_id
        and section_code=v_section_code
      for update;

      v_payload := coalesce(v_section.payload,'{}'::jsonb);

      for v_field,v_value in select key,value from jsonb_each(v_fields)
      loop
        v_source_page := nullif(v_pages->>v_field,'');

        if v_section_code='financial'
           and v_field='__merge_financial_items'
           and jsonb_typeof(v_value)='array'
        then
          v_items := case
            when jsonb_typeof(v_payload->'items')='array' then v_payload->'items'
            else '[]'::jsonb
          end;

          for v_incoming in select value from jsonb_array_elements(v_value)
          loop
            v_match_idx := null;
            v_idx := 0;
            for v_existing_item in select value from jsonb_array_elements(v_items)
            loop
              if coalesce(v_existing_item->>'source_document_id','') = p_document_id::text then
                v_match_idx := v_idx;
                exit;
              end if;
              v_idx := v_idx + 1;
            end loop;

            v_new_item := v_incoming || jsonb_build_object('source_document_id',p_document_id::text);
            if v_match_idx is null then
              v_items := v_items || jsonb_build_array(v_new_item);
            else
              v_items := jsonb_set(v_items,array[v_match_idx::text],v_new_item,true);
            end if;
            v_applied := v_applied + 1;

            insert into public.data_provenance(
              dossier_id,investisseur_id,source_document_id,
              entity_table,entity_id,field_name,source_page,
              methode_collecte,statut_validation,valeur_source,valeur_retenue,justification_ecart
            ) values(
              v_doc.dossier_id,v_target_id,p_document_id,
              'recueil_sections',v_section.id,'financial.items',v_source_page,
              'extraction_document','extrait',v_new_item::text,v_new_item::text,
              'Placement financier lu automatiquement dans le justificatif et ajouté au recueil.'
            );
            v_provenance := v_provenance + 1;
          end loop;

          v_payload := jsonb_set(v_payload,'{items}',v_items,true);
          select coalesce(sum(
            case
              when nullif(trim(coalesce(value->>'source_document_id','')),'') is null then 0
              when nullif(trim(coalesce(value->>'montant',value->>'valeur',value->>'encours','')),'') is null then 0
              else replace(replace(coalesce(value->>'montant',value->>'valeur',value->>'encours'),' ',''),',','.')::numeric
            end
          ),0)
          into v_total_financial
          from jsonb_array_elements(v_items);

          if v_total_financial > 0 then
            v_payload := jsonb_set(v_payload,'{exact_total_amount}',to_jsonb(v_total_financial),true);
          end if;
          continue;
        end if;

        if v_section_code='credits'
           and v_field='__merge_credit_items'
           and jsonb_typeof(v_value)='array'
        then
          v_items := case
            when jsonb_typeof(v_payload->'items')='array' then v_payload->'items'
            else '[]'::jsonb
          end;

          for v_incoming in select value from jsonb_array_elements(v_value)
          loop
            v_rate := null;
            begin
              if nullif(trim(v_incoming->>'taux_credit'),'') is not null then
                v_rate := replace(v_incoming->>'taux_credit',',','.')::numeric;
              end if;
            exception when others then
              v_rate := null;
            end;

            v_match_idx := null;
            v_idx := 0;

            for v_existing_item in select value from jsonb_array_elements(v_items)
            loop
              v_idx := v_idx + 1;
              v_existing_rate := null;
              begin
                if nullif(trim(v_existing_item->>'taux_credit'),'') is not null then
                  v_existing_rate := replace(v_existing_item->>'taux_credit',',','.')::numeric;
                end if;
              exception when others then
                v_existing_rate := null;
              end;

              if v_rate is not null and v_existing_rate is not null
                 and abs(v_rate-v_existing_rate) <= 0.01 then
                v_match_idx := v_idx-1;
                exit;
              end if;
            end loop;

            if v_match_idx is null then
              v_conflicts := v_conflicts + 1;
              insert into public.data_provenance(
                dossier_id,investisseur_id,source_document_id,
                entity_table,entity_id,field_name,source_page,
                methode_collecte,statut_validation,valeur_source,valeur_retenue,justification_ecart
              ) values(
                v_doc.dossier_id,v_target_id,p_document_id,
                'recueil_sections',v_section.id,'credits.items',v_source_page,
                'extraction_document','a_verifier',v_incoming::text,null,
                'Crédit identifié dans le document mais impossible à rapprocher de façon certaine d’une ligne existante du recueil.'
              );
              v_provenance := v_provenance + 1;
              continue;
            end if;

            v_existing_item := v_items->v_match_idx;
            v_new_item := v_existing_item;
            v_credit_conflict := false;

            for v_field,v_value in
              select key,value
              from jsonb_each(v_incoming - 'source_document_id' - 'source_file')
            loop
              v_existing := v_new_item->v_field;
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

              if v_value_text is null then
                continue;
              elsif v_existing_text is null then
                v_new_item := jsonb_set(v_new_item,array[v_field],v_value,true);
                v_applied := v_applied + 1;
              elsif lower(regexp_replace(v_existing_text,'[[:space:]]','','g'))
                    <> lower(regexp_replace(v_value_text,'[[:space:]]','','g'))
                    and v_field <> 'taux_credit'
              then
                v_credit_conflict := true;
              end if;
            end loop;

            v_new_item := jsonb_set(
              v_new_item,
              '{source_document_id}',
              to_jsonb(p_document_id::text),
              true
            );

            v_items := jsonb_set(v_items,array[v_match_idx::text],v_new_item,true);
            v_payload := jsonb_set(v_payload,'{items}',v_items,true);

            insert into public.data_provenance(
              dossier_id,investisseur_id,source_document_id,
              entity_table,entity_id,field_name,source_page,
              methode_collecte,statut_validation,valeur_source,valeur_retenue,justification_ecart
            ) values(
              v_doc.dossier_id,v_target_id,p_document_id,
              'recueil_sections',v_section.id,'credits.items',v_source_page,
              'extraction_document',
              case when v_credit_conflict then 'a_verifier' else 'extrait' end,
              v_incoming::text,v_new_item::text,
              case
                when v_credit_conflict then 'Certaines valeurs du tableau d’amortissement diffèrent de la déclaration client ; les valeurs déjà déclarées sont conservées.'
                else 'Le tableau d’amortissement complète directement la ligne de crédit correspondante.'
              end
            );

            v_provenance := v_provenance + 1;
            if v_credit_conflict then v_conflicts := v_conflicts + 1; end if;
          end loop;

          continue;
        end if;

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

        if v_value_text is null then
          continue;
        end if;

        if v_existing_text is null
           or v_existing='[]'::jsonb
           or v_existing='{}'::jsonb
        then
          v_payload := jsonb_set(v_payload,array[v_field],v_value,true);
          v_applied := v_applied + 1;
          v_status := 'extrait';
        elsif lower(regexp_replace(coalesce(v_existing_text,''),'[[:space:]]','','g'))
            = lower(regexp_replace(coalesce(v_value_text,''),'[[:space:]]','','g'))
        then
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
          v_doc.dossier_id,v_target_id,p_document_id,
          'recueil_sections',v_section.id,v_section_code||'.'||v_field,v_source_page,
          'extraction_document',v_status,v_value_text,
          case when v_status='a_verifier' then v_existing_text else v_value_text end,
          case
            when v_status='a_verifier' then 'Valeur du document différente de la valeur déjà déclarée : la déclaration client est conservée jusqu’au contrôle CIF.'
            when v_existing_text is null then 'Champ complété automatiquement à partir du justificatif reçu.'
            else 'Valeur extraite du justificatif concordante avec la donnée déjà présente.'
          end
        );
        v_provenance := v_provenance + 1;
      end loop;

      v_missing := private.recueil_section_missing_fields(
        v_section_code,v_payload,v_role,v_is_couple
      );

      update public.recueil_sections
         set payload=v_payload,
             completed_at=case
               when cardinality(v_missing)=0 then coalesce(completed_at,now())
               else completed_at
             end,
             updated_at=now()
       where id=v_section.id;
    end loop;
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
    'ok',true,
    'document_id',p_document_id,
    'fields_applied',v_applied,
    'conflicts',v_conflicts,
    'provenance_rows',v_provenance,
    'status',case when v_conflicts>0 then 'to_review' else p_status end
  );
end;
$function$
;

revoke all on function public.apply_source_document_extraction(uuid,jsonb,text,text)
from public, anon, authenticated;
grant execute on function public.apply_source_document_extraction(uuid,jsonb,text,text)
to service_role;