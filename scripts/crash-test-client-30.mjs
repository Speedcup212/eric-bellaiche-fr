import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const recueil = read('src/pages/portal/ClientRecueilJourneyBase.tsx');
const entry = read('src/pages/portal/ClientRecueilEntryPage.tsx');
const journey = read('src/portal/FintechJourney.tsx');
const helpers = read('src/portal/portalHelpers.ts');
const docs = read('src/pages/portal/ClientDocumentsPage.tsx');
const q = read('src/pages/portal/QuestionnairePageBase.tsx');

let failures = 0;
const results = [];
function test(name, condition, detail = '') {
  const ok = Boolean(condition);
  results.push({ name, ok, detail });
  if (!ok) failures++;
}
function has(s, x) { return s.includes(x); }

// 1-7: navigation and entry
const sectionOrder = ['identity','family','professional','objectives','capacity','patrimony','regulatory'];
let last = -1;
let orderOk = true;
for (const code of sectionOrder) {
  const idx = recueil.indexOf(`code: '${code}'`);
  if (idx < 0 || idx <= last) orderOk = false;
  last = idx;
}
test('01 — Ordre recueil: Patrimoine avant Réglementaire', orderOk);
test('02 — Onglets généraux tous cliquables', has(journey, "{href ? <Link to={href}") && has(journey, 'Vous pouvez accéder à chaque étape'));
test('03 — Première page affiche 45 minutes', has(entry, 'Temps estimé : environ 45 minutes'));
test('04 — Reprise du parcours annoncée', has(entry, 'interrompre le parcours et le reprendre à tout moment'));
test('05 — Dossier couple: Identifiant 1/2 uniquement', has(entry, 'Identifiant 1 :') && has(entry, 'Identifiant 2 :') && !has(entry, 'Personne 1'));
test('06 — Données communes couple non redemandées', has(entry, 'ne lui sont pas redemandées'));
test('07 — Dossier invalide ne doit pas retomber sur le premier dossier', !has(helpers, "rows.find((row) => row.dossier_id === dossierId) ?? rows[0]"));

// 8-17: recueil field/conditional validations
const expectedRecueilStrings = [
  ['08 — Mme: nom de naissance obligatoire', 'nom de naissance'],
  ['09 — Mobile invalide bloqué', 'numéro de mobile valide'],
  ['10 — Marié/Pacsé: régime obligatoire', 'régime / la convention'],
  ['11 — Sans activité: origine des revenus', 'origine de vos revenus'],
  ['12 — Changement professionnel détaillé', 'Précisez le changement professionnel prévu'],
  ['13 — Au moins un objectif', 'Sélectionnez au moins un objectif'],
  ['14 — Objectif Autre précisé', 'Précisez votre autre objectif'],
  ['15 — Revenus à zéro acceptables', 'Indiquez 0 lorsqu’un montant est nul'],
  ['16 — Aucun bien immobilier possible', "form.has_real_estate === false"],
  ['17 — Bien immobilier doit être nommé', 'indiquez un nom pour identifier le bien'],
];
for (const [name, needle] of expectedRecueilStrings) test(name, has(recueil, needle), needle);

test('18 — Quote-part multi-propriétaire contrôlée 1..99', has(recueil, 'quotePartValue <= 0') && has(recueil, 'quotePartValue >= 100'));
test('19 — Saisie % tolérée/nettoyée', has(recueil, ".replace('%', '')"));
test('20 — Loyer uniquement pour Locatif', has(recueil, "item.usage === 'Locatif'") && has(recueil, 'Loyer annuel hors charges'));
test('21 — Année acquisition contrôlée', has(recueil, 'year < 1800') && has(recueil, 'year > maxYear'));
test('22 — Bouton final reste cliquable hors enregistrement', has(recueil, 'disabled={busy}') && !has(recueil, 'disabled={busy ||'));
test('23 — Erreur recueil orange + scroll', has(recueil, 'recueil-validation-alert') && has(recueil, 'scrollIntoView'));

// 24-27: regulatory
const regStart = recueil.indexOf("current.code === 'regulatory'");
const regChunk = regStart >= 0 ? recueil.slice(regStart, regStart + 12000) : '';
test('24 — US Person: TIN conditionnel', has(regChunk, "citoyen_ou_resident_us === true") && has(regChunk, 'Numéro fiscal américain (TIN)'));
test('25 — Sanctions: précision conditionnelle', has(regChunk, "sanctions_declarees === true") && has(regChunk, 'Mesure ou autorité concernée'));
test('26 — PPE: détails conditionnels', has(regChunk, "ppe_declaree === true") && has(regChunk, 'Personne concernée'));
test('27 — Questions réglementaires visuellement renforcées', has(regChunk, 'regulatory-question') || has(regChunk, 'text-base') || has(regChunk, 'text-lg'));

// 28-30: questionnaires/documents/transmission
 test('28 — ESG non choisi: accès Documents après QPI', has(helpers, "progress.esg_opt_in === true ? '/espace-client/esg' : '/espace-client/documents'"));
test('29 — Documents couple: identité rattachée à Identifiant 1/2', has(docs, 'identityOwnerId') && has(docs, "memberLabel") && has(docs, 'Sélectionnez Identifiant 1 ou Identifiant 2'));
test('30 — Transmission finale couple verrouillée tant que les deux ne sont pas prêts', has(docs, 'dossier_ready_for_documents') && has(docs, 'chaque personne du dossier n’a pas terminé son parcours individuel'));

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail && !r.ok ? ` — ${r.detail}` : ''}`);
console.log(`\nRésultat: ${results.length - failures}/${results.length} tests réussis.`);
if (failures) process.exit(1);
