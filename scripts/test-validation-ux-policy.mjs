import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const shared = fs.readFileSync('src/portal/FintechJourney.tsx', 'utf8');
assert(shared.includes("disabled={busy} aria-invalid={nextDisabled || undefined}"), 'WizardFooter must stay clickable for validation errors and disable only while busy.');
assert(!shared.includes('disabled={nextDisabled || busy}'), 'WizardFooter must never be physically disabled by validation incompleteness.');

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
