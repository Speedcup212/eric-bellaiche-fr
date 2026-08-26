const fs = require('fs');

const path = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let text = fs.readFileSync(path, 'utf8');

const target = `        {current.code === 'identity' && <><div className="recueil-question-grid recueil-question-grid--3 grid gap-x-5 gap-y-7 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-8">`;
const replacement = `        {current.code === 'identity' && <><div className="mb-7 flex items-center justify-between gap-4 rounded-2xl border border-blue-400/30 bg-[#132644] px-5 py-4 shadow-sm">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#93C5FD]">Personne concernée</p>
            <p className="mt-1 text-lg font-bold text-white">{progress.role_dossier === 'investisseur_2' ? 'Identifiant 2' : 'Identifiant 1'}{(form.prenom || form.nom) ? \` — \${[form.prenom, form.nom].filter(Boolean).join(' ')}\` : ''}</p>
          </div>
          <span className="shrink-0 rounded-full bg-[#3B82F6] px-3.5 py-1.5 text-xs font-bold text-white">{progress.role_dossier === 'investisseur_2' ? '2' : '1'}</span>
        </div><div className="recueil-question-grid recueil-question-grid--3 grid gap-x-5 gap-y-7 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-8">`;

if (!text.includes(target)) throw new Error('Identity block marker not found');
text = text.replace(target, replacement);

if (!text.includes("Personne concernée")) throw new Error('Identity person banner missing');
if (!text.includes("progress.role_dossier === 'investisseur_2' ? 'Identifiant 2' : 'Identifiant 1'")) throw new Error('Identity role mapping missing');

fs.writeFileSync(path, text);
console.log('Identity person banner installed');
