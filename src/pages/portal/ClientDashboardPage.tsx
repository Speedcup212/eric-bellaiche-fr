import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Circle, FileText, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { dossierHref, fetchPortalProgress, messageFromError, nextStepHref, stepLabel, type PortalProgress } from '../../portal/portalHelpers';

function StatusLine({ label, done }: { label: string; done: boolean }) {
  return <div className="flex items-center gap-2 text-sm text-slate-600">{done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-slate-300" />} {label}</div>;
}

export default function ClientDashboardPage() {
  const [rows, setRows] = useState<PortalProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    void fetchPortalProgress()
      .then(setRows)
      .catch((error) => setErrorMessage(messageFromError(error)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-600">Chargement de votre dossier…</p>;
  if (errorMessage) return <p className="rounded-2xl bg-red-50 p-4 text-red-700">{errorMessage}</p>;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Parcours réglementaire</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Votre espace client</h2>
        <p className="mt-3 max-w-3xl text-slate-600">Complétez les étapes demandées. Les questionnaires sont individualisés pour chaque investisseur et les préférences ESG ne sont proposées que lorsque vous avez choisi de les exprimer dans le Recueil.</p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8">
          <ShieldCheck className="h-8 w-8 text-slate-400" />
          <h3 className="mt-4 text-xl font-semibold">Aucun dossier rattaché</h3>
          <p className="mt-2 text-slate-600">Votre compte est actif mais aucun dossier n’est encore rattaché. Vérifiez que vous avez utilisé le lien d’invitation du cabinet.</p>
        </div>
      ) : rows.map((row) => (
        <section key={`${row.dossier_id}-${row.investisseur_id}`} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{row.reference || 'Dossier client'}</p>
              <h3 className="mt-1 text-xl font-semibold">{row.libelle || 'Accompagnement patrimonial'}</h3>
              <p className="mt-2 text-sm text-slate-500">{row.role_dossier === 'investisseur_1' ? 'Investisseur 1' : 'Investisseur 2'}</p>
            </div>
            <Link to={nextStepHref(row)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
              {stepLabel(row.next_step)} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <StatusLine label="Recueil" done={['completed', 'validated'].includes(row.recueil_status)} />
            <StatusLine label="Profil investisseur" done={['completed', 'validated'].includes(row.qpi_status)} />
            <StatusLine label={row.esg_opt_in ? 'Durabilité / ESG' : 'ESG non demandé'} done={!row.esg_opt_in || ['completed', 'validated'].includes(row.esg_status)} />
          </div>
          <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
            <Link to={dossierHref('/espace-client/documents', row.dossier_id)} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-950"><FileText className="h-4 w-4" /> Documents</Link>
            <Link to={dossierHref('/espace-client/synthese', row.dossier_id)} className="text-sm font-semibold text-slate-700 hover:text-slate-950">Voir la synthèse</Link>
          </div>
        </section>
      ))}
    </div>
  );
}
