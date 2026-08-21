import { useEffect, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, FileCheck2, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { JourneyProgress, PageIntro, WizardCard } from '../../portal/FintechJourney';
import { supabase } from '../../lib/supabase';
import { dossierHref, fetchPortalProgress, messageFromError, nextStepHref, stepLabel, type PortalProgress } from '../../portal/portalHelpers';

function JourneyLine({ number, title, detail, done, active, href }: { number: number; title: string; detail: string; done: boolean; active: boolean; href?: string }) {
  const inner = (
    <div className={`group flex items-start gap-4 rounded-2xl border p-4 transition sm:p-5 ${active ? 'border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/10' : done ? 'border-emerald-100 bg-emerald-50/70' : 'border-slate-200 bg-white'}`}>
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${active ? 'bg-white text-slate-950' : done ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
        {done ? <Check className="h-4 w-4" /> : number}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className={`font-semibold ${active ? 'text-white' : 'text-slate-950'}`}>{title}</p>
          {active && <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white/80">À faire</span>}
        </div>
        <p className={`mt-1.5 text-sm leading-6 ${active ? 'text-slate-300' : 'text-slate-500'}`}>{detail}</p>
      </div>
      {href && <ArrowRight className={`mt-1 h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-slate-300 group-hover:text-slate-700'}`} />}
    </div>
  );
  return href ? <Link to={href} className="block">{inner}</Link> : inner;
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
      const { data, error } = await supabase.from('documents_sources').select('dossier_id').in('dossier_id', dossierIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const item of data ?? []) counts[item.dossier_id] = (counts[item.dossier_id] ?? 0) + 1;
      setDocumentCounts(counts);
    };
    void load().catch((error) => setErrorMessage(messageFromError(error))).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-slate-500">Chargement de votre dossier…</p>;
  if (errorMessage) return <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>;

  return (
    <div>
      <PageIntro eyebrow="Parcours sécurisé" title="Votre dossier, étape par étape" description="Une seule action à la fois. Les informations sont enregistrées au fur et à mesure et vous pouvez interrompre le parcours puis le reprendre plus tard." icon={<ShieldCheck className="h-5 w-5" />} />

      {rows.length === 0 ? (
        <WizardCard className="p-8">
          <ShieldCheck className="h-8 w-8 text-slate-400" />
          <h3 className="mt-4 text-xl font-semibold">Aucun dossier rattaché</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">Votre accès est actif mais aucun dossier n’est encore rattaché. Utilisez le lien personnel transmis par le cabinet.</p>
        </WizardCard>
      ) : rows.map((row) => {
        const docsDone = row.documents_status === 'completed';
        const recueilDone = ['completed', 'validated'].includes(row.recueil_status);
        const qpiDone = ['completed', 'validated'].includes(row.qpi_status);
        const esgRequired = row.esg_opt_in === true;
        const esgDone = !esgRequired || ['completed', 'validated'].includes(row.esg_status);
        const allDone = row.next_step === 'TERMINE';
        const docs = documentCounts[row.dossier_id] ?? 0;
        const stage = row.next_step === 'RECUEIL' ? 'recueil' : row.next_step === 'QPI' ? 'qpi' : row.next_step === 'ESG' ? 'esg' : row.next_step === 'DOCUMENTS' ? 'documents' : 'done';
        const documentsUnlocked = row.next_step === 'DOCUMENTS' || docsDone || allDone;

        return (
          <div key={`${row.dossier_id}-${row.investisseur_id}`} className="space-y-6">
            <JourneyProgress current={stage} esgEnabled={esgRequired || row.esg_opt_in === null} />

            <div className="rounded-[24px] border border-cyan-100 bg-gradient-to-r from-cyan-50 via-white to-indigo-50 p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/10">
                  <FileCheck2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">À préparer avant de commencer</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-950">Préparez les documents que vous transmettrez à la fin du parcours</h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    Gardez à portée de main vos principaux justificatifs : avis d’imposition, relevés de placements, tableaux d’amortissement ou crédits, éléments immobiliers et pièce d’identité. Vous n’avez rien à déposer maintenant : une étape dédiée « Documents » vous sera proposée à la fin du parcours.
                  </p>
                </div>
              </div>
            </div>

            <WizardCard>
              <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-6 py-7 text-white sm:px-9 sm:py-9">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">{row.reference || 'Dossier patrimonial'}</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight">{row.libelle || 'Accompagnement patrimonial'}</h3>
                    <p className="mt-2 text-sm text-slate-300">{docs} document{docs === 1 ? '' : 's'} déjà transmis · réponses sauvegardées automatiquement</p>
                  </div>
                  {!allDone ? (
                    <Link to={nextStepHref(row)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-xl shadow-black/10 transition hover:-translate-y-0.5">
                      {stepLabel(row.next_step)} <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-400/15 px-4 py-3 text-sm font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-300/20"><CheckCircle2 className="h-4 w-4" /> Dossier transmis</span>
                  )}
                </div>
              </div>

              <div className="space-y-3 p-5 sm:p-8">
                <JourneyLine number={1} title="Recueil d’informations" detail="Renseignez vos objectifs, votre situation professionnelle, vos capacités financières et votre choix de durabilité." done={recueilDone} active={row.next_step === 'RECUEIL'} href={dossierHref('/espace-client/recueil', row.dossier_id)} />
                <JourneyLine number={2} title="Profil investisseur" detail="Répondez question par question sur votre expérience, votre capacité de perte et votre tolérance au risque." done={qpiDone} active={row.next_step === 'QPI'} href={recueilDone ? dossierHref('/espace-client/profil-investisseur', row.dossier_id) : undefined} />
                {(esgRequired || row.esg_opt_in === null) && <JourneyLine number={3} title="Préférences de durabilité" detail="Précisez, si vous le souhaitez, les critères environnementaux et sociaux à intégrer aux recommandations." done={esgDone && esgRequired} active={row.next_step === 'ESG'} href={row.next_step === 'ESG' || esgDone ? dossierHref('/espace-client/esg', row.dossier_id) : undefined} />}
                <JourneyLine number={esgRequired || row.esg_opt_in === null ? 4 : 3} title="Transmettre les documents" detail="À la fin du parcours, déposez les justificatifs préparés afin que le cabinet puisse vérifier et contrôler votre dossier." done={docsDone} active={row.next_step === 'DOCUMENTS'} href={documentsUnlocked ? dossierHref('/espace-client/documents', row.dossier_id) : undefined} />
                <JourneyLine number={esgRequired || row.esg_opt_in === null ? 5 : 4} title="Transmission au cabinet" detail="Une fois le parcours terminé, le cabinet reprend les éléments pour analyse, contrôle et préparation de la recommandation." done={allDone} active={false} />
              </div>
            </WizardCard>
          </div>
        );
      })}
    </div>
  );
}
