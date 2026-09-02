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

// Allow the final experience answer to be passed directly into completion so React state
// cannot overwrite the just-selected value with a stale closure.
const oldFinish = `  const finish = async () => {\n    if (!sessionId || !progress) return;\n    if (mode === 'QPI') await saveExperienceDetails();`;
const newFinish = `  const finish = async (experienceState?: ExpState) => {\n    if (!sessionId || !progress) return;\n    if (mode === 'QPI') await saveExperienceDetails(experienceState ?? expDetails);`;
if (source.includes(oldFinish)) {
  source = source.replace(oldFinish, newFinish);
  changed = true;
}

// General experience: “Non” needs no follow-up detail, so save and advance immediately.
const oldKnowledgeNo = `<ChoiceButton selected={expDetails.connaissance === 'false'} onClick={() => { const nextState = { ...expDetails, connaissance: 'false' as const, sources: [], precision: '' }; setExpDetails(nextState); void saveExperienceDetails(nextState); }}>Non</ChoiceButton>`;
const newKnowledgeNo = `<ChoiceButton selected={expDetails.connaissance === 'false'} onClick={() => { const nextState = { ...expDetails, connaissance: 'false' as const, sources: [], precision: '' }; setExpDetails(nextState); void saveExperienceDetails(nextState).then(() => { setCurrentIndex((index) => Math.min(index + 1, totalSteps - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }).catch((error) => setErrorMessage(messageFromError(error))); }}>Non</ChoiceButton>`;
if (source.includes(oldKnowledgeNo)) {
  source = source.replace(oldKnowledgeNo, newKnowledgeNo);
  changed = true;
}

// Experience screens 17/19 and 18/19 are true single-choice screens: save then advance.
const oldSeniority = `{detailStep === 1 && <div className="grid gap-3">{seniorityOptions.map(([value, label]) => <ChoiceButton key={value} selected={expDetails.anciennete === value} onClick={() => { const nextState = { ...expDetails, anciennete: value }; setExpDetails(nextState); void saveExperienceDetails(nextState); }}>{label}</ChoiceButton>)}</div>}`;
const newSeniority = `{detailStep === 1 && <div className="grid gap-3">{seniorityOptions.map(([value, label]) => <ChoiceButton key={value} selected={expDetails.anciennete === value} onClick={() => { const nextState = { ...expDetails, anciennete: value }; setExpDetails(nextState); void saveExperienceDetails(nextState).then(() => { setCurrentIndex((index) => Math.min(index + 1, totalSteps - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }).catch((error) => setErrorMessage(messageFromError(error))); }}>{label}</ChoiceButton>)}</div>}`;
if (source.includes(oldSeniority)) {
  source = source.replace(oldSeniority, newSeniority);
  changed = true;
}

const oldAmount = `{detailStep === 2 && <div className="grid gap-3">{amountOptions.map(([value, label]) => <ChoiceButton key={value} selected={expDetails.montant === value} onClick={() => { const nextState = { ...expDetails, montant: value }; setExpDetails(nextState); void saveExperienceDetails(nextState); }}>{label}</ChoiceButton>)}</div>}`;
const newAmount = `{detailStep === 2 && <div className="grid gap-3">{amountOptions.map(([value, label]) => <ChoiceButton key={value} selected={expDetails.montant === value} onClick={() => { const nextState = { ...expDetails, montant: value }; setExpDetails(nextState); void saveExperienceDetails(nextState).then(() => { setCurrentIndex((index) => Math.min(index + 1, totalSteps - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }).catch((error) => setErrorMessage(messageFromError(error))); }}>{label}</ChoiceButton>)}</div>}`;
if (source.includes(oldAmount)) {
  source = source.replace(oldAmount, newAmount);
  changed = true;
}

// Screen 19/19 saves the selected management mode and completes the questionnaire directly.
const oldManagement = `{detailStep === 3 && <div className="grid gap-3">{managementOptions.map(([value, label]) => <ChoiceButton key={value} selected={expDetails.mode === value} onClick={() => { const nextState = { ...expDetails, mode: value }; setExpDetails(nextState); void saveExperienceDetails(nextState); }}>{label}</ChoiceButton>)}</div>}`;
const newManagement = `{detailStep === 3 && <div className="grid gap-3">{managementOptions.map(([value, label]) => <ChoiceButton key={value} selected={expDetails.mode === value} onClick={() => { const nextState = { ...expDetails, mode: value }; setExpDetails(nextState); void finish(nextState).catch((error) => setErrorMessage(messageFromError(error))); }}>{label}</ChoiceButton>)}</div>}`;
if (source.includes(oldManagement)) {
  source = source.replace(oldManagement, newManagement);
  changed = true;
}

// Remove the generic “Suivant/Continuer” CTA from true single-choice screens.
// Multiple-choice screens and “Oui + origine des connaissances” retain explicit validation.
const oldFooter = `      {currentQuestion?.type_reponse === 'single' ? (\n        <div className="flex items-center border-t border-[#e7edf5] bg-[#f7f9fc] px-6 py-5 sm:px-9">\n          <button type="button" onClick={previous} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#5b6b82] transition hover:bg-white hover:text-[#0b1f3a]">← Précédent</button>\n        </div>\n      ) : (\n        <WizardFooter onPrevious={previous} onNext={() => void next()} nextLabel={currentQuestion?.type_reponse === 'multiple' ? 'Valider mes choix' : currentIndex === totalSteps - 1 ? 'Valider le questionnaire' : 'Continuer'} nextDisabled={!currentComplete} busy={busy} />\n      )}`;
const newFooter = `      {currentQuestion?.type_reponse === 'single' || detailStep === 1 || detailStep === 2 || detailStep === 3 || (detailStep === 0 && expDetails.connaissance === 'false') ? (\n        <div className="flex items-center border-t border-[#e7edf5] bg-[#f7f9fc] px-6 py-5 sm:px-9">\n          <button type="button" onClick={previous} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#5b6b82] transition hover:bg-white hover:text-[#0b1f3a]">← Précédent</button>\n        </div>\n      ) : (\n        <WizardFooter onPrevious={previous} onNext={() => void next()} nextLabel={currentQuestion?.type_reponse === 'multiple' ? 'Valider mes choix' : currentIndex === totalSteps - 1 ? 'Valider le questionnaire' : 'Continuer'} nextDisabled={!currentComplete} busy={busy} />\n      )}`;
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
console.log('QPI/ESG auto-advance aligned, including general experience screens.');
