import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const temp = await mkdtemp(join(tmpdir(), 'household-consolidation-'));
const tsc = join(process.cwd(), 'node_modules', 'typescript', 'bin', 'tsc');
const compile = spawnSync(process.execPath, [
  tsc,
  'src/portal/householdConsolidationEngine.ts',
  '--target', 'ES2020',
  '--module', 'commonjs',
  '--moduleResolution', 'node',
  '--skipLibCheck',
  '--outDir', temp,
], { cwd: process.cwd(), stdio: 'inherit' });
if (compile.status !== 0) process.exit(compile.status ?? 1);

const loaded = await import(pathToFileURL(join(temp, 'householdConsolidationEngine.js')).href);
const consolidateHousehold = loaded.consolidateHousehold ?? loaded.default?.consolidateHousehold;
assert.equal(typeof consolidateHousehold, 'function');

const rows = [
  { investisseur_id: 'i1', role_dossier: 'investisseur_1', section_code: 'family', payload: { situation: 'Marié' } },
  { investisseur_id: 'i1', role_dossier: 'investisseur_1', section_code: 'patrimony', payload: { immobilier: [
    { type_bien: 'Maison', usage: 'Résidence principale', ville: 'Grenoble', valeur_actuelle: '500000', proprietaire: 'Identifiant 1 et 2' },
    { type_bien: 'Appartement', usage: 'Locatif', ville: 'Lyon', valeur_actuelle: '200000', proprietaire: 'Identifiant 2' },
  ] } },
  { investisseur_id: 'i2', role_dossier: 'investisseur_2', section_code: 'patrimony', payload: { immobilier: [
    { type_bien: 'Appartement', usage: 'Locatif', ville: 'Lyon', valeur_actuelle: 200000, proprietaire: 'Identifiant 2' },
    { type_bien: 'Appartement', usage: 'Locatif', ville: 'Annecy', valeur_actuelle: '150000', proprietaire: 'Identifiant 2' },
  ] } },
  { investisseur_id: 'i1', role_dossier: 'investisseur_1', section_code: 'financial', payload: { categories: ['savings', 'life_insurance', 'securities'] } },
  { investisseur_id: 'i2', role_dossier: 'investisseur_2', section_code: 'financial', payload: { categories: ['securities', 'retirement', 'none'] } },
];

const result = consolidateHousehold(rows);
assert.equal(result.isCouple, true);
assert.equal(result.canonicalFamilyInvestorId, 'i1');
assert.equal(result.realEstate.count, 3);
assert.equal(result.realEstate.totalValue, 850000);
assert.equal(result.realEstate.jointValue, 500000);
assert.equal(result.realEstate.investor2Value, 350000);
assert.equal(result.realEstate.investor1Value, 0);
assert.equal(result.realEstate.duplicatesIgnored, 1);
assert.equal(result.properties.filter((item) => item.city === 'Lyon').length, 1);
assert.deepEqual(result.financialCategories, ['life_insurance', 'retirement', 'savings', 'securities']);
assert.equal(result.warnings.some((message) => message.includes('ressaisi')), true);

const solo = consolidateHousehold([
  { investisseur_id: 'solo', role_dossier: 'investisseur_1', section_code: 'family', payload: { situation: 'Célibataire' } },
  { investisseur_id: 'solo', role_dossier: 'investisseur_1', section_code: 'patrimony', payload: { immobilier: [
    { type_bien: 'Maison', usage: 'Résidence principale', ville: 'Chambéry', valeur_actuelle: '300000', proprietaire: 'Identifiant 1' },
  ] } },
]);
assert.equal(solo.isCouple, false);
assert.equal(solo.realEstate.count, 1);
assert.equal(solo.realEstate.totalValue, 300000);
assert.equal(solo.realEstate.investor1Value, 300000);
assert.equal(solo.realEstate.duplicatesIgnored, 0);

const unknown = consolidateHousehold([
  { investisseur_id: 'i1', role_dossier: 'investisseur_1', section_code: 'patrimony', payload: { immobilier: [
    { type_bien: 'Terrain', usage: 'Autre', ville: 'Gap', valeur_actuelle: '50000', proprietaire: '' },
  ] } },
]);
assert.equal(unknown.realEstate.unknownOwnershipValue, 50000);
assert.equal(unknown.warnings.some((message) => message.includes('propriété à préciser')), true);

console.log('Household consolidation engine: 18 contrôles validés.');
await rm(temp, { recursive: true, force: true });
