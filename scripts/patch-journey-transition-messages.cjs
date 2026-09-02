const fs = require('fs');

function replaceOrFail(path, before, after) {
  let source = fs.readFileSync(path, 'utf8');
  if (source.includes('data-premium-transition="true"')) {
    console.log(`${path} already contains premium transition UX.`);
    return;
  }
  if (!source.includes(before)) {
    console.error(`Expected block not found in ${path}; refusing to patch.`);
    process.exit(1);
  }
  source = source.replace(before, after);
  fs.writeFileSync(path, source);
}

const recueilPath = 'src/pages/portal/ClientRecueilJourneyPage.tsx';
const oldRecueil = `  if (!editing && progress.recueil_status === 'validated' && !progress.transmitted_at) {
    return <div className="recueil-safe">
      <JourneyProgress current="recueil" esgEnabled={progress.esg_opt_in !== false} />
      <PageIntro variant="recueil" eyebrow="Étape 1" title="Recueil d’informations" description="Votre recueil est validé. Vous pouvez encore corriger ou compléter vos informations tant que le dossier n’a pas été transmis définitivement au cabinet." icon={<CheckCircle2 className="h-5 w-5" />} />
      <WizardCard className="p-8">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Étape terminée</p>
          <p className="mt-2 text-xl font-bold">Votre recueil d’informations est terminé.</p>
          <p className="mt-2 text-sm leading-6 text-emerald-900">Vous avez renseigné votre situation personnelle, familiale, patrimoniale, financière et fiscale.</p>
        </div>
        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-6 text-blue-950">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">Étape suivante</p>
          <p className="mt-2 text-xl font-bold">Profil investisseur</p>
          <p className="mt-2 text-sm leading-6">Vous allez maintenant répondre à quelques questions sur votre horizon de placement, votre capacité de perte, vos connaissances, votre expérience et votre tolérance au risque.</p>
        </div>
        {errorMessage && <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={() => void edit()} className="inline-flex items-center gap-2 rounded-xl bg-[#3B82F6] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><Pencil className="h-4 w-4" /> {busy ? 'Ouverture…' : 'Modifier mon recueil'}</button>
          <button type="button" onClick={() => navigate(dossierHref('/espace-client/profil-investisseur', progress.dossier_id))} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">Commencer mon profil investisseur</button>
        </div>
      </WizardCard>
    </div>;
  }`;
const newRecueil = `  if (!editing && progress.recueil_status === 'validated' && !progress.transmitted_at) {
    return <div className="recueil-safe" data-premium-transition="true">
      <JourneyProgress current="recueil" esgEnabled={progress.esg_opt_in !== false} />
      <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[#061225]/70 p-4 backdrop-blur-md sm:p-6">
        <div role="dialog" aria-modal="true" aria-labelledby="recueil-complete-title" className="w-full max-w-[560px] overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_32px_100px_rgba(2,12,27,0.42)]">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#0B1F3A] via-[#12345D] to-[#1D4D7A] px-7 py-8 text-white sm:px-9 sm:py-9">
            <div className="absolute -right-14 -top-16 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-inner"><CheckCircle2 className="h-7 w-7" /></span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-100">Étape terminée</p>
                <h2 id="recueil-complete-title" className="mt-2 text-2xl font-bold tracking-tight sm:text-[28px]">Recueil d’informations terminé</h2>
                <p className="mt-2 text-sm leading-6 text-blue-50/90">Vos informations ont bien été enregistrées.</p>
              </div>
            </div>
          </div>
          <div className="px-7 py-7 sm:px-9 sm:py-8">
            <div className="rounded-2xl border border-[#DCE7F5] bg-[#F7FAFE] p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5F7FA7]">Étape suivante</p>
              <p className="mt-1.5 text-lg font-bold text-[#0B1F3A]">Votre profil investisseur</p>
              <p className="mt-1.5 text-sm leading-6 text-[#52677F]">Vous allez maintenant compléter votre profil investisseur.</p>
            </div>
            {errorMessage && <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>}
            <button type="button" onClick={() => navigate(dossierHref('/espace-client/profil-investisseur', progress.dossier_id))} className="mt-6 flex w-full items-center justify-center rounded-2xl bg-[#0B1F3A] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#0B1F3A]/20 transition hover:-translate-y-0.5 hover:bg-[#12345D]">Commencer mon profil investisseur <span className="ml-2 text-lg leading-none">→</span></button>
            <button type="button" disabled={busy} onClick={() => void edit()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-[#5E7188] transition hover:bg-slate-50 hover:text-[#0B1F3A] disabled:opacity-50"><Pencil className="h-4 w-4" /> {busy ? 'Ouverture…' : 'Modifier mon recueil'}</button>
          </div>
        </div>
      </div>
    </div>;
  }`;
replaceOrFail(recueilPath, oldRecueil, newRecueil);

const questionnairePath = 'src/pages/portal/QuestionnairePageBase.tsx';
let questionnaire = fs.readFileSync(questionnairePath, 'utf8');
if (!questionnaire.includes('data-premium-transition="true"')) {
  questionnaire = questionnaire.replace(
    `import { dossierHref, fetchPortalProgress, messageFromError, nextStepHref, selectedProgress, type PortalProgress } from '../../portal/portalHelpers';`,
    `import { dossierHref, fetchPortalProgress, messageFromError, selectedProgress, type PortalProgress } from '../../portal/portalHelpers';`
  );
  const oldDone = `  if (done) {
    const nextPath = nextStepHref(progress);
    const qpiNextIsEsg = mode === 'QPI' && progress.esg_opt_in === true;
    const completionDescription = mode === 'QPI'
      ? 'Votre profil investisseur est maintenant terminé.'
      : 'Votre questionnaire de durabilité est maintenant terminé.';
    const completionCta = mode === 'QPI'
      ? (qpiNextIsEsg ? 'Commencer mes préférences de durabilité' : 'Continuer vers les documents')
      : 'Continuer vers les documents';
    const nextTitle = mode === 'QPI'
      ? (qpiNextIsEsg ? 'Préférences de durabilité' : 'Documents')
      : 'Documents';
    const nextDescription = mode === 'QPI'
      ? (qpiNextIsEsg
        ? 'Vous allez maintenant indiquer si vous souhaitez que vos placements prennent en compte des critères environnementaux, sociaux et de gouvernance (ESG).'
        : 'Vous allez maintenant déposer les documents nécessaires à l’étude de votre dossier.')
      : 'Vous allez maintenant déposer les documents nécessaires à l’étude et à la préparation de votre dossier.';
    return <div><JourneyProgress current={mode === 'QPI' ? 'qpi' : 'esg'} esgEnabled={progress.esg_opt_in !== false} hideSubstepText={mode === 'QPI'} /><PageIntro compact eyebrow={mode === 'QPI' ? 'Étape 2' : 'Étape 3'} title={mode === 'QPI' ? 'Votre profil investisseur' : 'Préférences de durabilité'} description={completionDescription} icon={<CheckCircle2 className="h-5 w-5" />} /><WizardCard className="p-8"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950"><p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Étape terminée</p><p className="mt-2 text-xl font-bold">{mode === 'QPI' ? 'Votre profil investisseur est terminé.' : 'Vos préférences de durabilité sont terminées.'}</p><p className="mt-2 text-sm leading-6">{mode === 'QPI' ? 'Vos réponses ont permis d’évaluer votre horizon, votre capacité de perte, vos connaissances, votre expérience et votre tolérance au risque.' : 'Vos choix ESG ont été enregistrés et seront pris en compte lors de l’étude des solutions qui pourront vous être proposées.'}</p></div>{mode === 'QPI' && <div className="mt-5"><QpiResultSummary result={qpiResult} /></div>}<div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-6 text-blue-950"><p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">Étape suivante</p><p className="mt-2 text-xl font-bold">{nextTitle}</p><p className="mt-2 text-sm leading-6">{nextDescription}</p></div><button type="button" onClick={() => navigate(nextPath)} className="mt-6 rounded-xl bg-[#3B82F6] px-5 py-3 text-sm font-semibold text-white">{completionCta}</button></WizardCard></div>;
  }`;
  const newDone = `  if (done) {
    const qpiNextIsEsg = mode === 'QPI' && progress.esg_opt_in === true;
    const nextPath = mode === 'QPI' && qpiNextIsEsg
      ? dossierHref('/espace-client/esg', progress.dossier_id)
      : dossierHref('/espace-client/synthese', progress.dossier_id);
    const title = mode === 'QPI' ? 'Profil investisseur terminé' : 'Préférences de durabilité terminées';
    const nextTitle = mode === 'QPI' && qpiNextIsEsg ? 'Préférences de durabilité' : 'Synthèse du dossier';
    const nextDescription = mode === 'QPI'
      ? (qpiNextIsEsg
        ? 'Vous allez maintenant préciser vos préférences de durabilité.'
        : 'Vous allez maintenant accéder à la synthèse de votre dossier.')
      : 'Vous pouvez maintenant accéder à la synthèse de votre dossier.';
    const completionCta = mode === 'QPI' && qpiNextIsEsg ? 'Continuer' : 'Voir ma synthèse';
    return <div data-premium-transition="true">
      <JourneyProgress current={mode === 'QPI' ? 'qpi' : 'esg'} esgEnabled={progress.esg_opt_in !== false} hideSubstepText={mode === 'QPI'} />
      <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[#061225]/70 p-4 backdrop-blur-md sm:p-6">
        <div role="dialog" aria-modal="true" aria-labelledby="questionnaire-complete-title" className="w-full max-w-[560px] overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_32px_100px_rgba(2,12,27,0.42)]">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#0B1F3A] via-[#12345D] to-[#1D4D7A] px-7 py-8 text-white sm:px-9 sm:py-9">
            <div className="absolute -right-14 -top-16 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-inner"><CheckCircle2 className="h-7 w-7" /></span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-100">Étape terminée</p>
                <h2 id="questionnaire-complete-title" className="mt-2 text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-blue-50/90">Vos réponses ont bien été enregistrées.</p>
              </div>
            </div>
          </div>
          <div className="px-7 py-7 sm:px-9 sm:py-8">
            {mode === 'QPI' && qpiResult?.profil_operationnel_final && <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3"><span className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Profil retenu</span><span className="text-sm font-bold text-emerald-950">{qpiResult.profil_operationnel_final}</span></div>}
            {mode === 'QPI' && !qpiNextIsEsg && <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm leading-6 text-[#52677F]">Vous avez indiqué ne pas souhaiter intégrer de préférences particulières en matière de durabilité.</div>}
            <div className="rounded-2xl border border-[#DCE7F5] bg-[#F7FAFE] p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5F7FA7]">Étape suivante</p>
              <p className="mt-1.5 text-lg font-bold text-[#0B1F3A]">{nextTitle}</p>
              <p className="mt-1.5 text-sm leading-6 text-[#52677F]">{nextDescription}</p>
            </div>
            <button type="button" onClick={() => navigate(nextPath)} className="mt-6 flex w-full items-center justify-center rounded-2xl bg-[#0B1F3A] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#0B1F3A]/20 transition hover:-translate-y-0.5 hover:bg-[#12345D]">{completionCta}<span className="ml-2 text-lg leading-none">→</span></button>
          </div>
        </div>
      </div>
    </div>;
  }`;
  if (!questionnaire.includes(oldDone)) {
    console.error(`Expected completion block not found in ${questionnairePath}; refusing to patch.`);
    process.exit(1);
  }
  questionnaire = questionnaire.replace(oldDone, newDone);
  fs.writeFileSync(questionnairePath, questionnaire);
} else {
  console.log(`${questionnairePath} already contains premium transition UX.`);
}

console.log('Premium journey transition modals applied.');
