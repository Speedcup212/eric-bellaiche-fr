const fs = require('fs');
const path = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let text = fs.readFileSync(path, 'utf8');

text = text.replace(
`  const resizeChildren = (rawCount: string) => {
    const parsed = Math.max(0, Math.min(20, Number.parseInt(rawCount || '0', 10) || 0));
    const currentChildren: AnyPayload[] = Array.isArray(forms.family.enfants) ? forms.family.enfants : [];
    const nextChildren = Array.from({ length: parsed }, (_, index) => currentChildren[index] ?? { prenom: '', nom: '', annee_naissance: '' });
    patchCurrent({ nombre_enfants: rawCount, enfants: nextChildren });
  };`,
`  const resizeChildren = (rawCount: string | number) => {
    const parsed = Math.max(0, Math.min(20, Number.parseInt(String(rawCount || '0'), 10) || 0));
    const currentChildren: AnyPayload[] = Array.isArray(form.enfants) ? form.enfants : [];
    const nextChildren = Array.from({ length: parsed }, (_, index) => currentChildren[index] ?? { prenom: '', nom: '', annee_naissance: '' });
    patchCurrent({ nombre_enfants: String(parsed), enfants: nextChildren });
  };`
);

const oldBlock = `              <div className="mt-3 w-full sm:w-44">
                <Field label="Nombre d’enfants" required type="number" value={form.nombre_enfants} onChange={resizeChildren} />
              </div>`;
const newBlock = `              <div className="mt-3 w-full sm:w-52">
                <p className="text-sm font-semibold text-[#F1F5F9]">Nombre d’enfants *</p>
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" onClick={() => resizeChildren(Math.max(0, Number(form.nombre_enfants || 0) - 1))} disabled={Number(form.nombre_enfants || 0) <= 0} aria-label="Retirer un enfant" className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white text-lg font-bold text-slate-800 transition hover:border-[#3B82F6] disabled:cursor-not-allowed disabled:opacity-40">−</button>
                  <input inputMode="numeric" type="number" min={0} max={20} value={form.nombre_enfants ?? '0'} onChange={(e) => resizeChildren(e.target.value)} className="h-11 w-20 rounded-xl border border-[#CBD5E1] bg-white px-3 text-center text-sm font-semibold text-slate-900 outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-500/30" />
                  <button type="button" onClick={() => resizeChildren(Math.min(20, Number(form.nombre_enfants || 0) + 1))} disabled={Number(form.nombre_enfants || 0) >= 20} aria-label="Ajouter un enfant" className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#3B82F6] bg-[#3B82F6] text-lg font-bold text-white transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40">+</button>
                </div>
              </div>`;

if (!text.includes(oldBlock)) throw new Error('Children count block not found');
text = text.replace(oldBlock, newBlock);
if (!text.includes('aria-label="Ajouter un enfant"')) throw new Error('Children stepper not installed');
fs.writeFileSync(path, text);
console.log('Children count stepper installed');
