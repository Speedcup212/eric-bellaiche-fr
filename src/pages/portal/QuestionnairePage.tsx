import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import QuestionnairePageBase from './QuestionnairePageBase';
import { supabase } from '../../lib/supabase';
import { fetchPortalProgress, messageFromError, selectedProgress } from '../../portal/portalHelpers';

type Mode = 'QPI' | 'ESG';

export default function QuestionnairePage({ mode }: { mode: Mode }) {
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
        if (progress && !progress.transmitted_at) {
          const status = mode === 'QPI' ? progress.qpi_status : progress.esg_status;
          const sessionId = mode === 'QPI' ? progress.qpi_session_id : progress.esg_session_id;
          if (sessionId && ['completed', 'validated'].includes(status)) {
            const { error } = await supabase.rpc('reopen_questionnaire_session', { p_session_id: sessionId });
            if (error) throw error;
          }
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
  }, [dossierId, mode]);

  if (!ready) return <p className="text-sm text-slate-500">Ouverture du questionnaire…</p>;
  if (errorMessage) return <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>;
  return <QuestionnairePageBase mode={mode} />;
}
