const fs = require('fs');

const path = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let text = fs.readFileSync(path, 'utf8');

const start = text.indexOf("        {current.code === 'family'");
const end = text.indexOf("        {current.code === 'professional'", start);
if (start < 0 || end < 0) throw new Error('Family block markers not found');

const block = `        {current.code === 'family' && <div className="space-y-5">
          <section className="rounded-2xl border border-white/10 bg-[#132644] p-4 sm:p-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] xl:items-start">
              <div>
                <p className="text-sm font-semibold text-[#F1F5F9]">Situation familiale *</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {['Célibataire', 'Marié', 'Pacsé', 'Concubinage', 'Divorcé', 'Séparé', 'Veuf / Veuve', 'Autre'].map((option) => {
                    const selected = String(form.situation ?? '') === option;
                    return <button key={option} type="button" onClick={() => {
                      const normalized = option.toLowerCase();
                      const needsConvention = normalized.includes('mari') || normalized.includes('pacs');
                      patchCurrent({ situation: option, regime_convention: needsConvention ? form.regime_convention : '' });
                    }} className={\`rounded-xl border px-3.5 py-2 text-sm font-semibold transition \${selected ? 'border-[#3B82F6] bg-[#3B82F6] text-white' : 'border-[#E2E8F0] bg-white text-slate-800 hover:border-[#3B82F6]'}\`}>{option}</button>;
                  })}
                </div>
              </div>
              {familyNeedsEventDate && <MonthYearField label={familyEventLabel} required minYear={1900} value={String(form.date_evenement ?? '')} onChange={(v) => patchCurrent({ date_evenement: v })} />}
            </div>
          </section>

          {familyNeedsConvention && <section className="rounded-2xl border border-white/10 bg-[#132644] p-4 sm:p-5">
            <div className={\`grid gap-4 \${familyNeedsMatrimonialAdvantage ? 'xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]' : ''}\`}>
              <Field label="Régime / convention" required value={form.regime_convention} onChange={(v) => patchCurrent({ regime_convention: v })} placeholder="Autre régime / convention" />
              {familyNeedsMatrimonialAdvantage && <Field label="Avantage matrimonial" value={form.avantage_matrimonial} onChange={(v) => patchCurrent({ avantage_matrimonial: v })} />}
            </div>
          </section>}

          <section className="rounded-2xl border border-white/10 bg-[#132644] p-4 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start">
              <Field label="Nombre d’enfants" required type="number" value={form.nombre_enfants} onChange={resizeChildren} />
              {Number(form.nombre_enfants) > 0 ? <div>
                <p className="text-sm font-semibold text-[#F1F5F9]">Enfants</p>
                <div className="mt-2 space-y-2">
                  {(Array.isArray(form.enfants) ? form.enfants : []).map((child: AnyPayload, index: number) => <div key={index} className="grid gap-2 rounded-xl border border-white/10 bg-[#0F1F36] p-3 sm:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1fr)_10rem] sm:items-end">
                    <div className="pb-3 text-xs font-bold uppercase tracking-[0.12em] text-[#93C5FD]">Enfant {index + 1}</div>
                    <Field label="Prénom" required value={child.prenom} onChange={(v) => updateChild(index, { prenom: v })} />
                    <Field label="Nom" required value={child.nom} onChange={(v) => updateChild(index, { nom: v })} />
                    <Field label="Année de naissance" required type="number" value={child.annee_naissance} onChange={(v) => updateChild(index, { annee_naissance: v })} placeholder="Ex. 2014" />
                  </div>)}
                </div>
              </div> : <div className="flex min-h-[3.25rem] items-center rounded-xl border border-dashed border-white/10 px-4 text-sm text-[#94A3B8]">Aucun enfant déclaré.</div>}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#132644] p-4 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-3">
              <Field label="Notaire (nom et ville) — facultatif" value={form.notaire_nom_ville} onChange={(v) => patchCurrent({ notaire_nom_ville: v })} placeholder="Ex. Maître Dupont — Grenoble" />
              <Field label="Expert-comptable (nom et ville) — facultatif" value={form.expert_comptable_nom_ville} onChange={(v) => patchCurrent({ expert_comptable_nom_ville: v })} placeholder="Ex. Cabinet Martin — Chambéry" />
              <Field label="Évolution familiale prévue — facultatif" value={form.evolution_prevue} onChange={(v) => patchCurrent({ evolution_prevue: v })} placeholder="Ex. mariage, PACS, naissance, séparation…" />
            </div>
          </section>
        </div>}

`;

text = text.slice(0, start) + block + text.slice(end);

if (!text.includes("xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]")) throw new Error('Compact family layout missing');
if (!text.includes("sm:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1fr)_10rem]")) throw new Error('Compact child row missing');
if (!text.includes("lg:grid-cols-3")) throw new Error('Full-width advisor fields row missing');

fs.writeFileSync(path, text);
console.log('Compact full-width family UX installed');
