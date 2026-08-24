const fs = require('fs');

function patchFamilyEntry() {
  const path = 'src/pages/portal/ClientRecueilJourneyPage.tsx';
  let s = fs.readFileSync(path, 'utf8');

  const regimes = "const regimes = ['Communauté réduite aux acquêts', 'Communauté universelle', 'Séparation de biens', 'Participation aux acquêts', 'PACS - séparation des patrimoines', 'PACS - indivision', 'Sans convention / non applicable'];\n";
  const validators = `${regimes}\nfunction isValidEmail(value: string): boolean {\n  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value.trim());\n}\n\nfunction isValidMobile(value: string): boolean {\n  const compact = value.trim().replace(/[\\s().-]/g, '');\n  if (!compact) return true;\n  if (/^0[67]\\d{8}$/.test(compact)) return true;\n  if (/^\\+33[67]\\d{8}$/.test(compact)) return true;\n  return /^\\+[1-9]\\d{7,14}$/.test(compact);\n}\n`;
  if (!s.includes('function isValidEmail(value: string)')) {
    if (!s.includes(regimes)) throw new Error('Family regimes marker not found');
    s = s.replace(regimes, validators);
  }

  const saveMarker = '  const saveFamilySetup = async () => {\n';
  if (!s.includes("family-validation-alert'))")) {
    const effect = `  useEffect(() => {\n    if (!errorMessage) return;\n    const timer = window.setTimeout(() => {\n      const alert = document.getElementById('family-validation-alert');\n      alert?.scrollIntoView({ behavior: 'smooth', block: 'center' });\n      alert?.focus({ preventScroll: true });\n    }, 50);\n    return () => window.clearTimeout(timer);\n  }, [errorMessage]);\n\n${saveMarker}`;
    if (!s.includes(saveMarker)) throw new Error('saveFamilySetup marker not found');
    s = s.replace(saveMarker, effect);
  }

  const oldValidation = `      if (!family.dossier_scope) throw new Error('Indiquez si ce dossier concerne une personne ou un couple.');\n      if (!family.situation || family.nombre_enfants === '') throw new Error('Indiquez votre situation familiale et le nombre d’enfants.');\n      if (legalDetailsRequired && (!family.date_evenement || !family.regime_convention)) throw new Error('Pour une situation mariée ou pacsée, indiquez la date et le régime / la convention.');\n      if (isCouple && (!family.conjoint_civilite || !family.conjoint_prenom.trim() || !family.conjoint_nom.trim() || !family.conjoint_email.trim())) {\n        throw new Error('Complétez les informations de la deuxième personne : civilité, prénom, nom et email personnel.');\n      }\n`;
  const newValidation = `      if (!family.dossier_scope) throw new Error('Indiquez si ce dossier concerne une personne ou un couple.');\n      if (!family.situation) throw new Error('Indiquez votre situation familiale.');\n      const childCount = Number(family.nombre_enfants);\n      if (family.nombre_enfants === '' || !Number.isInteger(childCount) || childCount < 0) throw new Error('Indiquez un nombre d’enfants valide, supérieur ou égal à 0.');\n      if (legalDetailsRequired && (!family.date_evenement || !family.regime_convention)) throw new Error('Pour une situation mariée ou pacsée, indiquez la date et le régime / la convention.');\n      if (isCouple && (!family.conjoint_civilite || !family.conjoint_prenom.trim() || !family.conjoint_nom.trim() || !family.conjoint_email.trim())) {\n        throw new Error('Complétez les informations de l’Identifiant 2 : civilité, prénom, nom et email personnel.');\n      }\n      if (isCouple && !isValidEmail(family.conjoint_email)) throw new Error('Indiquez une adresse email personnelle valide pour l’Identifiant 2.');\n      if (isCouple && family.conjoint_mobile.trim() && !isValidMobile(family.conjoint_mobile)) throw new Error('Indiquez un numéro de mobile valide pour l’Identifiant 2.');\n`;
  if (s.includes(oldValidation)) s = s.replace(oldValidation, newValidation);
  else if (!s.includes('const childCount = Number(family.nombre_enfants);')) throw new Error('Family validation block not found');

  const oldError = `        {errorMessage && <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>}\n`;
  const newError = `        {errorMessage && <div id="family-validation-alert" role="alert" tabIndex={-1} className="mt-5 scroll-mt-28 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><p className="font-semibold">À compléter avant de continuer</p><p className="mt-1">{errorMessage}</p></div>}\n`;
  if (s.includes(oldError)) s = s.replace(oldError, newError);
  else if (!s.includes('id="family-validation-alert"')) throw new Error('Family error block not found');

  fs.writeFileSync(path, s);
}

function patchQuestionnaireCta() {
  const path = 'src/pages/portal/QuestionnairePageBase.tsx';
  let s = fs.readFileSync(path, 'utf8');
  const oldButton = `<button type="button" onClick={() => navigate(nextPath)} className="mt-6 rounded-xl bg-[#3B82F6] px-5 py-3 text-sm font-semibold text-white">Continuer vers les documents</button>`;
  const newButton = `<button type="button" onClick={() => navigate(nextPath)} className="mt-6 rounded-xl bg-[#3B82F6] px-5 py-3 text-sm font-semibold text-white">{mode === 'QPI' && progress.esg_opt_in === true ? 'Continuer vers mes préférences de durabilité' : 'Continuer vers les documents'}</button>`;
  if (s.includes(oldButton)) s = s.replace(oldButton, newButton);
  else if (!s.includes("Continuer vers mes préférences de durabilité")) throw new Error('Questionnaire completion CTA not found');
  fs.writeFileSync(path, s);
}

patchFamilyEntry();
patchQuestionnaireCta();
console.log('Novice UX hardening patch applied');
