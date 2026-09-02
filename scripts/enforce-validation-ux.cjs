const fs = require('fs');

const path = 'src/portal/FintechJourney.tsx';
let source = fs.readFileSync(path, 'utf8');
let changed = false;

const oldButton = `<button type="button" disabled={nextDisabled || busy} onClick={onNext} className="inline-flex items-center gap-2 rounded-xl bg-[#0b1f3a] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#0b1f3a]/15 transition hover:-translate-y-0.5 hover:bg-[#173967] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40">\n        {busy ? 'Enregistrement…' : nextLabel} <ArrowRight className="h-4 w-4" />\n      </button>`;

const newButton = `<button type="button" disabled={busy} aria-invalid={nextDisabled || undefined} data-validation-pending={nextDisabled ? 'true' : undefined} onClick={onNext} className="inline-flex items-center gap-2 rounded-xl bg-[#0b1f3a] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#0b1f3a]/15 transition hover:-translate-y-0.5 hover:bg-[#173967] disabled:translate-y-0 disabled:cursor-wait disabled:opacity-60">\n        {busy ? 'Enregistrement…' : nextLabel} <ArrowRight className="h-4 w-4" />\n      </button>`;

if (source.includes(oldButton)) {
  source = source.replace(oldButton, newButton);
  changed = true;
}

if (!source.includes('disabled={busy} aria-invalid={nextDisabled || undefined}')) {
  throw new Error('WizardFooter validation policy could not be applied safely.');
}

if (changed) {
  fs.writeFileSync(path, source);
  console.log('Shared WizardFooter now stays clickable for validation errors; only busy state disables it.');
} else {
  console.log('Shared WizardFooter validation policy already applied.');
}
