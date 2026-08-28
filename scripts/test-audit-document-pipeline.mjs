import fs from 'node:fs';

const fn = fs.readFileSync('supabase/functions/generate-cif-audit/index.ts', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260828093000_add_audit_recommendations.sql', 'utf8');

const checks = [
  ['V22 model version', fn.includes("V22-CAMEMBERTS-PLEINE-LARGEUR-2026")],
  ['validated recommendation required', fn.includes("eq('statut','validated')") && fn.includes('recommandation conseiller doit être validée')],
  ['audit does not require signature', fn.includes("signature_required:false")],
  ['audit archived as PDF', fn.includes("type_document:'audit_patrimonial'") && fn.includes("final_format:'pdf'")],
  ['snapshot hash prevents duplicate regeneration', fn.includes('snapshot_hash') && fn.includes('reused:true')],
  ['recueil QPI ESG readiness enforced', fn.includes('recueil_status') && fn.includes('qpi_status') && fn.includes('esg_status')],
  ['before and after charts', fn.includes('Allocation actuelle — Avant') && fn.includes('Allocation cible — Après')],
  ['mono-product chart support', fn.includes('Répartition ${key.toUpperCase()}')],
  ['V22 section sequence', ['1. Synthèse exécutive','2. Arbitrage patrimonial et séquencement','3. SCPI','4. Assurance-vie','5. CTO','6. PEA','7. Arbitrages fiscaux','8. Adéquation','9. Mise en œuvre','10. Conclusion'].every(x=>fn.includes(x))],
  ['PEA CTO SCPI annexes', fn.includes('ANNEXE 1 — PEA') && fn.includes('ANNEXE 2 — CTO') && fn.includes('ANNEXE 3 — SCPI')],
  ['recommendation model is structured', ['allocation jsonb','supports jsonb','sequencing jsonb','controls jsonb'].every(x=>migration.includes(x))],
  ['recommendation statuses constrained', migration.includes("check (statut in ('draft','validated'))")],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log(`Audit V22 pipeline: ${checks.length}/${checks.length} controls passed.`);
