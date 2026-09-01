import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, ArrowLeft, CheckCircle2, Download, FileCheck2, FileText, Home, Loader2, ShieldCheck, UserRound } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { evaluateConsistency, type ConsistencyIssue, type ConsistencySnapshot } from '../../portal/consistencyEngine';
import { summarizeAdvisorDossier, type ChecklistItemInput, type SectionInput } from '../../portal/advisorSummaryEngine';
import { consolidateHousehold } from '../../portal/householdConsolidationEngine';
import type { DataStatusInput } from '../../portal/dataStatusEngine';
import { messageFromError } from '../../portal/portalHelpers';

type DossierRow = { id: string; reference: string | null; libelle: string | null; recueil_status: string; statut: string };
type InvestorRow = { investisseur_id: string; role_dossier: string; recueil_status: string; qpi_status: string; esg_status: string; documents_status: string; investisseurs: { prenom: string; nom: string; email: string | null } | null };
type SectionRow = SectionInput & { investisseur_id: string; section_code: string; payload: Record<string, unknown> | null };
type ContextRow = Record<string, unknown> & { investisseur_id: string };
type ProvenanceRow = DataStatusInput & { investisseur_id?: string | null; entity_table?: string | null; field_name?: string | null };
type ChecklistRow = ChecklistItemInput & { document_code?: string | null; libelle?: string | null; source_document_id?: string | null };
type GeneratedDocument = { type: 'recueil' | 'qpi' | 'esg'; document_id: string; signed_url: string | null; path: string; reused: boolean; format?: 'pdf' };

const sectionLabel: Record<string, string> = { identity: 'Identité', family: 'Situation familiale', professional: 'Profession', objectives: 'Objectifs', capacity: 'Revenus & capacité', patrimony: 'Immobilier', financial: 'Patrimoine financier', credits: 'Crédits', regulatory: 'Réglementaire' };
const sectionOrder = ['identity', 'family', 'professional', 'capacity', 'patrimony', 'financial', 'credits', 'objectives', 'regulatory'];
const financialCategoryLabel: Record<string, string> = { savings: 'Livrets / épargne bancaire', life_insurance: 'Assurance-vie', retirement: 'PER / retraite', securities: 'PEA / compte-titres', paper_real_estate: 'SCPI / OPCI', employee_savings: 'Épargne salariale', other: 'Autres placements' };
const generatedDocumentLabel: Record<GeneratedDocument['type'], string> = { recueil: 'Recueil d’informations', qpi: 'Profil investisseur', esg: 'Questionnaire ESG' };

function readinessLabel(value: 'blocked' | 'review' | 'ready') {
  if (value === 'ready') return { label: 'Prêt pour analyse', className: 'bg-emerald-100 text-emerald-800', icon: <CheckCircle2 className="h-4 w-4" /> };
  if (value === 'review') return { label: 'Contrôles CIF requis', className: 'bg-amber-100 text-amber-800', icon: <AlertCircle className="h-4 w-4" /> };
  return { label: 'Dossier bloqué', className: 'bg-red-100 text-red-800', icon: <AlertTriangle className="h-4 w-4" /> };
}
function euro(value: number) { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value); }
function percent(value: number) { return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value) + ' %'; }
function humanize(key: string) { return key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase()); }
function isEmpty(value: unknown) { return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0); }
function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\u00a0/g, '').replace(/\s/g, '').replace(/€/g, '').replace(/,/g, '.').replace(/[^0-9.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}
function flattenNumbers(value: unknown, prefix = '', out: Array<{ key: string; value: number }> = []) {
  if (Array.isArray(value)) { value.forEach((item, index) => flattenNumbers(item, `${prefix}[${index}]`, out)); return out; }
  if (value && typeof value === 'object') { Object.entries(value as Record<string, unknown>).forEach(([key, child]) => flattenNumbers(child, prefix ? `${prefix}.${key}` : key, out)); return out; }
  const parsed = numberValue(value); if (parsed !== null) out.push({ key: prefix.toLowerCase(), value: parsed }); return out;
}
function sumMatching(payloads: Array<Record<string, unknown> | null>, include: RegExp, exclude?: RegExp) {
  const matches = payloads.flatMap((payload) => flattenNumbers(payload ?? {})).filter((item) => include.test(item.key) && !(exclude?.test(item.key)));
  return { value: matches.reduce((sum, item) => sum + item.value, 0), found: matches.length > 0 };
}
function financialSnapshot(sections: SectionRow[], householdRealEstate: number) {
  const byCode = (code: string) => sections.filter((row) => row.section_code === code).map((row) => row.payload);
  const capacity = byCode('capacity'); const financial = byCode('financial'); const credits = byCode('credits');
  const annualIncome = sumMatching(capacity, /(revenu.*annuel|revenus.*annuels|salaire.*annuel|net.*annuel|revenu_net|income)/i, /(conjoint|foyer_total)/i);
  const annualCharges = sumMatching(capacity, /(charges?.*annuell|depenses?.*annuell)/i);
  const savingsCapacityMonthly = sumMatching(capacity, /(capacite.*epargne|epargne.*mensuell|effort.*epargne)/i);
  const bankAvailable = sumMatching(financial, /(disponible.*compte|comptes?.*courant|liquidit|epargne.*bancaire|livret.*montant|solde.*bancaire|montant.*disponible)/i, /(categorie|type|nombre)/i);
  const financialAssets = sumMatching(financial, /(montant|valorisation|encours|valeur)/i, /(disponible.*compte|compte.*courant|liquidit|mensualite|versement)/i);
  const monthlyDebt = sumMatching(credits, /(mensualite|mensualité|echeance.*mensuell|échéance.*mensuell)/i);
  const debtOutstanding = sumMatching(credits, /(^|\.)(crd|capital_restant|capital.*restant|encours.*credit|encours.*crédit|reste.*rembourser)/i);
  const monthlyIncome = annualIncome.found ? annualIncome.value / 12 : 0;
  const debtRatio = monthlyIncome > 0 && monthlyDebt.found ? (monthlyDebt.value / monthlyIncome) * 100 : null;
  const remainingMonthly = monthlyIncome > 0 ? monthlyIncome - (monthlyDebt.found ? monthlyDebt.value : 0) - (annualCharges.found ? annualCharges.value / 12 : 0) : null;
  const netRealEstate = Math.max(0, householdRealEstate - (debtOutstanding.found ? debtOutstanding.value : 0));
  const patrimonyNet = netRealEstate + (financialAssets.found ? financialAssets.value : 0) + (bankAvailable.found ? bankAvailable.value : 0);
  return { annualIncome, annualCharges, savingsCapacityMonthly, bankAvailable, financialAssets, monthlyDebt, debtOutstanding, debtRatio, remainingMonthly, netRealEstate, patrimonyNet };
}
function formatValue(value: unknown, key = ''): string {
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (typeof value === 'number') return /(montant|revenu|salaire|valeur|capital|crd|epargne|loyer|mensualite|charge|patrimoine|encours)/i.test(key) ? euro(value) : new Intl.NumberFormat('fr-FR').format(value);
  if (Array.isArray(value)) return value.map((item) => typeof item === 'object' && item ? Object.entries(item as Record<string, unknown>).filter(([, v]) => !isEmpty(v)).map(([k, v]) => `${humanize(k)} : ${formatValue(v, k)}`).join(' · ') : String(item)).join(' | ');
  if (typeof value === 'object' && value) return Object.entries(value as Record<string, unknown>).filter(([, v]) => !isEmpty(v)).map(([k, v]) => `${humanize(k)} : ${formatValue(v, k)}`).join(' · ');
  return String(value ?? '');
}
function PayloadCard({ code, payload }: { code: string; payload: Record<string, unknown> }) {
  const entries = Object.entries(payload).filter(([key, value]) => !isEmpty(value) && !['completed', 'is_complete', 'updated_at'].includes(key));
  if (!entries.length) return null;
  return <div className="rounded-2xl border border-blue-100 bg-white p-5"><h4 className="text-sm font-bold text-slate-950">{sectionLabel[code] ?? humanize(code)}</h4><dl className="mt-4 space-y-3">{entries.map(([key, value]) => <div key={key} className="grid gap-1 border-t border-blue-50 pt-3 first:border-0 first:pt-0 sm:grid-cols-[180px_1fr]"><dt className="text-xs font-semibold text-slate-500">{humanize(key)}</dt><dd className="break-words text-sm font-medium leading-5 text-slate-900">{formatValue(value, key)}</dd></div>)}</dl></div>;
}
function Metric({ label, value, helper, emphasis = false }: { label: string; value: string; helper: string; emphasis?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${emphasis ? 'border-blue-400 bg-blue-50/70' : 'border-blue-100'}`}><p className="text-xs font-bold uppercase text-blue-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{helper}</p></div>;
}

export default function CifDossierSummaryPage() {
  const [searchParams] = useSearchParams(); const dossierId = searchParams.get('dossier');
  const [dossier, setDossier] = useState<DossierRow | null>(null); const [investors, setInvestors] = useState<InvestorRow[]>([]); const [sections, setSections] = useState<SectionRow[]>([]); const [contexts, setContexts] = useState<ContextRow[]>([]); const [provenance, setProvenance] = useState<ProvenanceRow[]>([]); const [checklist, setChecklist] = useState<ChecklistRow[]>([]); const [errorMessage, setErrorMessage] = useState(''); const [loading, setLoading] = useState(true); const [generatedDocuments, setGeneratedDocuments] = useState<GeneratedDocument[]>([]); const [generatingDocuments, setGeneratingDocuments] = useState(false); const [generationMessage, setGenerationMessage] = useState('');

  useEffect(() => { let active = true; const load = async () => { if (!dossierId) throw new Error('Dossier manquant.'); const { data: auth } = await supabase.auth.getUser(); if (!auth.user) throw new Error('Session expirée.'); const { data: current, error: roleError } = await supabase.from('app_users').select('role,actif').eq('auth_user_id', auth.user.id).maybeSingle(); if (roleError) throw roleError; if (!current?.actif || !['cif', 'admin'].includes(current.role)) throw new Error('Accès réservé au cabinet.');
    const results = await Promise.all([
      supabase.from('dossiers').select('id,reference,libelle,recueil_status,statut').eq('id', dossierId).single(),
      supabase.from('dossier_investisseurs').select('investisseur_id,role_dossier,recueil_status,qpi_status,esg_status,documents_status,investisseurs(prenom,nom,email)').eq('dossier_id', dossierId).order('role_dossier'),
      supabase.from('recueil_sections').select('investisseur_id,section_code,payload,completed_at').eq('dossier_id', dossierId),
      supabase.from('document_context_answers').select('*').eq('dossier_id', dossierId),
      supabase.from('data_provenance').select('investisseur_id,methode_collecte,statut_validation,valeur_source,valeur_retenue,source_document_id,date_validation,verified_at,retained_at,entity_table,field_name').eq('dossier_id', dossierId),
      supabase.from('document_checklist_items').select('document_code,libelle,statut,source_document_id').eq('dossier_id', dossierId)
    ]); for (const result of results) if (result.error) throw result.error; if (!active) return; setDossier(results[0].data as DossierRow); setInvestors((results[1].data ?? []) as unknown as InvestorRow[]); setSections((results[2].data ?? []) as unknown as SectionRow[]); setContexts((results[3].data ?? []) as unknown as ContextRow[]); setProvenance((results[4].data ?? []) as unknown as ProvenanceRow[]); setChecklist((results[5].data ?? []) as unknown as ChecklistRow[]); };
    void load().catch((error) => { if (active) setErrorMessage(messageFromError(error)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [dossierId]);

  const household = useMemo(() => consolidateHousehold(sections.map((row) => ({ investisseur_id: row.investisseur_id, role_dossier: investors.find((i) => i.investisseur_id === row.investisseur_id)?.role_dossier ?? '', section_code: row.section_code, payload: row.payload }))), [sections, investors]);
  const snapshot = useMemo(() => financialSnapshot(sections, household.realEstate.totalValue), [sections, household.realEstate.totalValue]);
  const investorSummaries = useMemo(() => investors.map((investor) => { const investorSections = sections.filter((r) => r.investisseur_id === investor.investisseur_id); const payloadByCode = Object.fromEntries(investorSections.map((r) => [r.section_code, r.payload ?? {}])); const spouse = investors.find((r) => r.investisseur_id !== investor.investisseur_id)?.investisseurs ?? null; const context = contexts.find((r) => r.investisseur_id === investor.investisseur_id) ?? {}; const consistencySnapshot: ConsistencySnapshot = { identity: payloadByCode.identity ?? {}, family: payloadByCode.family ?? {}, professional: payloadByCode.professional ?? {}, capacity: payloadByCode.capacity ?? {}, patrimony: payloadByCode.patrimony ?? {}, financial: payloadByCode.financial ?? {}, credits: payloadByCode.credits ?? {}, regulatory: payloadByCode.regulatory ?? {}, documents: context, spouse }; const issues = evaluateConsistency(consistencySnapshot); const investorProvenance = provenance.filter((r) => !r.investisseur_id || r.investisseur_id === investor.investisseur_id); const summary = summarizeAdvisorDossier({ sections: investorSections, provenance: investorProvenance, checklist, issues, roleDossier: investor.role_dossier }); return { investor, investorSections, issues, summary }; }), [investors, sections, contexts, provenance, checklist]);
  const readyDocumentTypes = useMemo(() => { if (!investors.length) return [] as GeneratedDocument['type'][]; const types: GeneratedDocument['type'][] = []; if (investors.every((i) => ['completed', 'validated'].includes(i.recueil_status))) types.push('recueil'); if (investors.every((i) => ['completed', 'validated'].includes(i.qpi_status))) types.push('qpi'); if (investors.every((i) => ['completed', 'validated', 'not_applicable'].includes(i.esg_status))) types.push('esg'); return types; }, [investors]);
  useEffect(() => { if (!dossierId || !dossier || !readyDocumentTypes.length) return; let active = true; const generate = async () => { setGeneratingDocuments(true); setGenerationMessage(''); const { data, error } = await supabase.functions.invoke('generate-cif-pdfs', { body: { dossier_id: dossierId, document_types: readyDocumentTypes } }); if (error) throw error; if (!data?.ok || !Array.isArray(data.documents)) throw new Error(data?.error || 'Génération documentaire impossible.'); if (active) setGeneratedDocuments(data.documents as GeneratedDocument[]); }; void generate().catch((error) => { if (active) setGenerationMessage(messageFromError(error)); }).finally(() => { if (active) setGeneratingDocuments(false); }); return () => { active = false; }; }, [dossierId, dossier?.id, readyDocumentTypes.join('|')]);

  if (loading) return <div className="min-h-screen bg-blue-50/30 p-10 text-sm text-slate-500">Chargement de la synthèse conseiller…</div>;
  if (errorMessage) return <div className="min-h-screen bg-blue-50/30 p-10"><Link to="/cabinet" className="text-sm font-semibold text-slate-600">← Retour cabinet</Link><p className="mt-6 rounded-2xl bg-red-50 p-5 text-sm text-red-700">{errorMessage}</p></div>;
  if (!dossier) return null;

  return <div className="min-h-screen bg-blue-50/30 px-4 py-8 sm:px-6"><div className="mx-auto max-w-7xl space-y-6">
    <header className="rounded-3xl bg-slate-950 p-7 text-white shadow-sm sm:p-9"><Link to="/cabinet" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-200"><ArrowLeft className="h-4 w-4" /> Retour aux dossiers</Link><p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Synthèse patrimoniale conseiller</p><h1 className="mt-2 text-3xl font-semibold">{dossier.reference || dossier.libelle || 'Dossier client'}</h1><p className="mt-2 text-sm text-slate-300">Vue de travail complète : situation, patrimoine, objectifs, profil réglementaire, pièces et contrôles CIF.</p></header>

    <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-start gap-3"><div className="rounded-2xl bg-blue-50 p-3"><Home className="h-5 w-5 text-blue-700" /></div><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Photographie patrimoniale du foyer</p><h2 className="mt-1 text-xl font-semibold text-slate-950">Les chiffres utiles pour travailler le dossier</h2><p className="mt-1 text-sm text-slate-500">Lecture immédiate de la solvabilité, des liquidités, de l’endettement et des masses patrimoniales déclarées.</p></div></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Disponible bancaire" value={snapshot.bankAvailable.found ? euro(snapshot.bankAvailable.value) : 'À renseigner'} helper="comptes courants, livrets et liquidités identifiés" emphasis />
        <Metric label="Revenus annuels" value={snapshot.annualIncome.found ? euro(snapshot.annualIncome.value) : 'À renseigner'} helper={snapshot.annualIncome.found ? `${euro(snapshot.annualIncome.value / 12)} / mois` : 'base du calcul d’endettement'} />
        <Metric label="Mensualités crédits" value={snapshot.monthlyDebt.found ? euro(snapshot.monthlyDebt.value) : '0 € / à vérifier'} helper="total mensuel des crédits déclarés" emphasis />
        <Metric label="Taux d’endettement" value={snapshot.debtRatio !== null ? percent(snapshot.debtRatio) : 'Non calculable'} helper="mensualités de crédits / revenus mensuels" emphasis />
        <Metric label="Capital restant dû" value={snapshot.debtOutstanding.found ? euro(snapshot.debtOutstanding.value) : '0 € / à vérifier'} helper="CRD total des crédits déclarés" />
        <Metric label="Reste disponible mensuel" value={snapshot.remainingMonthly !== null ? euro(snapshot.remainingMonthly) : 'Non calculable'} helper="revenus - crédits - charges déclarées" />
        <Metric label="Capacité d’épargne" value={snapshot.savingsCapacityMonthly.found ? `${euro(snapshot.savingsCapacityMonthly.value)} / mois` : 'À renseigner'} helper="effort d’épargne déclaré" />
        <Metric label="Actifs financiers" value={snapshot.financialAssets.found ? euro(snapshot.financialAssets.value) : 'À valoriser'} helper="placements hors liquidités bancaires" />
        <Metric label="Immobilier brut" value={euro(household.realEstate.totalValue)} helper={`${household.realEstate.count} bien${household.realEstate.count > 1 ? 's' : ''} consolidé${household.realEstate.count > 1 ? 's' : ''}`} />
        <Metric label="Immobilier net estimé" value={euro(snapshot.netRealEstate)} helper="immobilier brut - CRD identifié" />
        <Metric label="Patrimoine net estimé" value={euro(snapshot.patrimonyNet)} helper="immobilier net + financier + liquidités identifiées" emphasis />
        <Metric label="Charges annuelles" value={snapshot.annualCharges.found ? euro(snapshot.annualCharges.value) : 'À renseigner'} helper="hors mensualités de crédits" />
      </div>
      {household.financialCategories.length > 0 && <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm text-slate-700"><strong>Placements identifiés :</strong> {household.financialCategories.map((c) => financialCategoryLabel[c] ?? c).join(', ')}.</div>}
      {household.warnings.length > 0 && <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>À contrôler :</strong> {household.warnings.join(' ')}</div>}
    </section>

    {investorSummaries.map(({ investor, investorSections, issues, summary }) => { const badge = readinessLabel(summary.readiness); const orderedSections = [...investorSections].sort((a, b) => sectionOrder.indexOf(a.section_code) - sectionOrder.indexOf(b.section_code)); return <section key={investor.investisseur_id} className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><div className="rounded-2xl bg-blue-50 p-3"><UserRound className="h-5 w-5 text-blue-700" /></div><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-500">{investor.role_dossier === 'investisseur_1' ? 'Identifiant 1' : 'Identifiant 2'}</p><h2 className="mt-1 text-xl font-semibold text-slate-950">{investor.investisseurs?.prenom} {investor.investisseurs?.nom}</h2><p className="mt-1 text-xs text-slate-500">{investor.investisseurs?.email || 'Email non renseigné'} · Recueil {investor.recueil_status} · QPI {investor.qpi_status} · ESG {investor.esg_status}</p></div></div><span className={`inline-flex items-center gap-2 self-start rounded-full px-3 py-2 text-xs font-bold ${badge.className}`}>{badge.icon}{badge.label}</span></div>
      <div className="mt-7"><p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Données déclarées</p><h3 className="mt-1 text-lg font-semibold text-slate-950">Lecture complète du recueil</h3><p className="mt-1 text-sm text-slate-500">Toutes les informations saisies dans le parcours client sont remontées ici, sans ressaisie.</p><div className="mt-5 grid gap-4 lg:grid-cols-2">{orderedSections.map((row) => <PayloadCard key={row.section_code} code={row.section_code} payload={row.payload ?? {}} />)}</div>{!orderedSections.length && <p className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm text-slate-600">Aucune donnée de recueil disponible pour cet identifiant.</p>}</div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-2xl border border-blue-100 p-4"><p className="text-xs font-bold uppercase text-blue-500">Recueil</p><p className="mt-2 text-2xl font-semibold">{summary.sections.completed}/{summary.sections.total}</p></div><div className="rounded-2xl border border-blue-100 p-4"><p className="text-xs font-bold uppercase text-blue-500">Données contrôlées</p><p className="mt-2 text-2xl font-semibold">{summary.provenance.verified + summary.provenance.retained}/{summary.provenance.total}</p></div><div className="rounded-2xl border border-blue-100 p-4"><p className="text-xs font-bold uppercase text-blue-500">Justificatifs</p><p className="mt-2 text-2xl font-semibold">{summary.documents.validated}/{summary.documents.total}</p></div><div className="rounded-2xl border border-blue-100 p-4"><p className="text-xs font-bold uppercase text-blue-500">Contrôles</p><p className="mt-2 text-2xl font-semibold">{summary.consistency.total}</p></div></div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2"><div className="rounded-2xl bg-blue-50/70 p-5"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-blue-700" /><h3 className="font-semibold">Contrôles CIF à traiter</h3></div>{issues.length ? <div className="mt-4 space-y-3">{issues.map((issue: ConsistencyIssue) => <div key={issue.code} className={`rounded-xl border p-4 ${issue.severity === 'blocking' ? 'border-red-200 bg-red-50' : issue.severity === 'review' ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-white'}`}><p className="font-semibold text-slate-900">{issue.title}</p><p className="mt-1 text-sm leading-5 text-slate-600">{issue.message}</p></div>)}</div> : <p className="mt-4 text-sm text-emerald-700">Aucune incohérence métier détectée.</p>}</div><div className="rounded-2xl bg-blue-50/70 p-5"><div className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-blue-700" /><h3 className="font-semibold">Complétude réglementaire</h3></div><div className="mt-4 space-y-2 text-sm text-slate-700">{summary.sections.missing.length > 0 && <p><strong>Sections manquantes :</strong> {summary.sections.missing.map((c) => sectionLabel[c] ?? c).join(', ')}</p>}<p><strong>Données à contrôler :</strong> {summary.provenance.cifReviewRequired}</p><p><strong>Justificatifs manquants :</strong> {summary.documents.missing}</p><p><strong>Reçus non validés :</strong> {summary.documents.received}</p><p><strong>Demandés :</strong> {summary.documents.requested}</p></div></div></div>
    </section>; })}

    <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-start gap-3"><div className="rounded-2xl bg-emerald-50 p-3"><FileText className="h-5 w-5 text-emerald-700" /></div><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Documents automatiques</p><h2 className="mt-1 text-xl font-semibold text-slate-950">Recueil, profil investisseur et ESG</h2><p className="mt-1 text-sm text-slate-500">Les versions finalisées sont générées et archivées automatiquement pour la signature électronique.</p></div></div>{generationMessage && <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{generationMessage}</p>}<div className="mt-5 flex flex-wrap gap-3">{generatingDocuments && <span className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700"><Loader2 className="h-4 w-4 animate-spin" /> Génération…</span>}{generatedDocuments.map((document) => document.signed_url ? <a key={document.document_id} href={document.signed_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><Download className="h-4 w-4" /> {generatedDocumentLabel[document.type]}</a> : null)}</div></section>
  </div></div>;
}
