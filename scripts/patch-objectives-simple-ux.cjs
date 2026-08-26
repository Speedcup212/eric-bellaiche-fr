const fs = require('fs');
const path = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let text = fs.readFileSync(path, 'utf8');

const start = "        {current.code === 'objectives' && <div className=\"grid items-start gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)]\">";
const end = "        {current.code === 'capacity'";
const a = text.indexOf(start);
const b = text.indexOf(end, a);
if (a < 0 || b < 0) throw new Error('Objective block not found');

const replacement = `        {current.code === 'objectives' && <div className="space-y-9">
          <section aria-labelledby="available-objectives-title">
            <div>
              <h3 id="available-objectives-title" className="text-lg font-semibold text-[#F1F5F9]">Quels sont vos objectifs ?</h3>
              <p className="mt-1 text-sm leading-6 text-[#CBD5E1]">Sélectionnez les objectifs qui comptent pour vous. L’ordre de sélection définit automatiquement leur priorité ; vous pourrez le modifier ensuite.</p>
            </div>
            <div className="mt-6 space-y-6">{objectiveGroups.map((group) => <div key={group.title} className="border-b border-slate-400/40 pb-6 last:border-b-0 last:pb-0">
              <div><h4 className="text-sm font-semibold text-[#F1F5F9]">{group.title}</h4><p className="mt-0.5 text-xs leading-5 text-[#94A3B8]">{group.description}</p></div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{group.codes.map((code) => {
                const label = objectiveLabelByCode[code];
                const selectedIndex = objectiveItems.findIndex((item) => item.code_objectif === code);
                const selected = selectedIndex >= 0;
                return <button type="button" key={code} aria-pressed={selected} onClick={() => toggleObjective(code, label)} className={\`relative min-h-14 rounded-xl border p-4 pr-12 text-left text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 \${selected ? 'scale-[0.98] border-[#3B82F6] bg-[#3B82F6] text-white shadow-sm shadow-blue-950/20' : 'border-[#E2E8F0] bg-white text-slate-800 hover:-translate-y-0.5 hover:border-[#3B82F6] hover:shadow-md'}\`}>
                  {label}
                  {selected && <span className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xs font-bold text-[#2563EB]" aria-label={\`Priorité \${selectedIndex + 1}\`}>{selectedIndex + 1}</span>}
                </button>;
              })}</div>
            </div>)}</div>
          </section>

          {objectiveItems.length > 0 && <section aria-labelledby="selected-objectives-title" className="border-t border-white/10 pt-7">
            <div><h3 id="selected-objectives-title" className="text-lg font-semibold text-[#F1F5F9]">Vos priorités</h3><p className="mt-1 text-sm leading-6 text-[#CBD5E1]">Indiquez l’horizon de chaque objectif. Utilisez les flèches uniquement si vous souhaitez modifier l’ordre.</p></div>
            <div className="mt-5 space-y-3">{objectiveItems.map((item, index) => {
              const code = item.code_objectif as ObjectiveCode;
              const label = item.label || objectiveLabelByCode[code] || item.code_objectif;
              return <div key={item.code_objectif} className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
                <div className="grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,0.55fr)_auto]">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0B1F3A] text-xs font-bold text-white">{index + 1}</span>
                    <p className="text-sm font-semibold leading-5 text-slate-900">{label}</p>
                  </div>
                  <CompactHorizonField value={item.horizon_annees} onChange={(v) => updateObjective(item.code_objectif, { horizon_annees: v })} />
                  <div className="flex items-center justify-end gap-1.5">
                    <button type="button" disabled={index === 0} onClick={() => moveObjective(index, -1)} aria-label={\`Monter \${label}\`} title="Monter" className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#F59E0B] bg-[#F59E0B] font-bold text-white transition hover:bg-[#D97706] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300">↑</button>
                    <button type="button" disabled={index === objectiveItems.length - 1} onClick={() => moveObjective(index, 1)} aria-label={\`Descendre \${label}\`} title="Descendre" className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#F59E0B] bg-[#F59E0B] font-bold text-white transition hover:bg-[#D97706] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300">↓</button>
                    <button type="button" onClick={() => toggleObjective(code, label)} aria-label={\`Retirer \${label}\`} title="Retirer" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-lg font-semibold text-slate-600 transition hover:border-red-300 hover:text-red-600">×</button>
                  </div>
                </div>
                {item.code_objectif === 'autre' && <div className="mt-4 border-t border-slate-200 pt-4"><Field label="Précisez l’objectif" required value={item.libelle_autre} onChange={(v) => updateObjective(item.code_objectif, { libelle_autre: v })} /></div>}
              </div>;
            })}</div>
          </section>}
        </div>}

`;

text = text.slice(0, a) + replacement + text.slice(b);
text = text.replace("description: 'Sélectionnez vos objectifs, classez-les par priorité et indiquez leur horizon.'", "description: 'Sélectionnez vos objectifs. Leur ordre de sélection définit leur priorité ; indiquez ensuite leur horizon.'");

if (text.includes('Objectifs retenus')) throw new Error('Old objectives panel still present');
if (text.includes('Ajouter une précision — facultatif')) throw new Error('Old optional precision control still present');
if (!text.includes('Quels sont vos objectifs ?') || !text.includes('Vos priorités')) throw new Error('Simplified objective UX missing');
fs.writeFileSync(path, text);
console.log('Simplified objective UX installed');
