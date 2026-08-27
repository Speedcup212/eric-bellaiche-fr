const fs = require('fs');

const pagePath = 'src/pages/portal/CifDossierSummaryPage.tsx';
let page = fs.readFileSync(pagePath, 'utf8');

page = page.replace(
  "import { AlertCircle, AlertTriangle, ArrowLeft, CheckCircle2, FileCheck2, Home, ShieldCheck, UserRound } from 'lucide-react';",
  "import { AlertCircle, AlertTriangle, ArrowLeft, CheckCircle2, Download, FileCheck2, FileText, Home, Loader2, ShieldCheck, UserRound } from 'lucide-react';",
);

const typeAnchor = "type ChecklistRow = ChecklistItemInput & { document_code?: string | null; libelle?: string | null; source_document_id?: string | null };";
if (!page.includes('type GeneratedDocument =')) {
  page = page.replace(typeAnchor, `${typeAnchor}\ntype GeneratedDocument = { type: 'recueil' | 'qpi' | 'esg'; document_id: string; signed_url: string | null; path: string; reused: boolean };`);
}

const labelAnchor = "const financialCategoryLabel: Record<string, string> = {\n  savings: 'Livrets / épargne bancaire', life_insurance: 'Assurance-vie', retirement: 'PER / retraite', securities: 'PEA / compte-titres', paper_real_estate: 'SCPI / OPCI', employee_savings: 'Épargne salariale', other: 'Autres placements',\n};";
if (!page.includes('const generatedDocumentLabel')) {
  page = page.replace(labelAnchor, `${labelAnchor}\n\nconst generatedDocumentLabel: Record<GeneratedDocument['type'], string> = {\n  recueil: 'Recueil d’informations',\n  qpi: 'Profil investisseur',\n  esg: 'Questionnaire ESG',\n};`);
}

const stateAnchor = "  const [errorMessage, setErrorMessage] = useState('');\n  const [loading, setLoading] = useState(true);";
if (!page.includes('generatedDocuments')) {
  page = page.replace(stateAnchor, `${stateAnchor}\n  const [generatedDocuments, setGeneratedDocuments] = useState<GeneratedDocument[]>([]);\n  const [generatingDocuments, setGeneratingDocuments] = useState(false);\n  const [generationMessage, setGenerationMessage] = useState('');`);
}

const hookAnchor = "  const investorSummaries = useMemo(() => investors.map((investor) => {\n    const investorSections = sections.filter((row) => row.investisseur_id === investor.investisseur_id);\n    const payloadByCode = Object.fromEntries(investorSections.map((row) => [row.section_code, row.payload ?? {}]));\n    const spouse = investors.find((row) => row.investisseur_id !== investor.investisseur_id)?.investisseurs ?? null;\n    const context = contexts.find((row) => row.investisseur_id === investor.investisseur_id) ?? {};\n    const snapshot: ConsistencySnapshot = {\n      identity: payloadByCode.identity ?? {}, family: payloadByCode.family ?? {}, professional: payloadByCode.professional ?? {}, capacity: payloadByCode.capacity ?? {}, patrimony: payloadByCode.patrimony ?? {}, financial: payloadByCode.financial ?? {}, credits: payloadByCode.credits ?? {}, regulatory: payloadByCode.regulatory ?? {}, documents: context, spouse,\n    };\n    const issues = evaluateConsistency(snapshot);\n    const investorProvenance = provenance.filter((row) => !row.investisseur_id || row.investisseur_id === investor.investisseur_id);\n    const summary = summarizeAdvisorDossier({ sections: investorSections, provenance: investorProvenance, checklist, issues, roleDossier: investor.role_dossier });\n    return { investor, issues, summary };\n  }), [investors, sections, contexts, provenance, checklist]);";

const generationHooks = `\n\n  const readyDocumentTypes = useMemo(() => {\n    if (investors.length === 0) return [] as GeneratedDocument['type'][];\n    const types: GeneratedDocument['type'][] = [];\n    if (investors.every((investor) => ['completed', 'validated'].includes(investor.recueil_status))) types.push('recueil');\n    if (investors.every((investor) => ['completed', 'validated'].includes(investor.qpi_status))) types.push('qpi');\n    if (investors.every((investor) => ['completed', 'validated', 'not_applicable'].includes(investor.esg_status))) types.push('esg');\n    return types;\n  }, [investors]);\n\n  useEffect(() => {\n    if (!dossierId || !dossier || readyDocumentTypes.length === 0) return;\n    let active = true;\n    const generate = async () => {\n      setGeneratingDocuments(true);\n      setGenerationMessage('');\n      const { data, error } = await supabase.functions.invoke('generate-cif-documents', {\n        body: { dossier_id: dossierId, document_types: readyDocumentTypes },\n      });\n      if (error) throw error;\n      if (!data?.ok || !Array.isArray(data.documents)) throw new Error(data?.error || 'Génération documentaire impossible.');\n      if (active) setGeneratedDocuments(data.documents as GeneratedDocument[]);\n    };\n    void generate().catch((error) => { if (active) setGenerationMessage(messageFromError(error)); }).finally(() => { if (active) setGeneratingDocuments(false); });\n    return () => { active = false; };\n  }, [dossierId, dossier?.id, readyDocumentTypes.join('|')]);`;

if (!page.includes('const readyDocumentTypes = useMemo')) {
  if (!page.includes(hookAnchor)) throw new Error('Investor summary hook anchor not found');
  page = page.replace(hookAnchor, hookAnchor + generationHooks);
}

const jsxAnchor = "    <section className=\"rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8\">\n      <div className=\"flex items-start gap-3\"><div className=\"rounded-2xl bg-blue-50 p-3\"><Home className=\"h-5 w-5 text-blue-700\" /></div>";
const panel = `    <section className=\"rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-8\">\n      <div className=\"flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between\">\n        <div className=\"flex items-start gap-3\"><div className=\"rounded-2xl bg-emerald-50 p-3\"><FileText className=\"h-5 w-5 text-emerald-700\" /></div><div><p className=\"text-xs font-bold uppercase tracking-[0.14em] text-emerald-700\">Documents automatiques</p><h2 className=\"mt-1 text-xl font-semibold text-slate-950\">Recueil, profil et ESG générés depuis Supabase</h2><p className=\"mt-1 max-w-3xl text-sm leading-6 text-slate-500\">Dès qu’un document est finalisé pour tous les investisseurs, sa version Word à signer est générée automatiquement à partir des données enregistrées. Une version identique est réutilisée tant que les données n’ont pas changé.</p></div></div>\n        {generatingDocuments && <span className=\"inline-flex items-center gap-2 self-start rounded-full bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700\"><Loader2 className=\"h-4 w-4 animate-spin\" /> Génération…</span>}\n      </div>\n      {generationMessage && <p className=\"mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900\">{generationMessage}</p>}\n      <div className=\"mt-5 flex flex-wrap gap-3\">\n        {generatedDocuments.map((document) => document.signed_url ? <a key={document.document_id} href={document.signed_url} target=\"_blank\" rel=\"noreferrer\" className=\"inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100\"><Download className=\"h-4 w-4\" /> {generatedDocumentLabel[document.type]}</a> : null)}\n        {!generatingDocuments && generatedDocuments.length === 0 && readyDocumentTypes.length > 0 && <p className=\"text-sm text-slate-500\">Les documents finalisés seront générés automatiquement.</p>}\n        {readyDocumentTypes.length === 0 && <p className=\"text-sm text-slate-500\">Aucun document n’est encore finalisé pour l’ensemble du dossier.</p>}\n      </div>\n      <p className=\"mt-4 text-xs leading-5 text-slate-400\">Les fichiers sont archivés dans le dossier réglementaire avec leur hash SHA-256 et un instantané des données. Ils sont préparés pour l’étape de signature électronique Youtrust.</p>\n    </section>\n\n`;
if (!page.includes('Documents automatiques')) {
  if (!page.includes(jsxAnchor)) throw new Error('JSX anchor not found');
  page = page.replace(jsxAnchor, panel + jsxAnchor);
}

fs.writeFileSync(pagePath, page);

const testPath = 'scripts/test-generated-document-pipeline.mjs';
const test = `import fs from 'node:fs';\n\nconst page = fs.readFileSync('src/pages/portal/CifDossierSummaryPage.tsx', 'utf8');\nconst edge = fs.existsSync('supabase/functions/generate-cif-documents/index.ts') ? fs.readFileSync('supabase/functions/generate-cif-documents/index.ts', 'utf8') : '';\n\nconst checks = [\n  ['portal invokes edge generator', page.includes("functions.invoke('generate-cif-documents'")],\n  ['recueil generation readiness', page.includes("types.push('recueil')")],\n  ['qpi generation readiness', page.includes("types.push('qpi')")],\n  ['esg generation readiness', page.includes("types.push('esg')")],\n  ['download links exposed', page.includes('generatedDocumentLabel[document.type]')],\n  ['edge source mirrored', edge.includes("DOC_VERSION = '2026-MAITRE-1.0'")],\n  ['regulatory storage used', edge.includes("BUCKET = 'regulatory-docs'")],\n  ['documents are hashed', edge.includes('hash_sha256') && edge.includes('snapshot_hash')],\n  ['Youtrust handoff metadata', edge.includes("signature_provider: 'youtrust'")],\n  ['identity document not requested', !edge.includes("categorie='identite'") && !edge.includes('justificatif_domicile')],\n];\nconst failures = checks.filter(([, ok]) => !ok);\nfor (const [name, ok] of checks) console.log((ok ? '✓' : '✗') + ' ' + name);\nif (failures.length) process.exit(1);\nconsole.log('Generated document pipeline: ' + checks.length + '/' + checks.length + ' controls passed.');\n`;
fs.writeFileSync(testPath, test);

const packagePath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts['test:generated-documents'] = 'node scripts/test-generated-document-pipeline.mjs';
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');

const workflowPath = '.github/workflows/portal-ci.yml';
let workflow = fs.readFileSync(workflowPath, 'utf8');
if (!workflow.includes('Generated document pipeline')) {
  workflow = workflow.replace(
    "      - name: Document requirements policy\n        run: npm run test:document-policy\n",
    "      - name: Document requirements policy\n        run: npm run test:document-policy\n      - name: Generated document pipeline\n        run: npm run test:generated-documents\n",
  );
}
fs.writeFileSync(workflowPath, workflow);

console.log('Generated document integration patched.');
