import { useEffect, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, ChevronDown, FileCheck2, ShieldCheck, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { JourneyProgress, WizardCard } from '../../portal/FintechJourney';
import { supabase } from '../../lib/supabase';
import { dossierHref, fetchPortalProgress, messageFromError, nextStepHref, type PortalProgress } from '../../portal/portalHelpers';

function JourneyLine({ number, title, detail, done, active, href }: { number: number; title: string; detail: string; done: boolean; active: boolean; href?: string }) {
  const inner = (
    <div className={`group flex items-start gap-4 rounded-2xl border p-4 transition sm:p-5 ${active ? 'border-[#173967] bg-[#0b1f3a] text-white shadow-lg shadow-[#0b1f3a]/10' : done ? 'border-blue-100 bg-blue-50/70' : 'border-[#dbe4ef] bg-white'}`}>
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${active ? 'bg-white text-[#0b1f3a]' : done ? 'bg-blue-600 text-white' : 'bg-[#eef3f9] text-[#5b6b82]'}`}>
        {done ? <Check className="h-4 w-4" /> : number}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className={`font-semibold ${active ? 'text-white' : 'text-[#0b1f3a]'}`}>{title}</p>
          {active && <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white/80">En cours</span>}
        </div>
        <p className={`mt-1.5 text-sm leading-6 ${active ? 'text-blue-100/80' : 'text-[#5b6b82]'}`}>{detail}</p>
      </div>
      {href && <ArrowRight className={`mt-1 h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-[#9aa9bc] group-hover:text-[#173967]'}`} />}
    </div>
  );
  return href ? <Link to={href} className="block">{inner}</Link> : inner;
}

function currentStepTitle(step: PortalProgress['next_step']) {
  switch (step) {
    case 'RECUEIL': return 'Recueil d’informations';
    case 'QPI': return 'Profil investisseur';
    case 'ESG': return 'Préférences de durabilité';
    case 'DOCUMENTS': return 'Documents du dossier';
    default: return 'Dossier transmis';
  }
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

  if (loading) return <p className="text-sm text-[#5b6b82]">Chargement de votre dossier…</p>;
  if (errorMessage) return <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>;

  if (rows.length === 0) {
    return (
      <WizardCard className="p-8">
        <ShieldCheck className="h-8 w-8 text-[#5b6b82]" />
        <h2 className="mt-4 text-xl font-semibold text-[#0b1f3a]">Aucun dossier rattaché</h2>
        <p className="mt-2 text-sm leading-6 text-[#5b6b82]">Votre accès est actif mais aucun dossier n’est encore rattaché. Utilisez le lien personnel transmis par le cabinet.</p>
      </WizardCard>
    );
  }

  return (
    <div className="space-y-6">
      {rows.map((row) => {
        const docsDone = row.documents_status === 'completed';
        const recueilDone = ['completed', 'validated'].includes(row.recueil_status);
        const qpiDone = ['completed', 'validated'].includes(row.qpi_status);
        const esgRequired = row.esg_opt_in === true;
        const esgDone = !esgRequired || ['completed', 'validated'].includes(row.esg_status);
        const individualDone = recueilDone && qpiDone && esgDone;
        const coupleWaiting = row.is_couple && individualDone && !row.dossier_ready_for_documents;
        const allDone = row.next_step === 'TERMINE';
        const docs = documentCounts[row.dossier_id] ?? 0;
        const stage = row.next_step === 'RECUEIL' ? 'recueil' : row.next_step === 'QPI' ? 'qpi' : row.next_step === 'ESG' ? 'esg' : row.next_step === 'DOCUMENTS' ? 'documents' : 'done';
        const documentsUnlocked = row.next_step === 'DOCUMENTS' || docsDone || allDone;

        return (
          <div key={`${row.dossier_id}-${row.investisseur_id}`} className="space-y-5">
            <WizardCard>
              <div className="bg-gradient-to-br from-[#071a33] via-[#0b1f3a] to-[#173967] px-6 py-7 text-white sm:px-9 sm:py-9">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">Dossier sécurisé · {row.reference || 'Dossier patrimonial'}</p>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{allDone ? 'Votre dossier est transmis' : coupleWaiting ? 'Votre partie individuelle est terminée' : 'Reprenez votre parcours'}</h2>
                    <p className="mt-3 text-sm leading-6 text-blue-100/80">
                      {allDone ? 'Le cabinet dispose maintenant des éléments transmis pour poursuivre l’analyse.' : coupleWaiting ? <>Le dossier commun est en attente de l’autre personne. <span className="font-semibold text-white">{row.dossier_members_ready}/{row.dossier_members_total} parcours individuels terminés.</span> Vous pouvez déjà déposer les justificatifs communs.</> : <>Étape actuelle : <span className="font-semibold text-white">{currentStepTitle(row.next_step)}</span>. Vos réponses sont enregistrées au fur et à mesure.</>}
                    </p>
                  </div>
                  {!allDone ? (
                    <Link to={nextStepHref(row)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#0b1f3a] shadow-xl shadow-black/10 transition hover:-translate-y-0.5 hover:bg-blue-50">
                      {coupleWaiting ? 'Déposer les documents' : 'Continuer'} <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-inset ring-white/15"><CheckCircle2 className="h-4 w-4" /> Dossier transmis</span>
                  )}
                </div>
                <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/10 pt-5 text-xs text-blue-100/70">
                  <span>{row.libelle || 'Accompagnement patrimonial'}</span>
                  <span>Reprise possible à tout moment</span>
                  {row.is_couple && <span>{row.dossier_members_ready}/{row.dossier_members_total} parcours individuels terminés</span>}
                  {docs > 0 && <span>{docs} document{docs === 1 ? '' : 's'} déjà transmis</span>}
                </div>
              </div>
            </WizardCard>

            <JourneyProgress current={stage} esgEnabled={esgRequired || row.esg_opt_in === null} />

            {row.is_couple && !row.dossier_ready_for_documents && !allDone && (
              <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm sm:px-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><UsersRound className="h-5 w-5" /></div>
                  <div><h3 className="font-semibold text-amber-950">Dossier couple : validation commune en attente</h3><p className="mt-1.5 text-sm leading-6 text-amber-800">Chaque personne conserve son propre recueil, son profil investisseur et ses préférences de durabilité. La transmission finale sera disponible uniquement lorsque les {row.dossier_members_total} parcours individuels seront terminés.</p>{!row.partner_activated && <p className="mt-2 text-sm font-semibold text-amber-900">L’autre personne n’a pas encore activé son accès sécurisé.</p>}</div>
                </div>
              </div>
            )}

            {!allDone && (
              <div className="rounded-[22px] border border-[#dbe4ef] bg-white px-5 py-4 shadow-sm sm:px-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf2fb] text-[#173967]">
                    <FileCheck2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#0b1f3a]">Documents du foyer à préparer</h3>
                    <p className="mt-1.5 text-sm leading-6 text-[#5b6b82]">Avis d’imposition, relevés de placements, crédits, immobilier et documents de SCI peuvent être déposés une seule fois pour le dossier commun. Les justificatifs strictement personnels peuvent être ajoutés par chacun.</p>
                  </div>
                </div>
              </div>
            )}

            <details className="group rounded-[22px] border border-[#dbe4ef] bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-[#173967] sm:px-6">
                <span>Voir le détail du parcours</span>
                <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
              </summary>
              <div className="space-y-3 border-t border-[#e7edf5] p-5 sm:p-6">
                <JourneyLine number={1} title="Recueil d’informations" detail="Renseignez vos objectifs, votre situation professionnelle, vos capacités financières et votre choix de durabilité." done={recueilDone} active={row.next_step === 'RECUEIL'} href={dossierHref('/espace-client/recueil', row.dossier_id)} />
                <JourneyLine number={2} title="Profil investisseur" detail="Répondez question par question sur votre expérience, votre capacité de perte et votre tolérance au risque." done={qpiDone} active={row.next_step === 'QPI'} href={recueilDone ? dossierHref('/espace-client/profil-investisseur', row.dossier_id) : undefined} />
                {(esgRequired || row.esg_opt_in === null) && <JourneyLine number={3} title="Préférences de durabilité" detail="Précisez les critères environnementaux, sociaux et de gouvernance (ESG) à intégrer aux recommandations." done={esgDone && esgRequired} active={row.next_step === 'ESG'} href={row.next_step === 'ESG' || esgDone ? dossierHref('/espace-client/esg', row.dossier_id) : undefined} />}
                <JourneyLine number={esgRequired || row.esg_opt_in === null ? 4 : 3} title="Documents du dossier" detail="Déposez les justificatifs communs une seule fois. La transmission finale reste verrouillée tant que tous les parcours individuels ne sont pas terminés." done={docsDone} active={row.next_step === 'DOCUMENTS'} href={documentsUnlocked ? dossierHref('/espace-client/documents', row.dossier_id) : undefined} />
                <JourneyLine number={esgRequired || row.esg_opt_in === null ? 5 : 4} title="Transmission au cabinet" detail="Un seul envoi final clôt le dossier commun après contrôle de la complétion de chaque personne." done={allDone} active={false} />
              </div>
            </details>
          </div>
        );
      })}
    </div>
  );
}
