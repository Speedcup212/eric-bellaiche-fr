
-- Autonomous confirmation is server-only and never uses a browser-supplied balance.
-- The reference and its credit link must already have been reconciled.
create or replace function public.auto_apply_verified_credit_crd(p_preview_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
 v_preview public.credit_crd_previews%rowtype;
 v_doc public.documents_sources%rowtype;
 v_section public.recueil_sections%rowtype;
 v_old jsonb; v_new jsonb;
 v_target_id uuid;v_index integer;v_target_key text;
 v_prior numeric;v_prior_date date;v_prior_class text;
 v_payment numeric;v_initial numeric;v_source_payment numeric;
 v_source_initial numeric;v_source_rate numeric;v_stored_rate numeric;
 v_source_reference text;
begin
 select * into v_preview from public.credit_crd_previews where id=p_preview_id for update;
 if not found or v_preview.confirmed_at is not null or v_preview.expires_at<now() then
    raise exception 'Preuve expirée ou déjà consommée';
 end if;
 if v_preview.parser<>'credit_schedule_dual_v5' or v_preview.verification_status<>'verified'
    or v_preview.pairs_checked<8
    or v_preview.pairs_valid::numeric/nullif(v_preview.pairs_checked,0)<0.98
    or coalesce((v_preview.evidence->>'disagreement')::boolean,true)
    or v_preview.balance_date>current_date
    or v_preview.balance_date<current_date-45
 then raise exception 'Contrôles arithmétiques, date ou cohérence insuffisants'; end if;
 if coalesce((v_preview.evidence->>'rows_read')::integer,0)<12 then
    raise exception 'Nombre de lignes contrôlées insuffisant'; end if;
 select * into v_doc from public.documents_sources where id=v_preview.document_id for update;
 if not found or v_doc.categorie<>'tableau_amortissement'
    or v_doc.statut_analyse<>'validated'
    or v_doc.dossier_id<>v_preview.dossier_id
    or v_doc.hash_sha256 is null or v_doc.hash_sha256<>v_preview.document_sha256
 then raise exception 'Document source non conforme ou modifié'; end if;
 v_target_key:=v_doc.metadata#>>'{manual_review,target,key}';
 if v_doc.metadata#>>'{manual_review,target,kind}'<>'credit'
    or v_target_key !~ '^[0-9a-f-]{36}:[0-9]{1,3}$'
 then raise exception 'Le prêt doit être identifié sans ambiguïté'; end if;
 v_target_id:=split_part(v_target_key,':',1)::uuid;
 v_index:=split_part(v_target_key,':',2)::integer;
 select * into v_section from public.recueil_sections
 where dossier_id=v_doc.dossier_id and investisseur_id=v_target_id
    and section_code='credits' for update;
 if not found or jsonb_typeof(v_section.payload->'items')<>'array'
     or v_index>=jsonb_array_length(v_section.payload->'items') then
   raise exception 'Rattachement au crédit introuvable';end if;
 v_old:=v_section.payload->'items'->v_index;
 if v_old->>'source_document_id'<>v_doc.id::text then
   raise exception 'La preuve ne correspond pas au justificatif du crédit';end if;
 v_initial:=nullif(v_old->>'montant_initial','')::numeric;
 v_payment:=nullif(v_old->>'mensualite_actuelle','')::numeric;
 v_source_payment:=nullif(v_preview.evidence->>'monthly_payment','')::numeric;
 v_source_initial:=nullif(v_preview.evidence->>'initial_amount','')::numeric;
 v_source_rate:=nullif(v_preview.evidence->>'interest_rate','')::numeric;
 v_stored_rate:=nullif(v_old->>'taux_credit','')::numeric;
 if v_preview.balance<=0 or (v_initial is not null and v_preview.balance>v_initial+1)
 then raise exception 'CRD anormal par rapport au prêt initial';end if;
 if v_initial is not null and v_source_initial is not null
     and abs(v_source_initial-v_initial)>1
 then raise exception 'Capital initial différent du crédit enregistré';end if;
 if v_payment is null or v_source_payment is null or abs(v_payment-v_source_payment)>1
 then raise exception 'Mensualités incohérentes entre tableau et recueil';end if;
 if v_stored_rate is not null and v_source_rate is not null
     and abs(v_stored_rate-v_source_rate)>0.05
 then raise exception 'Taux du prêt incohérent';end if;
 v_prior:=nullif(v_old->>'capital_restant_du','')::numeric;
 v_prior_date:=nullif(v_old->>'capital_restant_du_date','')::date;
 v_prior_class:=v_old->>'capital_restant_du_nature';
 if v_prior is not null then
   if v_prior_class<>'theorique_echeancier'
     or v_old->>'capital_restant_du_source_document_id'<>v_doc.id::text
   then raise exception 'CRD existant non théorique : écrasement automatique interdit';end if;
   if v_prior_date>=v_preview.balance_date then
     if v_prior_date=v_preview.balance_date and abs(v_prior-v_preview.balance)<=0.01 then
       return jsonb_build_object('ok',true,'skipped',true,'reason','already_current','balance',v_prior,'balance_date',v_prior_date);
     end if;
     raise exception 'Date du nouveau solde non postérieure à l’ancien';end if;
   if v_preview.balance>v_prior+1 then
     raise exception 'Le CRD théorique augmente : contrôle du prêt requis';end if;
 end if;
 v_new:=v_old||jsonb_build_object(
   'capital_restant_du',v_preview.balance,
   'capital_restant_du_date',v_preview.balance_date,
   'capital_restant_du_nature','theorique_echeancier',
   'capital_restant_du_source_document_id',v_doc.id,
   'capital_restant_du_validation_mode','calcul_systeme_controles_croises',
   'capital_restant_du_calculated_at',now()
 );
 update public.recueil_sections set
  payload=jsonb_set(payload,array['items',v_index::text],v_new,true),updated_at=now()
 where id=v_section.id;
 insert into public.data_provenance(
  dossier_id,investisseur_id,source_document_id,entity_table,entity_id,
  field_name,methode_collecte,statut_validation,valeur_source,valeur_retenue,justification_ecart
 ) values(
  v_doc.dossier_id,v_target_id,v_doc.id,'recueil_sections',v_section.id,
  'credits.items['||v_index||'].capital_restant_du',
  'calcul_systeme','verifie',
  jsonb_build_object('balance',v_preview.balance,'as_of',v_preview.balance_date,
    'reader',v_preview.selected_reader,'checked',v_preview.pairs_checked,
    'verified',v_preview.pairs_valid,'hash',v_preview.document_sha256)::text,
  jsonb_build_object('balance',v_preview.balance,'as_of',v_preview.balance_date,
    'nature','theorique_echeancier','auto_verified',true)::text,
  'Valeur théorique contrôlée automatiquement (échéancier et recueil), sans présumer un solde bancaire réel ni une validation CIF.'
 );
 update public.credit_crd_previews set confirmed_at=now(),confirmed_by=null where id=p_preview_id;
 update public.documents_sources set
  metadata=coalesce(metadata,'{}'::jsonb)||
   jsonb_build_object('auto_crd',jsonb_build_object(
     'status','integrated_theoretical','balance',v_preview.balance,
     'as_of',v_preview.balance_date,'reader',v_preview.selected_reader,
     'verified_at',now(),'target_key',v_target_key)),
  updated_at=now()
 where id=v_doc.id;
 insert into public.audit_log(dossier_id,action,entity_table,entity_id,before_data,after_data,metadata)
 values(v_doc.dossier_id,'credit_crd_auto_verified','recueil_sections',v_section.id,v_old,v_new,
  jsonb_build_object('document_id',v_doc.id,'preview_id',p_preview_id,
     'hash',v_preview.document_sha256,'verification','arithmetic_and_recueil',
     'status','theoretical_not_bank_confirmed'));
 return jsonb_build_object('ok',true,'applied',true,'balance',v_preview.balance,
    'balance_date',v_preview.balance_date,'target_key',v_target_key);
end;$fn$;
revoke all on function public.auto_apply_verified_credit_crd(uuid) from public,anon,authenticated;
grant execute on function public.auto_apply_verified_credit_crd(uuid) to service_role;
