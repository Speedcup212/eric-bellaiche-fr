const fs = require('fs');

const file = 'src/pages/portal/QuestionnairePageBase.tsx';
let src = fs.readFileSync(file, 'utf8');

const replacements = [
  [
    `            if (question.code === 'ESG_SCOPE' && selected?.code === 'AUTRE') {\n              return Boolean(answer.answer_text?.trim());\n            }\n`,
    '',
    'loaded ESG_SCOPE mandatory validation',
  ],
  [
    `      if (question.code === 'ESG_SCOPE' && selected?.code === 'AUTRE') return Boolean(answer.answer_text?.trim());\n`,
    '',
    'runtime ESG_SCOPE mandatory validation',
  ],
  [
    `{currentQuestion?.code === 'ESG_SCOPE' && currentQuestion.options?.find((option) => option.id === answers[currentQuestion.id]?.option_id)?.code === 'AUTRE' && <div className="mt-6 border-t border-slate-100 pt-6"><label className="block text-sm font-semibold text-slate-700">Précisez les placements concernés *<input value={answers[currentQuestion.id]?.answer_text ?? ''} onChange={(e) => updateLocal(currentQuestion, { answer_text: e.target.value })} onBlur={() => void persistCurrentQuestion().catch((error) => setErrorMessage(messageFromError(error)))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400 focus:bg-white" placeholder="Ex. assurance-vie et PER" /></label><p className="mt-2 text-xs leading-5 text-slate-500">Cette précision est nécessaire uniquement si vous choisissez « À certains placements seulement ».</p></div>}`,
    `{currentQuestion?.code === 'ESG_SCOPE' && currentQuestion.options?.find((option) => option.id === answers[currentQuestion.id]?.option_id)?.code === 'AUTRE' && <div className="mt-6 border-t border-slate-100 pt-6"><label className="block text-sm font-semibold text-slate-700">Si vous le souhaitez, précisez les placements concernés <span className="font-normal text-slate-400">— facultatif</span><input value={answers[currentQuestion.id]?.answer_text ?? ''} onChange={(e) => updateLocal(currentQuestion, { answer_text: e.target.value })} onBlur={() => void persistCurrentQuestion().catch((error) => setErrorMessage(messageFromError(error)))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400 focus:bg-white" placeholder="Ex. assurance-vie et PER" /></label><p className="mt-2 text-xs leading-5 text-slate-500">Tu peux laisser ce champ vide et préciser ce point plus tard avec ton conseiller.</p></div>}`,
    'ESG_SCOPE optional precision field',
  ],
];

for (const [oldText, newText, label] of replacements) {
  if (!src.includes(oldText)) throw new Error(`Patch target not found: ${label}`);
  src = src.replace(oldText, newText);
}

fs.writeFileSync(file, src);
console.log('ESG scope precision is now optional.');
