const fs = require('fs');
const file = 'src/pages/portal/CifDossierSummaryPage.tsx';
let source = fs.readFileSync(file, 'utf8');

const old = `<div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3"><p className="text-sm font-semibold text-slate-900">DER</p><p className="mt-1 text-[11px] font-semibold text-amber-700">À générer</p></div><div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3"><p className="text-sm font-semibold text-slate-900">Lettre de mission</p><p className="mt-1 text-[11px] font-semibold text-amber-700">À générer</p></div>`;
const replacement = `<div className="rounded-xl border border-[#315173] bg-[#0B1A2F] px-4 py-3 shadow-sm"><p className="text-sm font-semibold text-white">DER</p><p className="mt-1 text-[11px] font-semibold text-amber-300">À générer</p></div><div className="rounded-xl border border-[#315173] bg-[#0B1A2F] px-4 py-3 shadow-sm"><p className="text-sm font-semibold text-white">Lettre de mission</p><p className="mt-1 text-[11px] font-semibold text-amber-300">À générer</p></div>`;

if (!source.includes(old)) throw new Error('Regulatory cards anchor not found');
source = source.replace(old, replacement);
fs.writeFileSync(file, source);
console.log('Regulatory cards switched to dark theme.');
