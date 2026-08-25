import { supabase } from '../lib/supabase';

export interface PortalProgress {
  dossier_id: string;
  investisseur_id: string;
  role_dossier: 'investisseur_1' | 'investisseur_2';
  reference: string | null;
  libelle: string | null;
  recueil_status: string;
  dossier_recueil_status: string;
  qpi_status: string;
  esg_opt_in: boolean | null;
  esg_status: string;
  qpi_session_id: string | null;
  esg_session_id: string | null;
  documents_status: 'pending' | 'in_progress' | 'completed';
  documents_completed_at: string | null;
  transmitted_at: string | null;
  dossier_members_total: number;
  dossier_members_ready: number;
  dossier_ready_for_documents: boolean;
  is_couple: boolean;
  partner_activated: boolean;
  next_step: 'DOCUMENTS' | 'RECUEIL' | 'QPI' | 'ESG' | 'TERMINE';
}

function friendlyTechnicalMessage(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid input syntax for type date') || normalized.includes('date professionnelle invalide')) {
    return 'La date saisie n’est pas valide. Vérifiez le mois et l’année puis réessayez.';
  }
  if (normalized.includes('permission denied')) {
    return 'Cette action n’a pas pu être enregistrée. Actualisez la page puis réessayez. Si le problème persiste, contactez le cabinet.';
  }
  return message;
}

export function messageFromError(error: unknown): string {
  if (error instanceof Error) return friendlyTechnicalMessage(error.message);
  if (typeof error === 'string') return friendlyTechnicalMessage(error);
  if (error && typeof error === 'object' && 'message' in error) {
    const value = (error as { message?: unknown }).message;
    if (typeof value === 'string') return friendlyTechnicalMessage(value);
  }
  return 'Une erreur inattendue est survenue. Actualisez la page puis réessayez.';
}

export function dossierHref(path: string, dossierId: string): string {
  return `${path}?dossier=${encodeURIComponent(dossierId)}`;
}

export function nextStepHref(progress: PortalProgress): string {
  // A questionnaire can render its completion screen for one React render before
  // portal_progress has refreshed. In that short window, progress.next_step still
  // points to the questionnaire that has just been completed. Route explicitly
  // from the current questionnaire so the CTA can never loop back to itself.
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname.replace(/\/$/, '');
    if (pathname === '/espace-client/esg') {
      return dossierHref('/espace-client/documents', progress.dossier_id);
    }
    if (pathname === '/espace-client/profil-investisseur') {
      return dossierHref(
        progress.esg_opt_in === true ? '/espace-client/esg' : '/espace-client/documents',
        progress.dossier_id,
      );
    }
  }

  switch (progress.next_step) {
    case 'DOCUMENTS':
      return dossierHref('/espace-client/documents', progress.dossier_id);
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
    case 'DOCUMENTS':
      return 'Transmettre mes documents';
    case 'RECUEIL':
      return 'Compléter le recueil';
    case 'QPI':
      return 'Profil investisseur';
    case 'ESG':
      return 'Préférences de durabilité';
    default:
      return 'Dossier terminé';
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
  if (!dossierId) return rows.length === 1 ? rows[0] : null;
  return rows.find((row) => row.dossier_id === dossierId) ?? null;
}
