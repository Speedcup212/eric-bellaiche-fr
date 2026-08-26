const fs = require('fs');
const p = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let s = fs.readFileSync(p, 'utf8');

const oldButton = 'yesLabel="Oui, je souhaite les préciser"';
const newButton = 'yesLabel="Oui, je souhaite remplir le questionnaire ESG"';
if (!s.includes(oldButton)) throw new Error('Old ESG button label not found');
s = s.replace(oldButton, newButton);

const oldHelp = '<><strong>La durabilité désigne les critères ESG :</strong> <strong>environnement</strong> (climat, pollution, biodiversité), <strong>social</strong> (droits humains, travail, santé) et <strong>gouvernance</strong> (éthique, corruption, dirigeants). Aucune connaissance technique n’est nécessaire.</>';
const newHelp = '<><strong>Les critères ESG correspondent à :</strong> <strong>environnement</strong> (climat, pollution, biodiversité), <strong>social</strong> (droits humains, travail, santé) et <strong>gouvernance</strong> (éthique, corruption, dirigeants). Aucune connaissance technique n’est nécessaire.</>';
if (s.includes(oldHelp)) s = s.replace(oldHelp, newHelp);

const oldNote = '<RecueilInfoNote title="Si vous choisissez « Oui »">Un questionnaire simple sur vos préférences de durabilité sera proposé après le profil investisseur. Il précisera vos priorités et vos éventuelles exclusions, sans modifier votre profil de risque.</RecueilInfoNote>';
if (!s.includes(oldNote)) throw new Error('ESG info note not found');
s = s.replace(oldNote, '');

const fnStart = s.indexOf('function RecueilInfoNote(');
if (fnStart !== -1) {
  const nextFn = s.indexOf('\nfunction ', fnStart + 1);
  if (nextFn === -1) throw new Error('Could not locate end of RecueilInfoNote');
  s = s.slice(0, fnStart) + s.slice(nextFn + 1);
}

fs.writeFileSync(p, s);
console.log('ESG CTA updated, note removed, unused component removed');
