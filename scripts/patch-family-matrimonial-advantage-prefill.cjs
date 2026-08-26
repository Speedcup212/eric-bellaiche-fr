const fs = require('fs');

const path = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let text = fs.readFileSync(path, 'utf8');

// Add a controlled choice list for matrimonial advantage.
const regimeChoice = "  'Régime / convention': { options: ['Communauté réduite aux acquêts', 'Communauté universelle', 'Séparation de biens', 'Participation aux acquêts', 'PACS - séparation des patrimoines', 'PACS - indivision', 'Sans convention / non applicable'], allowCustom: true },\n";
if (!text.includes(regimeChoice)) throw new Error('Regime choice marker not found');
if (!text.includes("  'Avantage matrimonial':")) {
  text = text.replace(regimeChoice, regimeChoice + "  'Avantage matrimonial': { options: ['Je ne sais pas / à vérifier', 'Aucun aménagement particulier', 'Clause de préciput', 'Attribution intégrale de la communauté'], allowCustom: true },\n");
}

// When the user selects Married, prefill a neutral value if nothing is already known.
const oldChange = `              <Field label="Situation familiale" required value={form.situation} onChange={(v) => {\n                const normalized = String(v).toLowerCase();\n                const needsConvention = normalized.includes('mari') || normalized.includes('pacs');\n                patchCurrent({ situation: v, regime_convention: needsConvention ? form.regime_convention : '' });\n              }} placeholder="Autre situation" />`;
const newChange = `              <Field label="Situation familiale" required value={form.situation} onChange={(v) => {\n                const normalized = String(v).toLowerCase();\n                const needsConvention = normalized.includes('mari') || normalized.includes('pacs');\n                const needsMatrimonialAdvantage = normalized.includes('mari');\n                patchCurrent({\n                  situation: v,\n                  regime_convention: needsConvention ? form.regime_convention : '',\n                  avantage_matrimonial: needsMatrimonialAdvantage ? (isBlank(form.avantage_matrimonial) ? 'Je ne sais pas / à vérifier' : form.avantage_matrimonial) : '',\n                });\n              }} placeholder="Autre situation" />`;
if (!text.includes(newChange)) {
  if (!text.includes(oldChange)) throw new Error('Family situation change block not found');
  text = text.replace(oldChange, newChange);
}

// Existing married dossiers with an empty value also get the neutral prefill after load/change.
const patchCurrentMarker = "  const patchCurrent = (values: AnyPayload) => { setErrorMessage(''); patch(current.code, values); };\n";
if (!text.includes(patchCurrentMarker)) throw new Error('patchCurrent marker not found');
if (!text.includes("forms.family.avantage_matrimonial, familyNeedsMatrimonialAdvantage")) {
  const effect = `\n  useEffect(() => {\n    if (familyNeedsMatrimonialAdvantage && isBlank(forms.family.avantage_matrimonial)) {\n      patch('family', { avantage_matrimonial: 'Je ne sais pas / à vérifier' });\n    }\n  }, [forms.family.avantage_matrimonial, familyNeedsMatrimonialAdvantage]);\n`;
  text = text.replace(patchCurrentMarker, patchCurrentMarker + effect);
}

// Make the field explicitly required for married clients; it is prefilled neutrally.
const oldField = '{familyNeedsMatrimonialAdvantage && <Field label="Avantage matrimonial" value={form.avantage_matrimonial} onChange={(v) => patchCurrent({ avantage_matrimonial: v })} />}';
const newField = '{familyNeedsMatrimonialAdvantage && <Field label="Avantage matrimonial" required value={form.avantage_matrimonial} onChange={(v) => patchCurrent({ avantage_matrimonial: v })} placeholder="Autre avantage / précisez" />}';
if (!text.includes(newField)) {
  if (!text.includes(oldField)) throw new Error('Matrimonial advantage field not found');
  text = text.replace(oldField, newField);
}

// Add validation for married clients.
const validationMarker = "      if (familyNeedsConvention && isBlank(form.regime_convention)) throw new Error('Pour une situation mariée ou pacsée, indiquez le régime / la convention.');\n";
if (!text.includes(validationMarker)) throw new Error('Family validation marker not found');
if (!text.includes("if (familyNeedsMatrimonialAdvantage && isBlank(form.avantage_matrimonial))")) {
  text = text.replace(validationMarker, validationMarker + "      if (familyNeedsMatrimonialAdvantage && isBlank(form.avantage_matrimonial)) throw new Error('Indiquez l’avantage matrimonial ou choisissez « Je ne sais pas / à vérifier ».');\n");
}

if (!text.includes("'Je ne sais pas / à vérifier'")) throw new Error('Neutral matrimonial prefill missing');
if (!text.includes("'Avantage matrimonial':")) throw new Error('Matrimonial advantage choices missing');

fs.writeFileSync(path, text);
console.log('Matrimonial advantage prefill installed');
