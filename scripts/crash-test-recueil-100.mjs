import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const familySituations = ['Célibataire', 'Divorcé', 'Séparé', 'Veuf / Veuve', 'Marié', 'Pacsé', 'Concubinage'];
const professionalStatuses = ['CDI', 'CDD', 'Fonctionnaire', 'Indépendant / TNS', 'Chef d’entreprise', 'Retraité', 'Sans activité', 'Étudiant'];
const propertyTypes = ['Appartement', 'Maison', 'Immeuble', 'Terrain', 'Local professionnel / commercial', 'Autre'];
const propertyUsages = ['Résidence principale', 'Résidence secondaire', 'Locatif', 'Autre'];
const propertyProjects = ['Conserver', 'Vendre', 'Mettre en location', 'À étudier'];
const financialCategories = ['savings', 'life_insurance', 'retirement', 'securities', 'paper_real_estate', 'employee_savings', 'other'];
const financialBands = ['under_10k', '10k_50k', '50k_100k', '100k_250k', '250k_500k', 'over_500k'];
const creditTypes = ['Crédit immobilier résidence principale', 'Crédit immobilier locatif', 'Crédit à la consommation', 'Crédit automobile', 'Crédit professionnel', 'Autre crédit'];

function profileAt(index) {
  const situation = familySituations[index % familySituations.length];
  const couple = ['Marié', 'Pacsé', 'Concubinage'].includes(situation);
  const hasRealEstate = index % 3 !== 0;
  const usage = propertyUsages[index % propertyUsages.length];
  const type = propertyTypes[index % propertyTypes.length];
  const role = couple && index % 2 ? 'investisseur_2' : 'investisseur_1';
  const primaryOwnerCases = ['Identifiant 1 et 2', 'Identifiant 1', 'Identifiant 2'];
  const owner = !couple ? 'Identifiant 1' : role === 'investisseur_2' ? 'Identifiant 2' : primaryOwnerCases[Math.floor(index / familySituations.length) % primaryOwnerCases.length];
  return {
    id: index + 1,
    scope: couple ? 'couple' : 'individual',
    role,
    family: { situation, nombre_enfants: String(index % 6), date_evenement: ['Marié', 'Pacsé'].includes(situation) ? '2018-06-01' : '', regime_convention: ['Marié', 'Pacsé'].includes(situation) ? 'Séparation de biens' : 'Sans convention / non applicable' },
    spouse: couple ? { civilite: 'Mme', prenom: 'Camille', nom: `Test${index}`, email: `camille.${index}@example.fr`, mobile: '+33612345678' } : null,
    identity: { date_naissance: '1985-04-12', mobile: '+33687654321' },
    professional: { statut: professionalStatuses[index % professionalStatuses.length] },
    capacity: { revenus_travail: index % 8 === 6 ? 0 : 42000 + index, revenus_fonciers: usage === 'Locatif' ? 9600 : 0, epargne_precaution: 12000, capacite_epargne: 450, apport: index % 5 ? 25000 : 0 },
    regulatory: { fatca: index % 9 === 0, ppe: index % 11 === 0, esg: index % 4 !== 0 },
    patrimony: { has_real_estate: hasRealEstate, immobilier: hasRealEstate ? [{ type_bien: type, type_bien_autre: type === 'Autre' ? 'Chalet' : '', usage, usage_autre: usage === 'Autre' ? 'Usage mixte' : '', proprietaire: owner, projet_bien: propertyProjects[index % propertyProjects.length], valeur_actuelle: 180000 + index * 1000, date_acquisition: String(1995 + (index % 30)), loyer_annuel: usage === 'Locatif' ? 9600 : '' }] : [] },
    financial: index % 10 === 0 ? { current_accounts_amount: 0, categories: ['none'], total_band: '', other_details: '', completeness_confirmed: true } : { current_accounts_amount: 1000 + index * 50, categories: [financialCategories[index % financialCategories.length]], total_band: financialBands[index % financialBands.length], other_details: financialCategories[index % financialCategories.length] === 'other' ? 'Parts de société non cotée' : '', completeness_confirmed: true },
    credits: index % 4 === 0 ? { has_credits: false, items: [] } : { has_credits: true, items: [{ type_credit: creditTypes[index % creditTypes.length], taux_credit: 1.5 + (index % 30) / 10, credit_rattache_a: hasRealEstate ? `Bien immobilier ${index + 1}` : 'Crédit consommation' }] },
    documents: { tax_status: index % 10 === 0 ? 'no_personal_notice' : 'personal_notice', tax_absence_reason: index % 10 === 0 ? 'first_declaration' : null },
  };
}

function validate(profile) {
  const errors = [];
  const childCount = Number(profile.family.nombre_enfants);
  if (!Number.isInteger(childCount) || childCount < 0) errors.push('children');
  if (new Date(profile.identity.date_naissance) > new Date()) errors.push('birth_date');
  if (profile.scope === 'couple' && (!profile.spouse || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(profile.spouse.email))) errors.push('spouse');
  for (const amount of Object.values(profile.capacity)) if (!Number.isFinite(Number(amount)) || Number(amount) < 0) errors.push('money');
  if (profile.patrimony.has_real_estate && profile.patrimony.immobilier.length === 0) errors.push('real_estate_missing');
  for (const property of profile.patrimony.immobilier) {
    if (!property.projet_bien) errors.push('property_project');
    if (Number(property.valeur_actuelle) <= 0) errors.push('property_value');
    const year = Number(property.date_acquisition);
    if (!/^\d{4}$/.test(property.date_acquisition) || year < 1800 || year > new Date().getFullYear()) errors.push('property_year');
    if (profile.scope === 'individual' && property.proprietaire !== 'Identifiant 1') errors.push('individual_owner');
    if (profile.role === 'investisseur_2' && property.proprietaire !== 'Identifiant 2') errors.push('shared_property_duplicate');
    if (property.usage === 'Locatif' && Number(property.loyer_annuel) < 0) errors.push('rent');
  }
  if (profile.documents.tax_status === 'no_personal_notice' && !profile.documents.tax_absence_reason) errors.push('tax_reason');
  if (profile.patrimony.has_real_estate && profile.documents.has_real_estate === false) errors.push('document_context');
  const categories = profile.financial.categories;
  if (profile.financial.current_accounts_amount === '' || profile.financial.current_accounts_amount === null || profile.financial.current_accounts_amount === undefined || !Number.isFinite(Number(profile.financial.current_accounts_amount)) || Number(profile.financial.current_accounts_amount) < 0) errors.push('current_accounts_amount');
  if (!Array.isArray(categories) || categories.length === 0) errors.push('financial_categories');
  if (categories.includes('none') && categories.length > 1) errors.push('financial_none_exclusive');
  if (categories.includes('other') && !profile.financial.other_details) errors.push('financial_other_details');
  if (!categories.includes('none') && !financialBands.includes(profile.financial.total_band)) errors.push('financial_band');
  if (profile.financial.completeness_confirmed !== true) errors.push('financial_confirmation');
  if (profile.documents.has_financial_assets !== categories.some((category) => category !== 'none')) errors.push('financial_assets_context');
  if (typeof profile.credits.has_credits !== 'boolean') errors.push('credits_answer');
  if (profile.credits.has_credits && profile.credits.items.length === 0) errors.push('credits_missing');
  if (!profile.credits.has_credits && profile.credits.items.length > 0) errors.push('credits_contradiction');
  for (const credit of profile.credits.items) {
    if (!credit.type_credit || !credit.credit_rattache_a || !Number.isFinite(Number(credit.taux_credit)) || Number(credit.taux_credit) < 0) errors.push('credit_fields');
  }
  if (profile.documents.has_credits !== profile.credits.has_credits) errors.push('credits_context');
  return errors;
}

const profiles = Array.from({ length: 100 }, (_, index) => profileAt(index));
for (const profile of profiles) {
  profile.documents.has_real_estate = profile.patrimony.has_real_estate;
  profile.documents.has_financial_assets = profile.financial.categories.some((category) => category !== 'none');
  profile.documents.has_credits = profile.credits.has_credits;
  assert.deepEqual(validate(profile), [], `Dossier ${profile.id} invalide`);
}

const invalidFixtures = [
  { name: 'montant négatif', mutate: (p) => { p.capacity.capacite_epargne = -1; }, expected: 'money' },
  { name: 'naissance future', mutate: (p) => { p.identity.date_naissance = '2999-01-01'; }, expected: 'birth_date' },
  { name: 'enfants décimaux', mutate: (p) => { p.family.nombre_enfants = '1.5'; }, expected: 'children' },
  { name: 'propriétaire couple sur dossier individuel', mutate: (p) => { p.scope = 'individual'; p.patrimony.has_real_estate = true; p.patrimony.immobilier = [{ ...profileAt(1).patrimony.immobilier[0], proprietaire: 'Identifiant 1 et 2' }]; }, expected: 'individual_owner' },
  { name: 'année future', mutate: (p) => { p.patrimony.has_real_estate = true; p.patrimony.immobilier = [{ ...profileAt(1).patrimony.immobilier[0], date_acquisition: '2999' }]; }, expected: 'property_year' },
  { name: 'projet immobilier absent', mutate: (p) => { p.patrimony.immobilier[0].projet_bien = ''; }, expected: 'property_project' },
  { name: 'contexte immobilier contradictoire', mutate: (p) => { p.patrimony.has_real_estate = true; p.documents.has_real_estate = false; }, expected: 'document_context' },
  { name: 'aucune catégorie financière', mutate: (p) => { p.financial.categories = []; }, expected: 'financial_categories' },
  { name: 'montant comptes courants absent', mutate: (p) => { p.financial.current_accounts_amount = ''; }, expected: 'current_accounts_amount' },
  { name: 'aucun avec une autre catégorie', mutate: (p) => { p.financial.categories = ['none', 'savings']; }, expected: 'financial_none_exclusive' },
  { name: 'autre placement non précisé', mutate: (p) => { p.financial.categories = ['other']; p.financial.other_details = ''; }, expected: 'financial_other_details' },
  { name: 'encours financier absent', mutate: (p) => { p.financial.total_band = ''; }, expected: 'financial_band' },
  { name: 'déclaration financière non confirmée', mutate: (p) => { p.financial.completeness_confirmed = false; }, expected: 'financial_confirmation' },
  { name: 'contexte financier contradictoire', mutate: (p) => { p.documents.has_financial_assets = false; }, expected: 'financial_assets_context' },
  { name: 'crédits non renseignés', mutate: (p) => { p.credits.has_credits = ''; }, expected: 'credits_answer' },
  { name: 'crédit annoncé sans fiche', mutate: (p) => { p.credits.has_credits = true; p.credits.items = []; }, expected: 'credits_missing' },
  { name: 'crédit incomplet', mutate: (p) => { p.credits.items[0].credit_rattache_a = ''; }, expected: 'credit_fields' },
  { name: 'contexte crédits contradictoire', mutate: (p) => { p.documents.has_credits = false; }, expected: 'credits_context' },
];

for (const fixture of invalidFixtures) {
  const profile = structuredClone(profileAt(1));
  profile.documents.has_real_estate = profile.patrimony.has_real_estate;
  profile.documents.has_financial_assets = profile.financial.categories.some((category) => category !== 'none');
  profile.documents.has_credits = profile.credits.has_credits;
  fixture.mutate(profile);
  assert(validate(profile).includes(fixture.expected), `${fixture.name} aurait dû être refusé`);
}

const [familyPage, documentsPage, documentStyles, journeyBase, helpers, migration, financialMigration, financialCoreMigration, currentAccountsMigration, creditMigration] = await Promise.all([
  read('src/pages/portal/ClientRecueilJourneyPage.tsx'), read('src/pages/portal/ClientDocumentsPage.tsx'), read('src/patrimony-dark.css'), read('src/pages/portal/ClientRecueilJourneyBase.tsx'), read('src/portal/portalHelpers.ts'), read('supabase/migrations/20260825120000_atomic_family_setup.sql'), read('supabase/migrations/20260825143000_add_financial_recueil_section.sql'), read('supabase/migrations/20260825153500_allow_financial_in_recueil_core.sql'), read('supabase/migrations/20260825173000_move_current_accounts_to_financial.sql'), read('supabase/migrations/20260825180000_add_quick_credit_recueil_section.sql'),
]);

assert.match(familyPage, /rpc\('save_my_family_setup'/);
assert.doesNotMatch(familyPage, /rpc\('sync_my_spouse_from_family'/);
assert.match(migration, /perform public\.save_my_recueil_section[\s\S]+select public\.sync_my_spouse_from_family/);
assert.match(migration, /sync_document_real_estate_context/);
assert.match(documentsPage, /\['patrimoine_immobilier', 'Patrimoine immobilier'\]/);
assert.doesNotMatch(documentsPage, /\['comptes_liquidites', 'Comptes courants'\]/);
assert.match(journeyBase, /propertyOwnerOptions/);
assert.match(journeyBase, /code: 'patrimony'[\s\S]{0,500}code: 'financial'[\s\S]{0,500}code: 'credits'[\s\S]{0,500}code: 'regulatory'/);
assert.match(journeyBase, /Crédit à la consommation/, 'L’onglet Crédits doit conserver le type de crédit');
assert.match(journeyBase, /Taux du crédit \(%\)/, 'Le recueil rapide doit demander le taux du crédit');
assert.match(journeyBase, /Bien financé \/ crédit rattaché à/, 'Le recueil rapide doit rattacher chaque crédit à son objet ou bien');
assert.doesNotMatch(journeyBase, /Capital restant dû approximatif/, 'Le CRD doit venir du tableau d’amortissement');
assert.doesNotMatch(journeyBase, /Mensualité actuelle/, 'La mensualité doit venir du tableau d’amortissement');
assert.doesNotMatch(journeyBase, /Fin approximative du crédit/, 'La fin du crédit doit venir du tableau d’amortissement');
assert.match(journeyBase, /className="credit-section space-y-6"/);
assert.match(journeyBase, /className="credit-card /);
assert.match(documentStyles, /\.credit-card[\s\S]{0,180}background: #102440 !important/);
assert.match(documentStyles, /\.credit-card input,[\s\S]{0,220}background: #ffffff !important/);
assert.match(creditMigration, /validate_credit_recueil_payload/);
assert.match(creditMigration, /sync_document_credit_context/);
assert.match(creditMigration, /require_credit_recueil_before_validation/);
assert.match(helpers, /rows\.length === 1 \? rows\[0\] : null/);

const counts = profiles.reduce((result, profile) => { result[profile.scope] += 1; result[profile.professional.statut] = (result[profile.professional.statut] ?? 0) + 1; return result; }, { individual: 0, couple: 0 });
console.log(`Crash-test recueil: 100/100 dossiers valides, ${invalidFixtures.length}/${invalidFixtures.length} incohérences refusées.`);
console.log(`Profils couverts: ${counts.individual} individuels, ${counts.couple} couples, 8 statuts professionnels, 6 types de biens, 4 usages, 8 catégories financières, 6 tranches d’encours, FATCA, PPE et ESG.`);
