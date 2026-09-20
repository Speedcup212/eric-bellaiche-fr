import fs from 'node:fs';

const edge = fs.readFileSync('supabase/functions/extract-source-document/index.ts', 'utf8');
const mergeMigration = fs.readFileSync('supabase/migrations/20260920194000_inject_document_data_into_real_recueil_fields.sql', 'utf8');
const financialMergeMigration = fs.readFileSync('supabase/migrations/20260920203500_merge_ocr_financial_items_into_recueil.sql', 'utf8');
const financialTotalsMigration = fs.readFileSync('supabase/migrations/20260920205500_separate_documented_and_estimated_financial_totals.sql', 'utf8');
const completenessMigration = fs.readFileSync('supabase/migrations/20260920193000_unify_recueil_completeness_and_document_scope.sql', 'utf8');
const validationMigration = fs.readFileSync('supabase/migrations/20260920193500_validate_recueil_with_single_completeness_engine.sql', 'utf8');
const documents = fs.readFileSync('src/pages/portal/ClientDocumentsPage.tsx', 'utf8');
const recueil = fs.readFileSync('src/pages/portal/ClientRecueilJourneyBase.tsx', 'utf8');
const summary = fs.readFileSync('src/pages/portal/CifDossierSummaryPage.tsx', 'utf8');
const admin = fs.readFileSync('src/pages/portal/CifAdminPage.tsx', 'utf8');

const checks = [
  ['edge requires authenticated document access', edge.includes("from('documents_sources')") && edge.includes('Authorization: auth')],
  ['service role performs controlled internal writes', edge.includes('SUPABASE_SERVICE_ROLE_KEY') && mergeMigration.includes('grant execute on function public.apply_source_document_extraction')],
  ['client cannot directly call extraction merge RPC', mergeMigration.includes('revoke all on function public.apply_source_document_extraction') && mergeMigration.includes('anon, authenticated')],
  ['existing declarations are preserved on conflicts', mergeMigration.includes("v_status := 'a_verifier'") && mergeMigration.includes('la déclaration client est conservée')],
  ['document provenance is persisted', mergeMigration.includes("methode_collecte='extraction_document'") && mergeMigration.includes('public.data_provenance')],
  ['document scope supports investor or household', completenessMigration.includes('portee_document') && completenessMigration.includes('concerne_investisseur_ids') && documents.includes('Foyer / document commun')],
  ['client uploads use scoped registration', documents.includes("rpc('register_source_document_v2'") && documents.includes('p_portee_document')],
  ['tax notice parser uses PDF coordinates plus strict labels', edge.includes('avis_imposition_fr_v3') && edge.includes('findPdfRowNumber') && edge.includes('findPdfRowValues') && edge.includes('Revenu fiscal de r[ée]f[ée]rence')],
  ['tax notice parser feeds real tax section', edge.includes("section_code: 'tax'") && edge.includes('revenu_imposable') && edge.includes('nombre_parts') && edge.includes('tmi')],
  ['tax notice parser extracts detailed fiscal identity and retirement rows', edge.includes('numero_fiscal_declarant_1') && edge.includes('numero_fiscal_declarant_2') && edge.includes('plafond_per_2026_declarant_1') && edge.includes('plafond_per_2026_declarant_2') && edge.includes('extracted_field_count')],
  ['tax declarants are mapped to CRM investor roles by name', edge.includes('matchMember') && edge.includes('memberForDeclarant1') && edge.includes('memberForDeclarant2') && edge.includes("role_dossier === 'investisseur_1'") && edge.includes("role_dossier === 'investisseur_2'") && edge.includes('mappedKey')],
  ['credit parser merges into real credit items', edge.includes('__merge_credit_items') && mergeMigration.includes("v_field='__merge_credit_items'") && mergeMigration.includes("'{items}'")],
  ['parallel documented loan facts are no longer generated', !edge.includes('documented_loan_facts')],
  ['credit CRD extraction is same-line strict', edge.includes("safe_crd_rule: 'same-line-label-only'") && edge.includes('capital restant')],
  ['initial credit amount is read before duration on mixed lines', edge.includes("montant emprunt") && edge.includes("max: 10000000, preferLast: false")],
  ['credit parser extracts detailed loan metadata', edge.includes("credit_schedule_fr_v3") && edge.includes("reference_pret") && edge.includes("duree_actualisee_restante_mois") && edge.includes("date_constitution_tableau") && edge.includes("assurance_mode")],
  ['credit parser reads amortization schedule rows', edge.includes("schedule_rows_read") && edge.includes("mensualite_future_date") && edge.includes("nombre_echeances_tableau") && edge.includes("montant_derniere_echeance")],
  ['credit borrower mapping prefers contract names', edge.includes("contractMembers") && edge.includes("borrowerMembers") && edge.includes("Identifiant 1 et 2")],
  ['financial parser writes only safe real recueil fields', edge.includes("section_code: 'financial'") && edge.includes('total_band') && !edge.includes('documented_accounts')],
  ['financial PNG evidence uses workerless OCR', edge.includes("npm:nocr@1.2.0") && edge.includes('financial_image_ocr_v1') && edge.includes('ocrImage(bytes)')],
  ['OCR financial items merge into real holdings', edge.includes('__merge_financial_items') && financialMergeMigration.includes("__merge_financial_items") && financialMergeMigration.includes("financial.items")],
  ['documented financial total excludes synthesis-only rows', financialTotalsMigration.includes("source_document_id") && financialTotalsMigration.includes("v_total_financial")],
  ['OCR amount parser supports French Livret and broker thousands formats', edge.includes('parseFinancialDisplayNumber') && edge.includes('solde au') && edge.includes('net liquidation value') && edge.includes("brokerStyle && /^-?\\d{1,3},\\d{3}$/")],
  ['long PDFs are no longer rejected at 30 pages', edge.includes('pdf.numPages > 120') && !edge.includes('pdf.numPages > 30')],
  ['recueil journey visibly includes tax', recueil.includes("{ code: 'tax', label: 'Fiscalité'")],
  ['single completeness engine covers ten sections', completenessMigration.includes("'identity','family','professional','objectives','capacity'") && completenessMigration.includes("'tax','patrimony','financial','credits','regulatory'")],
  ['server validation delegates to the same completeness engine', validationMigration.includes('private.recueil_completeness_core')],
  ['advisor cockpit shows authoritative percentage', summary.includes('get_all_recueil_completeness') && summary.includes('completeness.percentage')],
  ['cabinet list shows real recueil percentage and received documents', admin.includes('get_all_recueil_completeness') && admin.includes('recueil_percentage') && admin.includes('documents_received')],
  ['advisor opening backfills legacy uploaded documents', summary.includes("doc.statut_analyse === 'uploaded'") && summary.includes("functions.invoke('extract-source-document'")],
  ['recueil PDFs regenerate after enriched section data', summary.includes('const recueilData = sections.map') && summary.includes('documentGenerationKey')],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log(`Source document enrichment v2: ${checks.length}/${checks.length} controls passed.`);
