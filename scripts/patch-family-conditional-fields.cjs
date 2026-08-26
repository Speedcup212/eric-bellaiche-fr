const fs = require('fs');

const path = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let text = fs.readFileSync(path, 'utf8');

const flagMarker = "  const familyNeedsConvention = familySituation.includes('mari') || familySituation.includes('pacs');\n";
if (!text.includes(flagMarker)) throw new Error('familyNeedsConvention marker not found');
if (!text.includes("const familyNeedsMatrimonialAdvantage")) {
  text = text.replace(flagMarker, flagMarker + "  const familyNeedsMatrimonialAdvantage = familySituation.includes('mari');\n");
}

const oldField = '<Field label="Avantage matrimonial" value={form.avantage_matrimonial} onChange={(v) => patchCurrent({ avantage_matrimonial: v })} />';
const newField = "{familyNeedsMatrimonialAdvantage && <Field label=\"Avantage matrimonial\" value={form.avantage_matrimonial} onChange={(v) => patchCurrent({ avantage_matrimonial: v })} />}";
if (!text.includes(newField)) {
  if (!text.includes(oldField)) throw new Error('Avantage matrimonial field not found');
  text = text.replace(oldField, newField);
}

const patchCurrentMarker = "  const patchCurrent = (values: AnyPayload) => { setErrorMessage(''); patch(current.code, values); };\n";
if (!text.includes(patchCurrentMarker)) throw new Error('patchCurrent marker not found');
if (!text.includes('familyNeedsMatrimonialAdvantage && !isBlank(forms.family.avantage_matrimonial)')) {
  const effect = `\n  useEffect(() => {\n    if (!familyNeedsConvention && !isBlank(forms.family.regime_convention)) patch('family', { regime_convention: '' });\n    if (!familyNeedsMatrimonialAdvantage && !isBlank(forms.family.avantage_matrimonial)) patch('family', { avantage_matrimonial: '' });\n  }, [familyNeedsConvention, familyNeedsMatrimonialAdvantage, forms.family.regime_convention, forms.family.avantage_matrimonial]);\n`;
  text = text.replace(patchCurrentMarker, patchCurrentMarker + effect);
}

if (!text.includes("familyNeedsMatrimonialAdvantage = familySituation.includes('mari')")) throw new Error('Marriage-only condition missing');
if (!text.includes('{familyNeedsMatrimonialAdvantage && <Field label="Avantage matrimonial"')) throw new Error('Conditional matrimonial field missing');

fs.writeFileSync(path, text);
console.log('Family fields now follow marital status');
