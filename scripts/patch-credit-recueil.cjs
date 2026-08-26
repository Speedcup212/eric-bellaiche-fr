const fs = require('fs');

const path = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let text = fs.readFileSync(path, 'utf8');

const optionsPattern = /  const creditLinkedAssetOptions = \[[\s\S]*?\n  \];/;
const optionsReplacement = `  const creditPropertyLabels = (forms.patrimony?.immobilier ?? []).map((property: AnyPayload, index: number, properties: AnyPayload[]) => {
    const usage = String(property.usage ?? '').trim();
    const type = String(property.type_bien ?? '').trim();
    const city = String(property.ville ?? '').trim();
    const baseLabel = [usage, type, city].filter(Boolean).join(' — ') || \`Bien immobilier \${index + 1}\`;
    const duplicateCount = properties.filter((other: AnyPayload) => {
      const otherLabel = [String(other.usage ?? '').trim(), String(other.type_bien ?? '').trim(), String(other.ville ?? '').trim()].filter(Boolean).join(' — ');
      return otherLabel === baseLabel;
    }).length;
    if (duplicateCount <= 1) return baseLabel;
    const shortAddress = String(property.adresse_courte ?? property.adresse ?? property.numero_voie ?? '').trim();
    return shortAddress ? \`\${baseLabel} — \${shortAddress}\` : \`\${baseLabel} — n°\${index + 1}\`;
  });
  const creditLinkedAssetOptions = [
    ...creditPropertyLabels,
    'Crédit à la consommation / prêt personnel',
    'Crédit renouvelable / réserve d’argent',
    'Véhicule',
    'Travaux',
    'Études / formation',
    'Crédit professionnel / activité professionnelle',
    'Autre / non rattaché à un bien immobilier',
  ];`;
if (!optionsPattern.test(text)) throw new Error('Credit linked asset options block not found');
text = text.replace(optionsPattern, optionsReplacement);

text = text.replace(
  'Une ligne par crédit. Les biens saisis dans Immobilier sont repris automatiquement ; les crédits consommation, réserves, auto, travaux, étudiants ou professionnels disposent aussi d’un rattachement dédié.',
  'Une ligne par crédit. Les biens immobiliers sont repris automatiquement sous la forme Usage — Type de bien — Ville ; les crédits consommation, réserves, auto, travaux, étudiants ou professionnels disposent aussi d’un rattachement dédié.'
);

if (!text.includes("[usage, type, city].filter(Boolean).join(' — ')")) throw new Error('La terminologie normalisée des biens n’a pas été installée');
if (text.includes('return customName ||')) throw new Error('L’ancien libellé libre des biens est encore utilisé');
fs.writeFileSync(path, text);

const testPath = 'scripts/crash-test-recueil-100.mjs';
let test = fs.readFileSync(testPath, 'utf8');
if (!test.includes('Usage — Type de bien — Ville')) {
  test = test.replace(
    "assert.match(journeyBase, /creditLinkedAssetOptions/, 'Les biens immobiliers déclarés doivent être proposés automatiquement dans les crédits');",
    "assert.match(journeyBase, /creditLinkedAssetOptions/, 'Les biens immobiliers déclarés doivent être proposés automatiquement dans les crédits');\nassert.match(journeyBase, /Usage — Type de bien — Ville/, 'Les biens doivent être libellés de manière patrimoniale et homogène');"
  );
}
fs.writeFileSync(testPath, test);

console.log('Credit linked property labels normalized');
