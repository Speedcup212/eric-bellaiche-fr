const fs = require('fs');
const path = 'src/pages/portal/CifDossierSummaryPage.tsx';
let s = fs.readFileSync(path, 'utf8');
const marker = '<section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-8">';
const heading = 'Documents du dossier';
const start = s.indexOf(marker);
if (start < 0 || !s.slice(start, start + 5000).includes(heading)) {
  throw new Error('Bloc Documents du dossier introuvable');
}
const endToken = '</section>';
const end = s.indexOf(endToken, start);
if (end < 0) throw new Error('Fin du bloc Documents du dossier introuvable');
const block = s.slice(start, end + endToken.length);
s = s.slice(0, start) + s.slice(end + endToken.length);
const headerClose = '</header>';
const insertAt = s.indexOf(headerClose);
if (insertAt < 0) throw new Error('Header synthèse introuvable');
const afterHeader = insertAt + headerClose.length;
s = s.slice(0, afterHeader) + '\n\n    ' + block + s.slice(afterHeader);
fs.writeFileSync(path, s);
console.log('Bloc Documents du dossier déplacé sous la synthèse patrimoniale conseiller.');
