import { createClient } from 'npm:@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'npm:pdf-lib@1.17.1';

const allowedOrigins = new Set([
  'https://eric-bellaiche.fr',
  'https://www.eric-bellaiche.fr',
  'http://localhost:5173',
]);

const PDF_VERSION = '2026-MAITRE-PDF-1.0';
const BUCKET = 'regulatory-docs';
const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 46;
const DARK = rgb(15 / 255, 23 / 255, 42 / 255);
const BLUE = rgb(30 / 255, 70 / 255, 122 / 255);
const GREEN = rgb(20 / 255, 83 / 255, 45 / 255);
const TEAL = rgb(15 / 255, 118 / 255, 110 / 255);
const LIGHT = rgb(248 / 255, 250 / 255, 252 / 255);
const BORDER = rgb(203 / 255, 213 / 255, 225 / 255);
const WHITE = rgb(1, 1, 1);

type Json = Record<string, any>;
type DocumentType = 'recueil' | 'qpi' | 'esg';

type PdfContext = {
  pdf: PDFDocument;
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
  y: number;
  pageNumber: number;
};

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

function clean(value: unknown, fallback = 'Non renseigne') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (Array.isArray(value)) return value.length ? value.map((x) => clean(x, '')).join(', ') : fallback;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u00A0/g, ' ');
}

function num(value: unknown) {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function eur(value: unknown) {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(num(value))} EUR`;
}

function pct(value: unknown) {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(num(value))} %`;
}

function frDate(value: unknown) {
  if (!value) return 'Non renseignee';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return clean(value);
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

function extractByCode(sections: Json[], investorId: string) {
  return Object.fromEntries(sections.filter((s) => s.investisseur_id === investorId).map((s) => [s.section_code, s.payload ?? {}]));
}

function investorName(inv: Json) {
  return `${clean(inv.prenom, '')} ${clean(inv.nom, '')}`.trim() || 'Investisseur';
}

function objectiveLabel(code: string) {
  const labels: Record<string, string> = {
    optimisation_fiscale: 'Optimiser sa fiscalite', achat_immobilier: 'Financer un achat immobilier', constitution_patrimoine: 'Se constituer un patrimoine', epargne_precaution: 'Se constituer une epargne de precaution', liquidites_court_terme: 'Placer des liquidites a court terme', revenus_complementaires: 'Obtenir des revenus complementaires', optimisation_rendement: 'Optimiser la rentabilite de ses placements', retraite: 'Preparer sa retraite', aide_enfants: 'Aider ses enfants', protection_conjoint: 'Proteger le conjoint survivant', protection_proches: 'Proteger ses proches', transmission: 'Preparer la transmission de son patrimoine', transmission_entreprise: 'Preparer la transmission de son entreprise', accidents_vie: 'Se premunir contre les accidents de la vie', autre: 'Autre objectif',
  };
  return labels[code] ?? code;
}

function wrap(font: PDFFont, value: string, size: number, width: number) {
  const words = clean(value).split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let line = words[0];
  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`;
    if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
    else { lines.push(line); line = word; }
  }
  lines.push(line);
  return lines;
}

async function newPdfContext() {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([A4.width, A4.height]);
  return { pdf, page, regular, bold, y: A4.height - MARGIN, pageNumber: 1 } as PdfContext;
}

function footer(ctx: PdfContext) {
  ctx.page.drawText(`Cabinet Eric Bellaiche - page ${ctx.pageNumber}`, { x: MARGIN, y: 20, size: 7, font: ctx.regular, color: rgb(0.45, 0.5, 0.6) });
}

function addPage(ctx: PdfContext) {
  footer(ctx);
  ctx.page = ctx.pdf.addPage([A4.width, A4.height]);
  ctx.pageNumber += 1;
  ctx.y = A4.height - MARGIN;
}

function ensure(ctx: PdfContext, height: number) {
  if (ctx.y - height < 44) addPage(ctx);
}

function drawText(ctx: PdfContext, value: string, options: Json = {}) {
  const size = options.size ?? 9.5;
  const font = options.bold ? ctx.bold : ctx.regular;
  const width = options.width ?? (A4.width - 2 * MARGIN);
  const x = options.x ?? MARGIN;
  const lineHeight = options.lineHeight ?? size * 1.28;
  const lines = wrap(font, clean(value), size, width);
  const height = lines.length * lineHeight + (options.after ?? 4);
  ensure(ctx, height);
  for (const line of lines) {
    ctx.page.drawText(line, { x, y: ctx.y - size, size, font, color: options.color ?? DARK });
    ctx.y -= lineHeight;
  }
  ctx.y -= options.after ?? 4;
}

function title(ctx: PdfContext, main: string, subtitle: string, dateLine: string) {
  drawText(ctx, 'CABINET ERIC BELLAICHE', { bold: true, size: 11, color: BLUE, after: 10 });
  drawText(ctx, main, { bold: true, size: 18, color: DARK, after: 6 });
  drawText(ctx, subtitle, { size: 9.5, color: TEAL, after: 6 });
  drawText(ctx, dateLine, { bold: true, size: 9, color: GREEN, after: 16 });
}

function heading(ctx: PdfContext, value: string, level = 1) {
  ensure(ctx, level === 1 ? 30 : 24);
  ctx.y -= level === 1 ? 5 : 2;
  drawText(ctx, value, { bold: true, size: level === 1 ? 12.5 : 10.5, color: BLUE, after: 7 });
}

function drawTable(ctx: PdfContext, headers: string[], rows: string[][], widths?: number[]) {
  const available = A4.width - 2 * MARGIN;
  const fractions = widths?.map((w) => w / widths.reduce((a, b) => a + b, 0)) ?? headers.map(() => 1 / headers.length);
  const colWidths = fractions.map((f) => available * f);
  const padding = 4;
  const fontSize = headers.length >= 6 ? 6.8 : headers.length >= 4 ? 7.5 : 8.2;
  const lineHeight = fontSize * 1.25;

  const renderRow = (values: string[], isHeader: boolean) => {
    const font = isHeader ? ctx.bold : ctx.regular;
    const wrapped = values.map((v, i) => wrap(font, clean(v), fontSize, colWidths[i] - padding * 2));
    const maxLines = Math.max(...wrapped.map((x) => x.length), 1);
    const rowHeight = Math.max(18, maxLines * lineHeight + padding * 2);
    ensure(ctx, rowHeight + 1);
    let x = MARGIN;
    for (let i = 0; i < values.length; i++) {
      ctx.page.drawRectangle({ x, y: ctx.y - rowHeight, width: colWidths[i], height: rowHeight, borderWidth: 0.6, borderColor: BORDER, color: isHeader ? DARK : WHITE });
      let ty = ctx.y - padding - fontSize;
      for (const line of wrapped[i]) {
        ctx.page.drawText(line, { x: x + padding, y: ty, size: fontSize, font, color: isHeader ? WHITE : DARK });
        ty -= lineHeight;
      }
      x += colWidths[i];
    }
    ctx.y -= rowHeight;
  };

  renderRow(headers, true);
  for (const row of rows) {
    if (ctx.y < 90) {
      addPage(ctx);
      renderRow(headers, true);
    }
    renderRow(row, false);
  }
  ctx.y -= 9;
}

function signatureBoxes(ctx: PdfContext, investors: Json[]) {
  const boxes = [...investors.map((inv) => ({ name: investorName(inv), color: BLUE })), { name: 'Eric Bellaiche', color: GREEN }];
  const gap = 8;
  const width = (A4.width - 2 * MARGIN - gap * (boxes.length - 1)) / boxes.length;
  const height = 92;
  ensure(ctx, height + 10);
  let x = MARGIN;
  for (const box of boxes) {
    ctx.page.drawRectangle({ x, y: ctx.y - height, width, height, borderWidth: 1, borderColor: box.color, color: WHITE });
    ctx.page.drawText(clean(box.name), { x: x + 7, y: ctx.y - 16, size: 8, font: ctx.bold, color: box.color });
    ctx.page.drawText('Fait a : __________________', { x: x + 7, y: ctx.y - 32, size: 7, font: ctx.regular, color: DARK });
    ctx.page.drawText('Date : ___________________', { x: x + 7, y: ctx.y - 47, size: 7, font: ctx.regular, color: DARK });
    ctx.page.drawText('Signature :', { x: x + 7, y: ctx.y - 64, size: 7, font: ctx.bold, color: DARK });
    x += width + gap;
  }
  ctx.y -= height + 10;
}

function answerValue(answer: Json, optionMap: Map<string, Json>) {
  if (answer.option_id && optionMap.has(answer.option_id)) return clean(optionMap.get(answer.option_id)?.libelle);
  if (answer.answer_text) return clean(answer.answer_text);
  if (answer.answer_numeric !== null && answer.answer_numeric !== undefined) return clean(answer.answer_numeric);
  if (answer.answer_date) return frDate(answer.answer_date);
  if (answer.answer_json && Object.keys(answer.answer_json).length) return clean(answer.answer_json);
  return 'Non renseigne';
}

async function buildRecueil(snapshot: Json) {
  const ctx = await newPdfContext();
  const dossier = snapshot.dossier;
  const investors = snapshot.investors;
  const sections = snapshot.sections;
  const maps = investors.map((inv: Json) => ({ inv, map: extractByCode(sections, inv.id) }));
  title(ctx, "RECUEIL D'INFORMATIONS PATRIMONIALES", 'Document final PDF destine a la validation et a la signature electronique via Youtrust', `Date du recueil : ${frDate(snapshot.recueil_date)} - Date d'entree en relation : ${frDate(dossier.date_entree_relation)}`);

  let n = 1;
  const properties: Json[] = [];
  const credits: Json[] = [];
  let incomeAnnual = 0;
  let financialExact = 0;

  for (const { inv, map } of maps) {
    const id = map.identity ?? {};
    heading(ctx, `${n++}. Identite et coordonnees - ${investorName(inv)}`);
    drawTable(ctx, ['Donnee', 'Valeur'], [
      ['Civilite', clean(id.civilite ?? inv.civilite)], ['Prenom', clean(id.prenom ?? inv.prenom)], ['Nom', clean(id.nom ?? inv.nom)], ['Nom de naissance', clean(id.nom_naissance ?? inv.nom_naissance)], ['Date de naissance', frDate(id.date_naissance ?? inv.date_naissance)], ['Lieu / pays de naissance', `${clean(id.lieu_naissance ?? inv.lieu_naissance)} / ${clean(id.pays_naissance ?? inv.pays_naissance)}`], ['Nationalite', clean(id.nationalite ?? inv.nationalite)], ['Mobile', clean(id.mobile ?? inv.mobile)], ['E-mail', clean(inv.email)], ['Numero fiscal', clean(id.numero_fiscal ?? inv.numero_fiscal)], ['Adresse', [id.address?.numero_voie, id.address?.complement, id.address?.code_postal, id.address?.ville, id.address?.pays].filter(Boolean).join(' ') || 'Non renseignee'],
    ], [34, 66]);

    const fam = map.family ?? {};
    heading(ctx, `${n++}. Situation familiale`);
    drawTable(ctx, ['Donnee', 'Valeur'], [['Situation familiale', clean(fam.situation)], ['Date de l evenement', frDate(fam.date_evenement)], ['Regime / convention', clean(fam.regime_convention)], ['Avantage / clause particuliere', clean(fam.avantage_matrimonial)], ['Evolution prevue', clean(fam.evolution_prevue)], ['Notaire', clean(fam.notaire_nom_ville)], ['Expert-comptable', clean(fam.expert_comptable_nom_ville)], ['Nombre d enfants', clean(fam.nombre_enfants, '0')], ['Commentaires', clean(fam.commentaires)]], [34, 66]);

    const pro = map.professional ?? {};
    heading(ctx, `${n++}. Situation professionnelle`);
    drawTable(ctx, ['Donnee', 'Valeur'], [['Profession', clean(pro.profession_actuelle)], ['Societe / employeur', clean(pro.societe)], ['Secteur', clean(pro.secteur_activite)], ['Statut', clean(pro.statut)], ['Date d entree', frDate(pro.date_entree)], ['Anciennete declaree', clean(pro.anciennete_annees)], ['Changement prevu', clean(pro.changement_professionnel_prevu)], ['Details', clean(pro.changement_professionnel_details)]], [34, 66]);

    const objs = map.objectives?.items ?? [];
    heading(ctx, `${n++}. Objectifs et horizons`);
    drawTable(ctx, ['Priorite', 'Objectif', 'Horizon'], objs.length ? objs.map((o: Json, idx: number) => [String(idx + 1), o.code_objectif === 'autre' ? clean(o.libelle_autre) : objectiveLabel(clean(o.code_objectif, '')), clean(o.horizon_annees)]) : [['-', 'Aucun objectif renseigne', '-']], [12, 62, 26]);

    const cap = map.capacity ?? {};
    incomeAnnual += num(cap.estimation_revenus_travail_annuels) + num(cap.estimation_revenus_fonciers_annuels);
    heading(ctx, `${n++}. Revenus et equilibre financier`);
    drawTable(ctx, ['Donnee', 'Valeur'], [['Revenus professionnels nets estimes - annee en cours', eur(cap.estimation_revenus_travail_annuels)], ['Revenus immobiliers estimes - annee en cours', eur(cap.estimation_revenus_fonciers_annuels)], ['Capacite d epargne mensuelle', eur(cap.capacite_epargne_mensuelle)], ['Reserve de securite souhaitee', eur(cap.epargne_precaution_cible)], ['Apport immobilier mobilisable', eur(cap.apport_immobilier_possible)]], [58, 42]);

    const tax = map.tax ?? {};
    heading(ctx, `${n++}. Situation fiscale`);
    drawTable(ctx, ['Donnee fiscale', 'Valeur'], [['Annee d imposition', clean(tax.annee_imposition)], ['Revenu imposable', eur(tax.revenu_imposable)], ['Revenu fiscal de reference', eur(tax.revenu_fiscal_reference)], ['Nombre de parts', clean(tax.nombre_parts)], ['TMI', pct(tax.tmi)], ['Impot sur le revenu net', eur(tax.impot_revenu_net)], ['Salaires / assimiles', eur(tax.salaires_assimiles)], ['Revenus fonciers nets', eur(tax.revenus_fonciers_nets)], ['Deficit foncier reportable', eur(tax.deficit_foncier_reportable)], ['Plafond epargne retraite disponible', eur(tax.plafond_disponible_avis)], ['Versements retraite a deduire', eur(tax.versements_a_deduire)]], [58, 42]);
    if (tax.ifi_concerne === true) {
      heading(ctx, 'IFI', 2);
      drawTable(ctx, ['Donnee IFI', 'Valeur'], [['Base imposable IFI', eur(tax.ifi_base_imposable)], ['TMI IFI', pct(tax.ifi_tmi)], ['IFI net a payer', eur(tax.ifi_net_a_payer)]], [58, 42]);
    }

    if (map.patrimony?.has_real_estate === true) properties.push(...(map.patrimony?.immobilier ?? []));
    if (map.credits?.has_credits === true) credits.push(...(map.credits?.items ?? []));
    const placements = map.financial?.items ?? map.patrimony?.placements ?? [];
    financialExact += placements.reduce((sum: number, x: Json) => sum + num(x.montant ?? x.valeur ?? x.encours), 0);
  }

  heading(ctx, `${n++}. Patrimoine immobilier consolide`);
  drawTable(ctx, ['Bien', 'Ville', 'Usage', 'Detention', 'Proprietaire', 'Valeur'], properties.length ? properties.map((x, idx) => [`Bien ${idx + 1}`, clean(x.ville), clean(x.usage), clean(x.mode_detention), clean(x.proprietaire), eur(x.valeur_actuelle)]) : [['-', '-', 'Aucun bien declare', '-', '-', '0 EUR']], [10, 18, 18, 18, 18, 18]);

  heading(ctx, `${n++}. Patrimoine financier et liquidites`);
  for (const { inv, map } of maps) {
    const fin = map.financial ?? {};
    drawText(ctx, investorName(inv), { bold: true, size: 9.5, color: BLUE, after: 5 });
    drawTable(ctx, ['Donnee', 'Valeur'], [['Liquidites importantes volontairement conservees sur comptes courants', clean(fin.current_accounts_intentional)], ['Categories de placements', clean(fin.categories)], ['Fourchette de patrimoine financier', clean(fin.total_band)], ['Autres placements / precisions', clean(fin.other_details)], ['Completude confirmee', clean(fin.completeness_confirmed)]], [58, 42]);
  }

  const crdTotal = credits.reduce((sum, x) => sum + num(x.crd ?? x.capital_restant_du), 0);
  const monthlyDebt = credits.reduce((sum, x) => sum + num(x.mensualite), 0);
  const monthlyIncome = incomeAnnual / 12;
  const debtRatio = monthlyIncome > 0 ? monthlyDebt / monthlyIncome * 100 : null;
  const margin35 = monthlyIncome > 0 ? monthlyIncome * 0.35 - monthlyDebt : null;
  const propertyTotal = properties.reduce((sum, x) => sum + num(x.valeur_actuelle), 0);

  heading(ctx, `${n++}. Credits et endettement`);
  drawTable(ctx, ['Credit', 'Type', 'Banque', 'Montant initial', 'CRD', 'Mensualite', 'Taux', 'Echeance'], credits.length ? credits.map((x, idx) => [`Credit ${idx + 1}`, clean(x.type_credit ?? x.type_pret), clean(x.banque), eur(x.montant_initial), eur(x.crd ?? x.capital_restant_du), eur(x.mensualite), pct(x.taux), frDate(x.date_echeance)]) : [['-', 'Aucun credit declare', '-', '0 EUR', '0 EUR', '0 EUR', '-', '-']], [9, 14, 18, 14, 13, 12, 9, 11]);
  drawTable(ctx, ['Ratio', 'Resultat'], [['Revenus annuels consolides', eur(incomeAnnual)], ['Mensualites de credits', eur(monthlyDebt)], ['Taux d endettement', debtRatio === null ? 'Non calculable' : pct(debtRatio)], ['Marge mensuelle theorique a 35 %', margin35 === null ? 'Non calculable' : eur(margin35)], ['Patrimoine immobilier brut', eur(propertyTotal)], ['Patrimoine financier exact disponible', financialExact > 0 ? eur(financialExact) : 'Non consolide en montant exact'], ['CRD total', eur(crdTotal)], ['Patrimoine net calculable', financialExact > 0 ? eur(propertyTotal + financialExact - crdTotal) : `${eur(propertyTotal - crdTotal)} hors patrimoine financier non chiffre`]], [64, 36]);
  drawText(ctx, 'Limite de calcul : le taux d endettement et la marge a 35 % sont des indicateurs theoriques. Ils ne constituent ni un accord bancaire ni une capacite d emprunt garantie.', { bold: true, color: GREEN, size: 8.4, after: 12 });

  heading(ctx, `${n++}. Informations reglementaires`);
  for (const { inv, map } of maps) {
    const reg = map.regulatory ?? {};
    drawText(ctx, investorName(inv), { bold: true, size: 9.5, color: BLUE, after: 5 });
    drawTable(ctx, ['Question / information', 'Reponse'], [['Pays de residence fiscale', clean(reg.pays_residence_fiscale)], ['Citoyen ou resident fiscal americain', clean(reg.citoyen_ou_resident_us)], ['TIN americain', clean(reg.code_tin)], ['Sanctions internationales / gel des avoirs', clean(reg.sanctions_declarees)], ['PPE - client ou proche', clean(reg.ppe_declaree)], ['Personne exposee', clean(reg.ppe_personne_exposee)], ['Fonction PPE', clean(reg.ppe_motif)], ['Pays d exercice PPE', clean(reg.ppe_pays_exercice)], ['Periode PPE', clean(reg.ppe_anciennete)], ['Souhaite prendre en compte des criteres ESG', clean(reg.esg_opt_in)]], [62, 38]);
  }

  heading(ctx, `${n++}. Validation des informations`);
  drawText(ctx, 'En signant, les clients confirment avoir relu les informations reproduites dans le present recueil et declarent qu elles sont, a leur connaissance, exactes, sinceres et completes a la date du recueil. Les elements signales comme non renseignes ou a confirmer devront etre completes avant toute recommandation qui en depend.', { size: 8.6 });
  drawText(ctx, 'Portee de la signature : la signature du recueil ne vaut ni recommandation d investissement, ni offre de financement, ni engagement de souscription.', { bold: true, color: GREEN, size: 8.6, after: 12 });
  signatureBoxes(ctx, investors);
  footer(ctx);
  return new Uint8Array(await ctx.pdf.save({ useObjectStreams: false }));
}

async function buildQuestionnaire(snapshot: Json, type: 'QPI' | 'ESG') {
  const ctx = await newPdfContext();
  const dossier = snapshot.dossier;
  const investors = snapshot.investors;
  const sessions = snapshot.sessions.filter((s: Json) => snapshot.templateById[s.template_id]?.type_questionnaire === type);
  const titleText = type === 'QPI' ? 'PROFIL INVESTISSEUR' : 'QUESTIONNAIRE ESG / PREFERENCES DE DURABILITE';
  const dateValue = type === 'QPI' ? snapshot.qpi_date : snapshot.esg_date;
  title(ctx, titleText, 'Document final PDF destine a la validation et a la signature electronique via Youtrust', `Date de l evaluation : ${frDate(dateValue)} - Date d entree en relation : ${frDate(dossier.date_entree_relation)}`);

  for (const inv of investors) {
    const session = sessions.find((s: Json) => s.investisseur_id === inv.id);
    heading(ctx, `${investorName(inv)} - ${type === 'QPI' ? 'profil investisseur' : 'preferences ESG'}`);
    if (!session) {
      if (type === 'ESG' && inv.esg_status === 'not_applicable') drawText(ctx, 'Aucune preference ESG detaillee : questionnaire non applicable selon le choix du client.', { bold: true, color: GREEN });
      else drawText(ctx, 'Questionnaire non disponible pour cet investisseur.', { color: rgb(0.7, 0.3, 0.05) });
      continue;
    }
    const template = snapshot.templateById[session.template_id];
    drawText(ctx, `${clean(template?.libelle)} - version ${clean(template?.version)}`, { bold: true, color: BLUE, size: 9.2 });
    if (type === 'QPI') {
      const result = snapshot.qpiResults.find((r: Json) => r.session_id === session.id);
      if (result) drawTable(ctx, ['Indicateur', 'Resultat'], [['Score de tolerance', `${clean(result.score_tolerance)} / ${clean(result.score_max)}`], ['Profil indicatif', clean(result.profil_indicatif)], ['Profil operationnel final', clean(result.profil_operationnel_final)], ['Niveau retenu', clean(result.niveau_tolerance_retenu)], ['Perte maximale declaree', `${eur(result.perte_max_declairee_montant)} / ${pct(result.perte_max_declairee_pct)}`], ['Capacite de perte retenue', `${eur(result.capacite_perte_retenue_montant)} / ${pct(result.capacite_perte_retenue_pct)}`], ['Ecart declare / objective', clean(result.ecart_declared_objective)], ['Justification', clean(result.justification_ecart)]], [56, 44]);
    } else {
      const pref = snapshot.esgPreferences.find((r: Json) => r.session_id === session.id);
      if (pref) drawTable(ctx, ['Theme', 'Preference'], [['Perimetre', clean(pref.perimetre)], ['Taxonomie - choix', clean(pref.taxonomie_choix)], ['Taxonomie - minimum', pct(pref.taxonomie_min_pct)], ['Objectifs taxonomie', clean(pref.taxonomie_objectifs)], ['SFDR - choix', clean(pref.sfdr_choix)], ['SFDR - minimum', pct(pref.sfdr_min_pct)], ['Thematiques durables', clean(pref.sfdr_thematiques)], ['PAI - choix', clean(pref.pai_choix)], ['Priorites PAI', clean(pref.pai_priorites)], ['Exclusions sectorielles', clean(pref.exclusions_sectorielles)], ['Limitations sectorielles', clean(pref.limitations_sectorielles)], ['Besoins specifiques', clean(pref.besoins_specifiques)], ['Synthese reglementaire', clean(pref.synthese_reglementaire)]], [44, 56]);
    }

    const questions = snapshot.questions.filter((q: Json) => q.template_id === session.template_id).sort((a: Json, b: Json) => a.ordre - b.ordre);
    const answers = snapshot.answers.filter((a: Json) => a.session_id === session.id);
    const answerByQuestion = new Map(answers.map((a: Json) => [a.question_id, a]));
    heading(ctx, 'Detail reglementaire du questionnaire', 2);
    drawTable(ctx, ['N', 'Question', 'Reponse', 'Points'], questions.map((q: Json) => {
      const a = answerByQuestion.get(q.id) ?? {};
      return [String(q.ordre), clean(q.libelle), answerValue(a, snapshot.optionMap), a.points_awarded === null || a.points_awarded === undefined ? '-' : clean(a.points_awarded)];
    }), [7, 52, 31, 10]);
  }

  heading(ctx, 'Validation et signatures');
  drawText(ctx, type === 'QPI' ? 'En signant, les clients confirment avoir pris connaissance des reponses reproduites, du resultat du profil et des eventuelles limites de capacite de perte.' : 'En signant, les clients confirment que les preferences de durabilite reproduites correspondent a leurs reponses a la date du questionnaire.', { size: 8.6, after: 12 });
  signatureBoxes(ctx, investors);
  footer(ctx);
  return new Uint8Array(await ctx.pdf.save({ useObjectStreams: false }));
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
    const templateRes = await client.from('questionnaire_templates').select('*').in('id', templateIds);
    if (templateRes.error) throw templateRes.error;
    templates = templateRes.data ?? [];
    const questionRes = await client.from('questionnaire_questions').select('*').in('template_id', templateIds);
    if (questionRes.error) throw questionRes.error;
    questions = questionRes.data ?? [];
    const questionIds = questions.map((q: Json) => q.id);
    if (questionIds.length) {
      const optionRes = await client.from('questionnaire_options').select('*').in('question_id', questionIds);
      if (optionRes.error) throw optionRes.error;
      options = optionRes.data ?? [];
    }
  }
  const sessionIds = sessions.map((s: Json) => s.id);
  if (sessionIds.length) {
    const [answerRes, qpiRes, esgRes] = await Promise.all([
      client.from('questionnaire_answers').select('*').in('session_id', sessionIds),
      client.from('qpi_results').select('*').in('session_id', sessionIds),
      client.from('esg_preferences').select('*').in('session_id', sessionIds),
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
  if (type === 'recueil') {
    const invalid = snapshot.investors.filter((i: Json) => !['completed', 'validated'].includes(i.recueil_status));
    if (invalid.length) throw new Error('Le recueil doit etre termine pour tous les investisseurs avant generation du PDF.');
  }
  if (type === 'qpi') {
    const invalid = snapshot.investors.filter((i: Json) => !['completed', 'validated'].includes(i.qpi_status));
    if (invalid.length) throw new Error('Le profil investisseur doit etre termine pour tous les investisseurs avant generation du PDF.');
  }
  if (type === 'esg') {
    const invalid = snapshot.investors.filter((i: Json) => !['completed', 'validated', 'not_applicable'].includes(i.esg_status));
    if (invalid.length) throw new Error('Le choix ESG doit etre finalise pour tous les investisseurs avant generation du PDF.');
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Methode non autorisee' }), { status: 405, headers });
  if (origin && !allowedOrigins.has(origin)) return new Response(JSON.stringify({ error: 'Origine non autorisee' }), { status: 403, headers });

  try {
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Authentification requise' }), { status: 401, headers });
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) throw new Error('Configuration Supabase incomplete');

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: appUser, error: userError } = await userClient.from('app_users').select('role,actif').maybeSingle();
    if (userError) throw userError;
    if (!appUser?.actif || !['cif', 'admin'].includes(appUser.role)) return new Response(JSON.stringify({ error: 'Acces reserve au cabinet' }), { status: 403, headers });

    const payload = await req.json();
    const dossierId = typeof payload?.dossier_id === 'string' ? payload.dossier_id : '';
    if (!/^[0-9a-f-]{36}$/i.test(dossierId)) return new Response(JSON.stringify({ error: 'Dossier invalide' }), { status: 400, headers });
    const requested = Array.isArray(payload?.document_types) ? payload.document_types : ['recueil', 'qpi', 'esg'];
    const types = requested.filter((x: string): x is DocumentType => ['recueil', 'qpi', 'esg'].includes(x));
    if (!types.length) return new Response(JSON.stringify({ error: 'Aucun type de document demande' }), { status: 400, headers });

    const snapshot = await loadSnapshot(userClient, dossierId);
    for (const type of types) validateReady(snapshot, type);
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const results: Json[] = [];

    for (const type of types) {
      const snapshotHash = await sha256Hex(JSON.stringify({ type, version: PDF_VERSION, dossier: snapshot.dossier, investors: snapshot.investors, sections: snapshot.sections, sessions: snapshot.sessions, qpi: snapshot.qpiResults, esg: snapshot.esgPreferences, answers: snapshot.answers }));
      const { data: existing } = await admin.from('documents_reglementaires').select('id,storage_bucket,storage_path_pdf,metadata,date_generation').eq('dossier_id', dossierId).eq('type_document', type).eq('version_modele', PDF_VERSION).eq('metadata->>snapshot_hash', snapshotHash).eq('statut', 'generated').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (existing?.storage_path_pdf) {
        const { data: signed } = await admin.storage.from(existing.storage_bucket ?? BUCKET).createSignedUrl(existing.storage_path_pdf, 3600);
        results.push({ type, format: 'pdf', document_id: existing.id, reused: true, signed_url: signed?.signedUrl ?? null, path: existing.storage_path_pdf });
        continue;
      }

      const bytes = type === 'recueil' ? await buildRecueil(snapshot) : await buildQuestionnaire(snapshot, type === 'qpi' ? 'QPI' : 'ESG');
      const fileHash = await sha256Hex(bytes);
      const datePart = new Date().toISOString().slice(0, 10);
      const reference = slug(snapshot.dossier.reference || snapshot.dossier.libelle || dossierId.slice(0, 8));
      const fileName = `${type}-${reference}-${datePart}-${fileHash.slice(0, 10)}.pdf`;
      const storagePath = `${dossierId}/${type}/${fileName}`;
      const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, bytes, { contentType: 'application/pdf', upsert: false });
      if (uploadError) throw uploadError;
      const { data: row, error: insertError } = await admin.from('documents_reglementaires').insert({
        dossier_id: dossierId,
        type_document: type,
        version_modele: PDF_VERSION,
        statut: 'generated',
        storage_bucket: BUCKET,
        storage_path_pdf: storagePath,
        date_generation: new Date().toISOString(),
        hash_sha256: fileHash,
        metadata: {
          snapshot_hash: snapshotHash,
          generated_from: 'portal_supabase_pdf',
          final_format: 'pdf',
          signature_provider: 'youtrust',
          signature_status: 'ready_to_send',
          document_date: type === 'recueil' ? snapshot.recueil_date : type === 'qpi' ? snapshot.qpi_date : snapshot.esg_date,
          investor_ids: snapshot.investors.map((i: Json) => i.id),
          source_word_generator: 'generate-cif-documents',
        },
      }).select('id').single();
      if (insertError) throw insertError;
      const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
      results.push({ type, format: 'pdf', document_id: row.id, reused: false, signed_url: signed?.signedUrl ?? null, path: storagePath, hash_sha256: fileHash });
    }

    return new Response(JSON.stringify({ ok: true, version: PDF_VERSION, format: 'pdf', documents: results }), { status: 200, headers });
  } catch (error) {
    console.error('generate-cif-pdfs', error);
    const message = error instanceof Error ? error.message : 'Generation PDF impossible';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers });
  }
});
