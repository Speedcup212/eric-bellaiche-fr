import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const temp = await mkdtemp(join(tmpdir(), 'data-status-engine-'));
const tsc = join(process.cwd(), 'node_modules', 'typescript', 'bin', 'tsc');
const compile = spawnSync(process.execPath, [
  tsc,
  'src/portal/dataStatusEngine.ts',
  '--target', 'ES2020',
  '--module', 'ES2020',
  '--moduleResolution', 'node',
  '--skipLibCheck',
  '--outDir', temp,
], { cwd: process.cwd(), stdio: 'inherit' });
if (compile.status !== 0) process.exit(compile.status ?? 1);

const { resolveDataStatus, canUseForRegulatoryGeneration, requiresCifReview } = await import(pathToFileURL(join(temp, 'dataStatusEngine.js')).href);

const cases = [
  [{ methode_collecte: 'declaration_client', statut_validation: 'declare', valeur_source: '52000' }, 'declared', 'Déclaré par le client', '52000'],
  [{ methode_collecte: 'extraction_document', statut_validation: 'extrait', valeur_source: '50400', source_document_id: 'doc-1' }, 'extracted', 'Extrait d’un justificatif', '50400'],
  [{ methode_collecte: 'extraction_document', statut_validation: 'a_verifier', valeur_source: '50400' }, 'to_review', 'À vérifier', '50400'],
  [{ methode_collecte: 'extraction_document', statut_validation: 'verifie', valeur_source: '50400' }, 'verified', 'Vérifié', '50400'],
  [{ methode_collecte: 'saisie_cif', statut_validation: 'retenu_cif', valeur_source: '52000', valeur_retenue: '50400' }, 'retained', 'Retenu par le CIF', '50400'],
  [{ methode_collecte: 'saisie_cif', statut_validation: 'rejete', valeur_source: '99999' }, 'rejected', 'Écart rejeté', '99999'],
  [{ methode_collecte: 'declaration_client', statut_validation: 'valide_client', valeur_source: '52000' }, 'declared', 'Déclaré par le client', '52000'],
  [{ methode_collecte: 'saisie_cif', statut_validation: 'valide_cif', valeur_source: '50400' }, 'verified', 'Vérifié', '50400'],
];

for (const [input, status, label, value] of cases) {
  const result = resolveDataStatus(input);
  assert.equal(result.status, status);
  assert.equal(result.label, label);
  assert.equal(result.effectiveValue, value);
}

assert.equal(resolveDataStatus({ source_document_id: 'doc-1' }).hasSourceDocument, true);
assert.equal(resolveDataStatus({ statut_validation: 'retenu_cif' }).isRetainedByCif, true);
assert.equal(resolveDataStatus({ statut_validation: 'verifie' }).isVerified, true);
assert.equal(resolveDataStatus({ statut_validation: 'retenu_cif' }).isVerified, true);
assert.equal(canUseForRegulatoryGeneration({ statut_validation: 'verifie' }), true);
assert.equal(canUseForRegulatoryGeneration({ statut_validation: 'retenu_cif' }), true);
assert.equal(canUseForRegulatoryGeneration({ statut_validation: 'declare' }), false);
assert.equal(requiresCifReview({ statut_validation: 'a_verifier' }), true);
assert.equal(requiresCifReview({ statut_validation: 'verifie' }), false);

console.log(`Data status engine: ${cases.length + 9} scénarios validés.`);
await rm(temp, { recursive: true, force: true });
