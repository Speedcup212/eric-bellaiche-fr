import { useEffect, useState } from 'react';
import { CheckCircle2, Pencil } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import QuestionnairePageBase, { QpiResultSummary, type QpiResultRow } from './QuestionnairePageBase';
import { JourneyProgress, PageIntro, WizardCard } from '../../portal/FintechJourney';
import { supabase } from '../../lib/supabase';
import { fetchPortalProgress, messageFromError, nextStepHref, selectedProgress, type PortalProgress } from '../../portal/portalHelpers';

type Mode = 'QPI' | 'ESG';

export default function QuestionnairePage({ mode }: { mode: Mode }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [progress, setProgress] = useState<PortalProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [qpiResult, setQpiResult] = useState<QpiResultRow | null>(null);
  const dossierId = searchParams.get('dossier');

  useEffect(() => {
    let active = true;
    void fetchPortalProgress()
      .then(async (rows) => {
        if (!active) return;
        const selected = selectedProgress(rows, dossierId);
        setProgress(selected);
        if (mode === 'QPI' && selected?.qpi_session_id && ['completed', 'validated'].includes(selected.qpi_status)) {
          const { data, error } = await supabase.from('qpi_results').select('profil_indicatif,profil_operationnel_final,ecart_declared_objective,synthese_dimensions').eq('session_id', selected.qpi_session_id).maybeSingle();
          if (error) throw error;
          if (active && data) setQpiResult(data as QpiResultRow);
        }
      })
      .catch((error) => { if (active) setErrorMessage(messageFromError(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [dossierId, mode]);

  const edit = async () => {
    if (!progress || progress.transmitted_at) return;
    const sessionId = mode === 'QPI' ? progress.qpi_session_id : progress.esg_session_id;
    if (!sessionId) return;
    setBusy(true);
    setErrorMessage('');
    try {
      const { error } = await supabase.rpc('reopen_questionnaire_session', { p_session_id: sessionId });
      if (error) throw error;
      setEditing(true);
    } catch (error) {
      setErrorMessage(messageFromError(error));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-sm text-slate-500">Chargement du questionnaire…</p>;
  if (errorMessage && !progress) return <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>;
  if (!progress) return <p className="text-sm text-slate-500">Dossier introuvable.</p>;

  const status = mode === 'QPI' ? progress.qpi_status : progress.esg_status;
  const completed = ['completed', 'validated'].includes(status);
  const title = mode === 'QPI' ? 'Profil investisseur' : 'Préférences de durabilité';
  const eyebrow = mode === 'QPI' ? 'Étape 2' : 'Étape 3';
  const stage = mode === 'QPI' ? 'qpi' : 'esg';
  const continueLabel = mode === 'QPI'
    ? (progress.esg_opt_in === true ? 'Continuer vers mes préférences de durabilité' : 'Continuer vers les documents')
    : 'Continuer vers les documents';

  if (!editing && completed && !progress.transmitted_at) {
    return <div>
      <JourneyProgress current={stage} esgEnabled={progress.esg_opt_in !== false} />
      <PageIntro eyebrow={eyebrow} title={title} description="Ce questionnaire est terminé. Vous pouvez encore modifier vos réponses tant que le dossier n’a pas été transmis définitivement au cabinet." icon={<CheckCircle2 className="h-5 w-5" />} />
      <WizardCard className="p-8">
        {mode === 'QPI' ? <QpiResultSummary result={qpiResult} /> : <div className="rounded-2xl bg-emerald-50 p-5 text-emerald-800"><p className="font-semibold">Questionnaire validé</p><p className="mt-1 text-sm leading-6">Vos préférences de durabilité sont enregistrées.</p></div>}
        <p className="mt-5 text-sm leading-6 text-slate-500">Vous pouvez modifier vos réponses tant que le dossier n’est pas transmis. Une nouvelle validation recalculera le résultat et conservera la traçabilité.</p>
        {progress.is_couple && !progress.dossier_ready_for_documents && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">Votre partie individuelle est enregistrée. Le dossier commun ne pourra être transmis définitivement qu’après la complétion des deux parcours individuels.</p>}
        {errorMessage && <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => navigate(nextStepHref(progress))} className="rounded-xl bg-[#3B82F6] px-5 py-3 text-sm font-semibold text-white">{continueLabel}</button>
          <button type="button" disabled={busy} onClick={() => void edit()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50"><Pencil className="h-4 w-4" /> {busy ? 'Ouverture…' : 'Modifier mes réponses'}</button>
        </div>
      </WizardCard>
    </div>;
  }

  return <QuestionnairePageBase mode={mode} />;
}
