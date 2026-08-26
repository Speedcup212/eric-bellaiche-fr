const fs = require('fs');

const path = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let text = fs.readFileSync(path, 'utf8');

// Retire l'ancienne version du bandeau qui n'était affichée que dans Identité.
text = text.replace(/\{current\.code === 'identity' && <><div className="mb-7 flex items-center justify-between gap-4 rounded-2xl border border-blue-400\/30 bg-\[#132644\] px-5 py-4 shadow-sm">[\s\S]*?<\/div><div className="recueil-question-grid recueil-question-grid--3 grid gap-x-5 gap-y-7 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-8">/, `{current.code === 'identity' && <><div className="recueil-question-grid recueil-question-grid--3 grid gap-x-5 gap-y-7 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-8">`);

const contentMarker = `      <div className="space-y-10 px-6 py-9 sm:px-9 sm:py-12">`;
const banner = `      <div className="space-y-10 px-6 py-9 sm:px-9 sm:py-12">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-blue-400/30 bg-[#132644] px-5 py-4 shadow-sm">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#93C5FD]">Personne concernée</p>
            <p className="mt-1 text-lg font-bold text-white">{progress.role_dossier === 'investisseur_2' ? 'Identifiant 2' : 'Identifiant 1'}{(forms.identity?.prenom || forms.identity?.nom) ? \` — \${[forms.identity?.prenom, forms.identity?.nom].filter(Boolean).join(' ')}\` : ''}</p>
          </div>
          <span className="shrink-0 rounded-full bg-[#3B82F6] px-3.5 py-1.5 text-xs font-bold text-white">{progress.role_dossier === 'investisseur_2' ? '2' : '1'}</span>
        </div>`;

if (!text.includes('Personne concernée')) {
  if (!text.includes(contentMarker)) throw new Error('Main recueil content marker not found');
  text = text.replace(contentMarker, banner);
} else if (!text.includes("forms.identity?.prenom")) {
  throw new Error('A legacy person banner is still present');
}

if (!text.includes("forms.identity?.prenom") || !text.includes("progress.role_dossier === 'investisseur_2' ? 'Identifiant 2' : 'Identifiant 1'")) {
  throw new Error('Global person banner missing');
}

fs.writeFileSync(path, text);
console.log('Global recueil person banner installed on every section');
