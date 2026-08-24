create table if not exists public.document_context_answers (
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  investisseur_id uuid not null references public.investisseurs(id) on delete cascade,
  tax_status text check (tax_status in ('personal_notice','attached_parents','no_personal_notice')),
  has_liquidities boolean,
  has_financial_assets boolean,
  has_real_estate boolean,
  has_credits boolean,
  has_sci_company boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (dossier_id, investisseur_id)
);

alter table public.document_context_answers enable row level security;

drop policy if exists document_context_select_dossier_members on public.document_context_answers;
create policy document_context_select_dossier_members
on public.document_context_answers
for select
to authenticated
using (
  exists (
    select 1
    from public.dossier_investisseurs di_me
    join public.investisseurs i_me on i_me.id = di_me.investisseur_id
    where di_me.dossier_id = document_context_answers.dossier_id
      and i_me.auth_user_id = auth.uid()
  )
);

drop policy if exists document_context_insert_own on public.document_context_answers;
create policy document_context_insert_own
on public.document_context_answers
for insert
to authenticated
with check (
  exists (
    select 1
    from public.dossier_investisseurs di_me
    join public.investisseurs i_me on i_me.id = di_me.investisseur_id
    where di_me.dossier_id = document_context_answers.dossier_id
      and di_me.investisseur_id = document_context_answers.investisseur_id
      and i_me.auth_user_id = auth.uid()
  )
);

drop policy if exists document_context_update_own on public.document_context_answers;
create policy document_context_update_own
on public.document_context_answers
for update
to authenticated
using (
  exists (
    select 1
    from public.dossier_investisseurs di_me
    join public.investisseurs i_me on i_me.id = di_me.investisseur_id
    where di_me.dossier_id = document_context_answers.dossier_id
      and di_me.investisseur_id = document_context_answers.investisseur_id
      and i_me.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.dossier_investisseurs di_me
    join public.investisseurs i_me on i_me.id = di_me.investisseur_id
    where di_me.dossier_id = document_context_answers.dossier_id
      and di_me.investisseur_id = document_context_answers.investisseur_id
      and i_me.auth_user_id = auth.uid()
  )
);

grant select, insert, update on public.document_context_answers to authenticated;

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
  v_required_liquidities boolean;
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
    and dca.has_liquidities is not null
    and dca.has_financial_assets is not null
    and dca.has_real_estate is not null
    and dca.has_credits is not null
    and dca.has_sci_company is not null;

  if v_context_ready<>v_total then
    raise exception 'Chaque personne du dossier doit d’abord préciser sa situation documentaire avant la transmission finale.';
  end if;

  select count(*) into v_identity_count
  from public.documents_sources ds
  where ds.dossier_id=p_dossier_id and ds.categorie='identite';
  if v_identity_count<v_total then
    raise exception 'Ajoutez une pièce d’identité pour chaque personne du dossier.';
  end if;

  if not exists(select 1 from public.documents_sources ds where ds.dossier_id=p_dossier_id and ds.categorie='justificatif_domicile') then
    raise exception 'Ajoutez au moins un justificatif de domicile pour le dossier.';
  end if;

  select
    bool_or(dca.tax_status='personal_notice'),
    bool_or(dca.has_liquidities),
    bool_or(dca.has_financial_assets),
    bool_or(dca.has_real_estate),
    bool_or(dca.has_credits),
    bool_or(dca.has_sci_company)
  into v_required_tax,v_required_liquidities,v_required_assets,v_required_real_estate,v_required_credits,v_required_sci
  from public.document_context_answers dca
  where dca.dossier_id=p_dossier_id;

  if coalesce(v_required_tax,false) and not exists(select 1 from public.documents_sources ds where ds.dossier_id=p_dossier_id and ds.categorie='avis_imposition') then
    raise exception 'Ajoutez l’avis d’imposition indiqué comme disponible.';
  end if;
  if coalesce(v_required_liquidities,false) and not exists(select 1 from public.documents_sources ds where ds.dossier_id=p_dossier_id and ds.categorie='comptes_liquidites') then
    raise exception 'Ajoutez un relevé de comptes bancaires ou de liquidités.';
  end if;
  if coalesce(v_required_assets,false) and not exists(select 1 from public.documents_sources ds where ds.dossier_id=p_dossier_id and ds.categorie='patrimoine_financier') then
    raise exception 'Ajoutez un relevé de placement ou d’épargne.';
  end if;
  if coalesce(v_required_real_estate,false) and not exists(select 1 from public.documents_sources ds where ds.dossier_id=p_dossier_id and ds.categorie='patrimoine_immobilier') then
    raise exception 'Ajoutez un justificatif de patrimoine immobilier.';
  end if;
  if coalesce(v_required_credits,false) and not exists(select 1 from public.documents_sources ds where ds.dossier_id=p_dossier_id and ds.categorie='tableau_amortissement') then
    raise exception 'Ajoutez le tableau d’amortissement ou le justificatif du crédit en cours.';
  end if;
  if coalesce(v_required_sci,false) and not exists(select 1 from public.documents_sources ds where ds.dossier_id=p_dossier_id and ds.categorie='sci_societe') then
    raise exception 'Ajoutez les documents utiles concernant la SCI ou la société.';
  end if;

  select count(*) into v_count from public.documents_sources ds where ds.dossier_id=p_dossier_id;
  if v_count=0 then raise exception 'Transmettez au moins un document avant de terminer cette étape.'; end if;

  select jsonb_build_object(
    'dossier_id',p_dossier_id,'members_total',v_total,'members_ready',v_ready,
    'document_context_ready',v_context_ready,
    'documents_count',v_count,
    'required',jsonb_build_object(
      'identity_count',v_total,
      'domicile',true,
      'tax',coalesce(v_required_tax,false),
      'liquidities',coalesce(v_required_liquidities,false),
      'financial_assets',coalesce(v_required_assets,false),
      'real_estate',coalesce(v_required_real_estate,false),
      'credits',coalesce(v_required_credits,false),
      'sci_company',coalesce(v_required_sci,false)
    ),
    'transmitted_at',v_now
  ) into v_progress;

  update public.dossier_investisseurs
     set documents_status='completed',documents_completed_at=v_now,transmitted_at=v_now,transmission_snapshot=v_progress,updated_at=v_now
   where dossier_id=p_dossier_id;

  insert into public.validations(dossier_id,investisseur_id,objet_type,objet_id,type_validation,statut,methode,commentaire,valide_par,validated_at)
  values(p_dossier_id,v_investisseur_id,'dossier',p_dossier_id,'transmission_finale_dossier','accepted','parcours_securise','Transmission finale du dossier commun après complétion de tous les parcours individuels et contrôle des justificatifs attendus',v_uid,v_now);
end;
$function$;
