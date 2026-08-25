import { useEffect, useMemo, useState } from 'react';
import { Building2, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, HelpCircle, Loader2, Plus, Trash2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { JourneyProgress, PageIntro, WizardCard } from '../../portal/FintechJourney';
import { supabase } from '../../lib/supabase';
import { dossierHref, fetchPortalProgress, messageFromError, selectedProgress, type PortalProgress } from '../../portal/portalHelpers';

type AnyPayload = Record<string, any>;
type SectionCode = 'identity' | 'family' | 'professional' | 'objectives' | 'capacity' | 'tax' | 'regulatory' | 'patrimony' | 'financial' | 'credits';

const sections: Array<{ code: SectionCode; label: string; title: string; description: string }> = [
  { code: 'identity', label: 'Identité', title: 'Identité et coordonnées', description: 'Vérifiez vos informations personnelles, votre adresse fiscale et vos coordonnées.' },
  { code: 'family', label: 'Famille', title: 'Situation familiale', description: 'Renseignez votre situation de famille et les éléments utiles à l’organisation patrimoniale.' },
  { code: 'professional', label: 'Profession', title: 'Situation professionnelle', description: 'Votre activité et votre statut permettent d’apprécier la stabilité et l’origine de vos revenus.' },
  { code: 'objectives', label: 'Objectifs', title: 'Mes objectifs', description: 'Sélectionnez vos objectifs, classez-les par priorité et indiquez leur horizon.' },
  { code: 'capacity', label: 'Revenus', title: 'Revenus et capacité financière', description: 'Précisez votre capacité d’épargne, votre épargne de précaution et les revenus estimés.' },
  { code: 'patrimony', label: 'Immobilier', title: 'Immobilier', description: 'Déclarez chaque bien en quelques réponses essentielles. Les situations particulières peuvent être précisées uniquement si nécessaire.' },
  { code: 'financial', label: 'Financier', title: 'Patrimoine financier', description: 'Indiquez simplement les grandes catégories détenues et un encours global approximatif. Les relevés transmis ensuite permettront d’obtenir le détail.' },
  { code: 'regulatory', label: 'Réglementaire', title: 'Situation réglementaire', description: 'Résidence fiscale, FATCA/CRS, sanctions, PPE et choix de durabilité.' },
];

const financialCategoryOptions = [
  ['current_accounts', 'Comptes courants'],
  ['savings', 'Livrets et épargne bancaire'],
  ['life_insurance', 'Assurance-vie / capitalisation'],
  ['retirement', 'PER / épargne retraite'],
  ['securities', 'PEA / compte-titres'],
  ['paper_real_estate', 'SCPI / OPCI'],
  ['employee_savings', 'Épargne salariale'],
  ['other', 'Autres placements'],
  ['none', 'Aucun compte ni placement'],
] as const;

const financialTotalBands = [
  ['under_10k', 'Moins de 10 000 €'],
  ['10k_50k', 'De 10 000 € à 50 000 €'],
  ['50k_100k', 'De 50 000 € à 100 000 €'],
  ['100k_250k', 'De 100 000 € à 250 000 €'],
  ['250k_500k', 'De 250 000 € à 500 000 €'],
  ['over_500k', 'Plus de 500 000 €'],
] as const;

const objectiveOptions = [
  ['optimisation_fiscale', 'Optimiser sa fiscalité'],
  ['achat_immobilier', 'Financer un achat immobilier'],
  ['constitution_patrimoine', 'Se constituer un patrimoine'],
  ['epargne_precaution', 'Se constituer une épargne de précaution'],
  ['liquidites_court_terme', 'Placer des liquidités à court terme'],
  ['revenus_complementaires', 'Obtenir des revenus complémentaires'],
  ['optimisation_rendement', 'Optimiser la rentabilité de ses placements'],
  ['retraite', 'Préparer sa retraite'],
  ['aide_enfants', 'Aider ses enfants'],
  ['protection_conjoint', 'Protéger le conjoint survivant'],
  ['protection_proches', 'Protéger ses proches'],
  ['transmission', 'Préparer la transmission de son patrimoine'],
  ['transmission_entreprise', 'Préparer la transmission de son entreprise'],
  ['accidents_vie', 'Se prémunir contre les accidents de la vie'],
  ['autre', 'Autres objectifs'],
] as const;

type ObjectiveCode = (typeof objectiveOptions)[number][0];

const objectiveGroups: Array<{ title: string; description: string; codes: ObjectiveCode[] }> = [
  { title: 'Fiscalité & performance', description: 'Optimiser vos placements et votre fiscalité.', codes: ['optimisation_fiscale', 'optimisation_rendement', 'liquidites_court_terme'] },
  { title: 'Projets & constitution de patrimoine', description: 'Financer vos projets et construire votre patrimoine.', codes: ['achat_immobilier', 'constitution_patrimoine', 'epargne_precaution', 'aide_enfants'] },
  { title: 'Retraite & revenus complémentaires', description: 'Préparer vos revenus futurs et votre niveau de vie.', codes: ['retraite', 'revenus_complementaires'] },
  { title: 'Protection & transmission', description: 'Protéger vos proches et organiser la transmission.', codes: ['protection_conjoint', 'protection_proches', 'transmission', 'transmission_entreprise', 'accidents_vie'] },
  { title: 'Autre besoin', description: 'Ajoutez un objectif qui ne figure pas dans les catégories précédentes.', codes: ['autre'] },
];

const objectiveLabelByCode = Object.fromEntries(objectiveOptions) as Record<ObjectiveCode, string>;

const choiceFields: Record<string, { options: string[]; allowCustom?: boolean }> = {
  'Civilité': { options: ['Mr', 'Mme'] },
  'Type de logement': { options: ['Propriétaire', 'Locataire', 'Logé à titre gratuit'], allowCustom: true },
  'Situation familiale': { options: ['Célibataire', 'Marié', 'Pacsé', 'Concubinage', 'Divorcé', 'Séparé', 'Veuf / Veuve'], allowCustom: true },
  'Régime / convention': { options: ['Communauté réduite aux acquêts', 'Communauté universelle', 'Séparation de biens', 'Participation aux acquêts', 'PACS - séparation des patrimoines', 'PACS - indivision', 'Sans convention / non applicable'], allowCustom: true },
  'Statut': { options: ['CDI', 'CDD', 'Fonctionnaire', 'Indépendant / TNS', 'Chef d’entreprise', 'Retraité', 'Sans activité', 'Étudiant'], allowCustom: true },
  'Catégorie socioprofessionnelle': { options: ['Cadre', 'Profession intermédiaire', 'Employé', 'Ouvrier', 'Artisan / commerçant / chef d’entreprise', 'Profession libérale', 'Agriculteur', 'Retraité', 'Sans activité'], allowCustom: true },
  'Titulaire / nature du compte': { options: ['Personnel', 'Compte joint / commun'], allowCustom: true },
  'Usage': { options: ['Résidence principale', 'Résidence secondaire', 'Locatif', 'Autre'] },
  'Type de bien': { options: ['Appartement', 'Maison', 'Immeuble', 'Terrain', 'Local professionnel / commercial', 'Autre'] },
  'Propriétaire du bien': { options: ['Identifiant 1 et 2', 'Identifiant 1', 'Identifiant 2'] },
  'Projet concernant ce bien': { options: ['Conserver', 'Vendre', 'Mettre en location', 'À étudier'] },
  'Comment ce bien est-il détenu ?': { options: ['En direct', 'En indivision', 'Via une SCI', 'Nue-propriété', 'Usufruit', 'Autre'] },
  'Type de contrat': { options: ['Livret A', 'LDDS', 'LEP', 'PEL', 'CEL', 'Assurance-vie', 'PER', 'PEA', 'Compte-titres', 'SCPI', 'Compte à terme'], allowCustom: true },
  'Type de crédit': { options: ['Prêt immobilier résidence principale', 'Prêt immobilier locatif', 'Prêt à la consommation', 'Prêt automobile', 'Prêt personnel', 'Prêt professionnel'], allowCustom: true },
  'Type de prêt': { options: ['Amortissable', 'In fine', 'Relais'], allowCustom: true },
};

const initial: Record<SectionCode, AnyPayload> = {
  identity: { civilite: '', prenom: '', nom: '', nom_naissance: '', date_naissance: '', lieu_naissance: '', pays_naissance: 'France', nationalite: 'Française', mesure_protection: false, type_protection: '', date_protection: '', mobile: '', telephone_bureau: '', telephone_domicile: '', numero_fiscal: '', address: { numero_voie: '', complement: '', code_postal: '', ville: '', pays: 'France', type_logement: '' } },
  family: { situation: '', date_evenement: '', regime_convention: '', avantage_matrimonial: '', evolution_prevue: '', notaire_nom_ville: '', expert_comptable_nom_ville: '', nombre_enfants: '', commentaires: '' },
  professional: { profession_actuelle: '', societe: '', secteur_activite: '', statut: '', categorie_socioprofessionnelle: '', anciennete_annees: '', date_entree: '', origine_revenus_sans_activite: '', changement_professionnel_prevu: '', changement_professionnel_details: '', precisions: '' },
  objectives: { items: [] },
  capacity: { estimation_revenus_travail_annuels: '', estimation_revenus_fonciers_annuels: '', epargne_precaution_cible: '', capacite_epargne_mensuelle: '', apport_immobilier_possible: '' },
  tax: { annee_imposition: new Date().getFullYear().toString(), salaires_assimiles: '', pensions_retraites_rentes: '', revenus_lmnp: '', revenus_bnc_pro: '', revenus_capitaux_mobiliers: '', revenus_fonciers_nets: '', revenu_imposable: '', impot_revenu_net: '', prelevements_sociaux_nets: '', taux_imposition: '', tmi: '', revenu_fiscal_reference: '', nombre_parts: '', deficit_foncier_reportable: '', evolution_revenus_commentaire: '', plafond_disponible_avis: '', versements_a_deduire: '', plafond_non_utilise_calcule: '', ifi_concerne: false, ifi_base_imposable: '', ifi_tmi: '', ifi_net_a_payer: '' },
  regulatory: { pays_residence_fiscale: 'France', citoyen_ou_resident_us: '', code_tin: '', fatca_crs_concerne: '', sanctions_declarees: '', ppe_declaree: '', ppe_entourage: '', ppe_personne_exposee: '', ppe_motif: '', ppe_pays_exercice: '', ppe_anciennete: '', commentaire_fiscal: '', commentaire_lcbft: '', esg_opt_in: '' },
  patrimony: { has_real_estate: '', comptes_courants: [], immobilier: [], placements: [] },
  financial: { categories: [], total_band: '', other_details: '', completeness_confirmed: false },
  credits: { items: [] },
};

function Field({ label, value, onChange, type = 'text', required = false, placeholder = '', help = '', options }: { label: string; value: any; onChange: (value: string) => void; type?: string; required?: boolean; placeholder?: string; help?: string; options?: string[] }) {
  const choice = choiceFields[label];
  const optionList = useMemo(() => options ?? choice?.options ?? [], [choice, options]);
  const normalizedValue = value === null || value === undefined ? '' : String(value);
  const isCustomValue = normalizedValue !== '' && Boolean(choice) && !optionList.includes(normalizedValue);
  const [customMode, setCustomMode] = useState(isCustomValue);

  useEffect(() => {
    if (isCustomValue) setCustomMode(true);
    else if (normalizedValue && optionList.includes(normalizedValue)) setCustomMode(false);
  }, [isCustomValue, normalizedValue, optionList]);

  if (choice) {
    const isCivility = label === 'Civilité';
    const isPropertyOwner = label === 'Propriétaire du bien';
    return <div className="text-sm font-semibold text-slate-700">
      <p>{label}{required && ' *'}</p>
      <div className={`mt-2 gap-2 ${isCivility ? 'grid grid-cols-2' : isPropertyOwner ? 'grid grid-cols-3' : 'flex flex-wrap'}`}>
        {optionList.map((option) => <button key={option} type="button" onClick={() => { setCustomMode(false); onChange(option); }} className={`${isCivility || isPropertyOwner ? 'w-full min-w-0' : 'min-w-[8.5rem]'} ${isPropertyOwner ? 'px-2 text-xs sm:px-3 sm:text-sm' : 'px-3.5 text-sm'} rounded-xl border py-2.5 font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 ${normalizedValue === option ? 'scale-[0.97] border-[#3B82F6] bg-[#3B82F6] text-white shadow-sm shadow-blue-950/20' : 'border-[#E2E8F0] bg-white text-slate-700 hover:-translate-y-0.5 hover:border-[#3B82F6] hover:shadow-md'}`}>{option}</button>)}
        {choice.allowCustom && <button type="button" onClick={() => { setCustomMode(true); if (!isCustomValue) onChange(''); }} className={`min-w-[8.5rem] rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition ${customMode ? 'border-[#3B82F6] bg-blue-50 text-blue-700' : 'border-[#E2E8F0] bg-white text-slate-700'}`}>Autre</button>}
      </div>
      {choice.allowCustom && customMode && <input autoFocus type={type} value={isCustomValue ? normalizedValue : ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || 'Autre / précisez'} className="mt-2 w-full rounded-xl border border-[#CBD5E1] bg-white px-4 py-3 font-normal outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-500/30" />}
      {help && <span className="mt-2 block text-xs font-normal leading-5 text-[#94A3B8]">{help}</span>}
    </div>;
  }
  return <label className="text-sm font-semibold text-slate-700">{label}{required && ' *'}<input type={type} min={type === 'number' ? 0 : undefined} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-xl border border-[#CBD5E1] bg-white px-4 py-3 outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-500/30" />{help && <span className="mt-2 block text-xs font-normal leading-5 text-[#94A3B8]">{help}</span>}</label>;
}

function BoolChoice({ label, value, onChange, required = true, help = '', yesLabel = 'Oui', noLabel = 'Non' }: { label: string; value: boolean | ''; onChange: (value: boolean) => void; required?: boolean; help?: React.ReactNode; yesLabel?: string; noLabel?: string }) {
  return <fieldset><legend className="text-sm font-semibold text-slate-700">{label}{required && ' *'}</legend>{help && <p className="mt-1.5 text-xs font-normal leading-5 text-[#94A3B8]">{help}</p>}<div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">{[[true, yesLabel], [false, noLabel]].map(([v, text]) => <button key={text as string} type="button" aria-pressed={value === v} onClick={() => onChange(v as boolean)} className={`min-h-12 rounded-xl border px-4 py-3 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 ${value === v ? 'scale-[0.97] border-[#3B82F6] bg-[#3B82F6] text-white shadow-sm shadow-blue-950/20' : 'border-[#E2E8F0] bg-white text-slate-700 hover:-translate-y-0.5 hover:border-[#3B82F6] hover:shadow-md'}`}>{text as string}</button>)}</div></fieldset>;
}

function GuidanceNote({ children }: { children: React.ReactNode }) {
  return <div className="relative overflow-hidden rounded-2xl border border-blue-300/25 bg-gradient-to-r from-[#172b49] to-[#12223a] px-5 py-4 text-sm leading-6 text-[#d9e7f7] shadow-inner shadow-black/10">
    <span className="absolute inset-y-0 left-0 w-1 bg-[#3B82F6]" aria-hidden="true" />
    <div className="flex items-start gap-3.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-400/15 text-[#86b7ff]"><HelpCircle className="h-5 w-5" /></span>
      <div className="min-w-0 pt-0.5 [&>p:first-child]:text-base [&>p:first-child]:font-semibold [&>p:first-child]:text-white [&>p+p]:mt-1.5">{children}</div>
    </div>
  </div>;
}

function RecueilInfoNote({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="relative overflow-hidden rounded-2xl border border-sky-300/20 bg-[#17263f] px-5 py-4 text-sm leading-6 text-[#cfdef0] shadow-sm shadow-black/10">
    <span className="absolute inset-y-0 left-0 w-1 bg-[#60A5FA]" aria-hidden="true" />
    <div className="flex items-start gap-3.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-400/15 text-[#8ec5ff]"><CheckCircle2 className="h-4.5 w-4.5" /></span>
      <div className="min-w-0">
        <p className="font-semibold text-white">{title}</p>
        <div className="mt-1 text-[#cfdef0]">{children}</div>
      </div>
    </div>
  </div>;
}

function MoneyField(props: Omit<React.ComponentProps<typeof Field>, 'type'>) { return <Field {...props} type="number" />; }

function CompactHorizonField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const options = [
    { value: '0', label: 'Court terme — moins de 3 ans' },
    { value: '3', label: 'Moyen terme — 3 à 5 ans' },
    { value: '5', label: 'Long terme — 5 à 10 ans' },
    { value: '10', label: 'Très long terme — plus de 10 ans' },
  ];
  const normalizedValue = String(value ?? '');
  const isPreset = options.some((option) => option.value === normalizedValue);
  const [customMode, setCustomMode] = useState(normalizedValue !== '' && !isPreset);

  useEffect(() => {
    if (isPreset) setCustomMode(false);
  }, [isPreset]);

  return <div>
    <label className="text-sm font-semibold text-slate-700">Horizon du projet *
      <select value={customMode ? 'custom' : normalizedValue} onChange={(event) => { const nextValue = event.target.value; if (nextValue === 'custom') { setCustomMode(true); onChange(''); } else { setCustomMode(false); onChange(nextValue); } }} className="mt-2 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-3 text-sm font-normal text-slate-800 outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-500/30">
        <option value="">Choisir un horizon</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        <option value="custom">Autre durée précise</option>
      </select>
    </label>
    {customMode && <label className="mt-3 block text-xs font-semibold text-slate-600">Durée précise, en années<input type="number" min="0" value={isPreset ? '' : normalizedValue} onChange={(event) => onChange(event.target.value)} placeholder="Ex. 7" className="mt-1.5 w-full rounded-xl border border-[#CBD5E1] bg-white px-4 py-3 text-sm font-normal outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-500/30" /></label>}
  </div>;
}

function MonthYearField({ label = 'Date d’entrée dans l’entreprise', value, onChange, required = false, minYear = 1940 }: { label?: string; value: string; onChange: (value: string) => void; required?: boolean; minYear?: number }) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])/.exec(String(value ?? ''));
  const yearValue = match?.[1] ?? '';
  const monthValue = match?.[2] ?? '';
  const [draftMonth, setDraftMonth] = useState(monthValue);
  const [draftYear, setDraftYear] = useState(yearValue);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - minYear + 1 }, (_, index) => String(currentYear - index));
  const months = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));

  useEffect(() => {
    setDraftMonth(monthValue);
    setDraftYear(yearValue);
  }, [monthValue, yearValue]);

  const selectMonth = (month: string) => {
    setDraftMonth(month);
    if (!month) onChange('');
    else if (draftYear) onChange(`${draftYear}-${month}-01`);
  };

  const selectYear = (year: string) => {
    setDraftYear(year);
    if (!year) onChange('');
    else if (draftMonth) onChange(`${year}-${draftMonth}-01`);
  };

  return <div className="rounded-2xl border border-white/10 bg-[#111C31] p-4 text-sm font-semibold text-[#F1F5F9] shadow-sm">
    <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#60A5FA]" />{label} : mois / année{required && ' *'}</p>
    <p className="mt-1 text-xs font-normal leading-5 text-[#94A3B8]">Sélectionnez le mois puis l’année. Exemple : 05 / 2015.</p>
    <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-end gap-2 rounded-xl bg-white p-3 text-slate-700">
      <label className="!bg-transparent !p-0 !text-slate-700 !shadow-none"><span className="text-xs font-medium">Mois</span><select aria-label={`Mois — ${label}`} value={draftMonth} onChange={(event) => selectMonth(event.target.value)} className="mt-1 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-3 text-sm font-normal text-slate-800 outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-500/30"><option value="">MM</option>{months.map((month) => <option key={month} value={month}>{month}</option>)}</select></label>
      <span className="pb-3 text-lg font-semibold text-slate-500">/</span>
      <label className="!bg-transparent !p-0 !text-slate-700 !shadow-none"><span className="text-xs font-medium">Année</span><select aria-label={`Année — ${label}`} value={draftYear} onChange={(event) => selectYear(event.target.value)} className="mt-1 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-3 text-sm font-normal text-slate-800 outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-500/30"><option value="">AAAA</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
    </div>
  </div>;
}

function ReadOnlyField({ label, value, help }: { label: string; value: string; help?: string }) {
  return <label className="text-sm font-semibold text-slate-700">{label}<input type="email" readOnly value={value} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-700 outline-none" />{help && <span className="mt-1.5 block text-xs font-normal leading-5 text-blue-100">{help}</span>}</label>;
}
function isBlank(value: unknown): boolean { return value === null || value === undefined || String(value).trim() === ''; }
function isNonNegativeNumber(value: unknown): boolean {
  if (isBlank(value)) return false;
  const number = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(number) && number >= 0;
}
function isValidMobile(value: unknown): boolean {
  const compact = String(value ?? '').trim().replace(/[\s().-]/g, '');
  const digits = compact.replace(/\D/g, '');
  if (!digits || ['0000000000', '0123456789', '1234567890'].includes(digits)) return false;
  if (/^(\d)\1+$/.test(digits) && digits.length >= 8) return false;
  if (/^0[67]\d{8}$/.test(compact)) return true;
  if (/^\+33[67]\d{8}$/.test(compact)) return true;
  return /^\+[1-9]\d{7,14}$/.test(compact);
}

const emptyRealEstate = () => ({ intitule: '', type_bien: '', type_bien_autre: '', usage: '', usage_autre: '', proprietaire: '', projet_bien: '', mode_detention: 'En direct', mode_detention_autre: '', quote_part: '', valeur_actuelle: '', date_acquisition: '', prix_acquisition: '', ville: '', loyer_annuel: '', commentaire: '' });

function accountFromPlacement(item: AnyPayload): AnyPayload {
  return { banque: item.organisme ?? '', titulaire: item.libelle_contrat ?? '', solde_actuel: item.montant_actuel ?? '', montant_mobilisable: item.montant_reemploi_possible ?? '', commentaire: item.commentaire ?? '' };
}

function accountToPlacement(item: AnyPayload): AnyPayload {
  return { type_contrat: 'Compte courant', organisme: item.banque ?? '', libelle_contrat: item.titulaire ?? '', valeur_acquisition: '', montant_actuel: item.solde_actuel ?? '', date_valorisation: '', annee_ouverture: '', versements_programmes_annuels: '', montant_reemploi_possible: item.montant_mobilisable ?? '', numero_contrat: '', commentaire: item.commentaire ?? '' };
}

export default function ClientRecueilJourneyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dossierId = searchParams.get('dossier');
  const [rows, setRows] = useState<PortalProgress[]>([]);
  const [step, setStep] = useState(0);
  const [forms, setForms] = useState<Record<SectionCode, AnyPayload>>(initial);
  const [doneSections, setDoneSections] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const progress = useMemo(() => selectedProgress(rows, dossierId), [rows, dossierId]);
  const current = sections[step];
  const form = forms[current.code];
  const identityNeedsBirthName = String(forms.identity.civilite ?? '').trim().toLowerCase() === 'mme';
  const familySituation = String(forms.family.situation ?? '').toLowerCase();
  const familyNeedsConvention = familySituation.includes('mari') || familySituation.includes('pacs');
  const familyNeedsEventDate = familyNeedsConvention || familySituation.includes('divorc');
  const familyEventLabel = familySituation.includes('divorc') ? 'Date du divorce' : familySituation.includes('pacs') ? 'Date du PACS' : 'Date du mariage';
  const professionalStatus = String(forms.professional.statut ?? '').toLowerCase();
  const professionalIsInactive = professionalStatus.includes('retrait') || professionalStatus.includes('sans activité') || professionalStatus.includes('sans activite') || professionalStatus.includes('étudiant') || professionalStatus.includes('etudiant');
  const professionalNeedsEmployer = !professionalIsInactive;
  const professionalNeedsIncomeOrigin = professionalStatus.includes('sans activité') || professionalStatus.includes('sans activite');
  const professionalNeedsChangeQuestion = !professionalStatus.includes('retrait');
  const propertyOwnerOptions = !progress?.is_couple
    ? ['Identifiant 1']
    : progress.role_dossier === 'investisseur_2'
      ? ['Identifiant 2']
      : ['Identifiant 1 et 2', 'Identifiant 1'];
  const familySituationOptions = progress?.is_couple
    ? ['Marié', 'Pacsé', 'Concubinage']
    : ['Célibataire', 'Divorcé', 'Séparé', 'Veuf / Veuve'];

  const patch = (code: SectionCode, values: AnyPayload) => setForms((state) => ({ ...state, [code]: { ...state[code], ...values } }));
  const patchCurrent = (values: AnyPayload) => { setErrorMessage(''); patch(current.code, values); };

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setAccountEmail(data.user?.email ?? '')).catch(() => setAccountEmail(''));
    void fetchPortalProgress().then(async (progressRows) => {
      setRows(progressRows);
      const row = selectedProgress(progressRows, dossierId);
      if (!row) return;
      if (row.recueil_status !== 'validated') {
        const { error } = await supabase.rpc('start_my_recueil', { p_dossier_id: row.dossier_id });
        if (error) throw error;
      }
      const [{ data: sectionData, error: sectionError }, { data: investor, error: investorError }] = await Promise.all([
        supabase.from('recueil_sections').select('section_code,payload,completed_at').eq('dossier_id', row.dossier_id).eq('investisseur_id', row.investisseur_id),
        supabase.from('investisseurs').select('civilite,prenom,nom,nom_naissance,date_naissance,lieu_naissance,pays_naissance,nationalite,mobile,telephone_bureau,telephone_domicile,numero_fiscal').eq('id', row.investisseur_id).single(),
      ]);
      if (sectionError) throw sectionError;
      if (investorError) throw investorError;
      const nextForms = structuredClone(initial) as Record<SectionCode, AnyPayload>;
      nextForms.identity = { ...nextForms.identity, ...(investor ?? {}) };
      const completed = new Set<string>();
      for (const item of sectionData ?? []) {
        const code = item.section_code as SectionCode;
        const payload = (item.payload ?? {}) as AnyPayload;
        if (code === 'patrimony') {
          const allPlacements: AnyPayload[] = Array.isArray(payload.placements) ? payload.placements : [];
          const legacyAccounts = allPlacements.filter((placement) => String(placement.type_contrat ?? '').toLowerCase() === 'compte courant').map(accountFromPlacement);
          const accounts = Array.isArray(payload.comptes_courants) ? payload.comptes_courants : legacyAccounts;
          nextForms.patrimony = { ...nextForms.patrimony, ...payload, comptes_courants: accounts, placements: allPlacements.filter((placement) => String(placement.type_contrat ?? '').toLowerCase() !== 'compte courant') };
        } else if (code in nextForms) {
          nextForms[code] = { ...nextForms[code], ...payload };
        }
        if (item.completed_at) completed.add(code);
      }
      setForms(nextForms);
      setDoneSections(completed);
      if (row.esg_opt_in !== null && !(sectionData ?? []).some((x) => x.section_code === 'regulatory')) patch('regulatory', { esg_opt_in: row.esg_opt_in });
      const firstIncomplete = sections.findIndex((s) => !completed.has(s.code));
      if (firstIncomplete >= 0) setStep(firstIncomplete);
    }).catch((error) => setErrorMessage(messageFromError(error)));
  }, [dossierId]);

  const validateSection = () => {
    if (current.code === 'identity') {
      if ([form.civilite, form.prenom, form.nom, form.date_naissance, form.lieu_naissance, form.pays_naissance, form.nationalite, form.mobile].some(isBlank)) throw new Error('Complétez tous les champs obligatoires de votre identité.');
      if (new Date(`${form.date_naissance}T00:00:00`) > new Date()) throw new Error('La date de naissance ne peut pas être dans le futur.');
      if (!isValidMobile(form.mobile)) throw new Error('Indiquez un numéro de mobile valide. Les numéros fictifs comme 0000000000 sont refusés.');
      if (identityNeedsBirthName && isBlank(form.nom_naissance)) throw new Error('Indiquez votre nom de naissance. Ce champ est obligatoire lorsque la civilité est Mme.');
      if ([form.address?.numero_voie, form.address?.code_postal, form.address?.ville, form.address?.pays, form.address?.type_logement].some(isBlank)) throw new Error('Complétez tous les champs obligatoires de votre adresse fiscale.');
    }
    if (current.code === 'family') {
      if (isBlank(form.situation) || isBlank(form.nombre_enfants)) throw new Error('Renseignez votre situation familiale et le nombre d’enfants.');
      if (!familySituationOptions.includes(String(form.situation))) throw new Error(progress?.is_couple ? 'Pour ce dossier couple, choisissez Marié, Pacsé ou Concubinage.' : 'Pour ce dossier individuel, choisissez Célibataire, Divorcé, Séparé ou Veuf / Veuve.');
      if (!Number.isInteger(Number(form.nombre_enfants)) || Number(form.nombre_enfants) < 0) throw new Error('Le nombre d’enfants doit être un nombre entier positif ou nul.');
      if (familyNeedsEventDate && isBlank(form.date_evenement)) throw new Error(`Indiquez la ${familyEventLabel.toLowerCase()} (mois / année).`);
      if (familyNeedsConvention && isBlank(form.regime_convention)) throw new Error('Pour une situation mariée ou pacsée, indiquez le régime / la convention.');
    }
    if (current.code === 'professional') {
      if ([form.profession_actuelle, form.secteur_activite, form.statut].some(isBlank)) throw new Error('Renseignez votre profession, votre secteur d’activité et votre statut.');
      if (professionalNeedsEmployer && (isBlank(form.societe) || isBlank(form.date_entree))) throw new Error('Renseignez votre entreprise et votre date d’entrée (mois / année).');
      if (professionalNeedsIncomeOrigin && isBlank(form.origine_revenus_sans_activite)) throw new Error('Précisez l’origine de vos revenus lorsque vous êtes sans activité.');
      if (professionalNeedsChangeQuestion && form.changement_professionnel_prevu === '') throw new Error('Indiquez si un changement professionnel est prévu dans les prochains mois.');
      if (professionalNeedsChangeQuestion && form.changement_professionnel_prevu === true && isBlank(form.changement_professionnel_details)) throw new Error('Précisez le changement professionnel prévu.');
    }
    if (current.code === 'objectives') {
      if (!Array.isArray(form.items) || form.items.length === 0) throw new Error('Sélectionnez au moins un objectif.');
      for (const item of form.items) {
        if (isBlank(item.horizon_annees) || Number(item.horizon_annees) < 0) throw new Error('Indiquez un horizon pour chaque objectif.');
        if (item.code_objectif === 'autre' && isBlank(item.libelle_autre)) throw new Error('Précisez votre autre objectif.');
      }
    }
    if (current.code === 'capacity') {
      if ([form.estimation_revenus_travail_annuels, form.estimation_revenus_fonciers_annuels, form.epargne_precaution_cible, form.capacite_epargne_mensuelle].some(isBlank)) throw new Error('Renseignez vos revenus estimés, votre épargne de précaution et votre capacité d’épargne. Indiquez 0 lorsqu’un montant est nul.');
      if ([form.estimation_revenus_travail_annuels, form.estimation_revenus_fonciers_annuels, form.epargne_precaution_cible, form.capacite_epargne_mensuelle].some((value) => !isNonNegativeNumber(value)) || (!isBlank(form.apport_immobilier_possible) && !isNonNegativeNumber(form.apport_immobilier_possible))) throw new Error('Les montants de revenus, d’épargne et d’apport doivent être positifs ou nuls.');
    }
    if (current.code === 'tax') {
      if ([form.annee_imposition, form.revenu_imposable, form.revenu_fiscal_reference, form.nombre_parts, form.tmi, form.impot_revenu_net].some(isBlank)) throw new Error('Complétez les principales données fiscales obligatoires. Indiquez 0 lorsqu’un montant est nul.');
      if (form.ifi_concerne === true && [form.ifi_base_imposable, form.ifi_net_a_payer].some(isBlank)) throw new Error('Complétez la base imposable et l’IFI net à payer.');
    }
    if (current.code === 'regulatory') {
      if (isBlank(form.pays_residence_fiscale)) throw new Error('Indiquez votre pays de résidence fiscale.');
      for (const key of ['citoyen_ou_resident_us', 'sanctions_declarees', 'ppe_declaree', 'esg_opt_in']) if (form[key] === '') throw new Error('Répondez à toutes les questions réglementaires obligatoires.');
      if (form.citoyen_ou_resident_us === true && isBlank(form.code_tin)) throw new Error('Indiquez votre code TIN.');
      if (form.sanctions_declarees === true && isBlank(form.commentaire_lcbft)) throw new Error('Précisez la mesure de sanction ou de gel des avoirs qui vous concerne.');
      if (form.ppe_declaree === true && [form.ppe_personne_exposee, form.ppe_motif, form.ppe_pays_exercice, form.ppe_anciennete].some(isBlank)) throw new Error('Complétez toutes les informations relatives à la personne politiquement exposée.');
    }
    if (current.code === 'patrimony') {
      if (form.has_real_estate === '') throw new Error('Indiquez si vous détenez un ou plusieurs biens immobiliers.');
      if (form.has_real_estate === true) {
        if (!Array.isArray(form.immobilier) || form.immobilier.length === 0) throw new Error('Ajoutez au moins un bien immobilier.');
        for (const item of form.immobilier ?? []) {
          if ([item.type_bien, item.usage, item.proprietaire, item.projet_bien, item.valeur_actuelle, item.ville].some(isBlank)) throw new Error('Complétez les six informations essentielles de chaque bien immobilier.');
          if (!isNonNegativeNumber(item.valeur_actuelle) || Number(String(item.valeur_actuelle).replace(',', '.')) === 0) throw new Error('La valeur estimée actuelle du bien doit être supérieure à 0 €.');
          if (!isBlank(item.prix_acquisition) && !isNonNegativeNumber(item.prix_acquisition)) throw new Error('Le prix d’acquisition doit être positif ou nul.');
          if (!isBlank(item.date_acquisition)) {
            const year = Number(item.date_acquisition);
            if (!/^\d{4}$/.test(String(item.date_acquisition)) || year < 1800 || year > new Date().getFullYear()) throw new Error(`L’année d’acquisition doit être comprise entre 1800 et ${new Date().getFullYear()}.`);
          }
          if (item.type_bien === 'Autre' && isBlank(item.type_bien_autre)) throw new Error('Précisez le type du bien immobilier.');
          if (item.usage === 'Autre' && isBlank(item.usage_autre)) throw new Error('Précisez l’usage du bien immobilier.');
          if (item.mode_detention === 'Autre' && isBlank(item.mode_detention_autre)) throw new Error('Précisez comment le bien immobilier est détenu.');
          const defaultedQuotePart = isBlank(item.quote_part) && item.proprietaire === 'Identifiant 1 et 2' ? '50' : item.quote_part;
          const quotePartValue = Number(String(defaultedQuotePart ?? '').replace(',', '.').replace('%', '').trim());
          if ((item.proprietaire === 'Identifiant 1 et 2' || item.mode_detention === 'En indivision') && (isBlank(defaultedQuotePart) || !Number.isFinite(quotePartValue) || quotePartValue <= 0 || quotePartValue >= 100)) throw new Error('Indiquez une quote-part comprise entre 1 % et 99 % lorsque le bien est détenu à plusieurs.');
          if (item.usage === 'Locatif' && isBlank(item.loyer_annuel)) throw new Error('Indiquez le loyer annuel hors charges pour chaque bien locatif.');
          if (item.usage === 'Locatif' && !isNonNegativeNumber(item.loyer_annuel)) throw new Error('Le loyer annuel hors charges doit être positif ou nul.');
        }
      }
    }
    if (current.code === 'financial') {
      const categories = Array.isArray(form.categories) ? form.categories : [];
      if (categories.length === 0) throw new Error('Sélectionnez au moins une catégorie, ou indiquez que vous ne détenez aucun compte ni placement.');
      if (categories.includes('none') && categories.length > 1) throw new Error('Le choix « Aucun compte ni placement » ne peut pas être associé à une autre catégorie.');
      if (categories.includes('other') && isBlank(form.other_details)) throw new Error('Précisez la nature de vos autres placements.');
      if (!categories.includes('none') && isBlank(form.total_band)) throw new Error('Indiquez l’encours financier total approximatif.');
      if (form.completeness_confirmed !== true) throw new Error('Confirmez que votre déclaration couvre l’ensemble de vos comptes et placements.');
    }
    if (current.code === 'credits') {
      for (const item of form.items ?? []) if ([item.type_credit, item.banque, item.montant_initial, item.capital_restant_du, item.mensualite, item.duree_mois, item.taux, item.type_pret].some(isBlank)) throw new Error('Complétez toutes les informations principales de chaque crédit.');
    }
  };

  const saveCurrent = async () => {
    if (!progress) return;
    validateSection();
    let payloadToSave = form;
    if (current.code === 'objectives') payloadToSave = { ...form, items: (form.items ?? []).map((item: AnyPayload, index: number) => ({ ...item, priorite: index + 1 })) };
    if (current.code === 'patrimony') {
      const placementsWithoutAccounts = (form.placements ?? []).filter((placement: AnyPayload) => String(placement.type_contrat ?? '').toLowerCase() !== 'compte courant');
      payloadToSave = { ...form, immobilier: (form.immobilier ?? []).map((item: AnyPayload) => ({
        ...item,
        intitule: isBlank(item.intitule) ? [item.type_bien, item.ville].filter(Boolean).join(' — ') : String(item.intitule).trim(),
        mode_detention: isBlank(item.mode_detention) ? 'En direct' : item.mode_detention,
        quote_part: String(isBlank(item.quote_part) ? (item.proprietaire === 'Identifiant 1 et 2' ? '50' : '100') : item.quote_part).replace(',', '.').replace('%', '').trim(),
      })), collection_mode: 'real_estate_quick', placements: [...placementsWithoutAccounts, ...(form.comptes_courants ?? []).map(accountToPlacement)] };
    }
    const { error } = await supabase.rpc('save_my_recueil_section', { p_dossier_id: progress.dossier_id, p_section_code: current.code, p_payload: payloadToSave, p_completed: true });
    if (error) throw error;
    if (current.code === 'regulatory') {
      const { error: esgError } = await supabase.rpc('set_my_esg_opt_in', { p_dossier_id: progress.dossier_id, p_opt_in: form.esg_opt_in });
      if (esgError) throw esgError;
    }
    setDoneSections((state) => new Set([...state, current.code]));
  };

  const next = async () => {
    if (!progress) return;
    setBusy(true);
    setErrorMessage('');
    try {
      await saveCurrent();
      const nextIncomplete = sections.findIndex((section, index) => index !== step && !doneSections.has(section.code));
      if (nextIncomplete >= 0) { setStep(nextIncomplete); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      const { error } = await supabase.rpc('validate_my_recueil', { p_dossier_id: progress.dossier_id });
      if (error) throw error;
      const refreshed = await fetchPortalProgress();
      setRows(refreshed);
      navigate(dossierHref('/espace-client/profil-investisseur', progress.dossier_id));
    } catch (error) { setErrorMessage(messageFromError(error)); } finally { setBusy(false); }
  };

  useEffect(() => {
    if (!errorMessage) return;
    const timer = window.setTimeout(() => {
      document.getElementById('recueil-validation-alert')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [errorMessage]);

  const previous = () => {
    setErrorMessage('');
    if (!progress) return;
    if (step === 0) navigate(dossierHref('/espace-client', progress.dossier_id)); else { setStep(progress.role_dossier === 'investisseur_2' && step === 2 ? 0 : step - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };

  if (!progress) return <p className="text-sm text-slate-500">Chargement du dossier…</p>;
  if (progress.recueil_status === 'validated') return <div><JourneyProgress current="recueil" esgEnabled={progress.esg_opt_in !== false} /><PageIntro eyebrow="Étape 1" title="Recueil d’informations" description="Votre recueil a été validé et figé pour assurer la traçabilité du dossier." icon={<CheckCircle2 className="h-5 w-5" />} /><WizardCard className="p-8"><p className="font-semibold text-emerald-800">Recueil validé</p><button type="button" onClick={() => navigate(dossierHref('/espace-client/profil-investisseur', progress.dossier_id))} className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Continuer vers le profil investisseur</button></WizardCard></div>;

  const objectiveItems: AnyPayload[] = form.items ?? [];
  const toggleObjective = (code: string, label: string) => {
    const exists = objectiveItems.some((item) => item.code_objectif === code);
    const nextItems = exists
      ? objectiveItems.filter((item) => item.code_objectif !== code)
      : [...objectiveItems, { code_objectif: code, libelle_autre: '', horizon_annees: '', commentaire: '', label }];
    patchCurrent({ items: nextItems.map((item, index) => ({ ...item, priorite: index + 1 })) });
  };
  const updateObjective = (code: string, values: AnyPayload) => patchCurrent({ items: objectiveItems.map((item) => item.code_objectif === code ? { ...item, ...values } : item) });
  const moveObjective = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= objectiveItems.length) return;
    const nextItems = [...objectiveItems];
    [nextItems[index], nextItems[targetIndex]] = [nextItems[targetIndex], nextItems[index]];
    patchCurrent({ items: nextItems.map((item, itemIndex) => ({ ...item, priorite: itemIndex + 1 })) });
  };
  const updateList = (key: string, index: number, values: AnyPayload) => patchCurrent({ [key]: (form[key] ?? []).map((item: AnyPayload, i: number) => i === index ? { ...item, ...values } : item) });
  const removeList = (key: string, index: number) => patchCurrent({ [key]: (form[key] ?? []).filter((_: unknown, i: number) => i !== index) });

  return <div>
    <JourneyProgress current="recueil" esgEnabled={forms.regulatory.esg_opt_in !== false} substep={{ current: step + 1, total: sections.length, label: current.title }} sticky={false} />
    <PageIntro variant="recueil" eyebrow={`Étape 1 · Partie ${step + 1}/${sections.length}`} title={current.title} description={current.description} />
    <WizardCard>
      <div className="border-b border-white/10 px-6 py-4 sm:px-9"><div className="flex flex-wrap gap-2">{sections.map((section, index) => { const familyLocked = section.code === 'family' && progress.role_dossier === 'investisseur_2'; return <button key={section.code} type="button" disabled={familyLocked} title={familyLocked ? 'Informations communes gérées par l’Identifiant 1' : undefined} onClick={() => setStep(index)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60 ${index === step ? 'bg-[#3B82F6] text-white shadow-sm' : doneSections.has(section.code) ? 'bg-[#10B981] text-white shadow-sm' : 'bg-white/10 text-[#94A3B8] hover:bg-white/15 hover:text-[#F1F5F9]'}`}>{doneSections.has(section.code) ? '✓ ' : ''}{index + 1}. {section.label}</button>; })}</div></div>
      <div className="space-y-10 px-6 py-9 sm:px-9 sm:py-12">
        {current.code === 'identity' && <><div className="recueil-question-grid recueil-question-grid--3 grid gap-x-5 gap-y-7 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-8"><Field label="Civilité" required value={form.civilite} onChange={(v) => patchCurrent({ civilite: v })} /><Field label="Prénom" required value={form.prenom} onChange={(v) => patchCurrent({ prenom: v })} /><Field label="Nom" required value={form.nom} onChange={(v) => patchCurrent({ nom: v })} /><Field label="Nom de naissance" required={identityNeedsBirthName} value={form.nom_naissance} onChange={(v) => patchCurrent({ nom_naissance: v })} placeholder="Nom figurant sur votre acte de naissance" /><Field label="Date de naissance" required type="date" value={form.date_naissance} onChange={(v) => patchCurrent({ date_naissance: v })} /><Field label="Lieu de naissance" required value={form.lieu_naissance} onChange={(v) => patchCurrent({ lieu_naissance: v })} /><Field label="Pays de naissance" required value={form.pays_naissance} onChange={(v) => patchCurrent({ pays_naissance: v })} /><Field label="Nationalité" required value={form.nationalite} onChange={(v) => patchCurrent({ nationalite: v })} /><Field label="Mobile" required value={form.mobile} onChange={(v) => patchCurrent({ mobile: v })} placeholder="06 12 34 56 78 ou +33 6 12 34 56 78" />{accountEmail && <ReadOnlyField label="E-mail *" value={accountEmail} help="Adresse liée à votre accès sécurisé : elle est reprise automatiquement afin d’éviter une erreur de saisie." />}</div><div className="border-t border-slate-100 pt-7"><h3 className="font-semibold text-slate-900">Adresse fiscale</h3><div className="mt-4 recueil-question-grid recueil-question-grid--2 grid gap-x-5 gap-y-7 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-8"><Field label="N° et voie" required value={form.address?.numero_voie} onChange={(v) => patchCurrent({ address: { ...form.address, numero_voie: v } })} /><Field label="Complément" value={form.address?.complement} onChange={(v) => patchCurrent({ address: { ...form.address, complement: v } })} /><Field label="Code postal" required value={form.address?.code_postal} onChange={(v) => patchCurrent({ address: { ...form.address, code_postal: v } })} /><Field label="Ville" required value={form.address?.ville} onChange={(v) => patchCurrent({ address: { ...form.address, ville: v } })} /><Field label="Pays" required value={form.address?.pays} onChange={(v) => patchCurrent({ address: { ...form.address, pays: v } })} /><Field label="Type de logement" required value={form.address?.type_logement} onChange={(v) => patchCurrent({ address: { ...form.address, type_logement: v } })} /></div></div></>}

        {current.code === 'family' && <div className="recueil-question-grid recueil-question-grid--2 grid gap-x-5 gap-y-7 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-8"><Field label="Situation familiale" required value={form.situation} onChange={(v) => patchCurrent({ situation: v })} placeholder="Autre situation" />{familyNeedsEventDate && <MonthYearField label={familyEventLabel} required minYear={1900} value={String(form.date_evenement ?? '')} onChange={(v) => patchCurrent({ date_evenement: v })} />}<Field label="Régime / convention" required={familyNeedsConvention} value={form.regime_convention} onChange={(v) => patchCurrent({ regime_convention: v })} placeholder="Autre régime / convention" /><Field label="Avantage matrimonial" value={form.avantage_matrimonial} onChange={(v) => patchCurrent({ avantage_matrimonial: v })} /><Field label="Nombre d’enfants" required type="number" value={form.nombre_enfants} onChange={(v) => patchCurrent({ nombre_enfants: v })} /><Field label="Notaire + ville" value={form.notaire_nom_ville} onChange={(v) => patchCurrent({ notaire_nom_ville: v })} /><Field label="Expert-comptable + ville" value={form.expert_comptable_nom_ville} onChange={(v) => patchCurrent({ expert_comptable_nom_ville: v })} /><Field label="Évolution prévue" value={form.evolution_prevue} onChange={(v) => patchCurrent({ evolution_prevue: v })} /></div>}

        {current.code === 'professional' && <div className="recueil-question-grid recueil-question-grid--2 grid gap-x-5 gap-y-7 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-8"><Field label="Profession actuelle" required value={form.profession_actuelle} onChange={(v) => patchCurrent({ profession_actuelle: v })} /><Field label="Entreprise" required={professionalNeedsEmployer} value={form.societe} onChange={(v) => patchCurrent({ societe: v })} /><Field label="Secteur d’activité" required value={form.secteur_activite} onChange={(v) => patchCurrent({ secteur_activite: v })} /><Field label="Statut" required value={form.statut} onChange={(v) => patchCurrent({ statut: v })} placeholder="Autre statut" /><Field label="Catégorie socioprofessionnelle" value={form.categorie_socioprofessionnelle} onChange={(v) => patchCurrent({ categorie_socioprofessionnelle: v })} /><MonthYearField required={professionalNeedsEmployer} value={String(form.date_entree ?? '')} onChange={(v) => patchCurrent({ date_entree: v })} />{professionalNeedsIncomeOrigin && <Field label="Origine des revenus si sans activité" required value={form.origine_revenus_sans_activite} onChange={(v) => patchCurrent({ origine_revenus_sans_activite: v })} />}{professionalNeedsChangeQuestion && <BoolChoice label="Un changement professionnel est-il prévu dans les prochains mois ?" value={form.changement_professionnel_prevu} onChange={(v) => patchCurrent({ changement_professionnel_prevu: v, changement_professionnel_details: v ? form.changement_professionnel_details : '' })} />}{professionalNeedsChangeQuestion && form.changement_professionnel_prevu === true && <Field label="Quel changement professionnel est prévu ?" required value={form.changement_professionnel_details} onChange={(v) => patchCurrent({ changement_professionnel_details: v })} placeholder="Ex. changement d’entreprise, création d’activité, retraite, évolution de rémunération…" />}</div>}

        {current.code === 'objectives' && <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)]">
          <section aria-labelledby="available-objectives-title" className="min-w-0">
            <h3 id="available-objectives-title" className="text-lg font-semibold text-[#F1F5F9]">Tous les objectifs</h3>
            <p className="mt-1 text-sm leading-6 text-[#CBD5E1]">Cliquez sur un objectif pour l’ajouter à votre sélection. Cliquez de nouveau pour le retirer.</p>
            <div className="mt-5 space-y-6">{objectiveGroups.map((group) => <div key={group.title} className="border-b border-slate-400/50 pb-6 last:border-b-0 last:pb-0"><div><h4 className="text-sm font-semibold text-[#F1F5F9]">{group.title}</h4><p className="mt-0.5 text-xs leading-5 text-[#94A3B8]">{group.description}</p></div><div className="mt-3 grid gap-3 2xl:grid-cols-2">{group.codes.map((code) => { const label = objectiveLabelByCode[code]; const selected = objectiveItems.some((item) => item.code_objectif === code); return <button type="button" key={code} aria-pressed={selected} onClick={() => toggleObjective(code, label)} className={`min-h-14 rounded-xl border p-4 text-left text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 ${selected ? 'scale-[0.98] border-[#3B82F6] bg-[#3B82F6] text-white shadow-sm shadow-blue-950/20' : 'border-[#E2E8F0] bg-white text-slate-700 hover:-translate-y-0.5 hover:border-[#3B82F6] hover:shadow-md'}`}>{selected ? '✓ ' : ''}{label}</button>; })}</div></div>)}</div>
          </section>

          <section aria-labelledby="selected-objectives-title" className="min-w-0 rounded-2xl border border-white/10 bg-[#111C31] p-4 shadow-lg lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto sm:p-5">
            <div className="flex items-start justify-between gap-4"><div><h3 id="selected-objectives-title" className="text-lg font-semibold text-[#F1F5F9]">Objectifs retenus</h3><p className="mt-1 text-sm leading-6 text-[#CBD5E1]">Placez-les par importance et choisissez un horizon.</p></div><span className="shrink-0 rounded-full bg-[#3B82F6] px-3 py-1 text-xs font-semibold text-white">{objectiveItems.length}</span></div>
            {objectiveItems.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-slate-500/60 bg-white/5 px-4 py-6 text-center text-sm leading-6 text-[#94A3B8]">Aucun objectif sélectionné.<br />Choisissez-en un dans la colonne de gauche.</div> : <div className="mt-5 space-y-4">{objectiveItems.map((item, index) => {
              const code = item.code_objectif as ObjectiveCode;
              const label = item.label || objectiveLabelByCode[code] || item.code_objectif;
              return <div key={item.code_objectif} className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0b1f3a] text-sm font-bold text-white" aria-label={`Priorité ${index + 1}`}>{index + 1}</div>
                  <div className="min-w-0 flex-1"><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Priorité {index + 1}</p><p className="mt-0.5 text-sm font-semibold leading-5 text-slate-900">{label}</p></div>
                  <div className="flex shrink-0 gap-1.5">
                    <button type="button" disabled={index === 0} onClick={() => moveObjective(index, -1)} aria-label={`Monter ${label} dans les priorités`} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#F59E0B] bg-[#F59E0B] text-base font-bold text-white transition hover:border-[#D97706] hover:bg-[#D97706] disabled:cursor-not-allowed disabled:border-orange-200 disabled:bg-orange-100 disabled:text-orange-300">↑</button>
                    <button type="button" disabled={index === objectiveItems.length - 1} onClick={() => moveObjective(index, 1)} aria-label={`Descendre ${label} dans les priorités`} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#F59E0B] bg-[#F59E0B] text-base font-bold text-white transition hover:border-[#D97706] hover:bg-[#D97706] disabled:cursor-not-allowed disabled:border-orange-200 disabled:bg-orange-100 disabled:text-orange-300">↓</button>
                  </div>
                </div>
                {item.code_objectif === 'autre' && <div className="mt-4"><Field label="Précisez l’objectif" required value={item.libelle_autre} onChange={(v) => updateObjective(item.code_objectif, { libelle_autre: v })} /></div>}
                <div className="mt-4"><CompactHorizonField value={item.horizon_annees} onChange={(v) => updateObjective(item.code_objectif, { horizon_annees: v })} /></div>
                <details className="mt-4 rounded-xl border border-slate-300 bg-white px-3 py-3">
                  <summary className="cursor-pointer text-sm font-semibold leading-5 text-[#0B1F3A] [&::marker]:text-[#0B1F3A]">Ajouter une précision — facultatif</summary>
                  <div className="mt-4"><Field label="Précisions" value={item.commentaire} onChange={(v) => updateObjective(item.code_objectif, { commentaire: v })} placeholder="Contexte, contraintes ou résultat attendu…" /></div>
                </details>
                <button type="button" onClick={() => toggleObjective(code, label)} className="mt-3 text-xs font-semibold text-red-600 hover:text-red-700">Retirer cet objectif</button>
              </div>;
            })}</div>}
          </section>
        </div>}

        {current.code === 'capacity' && <div className="recueil-question-grid recueil-question-grid--2 grid gap-x-5 gap-y-7 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-8"><MoneyField label="À combien estimez-vous vos revenus professionnels pour l’année en cours ? (€)" required value={form.estimation_revenus_travail_annuels} onChange={(v) => patchCurrent({ estimation_revenus_travail_annuels: v })} /><MoneyField label="À combien estimez-vous vos revenus provenant de biens immobiliers pour l’année en cours ? (€)" required value={form.estimation_revenus_fonciers_annuels} onChange={(v) => patchCurrent({ estimation_revenus_fonciers_annuels: v })} /><MoneyField label="Quelle somme souhaitez-vous conserver disponible pour faire face aux imprévus ? (€)" required value={form.epargne_precaution_cible} onChange={(v) => patchCurrent({ epargne_precaution_cible: v })} /><MoneyField label="Combien pouvez-vous mettre de côté chaque mois sans déséquilibrer votre budget ? (€)" required value={form.capacite_epargne_mensuelle} onChange={(v) => patchCurrent({ capacite_epargne_mensuelle: v })} /><MoneyField label="Quelle somme pourriez-vous utiliser comme apport pour un projet immobilier ? (€)" value={form.apport_immobilier_possible} onChange={(v) => patchCurrent({ apport_immobilier_possible: v })} /></div>}

        {current.code === 'tax' && <><div className="recueil-question-grid recueil-question-grid--3 grid gap-x-5 gap-y-7 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-8"><Field label="Année d’imposition" required type="number" value={form.annee_imposition} onChange={(v) => patchCurrent({ annee_imposition: v })} /><MoneyField label="Revenu imposable (€)" required value={form.revenu_imposable} onChange={(v) => patchCurrent({ revenu_imposable: v })} /><MoneyField label="Revenu fiscal de référence (€)" required value={form.revenu_fiscal_reference} onChange={(v) => patchCurrent({ revenu_fiscal_reference: v })} /><Field label="Nombre de parts" required type="number" value={form.nombre_parts} onChange={(v) => patchCurrent({ nombre_parts: v })} /><Field label="TMI (%)" required type="number" value={form.tmi} onChange={(v) => patchCurrent({ tmi: v })} /><MoneyField label="Impôt sur le revenu net (€)" required value={form.impot_revenu_net} onChange={(v) => patchCurrent({ impot_revenu_net: v })} /><MoneyField label="Salaires / assimilés (€)" value={form.salaires_assimiles} onChange={(v) => patchCurrent({ salaires_assimiles: v })} /><MoneyField label="Revenus fonciers nets (€)" value={form.revenus_fonciers_nets} onChange={(v) => patchCurrent({ revenus_fonciers_nets: v })} /><MoneyField label="Déficit foncier reportable (€)" value={form.deficit_foncier_reportable} onChange={(v) => patchCurrent({ deficit_foncier_reportable: v })} /><MoneyField label="Plafond épargne retraite disponible (€)" value={form.plafond_disponible_avis} onChange={(v) => patchCurrent({ plafond_disponible_avis: v })} /><MoneyField label="Versements retraite à déduire (€)" value={form.versements_a_deduire} onChange={(v) => patchCurrent({ versements_a_deduire: v })} /></div><div className="border-t border-slate-100 pt-7"><BoolChoice label="Êtes-vous concerné par l’IFI ?" value={form.ifi_concerne} onChange={(v) => patchCurrent({ ifi_concerne: v })} />{form.ifi_concerne && <div className="mt-4 recueil-question-grid recueil-question-grid--3 grid gap-x-5 gap-y-7 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-8"><MoneyField label="Base imposable IFI (€)" required value={form.ifi_base_imposable} onChange={(v) => patchCurrent({ ifi_base_imposable: v })} /><Field label="TMI IFI (%)" type="number" value={form.ifi_tmi} onChange={(v) => patchCurrent({ ifi_tmi: v })} /><MoneyField label="IFI net à payer (€)" required value={form.ifi_net_a_payer} onChange={(v) => patchCurrent({ ifi_net_a_payer: v })} /></div>}</div></>}

        {current.code === 'regulatory' && <div className="recueil-regulatory">
          <GuidanceNote><p>Pourquoi ces questions ?</p><p>Elles permettent au cabinet d’identifier vos obligations fiscales internationales et d’effectuer les contrôles réglementaires obligatoires. Répondre « Oui » ne bloque pas votre dossier : des précisions pourront simplement être demandées.</p></GuidanceNote>
          <Field label="Pays de résidence fiscale" required value={form.pays_residence_fiscale} onChange={(v) => patchCurrent({ pays_residence_fiscale: v })} help="Le pays dans lequel vous êtes considéré comme résident fiscal et où vous déclarez habituellement l’ensemble de vos revenus. Si vous avez plusieurs résidences fiscales, indiquez tous les pays, séparés par une virgule." />
          <BoolChoice label="Êtes-vous citoyen américain ou résident fiscal américain ?" value={form.citoyen_ou_resident_us} onChange={(v) => patchCurrent({ citoyen_ou_resident_us: v, fatca_crs_concerne: v })} yesLabel="Oui, je suis concerné" help="Répondez Oui si vous avez la nationalité américaine, même en double nationalité, une carte verte (Green Card) ou si vous êtes fiscalement résident aux États-Unis. Cette question relève du dispositif FATCA." />
          {form.citoyen_ou_resident_us === true && <Field label="Numéro fiscal américain (TIN)" required value={form.code_tin} onChange={(v) => patchCurrent({ code_tin: v })} help="Le TIN est votre numéro d’identification fiscale américain. Pour un particulier, il correspond généralement au SSN ou, dans certains cas, à l’ITIN." />}
          <BoolChoice label="Faites-vous actuellement l’objet d’une sanction internationale ou d’une mesure de gel des avoirs ?" value={form.sanctions_declarees} onChange={(v) => patchCurrent({ sanctions_declarees: v, commentaire_lcbft: v ? form.commentaire_lcbft : '' })} yesLabel="Oui, je suis concerné" help="Répondez Oui uniquement si une autorité vous a notifié une sanction, une restriction financière ou un gel de vos fonds. Le fait d’avoir voyagé ou d’avoir des liens avec un pays concerné ne suffit pas. Le cabinet effectue également son propre contrôle." />
          {form.sanctions_declarees === true && <Field label="Mesure ou autorité concernée" required value={form.commentaire_lcbft} onChange={(v) => patchCurrent({ commentaire_lcbft: v })} placeholder="Ex. nature de la mesure, autorité, date…" />}
          <BoolChoice label="Êtes-vous, ou l’un de vos proches, une personne politiquement exposée (PPE) ?" value={form.ppe_declaree} onChange={(v) => patchCurrent({ ppe_declaree: v, ppe_personne_exposee: v ? form.ppe_personne_exposee : '', ppe_motif: v ? form.ppe_motif : '', ppe_pays_exercice: v ? form.ppe_pays_exercice : '', ppe_anciennete: v ? form.ppe_anciennete : '' })} yesLabel="Oui, moi ou un proche" help="Une PPE exerce, ou a cessé d’exercer depuis moins d’un an, une fonction publique importante : chef d’État, ministre, parlementaire, haut magistrat, officier général, dirigeant d’entreprise publique, responsable d’un parti politique ou d’une organisation internationale. Sont aussi concernés le conjoint ou partenaire, les enfants et leurs conjoints, les parents et certaines personnes étroitement associées." />
          {form.ppe_declaree === true && <div className="recueil-question-grid recueil-question-grid--2 grid gap-x-5 gap-y-7 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-8"><Field label="Personne concernée" required value={form.ppe_personne_exposee} onChange={(v) => patchCurrent({ ppe_personne_exposee: v })} placeholder="Vous-même ou nom du proche" /><Field label="Fonction exercée" required value={form.ppe_motif} onChange={(v) => patchCurrent({ ppe_motif: v })} placeholder="Ex. député, ambassadeur, dirigeant public…" /><Field label="Pays d’exercice" required value={form.ppe_pays_exercice} onChange={(v) => patchCurrent({ ppe_pays_exercice: v })} /><Field label="Période de la fonction" required value={form.ppe_anciennete} onChange={(v) => patchCurrent({ ppe_anciennete: v })} placeholder="Ex. depuis 2022 ou fin en mars 2026" /></div>}
          <BoolChoice label="Souhaitez-vous que vos placements prennent en compte des critères environnementaux, sociaux ou de gouvernance (ESG) ?" value={form.esg_opt_in} onChange={(v) => patchCurrent({ esg_opt_in: v })} yesLabel="Oui, je souhaite les préciser" help={<><strong>La durabilité désigne les critères ESG :</strong> <strong>environnement</strong> (climat, pollution, biodiversité), <strong>social</strong> (droits humains, travail, santé) et <strong>gouvernance</strong> (éthique, corruption, dirigeants). Aucune connaissance technique n’est nécessaire.</>} />
          <RecueilInfoNote title="Si vous choisissez « Oui »">Un questionnaire simple sur vos préférences de durabilité sera proposé après le profil investisseur. Il précisera vos priorités et vos éventuelles exclusions, sans modifier votre profil de risque.</RecueilInfoNote>
        </div>}

        {current.code === 'patrimony' && <div className="real-estate-section space-y-7 rounded-[24px] border border-[#dbe4ef] bg-[#f5f8fc] p-5 shadow-[0_24px_60px_-38px_rgba(11,31,58,0.55)] sm:p-7">
          <div className="real-estate-note flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-[#33465f]"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white"><CheckCircle2 className="h-4 w-4" /></span><p><strong className="text-[#0b1f3a]">Aucun justificatif immobilier n’est demandé ici.</strong><br /><span className="text-xs text-[#5b6b82]">Les prêts éventuels seront transmis plus tard dans la partie « Documents ».</span></p></div>
          <BoolChoice label="Détenez-vous un ou plusieurs biens immobiliers ?" value={form.has_real_estate ?? ''} onChange={(v) => {
            if (!v && (form.immobilier ?? []).length > 0 && !window.confirm('Vous avez déjà renseigné un ou plusieurs biens. Passer à « Non » supprimera ces informations. Confirmez-vous ?')) return;
            const existing = form.immobilier ?? [];
            patchCurrent({ has_real_estate: v, immobilier: v ? (existing.length > 0 ? existing : [emptyRealEstate()]) : [] });
          }} />
          {form.has_real_estate === false && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">Aucun bien immobilier déclaré. Vous pouvez continuer si cette situation est exacte.</div>}
          {form.has_real_estate === true && <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#3B82F6]">Déclaration rapide</p><h3 className="mt-1 text-lg font-semibold text-[#0b1f3a]">Vos biens immobiliers</h3><p className="mt-1 text-sm text-[#5b6b82]">Six réponses essentielles par bien. Les autres informations sont facultatives.</p></div><button type="button" onClick={() => patchCurrent({ immobilier: [...(form.immobilier ?? []), emptyRealEstate()] })} className="inline-flex items-center gap-2 rounded-xl bg-[#0b1f3a] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#0b1f3a]/15 transition hover:-translate-y-0.5 hover:bg-[#173967]"><Plus className="h-4 w-4" /> Ajouter un bien</button></div>
            {(form.immobilier ?? []).length === 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">Vous avez indiqué détenir un bien immobilier. Ajoutez au moins un bien pour poursuivre.</div>}
            {(form.immobilier ?? []).map((item: AnyPayload, index: number) => <div key={index} className="real-estate-card overflow-hidden rounded-[22px] border border-[#dbe4ef] bg-white text-slate-800 shadow-[0_18px_45px_-30px_rgba(11,31,58,0.45)]">
              <div className="real-estate-card-header flex items-center justify-between gap-4 border-b border-[#e7edf5] bg-gradient-to-r from-[#f8fbff] to-[#edf5ff] px-5 py-4 sm:px-6"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0b1f3a] text-white"><Building2 className="h-5 w-5" /></span><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#3B82F6]">Bien {index + 1}</p><h4 className="truncate text-base font-semibold text-[#0b1f3a]">{item.intitule || (item.type_bien || item.ville ? [item.type_bien, item.ville].filter(Boolean).join(' — ') : `Bien immobilier ${index + 1}`)}</h4></div></div><button type="button" aria-label={`Supprimer le bien ${index + 1}`} onClick={() => { if (window.confirm(`Supprimer définitivement le bien ${index + 1} ?`)) removeList('immobilier', index); }} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 transition hover:border-red-300 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div>
              <div className="p-5 sm:p-6">
              <div className="recueil-question-grid recueil-question-grid--2 grid gap-x-5 gap-y-7 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-8">
                <Field label="Propriétaire du bien" required options={propertyOwnerOptions} value={item.proprietaire} onChange={(v) => updateList('immobilier', index, { proprietaire: v, quote_part: v === 'Identifiant 1 et 2' ? (item.quote_part || '50') : item.mode_detention === 'En indivision' ? item.quote_part : '100' })} help={progress.is_couple && progress.role_dossier === 'investisseur_1' ? 'Les biens communs du couple sont saisis ici une seule fois par l’Identifiant 1.' : progress.is_couple ? 'Ajoutez uniquement vos biens personnels. Les biens communs ont déjà été saisis par l’Identifiant 1.' : 'Ce dossier concerne une seule personne.'} />
                <div><Field label="Type de bien" required value={item.type_bien} onChange={(v) => updateList('immobilier', index, { type_bien: v, type_bien_autre: v === 'Autre' ? item.type_bien_autre : '' })} />{item.type_bien === 'Autre' && <div className="mt-3"><Field label="Précisez le type de bien" required value={item.type_bien_autre} onChange={(v) => updateList('immobilier', index, { type_bien_autre: v })} /></div>}</div>
                <div><Field label="Usage" required value={item.usage} onChange={(v) => updateList('immobilier', index, { usage: v, usage_autre: v === 'Autre' ? item.usage_autre : '', loyer_annuel: v === 'Locatif' ? item.loyer_annuel : '' })} />{item.usage === 'Autre' && <div className="mt-3"><Field label="Précisez l’usage" required value={item.usage_autre} onChange={(v) => updateList('immobilier', index, { usage_autre: v })} /></div>}</div>
                <Field label="Ville" required value={item.ville} onChange={(v) => updateList('immobilier', index, { ville: v })} />
                <MoneyField label="Valeur estimée actuelle (€)" required value={item.valeur_actuelle} onChange={(v) => updateList('immobilier', index, { valeur_actuelle: v })} />
                <Field label="Projet concernant ce bien" required value={item.projet_bien ?? ''} onChange={(v) => updateList('immobilier', index, { projet_bien: v })} />
                {item.usage === 'Locatif' && <MoneyField label="Loyer annuel hors charges (€)" required value={item.loyer_annuel} onChange={(v) => updateList('immobilier', index, { loyer_annuel: v })} />}
              </div>
              <details className="real-estate-details group mt-7 overflow-hidden rounded-2xl border border-blue-200 bg-blue-50/70">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-sm font-semibold text-[#173967]"><span>Ajouter des précisions <span className="font-normal text-[#5b6b82]">(facultatif)</span></span><ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" /></summary>
                <div className="recueil-question-grid recueil-question-grid--2 grid gap-x-5 gap-y-7 border-t border-blue-200 bg-white/80 p-4 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-8 sm:p-5">
                  <div className="sm:col-span-2"><Field label="Nom personnalisé du bien" value={item.intitule ?? ''} onChange={(v) => updateList('immobilier', index, { intitule: v })} placeholder="Ex. Maison principale, Studio Lyon…" /></div>
                  <div><Field label="Comment ce bien est-il détenu ?" value={item.mode_detention || 'En direct'} onChange={(v) => updateList('immobilier', index, { mode_detention: v, mode_detention_autre: v === 'Autre' ? item.mode_detention_autre : '', quote_part: v === 'En indivision' || item.proprietaire === 'Identifiant 1 et 2' ? (item.quote_part || '50') : '100' })} />{item.mode_detention === 'Autre' && <div className="mt-3"><Field label="Précisez le mode de détention" required value={item.mode_detention_autre} onChange={(v) => updateList('immobilier', index, { mode_detention_autre: v })} /></div>}</div>
                  {(item.proprietaire === 'Identifiant 1 et 2' || item.mode_detention === 'En indivision') && <Field label={item.proprietaire === 'Identifiant 1 et 2' ? 'Quote-part de l’Identifiant 1 (%)' : 'Quote-part détenue (%)'} type="number" value={item.quote_part || '50'} onChange={(v) => updateList('immobilier', index, { quote_part: v })} placeholder="Ex. 50" />}
                  <Field label="Année d’acquisition" type="number" value={item.date_acquisition} onChange={(v) => updateList('immobilier', index, { date_acquisition: v })} placeholder="Ex. 2018" />
                  <MoneyField label="Prix d’acquisition (€)" value={item.prix_acquisition} onChange={(v) => updateList('immobilier', index, { prix_acquisition: v })} />
                  <label className="sm:col-span-2 text-sm font-semibold text-slate-700">Autres précisions<textarea value={item.commentaire ?? ''} onChange={(e) => updateList('immobilier', index, { commentaire: e.target.value })} rows={2} className="mt-2 w-full rounded-xl border border-[#CBD5E1] bg-white px-4 py-3 font-normal outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-500/30" placeholder="Ex. indivision particulière, démembrement, travaux ou contrainte spécifique…" /></label>
                </div>
              </details>
              </div>
            </div>)}
          </div>}
        </div>}

        {current.code === 'financial' && <div className="space-y-7">
          <GuidanceNote><p>Une déclaration rapide, sans ressaisie des relevés</p><p>Sélectionnez uniquement les grandes familles de comptes et placements. Les établissements, contrats et montants exacts seront repris à partir des justificatifs transmis ensuite.</p></GuidanceNote>
          <section>
            <h3 className="text-sm font-semibold text-slate-700">Quels comptes ou placements détenez-vous ? *</h3>
            <p className="mt-1.5 text-xs leading-5 text-[#94A3B8]">Plusieurs réponses sont possibles.</p>
            {progress.is_couple && <p className="mt-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">{progress.role_dossier === 'investisseur_1' ? 'Indiquez vos avoirs personnels ainsi que les comptes joints ou communs. Ils ne devront pas être déclarés une seconde fois par l’Identifiant 2.' : 'Indiquez uniquement vos avoirs personnels. Les comptes joints ou communs sont déclarés par l’Identifiant 1.'}</p>}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{financialCategoryOptions.map(([code, label]) => {
              const categories: string[] = Array.isArray(form.categories) ? form.categories : [];
              const selected = categories.includes(code);
              return <button key={code} type="button" aria-pressed={selected} onClick={() => {
                if (code === 'none') {
                  patchCurrent({ categories: selected ? [] : ['none'], total_band: '', other_details: '', completeness_confirmed: false });
                  return;
                }
                const withoutNone = categories.filter((item) => item !== 'none');
                const nextCategories = selected ? withoutNone.filter((item) => item !== code) : [...withoutNone, code];
                patchCurrent({ categories: nextCategories, other_details: code === 'other' && selected ? '' : form.other_details, completeness_confirmed: false });
              }} className={`min-h-14 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 ${selected ? 'scale-[0.98] border-[#3B82F6] bg-[#3B82F6] text-white shadow-sm shadow-blue-950/20' : 'border-[#E2E8F0] bg-white text-slate-700 hover:-translate-y-0.5 hover:border-[#3B82F6] hover:shadow-md'}`}>{selected ? '✓ ' : ''}{label}</button>;
            })}</div>
          </section>

          {(form.categories ?? []).includes('other') && <Field label="Précisez les autres placements" required value={form.other_details} onChange={(v) => patchCurrent({ other_details: v, completeness_confirmed: false })} placeholder="Ex. parts de société, cryptoactifs, actifs détenus à l’étranger…" />}

          {(form.categories ?? []).length > 0 && !(form.categories ?? []).includes('none') && <fieldset>
            <legend className="text-sm font-semibold text-slate-700">À combien estimez-vous l’ensemble de ces avoirs ? *</legend>
            <p className="mt-1.5 text-xs leading-5 text-[#94A3B8]">Une fourchette suffit. Additionnez les comptes personnels et, le cas échéant, les comptes joints déclarés ici.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{financialTotalBands.map(([code, label]) => <button key={code} type="button" aria-pressed={form.total_band === code} onClick={() => patchCurrent({ total_band: code, completeness_confirmed: false })} className={`min-h-12 rounded-xl border px-4 py-3 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 ${form.total_band === code ? 'scale-[0.98] border-[#3B82F6] bg-[#3B82F6] text-white shadow-sm shadow-blue-950/20' : 'border-[#E2E8F0] bg-white text-slate-700 hover:-translate-y-0.5 hover:border-[#3B82F6] hover:shadow-md'}`}>{label}</button>)}</div>
          </fieldset>}

          {(form.categories ?? []).includes('none') && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">Aucun compte ni placement déclaré. Vous pouvez continuer si cette situation est exacte.</div>}

          {(form.categories ?? []).length > 0 && <button type="button" aria-pressed={form.completeness_confirmed === true} onClick={() => patchCurrent({ completeness_confirmed: form.completeness_confirmed !== true })} className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left text-sm leading-6 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 ${form.completeness_confirmed === true ? 'border-emerald-400 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700 hover:border-[#3B82F6]'}`}><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${form.completeness_confirmed === true ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400 bg-white'}`}>{form.completeness_confirmed === true ? '✓' : ''}</span><span><strong>Je confirme que cette déclaration couvre l’ensemble de mes comptes et placements.</strong><br /><span className="text-xs text-slate-500">Les relevés permettront ensuite au cabinet de vérifier et compléter les montants.</span></span></button>}
        </div>}

        {current.code === 'credits' && <div><div className="flex items-center justify-between"><h3 className="font-semibold text-slate-900">Crédits en cours</h3><button type="button" onClick={() => patchCurrent({ items: [...(form.items ?? []), { type_credit: '', montant_initial: '', date_emprunt: '', date_echeance: '', mensualite: '', duree_mois: '', taux: '', taux_assurance: '', capital_restant_du: '', banque: '', type_pret: '', commentaire: '' }] })} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700"><Plus className="h-4 w-4" /> Ajouter un crédit</button></div>{(form.items ?? []).length === 0 && <p className="mt-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Aucun crédit déclaré. Vous pouvez continuer si cette situation est exacte.</p>}{(form.items ?? []).map((item: AnyPayload, index: number) => <div key={index} className="mt-4 rounded-2xl border border-slate-200 p-5"><div className="recueil-question-grid recueil-question-grid--2 grid gap-x-5 gap-y-7 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-8"><Field label="Type de crédit" required value={item.type_credit} onChange={(v) => updateList('items', index, { type_credit: v })} placeholder="Autre crédit" /><Field label="Banque" required value={item.banque} onChange={(v) => updateList('items', index, { banque: v })} /><MoneyField label="Montant initial (€)" required value={item.montant_initial} onChange={(v) => updateList('items', index, { montant_initial: v })} /><MoneyField label="Capital restant dû (€)" required value={item.capital_restant_du} onChange={(v) => updateList('items', index, { capital_restant_du: v })} /><MoneyField label="Mensualité (€)" required value={item.mensualite} onChange={(v) => updateList('items', index, { mensualite: v })} /><Field label="Durée (mois)" required type="number" value={item.duree_mois} onChange={(v) => updateList('items', index, { duree_mois: v })} /><Field label="Taux (%)" required type="number" value={item.taux} onChange={(v) => updateList('items', index, { taux: v })} /><Field label="Type de prêt" required value={item.type_pret} onChange={(v) => updateList('items', index, { type_pret: v })} placeholder="Autre type de prêt" /></div><button type="button" onClick={() => removeList('items', index)} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-red-600"><Trash2 className="h-3.5 w-3.5" /> Supprimer</button></div>)}</div>}

        {errorMessage && <div id="recueil-validation-alert" role="alert" tabIndex={-1} className="scroll-mt-28 rounded-2xl border border-amber-400/60 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-950 shadow-sm"><p className="font-semibold">À compléter avant de continuer</p><p className="mt-1">{errorMessage}</p></div>}
        {current.code === 'patrimony' ? <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs leading-5 text-[#CBD5E1]">Vos informations sont enregistrées de manière sécurisée.</div> : <RecueilInfoNote title="Enregistrement et traçabilité"><p>Les champs marqués * sont obligatoires. Les informations fiscales et les crédits seront renseignés à partir des justificatifs transmis en fin de parcours.</p><p className="mt-1.5 text-[#aebfd4]">Chaque partie est enregistrée et horodatée. Après validation finale, vos réponses sont figées afin de préserver la piste d’audit.</p></RecueilInfoNote>}
      </div>
      <div className="sticky bottom-0 z-20 flex items-center justify-between border-t border-white/10 bg-[#111C31]/95 px-6 py-5 shadow-[0_-10px_30px_rgba(2,8,23,0.18)] backdrop-blur sm:px-9"><button type="button" onClick={previous} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-[#3B82F6] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"><ChevronLeft className="h-4 w-4" /> Précédent</button><button type="button" onClick={() => void next()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[#3B82F6] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:translate-y-0 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : step === sections.length - 1 ? <CheckCircle2 className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}{step === sections.length - 1 ? 'Valider le recueil' : 'Enregistrer et continuer'}</button></div>
    </WizardCard>
  </div>;
}
