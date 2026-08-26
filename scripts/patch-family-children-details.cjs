const fs = require('fs');

const path = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let text = fs.readFileSync(path, 'utf8');

// 1) Add children array to initial family payload.
text = text.replace(
  "family: { situation: '', date_evenement: '', regime_convention: '', avantage_matrimonial: '', evolution_prevue: '', notaire_nom_ville: '', expert_comptable_nom_ville: '', nombre_enfants: '', commentaires: '' },",
  "family: { situation: '', date_evenement: '', regime_convention: '', avantage_matrimonial: '', evolution_prevue: '', notaire_nom_ville: '', expert_comptable_nom_ville: '', nombre_enfants: '', enfants: [], commentaires: '' },"
);

// 2) Add helpers near list helpers.
const helperMarker = "  const removeList = (key: string, index: number) => patchCurrent({ [key]: (form[key] ?? []).filter((_: unknown, i: number) => i !== index) });\n";
if (!text.includes(helperMarker)) throw new Error('List helper marker not found');
if (!text.includes('const resizeChildren =')) {
  text = text.replace(helperMarker, helperMarker + `  const resizeChildren = (rawCount: string) => {\n    const parsed = Math.max(0, Math.min(20, Number.parseInt(rawCount || '0', 10) || 0));\n    const currentChildren: AnyPayload[] = Array.isArray(forms.family.enfants) ? forms.family.enfants : [];\n    const nextChildren = Array.from({ length: parsed }, (_, index) => currentChildren[index] ?? { prenom: '', nom: '', annee_naissance: '' });\n    patchCurrent({ nombre_enfants: rawCount, enfants: nextChildren });\n  };\n  const updateChild = (index: number, values: AnyPayload) => patchCurrent({ enfants: (Array.isArray(form.enfants) ? form.enfants : []).map((child: AnyPayload, i: number) => i === index ? { ...child, ...values } : child) });\n`);
}

// 3) Strengthen family validation.
const validationOld = "      if (!Number.isInteger(Number(form.nombre_enfants)) || Number(form.nombre_enfants) < 0) throw new Error('Le nombre d’enfants doit être un nombre entier positif ou nul.');\n      if (familyNeedsEventDate && isBlank(form.date_evenement)) throw new Error(`Indiquez la ${familyEventLabel.toLowerCase()} (mois / année).`);";
const validationNew = "      if (!Number.isInteger(Number(form.nombre_enfants)) || Number(form.nombre_enfants) < 0) throw new Error('Le nombre d’enfants doit être un nombre entier positif ou nul.');\n      const childCount = Number(form.nombre_enfants);\n      const children: AnyPayload[] = Array.isArray(form.enfants) ? form.enfants : [];\n      if (children.length !== childCount) throw new Error('Renseignez les informations de chaque enfant.');\n      for (const child of children) {\n        if ([child.prenom, child.nom, child.annee_naissance].some(isBlank)) throw new Error('Indiquez le prénom, le nom et l’année de naissance de chaque enfant.');\n        const birthYear = Number(child.annee_naissance);\n        if (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > new Date().getFullYear()) throw new Error(`L’année de naissance de chaque enfant doit être comprise entre 1900 et ${new Date().getFullYear()}.`);\n      }\n      if (familyNeedsEventDate && isBlank(form.date_evenement)) throw new Error(`Indiquez la ${familyEventLabel.toLowerCase()} (mois / année).`);";
if (!text.includes(validationOld)) throw new Error('Family validation marker not found');
text = text.replace(validationOld, validationNew);

// 4) Replace simple number field with a child details block.
const oldField = '<Field label="Nombre d’enfants" required type="number" value={form.nombre_enfants} onChange={(v) => patchCurrent({ nombre_enfants: v })} />';
const newField = `<div className="sm:col-span-2">\n          <div className="grid gap-5 sm:grid-cols-2">\n            <Field label="Nombre d’enfants" required type="number" value={form.nombre_enfants} onChange={resizeChildren} />\n          </div>\n          {Number(form.nombre_enfants) > 0 && <div className="mt-5 space-y-3">\n            <p className="text-sm font-semibold text-[#F1F5F9]">Enfants</p>\n            {(Array.isArray(form.enfants) ? form.enfants : []).map((child: AnyPayload, index: number) => <div key={index} className="rounded-xl border border-white/10 bg-[#132644] p-4">\n              <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-[#93C5FD]">Enfant {index + 1}</p>\n              <div className="grid gap-4 sm:grid-cols-3">\n                <Field label="Prénom" required value={child.prenom} onChange={(v) => updateChild(index, { prenom: v })} />\n                <Field label="Nom" required value={child.nom} onChange={(v) => updateChild(index, { nom: v })} />\n                <Field label="Année de naissance" required type="number" value={child.annee_naissance} onChange={(v) => updateChild(index, { annee_naissance: v })} placeholder="Ex. 2014" />\n              </div>\n            </div>)}\n          </div>}\n        </div>`;
if (!text.includes(oldField)) throw new Error('Children count field not found');
text = text.replace(oldField, newField);

if (!text.includes('Enfant {index + 1}') || !text.includes('annee_naissance') || !text.includes('resizeChildren')) throw new Error('Children details UI missing');

fs.writeFileSync(path, text);
console.log('Family children details installed');
