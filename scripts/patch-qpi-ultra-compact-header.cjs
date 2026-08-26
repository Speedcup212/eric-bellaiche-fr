const fs = require('fs');
const p = 'src/pages/portal/QuestionnairePageBase.tsx';
let s = fs.readFileSync(p, 'utf8');

s = s.replace(
  "import { BrainCircuit, CheckCircle2, Leaf, Pencil } from 'lucide-react';",
  "import { CheckCircle2, Leaf, Pencil } from 'lucide-react';"
);

const old = `    <PageIntro compact eyebrow={mode === 'QPI' ? 'Étape 2' : 'Étape 3'} title={introTitle} description={introDescription} icon={mode === 'QPI' ? <BrainCircuit className=\"h-5 w-5\" /> : <Leaf className=\"h-5 w-5\" />} />`;
const next = `    {mode === 'ESG' && <PageIntro compact eyebrow=\"Étape 3\" title={introTitle} description={introDescription} icon={<Leaf className=\"h-5 w-5\" />} />}`;
if (!s.includes(old)) throw new Error('QPI PageIntro target not found');
s = s.replace(old, next);

fs.writeFileSync(p, s);
