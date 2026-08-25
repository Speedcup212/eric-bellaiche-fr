import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ClientRecueilJourneyPage from './ClientRecueilJourneyPage';
import { supabase } from '../../lib/supabase';
import { fetchPortalProgress, messageFromError, selectedProgress, type PortalProgress } from '../../portal/portalHelpers';

export default function ClientRecueilEntryPage() {
  const [searchParams] = useSearchParams();
  const dossierId = searchParams.get('dossier');
  const [progress, setProgress] = useState<PortalProgress | null>(null);
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
        .select('completed_at')
        .eq('dossier_id', selected.dossier_id)
        .eq('investisseur_id', selected.investisseur_id)
        .eq('section_code', 'family')
        .maybeSingle();
      if (error) throw error;
      if (!active) return;
      setFamilyReady(Boolean(data?.completed_at));
    };

    void load()
      .catch((error) => { if (active) setErrorMessage(messageFromError(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [dossierId]);

  if (loading || familyReady === null) return <p className="text-sm text-slate-500">Chargement du recueil…</p>;
  if (errorMessage && !progress) return <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>;
  if (!progress) return <p className="text-sm text-slate-500">Dossier introuvable.</p>;

  if (!familyReady) return <ClientRecueilJourneyPage />;
  return <ClientRecueilJourneyPage />;
}
