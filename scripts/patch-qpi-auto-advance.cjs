const fs = require('fs');

const path = 'src/pages/portal/QuestionnairePageBase.tsx';
let source = fs.readFileSync(path, 'utf8');

const before = `    const needsDetails = ['Q4', 'Q5', 'Q10'].includes(question.code)\n      || (['ESG_SCOPE', 'ESG_TAX_MIN', 'ESG_SFDR_MIN'].includes(question.code) && option.code === 'AUTRE');`;
const after = `    // In the investor profile, every single-choice answer advances immediately.\n    // Optional QPI precision fields must never force the client to click “Suivant”.\n    // ESG keeps its explicit-detail exceptions when “Autre” requires a follow-up field.\n    const needsDetails = mode === 'ESG'\n      && ['ESG_SCOPE', 'ESG_TAX_MIN', 'ESG_SFDR_MIN'].includes(question.code)\n      && option.code === 'AUTRE';`;

if (!source.includes(before)) {
  console.error('Expected selectSingleAnswer block not found; refusing to patch.');
  process.exit(1);
}

source = source.replace(before, after);
fs.writeFileSync(path, source);
console.log('QPI single-choice auto-advance harmonized.');
