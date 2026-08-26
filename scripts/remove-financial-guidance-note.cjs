const fs = require('fs');
const p = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let s = fs.readFileSync(p, 'utf8');
const target = `          <GuidanceNote><p>Une déclaration simple, sans détail bancaire</p><p>Nous cherchons uniquement à savoir si une part importante de vos liquidités reste volontairement sur vos comptes courants. Aucun relevé, nom de banque ou numéro de compte n’est demandé.</p></GuidanceNote>\n`;
if (!s.includes(target)) throw new Error('Financial guidance note target not found');
s = s.replace(target, '');
fs.writeFileSync(p, s);
