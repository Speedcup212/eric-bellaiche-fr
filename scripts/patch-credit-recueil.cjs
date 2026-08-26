const fs = require('fs');

const path = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let text = fs.readFileSync(path, 'utf8');

text = text.replace(
  "{ code: 'credits', label: 'Crédits', title: 'Crédits en cours', description: 'Déclarez rapidement vos crédits et leurs principales mensualités. Les tableaux d’amortissement permettront ensuite de reprendre les informations détaillées.' },",
  "{ code: 'credits', label: 'Crédits', title: 'Crédits en cours', description: 'Indiquez vos crédits en cours. Les tableaux d’amortissement permettront ensuite de compléter automatiquement les informations détaillées.' },"
);

const validationPattern = /    if \(current\.code === 'credits'\) \{\n      if \(typeof form\.has_credits !== 'boolean'\)[\s\S]*?\n    \}\n  \};/;
const validationReplacement = `    if (current.code === 'credits') {
      if (typeof form.has_credits !== 'boolean') throw new Error('Indiquez si vous avez un ou plusieurs crédits en cours.');
      if (form.has_credits === true && (form.items ?? []).length === 0) throw new Error('Ajoutez au moins un crédit.');
      for (const item of form.items ?? []) {
        if ([item.type_credit, item.capital_restant_du, item.mensualite, item.date_fin].some(isBlank)) throw new Error('Complétez les quatre informations essentielles de chaque crédit.');
        if (!isNonNegativeNumber(item.capital_restant_du) || !isNonNegativeNumber(item.mensualite)) throw new Error('Le capital restant dû et la mensualité doivent être positifs ou nuls.');
        if (!/^\\d{4}-\\d{2}$/.test(String(item.date_fin))) throw new Error('Indiquez le mois et l’année de fin approximative de chaque crédit.');
      }
    }
  };`;
if (!validationPattern.test(text)) throw new Error('Credit validation block not found');
text = text.replace(validationPattern, validationReplacement);

const creditPattern = /        \{current\.code === 'credits' && <div className="credit-section space-y-6">[\s\S]*?\n        <\/div>\}\n\n        \{errorMessage/;
const creditReplacement = `        {current.code === 'credits' && <div className="credit-section space-y-6">
          <GuidanceNote><p>Déclaration simplifiée</p><p>Indiquez vos crédits en cours. Les tableaux d’amortissement permettront ensuite au cabinet de compléter les informations détaillées.</p></GuidanceNote>
          <div>
            <p className="text-sm font-semibold text-[#F1F5F9]">Avez-vous un ou plusieurs crédits en cours ? *</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button type="button" aria-pressed={form.has_credits === true} onClick={() => patchCurrent({ has_credits: true, items: (form.items ?? []).length > 0 ? form.items : [{ type_credit: '', capital_restant_du: '', mensualite: '', date_fin: '' }] })} className={\`rounded-2xl border p-4 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 \${form.has_credits === true ? 'border-[#3B82F6] bg-[#3B82F6] text-white shadow-md shadow-blue-950/25' : 'border-[#E2E8F0] bg-white text-slate-800 hover:-translate-y-0.5 hover:border-[#3B82F6] hover:shadow-md'}\`}><span className="block text-base font-semibold">Oui</span><span className={\`mt-1 block text-xs \${form.has_credits === true ? 'text-blue-100' : 'text-slate-500'}\`}>J’ai un ou plusieurs crédits</span></button>
              <button type="button" aria-pressed={form.has_credits === false} onClick={() => patchCurrent({ has_credits: false, items: [] })} className={\`rounded-2xl border p-4 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 \${form.has_credits === false ? 'border-[#3B82F6] bg-[#3B82F6] text-white shadow-md shadow-blue-950/25' : 'border-[#E2E8F0] bg-white text-slate-800 hover:-translate-y-0.5 hover:border-[#3B82F6] hover:shadow-md'}\`}><span className="block text-base font-semibold">Non</span><span className={\`mt-1 block text-xs \${form.has_credits === false ? 'text-blue-100' : 'text-slate-500'}\`}>Aucun crédit en cours</span></button>
            </div>
          </div>
          {form.has_credits === true && <div>
            <div className="flex items-center justify-between gap-4"><div><h3 className="font-semibold text-[#F1F5F9]">Vos crédits</h3><p className="mt-1 text-xs text-[#94A3B8]">Une fiche courte par crédit. Les informations détaillées seront reprises depuis les justificatifs.</p></div><button type="button" onClick={() => patchCurrent({ items: [...(form.items ?? []), { type_credit: '', capital_restant_du: '', mensualite: '', date_fin: '' }] })} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#3B82F6] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2563EB]"><Plus className="h-4 w-4" /> Ajouter un crédit</button></div>
            {(form.items ?? []).map((item: AnyPayload, index: number) => <div key={index} className="credit-card mt-4 rounded-2xl border p-5">
              <div className="flex items-center justify-between gap-3"><p className="font-semibold text-white">Crédit {index + 1}</p>{(form.items ?? []).length > 1 && <button type="button" onClick={() => removeList('items', index)} className="inline-flex items-center gap-1 text-xs font-semibold text-red-400"><Trash2 className="h-3.5 w-3.5" /> Supprimer</button>}</div>
              <div className="recueil-question-grid mt-5 grid gap-x-5 gap-y-6 sm:grid-cols-2">
                <CompactSelectField label="Type de crédit" required value={item.type_credit} onChange={(value) => updateList('items', index, { type_credit: value })} options={['Crédit immobilier résidence principale', 'Crédit immobilier locatif', 'Crédit à la consommation', 'Crédit automobile', 'Crédit étudiant', 'Crédit travaux', 'Crédit professionnel', 'Autre crédit']} />
                <MoneyField label="Capital restant dû approximatif (€)" required value={item.capital_restant_du} onChange={(value) => updateList('items', index, { capital_restant_du: value })} />
                <MoneyField label="Mensualité actuelle (€)" required value={item.mensualite} onChange={(value) => updateList('items', index, { mensualite: value })} />
                <MonthYearField label="Fin approximative du crédit" required value={String(item.date_fin ?? '')} onChange={(value) => updateList('items', index, { date_fin: value })} />
              </div>
            </div>)}
          </div>}
        </div>}

        {errorMessage`;
if (!creditPattern.test(text)) throw new Error('Credit render block not found');
text = text.replace(creditPattern, creditReplacement);

const oldNote = `{current.code === 'patrimony' ? <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs leading-5 text-[#CBD5E1]">Vos informations sont enregistrées de manière sécurisée.</div> : <RecueilInfoNote title="Enregistrement et traçabilité"><p>Les champs marqués * sont obligatoires. Les justificatifs transmis en fin de parcours permettront au cabinet de vérifier et compléter les informations détaillées.</p><p className="mt-1.5 text-[#aebfd4]">Chaque partie est enregistrée et horodatée. Après validation finale, vos réponses sont figées afin de préserver la piste d’audit.</p></RecueilInfoNote>}`;
const newNote = `{current.code === 'credits' ? null : current.code === 'patrimony' ? <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs leading-5 text-[#CBD5E1]">Vos informations sont enregistrées de manière sécurisée.</div> : <RecueilInfoNote title="Enregistrement et traçabilité"><p>Les champs marqués * sont obligatoires. Les justificatifs transmis en fin de parcours permettront au cabinet de vérifier et compléter les informations détaillées.</p><p className="mt-1.5 text-[#aebfd4]">Chaque partie est enregistrée et horodatée. Après validation finale, vos réponses sont figées afin de préserver la piste d’audit.</p></RecueilInfoNote>}`;
if (!text.includes(oldNote)) throw new Error('Recueil info note block not found');
text = text.replace(oldNote, newNote);

fs.writeFileSync(path, text);
console.log('Credit recueil UX patched');
