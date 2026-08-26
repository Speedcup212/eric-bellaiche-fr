const fs = require('fs');

const qpiPath = 'src/pages/portal/QuestionnairePageBase.tsx';
let qpi = fs.readFileSync(qpiPath, 'utf8');

qpi = qpi.replace(
  `<JourneyProgress current={mode === 'QPI' ? 'qpi' : 'esg'} esgEnabled={progress.esg_opt_in !== false} />\n    <PageIntro compact eyebrow={mode === 'QPI' ? 'Étape 2' : 'Étape 3'} title={introTitle} description={introDescription} icon={mode === 'QPI' ? <BrainCircuit className=\"h-5 w-5\" /> : <Leaf className=\"h-5 w-5\" />} />`,
  `<JourneyProgress current={mode === 'QPI' ? 'qpi' : 'esg'} esgEnabled={progress.esg_opt_in !== false} substepDisplayLabel={mode === 'QPI' ? 'Profil investisseur' : undefined} />\n    {mode === 'ESG' && <PageIntro compact eyebrow=\"Étape 3\" title={introTitle} description={introDescription} icon={<Leaf className=\"h-5 w-5\" />} />}`
);

if (!qpi.includes(`substepDisplayLabel={mode === 'QPI' ? 'Profil investisseur' : undefined}`)) {
  throw new Error('QPI compact header replacement failed');
}
fs.writeFileSync(qpiPath, qpi);

const journeyPath = 'src/portal/FintechJourney.tsx';
let journey = fs.readFileSync(journeyPath, 'utf8');
journey = journey.replace(
  `export function JourneyProgress({ current, esgEnabled = true, substep, sticky = true }: { current: JourneyStage; esgEnabled?: boolean; substep?: JourneySubstep; sticky?: boolean }) {`,
  `export function JourneyProgress({ current, esgEnabled = true, substep, sticky = true, substepDisplayLabel }: { current: JourneyStage; esgEnabled?: boolean; substep?: JourneySubstep; sticky?: boolean; substepDisplayLabel?: string }) {`
);
journey = journey.replace(
  `{effectiveSubstep ? (\n            <p className=\"mt-1 truncate text-sm font-semibold text-[#0b1f3a]\">Partie {effectiveSubstep.current} sur {effectiveSubstep.total}{effectiveSubstep.label ? \` · \${effectiveSubstep.label}\` : ''}</p>\n          ) : (`,
  `{substepDisplayLabel ? (\n            <p className=\"mt-1 truncate text-sm font-semibold text-[#0b1f3a]\">{substepDisplayLabel}</p>\n          ) : effectiveSubstep ? (\n            <p className=\"mt-1 truncate text-sm font-semibold text-[#0b1f3a]\">Partie {effectiveSubstep.current} sur {effectiveSubstep.total}{effectiveSubstep.label ? \` · \${effectiveSubstep.label}\` : ''}</p>\n          ) : (`
);

if (!journey.includes('substepDisplayLabel?: string') || !journey.includes('{substepDisplayLabel}</p>')) {
  throw new Error('JourneyProgress compact label replacement failed');
}
fs.writeFileSync(journeyPath, journey);
