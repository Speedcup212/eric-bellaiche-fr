import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, ArrowLeft, CheckCircle2, FileCheck2, ShieldCheck, UserRound } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { evaluateConsistency, type ConsistencyIssue, type ConsistencySnapshot } from '../../portal/consistencyEngine';
import { summarizeAdvisorDossier } from '../../portal/advisorSummaryEngine';
import { messageFromError } from '../../portal/portalHelpers';

type AnyRow = Record<string, any>;
type DossierRow = { id: string; reference: string | null; libelle: string | null; recueil_status: string; statut: string };
type InvestorRow = { investisseur_id: string; role_dossier: string; recueil_status: string; qpi_status: string; esg_status: string; documents_status: string; investisseurs: { prenom: string; nom: string; email: string | null } | null };

const sectionLabel: Record<string, string> = {
  identity: 'Identité', family: 'Famille', professional: 'Profession', objectives: 'Objectifs', capacity: 'Revenus', patrimony: 'Immobilier', financial: 'Financier', credits: 'Crédits', regulatory: 'Réglementaire',
};

function readinessLabel(value: 'blocked' | 'review' | 'ready') {
  if (value === 'ready') return { label: 'Prêt pour analyse', className: 'bg-emerald-100 text-emerald-800', icon: <CheckCircle2 className="h-4 w-4" /> };
  if (value === 'review') return { label: 'Contrôles CIF requis', className: 'bg-amber-100 text-amber-800', icon: <AlertCircle className="h-4 w-4" /> };
  return { label: 'Dossier bloqué', className: 'bg-red-100 text-red-800', icon: <AlertTriangle className="h-4 w-4" /> };
}

export default function CifDossierSummaryPage() {
  const [searchParams] = useSearchParams();
  const dossierId = searchParams.get('dossier');
  const [dossier, setDossier] = useState<DossierRow | null>(null);
  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [sections, setSections] = useState<AnyRow[]>([]);
  const [contexts, setContexts] = useState<AnyRow[]>([]);
  const [provenance, setProvenance] = useState<AnyRow[]>([]);
  const [checklist, setChecklist] = useState<AnyRow[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!dossierId) throw new Error('Dossier manquant.');
      const { data: current, error: roleError } = await supabase.from('app_users').select('role,actif').maybeSingle();
      if (roleError) throw roleError;
      if (!current?.actif || !['cif', 'admin'].includes(current.role)) throw new Error('Accès réservé au cabinet.');

      const [dossierResult, investorsResult, sectionsResult, contextsResult, provenanceResult, checklistResult] = await Promise.all([
        supabase.from('dossiers').select('id,reference,libelle,recueil_status,statut').eq('id', dossierId).single(),
        supabase.from('dossier_investisseurs').select('investisseur_id,role_dossier,recueil_status,qpi_status,esg_status,documents_status,investisseurs(prenom,nom,email)').eq('dossier_id', dossierId).order('role_dossier'),
        supabase.from('recueil_sections').select('investisseur_id,section_code,payload,completed_at').eq('dossier_id', dossierId),
        supabase.from('document_context_answers').select('*').eq('dossier_id', dossierId),
        supabase.from('data_provenance').select('investisseur_id,methode_collecte,statut_validation,valeur_source,valeur_retenue,source_document_id,date_validation,verified_at,retained_at,entity_table,field_name').eq('dossier_id', dossierId),
        supabase.from('document_checklist_items').select('document_code,libelle,statut,source_document_id').eq('dossier_id', dossierId),
      ]);

      for (const result of [dossierResult, investorsResult, sectionsResult, contextsResult, provenanceResult, checklistResult]) if (result.error) throw result.error;
      if (!active) return;
      setDossier(dossierResult.data as DossierRow);
      setInvestors((investorsResult.data ?? []) as unknown as InvestorRow[]);
      setSections((sectionsResult.data ?? []) as AnyRow[]);
      setContexts((contextsResult.data ?? []) as AnyRow[]);
      setProvenance((provenanceResult.data ?? []) as AnyRow[]);
      setChecklist((checklistResult.data ?? []) as AnyRow[]);
    };
    void load().catch((error) => { if (active) setErrorMessage(messageFromError(error)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [dossierId]);

  const investorSummaries = useMemo(() => investors.map((investor) => {
    const investorSections = sections.filter((row) => row.investisseur_id === investor.investisseur_id);
    const payloadByCode = Object.fromEntries(investorSections.map((row) => [row.section_code, row.payload ?? {}]));
    const spouse = investors.find((row) => row.investisseur_id !== investor.investisseur_id)?.investisseurs ?? null;
    const context = contexts.find((row) => row.investisseur_id === investor.investisseur_id) ?? {};
    const snapshot: ConsistencySnapshot = {
      identity: payloadByCode.identity ?? {}, family: payloadByCode.family ?? {}, professional: payloadByCode.professional ?? {}, capacity: payloadByCode.capacity ?? {}, patrimony: payloadByCode.patrimony ?? {}, financial: payloadByCode.financial ?? {}, credits: payloadByCode.credits ?? {}, regulatory: payloadByCode.regulatory ?? {}, documents: context, spouse,
    };
    const issues = evaluateConsistency(snapshot);
    const investorProvenance = provenance.filter((row) => !row.investisseur_id || row.investisseur_id === investor.investisseur_id);
    const summary = summarizeAdvisorDossier({ sections: investorSections, provenance: investorProvenance, checklist, issues });
    return { investor, issues, summary };
  }), [investors, sections, contexts, provenance, checklist]);

  if (loading) return <div className="min-h-screen bg-slate-50 p-10 text-sm text-slate-500">Chargement de la synthèse conseiller…</div>;
  if (errorMessage) return <div className="min-h-screen bg-slate-50 p-10"><Link to="/cabinet" className="text-sm font-semibold text-slate-600">← Retour cabinet</Link><p className="mt-6 rounded-2xl bg-red-50 p-5 text-sm text-red-700">{errorMessage}</p></div>;
  if (!dossier) return null;

  return <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6"><div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><Link to="/cabinet" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Retour aux dossiers</Link><p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Synthèse conseiller</p><h1 className="mt-2 text-3xl font-semibold text-slate-950">{dossier.reference || dossier.libelle || 'Dossier client'}</h1><p className="mt-2 text-sm text-slate-500">Recueil : {dossier.recueil_status} · Dossier : {dossier.statut}</p></div>
      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-900"><strong>Objectif :</strong> ne montrer que les points nécessitant une intervention CIF.</div>
    </div>

    {investorSummaries.map(({ investor, issues, summary }) => { const badge = readinessLabel(summary.readiness); return <section key={investor.investisseur_id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><div className="rounded-2xl bg-slate-100 p-3"><UserRound className="h-5 w-5 text-slate-700" /></div><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{investor.role_dossier === 'investisseur_1' ? 'Identifiant 1' : 'Identifiant 2'}</p><h2 className="mt-1 text-xl font-semibold text-slate-950">{investor.investisseurs?.prenom} {investor.investisseurs?.nom}</h2><p className="mt-1 text-xs text-slate-500">Recueil {investor.recueil_status} · QPI {investor.qpi_status} · ESG {investor.esg_status} · Documents {investor.documents_status}</p></div></div><span className={`inline-flex items-center gap-2 self-start rounded-full px-3 py-2 text-xs font-bold ${badge.className}`}>{badge.icon}{badge.label}</span></div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Recueil</p><p className="mt-2 text-2xl font-semibold">{summary.sections.completed}/{summary.sections.total}</p><p className="mt-1 text-xs text-slate-500">sections complètes</p></div>
        <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Données</p><p className="mt-2 text-2xl font-semibold">{summary.provenance.verified + summary.provenance.retained}/{summary.provenance.total}</p><p className="mt-1 text-xs text-slate-500">vérifiées ou retenues</p></div>
        <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Justificatifs</p><p className="mt-2 text-2xl font-semibold">{summary.documents.validated}/{summary.documents.total}</p><p className="mt-1 text-xs text-slate-500">validés</p></div>
        <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Contrôles</p><p className="mt-2 text-2xl font-semibold">{summary.consistency.total}</p><p className="mt-1 text-xs text-slate-500">anomalies détectées</p></div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-5"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-slate-600" /><h3 className="font-semibold">Contrôles à traiter</h3></div>{issues.length ? <div className="mt-4 space-y-3">{issues.map((issue: ConsistencyIssue) => <div key={issue.code} className={`rounded-xl border p-4 ${issue.severity === 'blocking' ? 'border-red-200 bg-red-50' : issue.severity === 'review' ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'}`}><div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-900">{issue.title}</p><span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{issue.severity === 'blocking' ? 'Bloquant' : issue.severity === 'review' ? 'À vérifier' : 'Information'}</span></div><p className="mt-1 text-sm leading-5 text-slate-600">{issue.message}</p></div>)}</div> : <p className="mt-4 text-sm text-emerald-700">Aucune incohérence métier détectée.</p>}</div>
        <div className="rounded-2xl bg-slate-50 p-5"><div className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-slate-600" /><h3 className="font-semibold">Points encore ouverts</h3></div><div className="mt-4 space-y-2 text-sm text-slate-600">{summary.sections.missing.length > 0 && <p><strong>Sections manquantes :</strong> {summary.sections.missing.map((code) => sectionLabel[code] ?? code).join(', ')}</p>}<p><strong>Données à contrôler :</strong> {summary.provenance.cifReviewRequired}</p><p><strong>Justificatifs manquants :</strong> {summary.documents.missing}</p><p><strong>Justificatifs reçus non validés :</strong> {summary.documents.received}</p><p><strong>Justificatifs demandés :</strong> {summary.documents.requested}</p>{summary.sections.missing.length === 0 && summary.provenance.cifReviewRequired === 0 && summary.documents.missing === 0 && summary.documents.received === 0 && summary.documents.requested === 0 && <p className="text-emerald-700">Aucun point ouvert détecté.</p>}</div></div>
      </div>
    </section>; })}
  </div></div>;
}
