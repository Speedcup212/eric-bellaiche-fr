import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { JourneyProgress, PageIntro, SecureNote, WizardCard } from '../../portal/FintechJourney';
import { supabase } from '../../lib/supabase';
import { dossierHref, fetchPortalProgress, messageFromError, selectedProgress, type PortalProgress } from '../../portal/portalHelpers';

type AnyPayload = Record<string, any>;
type SectionCode = 'identity' | 'family' | 'professional' | 'objectives' | 'capacity' | 'tax' | 'regulatory' | 'patrimony' | 'credits';

const sections: Array<{ code: SectionCode; title: string; description: string }> = [
  { code: 'identity', title: 'Identité et coordonnées', description: 'Vérifiez vos informations personnelles, votre adresse fiscale et vos coordonnées.' },
  { code: 'family', title: 'Situation familiale', description: 'Renseignez votre situation de famille et les éléments utiles à l’organisation patrimoniale.' },
  { code: 'professional', title: 'Situation professionnelle', description: 'Votre activité et votre statut permettent d’apprécier la stabilité et l’origine de vos revenus.' },
  { code: 'objectives', title: 'Mes objectifs', description: 'Sélectionnez vos objectifs prioritaires et indiquez, pour chacun, un montant cible et un horizon.' },
  { code: 'capacity', title: 'Revenus et capacité financière', description: 'Précisez votre capacité d’épargne, votre épargne de précaution et les revenus estimés.' },
  { code: 'regulatory', title: 'Situation réglementaire', description: 'Résidence fiscale, FATCA/CRS, sanctions, PPE et choix de durabilité.' },
  { code: 'patrimony', title: 'Patrimoine immobilier et financier', description: 'Déclarez vos comptes courants, vos biens immobiliers et vos placements. Pour les liquidités, distinguez ce que vous détenez de ce que vous acceptez réellement de mobiliser.' },
];

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

const choiceFields: Record<string, { options: string[]; allowCustom?: boolean }> = {
  'Civilité': { options: ['Mr', 'Mme'] },
  'Type de logement': { options: ['Propriétaire', 'Locataire', 'Logé à titre gratuit'], allowCustom: true },
  'Situation familiale': { options: ['Célibataire', 'Marié', 'Pacsé', 'Concubinage', 'Divorcé', 'Séparé', 'Veuf / Veuve'], allowCustom: true },
  'Régime / convention': { options: ['Communauté réduite aux acquêts', 'Communauté universelle', 'Séparation de biens', 'Participation aux acquêts', 'PACS - séparation des patrimoines', 'PACS - indivision', 'Sans convention / non applicable'], allowCustom: true },
  'Statut': { options: ['CDI', 'CDD', 'Fonctionnaire', 'Indépendant / TNS', 'Chef d’entreprise', 'Retraité', 'Sans activité', 'Étudiant'], allowCustom: true },
  'Catégorie socioprofessionnelle': { options: ['Cadre', 'Profession intermédiaire', 'Employé', 'Ouvrier', 'Artisan / commerçant / chef d’entreprise', 'Profession libérale', 'Agriculteur', 'Retraité', 'Sans activité'], allowCustom: true },
  'Horizon (années)': { options: ['0', '3', '5', '10'] },
  'Titulaire / nature du compte': { options: ['Personnel', 'Compte joint / commun'], allowCustom: true },
  'Usage': { options: ['Résidence principale', 'Résidence secondaire', 'Locatif'], allowCustom: true },
  'Mode de détention': { options: ['Pleine propriété', 'Nue-propriété', 'Usufruit'], allowCustom: true },
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
  patrimony: { comptes_courants: [], immobilier: [], placements: [] },
  credits: { items: [] },
};

function Field({ label, value, onChange, type = 'text', required = false, placeholder = '' }: { label: string; value: any; onChange: (value: string) => void; type?: string; required?: boolean; placeholder?: string }) {
  const choice = choiceFields[label];
  if (choice) {
    const normalizedValue = value === null || value === undefined ? '' : String(value);
    const isCustomValue = normalizedValue !== '' && !choice.options.includes(normalizedValue);
    return <div className="text-sm font-semibold text-slate-700">
      <p>{label}{required && ' *'}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {choice.options.map((option) => <button key={option} type="button" onClick={() => onChange(option)} className={`rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition ${normalizedValue === option ? 'border-[#0b1f3a] bg-[#0b1f3a] text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-[#9fb3ca] hover:bg-blue-50/50'}`}>{option}</button>)}
      </div>
      {choice.allowCustom && <input type={type} value={isCustomValue ? normalizedValue : ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || 'Autre / précisez'} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal outline-none transition focus:border-slate-400 focus:bg-white" />}
    </div>;
  }
  return <label className="text-sm font-semibold text-slate-700">{label}{required && ' *'}<input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-400 focus:bg-white" /></label>;
}

function BoolChoice({ label, value, onChange, required = true }: { label: string; value: boolean | ''; onChange: (value: boolean) => void; required?: boolean }) {
  return <div><p className="text-sm font-semibold text-slate-700">{label}{required && ' *'}</p><div className="mt-2 grid grid-cols-2 gap-2">{[[true, 'Oui'], [false, 'Non']].map(([v, text]) => <button key={text as string} type="button" onClick={() => onChange(v as boolean)} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${value === v ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{text as string}</button>)}</div></div>;
}

function MoneyField(props: Omit<React.ComponentProps<typeof Field>, 'type'>) { return <Field {...props} type="number" />; }
function parseAmount(value: unknown): number { if (value === '' || value === null || value === undefined) return 0; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function formatAmount(value: number): string { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value); }
function isBlank(value: unknown): boolean { return value === null || value === undefined || String(value).trim() === ''; }

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
  const progress = useMemo(() => selectedProgress(rows, dossierId), [rows, dossierId]);
  const current = sections[step];
  const form = forms[current.code];
  const identityNeedsBirthName = String(forms.identity.civilite ?? '').trim().toLowerCase() === 'mme';
  const familySituation = String(forms.family.situation ?? '').toLowerCase();
  const familyNeedsConvention = familySituation.includes('mari') || familySituation.includes('pacs');
  const professionalStatus = String(forms.professional.statut ?? '').toLowerCase();
  const professionalIsInactive = professionalStatus.includes('retrait') || professionalStatus.includes('sans activité') || professionalStatus.includes('sans activite') || professionalStatus.includes('étudiant') || professionalStatus.includes('etudiant');
  const professionalNeedsEmployer = !professionalIsInactive;
  const professionalNeedsIncomeOrigin = professionalStatus.includes('sans activité') || professionalStatus.includes('sans activite');
  const professionalNeedsChangeQuestion = !professionalStatus.includes('retrait');

  const patch = (code: SectionCode, values: AnyPayload) => setForms((state) => ({ ...state, [code]: { ...state[code], ...values } }));
  const patchCurrent = (values: AnyPayload) => patch(current.code, values);

  useEffect(() => {
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
      if (identityNeedsBirthName && isBlank(form.nom_naissance)) throw new Error('Indiquez votre nom de naissance. Ce champ est obligatoire lorsque la civilité est Mme.');
      if ([form.address?.numero_voie, form.address?.code_postal, form.address?.ville, form.address?.pays, form.address?.type_logement].some(isBlank)) throw new Error('Complétez tous les champs obligatoires de votre adresse fiscale.');
    }
    if (current.code === 'family') {
      if (isBlank(form.situation) || isBlank(form.nombre_enfants)) throw new Error('Renseignez votre situation familiale et le nombre d’enfants.');
      if (familyNeedsConvention && (isBlank(form.date_evenement) || isBlank(form.regime_convention))) throw new Error('Pour une situation mariée ou pacsée, indiquez la date et le régime / la convention.');
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
        if (item.code_objectif !== 'retraite' && isBlank(item.montant_cible)) throw new Error('Indiquez un montant cible lorsque cet objectif nécessite un montant.');
        if (item.code_objectif === 'autre' && isBlank(item.libelle_autre)) throw new Error('Précisez votre autre objectif.');
      }
    }
    if (current.code === 'capacity') {
      if ([form.estimation_revenus_travail_annuels, form.estimation_revenus_fonciers_annuels, form.epargne_precaution_cible, form.capacite_epargne_mensuelle].some(isBlank)) throw new Error('Renseignez vos revenus estimés, votre épargne de précaution et votre capacité d’épargne. Indiquez 0 lorsqu’un montant est nul.');
    }
    if (current.code === 'tax') {
      if ([form.annee_imposition, form.revenu_imposable, form.revenu_fiscal_reference, form.nombre_parts, form.tmi, form.impot_revenu_net].some(isBlank)) throw new Error('Complétez les principales données fiscales obligatoires. Indiquez 0 lorsqu’un montant est nul.');
      if (form.ifi_concerne === true && [form.ifi_base_imposable, form.ifi_net_a_payer].some(isBlank)) throw new Error('Complétez la base imposable et l’IFI net à payer.');
    }
    if (current.code === 'regulatory') {
      if (isBlank(form.pays_residence_fiscale)) throw new Error('Indiquez votre pays de résidence fiscale.');
      for (const key of ['citoyen_ou_resident_us', 'sanctions_declarees', 'ppe_declaree', 'esg_opt_in']) if (form[key] === '') throw new Error('Répondez à toutes les questions réglementaires obligatoires.');
      if (form.citoyen_ou_resident_us === true && isBlank(form.code_tin)) throw new Error('Indiquez votre code TIN.');
      if (form.ppe_declaree === true && [form.ppe_personne_exposee, form.ppe_motif, form.ppe_pays_exercice, form.ppe_anciennete].some(isBlank)) throw new Error('Complétez toutes les informations relatives à la personne politiquement exposée.');
    }
    if (current.code === 'patrimony') {
      for (const account of form.comptes_courants ?? []) {
        const balance = parseAmount(account.solde_actuel);
        const mobilisable = parseAmount(account.montant_mobilisable);
        if ([account.banque, account.titulaire, account.solde_actuel, account.montant_mobilisable].some(isBlank)) throw new Error('Pour chaque compte courant, renseignez la banque, le titulaire, le solde et le montant mobilisable.');
        if (balance < 0 || mobilisable < 0) throw new Error('Les montants des comptes courants ne peuvent pas être négatifs.');
        if (mobilisable > balance) throw new Error('Le montant mobilisable ne peut pas dépasser le solde du compte courant.');
      }
      for (const item of form.immobilier ?? []) if ([item.libelle, item.adresse, item.valeur_actuelle, item.usage_bien, item.mode_detention].some(isBlank)) throw new Error('Complétez les informations obligatoires de chaque bien immobilier.');
      for (const item of form.placements ?? []) if ([item.type_contrat, item.organisme, item.montant_actuel, item.montant_reemploi_possible].some(isBlank)) throw new Error('Pour chaque placement, renseignez le type, l’organisme, le montant actuel et le montant mobilisable / de réemploi.');
    }
    if (current.code === 'credits') {
      for (const item of form.items ?? []) if ([item.type_credit, item.banque, item.montant_initial, item.capital_restant_du, item.mensualite, item.duree_mois, item.taux, item.type_pret].some(isBlank)) throw new Error('Complétez toutes les informations principales de chaque crédit.');
    }
  };

  const saveCurrent = async () => {
    if (!progress) return;
    validateSection();
    let payloadToSave = form;
    if (current.code === 'patrimony') {
      const placementsWithoutAccounts = (form.placements ?? []).filter((placement: AnyPayload) => String(placement.type_contrat ?? '').toLowerCase() !== 'compte courant');
      payloadToSave = { ...form, placements: [...placementsWithoutAccounts, ...(form.comptes_courants ?? []).map(accountToPlacement)] };
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
      if (step < sections.length - 1) { setStep(step + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      const { error } = await supabase.rpc('validate_my_recueil', { p_dossier_id: progress.dossier_id });
      if (error) throw error;
      const refreshed = await fetchPortalProgress();
      setRows(refreshed);
      navigate(dossierHref('/espace-client/profil-investisseur', progress.dossier_id));
    } catch (error) { setErrorMessage(messageFromError(error)); } finally { setBusy(false); }
  };

  const previous = () => {
    setErrorMessage('');
    if (!progress) return;
    if (step === 0) navigate(dossierHref('/espace-client', progress.dossier_id)); else { setStep(step - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };

  if (!progress) return <p className="text-sm text-slate-500">Chargement du dossier…</p>;
  if (progress.recueil_status === 'validated') return <div><JourneyProgress current="recueil" esgEnabled={progress.esg_opt_in !== false} /><PageIntro eyebrow="Étape 1" title="Recueil d’informations" description="Votre recueil a été validé et figé pour assurer la traçabilité du dossier." icon={<CheckCircle2 className="h-5 w-5" />} /><WizardCard className="p-8"><p className="font-semibold text-emerald-800">Recueil validé</p><button type="button" onClick={() => navigate(dossierHref('/espace-client/profil-investisseur', progress.dossier_id))} className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Continuer vers le profil investisseur</button></WizardCard></div>;

  const objectiveItems: AnyPayload[] = form.items ?? [];
  const toggleObjective = (code: string, label: string) => {
    const exists = objectiveItems.some((item) => item.code_objectif === code);
    patchCurrent({ items: exists ? objectiveItems.filter((item) => item.code_objectif !== code) : [...objectiveItems, { code_objectif: code, libelle_autre: '', montant_cible: '', horizon_annees: '', commentaire: '', label }] });
  };
  const updateObjective = (code: string, values: AnyPayload) => patchCurrent({ items: objectiveItems.map((item) => item.code_objectif === code ? { ...item, ...values } : item) });
  const updateList = (key: string, index: number, values: AnyPayload) => patchCurrent({ [key]: (form[key] ?? []).map((item: AnyPayload, i: number) => i === index ? { ...item, ...values } : item) });
  const removeList = (key: string, index: number) => patchCurrent({ [key]: (form[key] ?? []).filter((_: unknown, i: number) => i !== index) });

  const currentAccounts: AnyPayload[] = current.code === 'patrimony' ? (form.comptes_courants ?? []) : [];
  const totalCurrentAccounts = currentAccounts.reduce((sum, item) => sum + parseAmount(item.solde_actuel), 0);
  const totalMobilisable = currentAccounts.reduce((sum, item) => sum + parseAmount(item.montant_mobilisable), 0);
  const totalToKeep = Math.max(totalCurrentAccounts - totalMobilisable, 0);

  return <div>
    <JourneyProgress current="recueil" esgEnabled={forms.regulatory.esg_opt_in !== false} />
    <PageIntro eyebrow={`Étape 1 · Partie ${step + 1}/${sections.length}`} title={current.title} description={current.description} />
    <WizardCard>
      <div className="border-b border-slate-100 px-6 py-4 sm:px-9"><div className="flex flex-wrap gap-2">{sections.map((section, index) => <button key={section.code} type="button" onClick={() => setStep(index)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${index === step ? 'bg-slate-950 text-white' : doneSections.has(section.code) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{doneSections.has(section.code) ? '✓ ' : ''}{index + 1}</button>)}</div></div>
      <div className="space-y-6 px-6 py-7 sm:px-9 sm:py-9">
        {current.code === 'identity' && <><div className="grid gap-4 sm:grid-cols-3"><Field label="Civilité" required value={form.civilite} onChange={(v) => patchCurrent({ civilite: v })} /><Field label="Prénom" required value={form.prenom} onChange={(v) => patchCurrent({ prenom: v })} /><Field label="Nom" required value={form.nom} onChange={(v) => patchCurrent({ nom: v })} /><Field label="Nom de naissance" required={identityNeedsBirthName} value={form.nom_naissance} onChange={(v) => patchCurrent({ nom_naissance: v })} placeholder="Nom figurant sur votre acte de naissance" /><Field label="Date de naissance" required type="date" value={form.date_naissance} onChange={(v) => patchCurrent({ date_naissance: v })} /><Field label="Lieu de naissance" required value={form.lieu_naissance} onChange={(v) => patchCurrent({ lieu_naissance: v })} /><Field label="Pays de naissance" required value={form.pays_naissance} onChange={(v) => patchCurrent({ pays_naissance: v })} /><Field label="Nationalité" required value={form.nationalite} onChange={(v) => patchCurrent({ nationalite: v })} /><Field label="Mobile" required value={form.mobile} onChange={(v) => patchCurrent({ mobile: v })} /></div><div className="border-t border-slate-100 pt-5"><h3 className="font-semibold text-slate-900">Adresse fiscale</h3><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="N° et voie" required value={form.address?.numero_voie} onChange={(v) => patchCurrent({ address: { ...form.address, numero_voie: v } })} /><Field label="Complément" value={form.address?.complement} onChange={(v) => patchCurrent({ address: { ...form.address, complement: v } })} /><Field label="Code postal" required value={form.address?.code_postal} onChange={(v) => patchCurrent({ address: { ...form.address, code_postal: v } })} /><Field label="Ville" required value={form.address?.ville} onChange={(v) => patchCurrent({ address: { ...form.address, ville: v } })} /><Field label="Pays" required value={form.address?.pays} onChange={(v) => patchCurrent({ address: { ...form.address, pays: v } })} /><Field label="Type de logement" required value={form.address?.type_logement} onChange={(v) => patchCurrent({ address: { ...form.address, type_logement: v } })} /></div></div></>}

        {current.code === 'family' && <div className="grid gap-4 sm:grid-cols-2"><Field label="Situation familiale" required value={form.situation} onChange={(v) => patchCurrent({ situation: v })} placeholder="Autre situation" /><Field label="Date mariage / PACS / divorce" required={familyNeedsConvention} type="date" value={form.date_evenement} onChange={(v) => patchCurrent({ date_evenement: v })} /><Field label="Régime / convention" required={familyNeedsConvention} value={form.regime_convention} onChange={(v) => patchCurrent({ regime_convention: v })} placeholder="Autre régime / convention" /><Field label="Avantage matrimonial" value={form.avantage_matrimonial} onChange={(v) => patchCurrent({ avantage_matrimonial: v })} /><Field label="Nombre d’enfants" required type="number" value={form.nombre_enfants} onChange={(v) => patchCurrent({ nombre_enfants: v })} /><Field label="Notaire + ville" value={form.notaire_nom_ville} onChange={(v) => patchCurrent({ notaire_nom_ville: v })} /><Field label="Expert-comptable + ville" value={form.expert_comptable_nom_ville} onChange={(v) => patchCurrent({ expert_comptable_nom_ville: v })} /><Field label="Évolution prévue" value={form.evolution_prevue} onChange={(v) => patchCurrent({ evolution_prevue: v })} /></div>}

        {current.code === 'professional' && <div className="grid gap-4 sm:grid-cols-2"><Field label="Profession actuelle" required value={form.profession_actuelle} onChange={(v) => patchCurrent({ profession_actuelle: v })} /><Field label="Entreprise" required={professionalNeedsEmployer} value={form.societe} onChange={(v) => patchCurrent({ societe: v })} /><Field label="Secteur d’activité" required value={form.secteur_activite} onChange={(v) => patchCurrent({ secteur_activite: v })} /><Field label="Statut" required value={form.statut} onChange={(v) => patchCurrent({ statut: v })} placeholder="Autre statut" /><Field label="Catégorie socioprofessionnelle" value={form.categorie_socioprofessionnelle} onChange={(v) => patchCurrent({ categorie_socioprofessionnelle: v })} /><Field label="Date d’entrée dans l’entreprise : mois / année" required={professionalNeedsEmployer} type="month" value={String(form.date_entree ?? '').slice(0, 7)} onChange={(v) => patchCurrent({ date_entree: v ? `${v}-01` : '' })} />{professionalNeedsIncomeOrigin && <Field label="Origine des revenus si sans activité" required value={form.origine_revenus_sans_activite} onChange={(v) => patchCurrent({ origine_revenus_sans_activite: v })} />}{professionalNeedsChangeQuestion && <BoolChoice label="Un changement professionnel est-il prévu dans les prochains mois ?" value={form.changement_professionnel_prevu} onChange={(v) => patchCurrent({ changement_professionnel_prevu: v, changement_professionnel_details: v ? form.changement_professionnel_details : '' })} />}{professionalNeedsChangeQuestion && form.changement_professionnel_prevu === true && <Field label="Quel changement professionnel est prévu ?" required value={form.changement_professionnel_details} onChange={(v) => patchCurrent({ changement_professionnel_details: v })} placeholder="Ex. changement d’entreprise, création d’activité, retraite, évolution de rémunération…" />}</div>}

        {current.code === 'objectives' && <><div className="grid gap-3 sm:grid-cols-2">{objectiveOptions.map(([code, label]) => { const selected = objectiveItems.some((item) => item.code_objectif === code); return <button type="button" key={code} onClick={() => toggleObjective(code, label)} className={`rounded-xl border p-4 text-left text-sm font-semibold ${selected ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{selected ? '✓ ' : ''}{label}</button>; })}</div>{objectiveItems.map((item) => <div key={item.code_objectif} className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><p className="font-semibold text-slate-900">{item.label || objectiveOptions.find(([code]) => code === item.code_objectif)?.[1]}</p>{item.code_objectif === 'autre' && <div className="mt-4"><Field label="Précisez l’objectif" required value={item.libelle_autre} onChange={(v) => updateObjective(item.code_objectif, { libelle_autre: v })} /></div>}<div className="mt-4 grid gap-4 sm:grid-cols-2"><MoneyField label={item.code_objectif === 'retraite' ? 'Capital cible estimé (€) — facultatif' : 'Quel montant souhaitez-vous consacrer à cet objectif ? (€)'} required={item.code_objectif !== 'retraite'} value={item.montant_cible} onChange={(v) => updateObjective(item.code_objectif, { montant_cible: v })} /><Field label="Horizon (années)" required type="number" value={item.horizon_annees} onChange={(v) => updateObjective(item.code_objectif, { horizon_annees: v })} /></div><div className="mt-4"><Field label="Précisions" value={item.commentaire} onChange={(v) => updateObjective(item.code_objectif, { commentaire: v })} /></div></div>)}</>}

        {current.code === 'capacity' && <div className="grid gap-4 sm:grid-cols-2"><MoneyField label="À combien estimez-vous vos revenus professionnels pour l’année en cours ? (€)" required value={form.estimation_revenus_travail_annuels} onChange={(v) => patchCurrent({ estimation_revenus_travail_annuels: v })} /><MoneyField label="À combien estimez-vous vos revenus provenant de biens immobiliers pour l’année en cours ? (€)" required value={form.estimation_revenus_fonciers_annuels} onChange={(v) => patchCurrent({ estimation_revenus_fonciers_annuels: v })} /><MoneyField label="Quelle somme souhaitez-vous conserver disponible pour faire face aux imprévus ? (€)" required value={form.epargne_precaution_cible} onChange={(v) => patchCurrent({ epargne_precaution_cible: v })} /><MoneyField label="Combien pouvez-vous mettre de côté chaque mois sans déséquilibrer votre budget ? (€)" required value={form.capacite_epargne_mensuelle} onChange={(v) => patchCurrent({ capacite_epargne_mensuelle: v })} /><MoneyField label="Quelle somme pourriez-vous utiliser comme apport pour un projet immobilier ? (€)" value={form.apport_immobilier_possible} onChange={(v) => patchCurrent({ apport_immobilier_possible: v })} /></div>}

        {current.code === 'tax' && <><div className="grid gap-4 sm:grid-cols-3"><Field label="Année d’imposition" required type="number" value={form.annee_imposition} onChange={(v) => patchCurrent({ annee_imposition: v })} /><MoneyField label="Revenu imposable (€)" required value={form.revenu_imposable} onChange={(v) => patchCurrent({ revenu_imposable: v })} /><MoneyField label="Revenu fiscal de référence (€)" required value={form.revenu_fiscal_reference} onChange={(v) => patchCurrent({ revenu_fiscal_reference: v })} /><Field label="Nombre de parts" required type="number" value={form.nombre_parts} onChange={(v) => patchCurrent({ nombre_parts: v })} /><Field label="TMI (%)" required type="number" value={form.tmi} onChange={(v) => patchCurrent({ tmi: v })} /><MoneyField label="Impôt sur le revenu net (€)" required value={form.impot_revenu_net} onChange={(v) => patchCurrent({ impot_revenu_net: v })} /><MoneyField label="Salaires / assimilés (€)" value={form.salaires_assimiles} onChange={(v) => patchCurrent({ salaires_assimiles: v })} /><MoneyField label="Revenus fonciers nets (€)" value={form.revenus_fonciers_nets} onChange={(v) => patchCurrent({ revenus_fonciers_nets: v })} /><MoneyField label="Déficit foncier reportable (€)" value={form.deficit_foncier_reportable} onChange={(v) => patchCurrent({ deficit_foncier_reportable: v })} /><MoneyField label="Plafond épargne retraite disponible (€)" value={form.plafond_disponible_avis} onChange={(v) => patchCurrent({ plafond_disponible_avis: v })} /><MoneyField label="Versements retraite à déduire (€)" value={form.versements_a_deduire} onChange={(v) => patchCurrent({ versements_a_deduire: v })} /></div><div className="border-t border-slate-100 pt-5"><BoolChoice label="Êtes-vous concerné par l’IFI ?" value={form.ifi_concerne} onChange={(v) => patchCurrent({ ifi_concerne: v })} />{form.ifi_concerne && <div className="mt-4 grid gap-4 sm:grid-cols-3"><MoneyField label="Base imposable IFI (€)" required value={form.ifi_base_imposable} onChange={(v) => patchCurrent({ ifi_base_imposable: v })} /><Field label="TMI IFI (%)" type="number" value={form.ifi_tmi} onChange={(v) => patchCurrent({ ifi_tmi: v })} /><MoneyField label="IFI net à payer (€)" required value={form.ifi_net_a_payer} onChange={(v) => patchCurrent({ ifi_net_a_payer: v })} /></div>}</div></>}

        {current.code === 'regulatory' && <div className="space-y-5"><Field label="Pays de résidence fiscale" required value={form.pays_residence_fiscale} onChange={(v) => patchCurrent({ pays_residence_fiscale: v })} /><BoolChoice label="Êtes-vous citoyen américain ou résident fiscal américain ?" value={form.citoyen_ou_resident_us} onChange={(v) => patchCurrent({ citoyen_ou_resident_us: v, fatca_crs_concerne: v })} />{form.citoyen_ou_resident_us === true && <Field label="Code TIN" required value={form.code_tin} onChange={(v) => patchCurrent({ code_tin: v })} />}<BoolChoice label="Êtes-vous la cible de sanctions internationales ?" value={form.sanctions_declarees} onChange={(v) => patchCurrent({ sanctions_declarees: v })} /><BoolChoice label="Êtes-vous une personne politiquement exposée (PPE) ?" value={form.ppe_declaree} onChange={(v) => patchCurrent({ ppe_declaree: v })} />{form.ppe_declaree === true && <div className="grid gap-4 sm:grid-cols-2"><Field label="Personne exposée" required value={form.ppe_personne_exposee} onChange={(v) => patchCurrent({ ppe_personne_exposee: v })} /><Field label="Motif / fonction" required value={form.ppe_motif} onChange={(v) => patchCurrent({ ppe_motif: v })} /><Field label="Pays d’exercice" required value={form.ppe_pays_exercice} onChange={(v) => patchCurrent({ ppe_pays_exercice: v })} /><Field label="Ancienneté" required value={form.ppe_anciennete} onChange={(v) => patchCurrent({ ppe_anciennete: v })} /></div>}<BoolChoice label="Souhaitez-vous exprimer des préférences de durabilité ?" value={form.esg_opt_in} onChange={(v) => patchCurrent({ esg_opt_in: v })} /><SecureNote>Si vous répondez Oui, le questionnaire détaillé de préférences de durabilité sera proposé après le profil investisseur.</SecureNote></div>}

        {current.code === 'patrimony' && <div className="space-y-8">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold text-[#0b1f3a]">Comptes courants et trésorerie disponible</h3><p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">Indiquez le solde réellement disponible sur vos comptes courants, puis la part que vous acceptez de mobiliser pour vos projets. Le solde total n’est pas considéré automatiquement comme investissable.</p></div><button type="button" onClick={() => patchCurrent({ comptes_courants: [...currentAccounts, { banque: '', titulaire: '', solde_actuel: '', montant_mobilisable: '', commentaire: '' }] })} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[#173967]"><Plus className="h-4 w-4" /> Ajouter un compte</button></div>{currentAccounts.length === 0 && <p className="mt-4 text-sm text-slate-500">Aucun compte courant déclaré.</p>}{currentAccounts.map((item: AnyPayload, index: number) => { const balance = parseAmount(item.solde_actuel); const mobilisable = parseAmount(item.montant_mobilisable); const keep = Math.max(balance - mobilisable, 0); const invalidMobilisable = item.montant_mobilisable !== '' && item.solde_actuel !== '' && mobilisable > balance; return <div key={index} className="mt-4 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm"><div className="grid gap-4 sm:grid-cols-2"><Field label="Établissement bancaire" required value={item.banque} onChange={(v) => updateList('comptes_courants', index, { banque: v })} /><Field label="Titulaire / nature du compte" required value={item.titulaire} onChange={(v) => updateList('comptes_courants', index, { titulaire: v })} placeholder="Précisez si nécessaire" /><MoneyField label="Solde actuel (€)" required value={item.solde_actuel} onChange={(v) => updateList('comptes_courants', index, { solde_actuel: v })} /><MoneyField label="Montant que vous acceptez de mobiliser (€)" required value={item.montant_mobilisable} onChange={(v) => updateList('comptes_courants', index, { montant_mobilisable: v })} /></div><div className={`mt-4 rounded-xl px-4 py-3 text-sm ${invalidMobilisable ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-700'}`}>{invalidMobilisable ? 'Le montant mobilisable ne peut pas dépasser le solde du compte.' : <>Montant conservé sur ce compte après mobilisation : <strong>{formatAmount(keep)}</strong></>}</div><div className="mt-4"><Field label="Notes / précisions" value={item.commentaire} onChange={(v) => updateList('comptes_courants', index, { commentaire: v })} placeholder="Ex. somme réservée aux dépenses courantes, compte joint…" /></div><button type="button" onClick={() => removeList('comptes_courants', index)} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-red-600"><Trash2 className="h-3.5 w-3.5" /> Supprimer</button></div>; })}{currentAccounts.length > 0 && <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Soldes déclarés</p><p className="mt-1 text-lg font-semibold text-[#0b1f3a]">{formatAmount(totalCurrentAccounts)}</p></div><div className="rounded-xl bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Montant mobilisable</p><p className="mt-1 text-lg font-semibold text-[#0b1f3a]">{formatAmount(totalMobilisable)}</p></div><div className="rounded-xl bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Montant à conserver</p><p className="mt-1 text-lg font-semibold text-[#0b1f3a]">{formatAmount(totalToKeep)}</p></div></div>}</div>

          <div><div className="flex items-center justify-between"><h3 className="font-semibold text-slate-900">Patrimoine immobilier</h3><button type="button" onClick={() => patchCurrent({ immobilier: [...(form.immobilier ?? []), { libelle: '', adresse: '', valeur_acquisition: '', valeur_actuelle: '', date_acquisition: '', dispositif_fiscal: '', loyer_hors_charges_mensuel: '', mode_detention: '', quote_part: '', usage_bien: '', commentaire: '' }] })} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700"><Plus className="h-4 w-4" /> Ajouter</button></div>{(form.immobilier ?? []).length === 0 && <p className="mt-3 text-sm text-slate-500">Aucun bien déclaré.</p>}{(form.immobilier ?? []).map((item: AnyPayload, index: number) => <div key={index} className="mt-4 rounded-2xl border border-slate-200 p-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Type / libellé" required value={item.libelle} onChange={(v) => updateList('immobilier', index, { libelle: v })} /><Field label="Adresse" required value={item.adresse} onChange={(v) => updateList('immobilier', index, { adresse: v })} /><MoneyField label="Valeur actuelle (€)" required value={item.valeur_actuelle} onChange={(v) => updateList('immobilier', index, { valeur_actuelle: v })} /><MoneyField label="Valeur d’acquisition (€)" value={item.valeur_acquisition} onChange={(v) => updateList('immobilier', index, { valeur_acquisition: v })} /><Field label="Usage" required value={item.usage_bien} onChange={(v) => updateList('immobilier', index, { usage_bien: v })} /><Field label="Mode de détention" required value={item.mode_detention} onChange={(v) => updateList('immobilier', index, { mode_detention: v })} /><MoneyField label="Loyer mensuel HC (€)" value={item.loyer_hors_charges_mensuel} onChange={(v) => updateList('immobilier', index, { loyer_hors_charges_mensuel: v })} /></div><button type="button" onClick={() => removeList('immobilier', index)} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-red-600"><Trash2 className="h-3.5 w-3.5" /> Supprimer</button></div>)}</div>

          <div><div className="flex items-center justify-between"><h3 className="font-semibold text-slate-900">Placements financiers</h3><button type="button" onClick={() => patchCurrent({ placements: [...(form.placements ?? []), { type_contrat: '', organisme: '', libelle_contrat: '', montant_actuel: '', annee_ouverture: '', versements_programmes_annuels: '', montant_reemploi_possible: '', numero_contrat: '', montant_investi_avant_70_ans: '', montant_investi_apres_70_ans: '' }] })} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700"><Plus className="h-4 w-4" /> Ajouter</button></div><p className="mt-1.5 text-sm leading-6 text-slate-500">Livrets, PEA, assurance-vie, PER et autres placements. Les comptes courants sont renseignés séparément ci-dessus.</p>{(form.placements ?? []).length === 0 && <p className="mt-3 text-sm text-slate-500">Aucun placement déclaré.</p>}{(form.placements ?? []).map((item: AnyPayload, index: number) => <div key={index} className="mt-4 rounded-2xl border border-slate-200 p-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Type de contrat" required value={item.type_contrat} onChange={(v) => updateList('placements', index, { type_contrat: v })} placeholder="Autre placement" /><Field label="Organisme" required value={item.organisme} onChange={(v) => updateList('placements', index, { organisme: v })} /><MoneyField label="Montant actuel (€)" required value={item.montant_actuel} onChange={(v) => updateList('placements', index, { montant_actuel: v })} /><Field label="Année d’ouverture" type="number" value={item.annee_ouverture} onChange={(v) => updateList('placements', index, { annee_ouverture: v })} /><MoneyField label="Versements programmés annuels (€)" value={item.versements_programmes_annuels} onChange={(v) => updateList('placements', index, { versements_programmes_annuels: v })} /><MoneyField label="Montant de réemploi possible (€)" required value={item.montant_reemploi_possible} onChange={(v) => updateList('placements', index, { montant_reemploi_possible: v })} /></div><button type="button" onClick={() => removeList('placements', index)} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-red-600"><Trash2 className="h-3.5 w-3.5" /> Supprimer</button></div>)}</div>
        </div>}

        {current.code === 'credits' && <div><div className="flex items-center justify-between"><h3 className="font-semibold text-slate-900">Crédits en cours</h3><button type="button" onClick={() => patchCurrent({ items: [...(form.items ?? []), { type_credit: '', montant_initial: '', date_emprunt: '', date_echeance: '', mensualite: '', duree_mois: '', taux: '', taux_assurance: '', capital_restant_du: '', banque: '', type_pret: '', commentaire: '' }] })} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700"><Plus className="h-4 w-4" /> Ajouter un crédit</button></div>{(form.items ?? []).length === 0 && <p className="mt-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Aucun crédit déclaré. Vous pouvez continuer si cette situation est exacte.</p>}{(form.items ?? []).map((item: AnyPayload, index: number) => <div key={index} className="mt-4 rounded-2xl border border-slate-200 p-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Type de crédit" required value={item.type_credit} onChange={(v) => updateList('items', index, { type_credit: v })} placeholder="Autre crédit" /><Field label="Banque" required value={item.banque} onChange={(v) => updateList('items', index, { banque: v })} /><MoneyField label="Montant initial (€)" required value={item.montant_initial} onChange={(v) => updateList('items', index, { montant_initial: v })} /><MoneyField label="Capital restant dû (€)" required value={item.capital_restant_du} onChange={(v) => updateList('items', index, { capital_restant_du: v })} /><MoneyField label="Mensualité (€)" required value={item.mensualite} onChange={(v) => updateList('items', index, { mensualite: v })} /><Field label="Durée (mois)" required type="number" value={item.duree_mois} onChange={(v) => updateList('items', index, { duree_mois: v })} /><Field label="Taux (%)" required type="number" value={item.taux} onChange={(v) => updateList('items', index, { taux: v })} /><Field label="Type de prêt" required value={item.type_pret} onChange={(v) => updateList('items', index, { type_pret: v })} placeholder="Autre type de prêt" /></div><button type="button" onClick={() => removeList('items', index)} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-red-600"><Trash2 className="h-3.5 w-3.5" /> Supprimer</button></div>)}</div>}

        {errorMessage && <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>}
        <SecureNote>Les champs marqués * sont obligatoires. Les informations fiscales et les crédits ne vous sont pas demandés ici : ils seront renseignés à partir des justificatifs transmis en fin de parcours. Chaque partie est enregistrée et horodatée. Après validation finale du recueil, vos réponses sont figées pour préserver la piste d’audit.</SecureNote>
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-5 sm:px-9"><button type="button" onClick={previous} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"><ChevronLeft className="h-4 w-4" /> Précédent</button><button type="button" onClick={() => void next()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : step === sections.length - 1 ? <CheckCircle2 className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}{step === sections.length - 1 ? 'Valider le recueil' : 'Enregistrer et continuer'}</button></div>
    </WizardCard>
  </div>;
}
