import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const familySituations = ['Célibataire', 'Divorcé', 'Séparé', 'Veuf / Veuve', 'Marié', 'Pacsé', 'Concubinage'];
const professionalStatuses = ['CDI', 'CDD', 'Fonctionnaire', 'Indépendant / TNS', 'Chef d’entreprise', 'Retraité', 'Sans activité', 'Étudiant'];
const propertyTypes = ['Appartement', 'Maison', 'Immeuble', 'Terrain', 'Local professionnel / commercial', 'Autre'];
const propertyUsages = ['Résidence principale', 'Résidence secondaire', 'Locatif', 'Autre'];

function profileAt(index) {
  const situation = familySituations[index % familySituations.length];
  const couple = ['Marié', 'Pacsé', 'Concubinage'].includes(situation);
  const hasRealEstate = index % 3 !== 0;
  const usage = propertyUsages[index % propertyUsages.length];
  const type = propertyTypes[index % propertyTypes.length];
  const role = couple && index % 2 ? 'investisseur_2' : 'investisseur_1';
  const owner = !couple ? 'Identifiant 1' : role === 'investisseur_2' ? 'Identifiant 2' : index % 4 ? 'Identifiant 1 et 2' : 'Identifiant 1';
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
        valeur_actuelle: 180000 + index * 1000,
        date_acquisition: String(1995 + (index % 30)),
        loyer_annuel: usage === 'Locatif' ? 9600 : '',
      }] : [],
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
    if (Number(property.valeur_actuelle) <= 0) errors.push('property_value');
    const year = Number(property.date_acquisition);
    if (!/^\d{4}$/.test(property.date_acquisition) || year < 1800 || year > new Date().getFullYear()) errors.push('property_year');
    if (profile.scope === 'individual' && property.proprietaire !== 'Identifiant 1') errors.push('individual_owner');
    if (profile.role === 'investisseur_2' && property.proprietaire !== 'Identifiant 2') errors.push('shared_property_duplicate');
    if (property.usage === 'Locatif' && Number(property.loyer_annuel) < 0) errors.push('rent');
  }
  if (profile.documents.tax_status === 'no_personal_notice' && !profile.documents.tax_absence_reason) errors.push('tax_reason');
  if (profile.patrimony.has_real_estate && profile.documents.has_real_estate === false) errors.push('document_context');
  return errors;
}

const profiles = Array.from({ length: 100 }, (_, index) => profileAt(index));
for (const profile of profiles) {
  profile.documents.has_real_estate = profile.patrimony.has_real_estate;
  assert.deepEqual(validate(profile), [], `Dossier ${profile.id} invalide`);
}

const invalidFixtures = [
  { name: 'montant négatif', mutate: (p) => { p.capacity.capacite_epargne = -1; }, expected: 'money' },
  { name: 'naissance future', mutate: (p) => { p.identity.date_naissance = '2999-01-01'; }, expected: 'birth_date' },
  { name: 'enfants décimaux', mutate: (p) => { p.family.nombre_enfants = '1.5'; }, expected: 'children' },
  { name: 'propriétaire couple sur dossier individuel', mutate: (p) => { p.scope = 'individual'; p.patrimony.has_real_estate = true; p.patrimony.immobilier = [{ ...profileAt(1).patrimony.immobilier[0], proprietaire: 'Identifiant 1 et 2' }]; }, expected: 'individual_owner' },
  { name: 'année future', mutate: (p) => { p.patrimony.has_real_estate = true; p.patrimony.immobilier = [{ ...profileAt(1).patrimony.immobilier[0], date_acquisition: '2999' }]; }, expected: 'property_year' },
  { name: 'contexte immobilier contradictoire', mutate: (p) => { p.patrimony.has_real_estate = true; p.documents.has_real_estate = false; }, expected: 'document_context' },
];

for (const fixture of invalidFixtures) {
  const profile = structuredClone(profileAt(1));
  profile.documents.has_real_estate = profile.patrimony.has_real_estate;
  fixture.mutate(profile);
  assert(validate(profile).includes(fixture.expected), `${fixture.name} aurait dû être refusé`);
}

const [familyPage, documentsPage, journeyBase, helpers, migration] = await Promise.all([
  read('src/pages/portal/ClientRecueilJourneyPage.tsx'),
  read('src/pages/portal/ClientDocumentsPage.tsx'),
  read('src/pages/portal/ClientRecueilJourneyBase.tsx'),
  read('src/portal/portalHelpers.ts'),
  read('supabase/migrations/20260825120000_atomic_family_setup.sql'),
]);

assert.match(familyPage, /rpc\('save_my_family_setup'/, 'Le setup famille doit utiliser le RPC atomique');
assert.doesNotMatch(familyPage, /rpc\('sync_my_spouse_from_family'/, 'Le navigateur ne doit plus synchroniser le conjoint dans un second appel');
assert.match(migration, /perform public\.save_my_recueil_section[\s\S]+select public\.sync_my_spouse_from_family/, 'La transaction doit enregistrer la famille puis synchroniser le conjoint');
assert.match(migration, /sync_document_real_estate_context/, 'Le contexte documentaire immobilier doit être repris automatiquement du recueil');
assert.match(documentsPage, /\['patrimoine_immobilier', 'Patrimoine immobilier'\]/, 'La catégorie documentaire immobilière doit être visible');
assert.match(documentsPage, /'has_real_estate', currentContext\?\.has_real_estate/, 'La question documentaire immobilière doit être rendue');
assert.match(journeyBase, /propertyOwnerOptions/, 'Les choix de propriétaire doivent dépendre du profil');
assert.match(journeyBase, /code: 'patrimony'[\s\S]{0,400}code: 'regulatory'/, 'Patrimoine doit rester avant Réglementaire');
assert.match(journeyBase, /'Revenus', 'Patrimoine', 'Réglementaire'/, 'Les libellés doivent suivre le même ordre que les sections');
assert.match(helpers, /rows\.length === 1 \? rows\[0\] : null/, 'Un dossier ne doit pas être choisi arbitrairement');

const counts = profiles.reduce((result, profile) => {
  result[profile.scope] += 1;
  result[profile.professional.statut] = (result[profile.professional.statut] ?? 0) + 1;
  return result;
}, { individual: 0, couple: 0 });

console.log(`Crash-test recueil: 100/100 dossiers valides, ${invalidFixtures.length}/${invalidFixtures.length} incohérences refusées.`);
console.log(`Profils couverts: ${counts.individual} individuels, ${counts.couple} couples, 8 statuts professionnels, 6 types de biens, 4 usages, FATCA, PPE et ESG.`);
