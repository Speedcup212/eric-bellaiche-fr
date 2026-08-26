const fs = require('fs');

const path = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let text = fs.readFileSync(path, 'utf8');

const oldSnippet = `<Field label="Situation familiale" required value={form.situation} onChange={(v) => patchCurrent({ situation: v })} placeholder="Autre situation" />{familyNeedsEventDate && <MonthYearField label={familyEventLabel} required minYear={1900} value={String(form.date_evenement ?? '')} onChange={(v) => patchCurrent({ date_evenement: v })} />}<Field label="Régime / convention" required={familyNeedsConvention} value={form.regime_convention} onChange={(v) => patchCurrent({ regime_convention: v })} placeholder="Autre régime / convention" />`;

const newSnippet = `<Field label="Situation familiale" required value={form.situation} onChange={(v) => {
          const normalized = String(v).toLowerCase();
          const needsConvention = normalized.includes('mari') || normalized.includes('pacs');
          patchCurrent({ situation: v, regime_convention: needsConvention ? form.regime_convention : '' });
        }} placeholder="Autre situation" />{familyNeedsEventDate && <MonthYearField label={familyEventLabel} required minYear={1900} value={String(form.date_evenement ?? '')} onChange={(v) => patchCurrent({ date_evenement: v })} />}{familyNeedsConvention && <Field label="Régime / convention" required value={form.regime_convention} onChange={(v) => patchCurrent({ regime_convention: v })} placeholder="Autre régime / convention" />}`;

if (!text.includes(oldSnippet)) throw new Error('Family regime field marker not found');
text = text.replace(oldSnippet, newSnippet);

if (!text.includes(`{familyNeedsConvention && <Field label="Régime / convention"`)) throw new Error('Conditional regime field missing');
if (!text.includes(`regime_convention: needsConvention ? form.regime_convention : ''`)) throw new Error('Hidden regime value is not cleared');

fs.writeFileSync(path, text);
console.log('Family regime / convention now appears only for married or PACS situations');
