import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const path = 'supabase/migrations/20260826165000_harden_couple_family_sync.sql';
const sql = await readFile(path, 'utf8');

const expected = [
  "if v_role <> 'investisseur_1' then",
  "('marié', 'marie', 'pacsé', 'pacse', 'concubinage')",
  "lower(trim(p_email)) = v_primary_email",
  "'spouse_needs_invite', v_spouse_auth is null",
  "rs.section_code = 'family'",
  "rs.section_code = 'identity'",
  "rs.section_code not in ('identity', 'family')",
  "La deuxième personne a déjà été invitée ou a commencé son parcours",
];

for (const token of expected) {
  assert.ok(sql.includes(token), `Couple policy safeguard missing: ${token}`);
}

assert.ok(sql.includes("on conflict(dossier_id, investisseur_id, section_code) do update"), 'Shared family payload must be synchronized.');
assert.ok(sql.includes("on conflict(dossier_id, investisseur_id, section_code) do nothing"), 'Existing personal identity payload must not be overwritten.');
assert.ok(sql.includes("delete from public.dossier_investisseurs"), 'Unused synthetic spouse must be removable before activation.');

console.log(`Couple family policy: ${expected.length + 3} safeguards validated.`);
