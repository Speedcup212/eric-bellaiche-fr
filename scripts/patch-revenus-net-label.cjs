const fs = require('fs');
const p = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let s = fs.readFileSync(p, 'utf8');
const oldLabel = 'À combien estimez-vous vos revenus professionnels pour l’année en cours ? (€)';
const newLabel = 'À combien estimez-vous vos revenus professionnels nets pour l’année en cours ? (€)';
if (!s.includes(oldLabel) && s.includes(newLabel)) {
  console.log('Revenue label already updated');
  process.exit(0);
}
if (!s.includes(oldLabel)) throw new Error('Revenue label target not found');
s = s.replace(oldLabel, newLabel);
fs.writeFileSync(p, s);
console.log('Professional income label updated to net');
