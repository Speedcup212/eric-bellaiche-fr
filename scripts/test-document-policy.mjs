import fs from 'node:fs';
import assert from 'node:assert/strict';

const page = fs.readFileSync('src/pages/portal/ClientDocumentsPage.tsx', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260827094500_remove_identity_domicile_document_requirements.sql', 'utf8');

const categoriesMatch = page.match(/const categories = \[(.*?)\] as const;/s);
assert(categoriesMatch, 'Document categories block not found');
const categories = categoriesMatch[1];
assert(!categories.includes("'identite'"), 'Identity document must not be offered as a requested category');
assert(!categories.includes("'justificatif_domicile'"), 'Proof of address must not be offered as a requested category');

const requirementsMatch = page.match(/const requirements: Requirement\[] = \[(.*?)\];/s);
assert(requirementsMatch, 'Document requirements block not found');
const requirements = requirementsMatch[1];
assert(!requirements.includes("category: 'identite'"), 'Identity document must not be requested');
assert(!requirements.includes("category: 'justificatif_domicile'"), 'Proof of address must not be requested');

assert(!migration.includes("ds.categorie='identite'"), 'Backend completion must not require an identity document');
assert(!migration.includes("ds.categorie='justificatif_domicile'"), 'Backend completion must not require proof of address');
assert(!migration.includes('Ajoutez une pièce d’identité'), 'Old identity blocker must be removed');
assert(!migration.includes('Ajoutez au moins un justificatif de domicile'), 'Old domicile blocker must be removed');
assert(!migration.includes("if v_count=0 then raise exception 'Transmettez au moins un document"), 'A dossier with no required supporting document must be allowed to complete');
assert(!migration.includes("'identity_count'"), 'Transmission snapshot must not list identity as required');
assert(!migration.includes("'domicile'"), 'Transmission snapshot must not list domicile as required');

for (const retained of ["'avis_imposition'", "'patrimoine_financier'", "'patrimoine_immobilier'", "'tableau_amortissement'", "'sci_societe'"]) {
  assert(migration.includes(retained), `Expected conditional document requirement missing: ${retained}`);
}

console.log('Document policy: identity and domicile are not requested; conditional business documents remain enforced.');
