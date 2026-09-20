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
type InvestorRow = { investisseur_id: string; role_dossier: string; recueil_status: string; qpi_status: string; esg_opt_in: boolean | null; esg_status: string; documents_status: string; investisseurs: { prenom: string; nom: string; email: string | null } | null };
type SectionRow = SectionInput & { investisseur_id: string; section_code: string; payload: Record<string, unknown> | null };
type ContextRow = Record<string, unknown> & { investisseur_id: string };
type ProvenanceRow = DataStatusInput & { investisseur_id?: string | null; entity_table?: string | null; field_name?: string | null };
type ChecklistRow = ChecklistItemInput & { document_code?: string | null; libelle?: string | null; source_document_id?: string | null };
type GeneratedDocument = { type: 'recueil' | 'qpi' | 'esg'; investisseur_id?: string | null; document_id: string; signed_url: string | null; path: string; reused: boolean; format?: 'pdf' };
type HouseholdConfirmationRow = { section_code:string; status:'confirmed'|'change_requested'; note:string|null; source_updated_at:string; updated_at:string };
type QpiSessionRow = { id:string; investisseur_id:string };
type QpiControlRow = { id:string; session_id:string; control_code:string; alerte:boolean; traite:boolean; commentaire:string|null; details:Record<string,unknown>; resolution_code:string|null; resolution_note:string|null; resolved_at:string|null };
type QpiResultSummaryRow = { session_id:string; synthese_dimensions:Record<string,any> };

const sectionLabel: Record<string, string> = { identity: 'Identité', family: 'Situation familiale', professional: 'Profession', objectives: 'Objectifs', capacity: 'Revenus & capacité', tax: 'Fiscalité', patrimony: 'Immobilier', financial: 'Patrimoine financier', credits: 'Crédits', regulatory: 'Réglementaire' };
const sectionOrder = ['identity', 'family', 'professional', 'capacity', 'tax', 'patrimony', 'financial', 'credits', 'objectives', 'regulatory'];
const financialCategoryLabel: Record<string, string> = { savings: 'Livrets / épargne bancaire', life_insurance: 'Assurance-vie', retirement: 'PER / retraite', securities: 'PEA / compte-titres', paper_real_estate: 'SCPI / OPCI', employee_savings: 'Épargne salariale', other: 'Autres placements' };
const generatedDocumentLabel: Record<GeneratedDocument['type'], string> = { recueil: 'Recueil d’informations', qpi: 'Profil investisseur', esg: 'Préférences de durabilité' };

const qpiControlLabel: Record<string,string> = {
  TOLERANCE_VS_CAPACITE_PERTE: 'Tolérance / capacité de perte',
  PROJET_FUTUR_VS_HORIZON: 'Projet futur / horizon',
  IMPACT_PERTE_SUR_PROJETS: 'Impact d’une perte sur les projets',
  PROJECT_RESERVE_OVERLAP: 'Projet / épargne de précaution',
  KNOWLEDGE_EXPERIENCE_OBLIGATIONS: 'Obligations : connaissances / expérience',
  KNOWLEDGE_EXPERIENCE_IMMOBILIER_PAPIER: 'SCPI / immobilier papier : connaissances / expérience',
  KNOWLEDGE_EXPERIENCE_UC: 'Unités de compte : connaissances',
  RENDEMENT_VS_FLUCTUATIONS: 'Rendement recherché / fluctuations',
};
const qpiResolutionActions: Record<string,Array<{code:string;label:string}>> = {
  PROJECT_RESERVE_OVERLAP: [
    { code:'project_included_in_precaution', label:'Projet inclus dans la réserve' },
    { code:'project_separate_from_precaution', label:'Projet distinct de la réserve' },
  ],
  PROJET_FUTUR_VS_HORIZON: [{ code:'pocket_secured', label:'Poche court terme isolée' }],
  IMPACT_PERTE_SUR_PROJETS: [{ code:'pocket_secured', label:'Contrainte intégrée à l’allocation' }],
  KNOWLEDGE_EXPERIENCE_OBLIGATIONS: [
    { code:'information_and_understanding_confirmed', label:'Explication faite + compréhension confirmée' },
    { code:'product_excluded', label:'Classe d’actifs exclue' },
    { code:'client_answer_corrected', label:'Réponse corrigée avec le client' },
  ],
  KNOWLEDGE_EXPERIENCE_IMMOBILIER_PAPIER: [
    { code:'information_and_understanding_confirmed', label:'Explication faite + compréhension confirmée' },
    { code:'product_excluded', label:'Classe d’actifs exclue' },
    { code:'client_answer_corrected', label:'Réponse corrigée avec le client' },
  ],
  KNOWLEDGE_EXPERIENCE_UC: [
    { code:'information_and_understanding_confirmed', label:'Explication faite + compréhension confirmée' },
    { code:'product_excluded', label:'Supports exclus' },
  ],
  TOLERANCE_VS_CAPACITE_PERTE: [{ code:'client_answer_confirmed', label:'Réponses confirmées' }],
  RENDEMENT_VS_FLUCTUATIONS: [
    { code:'client_answer_confirmed', label:'Réponses confirmées' },
    { code:'client_answer_corrected', label:'Réponse corrigée avec le client' },
  ],
};

function QpiControlCard({ control, busy, onResolve }: { control: QpiControlRow; busy: boolean; onResolve: (control: QpiControlRow, code: string) => void }) {
  const actions = qpiResolutionActions[control.control_code] ?? [{ code:'client_answer_confirmed', label:'Contrôle traité' }];
  return <div className={`rounded-xl border p-4 ${control.traite ? 'border-emerald-500/30 bg-emerald-950/20' : 'border-amber-500/40 bg-amber-950/25'}`}>
    <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-white">{qpiControlLabel[control.control_code] ?? humanize(control.control_code)}</p><p className="mt-1 text-sm leading-5 text-slate-200">{control.commentaire}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${control.traite ? 'bg-emerald-400/20 text-emerald-200' : 'bg-amber-400/20 text-amber-200'}`}>{control.traite ? 'Traité' : 'À traiter'}</span></div>
    {control.traite ? <p className="mt-3 text-xs text-emerald-200">Résolution : {control.resolution_code ? humanize(control.resolution_code) : 'automatique'}{control.resolved_at ? ` · ${new Date(control.resolved_at).toLocaleString('fr-FR')}` : ''}</p> : <div className="mt-3 flex flex-wrap gap-2">{actions.map((action) => <button disabled={busy} key={action.code} type="button" onClick={() => onResolve(control, action.code)} className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-white/20 disabled:opacity-50">{busy ? 'Traitement…' : action.label}</button>)}</div>}
  </div>;
}

function QpiLiquidityCard({ result }: { result: QpiResultSummaryRow }) {
  const liq = (result.synthese_dimensions?.liquidite ?? {}) as Record<string, any>;
  const min = numberValue(liq.capital_investissable_lt_min);
  const max = numberValue(liq.capital_investissable_lt_max);
  const constrainedMin = numberValue(liq.capital_contraint_min);
  const constrainedMax = numberValue(liq.capital_contraint_max);
  if (min === null && max === null && constrainedMin === null && constrainedMax === null) return null;
  const investable = min !== null && max !== null ? `${euro(min)} à ${euro(max)}` : min !== null ? `au moins ${euro(min)}` : 'Non calculable précisément';
  const constrained = constrainedMin !== null && constrainedMax !== null ? (constrainedMin === constrainedMax ? euro(constrainedMin) : `${euro(constrainedMin)} à ${euro(constrainedMax)}`) : 'À confirmer';
  return <div className="mt-4 rounded-xl border border-cyan-400/30 bg-cyan-950/20 p-4 text-sm text-cyan-50"><p className="font-semibold text-white">Cadre d’investissement long terme</p><div className="mt-2 grid gap-2 sm:grid-cols-2"><p><span className="text-cyan-200">Capital à réserver / sécuriser :</span> {constrained}</p><p><span className="text-cyan-200">Capital LT indicatif :</span> {investable}</p></div><p className="mt-2 text-xs leading-5 text-cyan-100/80">{liq.estimation === 'fourchette_a_confirmer' ? 'Fourchette à confirmer : le projet et l’épargne de précaution peuvent désigner tout ou partie de la même somme.' : 'Fourchette indicative calculée à partir des montants et de la tranche de patrimoine financier déclarés.'}</p></div>;
}

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
function flattenText(value: unknown, prefix = '', out: Array<{ key: string; value: string }> = []) {
  if (Array.isArray(value)) { value.forEach((item, index) => flattenText(item, `${prefix}[${index}]`, out)); return out; }
  if (value && typeof value === 'object') { Object.entries(value as Record<string, unknown>).forEach(([key, child]) => flattenText(child, prefix ? `${prefix}.${key}` : key, out)); return out; }
  if (typeof value === 'string' && value.trim()) out.push({ key: prefix.toLowerCase(), value: value.trim() });
  return out;
}
function sumMatching(payloads: Array<Record<string, unknown> | null>, include: RegExp, exclude?: RegExp) {
  const matches = payloads.flatMap((payload) => flattenNumbers(payload ?? {})).filter((item) => include.test(item.key) && !(exclude?.test(item.key)));
  return { value: matches.reduce((sum, item) => sum + item.value, 0), found: matches.length > 0 };
}
function firstMatchingNumber(payloads: Array<Record<string, unknown> | null>, include: RegExp) {
  const match = payloads.flatMap((payload) => flattenNumbers(payload ?? {})).find((item) => include.test(item.key));
  return match ? { value: match.value, found: true } : { value: 0, found: false };
}
function firstMatchingText(payloads: Array<Record<string, unknown> | null>, include: RegExp) {
  const match = payloads.flatMap((payload) => flattenText(payload ?? {})).find((item) => include.test(item.key));
  return match ? { value: match.value, found: true } : { value: '', found: false };
}
function objectiveSummary(payloads: Array<Record<string, unknown> | null>) {
  const candidates = payloads.flatMap((payload) => flattenText(payload ?? {}))
    .filter((item) => /(objectif|priorite|priorité|projet)/i.test(item.key) && !/(commentaire|precision|précision)/i.test(item.key))
    .map((item) => item.value)
    .filter((value, index, array) => array.indexOf(value) === index);
  return candidates.slice(0, 3);
}
function financialSnapshot(sections: SectionRow[], householdRealEstate: number) {
  const byCode = (code: string) => sections.filter((row) => row.section_code === code).map((row) => row.payload);
  const capacity = byCode('capacity'); const tax = byCode('tax'); const financial = byCode('financial'); const credits = byCode('credits'); const family = byCode('family'); const regulatory = byCode('regulatory'); const objectives = byCode('objectives');
  const annualIncome = sumMatching(capacity, /(revenu.*annuel|revenus.*annuels|salaire.*annuel|net.*annuel|revenu_net|income)/i, /(conjoint|foyer_total)/i);
  const annualCharges = sumMatching(capacity, /(charges?.*annuell|depenses?.*annuell)/i);
  const savingsCapacityMonthly = sumMatching(capacity, /(capacite.*epargne|epargne.*mensuell|effort.*epargne)/i);
  const liquidAssets = sumMatching(financial, /(disponible.*compte|comptes?.*courant|liquidit|epargne.*bancaire|livret.*montant|solde.*bancaire|montant.*disponible)/i, /(categorie|type|nombre)/i);
  const financialAssets = sumMatching(financial, /(montant|valorisation|encours|valeur)/i, /(disponible.*compte|compte.*courant|liquidit|mensualite|versement)/i);
  const monthlyDebt = sumMatching(credits, /(mensualite|mensualité|echeance.*mensuell|échéance.*mensuell)/i);
  const debtOutstanding = sumMatching(credits, /(^|\.)(crd|capital_restant|capital.*restant|encours.*credit|encours.*crédit|reste.*rembourser)/i);
  const tmi = firstMatchingNumber([...tax, ...regulatory, ...capacity], /(^|\.)(tmi|tranche.*marginale|taux.*marginal)/i);
  const taxableIncome = sumMatching(tax, /(revenu_imposable|revenu.*imposable)/i);
  const rfr = sumMatching(tax, /(revenu_fiscal_reference|revenu.*fiscal.*reference|rfr)/i);
  const incomeTax = sumMatching(tax, /(impot_revenu_net|impot.*revenu.*net|ir_net|impôt.*net)/i);
  const perCeiling = sumMatching(tax, /(plafond.*epargne.*retraite|plafond.*per|plafond_disponible)/i);
  const ifi = sumMatching(tax, /(ifi_net|ifi.*net.*payer|impot.*fortune.*immobiliere)/i);
  const landDeficit = sumMatching(tax, /(deficit_foncier|déficit.*foncier)/i);
  const familyStatus = firstMatchingText(family, /(^|\.)(situation|situation_familiale|statut_familial)$/i);
  const matrimonialRegime = firstMatchingText(family, /(regime.*matrimonial|regime_convention|régime.*convention)/i);
  const children = firstMatchingNumber(family, /(nombre.*enfants|nb.*enfants|enfants.*nombre)/i);
  const notary = firstMatchingText(family, /(notaire|notaire_nom_ville)/i);
  const transmissionClause = firstMatchingText(family, /(avantage.*matrimonial|clause|donation|testament|beneficiaire|bénéficiaire)/i);
  const monthlyIncome = annualIncome.found ? annualIncome.value / 12 : null;
  const debtRatio = monthlyIncome !== null && monthlyDebt.found ? (monthlyDebt.value / monthlyIncome) * 100 : null;
  const bankAvailableMonthly = monthlyIncome !== null && monthlyDebt.found ? Math.max(0, monthlyIncome * 0.35 - monthlyDebt.value) : null;
  const remainingMonthly = monthlyIncome !== null && monthlyDebt.found && annualCharges.found ? monthlyIncome - monthlyDebt.value - (annualCharges.value / 12) : null;
  const netRealEstate = debtOutstanding.found ? Math.max(0, householdRealEstate - debtOutstanding.value) : null;
  const patrimonyNet = netRealEstate !== null && financialAssets.found && liquidAssets.found ? netRealEstate + financialAssets.value + liquidAssets.value : null;
  const goals = objectiveSummary(objectives);
  const transmissionGoals = goals.filter((goal) => /(transmission|conjoint|proche|enfant|succession|donation)/i.test(goal));
  const missing: string[] = [];
  if (!annualIncome.found) missing.push('revenus du foyer');
  if (!annualCharges.found) missing.push('charges fixes');
  if (!monthlyDebt.found) missing.push('mensualités de crédits');
  if (!debtOutstanding.found) missing.push('capital restant dû');
  if (!financialAssets.found) missing.push('valorisation des actifs financiers');
  if (!tmi.found) missing.push('TMI');
  return { annualIncome, annualCharges, savingsCapacityMonthly, liquidAssets, financialAssets, monthlyDebt, debtOutstanding, tmi, taxableIncome, rfr, incomeTax, perCeiling, ifi, landDeficit, familyStatus, matrimonialRegime, children, notary, transmissionClause, debtRatio, bankAvailableMonthly, remainingMonthly, netRealEstate, patrimonyNet, goals, transmissionGoals, missing };
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
function WorkBlock({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-[#25405F] bg-[#0B1A2F] p-5"><div className="border-b border-[#25405F] pb-3"><h3 className="text-sm font-bold uppercase tracking-[0.12em] text-blue-300">{title}</h3><p className="mt-1 text-xs text-slate-400">{subtitle}</p></div><div className="mt-4 divide-y divide-[#203954]">{children}</div></div>;
}
function WorkLine({ label, value, attention = false }: { label: string; value: string; attention?: boolean }) {
  return <div className="flex items-start justify-between gap-4 py-2.5"><span className="text-xs font-medium text-slate-400">{label}</span><span className={`text-right text-sm font-semibold ${attention ? 'text-amber-300' : 'text-white'}`}>{value}</span></div>;
}
function objectivePresentation(goal: string) {
  const normalized = goal.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const title = goal.replace(/_/g, ' ').replace(/^./, (char) => char.toUpperCase());
  if (/(transmission|succession|donation|conjoint|enfant|proche)/.test(normalized)) return { title, category: 'Transmettre', horizon: 'Long terme', accent: 'border-violet-500/40 bg-violet-950/20', label: 'text-violet-300', badge: 'bg-violet-500/15 text-violet-200' };
  if (/(retraite|immobilier|projet|etude|residence|achat)/.test(normalized)) return { title, category: 'Projet de vie', horizon: 'Moyen / long terme', accent: 'border-orange-500/40 bg-orange-950/20', label: 'text-orange-300', badge: 'bg-orange-500/15 text-orange-200' };
  if (/(secur|liquid|precaution|epargne|dette|rembours)/.test(normalized)) return { title, category: 'Sécuriser', horizon: 'Court terme', accent: 'border-blue-500/40 bg-blue-950/20', label: 'text-blue-300', badge: 'bg-blue-500/15 text-blue-200' };
  return { title, category: 'Développer', horizon: 'Moyen terme', accent: 'border-emerald-500/40 bg-emerald-950/20', label: 'text-emerald-300', badge: 'bg-emerald-500/15 text-emerald-200' };
}

export default function CifDossierSummaryPage() {
  const [searchParams] = useSearchParams(); const dossierId = searchParams.get('dossier');
  const [dossier, setDossier] = useState<DossierRow | null>(null); const [investors, setInvestors] = useState<InvestorRow[]>([]); const [sections, setSections] = useState<SectionRow[]>([]); const [contexts, setContexts] = useState<ContextRow[]>([]); const [provenance, setProvenance] = useState<ProvenanceRow[]>([]); const [checklist, setChecklist] = useState<ChecklistRow[]>([]); const [householdConfirmations, setHouseholdConfirmations] = useState<HouseholdConfirmationRow[]>([]); const [qpiSessions, setQpiSessions] = useState<QpiSessionRow[]>([]); const [qpiControls, setQpiControls] = useState<QpiControlRow[]>([]); const [qpiResults, setQpiResults] = useState<QpiResultSummaryRow[]>([]); const [resolvingControlId, setResolvingControlId] = useState<string | null>(null); const [errorMessage, setErrorMessage] = useState(''); const [loading, setLoading] = useState(true); const [generatedDocuments, setGeneratedDocuments] = useState<GeneratedDocument[]>([]); const [generatingDocuments, setGeneratingDocuments] = useState(false); const [generationMessage, setGenerationMessage] = useState('');

  useEffect(() => { let active = true; const load = async () => { if (!dossierId) throw new Error('Dossier manquant.'); const { data: auth } = await supabase.auth.getUser(); if (!auth.user) throw new Error('Session expirée.'); const { data: current, error: roleError } = await supabase.from('app_users').select('role,actif').eq('auth_user_id', auth.user.id).maybeSingle(); if (roleError) throw roleError; if (!current?.actif || !['cif', 'admin'].includes(current.role)) throw new Error('Accès réservé au cabinet.');
    const results = await Promise.all([
      supabase.from('dossiers').select('id,reference,libelle,recueil_status,statut').eq('id', dossierId).single(),
      supabase.from('dossier_investisseurs').select('investisseur_id,role_dossier,recueil_status,qpi_status,esg_opt_in,esg_status,documents_status,investisseurs(prenom,nom,email)').eq('dossier_id', dossierId).order('role_dossier'),
      supabase.from('recueil_sections').select('investisseur_id,section_code,payload,completed_at').eq('dossier_id', dossierId),
      supabase.from('document_context_answers').select('*').eq('dossier_id', dossierId),
      supabase.from('data_provenance').select('investisseur_id,methode_collecte,statut_validation,valeur_source,valeur_retenue,source_document_id,date_validation,verified_at,retained_at,entity_table,field_name').eq('dossier_id', dossierId),
      supabase.from('document_checklist_items').select('document_code,libelle,statut,source_document_id').eq('dossier_id', dossierId),
      supabase.from('household_section_confirmations').select('section_code,status,note,source_updated_at,updated_at').eq('dossier_id', dossierId).order('section_code'),
      supabase.from('questionnaire_sessions').select('id,investisseur_id').eq('dossier_id', dossierId)
    ]); for (const result of results) if (result.error) throw result.error;
    const qSessions = (results[7].data ?? []) as unknown as QpiSessionRow[];
    const sessionIds = qSessions.map((row) => row.id);
    let controls: QpiControlRow[] = []; let resultRows: QpiResultSummaryRow[] = [];
    if (sessionIds.length) {
      const [controlsRes, qpiRes] = await Promise.all([
        supabase.from('qpi_controls').select('id,session_id,control_code,alerte,traite,commentaire,details,resolution_code,resolution_note,resolved_at').in('session_id', sessionIds).order('control_code'),
        supabase.from('qpi_results').select('session_id,synthese_dimensions').in('session_id', sessionIds),
      ]);
      if (controlsRes.error) throw controlsRes.error; if (qpiRes.error) throw qpiRes.error;
      controls = (controlsRes.data ?? []) as unknown as QpiControlRow[];
      resultRows = (qpiRes.data ?? []) as unknown as QpiResultSummaryRow[];
    }
    if (!active) return; setDossier(results[0].data as DossierRow); setInvestors((results[1].data ?? []) as unknown as InvestorRow[]); setSections((results[2].data ?? []) as unknown as SectionRow[]); setContexts((results[3].data ?? []) as unknown as ContextRow[]); setProvenance((results[4].data ?? []) as unknown as ProvenanceRow[]); setChecklist((results[5].data ?? []) as unknown as ChecklistRow[]); setHouseholdConfirmations((results[6].data ?? []) as unknown as HouseholdConfirmationRow[]); setQpiSessions(qSessions); setQpiControls(controls); setQpiResults(resultRows); };
    void load().catch((error) => { if (active) setErrorMessage(messageFromError(error)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [dossierId]);

  const resolveQpiControl = async (control: QpiControlRow, resolutionCode: string) => {
    if (!dossierId) return;
    setResolvingControlId(control.id);
    setErrorMessage('');
    try {
      const { error } = await supabase.rpc('resolve_qpi_control', { p_control_id: control.id, p_resolution_code: resolutionCode, p_note: null });
      if (error) throw error;
      const sessionIds = qpiSessions.map((row) => row.id);
      if (sessionIds.length) {
        const [controlsRes, qpiRes] = await Promise.all([
          supabase.from('qpi_controls').select('id,session_id,control_code,alerte,traite,commentaire,details,resolution_code,resolution_note,resolved_at').in('session_id', sessionIds).order('control_code'),
          supabase.from('qpi_results').select('session_id,synthese_dimensions').in('session_id', sessionIds),
        ]);
        if (controlsRes.error) throw controlsRes.error; if (qpiRes.error) throw qpiRes.error;
        setQpiControls((controlsRes.data ?? []) as unknown as QpiControlRow[]);
        setQpiResults((qpiRes.data ?? []) as unknown as QpiResultSummaryRow[]);
      }
    } catch (error) { setErrorMessage(messageFromError(error)); } finally { setResolvingControlId(null); }
  };

  const household = useMemo(() => consolidateHousehold(sections.map((row) => ({ investisseur_id: row.investisseur_id, role_dossier: investors.find((i) => i.investisseur_id === row.investisseur_id)?.role_dossier ?? '', section_code: row.section_code, payload: row.payload }))), [sections, investors]);
  const clientDisplayName = useMemo(() => {
    const names = investors
      .map((investor) => investor.investisseurs ? [investor.investisseurs.prenom, investor.investisseurs.nom].filter(Boolean).join(' ').trim() : '')
      .filter(Boolean);
    return names.length ? names.join(' & ') : (dossier?.libelle || 'Dossier client');
  }, [investors, dossier?.libelle]);
  const snapshot = useMemo(() => financialSnapshot(sections, household.realEstate.totalValue), [sections, household.realEstate.totalValue]);
  const investorSummaries = useMemo(() => investors.map((investor) => { const investorSections = sections.filter((r) => r.investisseur_id === investor.investisseur_id); const payloadByCode = Object.fromEntries(investorSections.map((r) => [r.section_code, r.payload ?? {}])); const spouse = investors.find((r) => r.investisseur_id !== investor.investisseur_id)?.investisseurs ?? null; const context = contexts.find((r) => r.investisseur_id === investor.investisseur_id) ?? {}; const consistencySnapshot: ConsistencySnapshot = { identity: payloadByCode.identity ?? {}, family: payloadByCode.family ?? {}, professional: payloadByCode.professional ?? {}, capacity: payloadByCode.capacity ?? {}, patrimony: payloadByCode.patrimony ?? {}, financial: payloadByCode.financial ?? {}, credits: payloadByCode.credits ?? {}, regulatory: payloadByCode.regulatory ?? {}, documents: context, spouse }; const issues = evaluateConsistency(consistencySnapshot); const investorProvenance = provenance.filter((r) => !r.investisseur_id || r.investisseur_id === investor.investisseur_id); const summary = summarizeAdvisorDossier({ sections: investorSections, provenance: investorProvenance, checklist, issues, roleDossier: investor.role_dossier }); return { investor, investorSections, issues, summary }; }), [investors, sections, contexts, provenance, checklist]);
  const investorDocumentStates = useMemo(() => investors.map((investor) => {
    const recueil = ['completed', 'validated'].includes(investor.recueil_status);
    const qpi = ['completed', 'validated'].includes(investor.qpi_status);
    const esgNotApplicable = investor.esg_opt_in === false;
    const esg = ['completed', 'validated'].includes(investor.esg_status);
    const readyTypes: GeneratedDocument['type'][] = [
      ...(recueil ? ['recueil' as const] : []),
      ...(qpi ? ['qpi' as const] : []),
      ...(esg ? ['esg' as const] : []),
    ];
    return { investor, recueil, qpi, esg, esgNotApplicable, readyTypes };
  }), [investors]);
  const documentGenerationKey = useMemo(() => investorDocumentStates.map((state) => `${state.investor.investisseur_id}:${state.readyTypes.join(',')}`).join('|'), [investorDocumentStates]);
  useEffect(() => {
    if (!dossierId || !dossier || !investorDocumentStates.some((state) => state.readyTypes.length)) return;
    let active = true;
    const generate = async () => {
      setGeneratingDocuments(true);
      setGenerationMessage('');
      const batches = await Promise.all(investorDocumentStates.map(async (state) => {
        if (!state.readyTypes.length) return [] as GeneratedDocument[];
        const { data, error } = await supabase.functions.invoke('generate-cif-pdfs', {
          body: { dossier_id: dossierId, investisseur_id: state.investor.investisseur_id, document_types: state.readyTypes },
        });
        if (error) throw error;
        if (!data?.ok || !Array.isArray(data.documents)) throw new Error(data?.error || 'Génération documentaire impossible.');
        return data.documents as GeneratedDocument[];
      }));
      if (active) setGeneratedDocuments(batches.flat());
    };
    void generate().catch((error) => { if (active) setGenerationMessage(messageFromError(error)); }).finally(() => { if (active) setGeneratingDocuments(false); });
    return () => { active = false; };
  }, [dossierId, dossier?.id, documentGenerationKey]);

  if (loading) return <div className="min-h-screen bg-blue-50/30 p-10 text-sm text-slate-500">Chargement de la synthèse conseiller…</div>;
  if (errorMessage) return <div className="min-h-screen bg-blue-50/30 p-10"><Link to="/cabinet" className="text-sm font-semibold text-slate-600">← Retour cabinet</Link><p className="mt-6 rounded-2xl bg-red-50 p-5 text-sm text-red-700">{errorMessage}</p></div>;
  if (!dossier) return null;

  return <div className="min-h-screen bg-blue-50/30 px-4 py-8 sm:px-6"><div className="mx-auto max-w-7xl space-y-6">
    <header className="rounded-3xl bg-slate-950 p-7 text-white shadow-sm sm:p-9"><Link to="/cabinet" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-200"><ArrowLeft className="h-4 w-4" /> Retour aux dossiers</Link><p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Synthèse patrimoniale conseiller</p><h1 className="mt-2 text-3xl font-semibold">{clientDisplayName}</h1>{dossier.reference ? <p className="mt-1 text-xs font-medium text-slate-500">Dossier {dossier.reference}</p> : null}<p className="mt-2 text-sm text-slate-300">Vue de travail complète : situation, patrimoine, objectifs, profil réglementaire, pièces et contrôles CIF.</p></header>

    {householdConfirmations.length > 0 && <section className="rounded-3xl border border-amber-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-3"><div className="rounded-2xl bg-amber-50 p-3"><AlertTriangle className="h-5 w-5 text-amber-700" /></div><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">Validation du foyer</p><h2 className="mt-1 text-xl font-semibold text-slate-950">Confirmation du second membre</h2><p className="mt-1 text-sm text-slate-500">Les remarques du second membre n’écrasent jamais la déclaration initiale. Une correction signalée doit être arbitrée puis reconfirmée.</p></div></div>
      <div className="mt-5 grid gap-3 lg:grid-cols-3">{householdConfirmations.map((item) => <div key={item.section_code} className={`rounded-2xl border p-4 ${item.status==='change_requested'?'border-amber-300 bg-amber-50':'border-emerald-200 bg-emerald-50'}`}><div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-950">{sectionLabel[item.section_code] ?? item.section_code}</p><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${item.status==='change_requested'?'bg-amber-200 text-amber-900':'bg-emerald-200 text-emerald-900'}`}>{item.status==='change_requested'?'À arbitrer':'Confirmé'}</span></div>{item.note&&<p className="mt-3 text-sm leading-5 text-slate-700">{item.note}</p>}<p className="mt-3 text-[11px] text-slate-400">Mis à jour le {new Date(item.updated_at).toLocaleString('fr-FR')}</p></div>)}</div>
    </section>}

    <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-start gap-3"><div className="rounded-2xl bg-emerald-50 p-3"><FileText className="h-5 w-5 text-emerald-700" /></div><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Documents du dossier</p><h2 className="mt-1 text-xl font-semibold text-slate-950">Collecte client et chaîne réglementaire</h2><p className="mt-1 text-sm text-slate-500">Les documents sont regroupés selon leur rôle dans le parcours : collecte, mission puis adéquation du conseil.</p></div></div>{generationMessage && <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{generationMessage}</p>}<div className="mt-6 grid gap-5 lg:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Collecte client</p><div className="mt-3 space-y-3">{investorDocumentStates.map((state) => { const investor = state.investor; const name = `${investor.investisseurs?.prenom ?? ''} ${investor.investisseurs?.nom ?? ''}`.trim() || 'Client'; const individualDone = state.recueil && state.qpi && (state.esg || state.esgNotApplicable); return <div key={investor.investisseur_id} className={`relative overflow-hidden rounded-2xl border p-4 pl-5 shadow-[0_10px_28px_rgba(15,23,42,0.07)] ${individualDone ? 'border-emerald-200/80 bg-gradient-to-r from-emerald-50/95 via-white to-white' : 'border-blue-200/80 bg-gradient-to-r from-blue-50/95 via-white to-white'}`}><span aria-hidden="true" className={`absolute bottom-4 left-0 top-4 w-1 rounded-r-full ${individualDone ? 'bg-emerald-400' : 'bg-blue-400'}`} /><div className="flex flex-wrap items-center justify-between gap-3"><div><p className={`font-semibold ${individualDone ? 'text-emerald-950' : 'text-blue-950'}`}>{name}</p><p className={`mt-0.5 text-xs ${individualDone ? 'text-emerald-700/70' : 'text-blue-700/70'}`}>{investor.role_dossier === 'investisseur_1' ? 'Identifiant 1' : 'Identifiant 2'}</p></div><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase shadow-sm ${individualDone ? 'border-emerald-200 bg-emerald-100/80 text-emerald-700' : 'border-blue-200 bg-blue-100/80 text-blue-700'}`}>{individualDone ? 'Parcours terminé' : 'Parcours en cours'}</span></div><div className="mt-3 grid gap-3 sm:grid-cols-3">{(['recueil','qpi','esg'] as GeneratedDocument['type'][]).map((type) => { const notApplicable = type === 'esg' && state.esgNotApplicable; const completed = type === 'recueil' ? state.recueil : type === 'qpi' ? state.qpi : state.esg; const document = generatedDocuments.find((item) => item.investisseur_id === investor.investisseur_id && item.type === type && item.signed_url); const classes = notApplicable ? 'border-slate-300 bg-white text-slate-600' : completed ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-red-200 bg-red-50 text-red-900'; const badge = notApplicable ? 'bg-slate-100 text-slate-600' : completed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'; const status = notApplicable ? 'Aucune préférence exprimée' : completed ? 'Terminé' : 'À compléter'; return <div key={type} className={`rounded-xl border px-3 py-3 ${classes}`}><div className="flex items-start justify-between gap-2"><span className="text-sm font-semibold">{generatedDocumentLabel[type]}</span><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${badge}`}>{status}</span></div>{completed && <div className="mt-3 flex flex-wrap gap-2">{document?.signed_url ? <a href={document.signed_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-2.5 py-1.5 text-[11px] font-semibold text-white"><Download className="h-3.5 w-3.5" /> Voir le PDF</a> : generatingDocuments ? <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Préparation du PDF</span> : null}{type === 'recueil' && <a href={`#investor-${investor.investisseur_id}`} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700">Voir les réponses</a>}</div>}</div>; })}</div></div>; })}</div></div><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Documents réglementaires</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-[#315173] bg-[#0B1A2F] px-4 py-3 shadow-sm"><p className="text-sm font-semibold text-white">DER</p><p className="mt-1 text-[11px] font-semibold text-amber-300">À générer</p></div><div className="rounded-xl border border-[#315173] bg-[#0B1A2F] px-4 py-3 shadow-sm"><p className="text-sm font-semibold text-white">Lettre de mission</p><p className="mt-1 text-[11px] font-semibold text-amber-300">À générer</p></div><Link to={`/cabinet/adequation?dossier=${dossierId}`} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 transition hover:bg-blue-100"><p className="text-sm font-semibold text-slate-900">Déclaration d’adéquation</p><p className="mt-1 text-[11px] font-semibold text-blue-700">Ouvrir / vérifier</p></Link></div><p className="mt-3 text-xs leading-5 text-slate-500">Le DER et la lettre de mission interviennent avant la recommandation. La déclaration d’adéquation est finalisée après validation de la stratégie et des supports.</p></div></div></section>

    <div className="overflow-hidden rounded-2xl border border-amber-500/60 bg-[#0B1A2F] shadow-[0_16px_40px_rgba(2,10,25,0.18)]">
        <div className="flex flex-col gap-3 border-b border-[#25405F] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300"><CheckCircle2 className="h-4 w-4" /></span><h3 className="text-sm font-bold uppercase tracking-[0.12em] text-amber-200">Objectifs prioritaires du foyer</h3></div>
            <p className="mt-1 pl-10 text-xs text-slate-400">Les priorités déclarées qui guideront les recommandations et le séquencement patrimonial.</p>
          </div>
          <span className="self-start rounded-full border border-[#315173] bg-[#10243E] px-3 py-1.5 text-[11px] font-semibold text-blue-200 sm:self-center">Court, moyen et long terme</span>
        </div>
        {snapshot.goals.length ? <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">{snapshot.goals.map((goal) => { const meta = objectivePresentation(goal); return <div key={goal} className={`rounded-2xl border p-4 ${meta.accent}`}><p className={`text-[11px] font-bold uppercase tracking-[0.12em] ${meta.label}`}>{meta.category}</p><p className="mt-2 text-sm font-semibold leading-5 text-white">{meta.title}</p><span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.badge}`}>{meta.horizon}</span></div>; })}</div> : <div className="p-5"><div className="rounded-2xl border border-amber-500/40 bg-amber-950/20 p-4 text-sm font-semibold text-amber-200">Objectifs à préciser avec le client.</div></div>}
        <div className={`border-t px-4 py-3 text-xs sm:px-5 ${snapshot.missing.length ? 'border-amber-500/30 bg-amber-950/10 text-amber-100' : 'border-emerald-500/30 bg-emerald-950/10 text-emerald-100'}`}><strong>{snapshot.missing.length ? 'Points à compléter avant conseil :' : 'Données de travail principales disponibles.'}</strong>{snapshot.missing.length ? ` ${snapshot.missing.join(', ')}.` : ''}</div>
      </div>

    <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-3"><div className="rounded-2xl bg-blue-50 p-3"><ShieldCheck className="h-5 w-5 text-blue-700" /></div><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Contrôles du dossier</p><h2 className="mt-1 text-xl font-semibold text-slate-950">Contrôles CIF à traiter et Complétude réglementaire</h2><p className="mt-1 text-sm text-slate-500">Lecture consolidée des incohérences, données manquantes et validations réglementaires.</p></div></div>
      <div className="mt-5 space-y-5">{investorSummaries.map(({ investor, issues, summary }) => <div key={investor.investisseur_id}>{investorSummaries.length > 1 && <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-blue-500">{investor.investisseurs?.prenom} {investor.investisseurs?.nom}</p>}
      <div className="mt-6 grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-blue-500/40 bg-gradient-to-br from-[#17365E] to-[#0B1A2F] p-5 text-white shadow-[0_14px_34px_rgba(2,10,25,0.18)]"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20 text-blue-200"><ShieldCheck className="h-5 w-5" /></span><div><h3 className="font-semibold text-white">Contrôles CIF à traiter</h3><p className="mt-1 text-xs text-blue-200/80">Vérifications de cohérence et points d’attention métier.</p></div></div>{issues.length ? <div className="mt-4 space-y-3">{issues.map((issue: ConsistencyIssue) => <div key={issue.code} className={`rounded-xl border p-4 ${issue.severity === 'blocking' ? 'border-red-500/40 bg-red-950/30' : issue.severity === 'review' ? 'border-amber-500/40 bg-amber-950/25' : 'border-blue-400/30 bg-blue-950/25'}`}><p className="font-semibold text-white">{issue.title}</p><p className="mt-1 text-sm leading-5 text-slate-200">{issue.message}</p></div>)}</div> : <div className="mt-4 rounded-xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-200">Aucune incohérence issue du recueil détectée.</div>}
      {(() => { const sessionIds = qpiSessions.filter((s) => s.investisseur_id === investor.investisseur_id).map((s) => s.id); const controls = qpiControls.filter((control) => sessionIds.includes(control.session_id) && control.alerte); const qpiResult = qpiResults.find((result) => sessionIds.includes(result.session_id)); return <>{controls.length > 0 && <div className="mt-4 space-y-3"><p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-200">Contrôles QPI traçables</p>{controls.map((control) => <QpiControlCard key={control.id} control={control} busy={resolvingControlId === control.id} onResolve={(item, code) => void resolveQpiControl(item, code)} />)}</div>}{qpiResult && <QpiLiquidityCard result={qpiResult} />}</>; })()}</div><div className="rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-[#0F3B3A] to-[#0B1A2F] p-5 text-white shadow-[0_14px_34px_rgba(2,10,25,0.18)]"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-200"><FileCheck2 className="h-5 w-5" /></span><div><h3 className="font-semibold text-white">Complétude réglementaire</h3><p className="mt-1 text-xs text-emerald-100/80">État des données, pièces et validations requises.</p></div></div><div className="mt-4 border-t border-emerald-400/20 pt-4 text-sm text-slate-100">{summary.sections.missing.length > 0 && <p className="leading-5"><strong className="text-white">Sections manquantes :</strong> {summary.sections.missing.map((c) => sectionLabel[c] ?? c).join(', ')}</p>}<div className="mt-4 grid gap-3 sm:grid-cols-2"><p><strong className="text-emerald-100">Données à contrôler :</strong> {summary.provenance.cifReviewRequired}</p><p><strong className="text-emerald-100">Reçus non validés :</strong> {summary.documents.received}</p><p><strong className="text-white">Justificatifs manquants :</strong> {summary.documents.missing}</p><p><strong className="text-emerald-100">Demandés :</strong> {summary.documents.requested}</p></div></div></div></div>
      </div>)}</div>
    </section>

    <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-start gap-3"><div className="rounded-2xl bg-blue-50 p-3"><Home className="h-5 w-5 text-blue-700" /></div><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Photographie patrimoniale du foyer</p><h2 className="mt-1 text-xl font-semibold text-slate-950">Les chiffres utiles pour travailler le dossier</h2><p className="mt-1 text-sm text-slate-500">Lecture par problématique patrimoniale. Aucune valeur n’est déduite lorsqu’une donnée nécessaire manque.</p></div></div>
      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <WorkBlock title="Revenus & capacité" subtitle="Flux, charges et marge de manœuvre"><WorkLine label="Revenus annuels" value={snapshot.annualIncome.found ? euro(snapshot.annualIncome.value) : 'Non renseigné'} attention={!snapshot.annualIncome.found} /><WorkLine label="Revenus mensuels" value={snapshot.annualIncome.found ? euro(snapshot.annualIncome.value / 12) : 'Non calculable'} attention={!snapshot.annualIncome.found} /><WorkLine label="Charges annuelles" value={snapshot.annualCharges.found ? euro(snapshot.annualCharges.value) : 'Non renseigné'} attention={!snapshot.annualCharges.found} /><WorkLine label="Capacité d’épargne" value={snapshot.savingsCapacityMonthly.found ? `${euro(snapshot.savingsCapacityMonthly.value)} / mois` : 'Non renseigné'} attention={!snapshot.savingsCapacityMonthly.found} /><WorkLine label="Reste disponible mensuel" value={snapshot.remainingMonthly !== null ? euro(snapshot.remainingMonthly) : 'Non calculable'} attention={snapshot.remainingMonthly === null} /></WorkBlock>
        <WorkBlock title="Fiscal" subtitle="Fiscalité personnelle et leviers disponibles"><WorkLine label="TMI" value={snapshot.tmi.found ? percent(snapshot.tmi.value) : 'Non renseignée'} attention={!snapshot.tmi.found} /><WorkLine label="Revenu imposable" value={snapshot.taxableIncome.found ? euro(snapshot.taxableIncome.value) : 'Non renseigné'} attention={!snapshot.taxableIncome.found} /><WorkLine label="RFR" value={snapshot.rfr.found ? euro(snapshot.rfr.value) : 'Non renseigné'} attention={!snapshot.rfr.found} /><WorkLine label="IR net" value={snapshot.incomeTax.found ? euro(snapshot.incomeTax.value) : 'Non renseigné'} attention={!snapshot.incomeTax.found} /><WorkLine label="Plafond PER disponible" value={snapshot.perCeiling.found ? euro(snapshot.perCeiling.value) : 'Non renseigné'} attention={!snapshot.perCeiling.found} /><WorkLine label="IFI" value={snapshot.ifi.found ? euro(snapshot.ifi.value) : 'Non concerné / non renseigné'} /><WorkLine label="Déficit foncier reportable" value={snapshot.landDeficit.found ? euro(snapshot.landDeficit.value) : 'Non renseigné'} /></WorkBlock>
        <WorkBlock title="Placements & liquidités" subtitle="Actifs financiers mobilisables et encours"><WorkLine label="Actifs financiers" value={snapshot.financialAssets.found ? euro(snapshot.financialAssets.value) : 'Non valorisés'} attention={!snapshot.financialAssets.found} /><WorkLine label="Familles de placements" value={household.financialCategories.length ? household.financialCategories.map((c) => financialCategoryLabel[c] ?? c).join(', ') : 'Aucun placement identifié'} attention={!household.financialCategories.length} /><WorkLine label="Patrimoine net estimé" value={snapshot.patrimonyNet !== null ? euro(snapshot.patrimonyNet) : 'Non calculable'} attention={snapshot.patrimonyNet === null} /></WorkBlock>
        <WorkBlock title="Immobilier" subtitle="Valeur, détention et patrimoine net"><WorkLine label="Nombre de biens" value={`${household.realEstate.count}`} /><WorkLine label="Immobilier brut" value={euro(household.realEstate.totalValue)} /><WorkLine label="Biens communs" value={euro(household.realEstate.jointValue)} /><WorkLine label="Immobilier net estimé" value={snapshot.netRealEstate !== null ? euro(snapshot.netRealEstate) : 'Non calculable'} attention={snapshot.netRealEstate === null} /><WorkLine label="Ressaisies neutralisées" value={`${household.realEstate.duplicatesIgnored}`} /></WorkBlock>
        <WorkBlock title="Crédits & endettement" subtitle="Poids de la dette et solvabilité"><WorkLine label="Mensualités crédits" value={snapshot.monthlyDebt.found ? euro(snapshot.monthlyDebt.value) : 'Non renseigné'} attention={!snapshot.monthlyDebt.found} /><WorkLine label="Capital restant dû" value={snapshot.debtOutstanding.found ? euro(snapshot.debtOutstanding.value) : 'Non renseigné'} attention={!snapshot.debtOutstanding.found} /><WorkLine label="Taux d’endettement" value={snapshot.debtRatio !== null ? percent(snapshot.debtRatio) : 'Non calculable'} attention={snapshot.debtRatio === null} /><WorkLine label="Disponible bancaire" value={snapshot.bankAvailableMonthly !== null ? `${euro(snapshot.bankAvailableMonthly)} / mois` : 'Non calculable'} attention={snapshot.bankAvailableMonthly === null} /></WorkBlock>
        <WorkBlock title="Succession / transmission" subtitle="Organisation familiale et transmission patrimoniale"><WorkLine label="Situation familiale" value={snapshot.familyStatus.found ? snapshot.familyStatus.value : 'Non renseignée'} attention={!snapshot.familyStatus.found} /><WorkLine label="Régime / convention" value={snapshot.matrimonialRegime.found ? snapshot.matrimonialRegime.value : 'Non renseigné'} attention={!snapshot.matrimonialRegime.found} /><WorkLine label="Enfants" value={snapshot.children.found ? new Intl.NumberFormat('fr-FR').format(snapshot.children.value) : 'Non renseigné'} attention={!snapshot.children.found} /><WorkLine label="Notaire" value={snapshot.notary.found ? snapshot.notary.value : 'Non renseigné'} /><WorkLine label="Clause / avantage identifié" value={snapshot.transmissionClause.found ? snapshot.transmissionClause.value : 'Aucun élément identifié'} /><WorkLine label="Objectif transmission" value={snapshot.transmissionGoals.length ? snapshot.transmissionGoals.join(' · ') : 'Aucun objectif spécifique identifié'} /></WorkBlock>
      </div>
      {household.warnings.length > 0 && <div className="mt-3 rounded-2xl border border-amber-500/60 bg-amber-950/20 p-4 text-sm text-amber-100"><strong>À contrôler :</strong> {household.warnings.join(' ')}</div>}
    </section>

    {investorSummaries.map(({ investor, investorSections, summary }) => { const badge = readinessLabel(summary.readiness); const orderedSections = [...investorSections].sort((a, b) => sectionOrder.indexOf(a.section_code) - sectionOrder.indexOf(b.section_code)); return <section id={`investor-${investor.investisseur_id}`} key={investor.investisseur_id} className="scroll-mt-6 rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><div className="rounded-2xl bg-blue-50 p-3"><UserRound className="h-5 w-5 text-blue-700" /></div><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-500">{investor.role_dossier === 'investisseur_1' ? 'Identifiant 1' : 'Identifiant 2'}</p><h2 className="mt-1 text-xl font-semibold text-slate-950">{investor.investisseurs?.prenom} {investor.investisseurs?.nom}</h2><p className="mt-1 text-xs text-slate-500">{investor.investisseurs?.email || 'Email non renseigné'} · Recueil {investor.recueil_status} · QPI {investor.qpi_status} · Durabilité {investor.esg_opt_in === false ? 'aucune préférence exprimée' : investor.esg_status}</p></div></div><span className={`inline-flex items-center gap-2 self-start rounded-full px-3 py-2 text-xs font-bold ${badge.className}`}>{badge.icon}{badge.label}</span></div>
      <div className="mt-7"><p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Données déclarées</p><h3 className="mt-1 text-lg font-semibold text-slate-950">Lecture complète du recueil</h3><p className="mt-1 text-sm text-slate-500">Toutes les informations saisies dans le parcours client sont remontées ici, sans ressaisie.</p><div className="mt-5 grid gap-4 lg:grid-cols-2">{orderedSections.map((row) => <PayloadCard key={row.section_code} code={row.section_code} payload={row.payload ?? {}} />)}</div>{!orderedSections.length && <p className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm text-slate-600">Aucune donnée de recueil disponible pour cet identifiant.</p>}</div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-2xl border border-blue-100 p-4"><p className="text-xs font-bold uppercase text-blue-500">Recueil</p><p className="mt-2 text-2xl font-semibold">{summary.sections.completed}/{summary.sections.total}</p></div><div className="rounded-2xl border border-blue-100 p-4"><p className="text-xs font-bold uppercase text-blue-500">Données contrôlées</p><p className="mt-2 text-2xl font-semibold">{summary.provenance.verified + summary.provenance.retained}/{summary.provenance.total}</p></div><div className="rounded-2xl border border-blue-100 p-4"><p className="text-xs font-bold uppercase text-blue-500">Justificatifs</p><p className="mt-2 text-2xl font-semibold">{summary.documents.validated}/{summary.documents.total}</p></div><div className="rounded-2xl border border-blue-100 p-4"><p className="text-xs font-bold uppercase text-blue-500">Contrôles</p><p className="mt-2 text-2xl font-semibold">{summary.consistency.total}</p></div></div>

    </section>; })}







  </div></div>;
}
