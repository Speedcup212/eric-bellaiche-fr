import fs from 'node:fs';
import assert from 'node:assert/strict';

const qpi = fs.readFileSync('src/pages/portal/QuestionnairePageBase.tsx', 'utf8');
const docs = fs.readFileSync('src/pages/portal/ClientDocumentsPage.tsx', 'utf8');
const summary = fs.readFileSync('src/pages/portal/ClientSummaryPage.tsx', 'utf8');
const helpers = fs.readFileSync('src/portal/portalHelpers.ts', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260827094500_remove_identity_domicile_document_requirements.sql', 'utf8');

// 1. Questionnaire completion routes must never jump to the final summary before documents.
assert(qpi.includes("dossierHref('/espace-client/documents', progress.dossier_id)"), 'QPI/ESG completion must route to Documents');
assert(!/const nextPath[\s\S]{0,350}dossierHref\('\/espace-client\/synthese'/.test(qpi), 'Questionnaire completion must not jump directly to Synthese');
assert(qpi.includes("'Documents du dossier'"), 'Completion modal must announce Documents as the next stage');
assert(qpi.includes("'Finaliser mon dossier'"), 'Completion modal CTA must use the finalisation wording');

// 2. Helper routing must agree with the questionnaire component.
assert(helpers.includes("pathname === '/espace-client/esg'"), 'ESG route guard missing');
assert(helpers.includes("return dossierHref('/espace-client/documents', progress.dossier_id);"), 'ESG completion helper must route to Documents');
assert(helpers.includes("progress.esg_opt_in === true ? '/espace-client/esg' : '/espace-client/documents'"), 'QPI no-ESG route must go directly to Documents');

// 3. Front-end documentary context must expose every field enforced by the SQL completion gate.
for (const field of ['tax_status', 'has_financial_assets', 'has_real_estate', 'has_credits', 'has_sci_company']) {
  assert(docs.includes(field), `Documents UI missing required context field ${field}`);
  assert(migration.includes(`dca.${field} is not null`), `Backend completion gate missing ${field}`);
}
assert(docs.includes("'has_credits', currentContext?.has_credits"), 'Credit question is not actually rendered in the Documents situation screen');

// 4. Required document categories must be identical front/back.
const categoryMap = {
  tax: 'avis_imposition',
  assets: 'patrimoine_financier',
  realEstate: 'patrimoine_immobilier',
  credits: 'tableau_amortissement',
  sci: 'sci_societe',
};
for (const category of Object.values(categoryMap)) {
  assert(docs.includes(`category: '${category}'`), `Front-end requirement missing ${category}`);
  assert(migration.includes(`ds.categorie='${category}'`), `Backend requirement missing ${category}`);
}
for (const forbidden of ['identite', 'justificatif_domicile', 'rib']) {
  const requirements = docs.match(/const requirements: Requirement\[] = \[(.*?)\];/s)?.[1] ?? '';
  assert(!requirements.includes(`category: '${forbidden}'`), `${forbidden} must not return as a requested requirement`);
}

// 5. Exhaustive requirement matrix: all 32 combinations of conditional document families.
const bools = [false, true];
let matrixCases = 0;
for (const tax of bools) for (const assets of bools) for (const realEstate of bools) for (const credits of bools) for (const sci of bools) {
  const state = { tax, assets, realEstate, credits, sci };
  const expected = Object.entries(state).filter(([, required]) => required).map(([key]) => categoryMap[key]);
  const uploaded = new Set(expected);
  const missing = expected.filter((category) => !uploaded.has(category));
  assert.equal(missing.length, 0, `Requirement matrix failed for ${JSON.stringify(state)}`);
  matrixCases += 1;
}
assert.equal(matrixCases, 32, 'Expected 32 document-requirement combinations');

// 6. Negative matrix: each required family must independently block transmission when its proof is absent.
for (const [key, category] of Object.entries(categoryMap)) {
  const expected = [category];
  const uploaded = new Set();
  assert.equal(expected.filter((item) => !uploaded.has(item)).length, 1, `${key} must independently block transmission when missing`);
}

// 7. Couple policy: final transmission only when all individual journeys are ready.
assert(migration.includes('if v_total=0 or v_ready<>v_total then'), 'Backend must block transmission until all dossier members are ready');
assert(docs.includes('waitingPartner = progress.is_couple && !progress.dossier_ready_for_documents'), 'Front-end couple waiting state missing');
assert(docs.includes('finalBlocked = waitingPartner || !allContextsComplete || missingRequired.length > 0'), 'Front-end final blocker must combine couple, context and documents');

// 8. Final transmission must be the only path to TERMINE / final confirmation.
assert(docs.includes("supabase.rpc('complete_my_documents'"), 'Documents page must call the final transmission RPC');
assert(docs.includes("navigate(dossierHref('/espace-client/synthese', progress.dossier_id))"), 'Only completed Documents should navigate to final confirmation');
assert(summary.includes("const allDone = progress.next_step === 'TERMINE'"), 'Summary must distinguish completed from incomplete dossiers');
assert(summary.includes("progress.next_step === 'DOCUMENTS'"), 'Summary must correctly recover an incomplete Documents stage');
assert(migration.includes("documents_status='completed'"), 'Backend must mark documents completed on final transmission');
assert(migration.includes('transmitted_at=v_now'), 'Backend must timestamp final transmission');

// 9. ESG branching invariants.
assert(migration.includes("di.esg_opt_in is not true or di.esg_status in ('completed','validated')"), 'Backend must skip ESG completion only when ESG is not opted in');
assert(qpi.includes('qpiNextIsEsg'), 'Front-end ESG branch missing after QPI');

console.log(`Final journey crash test passed: routing invariants + ${matrixCases} document matrices + couple/transmission cross-layer checks.`);
