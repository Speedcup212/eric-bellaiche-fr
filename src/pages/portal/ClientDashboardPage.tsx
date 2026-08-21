import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Circle, FileText, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { dossierHref, fetchPortalProgress, messageFromError, nextStepHref, stepLabel, type PortalProgress } from '../../portal/portalHelpers';

function Step({ label, detail, done, optional = false }: { label: string; detail: string; done: boolean; optional?: boolean }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      {done ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />}
      <div>
        <p className="font-semibold text-slate-900">{label}{optional ? <span className="ml-2 text-xs font-medium text-slate-400">si applicable</span> : null}</p>
        <p className="mt-1 text-sm leading-5 text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

export default function ClientDashboardPage() {
  const [rows, setRows] = useState<PortalProgress[]>([]);
  const [documentCounts, setDocumentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      const progressRows = await fetchPortalProgress();
      setRows(progressRows);

      const dossierIds = [...new Set(progressRows.map((row) => row.dossier_id))];
      if (dossierIds.length === 0) return;

      const { data, error } = await supabase
        .from('documents_sources')
        .select('dossier_id')
        .in('dossier_id', dossierIds);
      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const item of data ?? []) counts[item.dossier_id] = (counts[item.dossier_id] ?? 0) + 1;
      setDocumentCounts(counts);
    };

    void load()
      .catch((error) => setErrorMessage(messageFromError(error)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-600">Chargement de votre dossier…</p>;
  if (errorMessage) return <p className="rounded-2xl bg-red-50 p-4 text-red-700">{errorMessage}</p>;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Parcours sécurisé</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Mon dossier patrimonial</h2>
        <p className="mt-3 max-w-3xl text-slate-600">
          Avancez simplement étape par étape. Vos réponses sont enregistrées au fur et à mesure et vous pouvez reprendre plus tard avec vos identifiants.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8">
          <ShieldCheck className="h-8 w-8 text-slate-400" />
          <h3 className="mt-4 text-xl font-semibold">Aucun dossier rattaché</h3>
          <p className="mt-2 text-slate-600">Votre accès est actif mais aucun dossier n’est encore rattaché. Utilisez le lien personnel transmis par le cabinet.</p>
        </div>
      ) : rows.map((row) => {
        const recueilDone = ['completed', 'validated'].includes(row.recueil_status);
        const qpiDone = ['completed', 'validated'].includes(row.qpi_status);
        const esgDone = !row.esg_opt_in || ['completed', 'validated'].includes(row.esg_status);
        const allDone = row.next_step === 'TERMINE';
        const docs = documentCounts[row.dossier_id] ?? 0;

        return (
          <section key={`${row.dossier_id}-${row.investisseur_id}`} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{row.reference || 'Dossier patrimonial'}</p>
                <h3 className="mt-1 text-xl font-semibold">{row.libelle || 'Accompagnement patrimonial'}</h3>
                <p className="mt-2 text-sm text-slate-500">{row.role_dossier === 'investisseur_1' ? 'Investisseur 1' : 'Investisseur 2'}</p>
              </div>
              {!allDone ? (
                <Link to={nextStepHref(row)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
                  Continuer : {stepLabel(row.next_step)} <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Dossier transmis
                </div>
              )}
            </div>

            <div className="mt-7 rounded-2xl bg-slate-50 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-900">Documents</p>
                  <p className="mt-1 text-sm text-slate-500">{docs > 0 ? `${docs} document${docs > 1 ? 's' : ''} déjà transmis.` : 'Transmettez ici les pièces demandées par le cabinet.'}</p>
                </div>
                <Link to={dossierHref('/espace-client/documents', row.dossier_id)} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 hover:text-slate-950">
                  <FileText className="h-4 w-4" /> {docs > 0 ? 'Voir mes documents' : 'Transmettre mes documents'}
                </Link>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              <Step label="1. Recueil d’informations" detail="Votre situation, vos objectifs et le choix d’exprimer ou non des préférences de durabilité." done={recueilDone} />
              <Step label="2. Profil investisseur" detail="Connaissances, expérience, horizon, capacité de perte et tolérance au risque." done={qpiDone} />
              {row.esg_opt_in ? (
                <Step label="3. Préférences de durabilité" detail="Taxonomie, investissement durable SFDR, PAI, exclusions et périmètre souhaité." done={esgDone} />
              ) : (
                <Step label="3. Préférences de durabilité" detail="Vous avez choisi de ne pas exprimer de préférences de durabilité. Aucun questionnaire supplémentaire n’est requis." done optional />
              )}
              <Step label={row.esg_opt_in ? '4. Transmission au cabinet' : '3. Transmission au cabinet'} detail="Une fois les questionnaires terminés, le cabinet reprend le dossier pour analyse et contrôle." done={allDone} />
            </div>

            {allDone && (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-6 text-emerald-900">
                Vos réponses sont enregistrées. Le cabinet peut maintenant procéder aux analyses et contrôles nécessaires avant toute recommandation personnalisée.
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
