const fs = require('fs');

function replaceOrFail(path, before, after) {
  let source = fs.readFileSync(path, 'utf8');
  if (!source.includes(before)) {
    console.error(`Expected block not found in ${path}; refusing to patch.`);
    process.exit(1);
  }
  source = source.replace(before, after);
  fs.writeFileSync(path, source);
}

replaceOrFail(
  'src/pages/portal/ClientRecueilJourneyPage.tsx',
  `<div className="rounded-2xl bg-emerald-50 p-5 text-emerald-800">\n          <p className="font-semibold">Recueil validé</p>\n          <p className="mt-1 text-sm leading-6">Toute modification sera enregistrée et vous devrez valider de nouveau le recueil avant de poursuivre.</p>\n        </div>`,
  `<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950">\n          <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Étape terminée</p>\n          <p className="mt-2 text-xl font-bold">Votre recueil d’informations est terminé.</p>\n          <p className="mt-2 text-sm leading-6 text-emerald-900">Vous avez renseigné votre situation personnelle, familiale, patrimoniale, financière et fiscale.</p>\n        </div>\n        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-6 text-blue-950">\n          <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">Étape suivante</p>\n          <p className="mt-2 text-xl font-bold">Profil investisseur</p>\n          <p className="mt-2 text-sm leading-6">Vous allez maintenant répondre à quelques questions sur votre horizon de placement, votre capacité de perte, vos connaissances, votre expérience et votre tolérance au risque.</p>\n        </div>`
);

replaceOrFail(
  'src/pages/portal/ClientRecueilJourneyPage.tsx',
  `>Continuer</button>`,
  `>Commencer mon profil investisseur</button>`
);

const questionnairePath = 'src/pages/portal/QuestionnairePageBase.tsx';
let questionnaire = fs.readFileSync(questionnairePath, 'utf8');
const oldBlock = `    const completionDescription = mode === 'QPI'\n      ? qpiNextIsEsg\n        ? 'Votre questionnaire est terminé. Vérifiez le résultat retenu avant de poursuivre vers vos préférences de durabilité.'\n        : 'Votre questionnaire est terminé. Vérifiez le résultat retenu avant de poursuivre vers les documents.'\n      : 'Cette étape a été validée.';\n    const completionCta = qpiNextIsEsg ? 'Continuer vers la durabilité' : 'Continuer vers les documents';\n    return <div><JourneyProgress current={mode === 'QPI' ? 'qpi' : 'esg'} esgEnabled={progress.esg_opt_in !== false} hideSubstepText={mode === 'QPI'} /><PageIntro compact eyebrow={mode === 'QPI' ? 'Étape 2' : 'Étape 3'} title={mode === 'QPI' ? 'Votre profil investisseur' : 'Préférences de durabilité'} description={completionDescription} icon={<CheckCircle2 className="h-5 w-5" />} /><WizardCard className="p-8">{mode === 'QPI' ? <QpiResultSummary result={qpiResult} /> : <div className="rounded-2xl bg-emerald-50 p-5 text-emerald-800"><p className="font-semibold">Étape terminée</p><p className="mt-1 text-sm leading-6">Vous pouvez poursuivre votre parcours.</p></div>}<button type="button" onClick={() => navigate(nextPath)} className="mt-6 rounded-xl bg-[#3B82F6] px-5 py-3 text-sm font-semibold text-white">{completionCta}</button></WizardCard></div>;`;
const newBlock = `    const completionDescription = mode === 'QPI'\n      ? 'Votre profil investisseur est maintenant terminé.'\n      : 'Votre questionnaire de durabilité est maintenant terminé.';\n    const completionCta = mode === 'QPI'\n      ? (qpiNextIsEsg ? 'Commencer mes préférences de durabilité' : 'Continuer vers les documents')\n      : 'Continuer vers les documents';\n    const nextTitle = mode === 'QPI'\n      ? (qpiNextIsEsg ? 'Préférences de durabilité' : 'Documents')\n      : 'Documents';\n    const nextDescription = mode === 'QPI'\n      ? (qpiNextIsEsg\n        ? 'Vous allez maintenant indiquer si vous souhaitez que vos placements prennent en compte des critères environnementaux, sociaux et de gouvernance (ESG).'\n        : 'Vous allez maintenant déposer les documents nécessaires à l’étude de votre dossier.')\n      : 'Vous allez maintenant déposer les documents nécessaires à l’étude et à la préparation de votre dossier.';\n    return <div><JourneyProgress current={mode === 'QPI' ? 'qpi' : 'esg'} esgEnabled={progress.esg_opt_in !== false} hideSubstepText={mode === 'QPI'} /><PageIntro compact eyebrow={mode === 'QPI' ? 'Étape 2' : 'Étape 3'} title={mode === 'QPI' ? 'Votre profil investisseur' : 'Préférences de durabilité'} description={completionDescription} icon={<CheckCircle2 className="h-5 w-5" />} /><WizardCard className="p-8"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950"><p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Étape terminée</p><p className="mt-2 text-xl font-bold">{mode === 'QPI' ? 'Votre profil investisseur est terminé.' : 'Vos préférences de durabilité sont terminées.'}</p><p className="mt-2 text-sm leading-6">{mode === 'QPI' ? 'Vos réponses ont permis d’évaluer votre horizon, votre capacité de perte, vos connaissances, votre expérience et votre tolérance au risque.' : 'Vos choix ESG ont été enregistrés et seront pris en compte lors de l’étude des solutions qui pourront vous être proposées.'}</p></div>{mode === 'QPI' && <div className="mt-5"><QpiResultSummary result={qpiResult} /></div>}<div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-6 text-blue-950"><p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">Étape suivante</p><p className="mt-2 text-xl font-bold">{nextTitle}</p><p className="mt-2 text-sm leading-6">{nextDescription}</p></div><button type="button" onClick={() => navigate(nextPath)} className="mt-6 rounded-xl bg-[#3B82F6] px-5 py-3 text-sm font-semibold text-white">{completionCta}</button></WizardCard></div>;`;
if (!questionnaire.includes(oldBlock)) {
  console.error(`Expected completion block not found in ${questionnairePath}; refusing to patch.`);
  process.exit(1);
}
questionnaire = questionnaire.replace(oldBlock, newBlock);
fs.writeFileSync(questionnairePath, questionnaire);

console.log('Journey transition messages added.');
