import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const entry = read('src/pages/portal/ClientRecueilJourneyPage.tsx');
const recueil = read('src/pages/portal/ClientRecueilJourneyBase.tsx');
const qBase = read('src/pages/portal/QuestionnairePageBase.tsx');
const qPage = read('src/pages/portal/QuestionnairePage.tsx');
const docs = read('src/pages/portal/ClientDocumentsPage.tsx');
const journey = read('src/portal/FintechJourney.tsx');
const helpers = read('src/portal/portalHelpers.ts');

let failures = 0;
const results = [];
function test(name, condition, note = '') {
  const ok = Boolean(condition);
  results.push({ name, ok, note });
  if (!ok) failures++;
}
const has = (s, x) => s.includes(x);

// 1–7 : première impression et compréhension globale
 test('01 — Temps moyen annoncé dès la première page', has(entry, 'Temps estimé : environ 45 minutes'));
 test('02 — Reprise ultérieure explicitement annoncée', has(entry, 'reprendre à tout moment'));
 test('03 — Distinction personne seule / couple compréhensible', has(entry, 'Une seule personne') && has(entry, 'Un couple'));
 test('04 — Couple nommé Identifiant 1 / Identifiant 2', has(entry, 'Identifiant 1') && has(entry, 'Identifiant 2') && !has(entry, 'Personne 1'));
 test('05 — Données communes du couple expliquées', has(entry, 'ne seront pas redemandées') || has(entry, 'ne lui sont pas redemandées'));
 test('06 — Progression globale visible', has(journey, 'du parcours global'));
 test('07 — Onglets du parcours explicitement cliquables', has(journey, 'Vous pouvez accéder à chaque étape du parcours'));

// 8–15 : novice sur la première page et saisies simples
 test('08 — Nombre d’enfants ne peut pas être négatif côté HTML', has(entry, 'min="0"'));
 test('09 — Nombre d’enfants validé côté logique', has(entry, 'Number.isInteger') && has(entry, 'supérieur ou égal à 0'));
 test('10 — Email Identifiant 2 contrôlé explicitement', has(entry, 'isValidEmail') && has(entry, 'adresse email personnelle valide'));
 test('11 — Mobile Identifiant 2 contrôlé s’il est saisi', has(entry, 'isValidMobile') && has(entry, 'numéro de mobile valide'));
 test('12 — Erreur de première page présentée comme action à corriger', has(entry, 'À compléter avant de continuer'));
 test('13 — Erreur de première page amenée à l’écran', has(entry, 'family-validation-alert') && has(entry, 'scrollIntoView'));
 test('14 — Champs monétaires expliquent de ne pas saisir €', has(recueil, 'sans le symbole €'));
 test('15 — Valeur zéro explicitement autorisée quand pertinente', has(recueil, 'Indiquez 0 lorsqu’un montant est nul'));

// 16–22 : patrimoine/réglementaire, zones à fort risque d’hésitation
 test('16 — Aucun bien immobilier est un chemin valide clair', has(recueil, 'Aucun bien immobilier déclaré'));
 test('17 — Bien immobilier nommé avec exemple novice', has(recueil, 'Maison principale') && has(recueil, 'Studio locatif'));
 test('18 — Quote-part explique la saisie sans %', has(recueil, 'sans le symbole %'));
 test('19 — Loyer locatif donne un exemple annuel depuis mensuel', has(recueil, '9600 pour un loyer mensuel de 800'));
 test('20 — FATCA expliqué en langage courant', has(recueil, 'nationalité américaine') && has(recueil, 'carte verte'));
 test('21 — Sanctions expliquées sans ambiguïté', has(recueil, 'une autorité vous a notifié une sanction'));
 test('22 — PPE définie par exemples concrets', has(recueil, 'chef d’État') && has(recueil, 'parlementaire') && has(recueil, 'conjoint'));

// 23–27 : QPI / ESG novice
 test('23 — QPI explique ce qu’il mesure', has(qBase, 'connaissances') && has(qBase, 'capacité de perte') && has(qBase, 'tolérance au risque'));
 test('24 — Questions de connaissance disent de répondre sans assistance', has(qBase, 'Répondez sans assistance'));
 test('25 — ESG explique clairement Environnement / Social / Gouvernance', has(qBase, 'Environnement') && has(qBase, 'Social') && has(qBase, 'Gouvernance'));
 test('26 — ESG indique qu’aucune connaissance technique n’est nécessaire', has(qBase, 'aucune connaissance technique n’est nécessaire'));
 test('27 — CTA de fin QPI suit réellement ESG oui/non', has(qPage, 'Continuer vers mes préférences de durabilité') && has(qPage, 'Continuer vers les documents'));

// 28–30 : documents et fin de parcours
 test('28 — Situation fiscale sans avis propose des motifs simples', has(docs, 'Première déclaration fiscale') && has(docs, 'Arrivée récente en France') && has(docs, 'Avis d’imposition pas encore émis'));
 test('29 — Documents attendus s’adaptent à la situation', has(docs, 'Selon votre situation') && has(docs, 'Pièces attendues'));
 test('30 — Couple : transmission finale explique l’attente de l’autre personne', has(docs, 'Transmission finale en attente de l’autre personne') && has(docs, 'deux parcours'));

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.note && !r.ok ? ` — ${r.note}` : ''}`);
console.log(`\nRésultat novice : ${results.length - failures}/${results.length} tests réussis.`);
if (failures) process.exit(1);
