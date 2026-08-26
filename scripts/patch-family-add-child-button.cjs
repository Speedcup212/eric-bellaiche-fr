const fs = require('fs');
const path = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let text = fs.readFileSync(path, 'utf8');

text = text.replace(
  "family: { situation: '', date_evenement: '', regime_convention: '', avantage_matrimonial: '', evolution_prevue: '', notaire_nom_ville: '', expert_comptable_nom_ville: '', nombre_enfants: '', enfants: [], commentaires: '' },",
  "family: { situation: '', date_evenement: '', regime_convention: '', avantage_matrimonial: '', evolution_prevue: '', notaire_nom_ville: '', expert_comptable_nom_ville: '', nombre_enfants: '0', enfants: [], commentaires: '' },"
);

const fnOld = `  const resizeChildren = (rawCount: string | number) => {
    const parsed = Math.max(0, Math.min(20, Number.parseInt(String(rawCount || '0'), 10) || 0));
    const currentChildren: AnyPayload[] = Array.isArray(form.enfants) ? form.enfants : [];
    const nextChildren = Array.from({ length: parsed }, (_, index) => currentChildren[index] ?? { prenom: '', nom: '', annee_naissance: '' });
    patchCurrent({ nombre_enfants: String(parsed), enfants: nextChildren });
  };
  const updateChild = (index: number, values: AnyPayload) => patchCurrent({ enfants: (Array.isArray(form.enfants) ? form.enfants : []).map((child: AnyPayload, i: number) => i === index ? { ...child, ...values } : child) });`;

const fnNew = `  const addChild = () => {
    const currentChildren: AnyPayload[] = Array.isArray(form.enfants) ? form.enfants : [];
    if (currentChildren.length >= 20) return;
    const nextChildren = [...currentChildren, { prenom: '', nom: '', annee_naissance: '' }];
    patchCurrent({ enfants: nextChildren, nombre_enfants: String(nextChildren.length) });
  };
  const removeChild = (index: number) => {
    const currentChildren: AnyPayload[] = Array.isArray(form.enfants) ? form.enfants : [];
    const nextChildren = currentChildren.filter((_, i) => i !== index);
    patchCurrent({ enfants: nextChildren, nombre_enfants: String(nextChildren.length) });
  };
  const updateChild = (index: number, values: AnyPayload) => {
    const currentChildren: AnyPayload[] = Array.isArray(form.enfants) ? form.enfants : [];
    const nextChildren = currentChildren.map((child: AnyPayload, i: number) => i === index ? { ...child, ...values } : child);
    patchCurrent({ enfants: nextChildren, nombre_enfants: String(nextChildren.length) });
  };`;
if (!text.includes(fnOld)) throw new Error('children helper block not found');
text = text.replace(fnOld, fnNew);

text = text.replace(
  "      if (isBlank(form.situation) || isBlank(form.nombre_enfants)) throw new Error('Renseignez votre situation familiale et le nombre d’enfants.');",
  "      if (isBlank(form.situation)) throw new Error('Renseignez votre situation familiale.');"
);
text = text.replace(
  "      if (!Number.isInteger(Number(form.nombre_enfants)) || Number(form.nombre_enfants) < 0) throw new Error('Le nombre d’enfants doit être un nombre entier positif ou nul.');\n      const childCount = Number(form.nombre_enfants);\n      const children: AnyPayload[] = Array.isArray(form.enfants) ? form.enfants : [];\n      if (children.length !== childCount) throw new Error('Renseignez les informations de chaque enfant.');",
  "      const children: AnyPayload[] = Array.isArray(form.enfants) ? form.enfants : [];"
);

const oldUi = `              <div className="mt-3 w-full sm:w-52">
                <p className="text-sm font-semibold text-[#F1F5F9]">Nombre d’enfants *</p>
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" onClick={() => resizeChildren(Math.max(0, Number(form.nombre_enfants || 0) - 1))} disabled={Number(form.nombre_enfants || 0) <= 0} aria-label="Retirer un enfant" className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white text-lg font-bold text-slate-800 transition hover:border-[#3B82F6] disabled:cursor-not-allowed disabled:opacity-40">−</button>
                  <input inputMode="numeric" type="number" min={0} max={20} value={form.nombre_enfants ?? '0'} onChange={(e) => resizeChildren(e.target.value)} className="h-11 w-20 rounded-xl border border-[#CBD5E1] bg-white px-3 text-center text-sm font-semibold text-slate-900 outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-500/30" />
                  <button type="button" onClick={() => resizeChildren(Math.min(20, Number(form.nombre_enfants || 0) + 1))} disabled={Number(form.nombre_enfants || 0) >= 20} aria-label="Ajouter un enfant" className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#3B82F6] bg-[#3B82F6] text-lg font-bold text-white transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40">+</button>
                </div>
              </div>`;
const newUi = `              <div className="mt-3">
                <button type="button" onClick={addChild} disabled={(Array.isArray(form.enfants) ? form.enfants.length : 0) >= 20} className="inline-flex items-center gap-2 rounded-xl bg-[#3B82F6] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" /> Ajouter un enfant</button>
              </div>`;
if (!text.includes(oldUi)) throw new Error('old child counter UI not found');
text = text.replace(oldUi, newUi);

text = text.replace(
  `{Number(form.nombre_enfants) > 0 && <div className="mt-4 space-y-2">`,
  `{(Array.isArray(form.enfants) ? form.enfants.length : 0) > 0 && <div className="mt-4 space-y-2">`
);

const childRowOld = `<div key={index} className="grid items-end gap-3 border-t border-white/10 pt-3 first:border-t-0 first:pt-0 sm:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1fr)_10rem]">`;
const childRowNew = `<div key={index} className="grid items-end gap-3 border-t border-white/10 pt-3 first:border-t-0 first:pt-0 sm:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1fr)_10rem_auto]">`;
if (!text.includes(childRowOld)) throw new Error('child row grid not found');
text = text.replace(childRowOld, childRowNew);

const yearField = `<Field label="Année de naissance" required type="number" value={child.annee_naissance} onChange={(v) => updateChild(index, { annee_naissance: v })} placeholder="Ex. 2014" />`;
const yearWithRemove = `${yearField}\n                <button type="button" onClick={() => removeChild(index)} aria-label={\`Supprimer enfant \${index + 1}\`} title="Supprimer" className="mb-0.5 inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 transition hover:bg-red-50"><Trash2 className="h-4 w-4" /><span className="hidden lg:inline">Supprimer</span></button>`;
if (!text.includes(yearField)) throw new Error('child year field not found');
text = text.replace(yearField, yearWithRemove);

text = text.replace(
  "    let payloadToSave = form;",
  "    let payloadToSave = form;\n    if (current.code === 'family') {\n      const children: AnyPayload[] = Array.isArray(form.enfants) ? form.enfants : [];\n      payloadToSave = { ...form, enfants: children, nombre_enfants: String(children.length) };\n    }"
);

if (text.includes('resizeChildren(')) throw new Error('legacy child counter still referenced');
if (!text.includes('Ajouter un enfant') || !text.includes('removeChild(index)')) throw new Error('new child UX missing');
fs.writeFileSync(path, text);
console.log('Family child add/remove UX installed');
