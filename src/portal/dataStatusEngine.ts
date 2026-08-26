export type DataStatus = 'declared' | 'extracted' | 'to_review' | 'verified' | 'retained' | 'rejected';

export type DataStatusInput = {
  methode_collecte?: string | null;
  statut_validation?: string | null;
  valeur_source?: string | null;
  valeur_retenue?: string | null;
  source_document_id?: string | null;
  date_validation?: string | null;
  verified_at?: string | null;
  retained_at?: string | null;
};

export type DataStatusView = {
  status: DataStatus;
  label: string;
  effectiveValue: string | null;
  hasSourceDocument: boolean;
  isVerified: boolean;
  isRetainedByCif: boolean;
};

const normalized = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();

export function resolveDataStatus(input: DataStatusInput): DataStatusView {
  const validation = normalized(input.statut_validation);
  const method = normalized(input.methode_collecte);
  let status: DataStatus;

  if (validation === 'rejete' || validation === 'rejected') status = 'rejected';
  else if (validation === 'retenu_cif' || validation === 'retained') status = 'retained';
  else if (validation === 'verifie' || validation === 'valide_cif' || validation === 'verified') status = 'verified';
  else if (validation === 'a_verifier' || validation === 'to_review') status = 'to_review';
  else if (validation === 'extrait' || method === 'extraction_document') status = 'extracted';
  else status = 'declared';

  const labels: Record<DataStatus, string> = {
    declared: 'Déclaré par le client',
    extracted: 'Extrait d’un justificatif',
    to_review: 'À vérifier',
    verified: 'Vérifié',
    retained: 'Retenu par le CIF',
    rejected: 'Écart rejeté',
  };

  return {
    status,
    label: labels[status],
    effectiveValue: status === 'retained' && input.valeur_retenue != null ? input.valeur_retenue : input.valeur_source ?? null,
    hasSourceDocument: Boolean(input.source_document_id),
    isVerified: status === 'verified' || status === 'retained',
    isRetainedByCif: status === 'retained',
  };
}

export function canUseForRegulatoryGeneration(input: DataStatusInput): boolean {
  const status = resolveDataStatus(input).status;
  return status === 'verified' || status === 'retained';
}

export function requiresCifReview(input: DataStatusInput): boolean {
  const status = resolveDataStatus(input).status;
  return status === 'declared' || status === 'extracted' || status === 'to_review';
}
