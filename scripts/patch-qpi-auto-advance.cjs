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

// Reset the wizard index as soon as the questionnaire mode/dossier changes.
const effectStart = `  useEffect(() => {\n    void fetchPortalProgress().then(async (rows) => {`;
const effectStartFixed = `  useEffect(() => {\n    // QPI and ESG share this component. Reset navigation immediately so a QPI\n    // position can never leak into the ESG questionnaire during route changes.\n    setCurrentIndex(0);\n    setValidationAttempted(false);\n    setErrorMessage('');\n    setNoteOpen(false);\n    void fetchPortalProgress().then(async (rows) => {`;
if (source.includes(effectStart) && !source.includes('position can never leak into the ESG questionnaire')) {
  source = source.replace(effectStart, effectStartFixed);
  changed = true;
}

// On ESG load/resume, open the first visible unanswered mandatory question.
const loadAnchor = `      setAnswers(answerMap);\n      setMulti(multiMap);\n      if (mode === 'QPI') {`;
const loadFixed = `      setAnswers(answerMap);\n      setMulti(multiMap);\n\n      if (mode === 'ESG') {\n        const loadedSelectedCodes = {};\n        for (const question of normalized) {\n          const selected = question.options?.find((option) => option.id === answerMap[question.id]?.option_id);\n          if (selected) loadedSelectedCodes[question.code] = selected.code;\n        }\n        const loadedVisibleQuestions = normalized.filter((question) => visible(question, loadedSelectedCodes));\n        const loadedQuestionComplete = (question) => {\n          const answer = answerMap[question.id];\n          if (question.type_reponse === 'single') {\n            if (!answer?.option_id) return false;\n            const selected = question.options?.find((option) => option.id === answer.option_id);\n            if ((question.code === 'ESG_TAX_MIN' || question.code === 'ESG_SFDR_MIN') && selected?.code === 'AUTRE') {\n              return answer.answer_numeric !== null && answer.answer_numeric !== undefined && answer.answer_numeric >= 0 && answer.answer_numeric <= 100;\n            }\n            return true;\n          }\n          if (question.type_reponse === 'multiple') {\n            const values = multiMap[question.id] ?? [];\n            if (question.code === 'ESG_EXCLUSIONS' && values.includes('AUTRE') && !answer?.answer_text?.trim()) return false;\n            if (question.obligatoire || question.code === 'ESG_PAI_PRIORITIES' || question.code === 'ESG_PAI_MODALITIES') return values.length > 0;\n            return true;\n          }\n          if (question.type_reponse === 'text') return !question.obligatoire || Boolean(answer?.answer_text?.trim());\n          return true;\n        };\n        const firstIncompleteIndex = loadedVisibleQuestions.findIndex((question) => !loadedQuestionComplete(question));\n        setCurrentIndex(firstIncompleteIndex >= 0 ? firstIncompleteIndex : 0);\n      }\n\n      if (mode === 'QPI') {`;
if (source.includes(loadAnchor) && !source.includes('const loadedVisibleQuestions = normalized.filter')) {
  source = source.replace(loadAnchor, loadFixed);
  changed = true;
}

if (!changed) {
  console.log('Questionnaire navigation corrections already applied.');
  process.exit(0);
}

fs.writeFileSync(path, source);
console.log('QPI auto-advance kept and ESG entry/resume navigation corrected.');
