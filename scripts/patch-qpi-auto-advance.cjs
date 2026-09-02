const fs = require('fs');

const path = 'src/pages/portal/QuestionnairePageBase.tsx';
let source = fs.readFileSync(path, 'utf8');
let changed = false;

// Keep the existing QPI automatic-advance correction idempotent.
const beforeAutoAdvance = `    const needsDetails = ['Q4', 'Q5', 'Q10'].includes(question.code)\n      || (['ESG_SCOPE', 'ESG_TAX_MIN', 'ESG_SFDR_MIN'].includes(question.code) && option.code === 'AUTRE');`;
const afterAutoAdvance = `    // In the investor profile, every single-choice answer advances immediately.\n    // Optional QPI precision fields must never force the client to click “Suivant”.\n    // ESG keeps its explicit-detail exceptions when “Autre” requires a follow-up field.\n    const needsDetails = mode === 'ESG'\n      && ['ESG_SCOPE', 'ESG_TAX_MIN', 'ESG_SFDR_MIN'].includes(question.code)\n      && option.code === 'AUTRE';`;

if (source.includes(beforeAutoAdvance)) {
  source = source.replace(beforeAutoAdvance, afterAutoAdvance);
  changed = true;
}

// Finish automatically when the final single-choice question is answered.
const oldSingleTail = `    if (!needsDetails && currentIndex < totalSteps - 1) {\n      window.setTimeout(() => {\n        setCurrentIndex((index) => Math.min(index + 1, totalSteps - 1));\n        setNoteOpen(false);\n        window.scrollTo({ top: 0, behavior: 'smooth' });\n      }, 160);\n    }`;
const newSingleTail = `    if (!needsDetails && currentIndex < totalSteps - 1) {\n      window.setTimeout(() => {\n        setCurrentIndex((index) => Math.min(index + 1, totalSteps - 1));\n        setNoteOpen(false);\n        window.scrollTo({ top: 0, behavior: 'smooth' });\n      }, 160);\n    } else if (!needsDetails && currentIndex === totalSteps - 1) {\n      await finish();\n    }`;
if (source.includes(oldSingleTail) && !source.includes("await finish();\n    }\n  };\n\n  if (!progress)")) {
  source = source.replace(oldSingleTail, newSingleTail);
  changed = true;
}

// Remove the generic “Suivant” CTA from single-choice questions.
// Multiple-choice ESG questions keep an explicit validation because several answers can be selected.
const oldFooter = `      <WizardFooter onPrevious={previous} onNext={() => void next()} nextLabel={currentIndex === totalSteps - 1 ? 'Valider le questionnaire' : 'Suivant'} nextDisabled={!currentComplete} busy={busy} />`;
const newFooter = `      {currentQuestion?.type_reponse === 'single' ? (\n        <div className=\"flex items-center border-t border-[#e7edf5] bg-[#f7f9fc] px-6 py-5 sm:px-9\">\n          <button type=\"button\" onClick={previous} className=\"inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#5b6b82] transition hover:bg-white hover:text-[#0b1f3a]\">← Précédent</button>\n        </div>\n      ) : (\n        <WizardFooter onPrevious={previous} onNext={() => void next()} nextLabel={currentQuestion?.type_reponse === 'multiple' ? 'Valider mes choix' : currentIndex === totalSteps - 1 ? 'Valider le questionnaire' : 'Continuer'} nextDisabled={!currentComplete} busy={busy} />\n      )}`;
if (source.includes(oldFooter)) {
  source = source.replace(oldFooter, newFooter);
  changed = true;
}

// Reset the wizard index as soon as the questionnaire mode/dossier changes.
const effectStart = `  useEffect(() => {\n    void fetchPortalProgress().then(async (rows) => {`;
const effectStartFixed = `  useEffect(() => {\n    // QPI and ESG share this component. Reset navigation immediately so a QPI\n    // position can never leak into the ESG questionnaire during route changes.\n    setCurrentIndex(0);\n    setValidationAttempted(false);\n    setErrorMessage('');\n    setNoteOpen(false);\n    void fetchPortalProgress().then(async (rows) => {`;
if (source.includes(effectStart) && !source.includes('position can never leak into the ESG questionnaire')) {
  source = source.replace(effectStart, effectStartFixed);
  changed = true;
}

if (!changed) {
  console.log('Questionnaire navigation corrections already applied.');
  process.exit(0);
}

fs.writeFileSync(path, source);
console.log('QPI/ESG automatic advance applied and generic next button removed for single-choice questions.');
