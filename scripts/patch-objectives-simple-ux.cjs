const fs = require('fs');
const path = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let text = fs.readFileSync(path, 'utf8');

const startMarker = "        {current.code === 'objectives'";
const endMarker = "        {current.code === 'capacity'";
const a = text.indexOf(startMarker);
const b = text.indexOf(endMarker, a);
if (a < 0 || b < 0) throw new Error('Objective block not found');

const replacement = `        {current.code === 'objectives' && <div className="space-y-6">
          <section aria-labelledby="available-objectives-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 id="available-objectives-title" className="text-lg font-semibold text-[#F1F5F9]">Quels sont vos objectifs ?</h3>
                <p className="mt-1 text-sm leading-5 text-[#CBD5E1]">Cliquez dans l’ordre de vos priorités. Vous pourrez modifier cet ordre ensuite.</p>
              </div>
              {objectiveItems.length > 0 && <span className="rounded-full bg-[#3B82F6] px-3 py-1 text-xs font-semibold text-white">{objectiveItems.length} sélectionné{objectiveItems.length > 1 ? 's' : ''}</span>}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{objectiveOptions.map(([code, label]) => {
              const selectedIndex = objectiveItems.findIndex((item) => item.code_objectif === code);
              const selected = selectedIndex >= 0;
              return <button type="button" key={code} aria-pressed={selected} onClick={() => toggleObjective(code, label)} className={\`relative min-h-12 rounded-xl border px-3 py-2.5 pr-10 text-left text-[13px] font-semibold leading-4 transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 \${selected ? 'border-[#3B82F6] bg-[#3B82F6] text-white shadow-sm shadow-blue-950/20' : 'border-[#E2E8F0] bg-white text-slate-800 hover:border-[#3B82F6] hover:shadow-sm'}\`}>
                {label}
                {selected && <span className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[11px] font-bold text-[#2563EB]" aria-label={\`Priorité \${selectedIndex + 1}\`}>{selectedIndex + 1}</span>}
              </button>;
            })}</div>
          </section>

          {objectiveItems.length > 0 && <section aria-labelledby="selected-objectives-title" className="border-t border-white/10 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h3 id="selected-objectives-title" className="text-base font-semibold text-[#F1F5F9]">Vos priorités</h3><p className="mt-0.5 text-xs leading-5 text-[#94A3B8]">Choisissez l’horizon. Les flèches servent uniquement à changer l’ordre.</p></div>
            </div>
            <div className="mt-3 space-y-2">{objectiveItems.map((item, index) => {
              const code = item.code_objectif as ObjectiveCode;
              const label = item.label || objectiveLabelByCode[code] || item.code_objectif;
              return <div key={item.code_objectif} className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-3 shadow-sm">
                <div className="grid items-center gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(13rem,0.45fr)_auto]">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0B1F3A] text-[11px] font-bold text-white">{index + 1}</span>
                    <p className="text-[13px] font-semibold leading-4 text-slate-900">{label}</p>
                  </div>
                  <CompactHorizonField value={item.horizon_annees} onChange={(v) => updateObjective(item.code_objectif, { horizon_annees: v })} />
                  <div className="flex items-center justify-end gap-1">
                    <button type="button" disabled={index === 0} onClick={() => moveObjective(index, -1)} aria-label={\`Monter \${label}\`} title="Monter" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#F59E0B] bg-[#F59E0B] text-sm font-bold text-white transition hover:bg-[#D97706] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300">↑</button>
                    <button type="button" disabled={index === objectiveItems.length - 1} onClick={() => moveObjective(index, 1)} aria-label={\`Descendre \${label}\`} title="Descendre" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#F59E0B] bg-[#F59E0B] text-sm font-bold text-white transition hover:bg-[#D97706] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300">↓</button>
                    <button type="button" onClick={() => toggleObjective(code, label)} aria-label={\`Retirer \${label}\`} title="Retirer" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-base font-semibold text-slate-600 transition hover:border-red-300 hover:text-red-600">×</button>
                  </div>
                </div>
                {item.code_objectif === 'autre' && <div className="mt-3 border-t border-slate-200 pt-3"><Field label="Précisez l’objectif" required value={item.libelle_autre} onChange={(v) => updateObjective(item.code_objectif, { libelle_autre: v })} /></div>}
              </div>;
            })}</div>
          </section>}
        </div>}

`;

text = text.slice(0, a) + replacement + text.slice(b);
text = text.replace(/description: 'Sélectionnez vos objectifs[^']*'/, "description: 'Sélectionnez vos objectifs par ordre de priorité puis indiquez leur horizon.'");
text = text.replace(/const objectiveGroups: Array<\{ title: string; description: string; codes: ObjectiveCode\[\] \}> = \[[\s\S]*?\n\];\n\n/, '');

if (text.includes('Objectifs retenus')) throw new Error('Old objectives panel still present');
if (text.includes('Ajouter une précision — facultatif')) throw new Error('Old optional precision control still present');
if (text.includes('const objectiveGroups:')) throw new Error('Unused objectiveGroups declaration still present');
if (!text.includes('lg:grid-cols-4') || !text.includes('Vos priorités')) throw new Error('Compact objective UX missing');
fs.writeFileSync(path, text);
console.log('Compact objective UX installed');
