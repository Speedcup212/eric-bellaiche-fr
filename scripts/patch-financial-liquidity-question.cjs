const fs = require('fs');
const p = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let s = fs.readFileSync(p, 'utf8');
function replaceOnce(from, to, label) {
  if (!s.includes(from)) throw new Error(`Missing target: ${label}`);
  s = s.replace(from, to);
}
replaceOnce(
  "financial: { current_accounts_amount: '', categories: [], total_band: '', other_details: '', completeness_confirmed: false },",
  "financial: { current_accounts_intentional: '', current_accounts_amount: '', categories: [], total_band: '', other_details: '', completeness_confirmed: false },",
  'financial initial state'
);
replaceOnce(
  "if (!isNonNegativeNumber(form.current_accounts_amount)) throw new Error('Indiquez le montant actuellement disponible sur l’ensemble de vos comptes courants. Saisissez 0 si le solde est nul.');",
  "if (form.current_accounts_intentional === '') throw new Error('Indiquez si vous conservez volontairement une part importante de vos liquidités sur vos comptes courants.');\n      if (form.current_accounts_intentional === true && !isNonNegativeNumber(form.current_accounts_amount)) throw new Error('Indiquez un montant approximatif de liquidités concerné.');",
  'financial validation'
);
const oldUi = `<GuidanceNote><p>Une déclaration rapide, sans relevé de compte courant</p><p>Indiquez uniquement le montant disponible sur vos comptes courants. Pour les placements, sélectionnez les grandes familles détenues : les établissements, contrats et montants exacts seront repris à partir des justificatifs transmis ensuite.</p></GuidanceNote>\n          <section>\n            <MoneyField label="Quel est le montant actuel disponible sur l’ensemble de vos comptes courants ?" required value={form.current_accounts_amount} onChange={(value) => patchCurrent({ current_accounts_amount: value, completeness_confirmed: false })} />\n            <p className="mt-2 text-xs leading-5 text-[#94A3B8]">{progress.is_couple && progress.role_dossier === 'investisseur_2' ? 'Indiquez uniquement le total de vos comptes personnels. Les comptes joints ou communs sont déclarés par l’Identifiant 1.' : progress.is_couple ? 'Additionnez vos comptes personnels ainsi que les comptes joints ou communs. Ils ne devront pas être déclarés une seconde fois par l’Identifiant 2.' : 'Additionnez l’ensemble de vos comptes personnels.'} Indiquez 0 € si aucun montant n’est disponible. Aucun relevé de compte courant n’est demandé.</p>\n          </section>`;
const newUi = `<GuidanceNote><p>Une déclaration simple, sans détail bancaire</p><p>Nous cherchons uniquement à savoir si une part importante de vos liquidités reste volontairement sur vos comptes courants. Aucun relevé, nom de banque ou numéro de compte n’est demandé.</p></GuidanceNote>\n          <section>\n            <BoolChoice label="Conservez-vous volontairement une part importante de vos liquidités sur vos comptes courants ?" value={form.current_accounts_intentional} onChange={(v) => patchCurrent({ current_accounts_intentional: v, current_accounts_amount: v ? form.current_accounts_amount : '', completeness_confirmed: false })} />\n            {form.current_accounts_intentional === true && <div className="mt-5">\n              <MoneyField label="À combien estimez-vous approximativement le montant concerné ?" required value={form.current_accounts_amount} onChange={(value) => patchCurrent({ current_accounts_amount: value, completeness_confirmed: false })} />\n              <p className="mt-2 text-xs leading-5 text-[#94A3B8]">Un ordre de grandeur suffit. Aucun détail bancaire n’est demandé.</p>\n            </div>}\n          </section>`;
replaceOnce(oldUi, newUi, 'financial current accounts UI');
fs.writeFileSync(p, s);
console.log('Financial liquidity question patched successfully.');