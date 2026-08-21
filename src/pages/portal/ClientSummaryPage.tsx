import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { dossierHref, fetchPortalProgress, messageFromError, selectedProgress, type PortalProgress } from '../../portal/portalHelpers';

export default function ClientSummaryPage() {
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<PortalProgress[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const dossierId = searchParams.get('dossier');
  const progress = useMemo(() => selectedProgress(rows, dossierId), [rows, dossierId]);

  useEffect(() => {
    void fetchPortalProgress()
      .then(setRows)
      .catch((error) => setErrorMessage(messageFromError(error)));
  }, []);

  if (!progress) return <p>Aucun dossier sélectionné.</p>;

  const allDone = progress.next_step === 'TERMINE';
  const nextHref = progress.next_step === 'RECUEIL'
    ? dossierHref('/espace-client/recueil', progress.dossier_id)
    : progress.next_step === 'QPI'
      ? dossierHref('/espace-client/profil-investisseur', progress.dossier_id)
      : dossierHref('/espace-client/esg', progress.dossier_id);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Fin du parcours</p>
        <h2 className="mt-2 text-3xl font-semibold">Transmission au cabinet</h2>
      </div>

      <section className={`rounded-3xl border p-6 sm:p-8 ${allDone ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
        <div className="flex gap-4">
          {allDone ? <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-700" /> : <Clock3 className="h-7 w-7 shrink-0 text-slate-500" />}
          <div>
            <h3 className="text-xl font-semibold">{allDone ? 'Votre dossier est transmis' : 'Votre dossier n’est pas encore complet'}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {allDone
                ? 'Vos réponses sont enregistrées. Le cabinet reprend maintenant votre dossier pour les contrôles, l’analyse et la préparation des documents réglementaires nécessaires.'
                : 'Il reste une étape à compléter avant transmission au cabinet.'}
            </p>
            {!allDone && <Link to={nextHref} className="mt-4 inline-block font-semibold text-slate-900 underline">Poursuivre mon dossier</Link>}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <h3 className="text-lg font-semibold">Et maintenant ?</h3>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Aucune action supplémentaire n’est demandée tant que le cabinet ne vous recontacte pas. Les éventuels documents à signer vous seront transmis séparément selon l’avancement de votre dossier.
        </p>
      </section>

      {errorMessage && <p className="rounded-2xl bg-red-50 p-4 text-red-700">{errorMessage}</p>}
    </div>
  );
}
