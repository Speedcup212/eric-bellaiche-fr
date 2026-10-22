import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const shared = fs.readFileSync('src/portal/FintechJourney.tsx', 'utf8');
const recueilJourney = fs.readFileSync('src/pages/portal/ClientRecueilJourneyBase.tsx', 'utf8');
const documentsJourney = fs.readFileSync('src/pages/portal/ClientDocumentsPage.tsx', 'utf8');
const sharedCreditValidation = fs.readFileSync('supabase/migrations/20261022100000_allow_confirmed_household_credits_for_secondary_validation.sql', 'utf8');
assert(shared.includes("disabled={busy} aria-invalid={nextDisabled || undefined}"), 'WizardFooter must stay clickable for validation errors and disable only while busy.');
assert(!shared.includes('disabled={nextDisabled || busy}'), 'WizardFooter must never be physically disabled by validation incompleteness.');
assert.match(documentsJourney, /Êtes-vous concerné\\(e\\) par un avis d’imposition \\?/u, 'The tax notice question must use clear wording.');
assert.match(documentsJourney, /Un avis commun au couple peut être déposé une seule fois dans le dossier\\./u, 'The document step must explain that a shared notice is uploaded once.');
assert.match(documentsJourney, /Oui, un avis personnel ou commun avec mon conjoint \\/ ma conjointe/u, 'The positive tax notice option must clearly cover a joint household notice.');
assert.match(recueilJourney, /MAX_RECUEIL_OBJECTIVES = 5/, 'The recueil objective selector must respect the database maximum priority.');
assert.match(recueilJourney, /form\.items\.length > MAX_RECUEIL_OBJECTIVES/, 'Objective submissions must be checked before they reach the database.');
assert.match(recueilJourney, /disabled=\{limitReached\}/, 'The objective picker must prevent selecting a sixth priority.');
assert.match(sharedCreditValidation, /new\.role_dossier = 'investisseur_2'/, 'Secondary investors must use the shared-household credit validation path.');
assert.match(sharedCreditValidation, /hc\.confirmer_investisseur_id = new\.investisseur_id[\s\S]*hc\.status = 'confirmed'[\s\S]*hc\.source_updated_at >= rs\.updated_at/, 'The shared credit confirmation must belong to investor 2 and be current.');

const root = 'src/pages/portal';
const files = fs.readdirSync(root).filter((name) => name.endsWith('.tsx'));
const suspicious = [];
for (const name of files) {
  const full = path.join(root, name);
  const source = fs.readFileSync(full, 'utf8');
  const lines = source.split('\n');
  lines.forEach((line, index) => {
    const normalized = line.replace(/\s+/g, ' ');
    const looksLikePrimaryValidationDisable = /disabled=\{[^}]*(!?\w*(Complete|complete|Incomplete|incomplete|Blocked|blocked|Valid|valid)[^}]*)\}/.test(normalized)
      && /(Continuer|Suivant|Valider|Finaliser|Voir mes justificatifs|Dossier incomplet|WizardFooter)/.test(normalized);
    if (looksLikePrimaryValidationDisable) suspicious.push(`${name}:${index + 1}: ${normalized.trim()}`);
  });
}

assert.equal(suspicious.length, 0, `Primary navigation controls must validate on click instead of becoming inert:\n${suspicious.join('\n')}`);
console.log(`Validation UX policy OK across ${files.length} portal pages: primary navigation remains clickable and validation-driven.`);
