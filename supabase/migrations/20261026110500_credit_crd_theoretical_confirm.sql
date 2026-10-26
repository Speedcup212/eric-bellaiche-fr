-- Credit amortization preview storage: service-only, never selectable by clients.
create table if not exists public.credit_crd_previews (
 id uuid primary key default gen_random_uuid(),
 dossier_id uuid not null references public.dossiers(id) on delete cascade,
 document_id uuid not null references public.documents_sources(id) on delete cascade,
 staff_user_id uuid not null,
 document_sha256 text not null check (document_sha256 ~ '^[a-f0-9]{64}$'),
 balance numeric(16,2) not null check (balance >= 0 and balance <= 1000000000),
 balance_date date not null,
 parser text not null check (parser = 'credit_schedule_dual_v5'),
 selected_reader text not null check (selected_reader in ('pdf_native','ocr_embedded_image')),
 verification_status text not null check (verification_status = 'verified'),
 pairs_checked integer not null check (pairs_checked >= 5),
 pairs_valid integer not null check (pairs_valid >= 5),
 evidence jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '30 minutes'),
 confirmed_at timestamptz,
 confirmed_by uuid,
 constraint credit_crd_evidence_ratio check ((pairs_valid::numeric / pairs_checked) >= 0.94),
 constraint credit_crd_preview_dates check (balance_date <= created_at::date),
 constraint credit_crd_preview_expiry check (expires_at > created_at and expires_at <= created_at + interval '31 minutes')
);
create index if not exists credit_crd_previews_doc_idx on public.credit_crd_previews(document_id,created_at desc);
alter table public.credit_crd_previews enable row level security;
revoke all on public.credit_crd_previews from public,anon,authenticated;
grant select,insert,update on public.credit_crd_previews to service_role;

-- API callable only with the Supabase service key by the authenticated Edge Function.
create or replace function public.store_credit_crd_preview(
 p_document_id uuid,
 p_staff_user_id uuid,
 p_document_sha256 text,
 p_balance numeric,
 p_balance_date date,
 p_selected_reader text,
 p_pairs_checked integer,
 p_pairs_valid integer,
 p_evidence jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_doc public.documents_sources%rowtype; v_id uuid;
begin
 if p_staff_user_id is null or not exists (
   select 1 from public.app_users a where a.auth_user_id=p_staff_user_id
     and a.actif and a.role in ('admin','cif')
 ) then raise exception 'Conseiller non autorisé'; end if;
 select * into v_doc from public.documents_sources where id=p_document_id;
 if not found or v_doc.categorie <> 'tableau_amortissement' or v_doc.statut_analyse <> 'validated' then
   raise exception 'Document de prêt non validé'; end if;
 if p_document_sha256 !~ '^[a-f0-9]{64}$'
   or (v_doc.hash_sha256 is not null and v_doc.hash_sha256<>p_document_sha256) then
   raise exception 'Empreinte du document incohérente'; end if;
 if p_selected_reader not in ('pdf_native','ocr_embedded_image')
   or p_balance is null or p_balance<0 or p_balance>1000000000
   or p_balance_date is null or p_balance_date>current_date
   or p_pairs_checked<5 or p_pairs_valid<5
   or p_pairs_valid::numeric / nullif(p_pairs_checked,0)<0.94
   or coalesce((p_evidence->>'disagreement')::boolean,false) then
     raise exception 'Contrôles du calcul CRD insuffisants'; end if;
 insert into public.credit_crd_previews(
  dossier_id,document_id,staff_user_id,document_sha256,balance,balance_date,
  parser,selected_reader,verification_status,pairs_checked,pairs_valid,evidence
 ) values (v_doc.dossier_id,p_document_id,p_staff_user_id,p_document_sha256,p_balance,p_balance_date,
    'credit_schedule_dual_v5',p_selected_reader,'verified',p_pairs_checked,p_pairs_valid,coalesce(p_evidence,'{}'::jsonb))
 returning id into v_id;
 return v_id;
end;$$;
revoke all on function public.store_credit_crd_preview(uuid,uuid,text,numeric,date,text,integer,integer,jsonb) from public,anon,authenticated;
grant execute on function public.store_credit_crd_preview(uuid,uuid,text,numeric,date,text,integer,integer,jsonb) to service_role;

-- Adviser confirmation: never accepts a numeric balance from the browser.
create or replace function public.confirm_credit_crd_preview(
 p_preview_id uuid,
 p_target_investisseur_id uuid,
 p_item_index integer,
 p_confirm_theoretical boolean,
 p_note text default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 v_preview public.credit_crd_previews%rowtype;
 v_doc public.documents_sources%rowtype;
 v_section public.recueil_sections%rowtype;
 v_old jsonb; v_new jsonb;
 v_target text; v_id uuid := auth.uid();
 v_previous text;
begin
 if not private.is_staff() or v_id is null then raise exception 'Accès réservé au conseiller'; end if;
 if p_confirm_theoretical is distinct from true then
   raise exception 'La nature théorique du CRD doit être confirmée'; end if;
 if p_item_index is null or p_item_index<0 or p_item_index>999 then
   raise exception 'Ligne de crédit invalide'; end if;
 select * into v_preview from public.credit_crd_previews
 where id=p_preview_id for update;
 if not found or v_preview.confirmed_at is not null
   or v_preview.expires_at<now() or v_preview.staff_user_id<>v_id then
   raise exception 'Prévisualisation expirée, déjà utilisée ou non autorisée'; end if;
 if v_preview.parser<>'credit_schedule_dual_v5'
   or v_preview.verification_status<>'verified'
   or v_preview.pairs_checked<5 or v_preview.pairs_valid::numeric/v_preview.pairs_checked<0.94
   or coalesce((v_preview.evidence->>'disagreement')::boolean,false)
   or v_preview.balance_date>current_date then raise exception 'Preuve CRD insuffisante'; end if;
 select * into v_doc from public.documents_sources where id=v_preview.document_id for update;
 if not found or v_doc.statut_analyse<>'validated'
   or v_doc.categorie<>'tableau_amortissement'
   or v_doc.dossier_id<>v_preview.dossier_id
   or (v_doc.hash_sha256 is not null and v_doc.hash_sha256<>v_preview.document_sha256) then
     raise exception 'Le document d’origine a changé ou n’est plus validé'; end if;
 v_target := p_target_investisseur_id::text || ':' || p_item_index::text;
 if v_doc.metadata#>>'{manual_review,target,kind}' <> 'credit'
    or v_doc.metadata#>>'{manual_review,target,key}' <> v_target then
   raise exception 'Le crédit ciblé ne correspond pas au rapprochement documentaire validé'; end if;
 select * into v_section from public.recueil_sections
 where dossier_id=v_doc.dossier_id and investisseur_id=p_target_investisseur_id
   and section_code='credits' for update;
 if not found or jsonb_typeof(v_section.payload->'items')<>'array'
   or p_item_index>=jsonb_array_length(v_section.payload->'items') then
   raise exception 'Crédit du recueil introuvable'; end if;
 v_old:=v_section.payload->'items'->p_item_index;
 if v_old->>'source_document_id'<>v_doc.id::text then
   raise exception 'Le crédit ne référence pas ce justificatif'; end if;
 v_previous:=nullif(v_old->>'capital_restant_du','');
 if v_previous is not null and v_previous<>'null' then
    raise exception 'Un CRD existe déjà : rapprochement manuel requis avant remplacement'; end if;
 if (v_old->>'montant_initial') is not null
    and v_preview.balance>(v_old->>'montant_initial')::numeric+0.5 then
   raise exception 'CRD supérieur au capital initial : vérifier le tableau'; end if;
 v_new := v_old || jsonb_build_object(
   'capital_restant_du',v_preview.balance,
   'capital_restant_du_date',v_preview.balance_date,
   'capital_restant_du_nature','theorique_echeancier',
   'capital_restant_du_source_document_id',v_doc.id,
   'capital_restant_du_validation_cif_at',now(),
   'capital_restant_du_validation_cif_by',v_id
 );
 update public.recueil_sections
 set payload=jsonb_set(payload,array['items',p_item_index::text],v_new,true),updated_at=now()
 where id=v_section.id;
 insert into public.data_provenance(
   dossier_id,investisseur_id,source_document_id,entity_table,entity_id,
   field_name,methode_collecte,statut_validation,valeur_source,valeur_retenue,
   justification_ecart,valide_par,date_validation,retained_by,retained_at
 ) values(
   v_doc.dossier_id,p_target_investisseur_id,v_doc.id,
   'recueil_sections',v_section.id,
   'credits.items['||p_item_index||'].capital_restant_du',
   'saisie_cif','retenu_cif',
   jsonb_build_object('balance',v_preview.balance,'as_of',v_preview.balance_date,
     'reader',v_preview.selected_reader,'pairs_checked',v_preview.pairs_checked,
     'pairs_valid',v_preview.pairs_valid,'source_hash',v_preview.document_sha256)::text,
   jsonb_build_object('balance',v_preview.balance,'as_of',v_preview.balance_date,
     'classification','theorique_echeancier','note',nullif(trim(coalesce(p_note,'')),''))::text,
   'CRD théorique du tableau d’amortissement calculé par double lecture et validé manuellement par le CIF ; non attesté par un solde bancaire.',
   v_id,now(),v_id,now()
 );
 update public.credit_crd_previews set confirmed_at=now(),confirmed_by=v_id where id=p_preview_id;
 insert into public.audit_log(dossier_id,actor_user_id,action,entity_table,entity_id,before_data,after_data,metadata)
 values(v_doc.dossier_id,v_id,'credit_crd_theoretical_confirmed','recueil_sections',v_section.id,v_old,v_new,
 jsonb_build_object('preview_id',p_preview_id,'source_document_id',v_doc.id,
  'source_sha256',v_preview.document_sha256,'balance_date',v_preview.balance_date,
  'pairs_checked',v_preview.pairs_checked,'pairs_valid',v_preview.pairs_valid,
  'reader',v_preview.selected_reader,'classification','theorique_echeancier'));
 return jsonb_build_object('ok',true,'classification','theorique_echeancier',
  'balance',v_preview.balance,'balance_date',v_preview.balance_date,'target_key',v_target);
end;$$;
revoke all on function public.confirm_credit_crd_preview(uuid,uuid,integer,boolean,text) from public,anon;
grant execute on function public.confirm_credit_crd_preview(uuid,uuid,integer,boolean,text) to authenticated,service_role;
