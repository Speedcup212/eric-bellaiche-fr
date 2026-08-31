import fs from 'node:fs';

const fn = fs.readFileSync('supabase/functions/generate-cif-adequation/index.ts', 'utf8');
const sourceView = fs.readFileSync('supabase/migrations/20260831123000_add_adequation_source_view.sql', 'utf8');

const checks = [
  ['adequation source is validated audit only', sourceView.includes("where ar.statut = 'validated'") && sourceView.includes('ar.validated_at is not null')],
  ['generator reads adequation_source', fn.includes("from('adequation_source')")],
  ['audit allocation is reused without recalculation', fn.includes('source.allocation') && fn.includes('source.supports')],
  ['client identity and profile sections', fn.includes('Rappel des données du client') && fn.includes('Profil investisseur')],
  ['durability section', fn.includes('Préférences en matière de durabilité')],
  ['recommendation section', fn.includes('Solutions envisagées et recommandation')],
  ['suitability justification section', fn.includes('Justification de l’adéquation')],
  ['risks section', fn.includes('Risques liés aux supports recommandés')],
  ['annual follow-up section', fn.includes('Suivi de l’investissement') && fn.includes('au moins annuellement')],
  ['costs ex ante separate', fn.includes('Les informations ex ante relatives aux coûts') && fn.includes("costs_ex_ante:'separate_document'")],
  ['manual signature blocks', fn.includes("signature_required:true") && fn.includes("signature_mode:'manual_youtrust'") && fn.includes("h(c,'Signatures')")],
  ['archived declaration PDF', fn.includes("type_document:'declaration_adequation'") && fn.includes("final_format:'pdf'")],
  ['deterministic reuse', fn.includes('snapshot_hash') && fn.includes('reused:true')],
];
let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log(`Adequation pipeline: ${checks.length}/${checks.length} controls passed.`);
