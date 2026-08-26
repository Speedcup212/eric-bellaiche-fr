import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const temp = await mkdtemp(join(tmpdir(), 'consistency-engine-'));
const tsc = join(process.cwd(), 'node_modules', 'typescript', 'bin', 'tsc');
const compile = spawnSync(process.execPath, [
  tsc,
  'src/portal/consistencyEngine.ts',
  '--target', 'ES2020',
  '--module', 'ES2020',
  '--moduleResolution', 'node',
  '--skipLibCheck',
  '--outDir', temp,
], { cwd: process.cwd(), stdio: 'inherit' });
if (compile.status !== 0) process.exit(compile.status ?? 1);

const { evaluateConsistency, summarizeConsistency } = await import(pathToFileURL(join(temp, 'consistencyEngine.js')).href);

const base = {
  identity: { date_naissance: '1985-04-12' },
  family: { situation: 'Célibataire' },
  professional: { statut: 'CDI', changement_professionnel_prevu: false },
  capacity: { estimation_revenus_travail_annuels: 48000, estimation_revenus_fonciers_annuels: 0, capacite_epargne_mensuelle: 800 },
  patrimony: { has_real_estate: false, immobilier: [] },
  financial: { current_accounts_amount: 5000, categories: ['savings'], other_details: '' },
  credits: { has_credits: false, items: [] },
  documents: { has_real_estate: false, has_financial_assets: true, has_credits: false },
  spouse: null,
};

assert.deepEqual(evaluateConsistency(base), [], 'Un dossier cohérent ne doit générer aucune anomalie.');

const fixtures = [
  ['date future', { ...base, identity: { date_naissance: '2999-01-01' } }, 'IDENTITY_BIRTH_DATE_FUTURE', 'blocking'],
  ['couple sans conjoint', { ...base, family: { situation: 'Marié' }, spouse: null }, 'COUPLE_SPOUSE_MISSING', 'blocking'],
  ['retraité avec changement', { ...base, professional: { statut: 'Retraité', changement_professionnel_prevu: true } }, 'PRO_RETIRED_CHANGE_PLANNED', 'review'],
  ['épargne incohérente', { ...base, capacity: { estimation_revenus_travail_annuels: 24000, capacite_epargne_mensuelle: 1800 } }, 'CAPACITY_SAVINGS_VS_INCOME', 'review'],
  ['immobilier sans fiche', { ...base, patrimony: { has_real_estate: true, immobilier: [] }, documents: { ...base.documents, has_real_estate: true } }, 'REAL_ESTATE_DECLARED_WITHOUT_ASSET', 'blocking'],
  ['locatif sans revenu', { ...base, patrimony: { has_real_estate: true, immobilier: [{ usage: 'Locatif' }] }, documents: { ...base.documents, has_real_estate: true } }, 'RENTAL_PROPERTY_WITHOUT_INCOME', 'review'],
  ['aucun placement + livret', { ...base, financial: { current_accounts_amount: 5000, categories: ['none', 'savings'] } }, 'FINANCIAL_NONE_WITH_OTHER_ASSETS', 'blocking'],
  ['autre placement non précisé', { ...base, financial: { current_accounts_amount: 5000, categories: ['other'], other_details: '' } }, 'FINANCIAL_OTHER_UNSPECIFIED', 'review'],
  ['crédit sans fiche', { ...base, credits: { has_credits: true, items: [] }, documents: { ...base.documents, has_credits: true } }, 'CREDIT_DECLARED_WITHOUT_ITEM', 'blocking'],
  ['crédit immobilier sans bien', { ...base, credits: { has_credits: true, items: [{ type_credit: 'Crédit immobilier résidence principale' }] }, documents: { ...base.documents, has_credits: true } }, 'MORTGAGE_WITHOUT_REAL_ESTATE', 'review'],
  ['documents contradictoires', { ...base, documents: { ...base.documents, has_financial_assets: false } }, 'DOCUMENT_FINANCIAL_CONTEXT_MISMATCH', 'review'],
];

for (const [name, snapshot, code, severity] of fixtures) {
  const issues = evaluateConsistency(snapshot);
  const issue = issues.find((item) => item.code === code);
  assert.ok(issue, `${name}: anomalie ${code} attendue`);
  assert.equal(issue.severity, severity, `${name}: sévérité incorrecte`);
}

const summary = summarizeConsistency(evaluateConsistency({
  ...base,
  identity: { date_naissance: '2999-01-01' },
  professional: { statut: 'Retraité', changement_professionnel_prevu: true },
}));
assert.equal(summary.blocking, 1);
assert.equal(summary.review, 1);
assert.equal(summary.canFinalize, false);

console.log(`Consistency engine: ${fixtures.length + 2} scénarios validés.`);
await rm(temp, { recursive: true, force: true });
