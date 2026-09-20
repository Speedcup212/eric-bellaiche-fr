import fs from 'node:fs';

const edge = fs.readFileSync('supabase/functions/extract-source-document/index.ts', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260920190500_source_document_auto_enrichment.sql', 'utf8');
const documents = fs.readFileSync('src/pages/portal/ClientDocumentsPage.tsx', 'utf8');
const summary = fs.readFileSync('src/pages/portal/CifDossierSummaryPage.tsx', 'utf8');

const checks = [
  ['edge requires authenticated document access', edge.includes("from('documents_sources')") && edge.includes("Authorization: auth")],
  ['service role performs controlled internal writes', edge.includes('SUPABASE_SERVICE_ROLE_KEY') && migration.includes("grant execute on function public.apply_source_document_extraction")],
  ['public and client direct extraction RPC denied', migration.includes('revoke all on function public.apply_source_document_extraction') && migration.includes('anon, authenticated')],
  ['existing client value is not silently overwritten', migration.includes("v_status := 'a_verifier'") && migration.includes('la déclaration client est conservée')],
  ['document provenance is persisted', migration.includes("methode_collecte='extraction_document'") && migration.includes('public.data_provenance')],
  ['tax notice parser feeds tax recueil section', edge.includes("section_code: 'tax'") && edge.includes('revenu_fiscal_reference') && edge.includes('revenu_imposable')],
  ['credit parser adds documented loan facts', edge.includes("section_code: 'credits'") && edge.includes('documented_loan_facts')],
  ['financial parser adds documented accounts', edge.includes("section_code: 'financial'") && edge.includes('documented_accounts')],
  ['images are never guessed from filename alone', edge.includes('Image reçue : extraction automatique différée') && edge.includes("p_status: 'to_review'")],
  ['client upload triggers extraction', documents.includes("functions.invoke('extract-source-document'") && documents.includes('registeredDocumentId')],
  ['advisor summary lists actual source documents', summary.includes("from('documents_sources')") && summary.includes('Justificatifs clients')],
  ['advisor opening backfills legacy uploaded documents', summary.includes("doc.statut_analyse === 'uploaded'") && summary.includes("functions.invoke('extract-source-document'")],
  ['recueil PDFs regenerate after enriched section data', summary.includes('const recueilData = sections.map') && summary.includes('documentGenerationKey')],
  ['analysis details are visible to advisor', summary.includes('fields_applied') && summary.includes('conflicts_detected')],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log(`Source document enrichment: ${checks.length}/${checks.length} controls passed.`);
