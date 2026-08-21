import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Send, ShieldCheck } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { JourneyProgress, PageIntro, WizardCard } from '../../portal/FintechJourney';
import { dossierHref, fetchPortalProgress, messageFromError, nextStepHref, selectedProgress, stepLabel, type PortalProgress } from '../../portal/portalHelpers';

export default function ClientSummaryPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [rows, setRows] = useState<PortalProgress[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const dossierId = searchParams.get('dossier');
  const progress = useMemo(() => selectedProgress(rows, dossierId), [rows, dossierId]);

  useEffect(() => { void fetchPortalProgress().then(setRows).catch((error) => setErrorMessage(messageFromError(error))); }, []);

  if (!progress) return <p className="text-sm text-slate-500">Chargement du dossier…</p>;
  const allDone = progress.next_step === 'TERMINE';

  return (
    <div>
      <JourneyProgress current={allDone ? 'done' : progress.next_step === 'DOCUMENTS' ? 'documents' : progress.next_step === 'RECUEIL' ? 'recueil' : progress.next_step === 'QPI' ? 'qpi' : 'esg'} esgEnabled={progress.esg_opt_in !== false} />
      <PageIntro eyebrow="Dernière étape" title="Transmission au cabinet" description="Cette page confirme si toutes les informations attendues ont bien été enregistrées avant que le cabinet reprenne votre dossier pour analyse." icon={<Send className="h-5 w-5" />} />

      <WizardCard>
        <div className={`px-6 py-8 sm:px-9 sm:py-10 ${allDone ? 'bg-gradient-to-br from-emerald-50 via-white to-cyan-50' : 'bg-white'}`}>
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${allDone ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-700'}`}>
              {allDone ? <CheckCircle2 className="h-6 w-6" /> : <Clock3 className="h-6 w-6" />}
            </div>
            <div>
              <h3 className="text-2xl font-semibold tracking-tight text-slate-950">{allDone ? 'Votre dossier est complet' : 'Il reste une étape à terminer'}</h3>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{allDone ? 'Vos réponses et documents ont été enregistrés. Le cabinet peut maintenant procéder aux contrôles, à l’analyse patrimoniale et à la préparation des documents nécessaires avant toute recommandation.' : `Votre parcours n’est pas encore terminé. La prochaine action attendue est : ${stepLabel(progress.next_step)}.`}</p>
              {!allDone && <button type="button" onClick={() => navigate(nextStepHref(progress))} className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/10">{stepLabel(progress.next_step)}</button>}
            </div>
          </div>
        </div>

        {allDone && <div className="border-t border-slate-100 px-6 py-7 sm:px-9"><div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-5"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" /><div><p className="font-semibold text-slate-800">Aucune autre action immédiate</p><p className="mt-1 text-sm leading-6 text-slate-500">Le cabinet vous recontactera si une précision ou un justificatif complémentaire est nécessaire. Les documents réglementaires ou contrats à signer seront transmis séparément au moment approprié.</p></div></div><button type="button" onClick={() => navigate(dossierHref('/espace-client', progress.dossier_id))} className="mt-6 text-sm font-semibold text-slate-600 hover:text-slate-950">Retour à mon dossier</button></div>}
      </WizardCard>
      {errorMessage && <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>}
    </div>
  );
}
