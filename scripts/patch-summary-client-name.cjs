const fs = require('fs');

const file = 'src/pages/portal/CifDossierSummaryPage.tsx';
let source = fs.readFileSync(file, 'utf8');

const memoAnchor = `  const household = useMemo(() => consolidateHousehold(sections.map((row) => ({ investisseur_id: row.investisseur_id, role_dossier: investors.find((i) => i.investisseur_id === row.investisseur_id)?.role_dossier ?? '', section_code: row.section_code, payload: row.payload }))), [sections, investors]);\n`;
const memoReplacement = `${memoAnchor}  const clientDisplayName = useMemo(() => {\n    const names = investors\n      .map((investor) => investor.investisseurs ? [investor.investisseurs.prenom, investor.investisseurs.nom].filter(Boolean).join(' ').trim() : '')\n      .filter(Boolean);\n    return names.length ? names.join(' & ') : (dossier?.libelle || 'Dossier client');\n  }, [investors, dossier?.libelle]);\n`;

if (!source.includes('const clientDisplayName = useMemo(')) {
  if (!source.includes(memoAnchor)) throw new Error('Household memo anchor not found');
  source = source.replace(memoAnchor, memoReplacement);
}

const oldHeader = `<header className="rounded-3xl bg-slate-950 p-7 text-white shadow-sm sm:p-9"><Link to="/cabinet" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-200"><ArrowLeft className="h-4 w-4" /> Retour aux dossiers</Link><p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Synthèse patrimoniale conseiller</p><h1 className="mt-2 text-3xl font-semibold">{dossier.reference || dossier.libelle || 'Dossier client'}</h1><p className="mt-2 text-sm text-slate-300">Vue de travail complète : situation, patrimoine, objectifs, profil réglementaire, pièces et contrôles CIF.</p></header>`;

const newHeader = `<header className="rounded-3xl bg-slate-950 p-7 text-white shadow-sm sm:p-9"><Link to="/cabinet" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-200"><ArrowLeft className="h-4 w-4" /> Retour aux dossiers</Link><p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Synthèse patrimoniale conseiller</p><h1 className="mt-2 text-3xl font-semibold">{clientDisplayName}</h1>{dossier.reference ? <p className="mt-1 text-xs font-medium text-slate-500">Dossier {dossier.reference}</p> : null}<p className="mt-2 text-sm text-slate-300">Vue de travail complète : situation, patrimoine, objectifs, profil réglementaire, pièces et contrôles CIF.</p></header>`;

if (!source.includes(newHeader)) {
  if (!source.includes(oldHeader)) throw new Error('Summary header anchor not found');
  source = source.replace(oldHeader, newHeader);
}

fs.writeFileSync(file, source);
console.log('Client name summary header applied.');
