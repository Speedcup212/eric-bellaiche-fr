const fs = require('fs');
const path = 'src/pages/portal/ClientDocumentsPage.tsx';
let source = fs.readFileSync(path, 'utf8');
let changed = false;

function replaceOnce(before, after, label) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`Patch target not found: ${label}`);
  source = source.replace(before, after);
  changed = true;
}

replaceOnce(
  "  const [contextBusy, setContextBusy] = useState(false);\n  const [finishBusy, setFinishBusy] = useState(false);",
  "  const [contextBusy, setContextBusy] = useState(false);\n  const [contextValidationAttempted, setContextValidationAttempted] = useState(false);\n  const [finishBusy, setFinishBusy] = useState(false);",
  'validation state',
);

replaceOnce(
  "  const boolChoice = (label: string, key: keyof Pick<DocumentContext, 'has_liquidities' | 'has_financial_assets' | 'has_real_estate' | 'has_credits' | 'has_sci_company'>, value: boolean | null | undefined) => (\n    <div className=\"document-question-card rounded-2xl border border-slate-200 bg-white p-4\">",
  "  const boolChoice = (label: string, key: keyof Pick<DocumentContext, 'has_liquidities' | 'has_financial_assets' | 'has_real_estate' | 'has_credits' | 'has_sci_company'>, value: boolean | null | undefined) => {\n    const missing = contextValidationAttempted && value == null;\n    return (\n    <div className={`document-question-card rounded-2xl border p-4 transition ${missing ? 'border-2 border-red-400 bg-red-50/70 ring-2 ring-red-100' : 'border-slate-200 bg-white'}`}>",
  'bool choice red state',
);

replaceOnce(
  "      </div>\n    </div>\n  );\n\n  return (",
  "      </div>\n      {missing && <p className=\"mt-2 text-xs font-semibold text-red-700\">Réponse obligatoire.</p>}\n    </div>\n    );\n  };\n\n  return (",
  'bool choice close',
);

replaceOnce(
  "          <div className=\"document-question-card mt-6 rounded-2xl border border-slate-200 bg-white p-5\">\n            <p className=\"text-sm font-semibold text-slate-900\">Quelle est votre situation concernant l’avis d’imposition ? *</p>",
  "          <div className={`document-question-card mt-6 rounded-2xl border p-5 transition ${contextValidationAttempted && currentContext?.tax_status == null ? 'border-2 border-red-400 bg-red-50/70 ring-2 ring-red-100' : 'border-slate-200 bg-white'}`}>\n            <p className=\"text-sm font-semibold text-slate-900\">Quelle est votre situation concernant l’avis d’imposition ? *</p>\n            {contextValidationAttempted && currentContext?.tax_status == null && <p className=\"mt-1 text-xs font-semibold text-red-700\">Réponse obligatoire.</p>}",
  'tax status red state',
);

replaceOnce(
  "            {currentContext?.tax_status === 'no_personal_notice' && <div className=\"mt-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-4\">",
  "            {currentContext?.tax_status === 'no_personal_notice' && <div className={`mt-4 rounded-2xl border p-4 ${contextValidationAttempted && !currentContext.tax_absence_reason ? 'border-2 border-red-400 bg-red-50/70 ring-2 ring-red-100' : 'border-blue-200 bg-blue-50/60'}`}>",
  'tax absence red state',
);

replaceOnce(
  "              <p className=\"text-sm font-semibold text-slate-900\">Pour quelle raison ne disposez-vous pas encore d’un avis d’imposition ? *</p>",
  "              <p className=\"text-sm font-semibold text-slate-900\">Pour quelle raison ne disposez-vous pas encore d’un avis d’imposition ? *</p>\n              {contextValidationAttempted && !currentContext.tax_absence_reason && <p className=\"mt-1 text-xs font-semibold text-red-700\">Réponse obligatoire.</p>}",
  'tax absence message',
);

replaceOnce(
  "        {!transmitted && activeDocumentView === 'situation' && <div>\n          {!currentContextComplete && <div className=\"border-t border-amber-200 bg-amber-50 px-6 py-4 text-sm leading-6 text-amber-900 sm:px-9\">Répondez aux questions obligatoires pour obtenir la liste exacte de vos justificatifs.</div>}\n          <WizardFooter onPrevious={() => navigate(dossierHref(previousPath, progress.dossier_id))} onNext={() => setDocumentView('uploads')} previousLabel=\"Précédent\" nextLabel=\"Voir mes justificatifs\" nextDisabled={!currentContextComplete} busy={contextBusy} />\n        </div>}",
  "        {!transmitted && activeDocumentView === 'situation' && <div>\n          {contextValidationAttempted && !currentContextComplete && <div className=\"border-t border-red-200 bg-red-50 px-6 py-4 text-sm font-semibold leading-6 text-red-800 sm:px-9\">Certaines réponses obligatoires sont manquantes. Elles sont signalées en rouge ci-dessus.</div>}\n          {!contextValidationAttempted && !currentContextComplete && <div className=\"border-t border-amber-200 bg-amber-50 px-6 py-4 text-sm leading-6 text-amber-900 sm:px-9\">Répondez aux questions obligatoires pour obtenir la liste exacte de vos justificatifs.</div>}\n          <WizardFooter onPrevious={() => navigate(dossierHref(previousPath, progress.dossier_id))} onNext={() => {\n            if (!currentContextComplete) {\n              setContextValidationAttempted(true);\n              setErrorMessage('');\n              window.setTimeout(() => document.querySelector('.document-question-card.border-red-400')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);\n              return;\n            }\n            setContextValidationAttempted(false);\n            setDocumentView('uploads');\n          }} previousLabel=\"Précédent\" nextLabel=\"Voir mes justificatifs\" nextDisabled={false} busy={contextBusy} />\n        </div>}",
  'footer validation',
);

if (!changed) {
  console.log('Document validation feedback already applied.');
  process.exit(0);
}
fs.writeFileSync(path, source);
console.log('Document validation feedback applied.');
