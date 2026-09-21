import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, ArrowLeft, CheckCircle2, Download, FileCheck2, FileText, Home, Loader2, ShieldCheck, UserRound } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { evaluateConsistency, type ConsistencyIssue, type ConsistencySnapshot } from '../../portal/consistencyEngine';
import { summarizeAdvisorDossier, type ChecklistItemInput, type SectionInput } from '../../portal/advisorSummaryEngine';
import { consolidateHousehold } from '../../portal/householdConsolidationEngine';
import type { DataStatusInput } from '../../portal/dataStatusEngine';
import { messageFromError } from '../../portal/portalHelpers';

type DossierRow = { id: string; reference: string | null; libelle: string | null; recueil_status: string; statut: string };
type InvestorRow = { investisseur_id: string; role_dossier: string; recueil_status: string; qpi_status: string; esg_opt_in: boolean | null; esg_status: string; documents_status: string; transmitted_at: string | null; investisseurs: { prenom: string; nom: string; email: string | null } | null };
type SectionRow = SectionInput & { investisseur_id: string; section_code: string; payload: Record<string, unknown> | null };
type ContextRow = Record<string, unknown> & { investisseur_id: string };
type ProvenanceRow = DataStatusInput & { investisseur_id?: string | null; entity_table?: string | null; field_name?: string | null };
type ChecklistRow = ChecklistItemInput & { document_code?: string | null; libelle?: string | null; source_document_id?: string | null };
type GeneratedDocument = { type: 'recueil' | 'qpi' | 'esg' | 'der' | 'mission'; investisseur_id?: string | null; document_id: string; signed_url: string | null; path: string; reused: boolean; format?: 'pdf' };
type HouseholdConfirmationRow = { section_code:string; status:'confirmed'|'change_requested'; note:string|null; source_updated_at:string; updated_at:string };
type QpiSessionRow = { id:string; investisseur_id:string };
type QpiControlRow = { id:string; session_id:string; control_code:string; alerte:boolean; traite:boolean; commentaire:string|null; details:Record<string,unknown>; resolution_code:string|null; resolution_note:string|null; resolved_at:string|null };
type QpiResultSummaryRow = { session_id:string; synthese_dimensions:Record<string,unknown> & { liquidite?: Record<string,unknown> } };
type SourceDocumentRow = { id:string; investisseur_id:string|null; categorie:string; nom_fichier:string; storage_bucket:string|null; storage_path:string|null; statut_analyse:string; portee_document?:'auto'|'investisseur'|'foyer'; concerne_investisseur_ids?:string[]; metadata:Record<string,unknown>|null; created_at:string };
type RecueilCompletenessRow = { dossier_id:string; investisseur_id:string; percentage:number; complete:boolean; details:{ sections?:Array<{section_code:string;complete:boolean;missing_fields:string[];source:string}>; validated_with_current_gaps?:boolean } };

type AuditAllocationItem = { poche:string; montant:string; decision:string };
type AuditSupportItem = { support:string; analyse:string; decision:string };
type AuditSequenceItem = { ordre:string; action:string; echeance:string };
type AuditFiscalItem = { sujet:string; analyse:string };
type AuditControlItem = { scenario:string; impact:string; reponse:string };
type AuditRecommendationRow = {
  id:string;
  dossier_id:string;
  statut:'draft'|'generated'|'validated';
  diagnostic:string|null;
  projet_a_preserver:string|null;
  reserve_securite:number|null;
  epargne_a_arbitrer:number|null;
  allocation:unknown;
  supports:unknown;
  sequencing:unknown;
  fiscal_notes:unknown;
  protection_notes:string|null;
  controls:unknown;
  validated_at:string|null;
  created_at:string;
  updated_at:string;
};
type AuditDraft = {
  statut:'draft'|'generated'|'validated';
  diagnostic:string;
  projet_a_preserver:string;
  reserve_securite:string;
  epargne_a_arbitrer:string;
  allocation:AuditAllocationItem[];
  supports:AuditSupportItem[];
  sequencing:AuditSequenceItem[];
  fiscal_notes:AuditFiscalItem[];
  protection_notes:string;
  controls:AuditControlItem[];
  validated_at:string|null;
};

type ProfessionalProperty = {
  id:string;
  title:string;
  city:string;
  type:string;
  usage:string;
  owner:string;
  ownershipShare:string;
  holding:string;
  value:number|null;
  annualRent:number|null;
  monthlyRent:number|null;
  project:string;
  acquisitionDate:string;
  acquisitionPrice:number|null;
  comment:string;
  linkedCreditId:string|null;
  outstanding:number|null;
  netEquity:number|null;
};
type ProfessionalFinancialAsset = {
  id:string;
  owner:string;
  type:string;
  institution:string;
  amount:number|null;
  taxTreatment:string;
  liquidity:string;
  sourceFile:string;
};
type ProfessionalCredit = {
  id:string;
  attachedTo:string;
  bank:string;
  borrower:string;
  type:string;
  initialAmount:number|null;
  outstanding:number|null;
  rate:number|null;
  rateType:string;
  currentPayment:number|null;
  futurePayment:number|null;
  futurePaymentDate:string;
  openingDate:string;
  endDate:string;
  remainingMonths:number|null;
  insurance:string;
  phase:string;
  sourceFile:string;
};

function professionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}
function professionalDate(value: unknown): string {
  if (!value) return '—';
  const raw = String(value);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString('fr-FR');
}
function professionalText(value: unknown, fallback = '—'): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}
function normalizedSearch(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
function financialTreatment(type: string): { taxTreatment:string; liquidity:string } {
  const normalized = normalizedSearch(type);
  if (/livret a|ldds|lep/.test(normalized)) return { taxTreatment:'Exonérée', liquidity:'Immédiate' };
  if (/livret|epargne bancaire|compte courant/.test(normalized)) return { taxTreatment:'Selon support', liquidity:'Immédiate' };
  if (/pea/.test(normalized)) return { taxTreatment:'PEA', liquidity:'Marché / règles PEA' };
  if (/compte.?titres|cto|bourse/.test(normalized)) return { taxTreatment:'PFU / IR', liquidity:'Marché' };
  if (/assurance.?vie/.test(normalized)) return { taxTreatment:'Assurance-vie', liquidity:'Rachat' };
  if (/per|retraite/.test(normalized)) return { taxTreatment:'Retraite', liquidity:'Contrainte' };
  if (/pee|epargne salariale/.test(normalized)) return { taxTreatment:'Épargne salariale', liquidity:'Contrainte' };
  if (/scpi|opci|sci/.test(normalized)) return { taxTreatment:'Immobilier', liquidity:'Limitée' };
  return { taxTreatment:'À qualifier', liquidity:'À qualifier' };
}

type WorkspaceTab = 'synthese' | 'clients' | 'patrimoine' | 'fiscalite' | 'audit' | 'documents' | 'conformite';
const workspaceTabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'synthese', label: 'Synthèse' },
  { id: 'clients', label: 'Clients' },
  { id: 'patrimoine', label: 'Patrimoine' },
  { id: 'fiscalite', label: 'Fiscalité' },
  { id: 'audit', label: 'Audit' },
  { id: 'documents', label: 'Documents' },
  { id: 'conformite', label: 'Conformité' },
];

const sectionLabel: Record<string, string> = { identity: 'Identité', family: 'Situation familiale', professional: 'Profession', objectives: 'Objectifs', capacity: 'Revenus & capacité', tax: 'Fiscalité', patrimony: 'Immobilier', financial: 'Patrimoine financier', credits: 'Crédits', regulatory: 'Réglementaire' };
const sectionOrder = ['identity', 'family', 'professional', 'capacity', 'tax', 'patrimony', 'financial', 'credits', 'objectives', 'regulatory'];
const financialCategoryLabel: Record<string, string> = { savings: 'Livrets / épargne bancaire', life_insurance: 'Assurance-vie', retirement: 'PER / retraite', securities: 'PEA / compte-titres', paper_real_estate: 'SCPI / OPCI', employee_savings: 'Épargne salariale', other: 'Autres placements' };
const sourceDocumentCategoryLabel: Record<string,string> = {
  avis_imposition: 'Avis d’imposition',
  patrimoine_financier: 'Patrimoine financier',
  patrimoine_immobilier: 'Patrimoine immobilier',
  tableau_amortissement: 'Tableau d’amortissement',
  identite: 'Pièce d’identité',
  sci_societe: 'SCI / société',
  autre: 'Autre justificatif',
};
function sourceAnalysisLabel(status:string) {
  if (status === 'validated') return { label:'Validé', cls:'bg-emerald-100 text-emerald-700' };
  if (status === 'extracted') return { label:'Données intégrées', cls:'bg-emerald-100 text-emerald-700' };
  if (status === 'processing') return { label:'Analyse en cours', cls:'bg-blue-100 text-blue-700' };
  if (status === 'to_review') return { label:'À contrôler', cls:'bg-amber-100 text-amber-800' };
  if (status === 'rejected') return { label:'Rejeté', cls:'bg-red-100 text-red-700' };
  return { label:'Reçu', cls:'bg-slate-100 text-slate-700' };
}

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
  const liq = result.synthese_dimensions?.liquidite ?? {};
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
function auditArray<T extends Record<string,string>>(value: unknown, fields: Array<keyof T>): T[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const source = item as Record<string,unknown>;
      return Object.fromEntries(fields.map((field) => [field, String(source[String(field)] ?? '')])) as T;
    });
}
function auditSupports(value: unknown): AuditSupportItem[] {
  if (Array.isArray(value)) return auditArray<AuditSupportItem>(value, ['support','analyse','decision']);
  if (value && typeof value === 'object') {
    const obj = value as Record<string,unknown>;
    if (Array.isArray(obj.items)) return auditArray<AuditSupportItem>(obj.items, ['support','analyse','decision']);
    return Object.entries(obj)
      .filter(([,v]) => typeof v === 'string' && String(v).trim())
      .map(([support, analyse]) => ({ support: humanize(support), analyse: String(analyse), decision: '' }));
  }
  return [];
}
function auditFiscalNotes(value: unknown): AuditFiscalItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    if (typeof item === 'string') return { sujet: `Point fiscal ${index + 1}`, analyse: item };
    if (item && typeof item === 'object') {
      const row = item as Record<string,unknown>;
      return { sujet: String(row.sujet ?? row.title ?? ''), analyse: String(row.analyse ?? row.note ?? '') };
    }
    return { sujet:'', analyse:'' };
  });
}
function auditDraftFromRow(row: AuditRecommendationRow | null): AuditDraft {
  return {
    statut: row?.statut ?? 'draft',
    diagnostic: row?.diagnostic ?? '',
    projet_a_preserver: row?.projet_a_preserver ?? '',
    reserve_securite: row?.reserve_securite === null || row?.reserve_securite === undefined ? '' : String(row.reserve_securite),
    epargne_a_arbitrer: row?.epargne_a_arbitrer === null || row?.epargne_a_arbitrer === undefined ? '' : String(row.epargne_a_arbitrer),
    allocation: auditArray<AuditAllocationItem>(row?.allocation, ['poche','montant','decision']),
    supports: auditSupports(row?.supports),
    sequencing: auditArray<AuditSequenceItem>(row?.sequencing, ['ordre','action','echeance']),
    fiscal_notes: auditFiscalNotes(row?.fiscal_notes),
    protection_notes: row?.protection_notes ?? '',
    controls: auditArray<AuditControlItem>(row?.controls, ['scenario','impact','reponse']),
    validated_at: row?.validated_at ?? null,
  };
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
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('synthese');
  const [selectedDocumentInvestorId, setSelectedDocumentInvestorId] = useState<string | null>(null);
  const [documentReviewOnly, setDocumentReviewOnly] = useState(false);
  const [auditRecommendation, setAuditRecommendation] = useState<AuditRecommendationRow | null>(null);
  const [auditDraft, setAuditDraft] = useState<AuditDraft>(() => auditDraftFromRow(null));
  const [auditMessage, setAuditMessage] = useState('');
  const [auditChatPrompt, setAuditChatPrompt] = useState('');
  const [generatingAuditPdf, setGeneratingAuditPdf] = useState(false);
  const [auditPdfUrl, setAuditPdfUrl] = useState<string | null>(null);
  const [auditPdfError, setAuditPdfError] = useState('');
  const [dossier, setDossier] = useState<DossierRow | null>(null); const [investors, setInvestors] = useState<InvestorRow[]>([]); const [sections, setSections] = useState<SectionRow[]>([]); const [contexts, setContexts] = useState<ContextRow[]>([]); const [provenance, setProvenance] = useState<ProvenanceRow[]>([]); const [checklist, setChecklist] = useState<ChecklistRow[]>([]); const [householdConfirmations, setHouseholdConfirmations] = useState<HouseholdConfirmationRow[]>([]); const [qpiSessions, setQpiSessions] = useState<QpiSessionRow[]>([]); const [qpiControls, setQpiControls] = useState<QpiControlRow[]>([]); const [qpiResults, setQpiResults] = useState<QpiResultSummaryRow[]>([]); const [sourceDocuments, setSourceDocuments] = useState<SourceDocumentRow[]>([]); const [recueilCompleteness, setRecueilCompleteness] = useState<RecueilCompletenessRow[]>([]); const [analyzingSourceIds, setAnalyzingSourceIds] = useState<Set<string>>(new Set()); const analysisAttemptedRef = useRef(new Set<string>()); const [sourceAnalysisMessage, setSourceAnalysisMessage] = useState(''); const [reviewingSourceDocumentId, setReviewingSourceDocumentId] = useState<string | null>(null); const [sourceReviewBusyId, setSourceReviewBusyId] = useState<string | null>(null); const [sourceReviewNotes, setSourceReviewNotes] = useState<Record<string,string>>({}); const [sourceReviewTargets, setSourceReviewTargets] = useState<Record<string,string>>({}); const [resolvingControlId, setResolvingControlId] = useState<string | null>(null); const [errorMessage, setErrorMessage] = useState(''); const [loading, setLoading] = useState(true); const [generatedDocuments, setGeneratedDocuments] = useState<GeneratedDocument[]>([]); const [generatingDocuments, setGeneratingDocuments] = useState(false); const [generatingRegulatoryType, setGeneratingRegulatoryType] = useState<'der' | 'mission' | null>(null); const [generationErrors, setGenerationErrors] = useState<Record<string,string>>({});

  useEffect(() => { let active = true; const load = async () => { if (!dossierId) throw new Error('Dossier manquant.'); const { data: auth } = await supabase.auth.getUser(); if (!auth.user) throw new Error('Session expirée.'); const { data: current, error: roleError } = await supabase.from('app_users').select('role,actif').eq('auth_user_id', auth.user.id).maybeSingle(); if (roleError) throw roleError; if (!current?.actif || !['cif', 'admin'].includes(current.role)) throw new Error('Accès réservé au cabinet.');
    const results = await Promise.all([
      supabase.from('dossiers').select('id,reference,libelle,recueil_status,statut').eq('id', dossierId).single(),
      supabase.from('dossier_investisseurs').select('investisseur_id,role_dossier,recueil_status,qpi_status,esg_opt_in,esg_status,documents_status,transmitted_at,investisseurs(prenom,nom,email)').eq('dossier_id', dossierId).order('role_dossier'),
      supabase.from('recueil_sections').select('investisseur_id,section_code,payload,completed_at').eq('dossier_id', dossierId),
      supabase.from('document_context_answers').select('*').eq('dossier_id', dossierId),
      supabase.from('data_provenance').select('investisseur_id,methode_collecte,statut_validation,valeur_source,valeur_retenue,source_document_id,date_validation,verified_at,retained_at,entity_table,field_name').eq('dossier_id', dossierId),
      supabase.from('document_checklist_items').select('document_code,libelle,statut,source_document_id').eq('dossier_id', dossierId),
      supabase.from('household_section_confirmations').select('section_code,status,note,source_updated_at,updated_at').eq('dossier_id', dossierId).order('section_code'),
      supabase.from('questionnaire_sessions').select('id,investisseur_id').eq('dossier_id', dossierId),
      supabase.from('documents_sources').select('id,investisseur_id,categorie,nom_fichier,storage_bucket,storage_path,statut_analyse,portee_document,concerne_investisseur_ids,metadata,created_at').eq('dossier_id', dossierId).order('created_at', { ascending: false }),
      supabase.rpc('get_all_recueil_completeness')
    ]); for (const result of results) if (result.error) throw result.error;
    const auditRes = await supabase
      .from('audit_recommendations')
      .select('id,dossier_id,statut,diagnostic,projet_a_preserver,reserve_securite,epargne_a_arbitrer,allocation,supports,sequencing,fiscal_notes,protection_notes,controls,validated_at,created_at,updated_at')
      .eq('dossier_id', dossierId)
      .maybeSingle();
    if (auditRes.error) throw auditRes.error;

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
    if (!active) return; setDossier(results[0].data as DossierRow); setInvestors((results[1].data ?? []) as unknown as InvestorRow[]); setSections((results[2].data ?? []) as unknown as SectionRow[]); setContexts((results[3].data ?? []) as unknown as ContextRow[]); setProvenance((results[4].data ?? []) as unknown as ProvenanceRow[]); setChecklist((results[5].data ?? []) as unknown as ChecklistRow[]); setHouseholdConfirmations((results[6].data ?? []) as unknown as HouseholdConfirmationRow[]); setQpiSessions(qSessions); setQpiControls(controls); setQpiResults(resultRows); setSourceDocuments((results[8].data ?? []) as unknown as SourceDocumentRow[]); setRecueilCompleteness(((results[9].data ?? []) as unknown as RecueilCompletenessRow[]).filter((row) => row.dossier_id === dossierId)); const loadedAudit = (auditRes.data ?? null) as AuditRecommendationRow | null; setAuditRecommendation(loadedAudit); setAuditDraft(auditDraftFromRow(loadedAudit)); };
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

  const refreshSourceDocumentData = async () => {
    if (!dossierId) return;
    const [docsRes, sectionsRes, provenanceRes, completenessRes] = await Promise.all([
      supabase.from('documents_sources').select('id,investisseur_id,categorie,nom_fichier,storage_bucket,storage_path,statut_analyse,portee_document,concerne_investisseur_ids,metadata,created_at').eq('dossier_id', dossierId).order('created_at', { ascending: false }),
      supabase.from('recueil_sections').select('investisseur_id,section_code,payload,completed_at').eq('dossier_id', dossierId),
      supabase.from('data_provenance').select('investisseur_id,methode_collecte,statut_validation,valeur_source,valeur_retenue,source_document_id,date_validation,verified_at,retained_at,entity_table,field_name').eq('dossier_id', dossierId),
      supabase.rpc('get_all_recueil_completeness'),
    ]);
    if (docsRes.error) throw docsRes.error; if (sectionsRes.error) throw sectionsRes.error; if (provenanceRes.error) throw provenanceRes.error; if (completenessRes.error) throw completenessRes.error;
    setSourceDocuments((docsRes.data ?? []) as unknown as SourceDocumentRow[]);
    setSections((sectionsRes.data ?? []) as unknown as SectionRow[]);
    setProvenance((provenanceRes.data ?? []) as unknown as ProvenanceRow[]);
    setRecueilCompleteness(((completenessRes.data ?? []) as unknown as RecueilCompletenessRow[]).filter((row) => row.dossier_id === dossierId));
  };

  const analyzeSourceDocument = async (doc: SourceDocumentRow) => {
    setAnalyzingSourceIds((current) => new Set([...current, doc.id]));
    setSourceAnalysisMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('extract-source-document', { body: { document_id: doc.id } });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Analyse documentaire impossible.');
      await refreshSourceDocumentData();
    } catch (error) {
      setSourceAnalysisMessage(messageFromError(error));
      await refreshSourceDocumentData().catch(() => undefined);
    } finally {
      setAnalyzingSourceIds((current) => { const next = new Set(current); next.delete(doc.id); return next; });
    }
  };

  const openSourceDocument = async (doc: SourceDocumentRow) => {
    if (!doc.storage_bucket || !doc.storage_path) return;
    const { data, error } = await supabase.storage.from(doc.storage_bucket).createSignedUrl(doc.storage_path, 90);
    if (error) { setSourceAnalysisMessage(messageFromError(error)); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const finalizeSourceDocumentReview = async (doc: SourceDocumentRow, decision: 'validated' | 'rejected', target?: { kind:string; key:string; label:string } | null) => {
    setSourceReviewBusyId(doc.id);
    setSourceAnalysisMessage('');
    try {
      const fieldsApplied = Number(doc.metadata?.fields_applied ?? 0);
      const { data, error } = await supabase.rpc('review_source_document', {
        p_document_id: doc.id,
        p_decision: decision,
        p_note: (sourceReviewNotes[doc.id] ?? '').trim() || null,
        p_target_kind: target?.kind ?? null,
        p_target_key: target?.key ?? null,
        p_target_label: target?.label ?? null,
      });
      if (error) throw error;
      if (!data || (typeof data === 'object' && 'ok' in data && data.ok !== true)) {
        throw new Error('La validation du document n’a pas été enregistrée.');
      }
      setReviewingSourceDocumentId(null);
      setSourceReviewTargets((current) => {
        const next = { ...current };
        delete next[doc.id];
        return next;
      });
      setSourceReviewNotes((current) => {
        const next = { ...current };
        delete next[doc.id];
        return next;
      });
      setSourceAnalysisMessage(decision === 'validated'
        ? target
          ? 'Pièce validée et rattachée à « ' + target.label + ' ».'
          : fieldsApplied > 0
            ? 'Pièce contrôlée et validée. Les données déjà intégrées sont conservées.'
            : 'Pièce contrôlée et validée sans intégration de donnée.'
        : 'Pièce rejetée : elle ne sera pas utilisée comme justificatif exploitable.');
      await refreshSourceDocumentData();
    } catch (error) {
      setSourceAnalysisMessage(messageFromError(error));
    } finally {
      setSourceReviewBusyId(null);
    }
  };

  useEffect(() => {
    const pending = sourceDocuments.filter((doc) => doc.statut_analyse === 'uploaded' && !analysisAttemptedRef.current.has(doc.id));
    if (!pending.length) return;
    pending.forEach((doc) => analysisAttemptedRef.current.add(doc.id));
    let cancelled = false;
    const run = async () => {
      for (const doc of pending) {
        if (cancelled) return;
        setAnalyzingSourceIds((current) => new Set([...current, doc.id]));
        const { error } = await supabase.functions.invoke('extract-source-document', { body: { document_id: doc.id } });
        if (error && !cancelled) setSourceAnalysisMessage(`Analyse différée pour ${doc.nom_fichier} : ${messageFromError(error)}`);
        setAnalyzingSourceIds((current) => { const next = new Set(current); next.delete(doc.id); return next; });
      }
      if (!cancelled) await refreshSourceDocumentData().catch((error) => setSourceAnalysisMessage(messageFromError(error)));
    };
    void run();
    return () => { cancelled = true; };
  }, [dossierId, sourceDocuments]);

  const household = useMemo(() => consolidateHousehold(sections.map((row) => ({ investisseur_id: row.investisseur_id, role_dossier: investors.find((i) => i.investisseur_id === row.investisseur_id)?.role_dossier ?? '', section_code: row.section_code, payload: row.payload }))), [sections, investors]);
  const clientDisplayName = useMemo(() => {
    const names = investors
      .map((investor) => investor.investisseurs ? [investor.investisseurs.prenom, investor.investisseurs.nom].filter(Boolean).join(' ').trim() : '')
      .filter(Boolean);
    return names.length ? names.join(' & ') : (dossier?.libelle || 'Dossier client');
  }, [investors, dossier?.libelle]);
  const snapshot = useMemo(() => financialSnapshot(sections, household.realEstate.totalValue), [sections, household.realEstate.totalValue]);

  const professionalPatrimony = useMemo(() => {
    const investorNameById = new Map(investors.map((investor) => [
      investor.investisseur_id,
      [investor.investisseurs?.prenom, investor.investisseurs?.nom].filter(Boolean).join(' ').trim() || 'Client',
    ]));
    const sourceNameById = new Map(sourceDocuments.map((document) => [document.id, document.nom_fichier]));
    const ownerLabel = (value: unknown, investorId: string) => {
      const raw = professionalText(value, investorNameById.get(investorId) || 'À préciser');
      const normalized = normalizedSearch(raw);
      if (normalized.includes('identifiant 1 et 2') || normalized.includes('foyer') || normalized.includes('commun')) return 'Couple';
      if (normalized.includes('identifiant 1')) {
        const holder = investors.find((item) => item.role_dossier === 'investisseur_1');
        return holder ? investorNameById.get(holder.investisseur_id) || 'Identifiant 1' : 'Identifiant 1';
      }
      if (normalized.includes('identifiant 2')) {
        const holder = investors.find((item) => item.role_dossier === 'investisseur_2');
        return holder ? investorNameById.get(holder.investisseur_id) || 'Identifiant 2' : 'Identifiant 2';
      }
      return raw;
    };

    const credits: ProfessionalCredit[] = [];
    const creditSeen = new Set<string>();
    for (const section of sections.filter((row) => row.section_code === 'credits')) {
      const items = Array.isArray(section.payload?.items) ? section.payload?.items as Record<string,unknown>[] : [];
      items.forEach((item, index) => {
        const key = professionalText(item.reference_pret, '') || [
          professionalText(item.credit_rattache_a,''),
          professionalText(item.banque ?? item.organisme,''),
          professionalText(item.montant_initial,''),
          professionalText(item.capital_restant_du,''),
        ].join('|');
        if (creditSeen.has(key)) return;
        creditSeen.add(key);
        const sourceId = professionalText(item.source_document_id,'');
        credits.push({
          id:key || `${section.investisseur_id}-credit-${index}`,
          attachedTo:professionalText(item.credit_rattache_a,'À rattacher'),
          bank:professionalText(item.banque ?? item.organisme,'À préciser'),
          borrower:ownerLabel(item.emprunteur, section.investisseur_id),
          type:professionalText(item.type_credit,'Crédit'),
          initialAmount:professionalNumber(item.montant_initial),
          outstanding:professionalNumber(item.capital_restant_du ?? item.crd),
          rate:professionalNumber(item.taux_credit ?? item.taux),
          rateType:professionalText(item.taux_type,'—'),
          currentPayment:professionalNumber(item.mensualite_actuelle ?? item.mensualite),
          futurePayment:professionalNumber(item.mensualite_future),
          futurePaymentDate:professionalText(item.mensualite_future_date,''),
          openingDate:professionalText(item.date_ouverture ?? item.date_pret,''),
          endDate:professionalText(item.date_fin,''),
          remainingMonths:professionalNumber(item.duree_actualisee_restante_mois ?? item.duree_mois),
          insurance:professionalText(item.assurance_mode ?? item.assurance_cout,'Non documentée'),
          phase:professionalText(item.phase_credit,''),
          sourceFile:sourceNameById.get(sourceId) || '',
        });
      });
    }

    const properties: ProfessionalProperty[] = [];
    const propertySeen = new Set<string>();
    for (const section of sections.filter((row) => row.section_code === 'patrimony')) {
      const items = Array.isArray(section.payload?.immobilier) ? section.payload?.immobilier as Record<string,unknown>[] : [];
      items.forEach((item, index) => {
        const title = professionalText(item.intitule, [professionalText(item.type_bien,''), professionalText(item.ville,'')].filter(Boolean).join(' — ') || 'Bien immobilier');
        const city = professionalText(item.ville,'');
        const value = professionalNumber(item.valeur_actuelle);
        const key = [normalizedSearch(title), normalizedSearch(city), value ?? ''].join('|');
        if (propertySeen.has(key)) return;
        propertySeen.add(key);
        const matcher = normalizedSearch(`${title} ${city} ${item.usage ?? ''}`);
        const linkedCredit = credits.find((credit) => {
          const creditText = normalizedSearch(credit.attachedTo);
          const cityMatch = city && creditText.includes(normalizedSearch(city));
          const titleParts = normalizedSearch(title).split(/\s+/).filter((part) => part.length > 3);
          const titleMatch = titleParts.some((part) => creditText.includes(part));
          return Boolean(cityMatch || titleMatch || (matcher && creditText.includes(matcher)));
        }) ?? null;
        const outstanding = linkedCredit?.outstanding ?? null;
        properties.push({
          id:key || `${section.investisseur_id}-property-${index}`,
          title,
          city:city || '—',
          type:professionalText(item.type_bien,'—'),
          usage:professionalText(item.usage,'—'),
          owner:ownerLabel(item.proprietaire, section.investisseur_id),
          ownershipShare:professionalText(item.quote_part,''),
          holding:professionalText(item.mode_detention,'—'),
          value,
          annualRent:professionalNumber(item.loyer_annuel),
          monthlyRent:professionalNumber(item.loyer_mensuel),
          project:professionalText(item.projet_bien,'—'),
          acquisitionDate:professionalText(item.date_acquisition,''),
          acquisitionPrice:professionalNumber(item.prix_acquisition),
          comment:professionalText(item.commentaire,''),
          linkedCreditId:linkedCredit?.id ?? null,
          outstanding,
          netEquity:value !== null && outstanding !== null ? value - outstanding : null,
        });
      });
    }

    const financialAssets: ProfessionalFinancialAsset[] = [];
    const financialSeen = new Set<string>();
    for (const section of sections.filter((row) => row.section_code === 'financial')) {
      const items = Array.isArray(section.payload?.items) ? section.payload?.items as Record<string,unknown>[] : [];
      items.forEach((item,index) => {
        const type = professionalText(item.type_placement ?? item.type ?? item.categorie,'Placement');
        const amount = professionalNumber(item.montant ?? item.valorisation ?? item.encours);
        const owner = ownerLabel(item.proprietaire, section.investisseur_id);
        const institution = professionalText(item.organisme ?? item.etablissement,'À préciser');
        const sourceId = professionalText(item.source_document_id,'');
        const key = [normalizedSearch(type),normalizedSearch(owner),normalizedSearch(institution),amount ?? '',sourceId].join('|');
        if (financialSeen.has(key)) return;
        financialSeen.add(key);
        const treatment = financialTreatment(type);
        financialAssets.push({
          id:key || `${section.investisseur_id}-financial-${index}`,
          owner,
          type,
          institution,
          amount,
          taxTreatment:treatment.taxTreatment,
          liquidity:treatment.liquidity,
          sourceFile:professionalText(item.source_file,'') || sourceNameById.get(sourceId) || '',
        });
      });
    }

    const realEstateGross = properties.reduce((sum,item) => sum + (item.value ?? 0),0);
    const documentedDebt = credits.reduce((sum,item) => sum + (item.outstanding ?? 0),0);
    const documentedFinancial = financialAssets.reduce((sum,item) => sum + (item.amount ?? 0),0);
    const documentedLiquidity = financialAssets
      .filter((item) => /immediate/i.test(normalizedSearch(item.liquidity)))
      .reduce((sum,item) => sum + (item.amount ?? 0),0);
    const grossDocumented = realEstateGross + documentedFinancial;
    const netDocumented = grossDocumented - documentedDebt;
    const annualRent = properties.reduce((sum,item) => sum + (item.annualRent ?? 0),0);
    const currentMonthlyDebt = credits.reduce((sum,item) => sum + (item.currentPayment ?? 0),0);
    const futureMonthlyDebt = credits.reduce((sum,item) => sum + (item.futurePayment ?? item.currentPayment ?? 0),0);

    return {
      properties,
      financialAssets,
      credits,
      totals:{
        realEstateGross,
        documentedDebt,
        documentedFinancial,
        documentedLiquidity,
        grossDocumented,
        netDocumented,
        annualRent,
        currentMonthlyDebt,
        futureMonthlyDebt,
      },
    };
  }, [sections, investors, sourceDocuments]);
  const investorSummaries = useMemo(() => investors.map((investor) => { const investorSections = sections.filter((r) => r.investisseur_id === investor.investisseur_id); const payloadByCode = Object.fromEntries(investorSections.map((r) => [r.section_code, r.payload ?? {}])); const spouse = investors.find((r) => r.investisseur_id !== investor.investisseur_id)?.investisseurs ?? null; const context = contexts.find((r) => r.investisseur_id === investor.investisseur_id) ?? {}; const consistencySnapshot: ConsistencySnapshot = { identity: payloadByCode.identity ?? {}, family: payloadByCode.family ?? {}, professional: payloadByCode.professional ?? {}, capacity: payloadByCode.capacity ?? {}, patrimony: payloadByCode.patrimony ?? {}, financial: payloadByCode.financial ?? {}, credits: payloadByCode.credits ?? {}, regulatory: payloadByCode.regulatory ?? {}, documents: context, spouse }; const issues = evaluateConsistency(consistencySnapshot); const investorProvenance = provenance.filter((r) => !r.investisseur_id || r.investisseur_id === investor.investisseur_id); const summary = summarizeAdvisorDossier({ sections: investorSections, provenance: investorProvenance, checklist, issues, roleDossier: investor.role_dossier }); const sessionIds = qpiSessions.filter((row) => row.investisseur_id === investor.investisseur_id).map((row) => row.id); const unresolvedQpiControls = qpiControls.filter((control) => sessionIds.includes(control.session_id) && control.alerte && !control.traite); const completeness = recueilCompleteness.find((row) => row.investisseur_id === investor.investisseur_id); const needsRecueilReview = completeness ? !completeness.complete : true; const effectiveReadiness = (unresolvedQpiControls.length > 0 || needsRecueilReview) && summary.readiness === 'ready' ? 'review' as const : summary.readiness; return { investor, investorSections, issues, summary, unresolvedQpiControls, effectiveReadiness, completeness }; }), [investors, sections, contexts, provenance, checklist, qpiSessions, qpiControls, recueilCompleteness]);
  const investorDocumentStates = useMemo(() => investors.map((investor) => {
    const completeness = recueilCompleteness.find((row) => row.investisseur_id === investor.investisseur_id);
    const recueil = ['completed', 'validated'].includes(investor.recueil_status) && completeness?.complete === true;
    const recueilHasData = sections.some((section) => section.investisseur_id === investor.investisseur_id);
    const recueilPdfAvailable = recueilHasData || ['completed', 'validated'].includes(investor.recueil_status);
    const qpi = ['completed', 'validated'].includes(investor.qpi_status);
    const esgNotApplicable = investor.esg_opt_in === false;
    const esg = ['completed', 'validated'].includes(investor.esg_status);
    const readyTypes: GeneratedDocument['type'][] = [
      ...(recueilPdfAvailable ? ['recueil' as const] : []),
      ...(qpi ? ['qpi' as const] : []),
      ...(esg ? ['esg' as const] : []),
    ];
    return { investor, recueil, recueilPdfAvailable, recueilPercentage: completeness?.percentage ?? 0, qpi, esg, esgNotApplicable, readyTypes };
  }), [investors, recueilCompleteness, sections]);
  const orderedInvestorDocumentStates = useMemo(() => [...investorDocumentStates].sort((a, b) => (a.investor.role_dossier === 'investisseur_1' ? 0 : 1) - (b.investor.role_dossier === 'investisseur_1' ? 0 : 1)), [investorDocumentStates]);
  const selectedDocumentState = useMemo(() => orderedInvestorDocumentStates.find((state) => state.investor.investisseur_id === selectedDocumentInvestorId) ?? orderedInvestorDocumentStates[0] ?? null, [orderedInvestorDocumentStates, selectedDocumentInvestorId]);
  const selectedSourceDocuments = useMemo(() => {
    if (!selectedDocumentState) return [];
    const investorId = selectedDocumentState.investor.investisseur_id;
    return sourceDocuments.filter((doc) => doc.investisseur_id === investorId || doc.concerne_investisseur_ids?.includes(investorId));
  }, [sourceDocuments, selectedDocumentState]);
  const displayedSourceDocuments = useMemo(() => documentReviewOnly ? selectedSourceDocuments.filter((doc) => doc.statut_analyse === 'to_review') : selectedSourceDocuments, [documentReviewOnly, selectedSourceDocuments]);

  const auditChatContext = useMemo(() => {
    const controls = investorSummaries.flatMap((item) => item.unresolvedQpiControls).map((control) => control.commentaire || humanize(control.control_code));
    const currentAllocation = auditDraft.allocation.map((item) => ({
      poche: item.poche,
      montant: item.montant,
      decision: item.decision,
    }));
    const currentSupports = auditDraft.supports.map((item) => ({
      support: item.support,
      analyse: item.analyse,
      decision: item.decision,
    }));
    return [
      'AUDIT PATRIMONIAL — CONTEXTE DOSSIER CRM',
      `Clients : ${clientDisplayName}`,
      dossier?.reference ? `Dossier : ${dossier.reference}` : '',
      '',
      'DONNÉES CLÉS',
      `Revenus annuels : ${snapshot.annualIncome.found ? euro(snapshot.annualIncome.value) : 'à compléter'}`,
      `Capacité d’épargne : ${snapshot.savingsCapacityMonthly.found ? euro(snapshot.savingsCapacityMonthly.value) + ' / mois' : 'à compléter'}`,
      `Liquidités : ${snapshot.liquidAssets.found ? euro(snapshot.liquidAssets.value) : 'à compléter'}`,
      `Actifs financiers : ${snapshot.financialAssets.found ? euro(snapshot.financialAssets.value) : 'à compléter'}`,
      `Immobilier brut : ${household.realEstate.totalValue > 0 ? euro(household.realEstate.totalValue) : 'à compléter'}`,
      `Capital restant dû : ${snapshot.debtOutstanding.found ? euro(snapshot.debtOutstanding.value) : 'à compléter'}`,
      `TMI : ${snapshot.tmi.found ? percent(snapshot.tmi.value) : 'à compléter'}`,
      '',
      `Objectifs : ${snapshot.goals.length ? snapshot.goals.join(' | ') : 'à compléter'}`,
      `Contrôles QPI ouverts : ${controls.length ? controls.join(' | ') : 'aucun'}`,
      '',
      'AUDIT DE TRAVAIL ACTUEL',
      `Statut : ${auditDraft.statut}`,
      `Diagnostic : ${auditDraft.diagnostic || 'à rédiger'}`,
      `Projet / objectif prioritaire : ${auditDraft.projet_a_preserver || 'à rédiger'}`,
      `Réserve de sécurité : ${auditDraft.reserve_securite || 'à valider'}`,
      `Épargne à arbitrer : ${auditDraft.epargne_a_arbitrer || 'à valider'}`,
      `Allocation : ${JSON.stringify(currentAllocation)}`,
      `Recommandations par sujet : ${JSON.stringify(currentSupports)}`,
      `Fiscalité : ${JSON.stringify(auditDraft.fiscal_notes)}`,
      `Crash tests / contrôles : ${JSON.stringify(auditDraft.controls)}`,
      `Plan d’action : ${JSON.stringify(auditDraft.sequencing)}`,
      '',
      'TRAME À CONSERVER',
      '1. Recommandation en une page',
      '2. Diagnostic patrimonial',
      '3. Allocation cible et séquencement',
      '4. Recommandations par sujet',
      '5. Fiscalité et choix des enveloppes',
      '6. Adéquation, risques et justification',
      '7. Crash test et plan d’action',
      '8. Conclusion, contrôles et documentation',
      '',
      'Immobilier à passer au filtre du dossier : résidence principale, location nue, LMNP, LMP, location meublée / courte durée, Denormandie, Malraux, Monuments historiques, Relance logement (Jeanbrun), déficit foncier, nue-propriété / démembrement, SCI IR, SCI IS, résidences gérées, murs commerciaux / professionnels, SCPI / immobilier collectif.',
    ].filter(Boolean).join('\n');
  }, [auditDraft, clientDisplayName, dossier?.reference, household.realEstate.totalValue, investorSummaries, snapshot]);

  const openAuditInChatGPT = async () => {
    const fullPrompt = [
      auditChatContext,
      '',
      auditChatPrompt.trim() || 'Étudie le dossier comme dans nos audits patrimoniaux habituels. Challenge les données, propose une recommandation complète et conserve strictement la trame cabinet.',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(fullPrompt);
      setAuditMessage('Contexte copié. ChatGPT est ouvert dans un nouvel onglet : colle le texte pour poursuivre l’audit.');
    } catch {
      setAuditMessage('ChatGPT est ouvert. Copie le contexte affiché dans le presse-papiers si nécessaire.');
    }
    window.open('https://chatgpt.com', '_blank', 'noopener,noreferrer');
  };

  const generateAuditInChatGPT = async () => {
    if (!dossierId) return;
    const generationPrompt = [
      auditChatContext,
      '',
      'GÉNÉRER L’AUDIT — ACTION CRM',
      'Produis maintenant l’audit patrimonial complet comme si je te l’avais demandé directement dans ChatGPT, en conservant la structure de nos deux audits PDF de référence.',
      'Étudie le dossier, challenge les incohérences, formule des recommandations concrètes, chiffre l’allocation quand les données le permettent, distingue les données certaines des éléments à confirmer, et construis un crash test adapté à ce foyer.',
      'Ne transforme jamais les données manquantes en 0 €. Utilise "À confirmer" ou une fourchette justifiée quand nécessaire.',
      'Pour les recommandations par sujet, traite uniquement les sujets pertinents mais passe notamment l’immobilier au filtre suivant : résidence principale, location nue, LMNP, LMP, location meublée / courte durée, Denormandie, Malraux, Monuments historiques, Relance logement (Jeanbrun), déficit foncier, nue-propriété / démembrement, SCI IR, SCI IS, résidences gérées, murs commerciaux / professionnels, SCPI / immobilier collectif.',
      '',
      'À la fin, enregistre le résultat structuré dans Supabase, table public.audit_recommendations, pour le dossier ' + dossierId + '.',
      'Mets statut = "generated".',
      'Renseigne : diagnostic, projet_a_preserver, reserve_securite, epargne_a_arbitrer, allocation, supports, sequencing, fiscal_notes, protection_notes, controls.',
      'allocation = tableau d’objets {poche,montant,decision}.',
      'supports = objet {"items":[{support,analyse,decision,is_investment?,isin?,montant?,poids?}]}.',
      'sequencing = tableau {ordre,action,echeance}.',
      'fiscal_notes = tableau {sujet,analyse}.',
      'controls = tableau {scenario,impact,reponse}.',
      'Ne passe pas le statut à validated : generated signifie audit ChatGPT produit, validated reste réservé à Eric Bellaiche.',
      '',
      'Quand l’enregistrement Supabase est terminé, réponds simplement : "Audit généré et enregistré dans le CRM."',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(generationPrompt);
      setAuditMessage('Commande « Générer l’audit » copiée. ChatGPT va produire l’audit puis l’enregistrer dans le CRM.');
    } catch {
      setAuditMessage('ChatGPT va être ouvert avec la commande de génération. Si nécessaire, copie manuellement le contexte.');
    }
    window.open('https://chatgpt.com', '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    if (!dossierId || activeTab !== 'audit') return;
    let active = true;
    const refreshAudit = async () => {
      const { data, error } = await supabase
        .from('audit_recommendations')
        .select('id,dossier_id,statut,diagnostic,projet_a_preserver,reserve_securite,epargne_a_arbitrer,allocation,supports,sequencing,fiscal_notes,protection_notes,controls,validated_at,created_at,updated_at')
        .eq('dossier_id', dossierId)
        .maybeSingle();
      if (error || !active || !data) return;
      const row = data as AuditRecommendationRow;
      setAuditRecommendation(row);
      setAuditDraft(auditDraftFromRow(row));
    };
    void refreshAudit();
    const timer = window.setInterval(() => { void refreshAudit(); }, 4000);
    return () => { active = false; window.clearInterval(timer); };
  }, [activeTab, dossierId]);

  const auditReadyForPdf = auditDraft.statut === 'generated' || auditDraft.statut === 'validated';

  const generateAuditPdf = async () => {
    if (!dossierId) return;
    if (!auditReadyForPdf) {
      setAuditPdfError('Génère d’abord l’audit avec ChatGPT. Le PDF ne doit pas être construit à partir d’un brouillon.');
      return;
    }
    setGeneratingAuditPdf(true);
    setAuditPdfError('');
    try {
      const { data, error } = await supabase.functions.invoke('generate-cif-audit', { body: { dossier_id: dossierId } });
      if (error) throw error;
      if (!data?.signed_url) throw new Error(data?.error || 'Génération de l’audit impossible.');
      setAuditPdfUrl(String(data.signed_url));
    } catch (error) {
      let detail = messageFromError(error);
      const functionError = error as { context?: Response };
      if (functionError.context) {
        try {
          const payload = await functionError.context.clone().json() as { error?: string };
          if (payload?.error) detail = payload.error;
        } catch {
          try {
            const text = await functionError.context.clone().text();
            if (text.trim()) detail = text.trim();
          } catch {
            // Keep the normalized client-side error when the function response cannot be decoded.
          }
        }
      }
      setAuditPdfError(detail);
    } finally {
      setGeneratingAuditPdf(false);
    }
  };

  useEffect(() => {
    if (!dossierId) return;
    let active = true;
    const loadAuditPdf = async () => {
      const { data, error } = await supabase
        .from('documents_reglementaires')
        .select('storage_bucket,storage_path_pdf,date_generation,metadata')
        .eq('dossier_id', dossierId)
        .eq('type_document', 'audit')
        .eq('statut', 'generated')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error || !active) return;
      const usable = (data ?? []).find((row) => {
        const status = String((row.metadata as Record<string,unknown> | null)?.recommendation_status ?? '');
        return status === 'generated' || status === 'validated';
      });
      if (!usable?.storage_path_pdf) {
        setAuditPdfUrl(null);
        return;
      }
      const { data: signed } = await supabase.storage.from(usable.storage_bucket || 'regulatory-docs').createSignedUrl(usable.storage_path_pdf, 3600);
      if (active && signed?.signedUrl) setAuditPdfUrl(signed.signedUrl);
    };
    void loadAuditPdf();
    return () => { active = false; };
  }, [dossierId]);

  const documentGenerationKey = useMemo(() => {
    const readiness = investorDocumentStates.map((state) => `${state.investor.investisseur_id}:${state.readyTypes.join(',')}`).join('|');
    const recueilData = sections.map((section) => `${section.investisseur_id}:${section.section_code}:${JSON.stringify(section.payload ?? {})}`).sort().join('|');
    return `${readiness}::${recueilData}`;
  }, [investorDocumentStates, sections]);
  useEffect(() => {
    if (!dossierId || !dossier || !investorDocumentStates.some((state) => state.readyTypes.length)) return;
    let active = true;
    const generate = async () => {
      setGeneratingDocuments(true);
      const nextErrors: Record<string,string> = {};
      const produced: GeneratedDocument[] = [];

      await Promise.all(investorDocumentStates.flatMap((state) =>
        state.readyTypes.map(async (type) => {
          const key = `${state.investor.investisseur_id}:${type}`;
          try {
            const { data, error } = await supabase.functions.invoke('generate-cif-pdfs', {
              body: { dossier_id: dossierId, investisseur_id: state.investor.investisseur_id, document_types: [type] },
            });
            if (error) {
              nextErrors[key] = 'PDF temporairement indisponible';
              return;
            }
            if (Array.isArray(data?.documents)) {
              produced.push(...(data.documents as GeneratedDocument[]));
            }
            const remoteError = Array.isArray(data?.errors)
              ? data.errors.find((item: { type?: string; error?: string }) => item?.type === type)?.error
              : null;
            if (remoteError) nextErrors[key] = remoteError;
            else if (!Array.isArray(data?.documents) || !data.documents.some((item: GeneratedDocument) => item.type === type)) {
              nextErrors[key] = data?.error || 'PDF temporairement indisponible';
            }
          } catch (error) {
            nextErrors[key] = messageFromError(error);
          }
        })
      ));

      if (!active) return;
      setGeneratedDocuments((current) => {
        const merged = [...current];
        for (const doc of produced) {
          const index = merged.findIndex((item) => item.investisseur_id === doc.investisseur_id && item.type === doc.type);
          if (index >= 0) merged[index] = doc;
          else merged.push(doc);
        }
        return merged;
      });
      setGenerationErrors(nextErrors);
    };
    void generate().finally(() => { if (active) setGeneratingDocuments(false); });
    return () => { active = false; };
  }, [dossierId, dossier?.id, documentGenerationKey]);

  const generateRegulatoryPdf = async (type: 'der' | 'mission') => {
    if (!dossierId) return;
    const key = `household:${type}`;
    setGeneratingRegulatoryType(type);
    setGenerationErrors((current) => { const next = { ...current }; delete next[key]; return next; });
    try {
      const { data, error } = await supabase.functions.invoke('generate-cif-pdfs', {
        body: { dossier_id: dossierId, document_types: [type] },
      });
      if (error) throw error;
      const remoteError = Array.isArray(data?.errors)
        ? data.errors.find((item: { type?: string; error?: string }) => item?.type === type)?.error
        : null;
      if (remoteError) throw new Error(remoteError);
      const document = Array.isArray(data?.documents)
        ? (data.documents as GeneratedDocument[]).find((item) => item.type === type)
        : null;
      if (!document?.signed_url) throw new Error(data?.error || 'PDF temporairement indisponible');
      setGeneratedDocuments((current) => {
        const filtered = current.filter((item) => !(item.type === type && !item.investisseur_id));
        return [...filtered, document];
      });
    } catch (error) {
      setGenerationErrors((current) => ({ ...current, [key]: messageFromError(error) }));
    } finally {
      setGeneratingRegulatoryType(null);
    }
  };

  if (loading) return <div className="min-h-screen bg-blue-50/30 p-10 text-sm text-slate-500">Chargement de la synthèse conseiller…</div>;
  if (errorMessage) return <div className="min-h-screen bg-blue-50/30 p-10"><Link to="/cabinet" className="text-sm font-semibold text-slate-600">← Retour cabinet</Link><p className="mt-6 rounded-2xl bg-red-50 p-5 text-sm text-red-700">{errorMessage}</p></div>;
  if (!dossier) return null;

  return <div className="min-h-screen bg-blue-50/30 px-4 py-8 sm:px-6"><div className="mx-auto max-w-7xl space-y-6">
    <header className="rounded-3xl bg-slate-950 p-7 text-white shadow-sm sm:p-9"><Link to="/cabinet" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-200"><ArrowLeft className="h-4 w-4" /> Retour aux dossiers</Link><p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Synthèse patrimoniale conseiller</p><h1 className="mt-2 text-3xl font-semibold">{clientDisplayName}</h1>{dossier.reference ? <p className="mt-1 text-xs font-medium text-slate-500">Dossier {dossier.reference}</p> : null}<p className="mt-2 text-sm text-slate-300">Vue de travail complète : situation, patrimoine, objectifs, profil réglementaire, pièces et contrôles CIF.</p></header>

    <nav className="sticky top-0 z-30 -mx-1 overflow-x-auto rounded-2xl border border-blue-100 bg-white/95 p-1.5 shadow-sm backdrop-blur" aria-label="Espaces de travail du dossier">
      <div className="flex min-w-max gap-1">
        {workspaceTabs.map((tab) => <button key={tab.id} type="button" onClick={() => { setActiveTab(tab.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${activeTab === tab.id ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}>{tab.label}</button>)}
      </div>
    </nav>

    {activeTab === 'conformite' && householdConfirmations.length > 0 && <section className="rounded-3xl border border-amber-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-3"><div className="rounded-2xl bg-amber-50 p-3"><AlertTriangle className="h-5 w-5 text-amber-700" /></div><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">Validation du foyer</p><h2 className="mt-1 text-xl font-semibold text-slate-950">Confirmation du second membre</h2><p className="mt-1 text-sm text-slate-500">Les remarques du second membre n’écrasent jamais la déclaration initiale. Une correction signalée doit être arbitrée puis reconfirmée.</p></div></div>
      <div className="mt-5 grid gap-3 lg:grid-cols-3">{householdConfirmations.map((item) => <div key={item.section_code} className={`rounded-2xl border p-4 ${item.status==='change_requested'?'border-amber-300 bg-amber-50':'border-emerald-200 bg-emerald-50'}`}><div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-950">{sectionLabel[item.section_code] ?? item.section_code}</p><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${item.status==='change_requested'?'bg-amber-200 text-amber-900':'bg-emerald-200 text-emerald-900'}`}>{item.status==='change_requested'?'À arbitrer':'Confirmé'}</span></div>{item.note&&<p className="mt-3 text-sm leading-5 text-slate-700">{item.note}</p>}<p className="mt-3 text-[11px] text-slate-400">Mis à jour le {new Date(item.updated_at).toLocaleString('fr-FR')}</p></div>)}</div>
    </section>}

    {activeTab === 'audit' && <section className="rounded-3xl border border-[#25405F] bg-[#08182B] p-6 shadow-[0_18px_45px_rgba(2,10,25,0.24)] sm:p-8">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-cyan-500/15 p-3"><ShieldCheck className="h-5 w-5 text-cyan-200" /></div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-300">Audit patrimonial</p>
          <h2 className="mt-1 text-xl font-semibold text-white">ChatGPT → Générer l’audit → PDF</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">Trois étapes seulement : discussion avec ChatGPT, génération de l’audit structuré, puis création du PDF.</p>
        </div>
      </div>

      {auditMessage && <div className="mt-5 rounded-xl border border-cyan-500/25 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-100">{auditMessage}</div>}

      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        <div className="rounded-2xl border border-[#25405F] bg-[#0B1A2F] p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-300">1 · Discussion</p>
          <h3 className="mt-1 text-lg font-semibold text-white">Travailler le dossier avec ChatGPT</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">Questions, arbitrages, simulations et modifications de stratégie, comme dans une conversation normale avec ChatGPT.</p>
          <textarea
            value={auditChatPrompt}
            onChange={(event) => setAuditChatPrompt(event.target.value)}
            rows={7}
            placeholder="Ex. Reprends tout le dossier, challenge la réserve de sécurité, compare LMNP / Denormandie / Jeanbrun et refais l’allocation cible."
            className="mt-4 w-full rounded-xl border border-[#315173] bg-[#071425] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void openAuditInChatGPT()} className="rounded-xl bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400">Ouvrir dans ChatGPT</button>
            <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(auditChatContext); setAuditMessage('Contexte du dossier copié.'); } catch { setAuditMessage('Impossible de copier automatiquement le contexte.'); } }} className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">Copier le contexte</button>
          </div>
        </div>

        <div className={'rounded-2xl border p-5 ' + (auditReadyForPdf ? 'border-blue-400/35 bg-blue-950/25' : 'border-amber-400/30 bg-amber-950/20')}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={'text-[10px] font-bold uppercase tracking-[0.12em] ' + (auditReadyForPdf ? 'text-blue-300' : 'text-amber-300')}>2 · Audit</p>
              <h3 className="mt-1 text-lg font-semibold text-white">Générer l’audit</h3>
            </div>
            <span className={'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ' + (auditDraft.statut === 'validated' ? 'bg-emerald-400/15 text-emerald-200' : auditDraft.statut === 'generated' ? 'bg-blue-400/15 text-blue-200' : 'bg-amber-400/15 text-amber-200')}>
              {auditDraft.statut === 'validated' ? 'Validé' : auditDraft.statut === 'generated' ? 'Audit généré' : 'À générer'}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-400">ChatGPT transforme le dossier et la discussion en audit complet : diagnostic, montants, allocation, recommandations par sujet, fiscalité, crash test et plan d’action.</p>
          {auditRecommendation?.updated_at && <p className="mt-3 text-xs text-slate-500">Dernière mise à jour : {new Date(auditRecommendation.updated_at).toLocaleString('fr-FR')}</p>}
          <button type="button" onClick={() => void generateAuditInChatGPT()} className={'mt-5 w-full rounded-xl px-4 py-3 text-sm font-bold transition ' + (auditReadyForPdf ? 'border border-blue-400/30 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20' : 'bg-amber-400 text-slate-950 hover:bg-amber-300')}>
            {auditReadyForPdf ? 'Régénérer l’audit' : 'Générer l’audit'}
          </button>
          <p className="mt-3 text-xs leading-5 text-slate-500">Le CRM surveille automatiquement l’enregistrement. Quand ChatGPT a terminé, le statut passe à « Audit généré ».</p>
        </div>

        <div className={'rounded-2xl border p-5 ' + (auditReadyForPdf ? 'border-emerald-500/25 bg-emerald-950/20' : 'border-slate-600/40 bg-slate-900/30')}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300">3 · Document</p>
              <h3 className="mt-1 text-lg font-semibold text-white">Audit patrimonial PDF</h3>
            </div>
            <span className={'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ' + (auditPdfUrl ? 'bg-emerald-400/15 text-emerald-200' : auditReadyForPdf ? 'bg-blue-400/15 text-blue-200' : 'bg-slate-700/60 text-slate-300')}>{auditPdfUrl ? 'PDF généré' : auditReadyForPdf ? 'Prêt pour PDF' : 'Audit requis'}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-400">Le PDF n’est généré qu’à partir d’un audit ChatGPT réellement produit. Un simple brouillon ne peut plus créer de PDF.</p>
          {auditPdfError && <p className="mt-3 rounded-lg border border-rose-500/25 bg-rose-950/20 px-3 py-2 text-xs font-semibold text-rose-200">{auditPdfError}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <button disabled={generatingAuditPdf || !auditReadyForPdf} type="button" onClick={() => void generateAuditPdf()} className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-35">{generatingAuditPdf ? 'Génération…' : auditPdfUrl ? 'Actualiser le PDF' : 'Générer le PDF'}</button>
            {auditPdfUrl && <button type="button" onClick={() => window.open(auditPdfUrl, '_blank', 'noopener,noreferrer')} className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/15">Voir le PDF</button>}
          </div>
        </div>
      </div>
    </section>}

    {activeTab === 'documents' && <section className="rounded-3xl border border-[#25405F] bg-[#08182B] p-6 shadow-[0_18px_45px_rgba(2,10,25,0.24)] sm:p-8">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-emerald-50 p-3"><FileText className="h-5 w-5 text-emerald-700" /></div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-300">Documents du dossier</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Collecte client et chaîne réglementaire</h2>
          <p className="mt-1 text-sm text-slate-300">Sélectionne d’abord la personne, puis travaille uniquement sur son parcours et ses justificatifs.</p>
        </div>
      </div>

      {sourceAnalysisMessage && <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{sourceAnalysisMessage}</p>}

      <div className="mt-6">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Clients du dossier</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {orderedInvestorDocumentStates.map((state) => {
            const investor = state.investor;
            const name = `${investor.investisseurs?.prenom ?? ''} ${investor.investisseurs?.nom ?? ''}`.trim() || 'Client';
            const individualDone = state.recueil && state.qpi && (state.esg || state.esgNotApplicable);
            const identifierLabel = investor.role_dossier === 'investisseur_1' ? 'Identifiant 1' : 'Identifiant 2';
            const isSelected = selectedDocumentState?.investor.investisseur_id === investor.investisseur_id;
            const investorDocs = sourceDocuments.filter((doc) => doc.investisseur_id === investor.investisseur_id || doc.concerne_investisseur_ids?.includes(investor.investisseur_id));
            const reviewCount = investorDocs.filter((doc) => doc.statut_analyse === 'to_review').length;
            return <button
              key={`identity-${investor.investisseur_id}`}
              type="button"
              aria-pressed={isSelected}
              onClick={() => { setSelectedDocumentInvestorId(investor.investisseur_id); setDocumentReviewOnly(false); }}
              className={`group rounded-2xl border px-4 py-4 text-left transition ${isSelected ? 'border-blue-400 bg-[#12345B] shadow-[0_8px_24px_rgba(37,99,235,0.18)] ring-2 ring-blue-900/40' : 'border-[#25405F] bg-[#0F223A] hover:border-blue-400 hover:bg-[#12304F]'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-[10px] font-extrabold uppercase tracking-[0.12em] ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>{identifierLabel}</p>
                  <p className="mt-1 break-words text-base font-bold text-white">{name}</p>
                  <p className="mt-1 text-[11px] text-slate-300">{investorDocs.length} pièce{investorDocs.length > 1 ? 's' : ''}{reviewCount ? ` · ${reviewCount} à contrôler` : ''}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase ${individualDone ? 'border-emerald-200 bg-emerald-100 text-emerald-700' : 'border-amber-200 bg-amber-100 text-amber-800'}`}>{individualDone ? 'Parcours terminé' : `En cours · ${state.recueilPercentage} %`}</span>
              </div>
            </button>;
          })}
        </div>
      </div>

      {selectedDocumentState && (() => {
        const state = selectedDocumentState;
        const investor = state.investor;
        const name = `${investor.investisseurs?.prenom ?? ''} ${investor.investisseurs?.nom ?? ''}`.trim() || 'Client';
        const identifierLabel = investor.role_dossier === 'investisseur_1' ? 'Identifiant 1' : 'Identifiant 2';
        const analysed = selectedSourceDocuments.filter((doc) => ['extracted','validated'].includes(doc.statut_analyse)).length;
        const review = selectedSourceDocuments.filter((doc) => doc.statut_analyse === 'to_review').length;
        const primaryInvestor = orderedInvestorDocumentStates.find((item) => item.investor.role_dossier === 'investisseur_1')?.investor ?? orderedInvestorDocumentStates[0]?.investor;
        const primarySections = primaryInvestor ? sections.filter((row) => row.investisseur_id === primaryInvestor.investisseur_id) : [];
        const primaryObjectives = primarySections.find((row) => row.section_code === 'objectives')?.payload as Record<string, unknown> | undefined;
        const primaryObjectivesCount = Array.isArray(primaryObjectives?.items) ? primaryObjectives.items.length : 0;
        const primaryRecueilReady = primaryInvestor ? ['completed','validated'].includes(primaryInvestor.recueil_status) : false;
        const allPartiesIdentified = orderedInvestorDocumentStates.every((item) => Boolean(item.investor.investisseurs?.prenom && item.investor.investisseurs?.nom && item.investor.investisseurs?.email));
        const derMissing = orderedInvestorDocumentStates.flatMap((item) => {
          const partyIdentity = sections.find((row) => row.investisseur_id === item.investor.investisseur_id && row.section_code === 'identity')?.payload ?? {};
          const label = item.investor.role_dossier === 'investisseur_1' ? 'Identifiant 1' : 'Identifiant 2';
          return [
            !item.investor.investisseurs?.prenom || !item.investor.investisseurs?.nom ? `${label} : identité` : '',
            !item.investor.investisseurs?.email ? `${label} : email` : '',
            !partyIdentity.civilite ? `${label} : civilité` : '',
          ].filter(Boolean);
        });
        const derReady = derMissing.length === 0;
        const derDocument = generatedDocuments.find((item) => item.type === 'der' && !item.investisseur_id);
        const missionDocument = generatedDocuments.find((item) => item.type === 'mission' && !item.investisseur_id);
        const derGenerationError = generationErrors['household:der'];
        const missionGenerationError = generationErrors['household:mission'];
        const missionMissing = [
          !allPartiesIdentified ? 'coordonnées des parties' : '',
          !primaryRecueilReady ? 'recueil principal validé' : '',
          primaryObjectivesCount === 0 ? 'objectifs de la mission' : '',
        ].filter(Boolean);
        const missionReady = missionMissing.length === 0;
        return <div className="mt-6 space-y-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
            <div className="rounded-2xl border border-[#25405F] bg-[#0B1A2F] p-4 shadow-[0_14px_34px_rgba(2,10,25,0.18)] sm:p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-blue-300">{identifierLabel}</p>
                  <h3 className="mt-1 text-lg font-bold text-white">{name}</h3>
                </div>
                <span className="text-xs font-semibold text-slate-300">Parcours client</span>
              </div>

              <div className="mt-4 space-y-2">
                {(['recueil','qpi','esg'] as GeneratedDocument['type'][]).map((type) => {
                  const notApplicable = type === 'esg' && state.esgNotApplicable;
                  const completed = type === 'recueil' ? state.recueil : type === 'qpi' ? state.qpi : state.esg;
                  const recueilInProgress = type === 'recueil' && state.recueilPdfAvailable && !state.recueil;
                  const document = generatedDocuments.find((item) => item.investisseur_id === investor.investisseur_id && item.type === type && item.signed_url);
                  const theme = type === 'recueil'
                    ? { row:'border-blue-500/40 bg-[#102A4C]', title:'text-blue-100', badge:'bg-blue-500 text-white', button:'bg-blue-600 hover:bg-blue-500' }
                    : type === 'qpi'
                      ? { row:'border-indigo-500/40 bg-[#24274F]', title:'text-indigo-100', badge:'bg-indigo-500 text-white', button:'bg-indigo-600 hover:bg-indigo-500' }
                      : { row:'border-teal-500/40 bg-[#103A35]', title:'text-teal-100', badge:'bg-teal-500 text-white', button:'bg-teal-600 hover:bg-teal-500' };
                  const rowClass = notApplicable ? 'border-teal-500/40 bg-[#103A35]' : completed ? theme.row : recueilInProgress ? 'border-amber-500/40 bg-[#3A2A0A]' : 'border-rose-500/40 bg-[#3B1622]';
                  const badgeClass = notApplicable ? 'border border-teal-400/40 bg-teal-400/15 text-teal-100' : completed ? theme.badge : recueilInProgress ? 'border border-amber-400/40 bg-amber-400/15 text-amber-100' : 'border border-rose-400/40 bg-rose-400/15 text-rose-100';
                  const status = notApplicable ? 'Non exprimée' : completed ? 'Complet' : recueilInProgress ? `En cours · ${state.recueilPercentage} %` : 'À compléter';
                  const title = type === 'recueil' ? 'Recueil d’informations' : type === 'qpi' ? 'Profil investisseur' : 'Préférences de durabilité';
                  const subtitle = type === 'recueil' ? 'Données déclarées par le client' : type === 'qpi' ? 'Questionnaire de profil de risque' : 'Préférences ESG';
                  const showRecueilActions = type === 'recueil' && state.recueilPdfAvailable;
                  const generationError = generationErrors[`${investor.investisseur_id}:${type}`];
                  return <div key={type} className={`rounded-xl border px-3.5 py-3 ${rowClass}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`text-sm font-bold leading-5 ${theme.title}`}>{title}</p>
                        <p className="mt-0.5 text-[11px] leading-4 text-slate-300">{subtitle}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase leading-none ${badgeClass}`}>{status}</span>
                    </div>
                    {notApplicable && <p className="mt-2 text-[11px] text-teal-200">Aucune préférence de durabilité exprimée.</p>}
                    {(completed || showRecueilActions) && <div className="mt-3 flex flex-wrap gap-2">
                      {document?.signed_url ? <a href={document.signed_url} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold text-white transition ${completed ? theme.button : 'bg-slate-800 hover:bg-slate-900'}`}><Download className="h-3.5 w-3.5" /> Voir le PDF</a> : generatingDocuments ? <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-blue-200"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Préparation</span> : null}
                      {type === 'recueil' && <button type="button" onClick={() => setActiveTab('clients')} className="rounded-lg border border-[#315173] bg-[#10243E] px-3 py-2 text-[10px] font-bold text-blue-100 hover:bg-[#17365E]">Voir les réponses</button>}
                    </div>}
                    {generationError && !document?.signed_url && <p className="mt-2 text-[10px] font-semibold text-amber-700">{generationError}</p>}
                  </div>;
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-[#25405F] bg-[#0B1A2F] p-4 shadow-[0_14px_34px_rgba(2,10,25,0.18)] sm:p-5">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-blue-300">Documents réglementaires</p>
              <div className="mt-4 space-y-2">
                <div className={`rounded-xl border px-4 py-3 ${derReady ? 'border-emerald-500/40 bg-[#10352F]' : 'border-amber-500/40 bg-[#3A2A0A]'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-white">DER</p>
                    <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase ${derDocument ? 'border-blue-400/40 bg-blue-400/15 text-blue-100' : derReady ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-100' : 'border-amber-400/40 bg-amber-400/15 text-amber-100'}`}>{derDocument ? 'PDF généré' : derReady ? 'Prêt à générer' : 'Données manquantes'}</span>
                  </div>
                  <p className={`mt-1.5 text-[10px] leading-4 ${derReady ? 'text-emerald-100/80' : 'text-amber-100/80'}`}>{derReady ? 'Modèle DER 2026 prérempli avec les données du dossier.' : `Manque : ${derMissing.join(', ')}.`}</p>
                  {derReady && <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" disabled={generatingRegulatoryType !== null} onClick={() => void generateRegulatoryPdf('der')} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50">{generatingRegulatoryType === 'der' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{derDocument ? 'Actualiser le PDF' : 'Générer le PDF'}</button>
                    {derDocument?.signed_url && <a href={derDocument.signed_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-blue-400/40 bg-blue-400/15 px-3 py-2 text-[10px] font-bold text-blue-100 hover:bg-blue-400/25"><Download className="h-3.5 w-3.5" /> Voir le PDF</a>}
                  </div>}
                  {derGenerationError && <p className="mt-2 text-[10px] font-semibold text-rose-200">{derGenerationError}</p>}
                </div>
                <div className={`rounded-xl border px-4 py-3 ${missionReady ? 'border-emerald-500/40 bg-[#10352F]' : 'border-amber-500/40 bg-[#3A2A0A]'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-white">Lettre de mission</p>
                    <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase ${missionDocument ? 'border-blue-400/40 bg-blue-400/15 text-blue-100' : missionReady ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-100' : 'border-amber-400/40 bg-amber-400/15 text-amber-100'}`}>{missionDocument ? 'PDF généré' : missionReady ? 'Prête à générer' : 'Données manquantes'}</span>
                  </div>
                  <p className={`mt-1.5 text-[10px] leading-4 ${missionReady ? 'text-emerald-100/80' : 'text-amber-100/80'}`}>{missionReady ? 'Modèle maître de lettre de mission prérempli pour le dossier.' : `Manque : ${missionMissing.join(', ')}.`}</p>
                  {missionReady && <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" disabled={generatingRegulatoryType !== null} onClick={() => void generateRegulatoryPdf('mission')} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50">{generatingRegulatoryType === 'mission' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{missionDocument ? 'Actualiser le PDF' : 'Générer le PDF'}</button>
                    {missionDocument?.signed_url && <a href={missionDocument.signed_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-blue-400/40 bg-blue-400/15 px-3 py-2 text-[10px] font-bold text-blue-100 hover:bg-blue-400/25"><Download className="h-3.5 w-3.5" /> Voir le PDF</a>}
                  </div>}
                  {missionGenerationError && <p className="mt-2 text-[10px] font-semibold text-rose-200">{missionGenerationError}</p>}
                </div>
                <Link to={`/cabinet/adequation?dossier=${dossierId}`} className="block rounded-xl border border-blue-500/40 bg-[#12345B] px-4 py-3 transition hover:bg-[#173E69]">
                  <div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-white">Déclaration d’adéquation</p><span className="rounded-full border border-blue-400/40 bg-blue-400/15 px-2.5 py-1 text-[9px] font-bold uppercase text-blue-100">Ouvrir</span></div>
                </Link>
              </div>
              <p className="mt-3 text-[11px] leading-5 text-slate-300">Le DER et la lettre de mission sont générés en PDF pour dépôt manuel sur Youtrust. Aucun envoi automatique vers Youtrust n’est effectué par le CRM. L’adéquation reste postérieure à la validation de la stratégie et des supports.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#25405F] bg-[#0B1A2F]">
            <div className="flex flex-col gap-3 border-b border-[#25405F] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-blue-300">Justificatifs du client</p>
                <p className="mt-1 text-sm font-semibold text-white">{selectedSourceDocuments.length} pièce{selectedSourceDocuments.length > 1 ? 's' : ''} · {analysed} intégrée{analysed > 1 ? 's' : ''}{review ? ` · ${review} à contrôler` : ''}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setDocumentReviewOnly(false)} className={`rounded-lg px-3 py-2 text-[11px] font-bold transition ${!documentReviewOnly ? 'bg-slate-900 text-white' : 'border border-[#315173] bg-[#10243E] text-blue-100 hover:bg-[#17365E]'}`}>Toutes · {selectedSourceDocuments.length}</button>
                <button type="button" onClick={() => setDocumentReviewOnly(true)} disabled={review === 0} className={`rounded-lg px-3 py-2 text-[11px] font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${documentReviewOnly ? 'bg-amber-600 text-white' : 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'}`}>À contrôler · {review}</button>
              </div>
            </div>

            {displayedSourceDocuments.length > 0 ? <div className="divide-y divide-slate-100">
              <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(120px,0.7fr)_minmax(120px,0.55fr)_auto] gap-4 bg-[#10243E] px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-300 md:grid">
                <span>Document</span><span>Catégorie</span><span>État</span><span className="text-right">Action</span>
              </div>
              {displayedSourceDocuments.map((doc) => {
                const status = sourceAnalysisLabel(doc.statut_analyse);
                const busy = analyzingSourceIds.has(doc.id) || doc.statut_analyse === 'processing';
                const fieldsApplied = Number(doc.metadata?.fields_applied ?? 0);
                const conflicts = Number(doc.metadata?.conflicts_detected ?? 0);
                const analysisError = typeof doc.metadata?.analysis_error === 'string' ? doc.metadata.analysis_error : '';
                const extraction = (doc.metadata?.extraction ?? {}) as Record<string,unknown>;
                const summary = (extraction.summary ?? {}) as Record<string,unknown>;
                const reason = typeof summary.reason === 'string'
                  ? summary.reason
                  : fieldsApplied === 0
                    ? 'Aucune donnée suffisamment certaine n’a été intégrée automatiquement. Un contrôle conseiller est requis.'
                    : 'Des données ont été intégrées, mais le document nécessite encore un contrôle conseiller.';
                const extractedFields = Array.isArray(summary.extracted_fields) ? summary.extracted_fields.map(String) : [];
                const pageCount = Number(extraction.page_count ?? summary.page_count ?? 0);
                const exactTotal = typeof summary.exact_total_amount === 'number' ? summary.exact_total_amount : null;
                const reviewOpen = reviewingSourceDocumentId === doc.id;
                const targetOptions = doc.categorie === 'patrimoine_immobilier'
                  ? professionalPatrimony.properties.map((item) => ({ value:'property|' + item.id, kind:'property', key:item.id, label:item.title + (item.city && item.city !== '—' ? ' · ' + item.city : '') }))
                  : doc.categorie === 'patrimoine_financier'
                    ? professionalPatrimony.financialAssets.map((item) => ({ value:'financial|' + item.id, kind:'financial', key:item.id, label:item.type + ' · ' + item.owner + (item.institution !== 'À préciser' ? ' · ' + item.institution : '') }))
                    : doc.categorie === 'tableau_amortissement'
                      ? professionalPatrimony.credits.map((item) => ({ value:'credit|' + item.id, kind:'credit', key:item.id, label:item.attachedTo + ' · ' + item.bank }))
                      : [];
                const selectedTarget = targetOptions.find((item) => item.value === (sourceReviewTargets[doc.id] ?? '')) ?? null;
                const reviewBusy = sourceReviewBusyId === doc.id;
                return <div key={doc.id} className="border-b border-[#203954] last:border-b-0">
                  <div className="grid gap-3 px-4 py-3.5 hover:bg-[#10243E]/80 md:grid-cols-[minmax(0,1.6fr)_minmax(120px,0.7fr)_minmax(120px,0.55fr)_auto] md:items-center md:gap-4 md:px-5">
                    <div className="min-w-0">
                      <p className="break-words text-xs font-bold text-white">{doc.nom_fichier}</p>
                      <p className="mt-1 text-[10px] text-slate-400">Reçu le {new Date(doc.created_at).toLocaleDateString('fr-FR')}{fieldsApplied > 0 ? ` · ${fieldsApplied} donnée${fieldsApplied > 1 ? 's' : ''} intégrée${fieldsApplied > 1 ? 's' : ''}` : ''}{conflicts > 0 ? ` · ${conflicts} écart${conflicts > 1 ? 's' : ''}` : ''}</p>
                      {analysisError && <p className="mt-1 text-[10px] font-medium text-amber-300">{analysisError}</p>}
                    </div>
                    <div><span className="text-[11px] font-semibold text-slate-200">{sourceDocumentCategoryLabel[doc.categorie] ?? humanize(doc.categorie)}</span></div>
                    <div><span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-bold uppercase ${status.cls}`}>{busy ? 'Analyse en cours' : status.label}</span></div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      {doc.storage_path && <button type="button" onClick={() => void openSourceDocument(doc)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#315173] bg-[#10243E] px-2.5 py-1.5 text-[10px] font-bold text-blue-100 hover:bg-[#17365E]"><Download className="h-3.5 w-3.5" /> Ouvrir</button>}
                      {doc.statut_analyse === 'uploaded' && doc.nom_fichier.toLowerCase().endsWith('.pdf') && <button type="button" disabled={busy} onClick={() => void analyzeSourceDocument(doc)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-blue-800 disabled:opacity-50">{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Analyser</button>}
                      {doc.statut_analyse === 'to_review' && <button type="button" disabled={busy} onClick={() => setReviewingSourceDocumentId((current) => current === doc.id ? null : doc.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-amber-500 disabled:opacity-50"><FileCheck2 className="h-3.5 w-3.5" /> Contrôler</button>}
                    </div>
                  </div>

                  {reviewOpen && doc.statut_analyse === 'to_review' && <div className="border-t border-amber-500/25 bg-amber-950/10 px-4 py-5 md:px-5">
                    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                      <div>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-300">Résultat de l’analyse</p>
                            <h4 className="mt-1 text-sm font-bold text-white">{fieldsApplied > 0 ? 'Données intégrées à vérifier' : 'Aucune intégration automatique'}</h4>
                          </div>
                          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold text-amber-200">{pageCount > 0 ? pageCount + ' page' + (pageCount > 1 ? 's' : '') : 'Document analysé'}</span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-300">{reason}</p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-xl border border-[#315173] bg-[#071425] p-3"><p className="text-[10px] font-bold uppercase text-slate-500">Données intégrées</p><p className="mt-1 text-lg font-bold text-white">{fieldsApplied}</p></div>
                          <div className="rounded-xl border border-[#315173] bg-[#071425] p-3"><p className="text-[10px] font-bold uppercase text-slate-500">Écarts détectés</p><p className="mt-1 text-lg font-bold text-white">{conflicts}</p></div>
                          <div className="rounded-xl border border-[#315173] bg-[#071425] p-3"><p className="text-[10px] font-bold uppercase text-slate-500">Montant reconnu</p><p className="mt-1 text-lg font-bold text-white">{exactTotal !== null ? euro(exactTotal) : '—'}</p></div>
                        </div>
                        {extractedFields.length > 0 && <div className="mt-4 rounded-xl border border-[#315173] bg-[#071425] p-3"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Champs reconnus</p><div className="mt-2 flex flex-wrap gap-2">{extractedFields.map((field) => <span key={field} className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-200">{humanize(field)}</span>)}</div></div>}
                        <details className="mt-4 rounded-xl border border-[#315173] bg-[#071425] px-3 py-2.5">
                          <summary className="cursor-pointer text-xs font-semibold text-slate-300">Détail technique de l’analyse</summary>
                          <div className="mt-2 text-xs leading-5 text-slate-500">
                            <p>Parser : {professionalText(summary.parser,'non précisé')}</p>
                            <p>Portée : {doc.portee_document ?? 'auto'}</p>
                            <p>Données concernées : {doc.concerne_investisseur_ids?.length ?? 0} personne{(doc.concerne_investisseur_ids?.length ?? 0) > 1 ? 's' : ''}</p>
                          </div>
                        </details>
                      </div>

                      <div className="rounded-2xl border border-[#315173] bg-[#071425] p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-300">Décision conseiller</p>
                        <p className="mt-1 text-sm font-semibold text-white">Contrôler puis clôturer la pièce</p>
                        {targetOptions.length > 0 && <label className="mt-4 block text-xs font-semibold text-slate-300">Rattachement métier facultatif
                          <select value={sourceReviewTargets[doc.id] ?? ''} onChange={(event) => setSourceReviewTargets((current) => ({ ...current, [doc.id]:event.target.value }))} className="mt-2 w-full rounded-xl border border-[#315173] bg-[#0B1A2F] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-400">
                            <option value="">Aucun rattachement</option>
                            {targetOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                          </select>
                        </label>}
                        <label className="mt-4 block text-xs font-semibold text-slate-300">Note de contrôle
                          <textarea value={sourceReviewNotes[doc.id] ?? ''} onChange={(event) => setSourceReviewNotes((current) => ({ ...current, [doc.id]:event.target.value }))} rows={3} placeholder="Ex. Plaquette LMNP conservée comme justificatif ; aucun chiffre réinjecté automatiquement." className="mt-2 w-full rounded-xl border border-[#315173] bg-[#0B1A2F] px-3 py-2.5 text-sm leading-5 text-white outline-none placeholder:text-slate-600 focus:border-blue-400" />
                        </label>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button type="button" disabled={reviewBusy} onClick={() => void finalizeSourceDocumentReview(doc, 'validated', selectedTarget ? { kind:selectedTarget.kind, key:selectedTarget.key, label:selectedTarget.label } : null)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50">{reviewBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{selectedTarget ? 'Rattacher et valider' : fieldsApplied > 0 ? 'Valider le contrôle' : 'Valider sans intégration'}</button>
                          <button type="button" disabled={reviewBusy || busy} onClick={() => void analyzeSourceDocument(doc)} className="rounded-lg border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-100 hover:bg-blue-500/20 disabled:opacity-50">Relancer l’analyse</button>
                          <button type="button" disabled={reviewBusy} onClick={() => void finalizeSourceDocumentReview(doc, 'rejected', null)} className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/20 disabled:opacity-50">Rejeter la pièce</button>
                        </div>
                        <p className="mt-3 text-[11px] leading-5 text-slate-500">Valider sans intégration signifie que la pièce est conservée comme justificatif, sans modifier automatiquement les données patrimoniales.</p>
                      </div>
                    </div>
                  </div>}
                </div>;
              })}
            </div> : <div className="px-5 py-10 text-center">
              <p className="text-sm font-semibold text-slate-200">{documentReviewOnly ? 'Aucune pièce à contrôler.' : 'Aucun justificatif reçu pour ce client.'}</p>
              <p className="mt-1 text-xs text-slate-400">{documentReviewOnly ? 'Toutes les pièces actuellement reçues sont traitées.' : 'Les pièces apparaîtront ici dès leur réception.'}</p>
            </div>}
          </div>
        </div>;
      })()}
    </section>}

    {activeTab === 'synthese' && <div className="overflow-hidden rounded-2xl border border-amber-500/60 bg-[#0B1A2F] shadow-[0_16px_40px_rgba(2,10,25,0.18)]">
        <div className="flex flex-col gap-3 border-b border-[#25405F] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300"><CheckCircle2 className="h-4 w-4" /></span><h3 className="text-sm font-bold uppercase tracking-[0.12em] text-amber-200">Objectifs prioritaires du foyer</h3></div>
            <p className="mt-1 pl-10 text-xs text-slate-400">Les priorités déclarées qui guideront les recommandations et le séquencement patrimonial.</p>
          </div>
          <span className="self-start rounded-full border border-[#315173] bg-[#10243E] px-3 py-1.5 text-[11px] font-semibold text-blue-200 sm:self-center">Court, moyen et long terme</span>
        </div>
        {snapshot.goals.length ? <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">{snapshot.goals.map((goal) => { const meta = objectivePresentation(goal); return <div key={goal} className={`rounded-2xl border p-4 ${meta.accent}`}><p className={`text-[11px] font-bold uppercase tracking-[0.12em] ${meta.label}`}>{meta.category}</p><p className="mt-2 text-sm font-semibold leading-5 text-white">{meta.title}</p><span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.badge}`}>{meta.horizon}</span></div>; })}</div> : <div className="p-5"><div className="rounded-2xl border border-amber-500/40 bg-amber-950/20 p-4 text-sm font-semibold text-amber-200">Objectifs à préciser avec le client.</div></div>}
        <div className={`border-t px-4 py-3 text-xs sm:px-5 ${snapshot.missing.length ? 'border-amber-500/30 bg-amber-950/10 text-amber-100' : 'border-emerald-500/30 bg-emerald-950/10 text-emerald-100'}`}><strong>{snapshot.missing.length ? 'Points à compléter avant conseil :' : 'Données de travail principales disponibles.'}</strong>{snapshot.missing.length ? ` ${snapshot.missing.join(', ')}.` : ''}</div>
      </div>}

    {activeTab === 'conformite' && <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-3"><div className="rounded-2xl bg-blue-50 p-3"><ShieldCheck className="h-5 w-5 text-blue-700" /></div><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Contrôles du dossier</p><h2 className="mt-1 text-xl font-semibold text-slate-950">Contrôles CIF à traiter et Complétude réglementaire</h2><p className="mt-1 text-sm text-slate-500">Lecture consolidée des incohérences, données manquantes et validations réglementaires.</p></div></div>
      <div className="mt-5 space-y-5">{investorSummaries.map(({ investor, issues, summary, completeness }) => { const investorSourceDocs = sourceDocuments.filter((doc) => doc.investisseur_id === investor.investisseur_id || doc.concerne_investisseur_ids?.includes(investor.investisseur_id)); const analysedSourceDocs = investorSourceDocs.filter((doc) => ['extracted','validated'].includes(doc.statut_analyse)).length; const reviewSourceDocs = investorSourceDocs.filter((doc) => doc.statut_analyse === 'to_review').length; return <div key={investor.investisseur_id}>{investorSummaries.length > 1 && <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-blue-500">{investor.investisseurs?.prenom} {investor.investisseurs?.nom}</p>}
      <div className="mt-6 grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-blue-500/40 bg-gradient-to-br from-[#17365E] to-[#0B1A2F] p-5 text-white shadow-[0_14px_34px_rgba(2,10,25,0.18)]"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20 text-blue-200"><ShieldCheck className="h-5 w-5" /></span><div><h3 className="font-semibold text-white">Contrôles CIF à traiter</h3><p className="mt-1 text-xs text-blue-200/80">Vérifications de cohérence et points d’attention métier.</p></div></div>{issues.length ? <div className="mt-4 space-y-3">{issues.map((issue: ConsistencyIssue) => <div key={issue.code} className={`rounded-xl border p-4 ${issue.severity === 'blocking' ? 'border-red-500/40 bg-red-950/30' : issue.severity === 'review' ? 'border-amber-500/40 bg-amber-950/25' : 'border-blue-400/30 bg-blue-950/25'}`}><p className="font-semibold text-white">{issue.title}</p><p className="mt-1 text-sm leading-5 text-slate-200">{issue.message}</p></div>)}</div> : <div className="mt-4 rounded-xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-200">Aucune incohérence issue du recueil détectée.</div>}
      {(() => { const sessionIds = qpiSessions.filter((s) => s.investisseur_id === investor.investisseur_id).map((s) => s.id); const controls = qpiControls.filter((control) => sessionIds.includes(control.session_id) && control.alerte); const qpiResult = qpiResults.find((result) => sessionIds.includes(result.session_id)); return <>{controls.length > 0 && <div className="mt-4 space-y-3"><p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-200">Contrôles QPI traçables</p>{controls.map((control) => <QpiControlCard key={control.id} control={control} busy={resolvingControlId === control.id} onResolve={(item, code) => void resolveQpiControl(item, code)} />)}</div>}{qpiResult && <QpiLiquidityCard result={qpiResult} />}</>; })()}</div><div className="rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-[#0F3B3A] to-[#0B1A2F] p-5 text-white shadow-[0_14px_34px_rgba(2,10,25,0.18)]"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-200"><FileCheck2 className="h-5 w-5" /></span><div><h3 className="font-semibold text-white">Complétude réglementaire</h3><p className="mt-1 text-xs text-emerald-100/80">État des données, pièces et validations requises.</p></div></div><div className="mt-4 border-t border-emerald-400/20 pt-4 text-sm text-slate-100">{completeness && !completeness.complete && <p className="leading-5"><strong className="text-white">Recueil réel : {completeness.percentage} %.</strong> Sections à terminer : {(completeness.details.sections ?? []).filter((section) => !section.complete).map((section) => sectionLabel[section.section_code] ?? section.section_code).join(', ') || 'à vérifier'}.</p>}<div className="mt-4 grid gap-3 sm:grid-cols-2"><p><strong className="text-emerald-100">Données à contrôler :</strong> {summary.provenance.cifReviewRequired}</p><p><strong className="text-emerald-100">Justificatifs reçus :</strong> {investorSourceDocs.length}</p><p><strong className="text-emerald-100">Données intégrées :</strong> {analysedSourceDocs}</p><p><strong className="text-amber-200">Pièces à contrôler :</strong> {reviewSourceDocs}</p><p><strong className="text-white">Transmission finale :</strong> {investor.transmitted_at ? 'Effectuée' : 'En attente'}</p></div></div></div></div>
      </div>; })}</div>
    </section>}

    {activeTab === 'synthese' && <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-start gap-3"><div className="rounded-2xl bg-blue-50 p-3"><Home className="h-5 w-5 text-blue-700" /></div><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Photographie patrimoniale du foyer</p><h2 className="mt-1 text-xl font-semibold text-slate-950">Les chiffres utiles pour travailler le dossier</h2><p className="mt-1 text-sm text-slate-500">Lecture par problématique patrimoniale. Aucune valeur n’est déduite lorsqu’une donnée nécessaire manque.</p></div></div>
      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <WorkBlock title="Revenus & capacité" subtitle="Flux, charges et marge de manœuvre"><WorkLine label="Revenus annuels" value={snapshot.annualIncome.found ? euro(snapshot.annualIncome.value) : 'Non renseigné'} attention={!snapshot.annualIncome.found} /><WorkLine label="Revenus mensuels" value={snapshot.annualIncome.found ? euro(snapshot.annualIncome.value / 12) : 'Non calculable'} attention={!snapshot.annualIncome.found} /><WorkLine label="Charges annuelles" value={snapshot.annualCharges.found ? euro(snapshot.annualCharges.value) : 'Non renseigné'} attention={!snapshot.annualCharges.found} /><WorkLine label="Capacité d’épargne" value={snapshot.savingsCapacityMonthly.found ? `${euro(snapshot.savingsCapacityMonthly.value)} / mois` : 'Non renseigné'} attention={!snapshot.savingsCapacityMonthly.found} /><WorkLine label="Reste disponible mensuel" value={snapshot.remainingMonthly !== null ? euro(snapshot.remainingMonthly) : 'Non calculable'} attention={snapshot.remainingMonthly === null} /></WorkBlock>
        <WorkBlock title="Fiscal" subtitle="Fiscalité personnelle et leviers disponibles"><WorkLine label="TMI" value={snapshot.tmi.found ? percent(snapshot.tmi.value) : 'Non renseignée'} attention={!snapshot.tmi.found} /><WorkLine label="Revenu imposable" value={snapshot.taxableIncome.found ? euro(snapshot.taxableIncome.value) : 'Non renseigné'} attention={!snapshot.taxableIncome.found} /><WorkLine label="RFR" value={snapshot.rfr.found ? euro(snapshot.rfr.value) : 'Non renseigné'} attention={!snapshot.rfr.found} /><WorkLine label="IR net" value={snapshot.incomeTax.found ? euro(snapshot.incomeTax.value) : 'Non renseigné'} attention={!snapshot.incomeTax.found} /><WorkLine label="Plafond PER disponible" value={snapshot.perCeiling.found ? euro(snapshot.perCeiling.value) : 'Non renseigné'} attention={!snapshot.perCeiling.found} /><WorkLine label="IFI" value={snapshot.ifi.found ? euro(snapshot.ifi.value) : 'Non concerné / non renseigné'} /><WorkLine label="Déficit foncier reportable" value={snapshot.landDeficit.found ? euro(snapshot.landDeficit.value) : 'Non renseigné'} /></WorkBlock>
        <WorkBlock title="Placements & liquidités" subtitle="Actifs financiers mobilisables et encours"><WorkLine label="Actifs financiers" value={snapshot.financialAssets.found ? euro(snapshot.financialAssets.value) : 'Non valorisés'} attention={!snapshot.financialAssets.found} /><WorkLine label="Familles de placements" value={household.financialCategories.length ? household.financialCategories.map((c) => financialCategoryLabel[c] ?? c).join(', ') : 'Aucun placement identifié'} attention={!household.financialCategories.length} /><WorkLine label="Patrimoine net estimé" value={snapshot.patrimonyNet !== null ? euro(snapshot.patrimonyNet) : 'Non calculable'} attention={snapshot.patrimonyNet === null} /></WorkBlock>
        <WorkBlock title="Immobilier" subtitle="Valeur, détention et patrimoine net"><WorkLine label="Nombre de biens" value={`${household.realEstate.count}`} /><WorkLine label="Immobilier brut" value={euro(household.realEstate.totalValue)} /><WorkLine label="Biens communs" value={euro(household.realEstate.jointValue)} /><WorkLine label="Immobilier net estimé" value={snapshot.netRealEstate !== null ? euro(snapshot.netRealEstate) : 'Non calculable'} attention={snapshot.netRealEstate === null} /><WorkLine label="Ressaisies neutralisées" value={`${household.realEstate.duplicatesIgnored}`} /></WorkBlock>
        <WorkBlock title="Crédits & endettement" subtitle="Poids de la dette et solvabilité"><WorkLine label="Mensualités crédits" value={snapshot.monthlyDebt.found ? euro(snapshot.monthlyDebt.value) : 'Non renseigné'} attention={!snapshot.monthlyDebt.found} /><WorkLine label="Capital restant dû" value={snapshot.debtOutstanding.found ? euro(snapshot.debtOutstanding.value) : 'Non renseigné'} attention={!snapshot.debtOutstanding.found} /><WorkLine label="Taux d’endettement" value={snapshot.debtRatio !== null ? percent(snapshot.debtRatio) : 'Non calculable'} attention={snapshot.debtRatio === null} /><WorkLine label="Disponible bancaire" value={snapshot.bankAvailableMonthly !== null ? `${euro(snapshot.bankAvailableMonthly)} / mois` : 'Non calculable'} attention={snapshot.bankAvailableMonthly === null} /></WorkBlock>
        <WorkBlock title="Succession / transmission" subtitle="Organisation familiale et transmission patrimoniale"><WorkLine label="Situation familiale" value={snapshot.familyStatus.found ? snapshot.familyStatus.value : 'Non renseignée'} attention={!snapshot.familyStatus.found} /><WorkLine label="Régime / convention" value={snapshot.matrimonialRegime.found ? snapshot.matrimonialRegime.value : 'Non renseigné'} attention={!snapshot.matrimonialRegime.found} /><WorkLine label="Enfants" value={snapshot.children.found ? new Intl.NumberFormat('fr-FR').format(snapshot.children.value) : 'Non renseigné'} attention={!snapshot.children.found} /><WorkLine label="Notaire" value={snapshot.notary.found ? snapshot.notary.value : 'Non renseigné'} /><WorkLine label="Clause / avantage identifié" value={snapshot.transmissionClause.found ? snapshot.transmissionClause.value : 'Aucun élément identifié'} /><WorkLine label="Objectif transmission" value={snapshot.transmissionGoals.length ? snapshot.transmissionGoals.join(' · ') : 'Aucun objectif spécifique identifié'} /></WorkBlock>
      </div>
      {household.warnings.length > 0 && <div className="mt-3 rounded-2xl border border-amber-500/60 bg-amber-950/20 p-4 text-sm text-amber-100"><strong>À contrôler :</strong> {household.warnings.join(' ')}</div>}
    </section>}

    {activeTab === 'patrimoine' && <section className="rounded-3xl border border-[#25405F] bg-[#08182B] p-6 shadow-[0_18px_45px_rgba(2,10,25,0.24)] sm:p-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-blue-500/15 p-3"><Home className="h-5 w-5 text-blue-200" /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-300">Patrimoine du foyer</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Vue patrimoniale professionnelle</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">Lecture consolidée du foyer : actifs, immobilier, placements et dettes. Les champs OCR, identifiants internes et données techniques restent masqués de la vue métier.</p>
          </div>
        </div>
        <span className="rounded-full border border-blue-400/25 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-100">Données documentées</span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ['Patrimoine brut documenté', euro(professionalPatrimony.totals.grossDocumented)],
          ['Dettes documentées', euro(professionalPatrimony.totals.documentedDebt)],
          ['Patrimoine net indicatif', euro(professionalPatrimony.totals.netDocumented)],
          ['Immobilier', euro(professionalPatrimony.totals.realEstateGross)],
          ['Financier documenté', euro(professionalPatrimony.totals.documentedFinancial)],
          ['Liquidités identifiées', euro(professionalPatrimony.totals.documentedLiquidity)],
        ].map(([label,value]) => <div key={label} className="rounded-2xl border border-[#25405F] bg-[#0F223A] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</p>
          <p className="mt-2 text-lg font-bold text-white">{value}</p>
        </div>)}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Revenus locatifs annuels', euro(professionalPatrimony.totals.annualRent)],
          ['Mensualités actuelles', euro(professionalPatrimony.totals.currentMonthlyDebt) + ' / mois'],
          ['Mensualités futures connues', euro(professionalPatrimony.totals.futureMonthlyDebt) + ' / mois'],
          ['Nombre de crédits', String(professionalPatrimony.credits.length)],
        ].map(([label,value]) => <div key={label} className="rounded-xl border border-[#25405F] bg-[#0B1A2F] px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</p>
          <p className="mt-1 text-sm font-bold text-slate-100">{value}</p>
        </div>)}
      </div>

      <div className="mt-6 rounded-2xl border border-[#25405F] bg-[#0B1A2F]">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#25405F] px-5 py-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-300">Immobilier</p><h3 className="mt-1 text-lg font-semibold text-white">{professionalPatrimony.properties.length} bien{professionalPatrimony.properties.length > 1 ? 's' : ''}</h3></div>
          <p className="text-xs text-slate-400">Valeur de marché, loyers, dette associée et équité nette</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1080px] w-full text-left text-sm">
            <thead className="bg-[#10243E] text-[10px] uppercase tracking-[0.08em] text-blue-200"><tr><th className="px-4 py-3">Bien</th><th className="px-4 py-3">Détention</th><th className="px-4 py-3">Usage</th><th className="px-4 py-3 text-right">Valeur</th><th className="px-4 py-3 text-right">Loyer/an</th><th className="px-4 py-3 text-right">Rdt brut</th><th className="px-4 py-3 text-right">CRD associé</th><th className="px-4 py-3 text-right">Équité nette</th><th className="px-4 py-3">Projet</th></tr></thead>
            <tbody className="divide-y divide-[#203954]">
              {professionalPatrimony.properties.map((property) => {
                const grossYield = property.value && property.annualRent ? (property.annualRent / property.value) * 100 : null;
                return <tr key={property.id} className="bg-[#071425] align-top hover:bg-[#0C1E34]">
                  <td className="px-4 py-3"><p className="font-semibold text-white">{property.title}</p><p className="mt-1 text-xs text-slate-500">{property.type} · {property.city}</p><details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-blue-300">Voir le détail</summary><div className="mt-2 grid gap-1.5 text-xs leading-5 text-slate-400"><p>Mode de détention : <span className="text-slate-200">{property.holding}</span></p><p>Quote-part : <span className="text-slate-200">{property.ownershipShare ? property.ownershipShare + ' %' : 'À préciser'}</span></p><p>Date d’acquisition : <span className="text-slate-200">{professionalDate(property.acquisitionDate)}</span></p><p>Prix d’acquisition : <span className="text-slate-200">{property.acquisitionPrice !== null ? euro(property.acquisitionPrice) : 'À préciser'}</span></p>{property.monthlyRent !== null && <p>Loyer mensuel : <span className="text-slate-200">{euro(property.monthlyRent)}</span></p>}{property.comment && <p>Observation : <span className="text-slate-200">{property.comment}</span></p>}</div></details></td>
                  <td className="px-4 py-3 font-medium text-slate-200">{property.owner}</td>
                  <td className="px-4 py-3 text-slate-300">{property.usage}</td>
                  <td className="px-4 py-3 text-right font-semibold text-white">{property.value !== null ? euro(property.value) : 'À préciser'}</td>
                  <td className="px-4 py-3 text-right text-slate-200">{property.annualRent !== null ? euro(property.annualRent) : '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-200">{grossYield !== null ? percent(grossYield) : '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-200">{property.outstanding !== null ? euro(property.outstanding) : <span className="text-amber-300">À confirmer</span>}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-200">{property.netEquity !== null ? euro(property.netEquity) : '—'}</td>
                  <td className="px-4 py-3"><span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-200">{property.project}</span></td>
                </tr>;
              })}
              {!professionalPatrimony.properties.length && <tr><td colSpan={9} className="px-4 py-6 text-center text-slate-500">Aucun bien immobilier structuré dans le dossier.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-[#25405F] bg-[#0B1A2F]">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#25405F] px-5 py-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-300">Patrimoine financier</p><h3 className="mt-1 text-lg font-semibold text-white">{professionalPatrimony.financialAssets.length} ligne{professionalPatrimony.financialAssets.length > 1 ? 's' : ''} documentée{professionalPatrimony.financialAssets.length > 1 ? 's' : ''}</h3></div>
          <p className="text-xs text-slate-400">Les montants non documentés ne sont pas inventés.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="bg-[#10243E] text-[10px] uppercase tracking-[0.08em] text-emerald-200"><tr><th className="px-4 py-3">Titulaire</th><th className="px-4 py-3">Enveloppe / support</th><th className="px-4 py-3">Établissement</th><th className="px-4 py-3 text-right">Montant</th><th className="px-4 py-3">Fiscalité</th><th className="px-4 py-3">Liquidité</th><th className="px-4 py-3">Traçabilité</th></tr></thead>
            <tbody className="divide-y divide-[#203954]">
              {professionalPatrimony.financialAssets.map((asset) => <tr key={asset.id} className="bg-[#071425] hover:bg-[#0C1E34]"><td className="px-4 py-3 font-medium text-slate-200">{asset.owner}</td><td className="px-4 py-3 font-semibold text-white">{asset.type}</td><td className="px-4 py-3 text-slate-300">{asset.institution}</td><td className="px-4 py-3 text-right font-semibold text-white">{asset.amount !== null ? euro(asset.amount) : 'À préciser'}</td><td className="px-4 py-3 text-slate-300">{asset.taxTreatment}</td><td className="px-4 py-3 text-slate-300">{asset.liquidity}</td><td className="px-4 py-3 text-xs text-slate-500">{asset.sourceFile || 'Déclaratif / synthèse'}</td></tr>)}
              {!professionalPatrimony.financialAssets.length && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Aucune ligne financière documentée. Les catégories déclarées restent disponibles dans le recueil.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-[#25405F] bg-[#0B1A2F]">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#25405F] px-5 py-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-300">Crédits</p><h3 className="mt-1 text-lg font-semibold text-white">{professionalPatrimony.credits.length} financement{professionalPatrimony.credits.length > 1 ? 's' : ''}</h3></div>
          <p className="text-xs text-slate-400">Lecture bancaire : CRD, taux, mensualités et échéances</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full text-left text-sm">
            <thead className="bg-[#10243E] text-[10px] uppercase tracking-[0.08em] text-amber-200"><tr><th className="px-4 py-3">Bien financé</th><th className="px-4 py-3">Banque</th><th className="px-4 py-3 text-right">CRD</th><th className="px-4 py-3 text-right">Taux</th><th className="px-4 py-3 text-right">Mensualité actuelle</th><th className="px-4 py-3 text-right">Mensualité future</th><th className="px-4 py-3">Fin</th><th className="px-4 py-3">Emprunteur</th></tr></thead>
            <tbody className="divide-y divide-[#203954]">
              {professionalPatrimony.credits.map((credit) => <tr key={credit.id} className="bg-[#071425] align-top hover:bg-[#0C1E34]">
                <td className="px-4 py-3"><p className="font-semibold text-white">{credit.attachedTo}</p><p className="mt-1 text-xs text-slate-500">{credit.type}</p><details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-amber-300">Voir le détail</summary><div className="mt-2 grid gap-1.5 text-xs leading-5 text-slate-400"><p>Montant initial : <span className="text-slate-200">{credit.initialAmount !== null ? euro(credit.initialAmount) : 'À préciser'}</span></p><p>Ouverture : <span className="text-slate-200">{professionalDate(credit.openingDate)}</span></p><p>Durée restante : <span className="text-slate-200">{credit.remainingMonths !== null ? credit.remainingMonths + ' mois' : 'À préciser'}</span></p><p>Assurance : <span className="text-slate-200">{credit.insurance}</span></p>{credit.phase && <p>Phase : <span className="text-slate-200">{credit.phase}</span></p>}{credit.sourceFile && <p>Source : <span className="text-slate-200">{credit.sourceFile}</span></p>}</div></details></td>
                <td className="px-4 py-3 font-medium text-slate-200">{credit.bank}</td>
                <td className="px-4 py-3 text-right font-semibold text-white">{credit.outstanding !== null ? euro(credit.outstanding) : 'À préciser'}</td>
                <td className="px-4 py-3 text-right text-slate-200">{credit.rate !== null ? percent(credit.rate) : 'À préciser'}<p className="mt-1 text-[10px] text-slate-500">{credit.rateType}</p></td>
                <td className="px-4 py-3 text-right text-slate-200">{credit.currentPayment !== null ? euro(credit.currentPayment) : 'À préciser'}</td>
                <td className="px-4 py-3 text-right text-slate-200">{credit.futurePayment !== null ? euro(credit.futurePayment) : '—'}{credit.futurePaymentDate && <p className="mt-1 text-[10px] text-slate-500">dès le {professionalDate(credit.futurePaymentDate)}</p>}</td>
                <td className="px-4 py-3 text-slate-300">{professionalDate(credit.endDate)}</td>
                <td className="px-4 py-3 text-slate-300">{credit.borrower}</td>
              </tr>)}
              {!professionalPatrimony.credits.length && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">Aucun crédit structuré dans le dossier.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {(household.warnings.length > 0 || professionalPatrimony.properties.some((property) => property.outstanding === null && /locatif|residence|résidence/i.test(property.usage))) && <div className="mt-5 rounded-2xl border border-amber-500/25 bg-amber-950/15 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-300">Points à confirmer</p>
        <div className="mt-2 space-y-1 text-sm leading-6 text-amber-100">
          {household.warnings.map((warning) => <p key={warning}>• {warning}</p>)}
          {professionalPatrimony.properties.filter((property) => property.outstanding === null && /locatif|residence|résidence/i.test(property.usage)).map((property) => <p key={'credit-warning-' + property.id}>• {property.title} : aucun crédit n’est rattaché de façon certaine ; le CRD n’est donc pas supposé nul.</p>)}
        </div>
      </div>}
    </section>}

    {activeTab === 'fiscalite' && <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-3"><div className="rounded-2xl bg-blue-50 p-3"><FileCheck2 className="h-5 w-5 text-blue-700" /></div><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Fiscalité</p><h2 className="mt-1 text-xl font-semibold text-slate-950">Avis d’imposition et données fiscales utiles</h2><p className="mt-1 text-sm text-slate-500">Les données fiscales extraites sont regroupées ici pour éviter de parcourir le recueil complet.</p></div></div>
      <div className="mt-6 space-y-5">{investorSummaries.map(({ investor, investorSections }) => { const taxSections = investorSections.filter((row) => row.section_code === 'tax'); return <div key={investor.investisseur_id} className="rounded-2xl border border-slate-200 p-5"><p className="text-sm font-semibold text-slate-950">{investor.investisseurs?.prenom} {investor.investisseurs?.nom}</p><div className="mt-4 grid gap-4">{taxSections.map((row) => <PayloadCard key={row.section_code} code={row.section_code} payload={row.payload ?? {}} />)}</div>{!taxSections.length && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Aucune donnée fiscale disponible.</p>}</div>; })}</div>
    </section>}

    {activeTab === 'clients' && investorSummaries.map(({ investor, investorSections, summary, unresolvedQpiControls, effectiveReadiness, completeness }) => { const badge = readinessLabel(effectiveReadiness); const orderedSections = [...investorSections].filter((row) => !['tax','patrimony','financial','credits'].includes(row.section_code)).sort((a, b) => sectionOrder.indexOf(a.section_code) - sectionOrder.indexOf(b.section_code)); return <section id={`investor-${investor.investisseur_id}`} key={investor.investisseur_id} className="scroll-mt-6 rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><div className="rounded-2xl bg-blue-50 p-3"><UserRound className="h-5 w-5 text-blue-700" /></div><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-500">{investor.role_dossier === 'investisseur_1' ? 'Identifiant 1' : 'Identifiant 2'}</p><h2 className="mt-1 text-xl font-semibold text-slate-950">{investor.investisseurs?.prenom} {investor.investisseurs?.nom}</h2><p className="mt-1 text-xs text-slate-500">{investor.investisseurs?.email || 'Email non renseigné'} · Recueil {completeness ? `${completeness.percentage} %` : investor.recueil_status} · QPI {investor.qpi_status} · Durabilité {investor.esg_opt_in === false ? 'aucune préférence exprimée' : investor.esg_status}</p></div></div><span className={`inline-flex items-center gap-2 self-start rounded-full px-3 py-2 text-xs font-bold ${badge.className}`}>{badge.icon}{badge.label}</span></div>
      <div className="mt-7"><p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Données déclarées</p><h3 className="mt-1 text-lg font-semibold text-slate-950">Lecture complète du recueil</h3><p className="mt-1 text-sm text-slate-500">Toutes les informations saisies dans le parcours client sont remontées ici, sans ressaisie.</p><div className="mt-5 grid gap-4 lg:grid-cols-2">{orderedSections.map((row) => <PayloadCard key={row.section_code} code={row.section_code} payload={row.payload ?? {}} />)}</div>{!orderedSections.length && <p className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm text-slate-600">Aucune donnée de recueil disponible pour cet identifiant.</p>}</div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-2xl border border-blue-100 p-4"><p className="text-xs font-bold uppercase text-blue-500">Recueil</p><p className="mt-2 text-2xl font-semibold">{completeness ? `${completeness.percentage} %` : `${summary.sections.completed}/${summary.sections.total}`}</p></div><div className="rounded-2xl border border-blue-100 p-4"><p className="text-xs font-bold uppercase text-blue-500">Données contrôlées</p><p className="mt-2 text-2xl font-semibold">{summary.provenance.verified + summary.provenance.retained}/{summary.provenance.total}</p></div><div className="rounded-2xl border border-blue-100 p-4"><p className="text-xs font-bold uppercase text-blue-500">Justificatifs</p><p className="mt-2 text-2xl font-semibold">{sourceDocuments.filter((doc) => doc.investisseur_id === investor.investisseur_id || doc.concerne_investisseur_ids?.includes(investor.investisseur_id)).length} reçus</p></div><div className="rounded-2xl border border-blue-100 p-4"><p className="text-xs font-bold uppercase text-blue-500">Contrôles</p><p className="mt-2 text-2xl font-semibold">{summary.consistency.total + unresolvedQpiControls.length}</p></div></div>

    </section>; })}







  </div></div>;
}
