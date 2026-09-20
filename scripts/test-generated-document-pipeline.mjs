import fs from 'node:fs';

const page = fs.readFileSync('src/pages/portal/CifDossierSummaryPage.tsx', 'utf8');
const edgePath = 'supabase/functions/generate-cif-pdfs/index.ts';
const edge = fs.readFileSync(edgePath, 'utf8');
const checks = [
  ['portal invokes PDF generator', page.includes("functions.invoke('generate-cif-pdfs'")],
  ['recueil PDF readiness per investor', page.includes("const recueil = ['completed', 'validated'].includes(investor.recueil_status)")],
  ['qpi PDF readiness per investor', page.includes("const qpi = ['completed', 'validated'].includes(investor.qpi_status)")],
  ['esg PDF readiness per investor', page.includes("const esg = ['completed', 'validated'].includes(investor.esg_status)") && page.includes('esgNotApplicable')],
  ['ready document types derived per investor', page.includes('readyTypes') && page.includes('investorDocumentStates') && page.includes('investisseur_id: state.investor.investisseur_id')],
  ['PDF download links exposed only from signed URL', page.includes('document?.signed_url') && page.includes('href={document.signed_url}') && page.includes('generatedDocumentLabel[type]')],
  ['individual PDF scoping supported', edge.includes('targetInvestorId') && edge.includes('scopeSnapshotToInvestor') && edge.includes('investisseur_id: targetInvestorId || null')],
  ['PDF generator versioned', /PDF_VERSION\s*=\s*'2026-MAITRE-PDF-\d+\.\d+'/.test(edge)],
  ['private regulatory storage used', edge.includes("BUCKET = 'regulatory-docs'")],
  ['PDF path archived', edge.includes('storage_path_pdf') && !edge.includes('storage_path_docx: storagePath')],
  ['PDF MIME type used', edge.includes("contentType: 'application/pdf'")],
  ['PDF extension used', edge.includes('.pdf')],
  ['documents hashed', edge.includes('hash_sha256') && edge.includes('snapshot_hash')],
  ['Youtrust handoff metadata', edge.includes("signature_provider: 'youtrust'") && edge.includes("signature_status: type === 'recueil'") && edge.includes("'draft' : 'ready_to_send'")],
  ['incomplete recueil stays draft', edge.includes("DOCUMENT DE TRAVAIL - RECUEIL INCOMPLET") && edge.includes("recueil_complete") && edge.includes("recueil_percentage")],
  ['missing tax values are omitted instead of rendered as zero', edge.includes("rows.filter(([, value]) => hasValue(value))") && edge.includes("Total des prélèvements sociaux nets") && edge.includes("Taux moyen d’imposition")],
  ['financial PDF separates evidence from estimates', edge.includes("Sous-total directement justifié par pièces") && edge.includes("Total financier indicatif du dossier") && edge.includes("source_document_id ? 'Justificatif'")],
  ['French number formatting removes unsupported narrow spaces', edge.includes("replace(/[\\u00A0\\u202F]/g, ' ')") && edge.includes('function frNumber')],
  ['credit PDF uses extracted rate and deferred payment fields', edge.includes("pct(x.taux_credit ?? x.taux)") && edge.includes('mensualite_future')],
  ['credit PDF renders detailed financing sheets', edge.includes("Crédits et endettement détaillés") && edge.includes("Référence du prêt") && edge.includes("Durée actualisée restante") && edge.includes("Coût total de l’assurance") && edge.includes("TAEG") && edge.includes("Garantie / sûreté")],
  ['tax PDF starts with CRM-mapped fiscal identifiers', edge.includes("numero_fiscal_identifiant_1") && edge.includes("numero_fiscal_identifiant_2") && edge.includes("Identifiant 1") && edge.includes("Identifiant 2") && edge.includes("Référence de l’avis")],
  ['tax PDF exposes maximum useful notice detail', edge.includes("Revenus déclarés") && edge.includes("Calcul de l’impôt sur le revenu") && edge.includes("Prélèvements sociaux") && edge.includes("Solde de l’impôt et remboursement") && edge.includes("Plafond épargne retraite - ${id1Name}") && edge.includes("Plafond épargne retraite - ${id2Name}")],
  ['final format is PDF', edge.includes("final_format: 'pdf'")],
  ['identity document not requested', !edge.includes("categorie='identite'") && !edge.includes('justificatif_domicile')],
];
const failures = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log((ok ? '✓' : '✗') + ' ' + name);
if (failures.length) process.exit(1);
console.log('Generated PDF document pipeline: ' + checks.length + '/' + checks.length + ' controls passed.');
