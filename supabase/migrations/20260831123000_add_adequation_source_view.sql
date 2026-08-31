create or replace view public.adequation_source
with (security_invoker = true)
as
select
  ar.dossier_id,
  ar.id as audit_recommendation_id,
  ar.validated_at,
  ar.diagnostic,
  ar.projet_a_preserver,
  ar.reserve_securite,
  ar.epargne_a_arbitrer,
  ar.allocation,
  ar.supports,
  ar.sequencing,
  ar.fiscal_notes,
  ar.protection_notes,
  ar.controls
from public.audit_recommendations ar
where ar.statut = 'validated'
  and ar.validated_at is not null;

comment on view public.adequation_source is
  'Source réglementaire de la déclaration d’adéquation : reprend exclusivement la recommandation d’audit validée par le conseiller, sans recalculer ni modifier allocation ou supports.';
