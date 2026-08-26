const fs = require('fs');
const p = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let s = fs.readFileSync(p, 'utf8');
const old = `          <BoolChoice label="Souhaitez-vous que vos placements prennent en compte des critères environnementaux, sociaux ou de gouvernance (ESG) ?" value={form.esg_opt_in} onChange={(v) => patchCurrent({ esg_opt_in: v })} yesLabel="Oui, je souhaite les préciser" help={<><strong>La durabilité désigne les critères ESG :</strong> <strong>environnement</strong> (climat, pollution, biodiversité), <strong>social</strong> (droits humains, travail, santé) et <strong>gouvernance</strong> (éthique, corruption, dirigeants). Aucune connaissance technique n’est nécessaire.</>} />\n          <RecueilInfoNote title="Si vous choisissez « Oui »">Un questionnaire simple sur vos préférences de durabilité sera proposé après le profil investisseur. Il précisera vos priorités et vos éventuelles exclusions, sans modifier votre profil de risque.</RecueilInfoNote>\n`;
const next = `          <BoolChoice label="Souhaitez-vous que vos placements prennent en compte des critères environnementaux, sociaux ou de gouvernance (ESG) ?" value={form.esg_opt_in} onChange={(v) => patchCurrent({ esg_opt_in: v })} yesLabel="Oui, je souhaite remplir le questionnaire ESG" help={<><strong>Les critères ESG correspondent à :</strong> <strong>environnement</strong> (climat, pollution, biodiversité), <strong>social</strong> (droits humains, travail, santé) et <strong>gouvernance</strong> (éthique, corruption, dirigeants). Aucune connaissance technique n’est nécessaire.</>} />\n`;
if (!s.includes(old)) throw new Error('ESG block target not found');
s = s.replace(old, next);
fs.writeFileSync(p, s);
console.log('Regulatory ESG choice simplified');
