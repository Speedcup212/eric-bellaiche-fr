const fs = require('fs');
const p = 'src/pages/portal/QuestionnairePageBase.tsx';
let s = fs.readFileSync(p, 'utf8');

const anchor1 = "  const totalSteps = visibleQuestions.length + extraQpiSteps;\n";
if (!s.includes(anchor1)) throw new Error('totalSteps anchor not found');

const insertion = `  const qpiSections = [\n    { key: 'horizon', label: 'Horizon & liquidité' },\n    { key: 'capacity', label: 'Capacité de perte' },\n    { key: 'knowledge', label: 'Connaissances' },\n    { key: 'tolerance', label: 'Tolérance au risque' },\n    { key: 'experience', label: 'Expérience' },\n  ] as const;\n  const currentQpiSectionKey = useMemo(() => {\n    if (mode !== 'QPI') return null;\n    if (currentIndex >= visibleQuestions.length) return 'experience';\n    const code = visibleQuestions[currentIndex]?.code ?? '';\n    if (['Q3', 'Q4'].includes(code)) return 'horizon';\n    if (['Q9', 'Q10'].includes(code)) return 'capacity';\n    if (['Q13', 'Q14', 'Q15', 'Q16', 'Q17'].includes(code)) return 'knowledge';\n    if (['Q21', 'Q22', 'Q23', 'Q24', 'Q25'].includes(code)) return 'tolerance';\n    return 'horizon';\n  }, [mode, currentIndex, visibleQuestions]);\n  const currentQpiSectionIndex = qpiSections.findIndex((section) => section.key === currentQpiSectionKey);\n`;

s = s.replace(anchor1, anchor1 + insertion);

const anchor2 = "    <WizardCard>\n      <QuestionHeader current={currentIndex + 1} total={totalSteps} label={cardLabel} title={cardTitle} description={cardDescription} />";
if (!s.includes(anchor2)) throw new Error('WizardCard anchor not found');

const replacement2 = `    <WizardCard>\n      {mode === 'QPI' && <div className=\"border-b border-slate-100 bg-white px-6 pt-5 sm:px-9\">\n        <div className=\"mb-3 flex items-center justify-between gap-3\">\n          <p className=\"text-xs font-semibold uppercase tracking-[0.12em] text-slate-500\">Profil investisseur</p>\n          <p className=\"text-xs font-semibold text-slate-700\">Partie {Math.max(currentQpiSectionIndex + 1, 1)} sur 5 — {qpiSections[Math.max(currentQpiSectionIndex, 0)]?.label}</p>\n        </div>\n        <div className=\"grid grid-cols-2 gap-2 pb-5 sm:grid-cols-5\">\n          {qpiSections.map((section, index) => {\n            const active = section.key === currentQpiSectionKey;\n            const completed = currentQpiSectionIndex > index;\n            return <div key={section.key} className={\`rounded-xl border px-3 py-2.5 text-center text-xs font-semibold transition \${active ? 'border-[#3B82F6] bg-blue-50 text-blue-700 shadow-sm' : completed ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}\`}>\n              <span className=\"mr-1\">{completed ? '✓' : index + 1}.</span>{section.label}\n            </div>;\n          })}\n        </div>\n      </div>}\n      <QuestionHeader current={currentIndex + 1} total={totalSteps} label={cardLabel} title={cardTitle} description={cardDescription} />`;

s = s.replace(anchor2, replacement2);
fs.writeFileSync(p, s);
console.log('QPI section progress indicator added.');
