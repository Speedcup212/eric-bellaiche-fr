import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const shared = fs.readFileSync('src/portal/FintechJourney.tsx', 'utf8');
const recueilJourney = fs.readFileSync('src/pages/portal/ClientRecueilJourneyBase.tsx', 'utf8');
const mfaJourney = fs.readFileSync('src/portal/MandatoryMfa.tsx', 'utf8');
const documentsJourney = fs.readFileSync('src/pages/portal/ClientDocumentsPage.tsx', 'utf8');
const sharedCreditValidation = fs.readFileSync('supabase/migrations/20261022100000_allow_confirmed_household_credits_for_secondary_validation.sql', 'utf8');
assert(shared.includes("disabled={busy} aria-invalid={nextDisabled || undefined}"), 'WizardFooter must stay clickable for validation errors and disable only while busy.');
assert(!shared.includes('disabled={nextDisabled || busy}'), 'WizardFooter must never be physically disabled by validation incompleteness.');
assert(documentsJourney.includes('Êtes-vous concerné(e) par un avis d’imposition ?'), 'The tax notice question must use clear wording.');
assert(documentsJourney.includes('Un avis commun au couple peut être déposé une seule fois dans le dossier.'), 'The document step must explain that a shared notice is uploaded once.');
assert(documentsJourney.includes('Oui, un avis personnel ou commun avec mon conjoint / ma conjointe'), 'The positive tax notice option must clearly cover a joint household notice.');
assert(documentsJourney.includes('2072-S/2072-C si la SCI est à l’IR ; 2065 et comptes annuels si elle est à l’IS'), 'SCI document guidance must distinguish IR and IS filing evidence.');
assert(documentsJourney.includes('Déposez les justificatifs des immeubles dans « Patrimoine immobilier ».') , 'SCI property evidence must point to the separate real-estate category.');
assert(mfaJourney.includes('Première activation : suivez ces 3 étapes'), 'MFA first-time setup must expose clear ordered steps.');
assert(mfaJourney.includes('La clé manuelle sert uniquement à configurer votre application. Gardez-la pour vous et ne l’envoyez à personne.'), 'MFA setup must state the manual key is confidential and only entered in the authenticator app.');
assert(mfaJourney.includes('Je ne peux pas scanner le QR code : afficher la clé à saisir dans l’application'), 'The manual-key fallback must explain where the key is used.');
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
