const fs = require('fs');
const path = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let source = fs.readFileSync(path, 'utf8');

const replacements = [
  [
    "const firstIncomplete = sections.findIndex((s) => !completed.has(s.code));",
    "const firstIncomplete = sections.findIndex((s) => !(row.role_dossier === 'investisseur_2' && s.code === 'family') && !completed.has(s.code));",
  ],
  [
    "const nextIncomplete = sections.findIndex((section, index) => index !== step && !doneSections.has(section.code));",
    "const nextIncomplete = sections.findIndex((section, index) => index !== step && !(progress.role_dossier === 'investisseur_2' && section.code === 'family') && !doneSections.has(section.code));",
  ],
];

for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`Expected source not found: ${before}`);
  source = source.replace(before, after);
}

fs.writeFileSync(path, source);
console.log('Couple navigation patched: shared family section is skipped for Identifiant 2.');
