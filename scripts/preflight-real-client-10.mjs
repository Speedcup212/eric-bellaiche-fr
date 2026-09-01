import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

function canFinishRecueil(p) {
  const errors = [];
  if (!p.scope) errors.push('scope');
  if (!p.family.situation) errors.push('family_situation');
  if (!Number.isInteger(Number(p.family.children)) || Number(p.family.children) < 0) errors.push('children');
  if (['Marié', 'Pacsé'].includes(p.family.situation) && (!p.family.date || !p.family.regime)) errors.push('family_legal');
  if (p.scope === 'couple') {
    if (!p.spouse?.civilite || !p.spouse?.first || !p.spouse?.last || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(p.spouse?.email ?? '')) errors.push('spouse');
  }
  if (!p.identity.birthDate || new Date(p.identity.birthDate) > new Date()) errors.push('identity');
  if (!p.objectives.length || p.objectives.some((o) => !o.code || !o.horizon)) errors.push('objectives');
  if ([p.capacity.income, p.capacity.savings, p.capacity.precaution].some((v) => v === '' || Number(v) < 0 || !Number.isFinite(Number(v)))) errors.push('capacity');
  if (typeof p.realEstate.has !== 'boolean') errors.push('real_estate_answer');
  if (p.realEstate.has && !p.realEstate.items.length) errors.push('real_estate_items');
  if (p.realEstate.items.some((b) => !b.type || !b.usage || !b.owner || Number(b.value) <= 0)) errors.push('real_estate_fields');
  if (p.financial.currentAccounts === '' || Number(p.financial.currentAccounts) < 0 || !Number.isFinite(Number(p.financial.currentAccounts))) errors.push('current_accounts');
  if (!p.financial.categories.length) errors.push('financial_categories');
  if (p.financial.categories.includes('none') && p.financial.categories.length > 1) errors.push('financial_none');
  if (!p.financial.categories.includes('none') && !p.financial.band) errors.push('financial_band');
  if (p.financial.categories.includes('other') && !p.financial.other) errors.push('financial_other');
  if (p.financial.confirmed !== true) errors.push('financial_confirmation');
  if (typeof p.credits.has !== 'boolean') errors.push('credits_answer');
  if (p.credits.has && !p.credits.items.length) errors.push('credits_items');
  if (p.credits.items.some((c) => !c.type || c.rate === '' || Number(c.rate) < 0 || !c.linkedTo)) errors.push('credit_fields');
  if (!['oui', 'non', 'je_ne_sais_pas'].includes(p.regulatory.us)) errors.push('regulatory_us');
  if (!['oui', 'non', 'je_ne_sais_pas'].includes(p.regulatory.ppe)) errors.push('regulatory_ppe');
  if (!['oui', 'non'].includes(p.regulatory.esg)) errors.push('regulatory_esg');
  return errors;
}

function base() {
  return {
    scope: 'individual',
    family: { situation: 'Célibataire', children: '0', date: '', regime: 'Sans convention / non applicable' },
    spouse: null,
    identity: { birthDate: '1984-05-16' },
    objectives: [{ code: 'constitution_patrimoine', horizon: 'Plus de 8 ans' }],
    capacity: { income: 54000, savings: 700, precaution: 15000 },
    realEstate: { has: false, items: [] },
    financial: { currentAccounts: 4500, categories: ['savings'], band: '10k_50k', other: '', confirmed: true },
    credits: { has: false, items: [] },
    regulatory: { us: 'non', ppe: 'non', esg: 'oui' },
  };
}

const scenarios = [
  ['1 - célibataire sans immobilier ni crédit', (p) => p],
  ['2 - couple marié avec second email', (p) => { p.scope = 'couple'; p.family = { situation: 'Marié', children: '2', date: '2016-06-18', regime: 'Séparation de biens' }; p.spouse = { civilite: 'Mme', first: 'Camille', last: 'Test', email: 'camille.test@example.fr' }; return p; }],
  ['3 - plusieurs crédits', (p) => { p.credits = { has: true, items: [{ type: 'Prêt immobilier résidence principale', rate: 2.8, linkedTo: 'Résidence principale' }, { type: 'Prêt automobile', rate: 4.1, linkedTo: 'Véhicule' }] }; return p; }],
  ['4 - plusieurs biens immobiliers', (p) => { p.realEstate = { has: true, items: [{ type: 'Maison', usage: 'Résidence principale', owner: 'Identifiant 1', value: 390000 }, { type: 'Appartement', usage: 'Locatif', owner: 'Identifiant 1', value: 165000 }] }; return p; }],
  ['5 - aucun placement', (p) => { p.financial = { currentAccounts: 2500, categories: ['none'], band: '', other: '', confirmed: true }; return p; }],
  ['6 - autre placement précisé', (p) => { p.financial = { currentAccounts: 12000, categories: ['other'], band: '50k_100k', other: 'Parts de société non cotée', confirmed: true }; return p; }],
  ['7 - fiscalité partielle sans blocage du recueil', (p) => { p.tax = { tmi: '', rfr: '', incomeTax: '' }; return p; }],
  ['8 - ESG non applicable choisi', (p) => { p.regulatory.esg = 'non'; return p; }],
  ['9 - réponses je ne sais pas réglementaires', (p) => { p.regulatory.us = 'je_ne_sais_pas'; p.regulatory.ppe = 'je_ne_sais_pas'; return p; }],
  ['10 - reprise après interruption avec données déjà sauvegardées', (p) => structuredClone(p)],
];

for (const [name, mutate] of scenarios) {
  const profile = mutate(base());
  assert.deepEqual(canFinishRecueil(profile), [], `${name} doit pouvoir terminer sans blocage`);
}

const blocked = [
  ['couple sans email conjoint', (p) => { p.scope = 'couple'; p.family = { situation: 'Marié', children: '0', date: '2020-03-01', regime: 'Séparation de biens' }; p.spouse = { civilite: 'Mme', first: 'Camille', last: 'Test', email: '' }; return p; }, 'spouse'],
  ['crédit annoncé sans détail', (p) => { p.credits = { has: true, items: [] }; return p; }, 'credits_items'],
  ['bien annoncé sans détail', (p) => { p.realEstate = { has: true, items: [] }; return p; }, 'real_estate_items'],
  ['placement autre sans précision', (p) => { p.financial = { currentAccounts: 1000, categories: ['other'], band: '10k_50k', other: '', confirmed: true }; return p; }, 'financial_other'],
];
for (const [name, mutate, expected] of blocked) assert(canFinishRecueil(mutate(base())).includes(expected), `${name} doit être bloqué explicitement`);

const [journey, familyPage, questionnairePage, validationGuard, helpers, app] = await Promise.all([
  read('src/pages/portal/ClientRecueilJourneyBase.tsx'),
  read('src/pages/portal/ClientRecueilJourneyPage.tsx'),
  read('src/pages/portal/QuestionnairePage.tsx'),
  read('src/pages/portal/RecueilValidationGuard.tsx'),
  read('src/portal/portalHelpers.ts'),
  read('src/App.tsx'),
]);

assert.match(journey, /save_my_recueil_section|recueil_sections/, 'Le recueil doit enregistrer les sections côté Supabase');
assert.match(journey, /setProgress|fetchPortalProgress/, 'Le recueil doit recharger la progression');
assert.match(familyPage, /save_my_family_setup/, 'Le couple doit être créé via la RPC atomique');
assert.match(familyPage, /Le parcours s’enregistre au fur et à mesure/, 'Le client doit être informé de la reprise possible');
assert.match(familyPage, /email personnel/, 'Le conjoint doit avoir une adresse personnelle distincte');
assert.match(validationGuard, /manquant|compl|valid/i, 'La validation finale doit exposer les éléments manquants');
assert.match(questionnairePage, /QPI|profil investisseur|questionnaire/i, 'Le parcours QPI doit être présent');
assert.match(questionnairePage, /ESG|durabilit/i, 'Le parcours ESG doit être présent');
assert.match(app, /profil-investisseur[\s\S]{0,180}QuestionnairePage mode="QPI"/, 'La route QPI doit être câblée');
assert.match(app, /path="esg"[\s\S]{0,120}QuestionnairePage mode="ESG"/, 'La route ESG doit être câblée');
assert.match(helpers, /selectedProgress/, 'La reprise doit sélectionner le bon dossier/investisseur');
assert.match(journey, /current_accounts_amount/, 'Le montant des comptes courants doit être conservé dans le recueil');
assert.match(journey, /has_credits/, 'Le chemin sans crédit et avec crédits doit être explicite');
assert.match(journey, /has_real_estate/, 'Le chemin sans immobilier et avec immobilier doit être explicite');
assert.match(journey, /esg_opt_in/, 'Le choix ESG doit piloter le parcours');

console.log(`Préflight clients réels: ${scenarios.length} scénarios passants + ${blocked.length} blocages contrôlés = OK`);
