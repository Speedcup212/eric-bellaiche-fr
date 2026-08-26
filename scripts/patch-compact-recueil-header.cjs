const fs = require('fs');
const p = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let s = fs.readFileSync(p, 'utf8');
const old = '  return <div>\n    <JourneyProgress current="recueil" esgEnabled={forms.regulatory.esg_opt_in !== false} substep={{ current: step + 1, total: sections.length, label: current.title }} sticky={false} />\n    <PageIntro variant="recueil" eyebrow={`Étape 1 · Partie ${step + 1}/${sections.length}`} title={current.title} description={current.description} />\n    <WizardCard>';
const next = '  return <div>\n    <JourneyProgress current="recueil" esgEnabled={forms.regulatory.esg_opt_in !== false} sticky={false} />\n    <WizardCard>';
if (!s.includes(old)) throw new Error('Recueil header target not found');
s = s.replace(old, next);
fs.writeFileSync(p, s);
