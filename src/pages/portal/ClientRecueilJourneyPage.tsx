import { useEffect, useState } from 'react';
import { CheckCircle2, Pencil } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ClientRecueilJourneyBase from './ClientRecueilJourneyBase';
import RecueilUxEnhancements from './RecueilUxEnhancements';
import RecueilValidationVisuals from './RecueilValidationVisuals';
import { JourneyProgress, PageIntro, WizardCard } from '../../portal/FintechJourney';
import { supabase } from '../../lib/supabase';
import { dossierHref, fetchPortalProgress, messageFromError, selectedProgress, type PortalProgress } from '../../portal/portalHelpers';

export default function ClientRecueilJourneyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [progress, setProgress] = useState<PortalProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const dossierId = searchParams.get('dossier');

  useEffect(() => {
    let active = true;
    void fetchPortalProgress()
      .then((rows) => {
        if (!active) return;
        setProgress(selectedProgress(rows, dossierId));
      })
      .catch((error) => { if (active) setErrorMessage(messageFromError(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [dossierId]);

  const edit = async () => {
    if (!progress || progress.transmitted_at) return;
    setBusy(true);
    setErrorMessage('');
    try {
      const { error } = await supabase.rpc('reopen_my_recueil', { p_dossier_id: progress.dossier_id });
      if (error) throw error;
      setEditing(true);
    } catch (error) {
      setErrorMessage(messageFromError(error));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-sm text-slate-500">Chargement du recueil…</p>;
  if (errorMessage && !progress) return <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>;
  if (!progress) return <p className="text-sm text-slate-500">Dossier introuvable.</p>;

  if (!editing && progress.recueil_status === 'validated' && !progress.transmitted_at) {
    return <div>
      <JourneyProgress current="recueil" esgEnabled={progress.esg_opt_in !== false} />
      <PageIntro eyebrow="Étape 1" title="Recueil d’informations" description="Votre recueil est validé. Vous pouvez encore corriger ou compléter vos informations tant que le dossier n’a pas été transmis définitivement au cabinet." icon={<CheckCircle2 className="h-5 w-5" />} />
      <WizardCard className="p-8">
        <div className="rounded-2xl bg-emerald-50 p-5 text-emerald-800">
          <p className="font-semibold">Recueil validé</p>
          <p className="mt-1 text-sm leading-6">Toute modification sera enregistrée et vous devrez valider de nouveau le recueil avant de poursuivre.</p>
        </div>
        {errorMessage && <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={() => void edit()} className="inline-flex items-center gap-2 rounded-xl bg-[#0b1f3a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><Pencil className="h-4 w-4" /> {busy ? 'Ouverture…' : 'Modifier mon recueil'}</button>
          <button type="button" onClick={() => navigate(dossierHref('/espace-client/profil-investisseur', progress.dossier_id))} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">Continuer</button>
        </div>
      </WizardCard>
    </div>;
  }

  return <><RecueilUxEnhancements /><RecueilValidationVisuals /><ClientRecueilJourneyBase /></>;
}
