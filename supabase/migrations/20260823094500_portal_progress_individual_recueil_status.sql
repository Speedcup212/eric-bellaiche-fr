create or replace view public.portal_progress as
select
  d.id as dossier_id,
  di.investisseur_id,
  di.role_dossier,
  d.reference,
  d.libelle,
  di.recueil_status as recueil_status,
  di.qpi_status,
  di.esg_opt_in,
  di.esg_status,
  qpi.id as qpi_session_id,
  esg.id as esg_session_id,
  case
    when di.recueil_status <> 'validated' then 'RECUEIL'::text
    when di.qpi_status not in ('completed','validated') then 'QPI'::text
    when di.esg_opt_in is true and di.esg_status not in ('completed','validated') then 'ESG'::text
    when di.documents_status <> 'completed' then 'DOCUMENTS'::text
    else 'TERMINE'::text
  end as next_step,
  di.recueil_status as recueil_individual_status,
  di.recueil_validated_at,
  di.documents_status,
  di.documents_completed_at,
  di.transmitted_at,
  agg.members_total as dossier_members_total,
  agg.members_ready as dossier_members_ready,
  (agg.members_total > 0 and agg.members_total = agg.members_ready) as dossier_ready_for_documents,
  (agg.members_total > 1) as is_couple,
  agg.partner_activated,
  d.recueil_status as dossier_recueil_status
from public.dossiers d
join public.dossier_investisseurs di on di.dossier_id=d.id
join public.investisseurs i on i.id=di.investisseur_id
left join lateral (
  select qs.id
  from public.questionnaire_sessions qs
  join public.questionnaire_templates qt on qt.id=qs.template_id
  where qs.dossier_id=d.id and qs.investisseur_id=di.investisseur_id and qt.type_questionnaire='QPI'
  order by qs.created_at desc limit 1
) qpi on true
left join lateral (
  select qs.id
  from public.questionnaire_sessions qs
  join public.questionnaire_templates qt on qt.id=qs.template_id
  where qs.dossier_id=d.id and qs.investisseur_id=di.investisseur_id and qt.type_questionnaire='ESG'
  order by qs.created_at desc limit 1
) esg on true
left join lateral (
  select
    count(*)::int as members_total,
    count(*) filter(where dx.recueil_status='validated' and dx.qpi_status in ('completed','validated') and (dx.esg_opt_in is not true or dx.esg_status in ('completed','validated')))::int as members_ready,
    coalesce(bool_or(ix.auth_user_id is not null) filter(where dx.investisseur_id<>di.investisseur_id),false) as partner_activated
  from public.dossier_investisseurs dx
  join public.investisseurs ix on ix.id=dx.investisseur_id
  where dx.dossier_id=d.id
) agg on true
where (select private.is_staff()) or i.auth_user_id=(select auth.uid());

grant select on public.portal_progress to authenticated;
