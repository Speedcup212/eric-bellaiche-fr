import fs from 'node:fs';

const fn = fs.readFileSync('supabase/functions/generate-cif-audit/index.ts', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260828093000_add_audit_recommendations.sql', 'utf8');
const auditUi = fs.readFileSync('src/pages/portal/CifAuditPage.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');

const checks = [
  ['client audit version bumped', fn.includes("AUDIT-CLIENT-2026-08-31-1")],
  ['validated recommendation required', fn.includes("eq('statut','validated')") && fn.includes('recommandation conseiller doit être validée')],
  ['audit prepared for manual signature', fn.includes("signature_required:true") && fn.includes("signature_mode:'manual_youtrust'")],
  ['signature blocks rendered', fn.includes("h(c,'Signatures')") && fn.includes("{name:'Eric Bellaiche',role:'Conseiller'}")],
  ['audit archived as PDF', fn.includes("type_document:'audit_patrimonial'") && fn.includes("final_format:'pdf'")],
  ['snapshot hash prevents duplicate regeneration', fn.includes('snapshot_hash') && fn.includes('reused:true')],
  ['recueil QPI ESG readiness enforced', fn.includes('recueil_status') && fn.includes('qpi_status') && fn.includes('esg_status')],
  ['before and after charts', fn.includes('Allocation actuelle — Avant') && fn.includes('Allocation cible — Après')],
  ['chart legends are client-readable', fn.includes("size:8.8") && fn.includes('Répartition ${key.toUpperCase()}')],
  ['client section sequence', ['1. Synthèse exécutive','2. Arbitrage patrimonial et séquencement','3. SCPI','4. Assurance-vie','5. CTO','6. PEA','7. Arbitrages fiscaux','8. Adéquation','9. Plan de mise en œuvre','10. Conclusion'].every(x=>fn.includes(x))],
  ['PEA CTO SCPI annexes', fn.includes('Annexe 1 — Comprendre le PEA') && fn.includes('Annexe 2 — Comprendre le CTO') && fn.includes('Annexe 3 — Comprendre la SCPI')],
  ['selected support client descriptions', fn.includes('description') && fn.includes('Rôle dans l’allocation') && fn.includes('defaultSupportDescription')],
  ['editor supports client descriptions', auditUi.includes('description?: string') && auditUi.includes('Description courte pour le client')],
  ['editor has no visible V22 wording', !auditUi.includes('V22')],
  ['audit route is registered', app.includes('path="/cabinet/audit"') && app.includes('CifAuditPage')],
  ['recommendation model is structured', ['allocation jsonb','supports jsonb','sequencing jsonb','controls jsonb'].every(x=>migration.includes(x))],
  ['recommendation statuses constrained', migration.includes("check (statut in ('draft','validated'))")],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log(`Audit client pipeline: ${checks.length}/${checks.length} controls passed.`);
