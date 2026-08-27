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
const test = `import fs from 'node:fs';\n\nconst page = fs.readFileSync('src/pages/portal/CifDossierSummaryPage.tsx', 'utf8');\nconst edgePath = 'supabase/functions/generate-cif-pdfs/index.ts';\nconst edge = fs.readFileSync(edgePath, 'utf8');\nconst checks = [\n  ['portal invokes PDF generator', page.includes("functions.invoke('generate-cif-pdfs'")],\n  ['recueil PDF readiness', page.includes("types.push('recueil')")],\n  ['qpi PDF readiness', page.includes("types.push('qpi')")],\n  ['esg PDF readiness', page.includes("types.push('esg')")],\n  ['PDF download links exposed', page.includes('generatedDocumentLabel[document.type]')],\n  ['PDF generator versioned', edge.includes("PDF_VERSION = '2026-MAITRE-PDF-1.0'")],\n  ['private regulatory storage used', edge.includes("BUCKET = 'regulatory-docs'")],\n  ['PDF path archived', edge.includes('storage_path_pdf') && !edge.includes('storage_path_docx: storagePath')],\n  ['PDF MIME type used', edge.includes("contentType: 'application/pdf'")],\n  ['PDF extension used', edge.includes(".pdf`" ) || edge.includes(".pdf'" )],\n  ['documents hashed', edge.includes('hash_sha256') && edge.includes('snapshot_hash')],\n  ['Youtrust handoff metadata', edge.includes("signature_provider: 'youtrust'") && edge.includes("signature_status: 'ready_to_send'")],\n  ['final format is PDF', edge.includes("final_format: 'pdf'")],\n  ['identity document not requested', !edge.includes("categorie='identite'") && !edge.includes('justificatif_domicile')],\n];\nconst failures = checks.filter(([, ok]) => !ok);\nfor (const [name, ok] of checks) console.log((ok ? '✓' : '✗') + ' ' + name);\nif (failures.length) process.exit(1);\nconsole.log('Generated PDF document pipeline: ' + checks.length + '/' + checks.length + ' controls passed.');\n`;
fs.writeFileSync(testPath, test);

const pkgPath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.scripts['test:generated-documents'] = 'node scripts/test-generated-document-pipeline.mjs';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

console.log('PDF-first document integration patched.');
