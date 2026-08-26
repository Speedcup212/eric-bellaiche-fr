const fs = require('fs');

const path = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let text = fs.readFileSync(path, 'utf8');

const oldTabs = `<div className="border-b border-white/10 px-6 py-4 sm:px-9"><div className="flex flex-wrap gap-2">{sections.map((section, index) => { const familyLocked = section.code === 'family' && progress.role_dossier === 'investisseur_2'; return <button key={section.code} type="button" disabled={familyLocked} title={familyLocked ? 'Informations communes gérées par l’Identifiant 1' : undefined} onClick={() => setStep(index)} className={\`rounded-full px-3 py-1.5 text-xs font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60 \${index === step ? 'bg-[#3B82F6] text-white shadow-sm' : doneSections.has(section.code) ? 'bg-[#10B981] text-white shadow-sm' : 'bg-white/10 text-[#94A3B8] hover:bg-white/15 hover:text-[#F1F5F9]'}\`}>{doneSections.has(section.code) ? '✓ ' : ''}{index + 1}. {section.label}</button>; })}</div></div>`;

const newTabs = `<div className="border-b border-white/10 px-4 py-4 sm:px-5"><div className="flex flex-nowrap items-center justify-between gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{sections.map((section, index) => { const familyLocked = section.code === 'family' && progress.role_dossier === 'investisseur_2'; return <button key={section.code} type="button" disabled={familyLocked} title={familyLocked ? 'Informations communes gérées par l’Identifiant 1' : undefined} onClick={() => setStep(index)} className={\`shrink-0 whitespace-nowrap rounded-full px-2 py-1.5 text-[10px] font-semibold leading-none transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60 lg:px-2.5 lg:text-[11px] \${index === step ? 'bg-[#3B82F6] text-white shadow-sm' : doneSections.has(section.code) ? 'bg-[#10B981] text-white shadow-sm' : 'bg-white/10 text-[#94A3B8] hover:bg-white/15 hover:text-[#F1F5F9]'}\`}>{doneSections.has(section.code) ? '✓ ' : ''}{index + 1}. {section.label}</button>; })}</div></div>`;

if (!text.includes(oldTabs)) throw new Error('Recueil tabs block not found');
text = text.replace(oldTabs, newTabs);

if (!text.includes('flex flex-nowrap items-center justify-between gap-1')) throw new Error('Tabs were not normalized to one row');
if (!text.includes('whitespace-nowrap rounded-full px-2 py-1.5 text-[10px]')) throw new Error('Compact tab sizing was not installed');

fs.writeFileSync(path, text);
console.log('Recueil section tabs harmonized on one row');
