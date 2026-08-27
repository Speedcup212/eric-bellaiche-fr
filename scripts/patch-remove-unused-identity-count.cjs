const fs = require('fs');
const path = 'src/pages/portal/ClientDocumentsPage.tsx';
let source = fs.readFileSync(path, 'utf8');
const target = "  const identityReceivedCount = dossierMembers.filter((member) => sources.some((doc) => doc.categorie === 'identite' && doc.investisseur_id === member.investisseur_id)).length;\n";
if (!source.includes(target)) throw new Error('Unused identityReceivedCount declaration not found');
source = source.replace(target, '');
fs.writeFileSync(path, source);
console.log('Removed unused identityReceivedCount declaration.');
