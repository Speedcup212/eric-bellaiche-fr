const fs = require('fs');

const pagePath = 'src/pages/portal/CifDossierSummaryPage.tsx';
let page = fs.readFileSync(pagePath, 'utf8');
page = page.replaceAll("generate-cif-documents", "generate-cif-pdfs");
page = page.replace("type GeneratedDocument = { type: 'recueil' | 'qpi' | 'esg'; document_id: string; signed_url: string | null; path: string; reused: boolean };", "type GeneratedDocument = { type: 'recueil' | 'qpi' | 'esg'; document_id: string; signed_url: string | null; path: string; reused: boolean; format?: 'pdf' };" );
page = page.replace('Recueil, profil et ESG générés depuis Supabase', 'Recueil, profil et ESG générés en PDF depuis Supabase');
page = page.replace('sa version Word à signer est générée automatiquement à partir des données enregistrées.', 'sa version PDF finale à signer est générée automatiquement à partir des données enregistrées.');
page = page.replace('Les fichiers sont archivés dans le dossier réglementaire avec leur hash SHA-256 et un instantané des données.', 'Les PDF finaux sont archivés dans le dossier réglementaire avec leur hash SHA-256 et un instantané des données.');
fs.writeFileSync(pagePath, page);

const testPath = 'scripts/test-generated-document-pipeline.mjs';
const test = [
  "import fs from 'node:fs';",
  "",
  "const page = fs.readFileSync('src/pages/portal/CifDossierSummaryPage.tsx', 'utf8');",
  "const edgePath = 'supabase/functions/generate-cif-pdfs/index.ts';",
  "const edge = fs.readFileSync(edgePath, 'utf8');",
  "const checks = [",
  "  ['portal invokes PDF generator', page.includes(\"functions.invoke('generate-cif-pdfs'\")],",
  "  ['recueil PDF readiness', page.includes(\"types.push('recueil')\")],",
  "  ['qpi PDF readiness', page.includes(\"types.push('qpi')\")],",
  "  ['esg PDF readiness', page.includes(\"types.push('esg')\")],",
  "  ['PDF download links exposed', page.includes('generatedDocumentLabel[document.type]')],",
  "  ['PDF generator versioned', edge.includes(\"PDF_VERSION = '2026-MAITRE-PDF-1.0'\")],",
  "  ['private regulatory storage used', edge.includes(\"BUCKET = 'regulatory-docs'\")],",
  "  ['PDF path archived', edge.includes('storage_path_pdf') && !edge.includes('storage_path_docx: storagePath')],",
  "  ['PDF MIME type used', edge.includes(\"contentType: 'application/pdf'\")],",
  "  ['PDF extension used', edge.includes('.pdf')],",
  "  ['documents hashed', edge.includes('hash_sha256') && edge.includes('snapshot_hash')],",
  "  ['Youtrust handoff metadata', edge.includes(\"signature_provider: 'youtrust'\") && edge.includes(\"signature_status: 'ready_to_send'\")],",
  "  ['final format is PDF', edge.includes(\"final_format: 'pdf'\")],",
  "  ['identity document not requested', !edge.includes(\"categorie='identite'\") && !edge.includes('justificatif_domicile')],",
  "];",
  "const failures = checks.filter(([, ok]) => !ok);",
  "for (const [name, ok] of checks) console.log((ok ? '✓' : '✗') + ' ' + name);",
  "if (failures.length) process.exit(1);",
  "console.log('Generated PDF document pipeline: ' + checks.length + '/' + checks.length + ' controls passed.');",
  "",
].join('\n');
fs.writeFileSync(testPath, test);

const pkgPath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.scripts['test:generated-documents'] = 'node scripts/test-generated-document-pipeline.mjs';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

console.log('PDF-first document integration patched.');
