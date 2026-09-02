const fs = require('fs');
const path = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let s = fs.readFileSync(path, 'utf8');
const before = 'placeholder="Nom figurant sur votre acte de naissance"';
const after = 'placeholder="Nom à la naissance"';
if (!s.includes(before)) throw new Error('Target placeholder not found');
s = s.replace(before, after);
fs.writeFileSync(path, s);
console.log('Birth name placeholder shortened');
