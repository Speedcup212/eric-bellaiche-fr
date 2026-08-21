import { supabase } from '../lib/supabase';

export interface PortalProgress {
  dossier_id: string;
  investisseur_id: string;
  role_dossier: 'investisseur_1' | 'investisseur_2';
  reference: string | null;
  libelle: string | null;
  recueil_status: string;
  qpi_status: string;
  esg_opt_in: boolean | null;
  esg_status: string;
  qpi_session_id: string | null;
  esg_session_id: string | null;
  next_step: 'RECUEIL' | 'QPI' | 'ESG' | 'TERMINE';
}

export function messageFromError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const value = (error as { message?: unknown }).message;
    if (typeof value === 'string') return value;
  }
  return 'Une erreur inattendue est survenue.';
}

export function dossierHref(path: string, dossierId: string): string {
  return `${path}?dossier=${encodeURIComponent(dossierId)}`;
}

export function nextStepHref(progress: PortalProgress): string {
  switch (progress.next_step) {
    case 'RECUEIL':
      return dossierHref('/espace-client/recueil', progress.dossier_id);
    case 'QPI':
      return dossierHref('/espace-client/profil-investisseur', progress.dossier_id);
    case 'ESG':
      return dossierHref('/espace-client/esg', progress.dossier_id);
    default:
      return dossierHref('/espace-client/synthese', progress.dossier_id);
  }
}

export function stepLabel(step: PortalProgress['next_step']): string {
  switch (step) {
    case 'RECUEIL':
      return 'Compléter le recueil';
    case 'QPI':
      return 'Profil investisseur';
    case 'ESG':
      return 'Préférences de durabilité';
    default:
      return 'Parcours questionnaires terminé';
  }
}

export async function fetchPortalProgress(): Promise<PortalProgress[]> {
  const { data, error } = await supabase
    .from('portal_progress')
    .select('*')
    .order('reference', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PortalProgress[];
}

export function selectedProgress(
  rows: PortalProgress[],
  dossierId: string | null,
): PortalProgress | null {
  if (rows.length === 0) return null;
  if (!dossierId) return rows[0];
  return rows.find((row) => row.dossier_id === dossierId) ?? rows[0];
}
