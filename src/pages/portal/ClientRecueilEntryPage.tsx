import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, UsersRound } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ClientRecueilJourneyPage from './ClientRecueilJourneyPage';
import { JourneyProgress, PageIntro, WizardCard } from '../../portal/FintechJourney';
import { supabase } from '../../lib/supabase';
import { dossierHref, fetchPortalProgress, messageFromError, selectedProgress, type PortalProgress } from '../../portal/portalHelpers';

type FamilyPayload = {
  dossier_scope?: 'individual' | 'couple' | '';
  situation?: string;
  date_evenement?: string;
  regime_convention?: string;
  nombre_enfants?: string | number;
};

const coupleSituations = ['Marié', 'Pacsé', 'Concubinage'];

export default function ClientRecueilEntryPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dossierId = searchParams.get('dossier');
  const [progress, setProgress] = useState<PortalProgress | null>(null);
  const [family, setFamily] = useState<FamilyPayload | null>(null);
  const [familyReady, setFamilyReady] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      const rows = await fetchPortalProgress();
      const selected = selectedProgress(rows, dossierId);
      if (!active) return;
      setProgress(selected);
      if (!selected) return;

      const { data, error } = await supabase
        .from('recueil_sections')
        .select('payload,completed_at')
        .eq('dossier_id', selected.dossier_id)
        .eq('investisseur_id', selected.investisseur_id)
        .eq('section_code', 'family')
        .maybeSingle();
      if (error) throw error;
      if (!active) return;
      setFamily((data?.payload ?? {}) as FamilyPayload);
      setFamilyReady(Boolean(data?.completed_at));
    };

    void load()
      .catch((error) => { if (active) setErrorMessage(messageFromError(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [dossierId]);

  const scope = useMemo(() => {
    if (!family) return '';
    if (family.dossier_scope) return family.dossier_scope;
    return coupleSituations.includes(String(family.situation ?? '')) ? 'couple' : family.situation ? 'individual' : '';
  }, [family]);

  if (loading || familyReady === null) return <p className="text-sm text-slate-500">Chargement du recueil…</p>;
  if (errorMessage && !progress) return <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>;
  if (!progress) return <p className="text-sm text-slate-500">Dossier introuvable.</p>;

  // Premier passage : l'écran historique reste l'écran de constitution du foyer.
  if (!familyReady) return <ClientRecueilJourneyPage />;

  const isCouple = scope === 'couple';
  const identifierNumber = progress.role_dossier === 'investisseur_1' ? 1 : 2;
  const identifierLabel = `Identifiant ${identifierNumber}`;
  const personLabel = `Personne ${identifierNumber}`;
  const legalDetails = ['Marié', 'Pacsé'].includes(String(family?.situation ?? ''));

  const scopeCardClass = (selected: boolean) => `rounded-2xl border p-5 text-left transition ${selected
    ? 'border-[#3B82F6] bg-[#EFF6FF] ring-2 ring-blue-400/20 shadow-sm'
    : 'border-[#CBD5E1] bg-white'
  }`;

  return (
    <div className="recueil-safe">
      <JourneyProgress current="recueil" esgEnabled={progress.esg_opt_in !== false} />
      <PageIntro
        variant="recueil"
        eyebrow={`Étape 1 · ${identifierLabel}`}
        title="Qui est concerné par ce dossier ?"
        description="Cette première page rappelle le périmètre du dossier avant d'accéder aux informations personnelles de chaque personne."
        icon={<UsersRound className="h-5 w-5" />}
      />

      <WizardCard className="p-6 sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-600">Parcours en cours</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{identifierLabel} — {personLabel}</p>
          </div>
          <span className="rounded-full bg-[#0B1F3A] px-3 py-1.5 text-xs font-bold text-white">Vous êtes l’{identifierLabel.toLowerCase()}</span>
        </div>

        <p className="text-sm font-semibold text-slate-800">Ce dossier concerne :</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className={scopeCardClass(scope === 'individual')}>
            <span className="block font-semibold text-slate-900">Une seule personne</span>
            <span className="mt-1 block text-sm leading-6 text-slate-600">1 recueil, 1 profil investisseur et 1 questionnaire de durabilité si applicable.</span>
          </div>
          <div className={scopeCardClass(scope === 'couple')}>
            <span className="block font-semibold text-slate-900">Un couple</span>
            <span className="mt-1 block text-sm leading-6 text-slate-600">2 personnes : chacun conserve son recueil personnel, son profil investisseur et ses préférences de durabilité.</span>
          </div>
        </div>

        {isCouple && <div className="mt-5 rounded-2xl border border-blue-200 bg-[#F5F9FF] p-5 text-sm leading-6 text-slate-700">
          <p className="font-semibold text-[#0B1F3A]">Règle du dossier couple</p>
          <div className="mt-2 space-y-2">
            <p><strong>Identifiant 1 :</strong> constitue le dossier couple, renseigne les informations communes du foyer et complète son propre parcours personnel.</p>
            <p><strong>Identifiant 2 :</strong> active ensuite son propre accès sécurisé et complète son recueil personnel, son profil investisseur et ses préférences de durabilité si elles sont applicables.</p>
            <p><strong>Les informations communes du couple ne sont saisies qu’une seule fois.</strong> Elles sont reprises automatiquement pour l’Identifiant 2 et ne lui sont pas redemandées.</p>
          </div>
        </div>}

        <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{identifierLabel} — votre parcours personnel</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {isCouple
                  ? `Vous êtes actuellement l’${identifierLabel.toLowerCase()}. Les informations communes du couple sont déjà enregistrées ; vous allez maintenant compléter uniquement les informations qui vous concernent personnellement.`
                  : 'Vous poursuivez maintenant votre recueil personnel.'}
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Périmètre enregistré</span>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Situation familiale</p>
            <p className="mt-1 font-semibold text-slate-900">{family?.situation || 'Non renseignée'}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Nombre d'enfants</p>
            <p className="mt-1 font-semibold text-slate-900">{String(family?.nombre_enfants ?? 'Non renseigné')}</p>
          </div>
          {legalDetails && <>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Date mariage / PACS</p>
              <p className="mt-1 font-semibold text-slate-900">{family?.date_evenement ? String(family.date_evenement).slice(0, 7) : 'Non renseignée'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Régime / convention</p>
              <p className="mt-1 font-semibold text-slate-900">{family?.regime_convention || 'Non renseigné'}</p>
            </div>
          </>}
        </div>

        {errorMessage && <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>}
        <button
          type="button"
          onClick={() => navigate(dossierHref('/espace-client/recueil/parcours', progress.dossier_id))}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#3B82F6] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/20 transition hover:bg-[#2563EB]"
        >
          Continuer le recueil — {identifierLabel} <ArrowRight className="h-4 w-4" />
        </button>
      </WizardCard>
    </div>
  );
}
