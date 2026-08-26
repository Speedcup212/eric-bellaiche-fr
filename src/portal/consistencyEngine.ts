export type ConsistencySeverity = 'blocking' | 'review' | 'info';

export type ConsistencyIssue = {
  code: string;
  severity: ConsistencySeverity;
  section: string;
  title: string;
  message: string;
  fields?: string[];
};

export type ConsistencySnapshot = {
  identity?: Record<string, unknown>;
  family?: Record<string, unknown>;
  professional?: Record<string, unknown>;
  capacity?: Record<string, unknown>;
  patrimony?: Record<string, unknown>;
  financial?: Record<string, unknown>;
  credits?: Record<string, unknown>;
  regulatory?: Record<string, unknown>;
  documents?: Record<string, unknown>;
  profile?: Record<string, unknown>;
  spouse?: Record<string, unknown> | null;
};

type Rule = (snapshot: ConsistencySnapshot) => ConsistencyIssue[];

const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const asString = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const asBoolean = (value: unknown): boolean | null => typeof value === 'boolean' ? value : null;
const asNumber = (value: unknown): number | null => {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const isCoupleSituation = (value: unknown) => ['marié', 'marie', 'pacsé', 'pacse', 'concubinage'].includes(asString(value).toLowerCase());
const isInactiveStatus = (value: unknown) => {
  const status = asString(value).toLowerCase();
  return status.includes('retrait') || status.includes('sans activité') || status.includes('sans activite') || status.includes('étudiant') || status.includes('etudiant');
};

const birthDateRule: Rule = ({ identity }) => {
  const date = asString(asRecord(identity).date_naissance);
  if (!date) return [];
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime()) || parsed <= new Date()) return [];
  return [{ code: 'IDENTITY_BIRTH_DATE_FUTURE', severity: 'blocking', section: 'identity', title: 'Date de naissance incohérente', message: 'La date de naissance est située dans le futur.', fields: ['identity.date_naissance'] }];
};

const coupleRule: Rule = ({ family, spouse }) => {
  if (!isCoupleSituation(asRecord(family).situation)) return [];
  const spouseRecord = asRecord(spouse);
  if (asString(spouseRecord.prenom) && asString(spouseRecord.nom)) return [];
  return [{ code: 'COUPLE_SPOUSE_MISSING', severity: 'blocking', section: 'family', title: 'Deuxième personne manquante', message: 'La situation familiale indique un couple mais la deuxième personne du dossier n’est pas suffisamment renseignée.', fields: ['family.situation', 'spouse.prenom', 'spouse.nom'] }];
};

const professionalRule: Rule = ({ professional }) => {
  const value = asRecord(professional);
  const issues: ConsistencyIssue[] = [];
  const status = asString(value.statut).toLowerCase();
  if (status.includes('retrait') && asBoolean(value.changement_professionnel_prevu) === true) {
    issues.push({ code: 'PRO_RETIRED_CHANGE_PLANNED', severity: 'review', section: 'professional', title: 'Changement professionnel à vérifier', message: 'Un changement professionnel est annoncé alors que le statut indiqué est retraité.', fields: ['professional.statut', 'professional.changement_professionnel_prevu'] });
  }
  if ((status.includes('sans activité') || status.includes('sans activite')) && !asString(value.origine_revenus_sans_activite)) {
    issues.push({ code: 'PRO_INACTIVE_INCOME_ORIGIN_MISSING', severity: 'review', section: 'professional', title: 'Origine des revenus à préciser', message: 'Le client est sans activité mais l’origine de ses revenus n’est pas renseignée.', fields: ['professional.statut', 'professional.origine_revenus_sans_activite'] });
  }
  return issues;
};

const savingsCapacityRule: Rule = ({ capacity, professional }) => {
  const values = asRecord(capacity);
  if (isInactiveStatus(asRecord(professional).statut)) return [];
  const annualIncome = asNumber(values.estimation_revenus_travail_annuels ?? values.revenus_travail);
  const monthlySavings = asNumber(values.capacite_epargne_mensuelle ?? values.capacite_epargne);
  if (!annualIncome || annualIncome <= 0 || monthlySavings === null) return [];
  const monthlyIncome = annualIncome / 12;
  if (monthlySavings <= monthlyIncome * 0.8) return [];
  return [{ code: 'CAPACITY_SAVINGS_VS_INCOME', severity: 'review', section: 'capacity', title: 'Capacité d’épargne élevée', message: 'La capacité d’épargne mensuelle représente plus de 80 % des revenus professionnels mensuels estimés. Cette donnée mérite une vérification.', fields: ['capacity.estimation_revenus_travail_annuels', 'capacity.capacite_epargne_mensuelle'] }];
};

const realEstateRule: Rule = ({ patrimony, capacity }) => {
  const values = asRecord(patrimony);
  const hasRealEstate = asBoolean(values.has_real_estate);
  const properties = asArray(values.immobilier).map(asRecord);
  const issues: ConsistencyIssue[] = [];
  if (hasRealEstate === true && properties.length === 0) {
    issues.push({ code: 'REAL_ESTATE_DECLARED_WITHOUT_ASSET', severity: 'blocking', section: 'patrimony', title: 'Bien immobilier manquant', message: 'Le client indique détenir de l’immobilier mais aucun bien n’est renseigné.', fields: ['patrimony.has_real_estate', 'patrimony.immobilier'] });
  }
  if (hasRealEstate === false && properties.length > 0) {
    issues.push({ code: 'REAL_ESTATE_ASSET_WITH_NEGATIVE_ANSWER', severity: 'blocking', section: 'patrimony', title: 'Déclaration immobilière contradictoire', message: 'Des biens immobiliers sont renseignés alors que le client indique ne pas en détenir.', fields: ['patrimony.has_real_estate', 'patrimony.immobilier'] });
  }
  const hasRental = properties.some((property) => asString(property.usage).toLowerCase().includes('locatif'));
  const rentalIncome = asNumber(asRecord(capacity).estimation_revenus_fonciers_annuels ?? asRecord(capacity).revenus_fonciers);
  if (hasRental && (rentalIncome === null || rentalIncome === 0)) {
    issues.push({ code: 'RENTAL_PROPERTY_WITHOUT_INCOME', severity: 'review', section: 'capacity', title: 'Revenus immobiliers à vérifier', message: 'Un bien locatif est déclaré mais aucun revenu provenant de biens immobiliers n’est renseigné.', fields: ['patrimony.immobilier', 'capacity.estimation_revenus_fonciers_annuels'] });
  }
  return issues;
};

const financialRule: Rule = ({ financial }) => {
  const value = asRecord(financial);
  const categories = asArray(value.categories).map(asString).filter(Boolean);
  const issues: ConsistencyIssue[] = [];
  if (categories.includes('none') && categories.length > 1) {
    issues.push({ code: 'FINANCIAL_NONE_WITH_OTHER_ASSETS', severity: 'blocking', section: 'financial', title: 'Placements contradictoires', message: '« Aucun placement » ne peut pas être sélectionné avec une autre catégorie de placement.', fields: ['financial.categories'] });
  }
  const currentAccounts = asNumber(value.current_accounts_amount);
  if (currentAccounts !== null && currentAccounts < 0) {
    issues.push({ code: 'FINANCIAL_NEGATIVE_CURRENT_ACCOUNTS', severity: 'blocking', section: 'financial', title: 'Montant de comptes courants invalide', message: 'Le montant disponible sur les comptes courants ne peut pas être négatif.', fields: ['financial.current_accounts_amount'] });
  }
  if (categories.includes('other') && !asString(value.other_details)) {
    issues.push({ code: 'FINANCIAL_OTHER_UNSPECIFIED', severity: 'review', section: 'financial', title: 'Autre placement à préciser', message: 'La catégorie « Autres placements » est sélectionnée sans précision.', fields: ['financial.categories', 'financial.other_details'] });
  }
  return issues;
};

const creditRule: Rule = ({ credits, patrimony }) => {
  const value = asRecord(credits);
  const hasCredits = asBoolean(value.has_credits);
  const items = asArray(value.items).map(asRecord);
  const issues: ConsistencyIssue[] = [];
  if (hasCredits === true && items.length === 0) {
    issues.push({ code: 'CREDIT_DECLARED_WITHOUT_ITEM', severity: 'blocking', section: 'credits', title: 'Crédit manquant', message: 'Le client indique avoir un ou plusieurs crédits mais aucun crédit n’est renseigné.', fields: ['credits.has_credits', 'credits.items'] });
  }
  if (hasCredits === false && items.length > 0) {
    issues.push({ code: 'CREDIT_ITEM_WITH_NEGATIVE_ANSWER', severity: 'blocking', section: 'credits', title: 'Déclaration de crédits contradictoire', message: 'Des crédits sont renseignés alors que le client indique ne pas avoir de crédit en cours.', fields: ['credits.has_credits', 'credits.items'] });
  }
  const hasProperties = asArray(asRecord(patrimony).immobilier).length > 0;
  if (!hasProperties && items.some((item) => asString(item.type_credit).toLowerCase().includes('immobilier'))) {
    issues.push({ code: 'MORTGAGE_WITHOUT_REAL_ESTATE', severity: 'review', section: 'credits', title: 'Crédit immobilier sans bien déclaré', message: 'Un crédit immobilier est renseigné mais aucun bien immobilier n’est présent dans le recueil.', fields: ['credits.items', 'patrimony.immobilier'] });
  }
  return issues;
};

const documentContextRule: Rule = ({ documents, patrimony, financial, credits }) => {
  const documentValues = asRecord(documents);
  const issues: ConsistencyIssue[] = [];
  const hasRealEstate = asBoolean(asRecord(patrimony).has_real_estate);
  const documentRealEstate = asBoolean(documentValues.has_real_estate);
  if (hasRealEstate !== null && documentRealEstate !== null && hasRealEstate !== documentRealEstate) {
    issues.push({ code: 'DOCUMENT_REAL_ESTATE_CONTEXT_MISMATCH', severity: 'review', section: 'documents', title: 'Contexte documentaire immobilier incohérent', message: 'Le contexte documentaire ne correspond pas à la déclaration immobilière du recueil.' });
  }
  const categories = asArray(asRecord(financial).categories).map(asString);
  const hasFinancialAssets = categories.some((category) => category && category !== 'none');
  const documentFinancial = asBoolean(documentValues.has_financial_assets);
  if (documentFinancial !== null && documentFinancial !== hasFinancialAssets) {
    issues.push({ code: 'DOCUMENT_FINANCIAL_CONTEXT_MISMATCH', severity: 'review', section: 'documents', title: 'Contexte documentaire financier incohérent', message: 'Le contexte documentaire ne correspond pas aux placements déclarés.' });
  }
  const hasCredits = asBoolean(asRecord(credits).has_credits);
  const documentCredits = asBoolean(documentValues.has_credits);
  if (hasCredits !== null && documentCredits !== null && hasCredits !== documentCredits) {
    issues.push({ code: 'DOCUMENT_CREDIT_CONTEXT_MISMATCH', severity: 'review', section: 'documents', title: 'Contexte documentaire crédits incohérent', message: 'Le contexte documentaire ne correspond pas aux crédits déclarés.' });
  }
  return issues;
};

export const consistencyRules: Rule[] = [
  birthDateRule,
  coupleRule,
  professionalRule,
  savingsCapacityRule,
  realEstateRule,
  financialRule,
  creditRule,
  documentContextRule,
];

export function evaluateConsistency(snapshot: ConsistencySnapshot): ConsistencyIssue[] {
  return consistencyRules.flatMap((rule) => rule(snapshot));
}

export function summarizeConsistency(issues: ConsistencyIssue[]) {
  return {
    total: issues.length,
    blocking: issues.filter((issue) => issue.severity === 'blocking').length,
    review: issues.filter((issue) => issue.severity === 'review').length,
    info: issues.filter((issue) => issue.severity === 'info').length,
    canFinalize: !issues.some((issue) => issue.severity === 'blocking'),
  };
}
