const fs = require('fs');

const file = 'src/pages/portal/CifDossierSummaryPage.tsx';
let source = fs.readFileSync(file, 'utf8');

const oldReady = `  const readyDocumentTypes = useMemo(() => { if (!investors.length) return [] as GeneratedDocument['type'][]; const types: GeneratedDocument['type'][] = []; if (investors.every((i) => ['completed', 'validated'].includes(i.recueil_status))) types.push('recueil'); if (investors.every((i) => ['completed', 'validated'].includes(i.qpi_status))) types.push('qpi'); if (investors.every((i) => ['completed', 'validated', 'not_applicable'].includes(i.esg_status))) types.push('esg'); return types; }, [investors]);`;

const newReady = `  const questionnaireCompletion = useMemo(() => ({\n    recueil: investors.length > 0 && investors.every((i) => ['completed', 'validated'].includes(i.recueil_status)),\n    qpi: investors.length > 0 && investors.every((i) => ['completed', 'validated'].includes(i.qpi_status)),\n    esg: investors.length > 0 && investors.every((i) => ['completed', 'validated'].includes(i.esg_status)),\n  }), [investors]);\n  const readyDocumentTypes = useMemo(() => (Object.entries(questionnaireCompletion)\n    .filter(([, completed]) => completed)\n    .map(([type]) => type as GeneratedDocument['type'])), [questionnaireCompletion]);`;

if (!source.includes(oldReady)) throw new Error('readyDocumentTypes block not found');
source = source.replace(oldReady, newReady);

const oldCollect = `<div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Collecte client</p><div className="mt-3 flex flex-wrap gap-3">{generatingDocuments && <span className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700"><Loader2 className="h-4 w-4 animate-spin" /> Génération…</span>}{generatedDocuments.map((document) => document.signed_url ? <a key={document.document_id} href={document.signed_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><Download className="h-4 w-4" /> {generatedDocumentLabel[document.type]}<span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase">Disponible</span></a> : null)}</div></div>`;

const newCollect = `<div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Collecte client</p><div className="mt-3 grid gap-3 sm:grid-cols-3">{(['recueil', 'qpi', 'esg'] as GeneratedDocument['type'][]).map((type) => { const completed = questionnaireCompletion[type]; const document = generatedDocuments.find((item) => item.type === type && item.signed_url); const classes = completed ? 'border-emerald-500/50 bg-emerald-950/30 text-emerald-100' : 'border-red-500/50 bg-red-950/30 text-red-100'; const badge = completed ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'; const content = <><span className="text-sm font-semibold">{generatedDocumentLabel[type]}</span><span className={\`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase \${badge}\`}>{completed ? 'Rempli' : 'Non rempli'}</span></>; return document?.signed_url ? <a key={type} href={document.signed_url} target="_blank" rel="noreferrer" className={\`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 \${classes}\`}><span className="inline-flex items-center gap-2"><Download className="h-4 w-4" />{content}</span></a> : <div key={type} className={\`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 \${classes}\`}>{content}</div>; })}{generatingDocuments && <span className="inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-950/20 px-4 py-3 text-sm font-semibold text-blue-200"><Loader2 className="h-4 w-4 animate-spin" /> Génération…</span>}</div></div>`;

if (!source.includes(oldCollect)) throw new Error('Collecte client block not found');
source = source.replace(oldCollect, newCollect);

fs.writeFileSync(file, source);
console.log('Questionnaire collection status fixed.');
