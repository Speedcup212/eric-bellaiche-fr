import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'npm:docx@9.5.1';

const allowedOrigins = new Set([
  'https://eric-bellaiche.fr',
  'https://www.eric-bellaiche.fr',
  'http://localhost:5173',
]);

const DOC_VERSION = '2026-MAITRE-1.0';
const BUCKET = 'regulatory-docs';
const DARK = '0F172A';
const BLUE = '1E467A';
const GREEN = '14532D';
const TEAL = '0F766E';
const LIGHT = 'F8FAFC';
const BORDER = 'CBD5E1';

type Json = Record<string, any>;
type DocumentType = 'recueil' | 'qpi' | 'esg';

function corsHeaders(origin: string | null) {
  const allowed = origin && allowedOrigins.has(origin) ? origin : 'https://eric-bellaiche.fr';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
  };
}

function text(value: unknown, fallback = 'Non renseigné') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (Array.isArray(value)) return value.length ? value.join(', ') : fallback;
  return String(value);
}

function num(value: unknown) {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function eur(value: unknown) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(num(value));
}

function pct(value: unknown) {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(num(value))} %`;
}

function frDate(value: unknown) {
  if (!value) return 'Non renseignée';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return text(value);
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
}

function slug(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

async function sha256Hex(data: Uint8Array | string) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function run(value: string, options: Json = {}) {
  return new TextRun({ text: value, font: 'Aptos', color: options.color ?? DARK, bold: Boolean(options.bold), size: options.size ?? 19, italics: Boolean(options.italics) });
}

function p(value: string, options: Json = {}) {
  return new Paragraph({
    children: [run(value, options)],
    heading: options.heading,
    alignment: options.alignment,
    spacing: { before: options.before ?? 0, after: options.after ?? 100 },
    pageBreakBefore: Boolean(options.pageBreakBefore),
    keepNext: Boolean(options.keepNext),
  });
}

function heading(value: string, level = 1) {
  return p(value, { heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2, size: level === 1 ? 26 : 22, bold: true, color: BLUE, before: 160, after: 100, keepNext: true });
}

function cell(value: string, options: Json = {}) {
  return new TableCell({
    shading: options.header ? { fill: DARK, color: 'auto' } : options.fill ? { fill: options.fill, color: 'auto' } : undefined,
    borders: {
      top: { style: BorderStyle.SINGLE, color: BORDER, size: 4 },
      bottom: { style: BorderStyle.SINGLE, color: BORDER, size: 4 },
      left: { style: BorderStyle.SINGLE, color: BORDER, size: 4 },
      right: { style: BorderStyle.SINGLE, color: BORDER, size: 4 },
    },
    children: [new Paragraph({ children: [run(value, { bold: options.header || options.bold, color: options.header ? 'FFFFFF' : options.color ?? DARK, size: options.size ?? 17 })], spacing: { before: 40, after: 40 } })],
  });
}

function table(headers: string[], rows: string[][], widths?: number[]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => new TableCell({ width: widths ? { size: widths[i], type: WidthType.PERCENTAGE } : undefined, shading: { fill: DARK, color: 'auto' }, borders: { top: { style: BorderStyle.SINGLE, color: DARK, size: 4 }, bottom: { style: BorderStyle.SINGLE, color: DARK, size: 4 }, left: { style: BorderStyle.SINGLE, color: DARK, size: 4 }, right: { style: BorderStyle.SINGLE, color: DARK, size: 4 } }, children: [new Paragraph({ children: [run(h, { bold: true, color: 'FFFFFF', size: 17 })] })] })) }),
      ...rows.map((row) => new TableRow({ cantSplit: true, children: row.map((v) => cell(v)) })),
    ],
  });
}

function signatureTable(investors: Json[]) {
  const cells = investors.map((inv) => cell(`${inv.prenom} ${inv.nom}\nFait à : ____________________\nDate : ____________________\n\nSignature :\n\n\n`, { fill: LIGHT, color: BLUE }));
  cells.push(cell('Eric Bellaiche\nFait à : ____________________\nDate : ____________________\n\nSignature :\n\n\n', { fill: 'F0FDF4', color: GREEN }));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ cantSplit: true, children: cells })] });
}

function extractByCode(sections: Json[], investorId: string) {
  return Object.fromEntries(sections.filter((s) => s.investisseur_id === investorId).map((s) => [s.section_code, s.payload ?? {}]));
}

function investorName(inv: Json) {
  return `${text(inv.prenom, '')} ${text(inv.nom, '')}`.trim() || 'Investisseur';
}

function objectiveLabel(code: string) {
  const labels: Record<string, string> = {
    optimisation_fiscale: 'Optimiser sa fiscalité', achat_immobilier: 'Financer un achat immobilier', constitution_patrimoine: 'Se constituer un patrimoine', epargne_precaution: 'Se constituer une épargne de précaution', liquidites_court_terme: 'Placer des liquidités à court terme', revenus_complementaires: 'Obtenir des revenus complémentaires', optimisation_rendement: 'Optimiser la rentabilité de ses placements', retraite: 'Préparer sa retraite', aide_enfants: 'Aider ses enfants', protection_conjoint: 'Protéger le conjoint survivant', protection_proches: 'Protéger ses proches', transmission: 'Préparer la transmission de son patrimoine', transmission_entreprise: 'Préparer la transmission de son entreprise', accidents_vie: 'Se prémunir contre les accidents de la vie', autre: 'Autre objectif',
  };
  return labels[code] ?? code;
}

function buildRecueil(snapshot: Json) {
  const dossier = snapshot.dossier;
  const investors = snapshot.investors;
  const sections = snapshot.sections;
  const allSectionMaps = investors.map((i: Json) => ({ inv: i, map: extractByCode(sections, i.id) }));

  const properties: Json[] = [];
  const credits: Json[] = [];
  let incomeAnnual = 0;
  let financialDeclared = 0;
  for (const { map } of allSectionMaps) {
    incomeAnnual += num(map.capacity?.estimation_revenus_travail_annuels) + num(map.capacity?.estimation_revenus_fonciers_annuels);
    if (map.patrimony?.has_real_estate === true) properties.push(...(map.patrimony?.immobilier ?? []));
    if (map.credits?.has_credits === true) credits.push(...(map.credits?.items ?? []));
    const placements = map.patrimony?.placements ?? [];
    financialDeclared += placements.reduce((sum: number, x: Json) => sum + num(x.montant ?? x.valeur ?? x.encours), 0);
  }
  const propertyTotal = properties.reduce((sum, x) => sum + num(x.valeur_actuelle), 0);
  const crdTotal = credits.reduce((sum, x) => sum + num(x.crd ?? x.capital_restant_du), 0);
  const monthlyDebt = credits.reduce((sum, x) => sum + num(x.mensualite), 0);
  const monthlyIncome = incomeAnnual / 12;
  const debtRatio = monthlyIncome > 0 ? monthlyDebt / monthlyIncome * 100 : null;
  const margin35 = monthlyIncome > 0 ? monthlyIncome * 0.35 - monthlyDebt : null;
  const net = propertyTotal + financialDeclared - crdTotal;

  const children: any[] = [];
  children.push(p('CABINET ERIC BELLAICHE', { bold: true, color: BLUE, size: 22, alignment: AlignmentType.CENTER }));
  children.push(p('RECUEIL D’INFORMATIONS PATRIMONIALES', { bold: true, color: DARK, size: 34, alignment: AlignmentType.CENTER }));
  children.push(p('Document destiné à la validation et à la signature électronique via Youtrust', { color: TEAL, size: 19, alignment: AlignmentType.CENTER }));
  children.push(p(`Date du recueil : ${frDate(snapshot.recueil_date)}  •  Date d’entrée en relation : ${frDate(dossier.date_entree_relation)}`, { bold: true, color: GREEN, alignment: AlignmentType.CENTER }));

  let sectionNumber = 1;
  for (const { inv, map } of allSectionMaps) {
    children.push(heading(`${sectionNumber}. Identité et coordonnées — ${investorName(inv)}`)); sectionNumber++;
    const id = map.identity ?? {};
    children.push(table(['Donnée', 'Valeur'], [
      ['Civilité', text(id.civilite ?? inv.civilite)], ['Prénom', text(id.prenom ?? inv.prenom)], ['Nom', text(id.nom ?? inv.nom)], ['Nom de naissance', text(id.nom_naissance ?? inv.nom_naissance)], ['Date de naissance', frDate(id.date_naissance ?? inv.date_naissance)], ['Lieu / pays de naissance', `${text(id.lieu_naissance ?? inv.lieu_naissance)} / ${text(id.pays_naissance ?? inv.pays_naissance)}`], ['Nationalité', text(id.nationalite ?? inv.nationalite)], ['Mobile', text(id.mobile ?? inv.mobile)], ['E-mail', text(inv.email)], ['Numéro fiscal', text(id.numero_fiscal ?? inv.numero_fiscal)], ['Adresse', [id.address?.numero_voie, id.address?.complement, id.address?.code_postal, id.address?.ville, id.address?.pays].filter(Boolean).join(' ') || 'Non renseignée'],
    ]));

    children.push(heading(`${sectionNumber}. Situation familiale`)); sectionNumber++;
    const fam = map.family ?? {};
    children.push(table(['Donnée', 'Valeur'], [
      ['Situation familiale', text(fam.situation)], ['Date de l’événement', frDate(fam.date_evenement)], ['Régime / convention', text(fam.regime_convention)], ['Avantage / clause particulière', text(fam.avantage_matrimonial)], ['Évolution prévue', text(fam.evolution_prevue)], ['Notaire', text(fam.notaire_nom_ville)], ['Expert-comptable', text(fam.expert_comptable_nom_ville)], ['Nombre d’enfants', text(fam.nombre_enfants, '0')], ['Commentaires', text(fam.commentaires)],
    ]));

    children.push(heading(`${sectionNumber}. Situation professionnelle`)); sectionNumber++;
    const pro = map.professional ?? {};
    children.push(table(['Donnée', 'Valeur'], [
      ['Profession', text(pro.profession_actuelle)], ['Société / employeur', text(pro.societe)], ['Secteur', text(pro.secteur_activite)], ['Statut', text(pro.statut)], ['Date d’entrée', frDate(pro.date_entree)], ['Ancienneté déclarée', text(pro.anciennete_annees)], ['Changement prévu', text(pro.changement_professionnel_prevu)], ['Détails du changement', text(pro.changement_professionnel_details)],
    ]));

    children.push(heading(`${sectionNumber}. Objectifs et horizons`)); sectionNumber++;
    const objs = (map.objectives?.items ?? []) as Json[];
    children.push(table(['Priorité', 'Objectif', 'Horizon'], objs.length ? objs.map((o, idx) => [String(idx + 1), o.code_objectif === 'autre' ? text(o.libelle_autre) : objectiveLabel(text(o.code_objectif, '')), text(o.horizon_annees)]) : [['—', 'Aucun objectif renseigné', '—']]));

    children.push(heading(`${sectionNumber}. Revenus et capacité financière`)); sectionNumber++;
    const cap = map.capacity ?? {};
    children.push(table(['Donnée', 'Valeur'], [
      ['Revenus professionnels nets estimés — année en cours', eur(cap.estimation_revenus_travail_annuels)], ['Revenus immobiliers estimés — année en cours', eur(cap.estimation_revenus_fonciers_annuels)], ['Capacité d’épargne mensuelle', eur(cap.capacite_epargne_mensuelle)], ['Réserve de sécurité souhaitée', eur(cap.epargne_precaution_cible)], ['Apport immobilier mobilisable', eur(cap.apport_immobilier_possible)],
    ]));

    children.push(heading(`${sectionNumber}. Situation fiscale`)); sectionNumber++;
    const tax = map.tax ?? {};
    children.push(table(['Donnée fiscale', 'Valeur'], [
      ['Année d’imposition', text(tax.annee_imposition)], ['Revenu imposable', eur(tax.revenu_imposable)], ['Revenu fiscal de référence', eur(tax.revenu_fiscal_reference)], ['Nombre de parts', text(tax.nombre_parts)], ['TMI', pct(tax.tmi)], ['Impôt sur le revenu net', eur(tax.impot_revenu_net)], ['Salaires / assimilés', eur(tax.salaires_assimiles)], ['Pensions / retraites / rentes', eur(tax.pensions_retraites_rentes)], ['Revenus LMNP', eur(tax.revenus_lmnp)], ['Revenus BNC professionnels', eur(tax.revenus_bnc_pro)], ['Revenus de capitaux mobiliers', eur(tax.revenus_capitaux_mobiliers)], ['Revenus fonciers nets', eur(tax.revenus_fonciers_nets)], ['Déficit foncier reportable', eur(tax.deficit_foncier_reportable)], ['Prélèvements sociaux nets', eur(tax.prelevements_sociaux_nets)], ['Taux moyen d’imposition', pct(tax.taux_imposition)], ['Plafond épargne retraite disponible', eur(tax.plafond_disponible_avis)], ['Versements retraite à déduire', eur(tax.versements_a_deduire)], ['Plafond non utilisé calculé', eur(tax.plafond_non_utilise_calcule)],
    ]));
    if (tax.ifi_concerne === true) children.push(table(['Donnée IFI', 'Valeur'], [['Base imposable IFI', eur(tax.ifi_base_imposable)], ['TMI IFI', pct(tax.ifi_tmi)], ['IFI net à payer', eur(tax.ifi_net_a_payer)]]));
  }

  children.push(heading(`${sectionNumber}. Patrimoine immobilier consolidé`)); sectionNumber++;
  children.push(table(['Bien', 'Ville', 'Usage', 'Détention', 'Propriétaire', 'Valeur actuelle'], properties.length ? properties.map((x, idx) => [`Bien ${idx + 1}`, text(x.ville), text(x.usage), text(x.mode_detention), text(x.proprietaire), eur(x.valeur_actuelle)]) : [['—', '—', 'Aucun bien déclaré', '—', '—', '0 €']]));

  children.push(heading(`${sectionNumber}. Patrimoine financier et liquidités`)); sectionNumber++;
  for (const { inv, map } of allSectionMaps) {
    const financial = map.financial ?? {};
    children.push(p(investorName(inv), { bold: true, color: BLUE, before: 120 }));
    children.push(table(['Donnée', 'Valeur'], [
      ['Liquidités importantes volontairement conservées sur comptes courants', text(financial.current_accounts_intentional)], ['Catégories de placements', text(financial.categories)], ['Fourchette de patrimoine financier', text(financial.total_band)], ['Autres placements / précisions', text(financial.other_details)], ['Complétude confirmée', text(financial.completeness_confirmed)],
    ]));
  }

  children.push(heading(`${sectionNumber}. Crédits et endettement`)); sectionNumber++;
  children.push(table(['Crédit', 'Type', 'Banque', 'Montant initial', 'CRD', 'Mensualité', 'Taux', 'Échéance'], credits.length ? credits.map((x, idx) => [`Crédit ${idx + 1}`, text(x.type_credit ?? x.type_pret), text(x.banque), eur(x.montant_initial), eur(x.crd ?? x.capital_restant_du), eur(x.mensualite), pct(x.taux), frDate(x.date_echeance)]) : [['—', 'Aucun crédit déclaré', '—', '0 €', '0 €', '0 €', '—', '—']]));
  children.push(table(['Ratio', 'Résultat'], [
    ['Revenus annuels consolidés', eur(incomeAnnual)], ['Mensualités de crédits', eur(monthlyDebt)], ['Taux d’endettement', debtRatio === null ? 'Non calculable' : pct(debtRatio)], ['Marge mensuelle théorique à 35 %', margin35 === null ? 'Non calculable' : eur(margin35)], ['Patrimoine immobilier brut', eur(propertyTotal)], ['Patrimoine financier exact disponible', financialDeclared > 0 ? eur(financialDeclared) : 'Non consolidable : fourchettes déclarées'], ['CRD total', eur(crdTotal)], ['Patrimoine net calculable', financialDeclared > 0 ? eur(net) : `${eur(propertyTotal - crdTotal)} hors patrimoine financier non chiffré`],
  ]));
  children.push(p('Limite de calcul : le taux d’endettement et la marge à 35 % sont des indicateurs théoriques. Ils ne constituent ni un accord bancaire ni une capacité d’emprunt garantie.', { color: GREEN, bold: true, before: 100 }));

  children.push(heading(`${sectionNumber}. Informations réglementaires`)); sectionNumber++;
  for (const { inv, map } of allSectionMaps) {
    const reg = map.regulatory ?? {};
    children.push(p(investorName(inv), { bold: true, color: BLUE, before: 100 }));
    children.push(table(['Question / information', 'Réponse'], [
      ['Pays de résidence fiscale', text(reg.pays_residence_fiscale)], ['Citoyen ou résident fiscal américain', text(reg.citoyen_ou_resident_us)], ['TIN américain', text(reg.code_tin)], ['Sanctions internationales / gel des avoirs', text(reg.sanctions_declarees)], ['PPE — client ou proche', text(reg.ppe_declaree)], ['Personne exposée', text(reg.ppe_personne_exposee)], ['Fonction PPE', text(reg.ppe_motif)], ['Pays d’exercice PPE', text(reg.ppe_pays_exercice)], ['Période PPE', text(reg.ppe_anciennete)], ['Souhaite prendre en compte des critères ESG', text(reg.esg_opt_in)],
    ]));
  }

  children.push(heading(`${sectionNumber}. Validation des informations`));
  children.push(p('En signant, les clients confirment avoir relu les informations reproduites dans le présent recueil et déclarent qu’elles sont, à leur connaissance, exactes, sincères et complètes à la date du recueil. Les éléments signalés comme non renseignés ou à confirmer devront être complétés avant toute recommandation qui en dépend.'));
  children.push(p('Portée de la signature : la signature du recueil ne vaut ni recommandation d’investissement, ni offre de financement, ni engagement de souscription.', { bold: true, color: GREEN }));
  children.push(signatureTable(investors));

  return new Document({
    styles: { default: { document: { run: { font: 'Aptos', size: 19, color: DARK }, paragraph: { spacing: { after: 80 } } } } },
    sections: [{ properties: { page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } } }, children }],
  });
}

function answerValue(answer: Json, optionMap: Map<string, Json>) {
  if (answer.option_id && optionMap.has(answer.option_id)) return text(optionMap.get(answer.option_id)?.libelle);
  if (answer.answer_text) return text(answer.answer_text);
  if (answer.answer_numeric !== null && answer.answer_numeric !== undefined) return text(answer.answer_numeric);
  if (answer.answer_date) return frDate(answer.answer_date);
  if (answer.answer_json && Object.keys(answer.answer_json).length) return text(answer.answer_json);
  return 'Non renseigné';
}

function buildQuestionnaire(snapshot: Json, type: 'QPI' | 'ESG') {
  const dossier = snapshot.dossier;
  const investors = snapshot.investors;
  const sessions = snapshot.sessions.filter((s: Json) => snapshot.templateById[s.template_id]?.type_questionnaire === type);
  const children: any[] = [];
  const title = type === 'QPI' ? 'PROFIL INVESTISSEUR' : 'QUESTIONNAIRE ESG / PRÉFÉRENCES DE DURABILITÉ';
  children.push(p('CABINET ERIC BELLAICHE', { bold: true, color: BLUE, size: 22, alignment: AlignmentType.CENTER }));
  children.push(p(title, { bold: true, color: DARK, size: 34, alignment: AlignmentType.CENTER }));
  children.push(p('Document destiné à la validation et à la signature électronique via Youtrust', { color: TEAL, alignment: AlignmentType.CENTER }));
  children.push(p(`Date de l’évaluation : ${frDate(type === 'QPI' ? snapshot.qpi_date : snapshot.esg_date)}  •  Date d’entrée en relation : ${frDate(dossier.date_entree_relation)}`, { bold: true, color: GREEN, alignment: AlignmentType.CENTER }));

  for (const inv of investors) {
    const session = sessions.find((s: Json) => s.investisseur_id === inv.id);
    children.push(heading(`${investorName(inv)} — ${type === 'QPI' ? 'profil investisseur' : 'préférences ESG'}`));
    if (!session) {
      if (type === 'ESG' && inv.esg_opt_in === false) children.push(p('Aucune préférence ESG obligatoire exprimée. Le client a choisi de ne pas remplir le questionnaire ESG détaillé.', { bold: true, color: GREEN }));
      else children.push(p('Questionnaire non disponible pour cet investisseur.', { color: 'B45309' }));
      continue;
    }
    const template = snapshot.templateById[session.template_id];
    children.push(p(`${text(template?.libelle)} — version ${text(template?.version)}`, { color: BLUE, bold: true }));
    if (type === 'QPI') {
      const result = snapshot.qpiResults.find((r: Json) => r.session_id === session.id);
      if (result) children.push(table(['Indicateur', 'Résultat'], [
        ['Score de tolérance', `${text(result.score_tolerance)} / ${text(result.score_max)}`], ['Profil indicatif', text(result.profil_indicatif)], ['Profil opérationnel final', text(result.profil_operationnel_final)], ['Niveau retenu', text(result.niveau_tolerance_retenu)], ['Perte maximale déclarée', `${eur(result.perte_max_declairee_montant)} / ${pct(result.perte_max_declairee_pct)}`], ['Capacité de perte retenue', `${eur(result.capacite_perte_retenue_montant)} / ${pct(result.capacite_perte_retenue_pct)}`], ['Écart déclaré / objectivé', text(result.ecart_declared_objective)], ['Justification', text(result.justification_ecart)],
      ]));
    } else {
      const pref = snapshot.esgPreferences.find((r: Json) => r.session_id === session.id);
      if (pref) children.push(table(['Thème', 'Préférence'], [
        ['Périmètre', text(pref.perimetre)], ['Taxonomie — choix', text(pref.taxonomie_choix)], ['Taxonomie — minimum', pct(pref.taxonomie_min_pct)], ['Objectifs taxonomie', text(pref.taxonomie_objectifs)], ['SFDR — choix', text(pref.sfdr_choix)], ['SFDR — minimum', pct(pref.sfdr_min_pct)], ['Thématiques durables', text(pref.sfdr_thematiques)], ['PAI — choix', text(pref.pai_choix)], ['Priorités PAI', text(pref.pai_priorites)], ['Exclusions sectorielles', text(pref.exclusions_sectorielles)], ['Limitations sectorielles', text(pref.limitations_sectorielles)], ['Besoins spécifiques', text(pref.besoins_specifiques)], ['Synthèse réglementaire', text(pref.synthese_reglementaire)],
      ]));
    }
    const questions = snapshot.questions.filter((q: Json) => q.template_id === session.template_id).sort((a: Json, b: Json) => a.ordre - b.ordre);
    const answers = snapshot.answers.filter((a: Json) => a.session_id === session.id);
    const answerByQuestion = new Map(answers.map((a: Json) => [a.question_id, a]));
    children.push(heading('Détail réglementaire du questionnaire', 2));
    children.push(table(['N°', 'Question', 'Réponse', 'Points'], questions.map((q: Json) => {
      const a = answerByQuestion.get(q.id) ?? {};
      return [String(q.ordre), text(q.libelle), answerValue(a, snapshot.optionMap), a.points_awarded === null || a.points_awarded === undefined ? '—' : text(a.points_awarded)];
    }), [8, 52, 30, 10]));
  }
  children.push(heading('Validation et signatures'));
  children.push(p(type === 'QPI' ? 'En signant, les clients confirment avoir pris connaissance des réponses reproduites, du résultat du profil et des éventuelles limites de capacité de perte.' : 'En signant, les clients confirment que les préférences de durabilité reproduites correspondent à leurs réponses à la date du questionnaire.'));
  children.push(signatureTable(investors));
  return new Document({ styles: { default: { document: { run: { font: 'Aptos', size: 19, color: DARK } } } }, sections: [{ properties: { page: { margin: { top: 900, right: 700, bottom: 900, left: 700 } } }, children }] });
}

async function loadSnapshot(client: any, dossierId: string) {
  const [dossierRes, investorRes, sectionRes, sessionRes] = await Promise.all([
    client.from('dossiers').select('*').eq('id', dossierId).single(),
    client.from('dossier_investisseurs').select('*,investisseurs(*)').eq('dossier_id', dossierId).order('role_dossier'),
    client.from('recueil_sections').select('*').eq('dossier_id', dossierId),
    client.from('questionnaire_sessions').select('*').eq('dossier_id', dossierId),
  ]);
  for (const r of [dossierRes, investorRes, sectionRes, sessionRes]) if (r.error) throw r.error;
  const links = investorRes.data ?? [];
  const investors = links.map((row: Json) => ({ ...(Array.isArray(row.investisseurs) ? row.investisseurs[0] : row.investisseurs), ...row, id: row.investisseur_id }));
  const sessions = sessionRes.data ?? [];
  const templateIds = [...new Set(sessions.map((s: Json) => s.template_id).filter(Boolean))];
  let templates: Json[] = [], questions: Json[] = [], answers: Json[] = [], options: Json[] = [], qpiResults: Json[] = [], esgPreferences: Json[] = [];
  if (templateIds.length) {
    const templateRes = await client.from('questionnaire_templates').select('*').in('id', templateIds); if (templateRes.error) throw templateRes.error; templates = templateRes.data ?? [];
    const questionRes = await client.from('questionnaire_questions').select('*').in('template_id', templateIds); if (questionRes.error) throw questionRes.error; questions = questionRes.data ?? [];
    const questionIds = questions.map((q: Json) => q.id);
    if (questionIds.length) { const optionRes = await client.from('questionnaire_options').select('*').in('question_id', questionIds); if (optionRes.error) throw optionRes.error; options = optionRes.data ?? []; }
  }
  const sessionIds = sessions.map((s: Json) => s.id);
  if (sessionIds.length) {
    const [answerRes, qpiRes, esgRes] = await Promise.all([
      client.from('questionnaire_answers').select('*').in('session_id', sessionIds), client.from('qpi_results').select('*').in('session_id', sessionIds), client.from('esg_preferences').select('*').in('session_id', sessionIds),
    ]);
    for (const r of [answerRes, qpiRes, esgRes]) if (r.error) throw r.error;
    answers = answerRes.data ?? []; qpiResults = qpiRes.data ?? []; esgPreferences = esgRes.data ?? [];
  }
  const templateById: Json = Object.fromEntries(templates.map((t: Json) => [t.id, t]));
  const optionMap = new Map(options.map((o: Json) => [o.id, o]));
  const recueilDates = links.map((x: Json) => x.recueil_validated_at).filter(Boolean).sort();
  const qpiDates = sessions.filter((s: Json) => templateById[s.template_id]?.type_questionnaire === 'QPI').map((s: Json) => s.completed_at ?? s.validated_at).filter(Boolean).sort();
  const esgDates = sessions.filter((s: Json) => templateById[s.template_id]?.type_questionnaire === 'ESG').map((s: Json) => s.completed_at ?? s.validated_at).filter(Boolean).sort();
  return { dossier: dossierRes.data, investors, sections: sectionRes.data ?? [], sessions, templates, templateById, questions, answers, options, optionMap, qpiResults, esgPreferences, recueil_date: recueilDates.at(-1) ?? dossierRes.data.updated_at, qpi_date: qpiDates.at(-1) ?? dossierRes.data.updated_at, esg_date: esgDates.at(-1) ?? dossierRes.data.updated_at };
}

function validateReady(snapshot: Json, type: DocumentType) {
  if (type === 'recueil' && snapshot.investors.some((i: Json) => !['completed', 'validated'].includes(i.recueil_status))) throw new Error('Le recueil doit être terminé pour tous les investisseurs avant génération du document à signer.');
  if (type === 'qpi' && snapshot.investors.some((i: Json) => !['completed', 'validated'].includes(i.qpi_status))) throw new Error('Le profil investisseur doit être terminé pour tous les investisseurs avant génération.');
  if (type === 'esg' && snapshot.investors.some((i: Json) => !['completed', 'validated', 'not_applicable'].includes(i.esg_status))) throw new Error('Le choix ESG doit être finalisé pour tous les investisseurs avant génération.');
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405, headers });
  if (origin && !allowedOrigins.has(origin)) return new Response(JSON.stringify({ error: 'Origine non autorisée' }), { status: 403, headers });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Authentification requise' }), { status: 401, headers });
    const supabaseUrl = Deno.env.get('SUPABASE_URL'); const anonKey = Deno.env.get('SUPABASE_ANON_KEY'); const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) throw new Error('Configuration Supabase incomplète');
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: appUser, error: userError } = await userClient.from('app_users').select('role,actif').maybeSingle();
    if (userError) throw userError;
    if (!appUser?.actif || !['cif', 'admin'].includes(appUser.role)) return new Response(JSON.stringify({ error: 'Accès réservé au cabinet' }), { status: 403, headers });
    const payload = await req.json();
    const dossierId = typeof payload?.dossier_id === 'string' ? payload.dossier_id : '';
    if (!/^[0-9a-f-]{36}$/i.test(dossierId)) return new Response(JSON.stringify({ error: 'Dossier invalide' }), { status: 400, headers });
    const requested = Array.isArray(payload?.document_types) ? payload.document_types : ['recueil', 'qpi', 'esg'];
    const types = requested.filter((x: string): x is DocumentType => ['recueil', 'qpi', 'esg'].includes(x));
    if (!types.length) return new Response(JSON.stringify({ error: 'Aucun type de document demandé' }), { status: 400, headers });
    const snapshot = await loadSnapshot(userClient, dossierId);
    for (const type of types) validateReady(snapshot, type);
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const results = [];
    for (const type of types) {
      const snapshotHash = await sha256Hex(JSON.stringify({ type, version: DOC_VERSION, dossier: snapshot.dossier, investors: snapshot.investors, sections: snapshot.sections, sessions: snapshot.sessions, qpi: snapshot.qpiResults, esg: snapshot.esgPreferences, answers: snapshot.answers }));
      const { data: existing } = await admin.from('documents_reglementaires').select('id,storage_bucket,storage_path_docx,statut,metadata,date_generation').eq('dossier_id', dossierId).eq('type_document', type).eq('version_modele', DOC_VERSION).eq('metadata->>snapshot_hash', snapshotHash).eq('statut', 'generated').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (existing?.storage_path_docx) { const { data: signed } = await admin.storage.from(existing.storage_bucket ?? BUCKET).createSignedUrl(existing.storage_path_docx, 3600); results.push({ type, document_id: existing.id, reused: true, signed_url: signed?.signedUrl ?? null, path: existing.storage_path_docx }); continue; }
      const doc = type === 'recueil' ? buildRecueil(snapshot) : buildQuestionnaire(snapshot, type === 'qpi' ? 'QPI' : 'ESG');
      const buffer = await Packer.toBuffer(doc); const bytes = new Uint8Array(buffer); const fileHash = await sha256Hex(bytes);
      const datePart = new Date().toISOString().slice(0, 10); const reference = slug(snapshot.dossier.reference || snapshot.dossier.libelle || dossierId.slice(0, 8)); const fileName = `${type}-${reference}-${datePart}-${fileHash.slice(0, 10)}.docx`; const storagePath = `${dossierId}/${type}/${fileName}`;
      const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, bytes, { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', upsert: false }); if (uploadError) throw uploadError;
      const { data: row, error: insertError } = await admin.from('documents_reglementaires').insert({ dossier_id: dossierId, type_document: type, version_modele: DOC_VERSION, statut: 'generated', storage_bucket: BUCKET, storage_path_docx: storagePath, date_generation: new Date().toISOString(), hash_sha256: fileHash, metadata: { snapshot_hash: snapshotHash, generated_from: 'portal_supabase', signature_provider: 'youtrust', signature_status: 'ready_to_send', document_date: type === 'recueil' ? snapshot.recueil_date : type === 'qpi' ? snapshot.qpi_date : snapshot.esg_date, investor_ids: snapshot.investors.map((i: Json) => i.id) } }).select('id').single(); if (insertError) throw insertError;
      const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(storagePath, 3600); results.push({ type, document_id: row.id, reused: false, signed_url: signed?.signedUrl ?? null, path: storagePath, hash_sha256: fileHash });
    }
    return new Response(JSON.stringify({ ok: true, version: DOC_VERSION, documents: results }), { status: 200, headers });
  } catch (error) {
    console.error('generate-cif-documents', error);
    const message = error instanceof Error ? error.message : 'Génération impossible';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers });
  }
});
