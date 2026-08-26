const fs = require('fs');

const path = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let text = fs.readFileSync(path, 'utf8');

const start = text.indexOf("        {current.code === 'family'");
const end = text.indexOf("        {current.code === 'professional'", start);
if (start < 0 || end < 0) throw new Error('Family block markers not found');

const familyBlock = `        {current.code === 'family' && <div className="space-y-5">
          <section className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-[#F1F5F9]">Situation familiale</h3>
              <p className="mt-1 text-xs leading-5 text-[#94A3B8]">Indiquez votre situation actuelle. Les questions complémentaires apparaissent uniquement si elles sont utiles.</p>
            </div>
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(17rem,0.85fr)]">
              <Field label="Situation familiale" required value={form.situation} onChange={(v) => {
                const normalized = String(v).toLowerCase();
                const needsConvention = normalized.includes('mari') || normalized.includes('pacs');
                patchCurrent({ situation: v, regime_convention: needsConvention ? form.regime_convention : '' });
              }} placeholder="Autre situation" />
              {familyNeedsEventDate && <MonthYearField label={familyEventLabel} required minYear={1900} value={String(form.date_evenement ?? '')} onChange={(v) => patchCurrent({ date_evenement: v })} />}
            </div>
          </section>

          {familyNeedsConvention && <section className="border-t border-white/10 pt-5">
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(16rem,0.85fr)]">
              <Field label="Régime / convention" required value={form.regime_convention} onChange={(v) => patchCurrent({ regime_convention: v })} placeholder="Autre régime / convention" />
              {familyNeedsMatrimonialAdvantage && <Field label="Avantage matrimonial" value={form.avantage_matrimonial} onChange={(v) => patchCurrent({ avantage_matrimonial: v })} />}
            </div>
          </section>}

          <section className="border-t border-white/10 pt-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[#F1F5F9]">Enfants</h3>
                <p className="mt-1 text-xs leading-5 text-[#94A3B8]">Renseignez l'identité et l'année de naissance de chaque enfant.</p>
              </div>
              <div className="w-full sm:w-44">
                <Field label="Nombre d’enfants" required type="number" value={form.nombre_enfants} onChange={resizeChildren} />
              </div>
            </div>
            {Number(form.nombre_enfants) > 0 && <div className="mt-4 space-y-2">
              {(Array.isArray(form.enfants) ? form.enfants : []).map((child: AnyPayload, index: number) => <div key={index} className="grid items-end gap-3 border-t border-white/10 pt-3 first:border-t-0 first:pt-0 sm:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1fr)_10rem]">
                <div className="pb-3 text-xs font-bold uppercase tracking-[0.12em] text-[#93C5FD]">Enfant {index + 1}</div>
                <Field label="Prénom" required value={child.prenom} onChange={(v) => updateChild(index, { prenom: v })} />
                <Field label="Nom" required value={child.nom} onChange={(v) => updateChild(index, { nom: v })} />
                <Field label="Année de naissance" required type="number" value={child.annee_naissance} onChange={(v) => updateChild(index, { annee_naissance: v })} placeholder="Ex. 2014" />
              </div>)}
            </div>}
          </section>

          <section className="border-t border-white/10 pt-5">
            <h3 className="text-base font-semibold text-[#F1F5F9]">Intervenants et évolution familiale</h3>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <Field label="Notaire (nom et ville) — facultatif" value={form.notaire_nom_ville} onChange={(v) => patchCurrent({ notaire_nom_ville: v })} placeholder="Ex. Maître Dupont — Grenoble" />
              <Field label="Expert-comptable (nom et ville) — facultatif" value={form.expert_comptable_nom_ville} onChange={(v) => patchCurrent({ expert_comptable_nom_ville: v })} placeholder="Ex. Cabinet Martin — Chambéry" />
              <Field label="Évolution familiale prévue — facultatif" value={form.evolution_prevue} onChange={(v) => patchCurrent({ evolution_prevue: v })} placeholder="Ex. mariage, PACS, naissance, séparation…" />
            </div>
          </section>
        </div>}

`;

text = text.slice(0, start) + familyBlock + text.slice(end);

if (!text.includes('Intervenants et évolution familiale')) throw new Error('Flat family UX not installed');
if (!text.includes("sm:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1fr)_10rem]")) throw new Error('Compact children row not installed');
if (text.includes('rounded-2xl border border-white/10 p-4 sm:p-5') && text.includes("current.code === 'family'")) {
  console.warn('Other rounded boxes may exist elsewhere; family block replaced successfully.');
}

fs.writeFileSync(path, text);
console.log('Flat premium family UX installed');
