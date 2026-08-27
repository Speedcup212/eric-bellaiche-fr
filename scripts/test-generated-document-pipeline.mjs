import fs from 'node:fs';

const page = fs.readFileSync('src/pages/portal/CifDossierSummaryPage.tsx', 'utf8');
const edge = fs.existsSync('supabase/functions/generate-cif-documents/index.ts') ? fs.readFileSync('supabase/functions/generate-cif-documents/index.ts', 'utf8') : '';

const checks = [
  ['portal invokes edge generator', page.includes("functions.invoke('generate-cif-documents'")],
  ['recueil generation readiness', page.includes("types.push('recueil')")],
  ['qpi generation readiness', page.includes("types.push('qpi')")],
  ['esg generation readiness', page.includes("types.push('esg')")],
  ['download links exposed', page.includes('generatedDocumentLabel[document.type]')],
  ['edge source mirrored', edge.includes("DOC_VERSION = '2026-MAITRE-1.0'")],
  ['regulatory storage used', edge.includes("BUCKET = 'regulatory-docs'")],
  ['documents are hashed', edge.includes('hash_sha256') && edge.includes('snapshot_hash')],
  ['Youtrust handoff metadata', edge.includes("signature_provider: 'youtrust'")],
  ['identity document not requested', !edge.includes("categorie='identite'") && !edge.includes('justificatif_domicile')],
];
const failures = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log((ok ? '✓' : '✗') + ' ' + name);
if (failures.length) process.exit(1);
console.log('Generated document pipeline: ' + checks.length + '/' + checks.length + ' controls passed.');
