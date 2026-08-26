import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const temp = await mkdtemp(join(tmpdir(), 'advisor-summary-engine-'));
const tsc = join(process.cwd(), 'node_modules', 'typescript', 'bin', 'tsc');
const compile = spawnSync(process.execPath, [
  tsc,
  'src/portal/advisorSummaryEngine.ts',
  'src/portal/dataStatusEngine.ts',
  'src/portal/consistencyEngine.ts',
  '--target', 'ES2020',
  '--module', 'commonjs',
  '--moduleResolution', 'node',
  '--skipLibCheck',
  '--outDir', temp,
], { cwd: process.cwd(), stdio: 'inherit' });
if (compile.status !== 0) process.exit(compile.status ?? 1);

const loaded = await import(pathToFileURL(join(temp, 'advisorSummaryEngine.js')).href);
const summarizeAdvisorDossier = loaded.summarizeAdvisorDossier ?? loaded.default?.summarizeAdvisorDossier;
assert.equal(typeof summarizeAdvisorDossier, 'function', 'Le moteur de synthèse conseiller doit être importable.');

const completeSections = ['identity', 'family', 'professional', 'objectives', 'capacity', 'patrimony', 'financial', 'credits', 'regulatory'].map((section_code) => ({ section_code, completed_at: '2026-08-26T12:00:00Z' }));

const ready = summarizeAdvisorDossier({
  sections: completeSections,
  provenance: [
    { statut_validation: 'verifie', valeur_source: '50000' },
    { statut_validation: 'retenu_cif', valeur_source: '52000', valeur_retenue: '50000' },
  ],
  checklist: [{ statut: 'validated' }, { statut: 'not_applicable' }],
  issues: [],
});
assert.equal(ready.readiness, 'ready');
assert.equal(ready.sections.completed, 9);
assert.equal(ready.provenance.verified, 1);
assert.equal(ready.provenance.retained, 1);
assert.equal(ready.provenance.cifReviewRequired, 0);

const review = summarizeAdvisorDossier({
  sections: completeSections,
  provenance: [{ statut_validation: 'declare', methode_collecte: 'declaration_client' }],
  checklist: [{ statut: 'received' }],
  issues: [{ code: 'X', severity: 'review', section: 'capacity', title: 'À vérifier', message: 'Contrôle requis' }],
});
assert.equal(review.readiness, 'review');
assert.equal(review.provenance.cifReviewRequired, 1);
assert.equal(review.documents.received, 1);
assert.equal(review.consistency.review, 1);

const blocked = summarizeAdvisorDossier({
  sections: completeSections.slice(0, 7),
  checklist: [{ statut: 'missing' }],
  issues: [{ code: 'B', severity: 'blocking', section: 'credits', title: 'Bloquant', message: 'Donnée contradictoire' }],
});
assert.equal(blocked.readiness, 'blocked');
assert.equal(blocked.sections.missing.length, 2);
assert.equal(blocked.documents.missing, 1);
assert.equal(blocked.consistency.blocking, 1);

console.log('Advisor summary engine: 15 contrôles validés.');
await rm(temp, { recursive: true, force: true });
