const fs = require('fs');

const path = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let text = fs.readFileSync(path, 'utf8');

const validationPattern = /    if \(current\.code === 'credits'\) \{\n      if \(typeof form\.has_credits !== 'boolean'\) throw new Error\('Indiquez si vous avez un ou plusieurs crédits en cours\.'\);[\s\S]*?\n    \}\n  \};/;
const validationReplacement = `    if (current.code === 'credits') {
      if (typeof form.has_credits !== 'boolean') throw new Error('Indiquez si vous avez un ou plusieurs crédits en cours.');
      if (form.has_credits === true && (form.items ?? []).length === 0) throw new Error('Ajoutez au moins un crédit.');
      for (const item of form.items ?? []) {
        if ([item.taux_credit, item.credit_rattache_a].some(isBlank)) throw new Error('Complétez le taux et le bien financé / crédit rattaché à pour chaque crédit.');
        if (!isNonNegativeNumber(item.taux_credit)) throw new Error('Le taux du crédit doit être un nombre positif ou nul.');
      }
    }
  };`;
if (!validationPattern.test(text)) throw new Error('Credit validation block not found');
text = text.replace(validationPattern, validationReplacement);

const creditPattern = /        \{current\.code === 'credits' && <div className="credit-section space-y-6">[\s\S]*?\n        <\/div>\}\n\n        \{errorMessage/;
const creditReplacement = `        {current.code === 'credits' && <div className="credit-section space-y-6">
          <GuidanceNote><p>Déclaration simplifiée</p><p>Indiquez simplement si vous avez des crédits, leur taux et à quoi ils sont rattachés. Le tableau d’amortissement permettra ensuite au cabinet de reprendre le capital restant dû, la mensualité, la durée et les autres caractéristiques.</p></GuidanceNote>
          <div>
            <p className="text-sm font-semibold text-[#F1F5F9]">Avez-vous un ou plusieurs crédits en cours ? *</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button type="button" aria-pressed={form.has_credits === true} onClick={() => patchCurrent({ has_credits: true, items: (form.items ?? []).length > 0 ? form.items : [{ taux_credit: '', credit_rattache_a: '' }] })} className={\`rounded-2xl border p-4 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 \${form.has_credits === true ? 'border-[#3B82F6] bg-[#3B82F6] text-white shadow-md shadow-blue-950/25' : 'border-[#E2E8F0] bg-white text-slate-800 hover:-translate-y-0.5 hover:border-[#3B82F6] hover:shadow-md'}\`}><span className="block text-base font-semibold">Oui</span><span className={\`mt-1 block text-xs \${form.has_credits === true ? 'text-blue-100' : 'text-slate-500'}\`}>J’ai un ou plusieurs crédits</span></button>
              <button type="button" aria-pressed={form.has_credits === false} onClick={() => patchCurrent({ has_credits: false, items: [] })} className={\`rounded-2xl border p-4 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 \${form.has_credits === false ? 'border-[#3B82F6] bg-[#3B82F6] text-white shadow-md shadow-blue-950/25' : 'border-[#E2E8F0] bg-white text-slate-800 hover:-translate-y-0.5 hover:border-[#3B82F6] hover:shadow-md'}\`}><span className="block text-base font-semibold">Non</span><span className={\`mt-1 block text-xs \${form.has_credits === false ? 'text-blue-100' : 'text-slate-500'}\`}>Aucun crédit en cours</span></button>
            </div>
          </div>
          {form.has_credits === true && <div>
            <div className="flex items-center justify-between gap-4"><div><h3 className="font-semibold text-[#F1F5F9]">Vos crédits</h3><p className="mt-1 text-xs text-[#94A3B8]">Une ligne par crédit. Le rattachement permet d’identifier sans ambiguïté le prêt concerné lorsque plusieurs biens ou plusieurs crédits existent.</p></div><button type="button" onClick={() => patchCurrent({ items: [...(form.items ?? []), { taux_credit: '', credit_rattache_a: '' }] })} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#3B82F6] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2563EB]"><Plus className="h-4 w-4" /> Ajouter un crédit</button></div>
            {(form.items ?? []).map((item: AnyPayload, index: number) => <div key={index} className="credit-card mt-4 rounded-2xl border p-5">
              <div className="flex items-center justify-between gap-3"><p className="font-semibold text-white">Crédit {index + 1}</p>{(form.items ?? []).length > 1 && <button type="button" onClick={() => removeList('items', index)} className="inline-flex items-center gap-1 text-xs font-semibold text-red-400"><Trash2 className="h-3.5 w-3.5" /> Supprimer</button>}</div>
              <div className="recueil-question-grid mt-5 grid gap-x-5 gap-y-6 sm:grid-cols-2">
                <Field label="Taux du crédit (%)" required type="number" value={item.taux_credit} onChange={(value) => updateList('items', index, { taux_credit: value })} placeholder="Ex. 3,45" />
                <Field label="Bien financé / crédit rattaché à" required value={item.credit_rattache_a} onChange={(value) => updateList('items', index, { credit_rattache_a: value })} placeholder="Ex. résidence principale Grenoble, appartement Lyon, véhicule, crédit consommation…" />
              </div>
            </div>)}
          </div>}
        </div>}

        {errorMessage`;
if (!creditPattern.test(text)) throw new Error('Credit render block not found');
text = text.replace(creditPattern, creditReplacement);

if (text.includes('Capital restant dû approximatif (€)') || text.includes('Fin approximative du crédit') || text.includes('Mensualité actuelle (€)') || text.includes('<CompactSelectField label="Type de crédit" required')) {
  throw new Error('Un ancien champ crédit est encore présent');
}

fs.writeFileSync(path, text);
console.log('Credit recueil reduced to rate + linked asset');
