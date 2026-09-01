const fs = require('fs');

const file = 'src/pages/portal/ClientDocumentsPage.tsx';
let src = fs.readFileSync(file, 'utf8');

const oldText = `{finalBlocked && <div className="border-t border-amber-200 bg-amber-50 px-6 py-4 text-sm leading-6 text-amber-900 sm:px-9">{waitingPartner ? 'La transmission reste en attente de l’autre parcours individuel.' : !allContextsComplete ? 'Chaque personne doit d’abord préciser sa situation documentaire, y compris le motif si elle ne dispose pas encore d’un avis d’imposition.' : \`Pièce\${missingRequired.length > 1 ? 's' : ''} obligatoire\${missingRequired.length > 1 ? 's' : ''} manquante\${missingRequired.length > 1 ? 's' : ''} : \${missingRequired.map((item) => item.label).join(', ')}.\`}</div>}`;

const newText = `{finalBlocked && <div className="mx-6 my-4 rounded-xl border border-amber-300 bg-amber-100 px-4 py-3 text-sm font-semibold leading-6 text-amber-950 shadow-sm sm:mx-9">{waitingPartner ? 'La transmission reste en attente de l’autre parcours individuel.' : !allContextsComplete ? 'Chaque personne doit d’abord préciser sa situation documentaire, y compris le motif si elle ne dispose pas encore d’un avis d’imposition.' : \`Pièce\${missingRequired.length > 1 ? 's' : ''} obligatoire\${missingRequired.length > 1 ? 's' : ''} manquante\${missingRequired.length > 1 ? 's' : ''} : \${missingRequired.map((item) => item.label).join(', ')}.\`}</div>}`;

if (!src.includes(oldText)) throw new Error('Target finalBlocked warning block not found');
src = src.replace(oldText, newText);
fs.writeFileSync(file, src);
console.log('Documents missing-warning contrast updated.');
