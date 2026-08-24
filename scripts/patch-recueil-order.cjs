const fs = require('fs');

const path = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let s = fs.readFileSync(path, 'utf8');

const oldSections = `  { code: 'capacity', title: 'Revenus et capacité financière', description: 'Précisez votre capacité d’épargne, votre épargne de précaution et les revenus estimés.' },
  { code: 'regulatory', title: 'Situation réglementaire', description: 'Résidence fiscale, FATCA/CRS, sanctions, PPE et choix de durabilité.' },
  { code: 'patrimony', title: 'Patrimoine immobilier', description: 'Renseignez les biens immobiliers détenus et leur valeur estimée. Aucun justificatif immobilier n’est demandé à cette étape.' },`;
const newSections = `  { code: 'capacity', title: 'Revenus et capacité financière', description: 'Précisez votre capacité d’épargne, votre épargne de précaution et les revenus estimés.' },
  { code: 'patrimony', title: 'Patrimoine immobilier', description: 'Renseignez les biens immobiliers détenus et leur valeur estimée. Aucun justificatif immobilier n’est demandé à cette étape.' },
  { code: 'regulatory', title: 'Situation réglementaire', description: 'Résidence fiscale, FATCA/CRS, sanctions, PPE et choix de durabilité.' },`;

if (s.includes(oldSections)) s = s.replace(oldSections, newSections);
else if (!s.includes(newSections)) throw new Error('Recueil sections order block not found');

const oldLabels = "['Identité', 'Famille', 'Profession', 'Objectifs', 'Revenus', 'Réglementaire', 'Patrimoine']";
const newLabels = "['Identité', 'Famille', 'Profession', 'Objectifs', 'Revenus', 'Patrimoine', 'Réglementaire']";
if (s.includes(oldLabels)) s = s.replace(oldLabels, newLabels);
else if (!s.includes(newLabels)) throw new Error('Recueil labels order block not found');

fs.writeFileSync(path, s);
console.log('Recueil order patched: Patrimoine 6, Réglementaire 7');
