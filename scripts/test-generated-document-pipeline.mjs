import fs from 'node:fs';

const page = fs.readFileSync('src/pages/portal/CifDossierSummaryPage.tsx', 'utf8');
const edgePath = 'supabase/functions/generate-cif-pdfs/index.ts';
const edge = fs.readFileSync(edgePath, 'utf8');
const checks = [
  ['portal invokes PDF generator', page.includes("functions.invoke('generate-cif-pdfs'")],
  ['recueil PDF readiness', page.includes("recueil: investors.length > 0") && page.includes("recueil_status")],
  ['qpi PDF readiness', page.includes("qpi: investors.length > 0") && page.includes("qpi_status")],
  ['esg PDF readiness', page.includes("esg: investors.length > 0") && page.includes("esg_status")],
  ['ready document types derived from completion map', page.includes('readyDocumentTypes') && page.includes('Object.entries(questionnaireCompletion)')],
  ['PDF download links exposed only from signed URL', page.includes('document?.signed_url') && page.includes('href={document.signed_url}') && page.includes('generatedDocumentLabel[type]')],
  ['PDF generator versioned', /PDF_VERSION\s*=\s*'2026-MAITRE-PDF-\d+\.\d+'/.test(edge)],
  ['private regulatory storage used', edge.includes("BUCKET = 'regulatory-docs'")],
  ['PDF path archived', edge.includes('storage_path_pdf') && !edge.includes('storage_path_docx: storagePath')],
  ['PDF MIME type used', edge.includes("contentType: 'application/pdf'")],
  ['PDF extension used', edge.includes('.pdf')],
  ['documents hashed', edge.includes('hash_sha256') && edge.includes('snapshot_hash')],
  ['Youtrust handoff metadata', edge.includes("signature_provider: 'youtrust'") && edge.includes("signature_status: 'ready_to_send'")],
  ['final format is PDF', edge.includes("final_format: 'pdf'")],
  ['identity document not requested', !edge.includes("categorie='identite'") && !edge.includes('justificatif_domicile')],
];
const failures = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log((ok ? '✓' : '✗') + ' ' + name);
if (failures.length) process.exit(1);
console.log('Generated PDF document pipeline: ' + checks.length + '/' + checks.length + ' controls passed.');
