import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ClientRecueilJourneyBase from './ClientRecueilJourneyBase';
import { supabase } from '../../lib/supabase';
import { fetchPortalProgress, messageFromError, selectedProgress } from '../../portal/portalHelpers';

export default function ClientRecueilJourneyPage() {
  const [searchParams] = useSearchParams();
  const [ready, setReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const dossierId = searchParams.get('dossier');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const rows = await fetchPortalProgress();
        const progress = selectedProgress(rows, dossierId);
        if (progress && progress.recueil_status === 'validated' && !progress.transmitted_at) {
          const { error } = await supabase.rpc('reopen_my_recueil', { p_dossier_id: progress.dossier_id });
          if (error) throw error;
        }
        if (active) setReady(true);
      } catch (error) {
        if (active) {
          setErrorMessage(messageFromError(error));
          setReady(true);
        }
      }
    })();
    return () => { active = false; };
  }, [dossierId]);

  if (!ready) return <p className="text-sm text-slate-500">Ouverture du recueil…</p>;
  if (errorMessage) return <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>;
  return <ClientRecueilJourneyBase />;
}
