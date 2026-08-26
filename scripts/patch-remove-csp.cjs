const fs = require('fs');
const p = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let s = fs.readFileSync(p, 'utf8');

s = s.replace(/\n\s*'Catégorie socioprofessionnelle':\s*\{\s*options:\s*\[[^\n]*\],\s*allowCustom:\s*true\s*\},?/g, '');
s = s.replace(/,\s*categorie_socioprofessionnelle:\s*''/g, '');
s = s.replace(/<Field\s+label="Catégorie socioprofessionnelle"[\s\S]*?\/>/g, '');

if (s.includes('Catégorie socioprofessionnelle')) {
  throw new Error('CSP UI label still present after patch');
}

fs.writeFileSync(p, s);
console.log('Catégorie socioprofessionnelle removed from UI and initial payload.');
