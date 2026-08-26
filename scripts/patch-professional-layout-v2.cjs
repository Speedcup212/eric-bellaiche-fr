const fs=require('fs');
const p='src/pages/portal/ClientRecueilJourneyBase.tsx';
let s=fs.readFileSync(p,'utf8');
const old=`{current.code === 'professional' && <div className="grid gap-6 lg:grid-cols-2 lg:gap-x-6 lg:gap-y-5">
          <div className="space-y-5">
            <Field label="Profession actuelle" required value={form.profession_actuelle} onChange={(v) => patchCurrent({ profession_actuelle: v })} />
            <Field label="Secteur d’activité" required value={form.secteur_activite} onChange={(v) => patchCurrent({ secteur_activite: v })} />
            <MonthYearField required={professionalNeedsEmployer} value={String(form.date_entree ?? '')} onChange={(v) => patchCurrent({ date_entree: v })} />
            {professionalNeedsIncomeOrigin && <Field label="Origine des revenus si sans activité" required value={form.origine_revenus_sans_activite} onChange={(v) => patchCurrent({ origine_revenus_sans_activite: v })} />}
          </div>
          <div className="space-y-5">
            <Field label="Entreprise" required={professionalNeedsEmployer} value={form.societe} onChange={(v) => patchCurrent({ societe: v })} />
            <Field label="Statut" required value={form.statut} onChange={(v) => patchCurrent({ statut: v })} placeholder="Autre statut" />
            {professionalNeedsChangeQuestion && <BoolChoice label="Un changement professionnel est-il prévu dans les prochains mois ?" value={form.changement_professionnel_prevu} onChange={(v) => patchCurrent({ changement_professionnel_prevu: v, changement_professionnel_details: v ? form.changement_professionnel_details : '' })} />}
            {professionalNeedsChangeQuestion && form.changement_professionnel_prevu === true && <Field label="Quel changement professionnel est prévu ?" required value={form.changement_professionnel_details} onChange={(v) => patchCurrent({ changement_professionnel_details: v })} placeholder="Ex. changement d’entreprise, création d’activité, retraite, évolution de rémunération…" />}
          </div>
        </div>}`;
const neu=`{current.code === 'professional' && <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.85fr)] lg:gap-x-6">
          <div className="space-y-5">
            <Field label="Profession actuelle" required value={form.profession_actuelle} onChange={(v) => patchCurrent({ profession_actuelle: v })} />
            <Field label="Entreprise" required={professionalNeedsEmployer} value={form.societe} onChange={(v) => patchCurrent({ societe: v })} />
            <Field label="Secteur d’activité" required value={form.secteur_activite} onChange={(v) => patchCurrent({ secteur_activite: v })} />
            <MonthYearField required={professionalNeedsEmployer} value={String(form.date_entree ?? '')} onChange={(v) => patchCurrent({ date_entree: v })} />
            {professionalNeedsIncomeOrigin && <Field label="Origine des revenus si sans activité" required value={form.origine_revenus_sans_activite} onChange={(v) => patchCurrent({ origine_revenus_sans_activite: v })} />}
            {professionalNeedsChangeQuestion && <BoolChoice label="Un changement professionnel est-il prévu dans les prochains mois ?" value={form.changement_professionnel_prevu} onChange={(v) => patchCurrent({ changement_professionnel_prevu: v, changement_professionnel_details: v ? form.changement_professionnel_details : '' })} />}
            {professionalNeedsChangeQuestion && form.changement_professionnel_prevu === true && <Field label="Quel changement professionnel est prévu ?" required value={form.changement_professionnel_details} onChange={(v) => patchCurrent({ changement_professionnel_details: v })} placeholder="Ex. changement d’entreprise, création d’activité, retraite, évolution de rémunération…" />}
          </div>
          <div className="space-y-5">
            <Field label="Statut" required value={form.statut} onChange={(v) => patchCurrent({ statut: v })} placeholder="Autre statut" />
          </div>
        </div>}`;
if(!s.includes(old)) throw new Error('Professional layout block not found; aborting to avoid a false success.');
s=s.replace(old,neu);
fs.writeFileSync(p,s);
console.log('Professional layout updated.');