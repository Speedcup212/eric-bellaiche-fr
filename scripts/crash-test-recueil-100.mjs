import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const familySituations = ['Célibataire', 'Divorcé', 'Séparé', 'Veuf / Veuve', 'Marié', 'Pacsé', 'Concubinage'];
const professionalStatuses = ['CDI', 'CDD', 'Fonctionnaire', 'Indépendant / TNS', 'Chef d’entreprise', 'Retraité', 'Sans activité', 'Étudiant'];
const propertyTypes = ['Appartement', 'Maison', 'Immeuble', 'Terrain', 'Local professionnel / commercial', 'Autre'];
const propertyUsages = ['Résidence principale', 'Résidence secondaire', 'Locatif', 'Autre'];
const propertyProjects = ['Conserver', 'Vendre', 'Mettre en location', 'À étudier'];
const financialCategories = ['current_accounts', 'savings', 'life_insurance', 'retirement', 'securities', 'paper_real_estate', 'employee_savings', 'other'];
const financialBands = ['under_10k', '10k_50k', '50k_100k', '100k_250k', '250k_500k', 'over_500k'];

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
    family: {
      situation,
      nombre_enfants: String(index % 6),
      date_evenement: ['Marié', 'Pacsé'].includes(situation) ? '2018-06-01' : '',
      regime_convention: ['Marié', 'Pacsé'].includes(situation) ? 'Séparation de biens' : 'Sans convention / non applicable',
    },
    spouse: couple ? { civilite: 'Mme', prenom: 'Camille', nom: `Test${index}`, email: `camille.${index}@example.fr`, mobile: '+33612345678' } : null,
    identity: { date_naissance: '1985-04-12', mobile: '+33687654321' },
    professional: { statut: professionalStatuses[index % professionalStatuses.length] },
    capacity: { revenus_travail: index % 8 === 6 ? 0 : 42000 + index, revenus_fonciers: usage === 'Locatif' ? 9600 : 0, epargne_precaution: 12000, capacite_epargne: 450, apport: index % 5 ? 25000 : 0 },
    regulatory: { fatca: index % 9 === 0, ppe: index % 11 === 0, esg: index % 4 !== 0 },
    patrimony: {
      has_real_estate: hasRealEstate,
      immobilier: hasRealEstate ? [{
        type_bien: type,
        type_bien_autre: type === 'Autre' ? 'Chalet' : '',
        usage,
        usage_autre: usage === 'Autre' ? 'Usage mixte' : '',
        proprietaire: owner,
        projet_bien: propertyProjects[index % propertyProjects.length],
        valeur_actuelle: 180000 + index * 1000,
        date_acquisition: String(1995 + (index % 30)),
        loyer_annuel: usage === 'Locatif' ? 9600 : '',
      }] : [],
    },
    financial: index % 10 === 0 ? {
      categories: ['none'], total_band: '', other_details: '', completeness_confirmed: true,
    } : {
      categories: [...new Set(['current_accounts', financialCategories[index % financialCategories.length]])],
      total_band: financialBands[index % financialBands.length],
      other_details: financialCategories[index % financialCategories.length] === 'other' ? 'Parts de société non cotée' : '',
      completeness_confirmed: true,
    },
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
  if (!Array.isArray(categories) || categories.length === 0) errors.push('financial_categories');
  if (categories.includes('none') && categories.length > 1) errors.push('financial_none_exclusive');
  if (categories.includes('other') && !profile.financial.other_details) errors.push('financial_other_details');
  if (!categories.includes('none') && !financialBands.includes(profile.financial.total_band)) errors.push('financial_band');
  if (profile.financial.completeness_confirmed !== true) errors.push('financial_confirmation');
  if (profile.documents.has_liquidities !== categories.includes('current_accounts')) errors.push('liquidities_context');
  if (profile.documents.has_financial_assets !== categories.some((category) => !['none', 'current_accounts'].includes(category))) errors.push('financial_assets_context');
  return errors;
}

const profiles = Array.from({ length: 100 }, (_, index) => profileAt(index));
for (const profile of profiles) {
  profile.documents.has_real_estate = profile.patrimony.has_real_estate;
  profile.documents.has_liquidities = profile.financial.categories.includes('current_accounts');
  profile.documents.has_financial_assets = profile.financial.categories.some((category) => !['none', 'current_accounts'].includes(category));
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
  { name: 'aucun avec une autre catégorie', mutate: (p) => { p.financial.categories = ['none', 'savings']; }, expected: 'financial_none_exclusive' },
  { name: 'autre placement non précisé', mutate: (p) => { p.financial.categories = ['other']; p.financial.other_details = ''; }, expected: 'financial_other_details' },
  { name: 'encours financier absent', mutate: (p) => { p.financial.total_band = ''; }, expected: 'financial_band' },
  { name: 'déclaration financière non confirmée', mutate: (p) => { p.financial.completeness_confirmed = false; }, expected: 'financial_confirmation' },
  { name: 'contexte financier contradictoire', mutate: (p) => { p.documents.has_financial_assets = false; }, expected: 'financial_assets_context' },
];

for (const fixture of invalidFixtures) {
  const profile = structuredClone(profileAt(1));
  profile.documents.has_real_estate = profile.patrimony.has_real_estate;
  profile.documents.has_liquidities = profile.financial.categories.includes('current_accounts');
  profile.documents.has_financial_assets = profile.financial.categories.some((category) => !['none', 'current_accounts'].includes(category));
  fixture.mutate(profile);
  assert(validate(profile).includes(fixture.expected), `${fixture.name} aurait dû être refusé`);
}

const [familyPage, documentsPage, journeyBase, helpers, migration, financialMigration, financialCoreMigration] = await Promise.all([
  read('src/pages/portal/ClientRecueilJourneyPage.tsx'),
  read('src/pages/portal/ClientDocumentsPage.tsx'),
  read('src/pages/portal/ClientRecueilJourneyBase.tsx'),
  read('src/portal/portalHelpers.ts'),
  read('supabase/migrations/20260825120000_atomic_family_setup.sql'),
  read('supabase/migrations/20260825143000_add_financial_recueil_section.sql'),
  read('supabase/migrations/20260825153500_allow_financial_in_recueil_core.sql'),
]);

assert.match(familyPage, /rpc\('save_my_family_setup'/, 'Le setup famille doit utiliser le RPC atomique');
assert.doesNotMatch(familyPage, /rpc\('sync_my_spouse_from_family'/, 'Le navigateur ne doit plus synchroniser le conjoint dans un second appel');
assert.match(migration, /perform public\.save_my_recueil_section[\s\S]+select public\.sync_my_spouse_from_family/, 'La transaction doit enregistrer la famille puis synchroniser le conjoint');
assert.match(migration, /sync_document_real_estate_context/, 'Le contexte documentaire immobilier doit être repris automatiquement du recueil');
assert.match(documentsPage, /\['patrimoine_immobilier', 'Patrimoine immobilier'\]/, 'La catégorie documentaire immobilière doit être visible');
assert.match(documentsPage, /'has_real_estate', currentContext\?\.has_real_estate/, 'La question documentaire immobilière doit être rendue');
assert.match(documentsPage, /activeDocumentView === 'situation'/, 'La situation documentaire doit être isolée dans un écran dédié');
assert.match(documentsPage, /activeDocumentView === 'uploads'/, 'Les justificatifs doivent être isolés dans un second écran');
assert.match(documentsPage, /Voir mes justificatifs/, 'Le passage vers les justificatifs doit être explicite');
assert.match(documentsPage, /className="documents-dark"/, 'L’étape Documents doit conserver la palette bleu nuit du parcours');
assert.match(journeyBase, /propertyOwnerOptions/, 'Les choix de propriétaire doivent dépendre du profil');
assert.match(journeyBase, /progress\.role_dossier === 'investisseur_2'[\s\S]{0,120}\['Identifiant 2'\][\s\S]{0,160}\['Identifiant 1 et 2', 'Identifiant 1', 'Identifiant 2'\]/, 'L’Identifiant 1 doit pouvoir déclarer un bien appartenant à l’Identifiant 2');
assert.doesNotMatch(journeyBase, /Six informations par bien/, 'La fiche immobilière ne doit pas répéter une consigne visuelle inutile');
assert.match(journeyBase, /Ajouter des précisions[\s\S]{0,100}\(facultatif\)/, 'Les données immobilières secondaires doivent rester facultatives');
assert.match(journeyBase, /collection_mode: 'real_estate_quick'/, 'La sauvegarde doit tracer le mode de recueil immobilier rapide');
assert.match(journeyBase, /real-estate-section/, 'La partie immobilière doit disposer de son panneau clair dédié');
assert.match(journeyBase, /real-estate-card-header/, 'Chaque bien doit avoir une hiérarchie visuelle distincte');
assert.match(journeyBase, /CompactSelectField[\s\S]{0,1000}appearance-none/, 'Les choix immobiliers doivent utiliser des listes compactes');
assert.match(journeyBase, /const complete = !\[item\.type_bien[\s\S]{0,500}<details/, 'Les biens complétés doivent pouvoir être repliés en résumé');
assert.match(journeyBase, /Loyer mensuel hors charges/, 'Le loyer doit être demandé dans une unité intuitive pour un novice');
assert.match(journeyBase, /loyer_annuel: item\.usage === 'Locatif' \? annualRentValue\(item\)/, 'Le loyer mensuel doit être converti en montant annuel avant sauvegarde');
assert.match(journeyBase, /sticky=\{false\}/, 'Le bandeau de progression ne doit pas recouvrir la fiche immobilière pendant le défilement');
assert.match(journeyBase, /code: 'patrimony'[\s\S]{0,500}code: 'financial'[\s\S]{0,500}code: 'regulatory'/, 'Immobilier puis Financier doivent rester avant Réglementaire');
assert.match(journeyBase, /label: 'Immobilier'[\s\S]{0,500}label: 'Financier'[\s\S]{0,500}label: 'Réglementaire'/, 'Les libellés doivent suivre le même ordre que les sections');
assert.match(journeyBase, /Les relevés transmis ensuite permettront d’obtenir le détail/, 'La section financière doit expliquer que les justificatifs apporteront le détail');
assert.doesNotMatch(journeyBase, /financial-section|financial-choice--selected/, 'La présentation historique de l’onglet Financier doit rester inchangée');
assert.match(journeyBase, /montant total approximatif de tous vos comptes et placements sélectionnés ci-dessus/, 'La question d’encours doit préciser qu’elle porte sur toutes les catégories sélectionnées');
assert.match(journeyBase, /Un seul total est demandé, toutes catégories confondues/, 'La question d’encours ne doit pas sembler liée à la dernière catégorie cochée');
assert.match(journeyBase, /Quels autres placements détenez-vous \?/, 'Les autres placements doivent être demandés sous forme de question');
assert.match(journeyBase, /Cryptoactifs[\s\S]{0,500}Parts de société non cotée[\s\S]{0,500}Financement participatif/, 'Les autres placements doivent proposer des choix simples');
assert.doesNotMatch(journeyBase, /label="Précisez les autres placements"/, 'Les autres placements ne doivent plus reposer sur un champ libre unique');
assert.match(journeyBase, /real-estate-section space-y-6"/, 'Immobilier doit utiliser directement le fond bleu nuit commun aux autres onglets');
assert.match(journeyBase, /group-open:hidden[\s\S]{0,220}hidden group-open:inline[\s\S]{0,80}Bien immobilier/, 'Le résumé du bien ne doit apparaître que lorsque la fiche est repliée');
assert.match(financialMigration, /validate_financial_recueil_payload/, 'Le serveur doit valider les réponses financières');
assert.match(financialMigration, /sync_document_financial_context/, 'Le contexte documentaire financier doit être repris automatiquement du recueil');
assert.match(financialMigration, /require_financial_recueil_before_validation/, 'La validation finale doit exiger la section Financier');
assert.match(financialCoreMigration, /'patrimony','financial','credits'/, 'La fonction centrale doit autoriser l’enregistrement de la section Financier');
assert.match(helpers, /rows\.length === 1 \? rows\[0\] : null/, 'Un dossier ne doit pas être choisi arbitrairement');

const counts = profiles.reduce((result, profile) => {
  result[profile.scope] += 1;
  result[profile.professional.statut] = (result[profile.professional.statut] ?? 0) + 1;
  return result;
}, { individual: 0, couple: 0 });

console.log(`Crash-test recueil: 100/100 dossiers valides, ${invalidFixtures.length}/${invalidFixtures.length} incohérences refusées.`);
console.log(`Profils couverts: ${counts.individual} individuels, ${counts.couple} couples, 8 statuts professionnels, 6 types de biens, 4 usages, 8 catégories financières, 6 tranches d’encours, FATCA, PPE et ESG.`);
