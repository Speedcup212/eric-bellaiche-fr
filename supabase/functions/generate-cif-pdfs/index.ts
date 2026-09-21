import { createClient } from 'npm:@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'npm:pdf-lib@1.17.1';
import { loadDerModel, loadMissionModel, type RegulatoryModelBlock } from './regulatory-models.ts';

const allowedOrigins = new Set([
  'https://eric-bellaiche.fr',
  'https://www.eric-bellaiche.fr',
  'http://localhost:5173',
]);

const PDF_VERSION = '2026-MAITRE-PDF-2.22-TITRES-PAGINATION';
const BUCKET = 'regulatory-docs';
const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 46;
const REG_MARGIN = 62;
const NAVY = rgb(31 / 255, 55 / 255, 85 / 255);
const BODY = rgb(43 / 255, 43 / 255, 43 / 255);
const MUTED = rgb(92 / 255, 101 / 255, 114 / 255);
const ZEBRA = rgb(247 / 255, 249 / 255, 252 / 255);
const BLUE = rgb(47 / 255, 94 / 255, 147 / 255);
const GREEN = rgb(20 / 255, 110 / 255, 75 / 255);
const TEAL = rgb(20 / 255, 120 / 255, 115 / 255);
const LIGHT_BLUE = rgb(240 / 255, 246 / 255, 252 / 255);
const BORDER = rgb(201 / 255, 215 / 255, 231 / 255);
const WHITE = rgb(1, 1, 1);

type Json = Record<string, any>;
type DocumentType = 'recueil' | 'qpi' | 'esg' | 'der' | 'mission';
type PdfContext = { pdf: PDFDocument; page: PDFPage; regular: PDFFont; bold: PDFFont; y: number; pageNumber: number; templateMode?: 'der' | 'mission' };

const ESG_LABELS: Record<string, string> = {
  allocation_globale: 'Tous les placements', allocation: 'Tous les placements', produit: 'Au cas par cas selon le placement', autre: 'Autre choix',
  oui: 'Oui', non: 'Non', indetermine: 'Je ne sais pas encore',
  EAU: 'Protection de l’eau et des ressources marines', CLIMAT: 'Climat', CIRCULAIRE: 'Économie circulaire', POLLUTION: 'Prévention de la pollution et biodiversité',
  SOCIAL: 'Enjeux sociaux et droits humains', ENVIRONNEMENT: 'Environnement et climat', GOUVERNANCE: 'Gouvernance responsable',
  GES: 'Émissions de gaz à effet de serre', BIODIVERSITE: 'Biodiversité, eau et déchets', AUCUNE: 'Aucune priorité particulière',
  EXCLUSION: 'Éviter les entreprises les plus concernées', SEUIL: 'Fixer des limites précises', ENGAGEMENT: 'Privilégier les entreprises engagées dans une trajectoire de progrès',
  ARMES: 'Armes controversées', ARMES_CONVENTIONNELLES: 'Armes militaires conventionnelles', ARMES_NUCLEAIRES: 'Armes nucléaires', TABAC: 'Tabac', JEUX_HASARD: 'Jeux de hasard', DIVERTISSEMENTS_ADULTES: 'Divertissements pour adultes', CHARBON_THERMIQUE: 'Charbon thermique', FOSSILES: 'Énergies fossiles', HUILE_PALME: 'Huile de palme', PESTICIDES: 'Pesticides', EMBRYONS_HUMAINS: 'Recherche sur les embryons humains', ALCOOL: 'Alcool', OPIOIDES: 'Opioïdes', PRISONS_PRIVEES: 'Prisons privées', MATERIELS_RADIOACTIFS: 'Production ou extraction de matériels radioactifs', ESPECES_MENACEES: 'Trafic d’espèces animales menacées',
  RENDEMENT: 'Rendement potentiel différent', OFFRE: 'Univers de placements plus limité',
};


const QPI_EXPERIENCE_LABELS: Record<string, string> = {
  liquidites: 'Produits sécurisés, livrets et fonds euros',
  obligations: 'Obligations et fonds obligataires',
  actions: 'Actions, OPC, ETF et fonds diversifiés',
  immobilier_papier: 'SCPI, OPCI et fonds immobiliers',
  structures: 'Produits complexes, structurés et non cotés',
};

const QPI_KNOWLEDGE_LABELS: Record<string, string> = {
  Q13: 'Diversification',
  Q14: 'Couple rendement / risque',
  Q15: 'SCPI / immobilier non coté',
  Q16: 'Unités de compte assurance-vie / PER',
  Q17: 'Obligations',
};

function corsHeaders(origin: string | null) {
  const allowed = origin && allowedOrigins.has(origin) ? origin : 'https://eric-bellaiche.fr';
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Vary': 'Origin' };
}
function clean(value: unknown, fallback = 'Non renseigné') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (Array.isArray(value)) return value.length ? value.map((x) => clean(x, '')).join(', ') : fallback;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u2192/g, ' vers ')
    .replace(/\u2260/g, ' different de ')
    .replace(/\u2264/g, ' <= ')
    .replace(/\u2265/g, ' >= ')
    .replace(/\u2248/g, ' environ ')
    .replace(/\u2026/g, '...')
    .replace(/\u0152/g, 'OE')
    .replace(/\u0153/g, 'oe')
    .replace(/\u0178/g, 'Y')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x20-\x7E\u00A0-\u00FF\u20AC]/g, '?');
}
function hasValue(value: unknown) { return !(value === null || value === undefined || String(value).trim() === ''); }
function num(value: unknown) { const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; }
function frNumber(value: unknown) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })
    .format(num(value))
    .replace(/[\u00A0\u202F]/g, ' ');
}
function eur(value: unknown) { if (!hasValue(value)) return 'Non renseigné'; return `${frNumber(value)} EUR`; }
function pct(value: unknown) { if (!hasValue(value)) return 'Non renseigné'; return `${frNumber(value)} %`; }
function frDate(value: unknown) { if (!value) return 'Non renseignée'; const d = new Date(String(value)); if (Number.isNaN(d.getTime())) return clean(value); return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(d); }
function slug(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase(); }
function fileNamePart(value: unknown, fallback = 'Client') {
  const raw = clean(value, fallback).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return raw.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || fallback;
}
function regulatoryPdfFileName(type: 'der' | 'mission', snapshot: Json, datePart: string) {
  const parties = snapshot.investors.map((inv: Json) => fileNamePart(inv.nom || investorName(inv))).filter(Boolean).join('-') || 'Clients';
  return type === 'der'
    ? `DER_Eric-Bellaiche_${parties}_${datePart}.pdf`
    : `Lettre-de-mission_Eric-Bellaiche_${parties}_${datePart}.pdf`;
}
async function sha256Hex(data: Uint8Array | string) { const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data; const hash = await crypto.subtle.digest('SHA-256', bytes); return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join(''); }
function extractByCode(sections: Json[], investorId: string) { return Object.fromEntries(sections.filter((s) => s.investisseur_id === investorId).map((s) => [s.section_code, s.payload ?? {}])); }
function investorName(inv: Json) { return `${clean(inv.prenom, '')} ${clean(inv.nom, '')}`.trim() || 'Investisseur'; }
function objectiveLabel(code: string) { const labels: Record<string, string> = { optimisation_fiscale: 'Optimiser sa fiscalité', achat_immobilier: 'Financer un achat immobilier', constitution_patrimoine: 'Se constituer un patrimoine', epargne_precaution: 'Se constituer une épargne de précaution', liquidites_court_terme: 'Placer des liquidités à court terme', revenus_complementaires: 'Obtenir des revenus complémentaires', optimisation_rendement: 'Optimiser la rentabilité de ses placements', retraite: 'Préparer sa retraite', aide_enfants: 'Aider ses enfants', protection_conjoint: 'Protéger le conjoint survivant', protection_proches: 'Protéger ses proches', transmission: 'Préparer la transmission de son patrimoine', transmission_entreprise: 'Préparer la transmission de son entreprise', accidents_vie: 'Se prémunir contre les accidents de la vie', autre: 'Autre objectif' }; return labels[code] ?? code; }
function financialCategoryLabel(value: unknown) {
  const labels: Record<string,string> = {
    savings: 'Livrets / épargne disponible',
    retirement: 'PER / épargne retraite',
    employee_savings: 'PEE / épargne salariale',
    securities: 'Titres / bourse',
    life_insurance: 'Assurance-vie',
    crypto: 'Cryptoactifs',
    other: 'Autres placements',
  };
  if (!Array.isArray(value)) return clean(value);
  return value.length ? value.map((item) => labels[String(item)] ?? clean(item)).join(', ') : 'Non renseigné';
}
function financialBandLabel(value: unknown) {
  const labels: Record<string,string> = {
    under_10k: 'Moins de 10 000 EUR',
    '10k_50k': '10 000 à 50 000 EUR',
    '50k_100k': '50 000 à 100 000 EUR',
    '100k_250k': '100 000 à 250 000 EUR',
    '250k_500k': '250 000 à 500 000 EUR',
    over_500k: 'Plus de 500 000 EUR',
  };
  return labels[String(value ?? '')] ?? clean(value);
}
function monthYearLabel(value: unknown) {
  if (!hasValue(value)) return 'Non renseigné';
  const raw = String(value);
  if (/^\d{4}-\d{2}$/.test(raw)) {
    const parts = raw.split('-');
    const names = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    return `${names[Math.max(0, Math.min(11, Number(parts[1]) - 1))]} ${parts[0]}`;
  }
  return frDate(value);
}
function creditPaymentLabel(x: Json) {
  const current = hasValue(x.mensualite_actuelle) ? eur(x.mensualite_actuelle) : hasValue(x.mensualite) ? eur(x.mensualite) : 'Non renseigné';
  if (hasValue(x.mensualite_future)) return `${current} actuellement ; ${eur(x.mensualite_future)} dès ${monthYearLabel(x.mensualite_future_date)}`;
  return current;
}
function readable(value: unknown) { if (Array.isArray(value)) return value.map((v) => ESG_LABELS[String(v)] ?? clean(v)).join(', '); const s = clean(value); return ESG_LABELS[s] ?? ESG_LABELS[s.toLowerCase()] ?? s; }
function wrap(font: PDFFont, value: string, size: number, width: number) { const words = clean(value).split(/\s+/).filter(Boolean); if (!words.length) return ['']; const lines: string[] = []; let line = words[0]; for (const word of words.slice(1)) { const candidate = `${line} ${word}`; if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate; else { lines.push(line); line = word; } } lines.push(line); return lines; }
function drawTemplateHeader(ctx: PdfContext) {
  if (ctx.templateMode === 'der') {
    const left = 'CNCEF PATRIMOINE · Avril 2026';
    const right = 'Eric Bellaiche · CIF D016571 · ORIAS 13001580';
    ctx.page.drawText(clean(left), { x: REG_MARGIN, y: A4.height - 25, size: 6.6, font: ctx.bold, color: NAVY });
    const rightWidth = ctx.regular.widthOfTextAtSize(clean(right), 6.4);
    ctx.page.drawText(clean(right), { x: A4.width - REG_MARGIN - rightWidth, y: A4.height - 25, size: 6.4, font: ctx.regular, color: MUTED });
    ctx.page.drawLine({ start: { x: REG_MARGIN, y: A4.height - 35 }, end: { x: A4.width - REG_MARGIN, y: A4.height - 35 }, thickness: 0.45, color: BORDER });
    ctx.y = A4.height - 55;
    return;
  }
  if (ctx.templateMode === 'mission') {
    const lines = [
      'Eric Bellaiche · CIF D016571 · membre CNCEF Patrimoine agréée AMF · ORIAS 13001580',
      'RCS Grenoble 441861135 · 33 avenue de Savoie, 38580 Allevard · 06 52 56 56 54',
      'Toute modification pouvant affecter significativement la mission de conseil doit être portée à la connaissance du Conseiller.',
    ];
    let y = A4.height - 23;
    for (let i = 0; i < lines.length; i++) {
      ctx.page.drawText(clean(lines[i]), { x: REG_MARGIN, y, size: i === 0 ? 6.3 : 5.9, font: i === 0 ? ctx.bold : ctx.regular, color: i === 0 ? NAVY : MUTED });
      y -= 8;
    }
    ctx.page.drawLine({ start: { x: REG_MARGIN, y: A4.height - 49 }, end: { x: A4.width - REG_MARGIN, y: A4.height - 49 }, thickness: 0.45, color: BORDER });
    ctx.y = A4.height - 67;
  }
}
async function newPdfContext(templateMode?: 'der' | 'mission') {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([A4.width, A4.height]);
  const ctx = { pdf, page, regular, bold, y: A4.height - MARGIN, pageNumber: 1, templateMode } as PdfContext;
  if (templateMode) drawTemplateHeader(ctx);
  return ctx;
}
function footer(ctx: PdfContext) {
  if (ctx.templateMode) return;
  ctx.page.drawText(`Cabinet Eric Bellaiche - page ${ctx.pageNumber} - modèle ${PDF_VERSION}`, { x: MARGIN, y: 20, size: 7, font: ctx.regular, color: rgb(0.45, 0.5, 0.6) });
}
function addPage(ctx: PdfContext) {
  footer(ctx);
  ctx.page = ctx.pdf.addPage([A4.width, A4.height]);
  ctx.pageNumber += 1;
  ctx.y = A4.height - MARGIN;
  if (ctx.templateMode) drawTemplateHeader(ctx);
}
function ensure(ctx: PdfContext, height: number) { if (ctx.y - height < 44) addPage(ctx); }
function drawText(ctx: PdfContext, value: string, options: Json = {}) { const size = options.size ?? 9.5; const font = options.bold ? ctx.bold : ctx.regular; const width = options.width ?? (A4.width - 2 * MARGIN); const x = options.x ?? MARGIN; const lineHeight = options.lineHeight ?? size * 1.28; const lines = wrap(font, clean(value), size, width); const height = lines.length * lineHeight + (options.after ?? 4); ensure(ctx, height); for (const line of lines) { ctx.page.drawText(line, { x, y: ctx.y - size, size, font, color: options.color ?? NAVY }); ctx.y -= lineHeight; } ctx.y -= options.after ?? 4; }
function title(ctx: PdfContext, main: string, dateLine: string) { drawText(ctx, 'CABINET ERIC BELLAICHE', { bold: true, size: 11, color: BLUE, after: 10 }); drawText(ctx, main, { bold: true, size: 18, color: NAVY, after: 8 }); drawText(ctx, dateLine, { bold: true, size: 9, color: GREEN, after: 16 }); }
function heading(ctx: PdfContext, value: string, level = 1) { ensure(ctx, level === 1 ? 30 : 24); ctx.y -= level === 1 ? 5 : 2; drawText(ctx, value, { bold: true, size: level === 1 ? 12.5 : 10.5, color: BLUE, after: 7 }); }
function drawTable(ctx: PdfContext, headers: string[], rows: string[][], widths?: number[]) {
  const available = A4.width - 2 * MARGIN;
  const fractions = widths?.map((w) => w / widths.reduce((a, b) => a + b, 0)) ?? headers.map(() => 1 / headers.length);
  const colWidths = fractions.map((f) => available * f);
  const padding = 4;
  const fontSize = headers.length >= 6 ? 6.8 : headers.length >= 4 ? 7.5 : 8.2;
  const lineHeight = fontSize * 1.25;
  const measureRow = (values: string[], isHeader: boolean) => {
    const font = isHeader ? ctx.bold : ctx.regular;
    const wrapped = values.map((v, i) => wrap(font, clean(v), fontSize, colWidths[i] - padding * 2));
    const maxLines = Math.max(...wrapped.map((x) => x.length), 1);
    return { wrapped, rowHeight: Math.max(18, maxLines * lineHeight + padding * 2) };
  };
  const renderRow = (values: string[], isHeader: boolean) => {
    const font = isHeader ? ctx.bold : ctx.regular;
    const measured = measureRow(values, isHeader);
    const rowHeight = measured.rowHeight;
    let x = MARGIN;
    for (let i = 0; i < values.length; i++) {
      ctx.page.drawRectangle({ x, y: ctx.y - rowHeight, width: colWidths[i], height: rowHeight, borderWidth: 0.6, borderColor: BORDER, color: isHeader ? NAVY : WHITE });
      let ty = ctx.y - padding - fontSize;
      for (const line of measured.wrapped[i]) { ctx.page.drawText(line, { x: x + padding, y: ty, size: fontSize, font, color: isHeader ? WHITE : NAVY }); ty -= lineHeight; }
      x += colWidths[i];
    }
    ctx.y -= rowHeight;
  };

  const headerHeight = measureRow(headers, true).rowHeight;
  const firstRowHeight = rows.length ? measureRow(rows[0], false).rowHeight : 0;
  const secondRowHeight = rows.length > 1 ? measureRow(rows[1], false).rowHeight : 0;
  const minimumStartHeight = headerHeight + firstRowHeight + (rows.length > 1 ? Math.min(secondRowHeight, 24) : 0) + 10;
  ensure(ctx, minimumStartHeight);
  renderRow(headers, true);

  rows.forEach((row, index) => {
    const rowHeight = measureRow(row, false).rowHeight;
    const nextHeight = index + 1 < rows.length ? measureRow(rows[index + 1], false).rowHeight : 0;
    if (ctx.y - rowHeight < 52) {
      addPage(ctx);
      const continuationMinimum = headerHeight + rowHeight + (nextHeight ? Math.min(nextHeight, 24) : 0) + 8;
      ensure(ctx, continuationMinimum);
      renderRow(headers, true);
    }
    renderRow(row, false);
  });
  ctx.y -= 9;
}
function signatureBoxes(ctx: PdfContext, investors: Json[]) { const boxes = [...investors.map((inv) => ({ name: investorName(inv), color: BLUE })), { name: 'Eric Bellaiche', color: GREEN }]; const gap = 8; const width = (A4.width - 2 * MARGIN - gap * (boxes.length - 1)) / boxes.length; const height = 92; ensure(ctx, height + 10); let x = MARGIN; for (const box of boxes) { ctx.page.drawRectangle({ x, y: ctx.y - height, width, height, borderWidth: 1, borderColor: box.color, color: WHITE }); ctx.page.drawText(clean(box.name), { x: x + 7, y: ctx.y - 16, size: 8, font: ctx.bold, color: box.color }); ctx.page.drawText('Signature électronique', { x: x + 7, y: ctx.y - 35, size: 7.2, font: ctx.bold, color: NAVY }); ctx.page.drawText('Date et horodatage apposés', { x: x + 7, y: ctx.y - 50, size: 6.8, font: ctx.regular, color: NAVY }); ctx.page.drawText('par le prestataire de signature', { x: x + 7, y: ctx.y - 63, size: 6.8, font: ctx.regular, color: NAVY }); x += width + gap; } ctx.y -= height + 10; }
function answerValue(answer: Json, optionMap: Map<string, Json>) { if (answer.option_id && optionMap.has(answer.option_id)) return clean(optionMap.get(answer.option_id)?.libelle); if (answer.answer_text) return clean(answer.answer_text); if (answer.answer_numeric !== null && answer.answer_numeric !== undefined) return clean(answer.answer_numeric); if (answer.answer_date) return frDate(answer.answer_date); if (Array.isArray(answer.answer_json) && answer.answer_json.length) return readable(answer.answer_json); if (answer.answer_json && Object.keys(answer.answer_json).length) return readable(answer.answer_json); return 'Non renseigné'; }
function drawResultPanel(ctx: PdfContext, label: string, score: string, level: string, explanation: string, incidences: string, note: string) { const width = A4.width - 2 * MARGIN; const explanationLines = wrap(ctx.regular, explanation, 9, width - 28); const incidenceLines = wrap(ctx.regular, incidences, 9, width - 28); const noteLines = wrap(ctx.regular, note, 8, width - 28); const height = 100 + (explanationLines.length + incidenceLines.length) * 11.5 + noteLines.length * 10.5; ensure(ctx, height + 10); const top = ctx.y; ctx.page.drawRectangle({ x: MARGIN, y: top - height, width, height, color: LIGHT_BLUE, borderWidth: 1.2, borderColor: BLUE }); ctx.page.drawText(label, { x: MARGIN + 14, y: top - 20, size: 8.5, font: ctx.bold, color: BLUE }); ctx.page.drawText(score, { x: MARGIN + 14, y: top - 52, size: 25, font: ctx.bold, color: NAVY }); ctx.page.drawText(level, { x: MARGIN + 162, y: top - 47, size: 15, font: ctx.bold, color: GREEN }); let y = top - 73; ctx.page.drawText('INTERPRÉTATION', { x: MARGIN + 14, y, size: 7.5, font: ctx.bold, color: BLUE }); y -= 13; for (const line of explanationLines) { ctx.page.drawText(line, { x: MARGIN + 14, y, size: 9, font: ctx.regular, color: NAVY }); y -= 11.5; } y -= 4; ctx.page.drawText('INCIDENCES POUR LE CONSEIL', { x: MARGIN + 14, y, size: 7.5, font: ctx.bold, color: BLUE }); y -= 13; for (const line of incidenceLines) { ctx.page.drawText(line, { x: MARGIN + 14, y, size: 9, font: ctx.regular, color: NAVY }); y -= 11.5; } y -= 5; for (const line of noteLines) { ctx.page.drawText(line, { x: MARGIN + 14, y, size: 8, font: ctx.regular, color: rgb(0.28, 0.36, 0.46) }); y -= 10.5; } ctx.y = top - height - 12; }
function esgLevel(score: number) { if (score >= 75) return 'Très forte'; if (score >= 50) return 'Forte'; if (score >= 25) return 'Modérée'; return 'Faible'; }

async function buildRecueil(snapshot: Json) {
  const ctx = await newPdfContext(); const dossier = snapshot.dossier; const investors = snapshot.investors; const sections = snapshot.sections; const maps = investors.map((inv: Json) => ({ inv, map: extractByCode(sections, inv.id) }));
  const completionRows = Array.isArray(snapshot.recueilCompleteness) ? snapshot.recueilCompleteness : [];
  const completionPct = completionRows.length ? Math.round(completionRows.reduce((sum: number, row: Json) => sum + Number(row.percentage ?? 0), 0) / completionRows.length) : 0;
  const recueilComplete = completionRows.length > 0 && completionRows.every((row: Json) => row.complete === true);
  const recueilState = recueilComplete ? 'Recueil complet' : `DOCUMENT DE TRAVAIL - RECUEIL INCOMPLET (${completionPct} %)`;
  title(ctx, "RECUEIL D'INFORMATIONS PATRIMONIALES", `${recueilState} - Date du recueil : ${frDate(snapshot.recueil_date)} - Date d'entrée en relation : ${frDate(dossier.date_entree_relation)}`);
  let n = 1; const properties: Json[] = []; const credits: Json[] = []; let incomeAnnual = 0; let financialExact = 0; let financialEstimated = 0;
  for (const { inv, map } of maps) {
    const id = map.identity ?? {}; heading(ctx, `${n++}. Identité et coordonnées - ${investorName(inv)}`); drawTable(ctx, ['Donnée', 'Valeur'], [['Civilité', clean(id.civilite ?? inv.civilite)], ['Prénom', clean(id.prenom ?? inv.prenom)], ['Nom', clean(id.nom ?? inv.nom)], ['Nom de naissance', clean(id.nom_naissance ?? inv.nom_naissance)], ['Date de naissance', frDate(id.date_naissance ?? inv.date_naissance)], ['Lieu / pays de naissance', `${clean(id.lieu_naissance ?? inv.lieu_naissance)} / ${clean(id.pays_naissance ?? inv.pays_naissance)}`], ['Nationalité', clean(id.nationalite ?? inv.nationalite)], ['Mobile', clean(id.mobile ?? inv.mobile)], ['E-mail', clean(inv.email)], ['Numéro fiscal', clean(id.numero_fiscal ?? inv.numero_fiscal)], ['Adresse', [id.address?.numero_voie, id.address?.complement, id.address?.code_postal, id.address?.ville, id.address?.pays].filter(Boolean).join(' ') || 'Non renseignée']], [34, 66]);
    const fam = map.family ?? {}; heading(ctx, `${n++}. Situation familiale`); drawTable(ctx, ['Donnée', 'Valeur'], [['Situation familiale', clean(fam.situation)], ['Date de l’événement', frDate(fam.date_evenement)], ['Régime / convention', clean(fam.regime_convention)], ['Avantage / clause particulière', clean(fam.avantage_matrimonial)], ['Évolution prévue', clean(fam.evolution_prevue)], ['Notaire', clean(fam.notaire_nom_ville)], ['Expert-comptable', clean(fam.expert_comptable_nom_ville)], ['Nombre d’enfants', clean(fam.nombre_enfants, '0')], ['Commentaires', clean(fam.commentaires)]], [34, 66]);
    const pro = map.professional ?? {}; heading(ctx, `${n++}. Situation professionnelle`); drawTable(ctx, ['Donnée', 'Valeur'], [['Profession', clean(pro.profession_actuelle)], ['Société / employeur', clean(pro.societe)], ['Secteur', clean(pro.secteur_activite)], ['Statut', clean(pro.statut)], ['Date d’entrée', frDate(pro.date_entree)], ['Ancienneté déclarée', clean(pro.anciennete_annees)], ['Changement prévu', clean(pro.changement_professionnel_prevu)], ['Détails', clean(pro.changement_professionnel_details)]], [34, 66]);
    const objs = map.objectives?.items ?? []; heading(ctx, `${n++}. Objectifs et horizons`); drawTable(ctx, ['Priorité', 'Objectif', 'Horizon'], objs.length ? objs.map((o: Json, idx: number) => [String(idx + 1), o.code_objectif === 'autre' ? clean(o.libelle_autre) : objectiveLabel(clean(o.code_objectif, '')), clean(o.horizon_annees)]) : [['-', 'Aucun objectif renseigné', '-']], [12, 62, 26]);
    const cap = map.capacity ?? {}; incomeAnnual += num(cap.estimation_revenus_travail_annuels) + num(cap.estimation_revenus_fonciers_annuels); heading(ctx, `${n++}. Revenus et équilibre financier`); drawTable(ctx, ['Donnée', 'Valeur'], [['Revenus professionnels nets estimés - année en cours', eur(cap.estimation_revenus_travail_annuels)], ['Revenus immobiliers estimés - année en cours', eur(cap.estimation_revenus_fonciers_annuels)], ['Capacité d’épargne mensuelle', eur(cap.capacite_epargne_mensuelle)], ['Réserve de sécurité souhaitée', eur(cap.epargne_precaution_cible)], ['Apport immobilier mobilisable', eur(cap.apport_immobilier_possible)]], [58, 42]);
    const tax = map.tax ?? {}; heading(ctx, `${n++}. Situation fiscale détaillée`);
    const id1Name = clean(tax.nom_identifiant_1 ?? 'Identifiant 1');
    const id2Name = clean(tax.nom_identifiant_2 ?? 'Identifiant 2');
    const taxRows = (rows: Array<[string, unknown, 'eur' | 'pct' | 'date' | 'text']>) => rows.filter(([, value]) => hasValue(value)).map(([label, value, kind]) => [label, kind === 'eur' ? eur(value) : kind === 'pct' ? pct(value) : kind === 'date' ? frDate(value) : clean(value)]);
    const taxTable = (title: string, rows: Array<[string, unknown, 'eur' | 'pct' | 'date' | 'text']>) => { const filtered = taxRows(rows); if (filtered.length) { heading(ctx, title, 2); drawTable(ctx, ['Donnée fiscale', 'Valeur'], filtered, [62, 38]); } };

    taxTable('Identifiants fiscaux et avis', [
      ['Identifiant 1', id1Name, 'text'],
      [`Numéro fiscal - ${id1Name}`, tax.numero_fiscal_identifiant_1, 'text'],
      ['Identifiant 2', id2Name, 'text'],
      [`Numéro fiscal - ${id2Name}`, tax.numero_fiscal_identifiant_2, 'text'],
      ['Référence de l’avis', tax.reference_avis, 'text'],
      ['Référence du foyer fiscal', tax.reference_foyer, 'text'],
      ['Adresse fiscale', tax.adresse_fiscale, 'text'],
      ['Année d’imposition', tax.annee_imposition, 'text'],
      ['Date d’établissement de l’avis', tax.date_etablissement_avis, 'date'],
      ['Date de mise en recouvrement', tax.date_mise_en_recouvrement, 'date'],
      ['Centre des finances publiques', tax.centre_impots, 'text'],
      ['Nombre de parts', tax.nombre_parts, 'text'],
    ]);

    taxTable('Revenus déclarés', [
      [`Salaires - ${id1Name}`, tax.salaires_identifiant_1, 'eur'],
      [`Heures supplémentaires non exonérées - ${id1Name}`, tax.heures_supp_non_exonerees_identifiant_1, 'eur'],
      [`Total salaires - ${id1Name}`, tax.total_salaires_identifiant_1, 'eur'],
      [`Déduction 10 % / frais réels - ${id1Name}`, tax.deduction_10_identifiant_1, 'eur'],
      [`Salaires nets - ${id1Name}`, tax.salaires_nets_identifiant_1, 'eur'],
      [`Salaires - ${id2Name}`, tax.salaires_identifiant_2, 'eur'],
      [`Heures supplémentaires non exonérées - ${id2Name}`, tax.heures_supp_non_exonerees_identifiant_2, 'eur'],
      [`Total salaires - ${id2Name}`, tax.total_salaires_identifiant_2, 'eur'],
      [`Déduction 10 % / frais réels - ${id2Name}`, tax.deduction_10_identifiant_2, 'eur'],
      [`Salaires nets - ${id2Name}`, tax.salaires_nets_identifiant_2, 'eur'],
      ['Revenu brut global', tax.revenu_brut_global, 'eur'],
      ['CSG déductible du revenu global', tax.csg_deductible_revenu_global, 'eur'],
      ['Revenu imposable', tax.revenu_imposable, 'eur'],
      ['Revenus au taux forfaitaire', tax.revenus_taux_forfaitaire, 'eur'],
      ['Revenus fonciers nets', tax.revenus_fonciers_nets, 'eur'],
      ['Déficit foncier reportable', tax.deficit_foncier_reportable, 'eur'],
    ]);

    taxTable('Calcul de l’impôt sur le revenu', [
      ['Impôt sur les revenus soumis au barème', tax.impot_revenus_bareme, 'eur'],
      ['Décote', tax.decote, 'eur'],
      ['Impôt proportionnel', tax.impot_proportionnel, 'eur'],
      ['Impôt total avant crédits d’impôt', tax.impot_total_avant_credits, 'eur'],
      ['Impôt étranger déclaré', tax.impot_etranger_declare, 'eur'],
      ['Impôt étranger imputé sur l’IR', tax.impot_etranger_impute, 'eur'],
      ['Prélèvement forfaitaire déjà versé', tax.prelevement_forfaitaire_deja_verse, 'eur'],
      ['Frais de garde déclarés', tax.frais_garde_declares, 'eur'],
      ['Frais de garde retenus', tax.frais_garde_retenus, 'eur'],
      ['Crédit d’impôt calculé', tax.credit_impot_calcule, 'eur'],
      ['Impôt sur le revenu net', tax.impot_revenu_net, 'eur'],
    ]);

    taxTable('Prélèvements sociaux', [
      ['Revenus de capitaux mobiliers', tax.revenus_capitaux_mobiliers_ps, 'eur'],
      ['Plus-values et gains divers', tax.plus_values_gains_divers_ps, 'eur'],
      ['Base imposable aux prélèvements sociaux', tax.base_prelevements_sociaux, 'eur'],
      ['Taux CSG-CRDS', tax.taux_csg_crds, 'pct'],
      ['Montant CSG-CRDS', tax.montant_csg_crds, 'eur'],
      ['Taux prélèvement de solidarité', tax.taux_prelevement_solidarite, 'pct'],
      ['Montant prélèvement de solidarité', tax.montant_prelevement_solidarite, 'eur'],
      ['Total des prélèvements sociaux nets', tax.prelevements_sociaux_nets, 'eur'],
    ]);

    taxTable('Solde de l’impôt et remboursement', [
      ['Impôt sur le revenu 2025 dû', tax.ir_2025_du, 'eur'],
      ['Retenue à la source prélevée en 2025', tax.retenue_source_2025, 'eur'],
      ['Avance sur réductions et crédits d’impôt', tax.avance_reductions_credits_impot, 'eur'],
      ['Solde d’impôt sur les revenus 2025', tax.solde_ir_2025, 'eur'],
      ['Prélèvements sociaux sur revenus du patrimoine', tax.prelevements_sociaux_patrimoine, 'eur'],
      ['Restitution impôt étranger sur prélèvements sociaux', tax.restitution_impot_etranger_ps, 'eur'],
      ['Prélèvements sociaux patrimoine nets', tax.prelevements_sociaux_patrimoine_nets, 'eur'],
      ['Solde des prélèvements sociaux 2025', tax.solde_prelevements_sociaux_2025, 'eur'],
      ['Somme remboursée', tax.somme_remboursee, 'eur'],
      ['Date du remboursement', tax.date_remboursement, 'date'],
    ]);

    taxTable('Informations complémentaires', [
      ['Revenu fiscal de référence', tax.revenu_fiscal_reference, 'eur'],
      ['RCM déjà soumis aux prélèvements sociaux avec CSG déductible', tax.rcm_deja_soumis_ps_csg_deductible, 'eur'],
      [`Heures supplémentaires exonérées déclarées - ${id1Name}`, tax.heures_supp_exonerees_identifiant_1_brut, 'eur'],
      [`Heures supplémentaires exonérées nettes - ${id1Name}`, tax.heures_supp_exonerees_identifiant_1_net, 'eur'],
      [`Heures supplémentaires exonérées déclarées - ${id2Name}`, tax.heures_supp_exonerees_identifiant_2_brut, 'eur'],
      [`Heures supplémentaires exonérées nettes - ${id2Name}`, tax.heures_supp_exonerees_identifiant_2_net, 'eur'],
      ['Taux moyen d’imposition', tax.taux_imposition, 'pct'],
      ['Taux marginal d’imposition (TMI)', tax.tmi, 'pct'],
    ]);

    taxTable(`Plafond épargne retraite - ${id1Name}`, [
      ['Plafond total de 2024', tax.plafond_total_2024_identifiant_1, 'eur'],
      ['Plafond non utilisé - revenus 2023', tax.plafond_non_utilise_2023_identifiant_1, 'eur'],
      ['Plafond non utilisé - revenus 2024', tax.plafond_non_utilise_2024_identifiant_1, 'eur'],
      ['Plafond non utilisé - revenus 2025', tax.plafond_non_utilise_2025_identifiant_1, 'eur'],
      ['Plafond calculé sur les revenus 2025', tax.plafond_calcule_revenus_2025_identifiant_1, 'eur'],
      ['Plafond pour cotisations versées en 2026', tax.plafond_per_2026_identifiant_1, 'eur'],
    ]);

    taxTable(`Plafond épargne retraite - ${id2Name}`, [
      ['Plafond total de 2024', tax.plafond_total_2024_identifiant_2, 'eur'],
      ['Plafond non utilisé - revenus 2023', tax.plafond_non_utilise_2023_identifiant_2, 'eur'],
      ['Plafond non utilisé - revenus 2024', tax.plafond_non_utilise_2024_identifiant_2, 'eur'],
      ['Plafond non utilisé - revenus 2025', tax.plafond_non_utilise_2025_identifiant_2, 'eur'],
      ['Plafond calculé sur les revenus 2025', tax.plafond_calcule_revenus_2025_identifiant_2, 'eur'],
      ['Plafond pour cotisations versées en 2026', tax.plafond_per_2026_identifiant_2, 'eur'],
    ]);

    if (tax.ifi_concerne === true) { taxTable('IFI', [['Base imposable IFI', tax.ifi_base_imposable, 'eur'], ['TMI IFI', tax.ifi_tmi, 'pct'], ['IFI net à payer', tax.ifi_net_a_payer, 'eur']]); }
    if (map.patrimony?.has_real_estate === true) properties.push(...(map.patrimony?.immobilier ?? [])); if (map.credits?.has_credits === true) credits.push(...(map.credits?.items ?? [])); const placements = map.financial?.items ?? map.patrimony?.placements ?? []; financialExact += placements.filter((x: Json) => Boolean(x.source_document_id)).reduce((sum: number, x: Json) => sum + num(x.montant ?? x.valeur ?? x.encours), 0); financialEstimated += num(map.financial?.estimated_total_amount);
  }
  heading(ctx, `${n++}. Patrimoine immobilier consolidé`); drawTable(ctx, ['Bien', 'Ville', 'Usage', 'Détention', 'Propriétaire', 'Valeur'], properties.length ? properties.map((x, idx) => [`Bien ${idx + 1}`, clean(x.ville), clean(x.usage), clean(x.mode_detention), clean(x.proprietaire), eur(x.valeur_actuelle)]) : [['-', '-', 'Aucun bien déclaré', '-', '-', '0 EUR']], [10, 18, 18, 18, 18, 18]);
  heading(ctx, `${n++}. Patrimoine financier et liquidités`); for (const { inv, map } of maps) { const fin = map.financial ?? {}; const items = Array.isArray(fin.items) ? fin.items : []; const documentedItems = items.filter((item: Json) => Boolean(item.source_document_id)); const documentedTotal = documentedItems.reduce((sum: number, item: Json) => sum + num(item.montant ?? item.valeur ?? item.encours), 0); drawText(ctx, investorName(inv), { bold: true, size: 9.5, color: BLUE, after: 5 }); if (items.length) { drawTable(ctx, ['Placement', 'Organisme', 'Titulaire', 'Montant', 'Source'], items.map((item: Json) => [clean(item.type_placement ?? item.type_contrat ?? item.type), clean(item.organisme ?? item.etablissement), clean(item.proprietaire ?? item.titulaire), eur(item.montant ?? item.valeur ?? item.encours), item.source_document_id ? 'Justificatif' : item.source === 'synthese_dossier' || item.source_type === 'synthese_dossier' ? 'Synthèse dossier' : 'Déclaré']), [28, 20, 18, 17, 17]); } drawTable(ctx, ['Donnée', 'Valeur'], [['Sous-total directement justifié par pièces', documentedTotal > 0 ? eur(documentedTotal) : 'Non consolidé'], ['Total financier indicatif du dossier', hasValue(fin.estimated_total_amount) ? eur(fin.estimated_total_amount) : 'Non renseigné'], ['Liquidités importantes volontairement conservées sur comptes courants', clean(fin.current_accounts_intentional)], ['Catégories de placements', financialCategoryLabel(fin.categories)], ['Fourchette déclarée', financialBandLabel(fin.total_band)], ['Autres placements / précisions', clean(fin.other_details)], ['Complétude confirmée', clean(fin.completeness_confirmed)]], [58, 42]); }
  const crdTotal = credits.reduce((sum, x) => sum + num(x.crd ?? x.capital_restant_du), 0); const monthlyDebt = credits.reduce((sum, x) => sum + num(hasValue(x.mensualite_actuelle) ? x.mensualite_actuelle : x.mensualite), 0); const futureMonthlyDebt = credits.reduce((sum, x) => sum + num(x.mensualite_future), 0); const monthlyIncome = incomeAnnual / 12; const debtRatio = monthlyIncome > 0 ? monthlyDebt / monthlyIncome * 100 : null; const margin35 = monthlyIncome > 0 ? monthlyIncome * 0.35 - monthlyDebt : null; const propertyTotal = properties.reduce((sum, x) => sum + num(x.valeur_actuelle), 0);
  heading(ctx, `${n++}. Crédits et endettement détaillés`);
  if (!credits.length) {
    drawTable(ctx, ['Donnée', 'Valeur'], [['Situation', 'Aucun crédit déclaré']], [62, 38]);
  } else {
    credits.forEach((x: Json, idx: number) => {
      heading(ctx, `Crédit ${idx + 1} - ${clean(x.type_credit ?? x.type_pret)}`, 2);
      const missing = 'Non indiqué sur le document transmis';
      drawTable(ctx, ['Caractéristique', 'Valeur'], [
        ['Bien / projet rattaché', hasValue(x.credit_rattache_a) ? clean(x.credit_rattache_a) : missing],
        ['Organisme prêteur', hasValue(x.organisme ?? x.banque) ? clean(x.organisme ?? x.banque) : missing],
        ['Référence du prêt', hasValue(x.reference_pret) ? clean(x.reference_pret) : missing],
        ['Contrat / emprunteur(s)', hasValue(x.contrat ?? x.emprunteur) ? clean(x.contrat ?? x.emprunteur) : missing],
        ['Emprunteur(s) CRM', hasValue(x.emprunteur) ? clean(x.emprunteur) : missing],
        ['Date du prêt / ouverture', hasValue(x.date_pret ?? x.date_ouverture) ? frDate(x.date_pret ?? x.date_ouverture) : missing],
        ['Date de constitution du tableau', hasValue(x.date_constitution_tableau) ? frDate(x.date_constitution_tableau) : missing],
        ['CRD arrêté au', hasValue(x.date_derniere_echeance_prelevee) ? frDate(x.date_derniere_echeance_prelevee) : missing],
        ['Première échéance du tableau transmis', hasValue(x.date_premiere_echeance_tableau) ? frDate(x.date_premiere_echeance_tableau) : missing],
        ['Date de fin / dernière échéance', hasValue(x.date_fin ?? x.date_echeance) ? frDate(x.date_fin ?? x.date_echeance) : missing],
        ['Nombre d’échéances du tableau', hasValue(x.nombre_echeances_tableau) ? clean(x.nombre_echeances_tableau) : missing],
        ['Montant de la dernière échéance', hasValue(x.montant_derniere_echeance) ? eur(x.montant_derniere_echeance) : missing],
        ['Devise', hasValue(x.devise) ? clean(x.devise) : 'EUR'],
        ['Montant initial emprunté', hasValue(x.montant_initial) ? eur(x.montant_initial) : missing],
        ['Capital restant dû (CRD)', hasValue(x.capital_restant_du ?? x.crd) ? eur(x.capital_restant_du ?? x.crd) : missing],
        ['Durée initiale', hasValue(x.duree_initiale_mois ?? x.duree_mois) ? `${clean(x.duree_initiale_mois ?? x.duree_mois)} mois` : missing],
        ['Durée actualisée restante', hasValue(x.duree_actualisee_restante_mois) ? `${clean(x.duree_actualisee_restante_mois)} mois` : missing],
        ['Taux nominal actuel', hasValue(x.taux_credit ?? x.taux) ? `${pct(x.taux_credit ?? x.taux)}${x.taux_hors_assurance === true ? ' hors assurance' : ''}` : missing],
        ['Nature du taux', hasValue(x.taux_type) ? clean(x.taux_type) : missing],
        ['TAEG', hasValue(x.taeg) ? pct(x.taeg) : missing],
        ['Jour habituel de l’échéance', hasValue(x.jour_echeance) ? `Le ${clean(x.jour_echeance)} de chaque mois` : missing],
        ['Mensualité actuelle', hasValue(x.mensualite_actuelle) ? eur(x.mensualite_actuelle) : hasValue(x.mensualite) ? eur(x.mensualite) : missing],
        ['Phase / différé / suspension', hasValue(x.phase_credit) ? clean(x.phase_credit) : missing],
        ['Mensualité après reprise', hasValue(x.mensualite_future) ? eur(x.mensualite_future) : missing],
        ['Date de reprise / nouvelle mensualité', hasValue(x.mensualite_future_date) ? frDate(x.mensualite_future_date) : missing],
        ['Mode d’assurance emprunteur', hasValue(x.assurance_mode) ? clean(x.assurance_mode) : missing],
        ['Taux d’assurance', hasValue(x.taux_assurance) ? pct(x.taux_assurance) : missing],
        ['Cotisation d’assurance', hasValue(x.cotisation_assurance) ? eur(x.cotisation_assurance) : missing],
        ['Coût total de l’assurance', hasValue(x.cout_total_assurance) ? eur(x.cout_total_assurance) : x.assurance_cout_documente === false ? 'Non indiqué : assurance externe' : missing],
        ['Frais inclus dans l’échéance dont assurance', hasValue(x.frais_inclus_dont_assurance_tableau) ? eur(x.frais_inclus_dont_assurance_tableau) : missing],
        ['Coût total du crédit', hasValue(x.cout_total_credit) ? eur(x.cout_total_credit) : missing],
        ['Intérêts totaux / restant à payer', hasValue(x.interets_totaux ?? x.interets_restants) ? eur(x.interets_totaux ?? x.interets_restants) : missing],
        ['Garantie / sûreté', hasValue(x.garantie) ? clean(x.garantie) : missing],
      ], [56, 44]);
    });
  }
  drawTable(ctx, ['Ratio', 'Résultat'], [
    ['Revenus annuels consolidés', eur(incomeAnnual)],
    ['Mensualités actuelles de crédits', eur(monthlyDebt)],
    ['Mensualités à la reprise / régime futur', futureMonthlyDebt > 0 ? eur(futureMonthlyDebt) : 'Non renseigné'],
    ['Taux d’endettement actuel', debtRatio === null ? 'Non calculable' : pct(debtRatio)],
    ['Marge mensuelle théorique actuelle à 35 %', margin35 === null ? 'Non calculable' : eur(margin35)],
    ['Patrimoine immobilier brut', eur(propertyTotal)],
    ['Patrimoine financier directement justifié', financialExact > 0 ? eur(financialExact) : 'Non consolidé'],
    ['Patrimoine financier indicatif', financialEstimated > 0 ? eur(financialEstimated) : 'Non renseigné'],
    ['CRD total', eur(crdTotal)],
    ['Patrimoine net calculable sur montants justifiés', financialExact > 0 ? eur(propertyTotal + financialExact - crdTotal) : `${eur(propertyTotal - crdTotal)} hors patrimoine financier non justifié`],
  ], [64, 36]);
  drawText(ctx, 'Limite de calcul : le taux d’endettement et la marge à 35 % sont des indicateurs théoriques. Ils ne constituent ni un accord bancaire ni une capacité d’emprunt garantie.', { bold: true, color: GREEN, size: 8.4, after: 12 });
  heading(ctx, `${n++}. Informations réglementaires`); for (const { inv, map } of maps) { const reg = map.regulatory ?? {}; drawText(ctx, investorName(inv), { bold: true, size: 9.5, color: BLUE, after: 5 }); drawTable(ctx, ['Question / information', 'Réponse'], [['Pays de résidence fiscale', clean(reg.pays_residence_fiscale)], ['Citoyen ou résident fiscal américain', clean(reg.citoyen_ou_resident_us)], ['TIN américain', clean(reg.code_tin)], ['Sanctions internationales / gel des avoirs', clean(reg.sanctions_declarees)], ['PPE - client ou proche', clean(reg.ppe_declaree)], ['Personne exposée', clean(reg.ppe_personne_exposee)], ['Fonction PPE', clean(reg.ppe_motif)], ['Pays d’exercice PPE', clean(reg.ppe_pays_exercice)], ['Période PPE', clean(reg.ppe_anciennete)], ['Souhaite prendre en compte des critères ESG', clean(reg.esg_opt_in)]], [62, 38]); }
  ensure(ctx, 145); heading(ctx, `${n++}. Validation des informations`); drawText(ctx, 'En signant, les clients confirment avoir relu les informations reproduites dans le présent recueil et déclarent qu’elles sont, à leur connaissance, exactes, sincères et complètes à la date du recueil. Les éléments signalés comme non renseignés ou à confirmer devront être complétés avant toute recommandation qui en dépend.', { size: 8.6 }); drawText(ctx, 'Portée de la signature : la signature du recueil ne vaut ni recommandation d’investissement, ni offre de financement, ni engagement de souscription.', { bold: true, color: GREEN, size: 8.6, after: 12 }); signatureBoxes(ctx, investors); footer(ctx); return new Uint8Array(await ctx.pdf.save({ useObjectStreams: false }));
}

async function buildQuestionnaire(snapshot: Json, type: 'QPI' | 'ESG') {
  const ctx = await newPdfContext(); const dossier = snapshot.dossier; const investors = snapshot.investors; const sessions = snapshot.sessions.filter((s: Json) => snapshot.templateById[s.template_id]?.type_questionnaire === type); const titleText = type === 'QPI' ? 'PROFIL INVESTISSEUR' : 'QUESTIONNAIRE ESG / PRÉFÉRENCES DE DURABILITÉ'; const dateValue = type === 'QPI' ? snapshot.qpi_date : snapshot.esg_date; title(ctx, titleText, `Date de l’évaluation : ${frDate(dateValue)} - Date d’entrée en relation : ${frDate(dossier.date_entree_relation)}`);
  for (const inv of investors) {
    const session = sessions.find((s: Json) => s.investisseur_id === inv.id);
    ensure(ctx, 80); heading(ctx, `${investorName(inv)} - ${type === 'QPI' ? 'profil investisseur' : 'préférences ESG'}`);
    if (!session) { if (type === 'ESG' && inv.esg_status === 'not_applicable') drawText(ctx, 'Aucune préférence ESG détaillée : questionnaire non applicable selon le choix du client.', { bold: true, color: GREEN }); else drawText(ctx, 'Questionnaire non disponible pour cet investisseur.', { color: rgb(0.7, 0.3, 0.05) }); continue; }
    const questions = snapshot.questions
      .filter((q: Json) => q.template_id === session.template_id && q.metadata?.deprecated !== true)
      .sort((a: Json, b: Json) => a.ordre - b.ordre); const answers = snapshot.answers.filter((a: Json) => a.session_id === session.id); const answerByQuestion = new Map(answers.map((a: Json) => [a.question_id, a]));
    if (type === 'QPI') {
      const result = snapshot.qpiResults.find((r: Json) => r.session_id === session.id);
      if (result) {
        const score = `${clean(result.score_tolerance)} / ${clean(result.score_max)}`;
        const level = clean(result.profil_operationnel_final ?? result.profil_indicatif);
        const operationalRank = clean(result.synthese_dimensions?.profil_operationnel?.rang ?? result.niveau_tolerance_retenu);
        const qByCode = new Map(questions.map((question: Json) => [question.code, question]));
        const answerFor = (code: string) => {
          const question = qByCode.get(code);
          return question ? answerByQuestion.get(question.id) ?? null : null;
        };
        const optionFor = (code: string) => {
          const answer = answerFor(code);
          return answer?.option_id ? snapshot.optionMap.get(answer.option_id) ?? null : null;
        };
        const answerCode = (code: string) => {
          const option = optionFor(code);
          return option?.code ?? option?.code_option ?? null;
        };
        const answerLabel = (code: string) => {
          const option = optionFor(code);
          return option?.libelle ? clean(option.libelle) : 'Non renseigné';
        };

        const q4Code = answerCode('Q4');
        const q9Code = answerCode('Q9');
        const q25Label = answerLabel('Q25');
        const liquidity = result.synthese_dimensions?.liquidite ?? {};
        const capitalConstraintMin = Number(liquidity.capital_contraint_min);
        const capitalConstraintMax = Number(liquidity.capital_contraint_max);
        const capitalInvestableMin = Number(liquidity.capital_investissable_lt_min);
        const capitalInvestableMax = Number(liquidity.capital_investissable_lt_max);
        const hasConstraintRange = Number.isFinite(capitalConstraintMin) && Number.isFinite(capitalConstraintMax);
        const hasInvestableRange = Number.isFinite(capitalInvestableMin) && Number.isFinite(capitalInvestableMax);
        const constrainedLabel = hasConstraintRange ? (capitalConstraintMin === capitalConstraintMax ? eur(capitalConstraintMin) : `${eur(capitalConstraintMin)} à ${eur(capitalConstraintMax)}`) : 'À confirmer';
        const investableLabel = hasInvestableRange ? `${eur(capitalInvestableMin)} à ${eur(capitalInvestableMax)}` : 'Non calculable précisément';
        const investableQualification = liquidity.estimation === 'fourchette_a_confirmer' ? ' (à confirmer : possible recouvrement entre projet et épargne de précaution)' : '';
        const q4Answer = answerFor('Q4');
        const futureNeed = q4Answer?.answer_json && typeof q4Answer.answer_json === 'object' ? q4Answer.answer_json : {};
        const futureAmount = futureNeed?.montant_besoin_futur ? eur(futureNeed.montant_besoin_futur) : null;
        const futureDate = futureNeed?.echeance ? frDate(futureNeed.echeance) : null;

        const knowledgeGaps = questions
          .filter((question: Json) => ['Q13','Q14','Q15','Q16','Q17'].includes(question.code))
          .filter((question: Json) => {
            const option = optionFor(question.code);
            const selected = option?.code ?? option?.code_option ?? null;
            const expected = question.metadata?.correct_option ?? null;
            return !selected || (expected && selected !== expected);
          })
          .map((question: Json) => QPI_KNOWLEDGE_LABELS[question.code] ?? clean(question.libelle));

        const sessionExperience = snapshot.qpiProductExperience
          .filter((item: Json) => item.session_id === session.id && item.niveau_experience && item.niveau_experience !== 'jamais');
        const practicedFamilies = sessionExperience
          .map((item: Json) => QPI_EXPERIENCE_LABELS[item.famille_produit] ?? clean(item.famille_produit));
        const expDetails = snapshot.qpiExperienceDetails.find((item: Json) => item.session_id === session.id);

        const liquidityAlerts: string[] = [];
        if (q4Code === 'B') {
          const detail = [futureAmount ? `besoin estimé ${futureAmount}` : null, futureDate ? `échéance ${futureDate}` : null].filter(Boolean).join(', ');
          liquidityAlerts.push(`projet ou dépense importante dans moins de 2 ans${detail ? ` (${detail})` : ''}`);
        }
        if (q9Code === 'B') liquidityAlerts.push('une baisse du patrimoine financier pourrait conduire à réduire des dépenses ou reporter certains projets');

        drawResultPanel(
          ctx,
          'RÉSULTAT DU PROFIL INVESTISSEUR',
          score,
          `${level} - classe interne ${operationalRank}`,
          `Le score de ${score} mesure la tolérance comportementale au risque. Il conduit à un profil indicatif ${clean(result.profil_indicatif)}. Après prise en compte séparée de la capacité de perte, le niveau de risque maximal compatible avec les réponses est ${level} - classe interne ${operationalRank}.`,
          'Ce niveau ne constitue pas une allocation de portefeuille. Il s’applique uniquement à la part du capital réellement disponible pour un investissement de long terme. Les besoins de liquidité, les projets à financer, la capacité de perte, les connaissances et l’expérience déterminent ensuite la façon de répartir cette épargne.',
          'Le profil de risque ne constitue pas une allocation. La classe interne du profil client est distincte du SRI des produits ; une partie de l’épargne peut devoir rester disponible ou sécurisée même avec un profil dynamique.'
        );

        heading(ctx, 'Synthèse à retenir', 2);
        drawTable(ctx, ['Critère', 'Lecture pratique'], [
          ['Tolérance au risque', `${score} correspond à ${clean(result.profil_indicatif)}.`],
          ['Capacité de perte', `Jusqu’à ${pct(result.capacite_perte_retenue_pct)} sur les placements concernés. Ce pourcentage ne signifie pas que l’ensemble du patrimoine doit être exposé à cette perte.`],
          ['Capital à réserver / sécuriser', constrainedLabel],
          ['Capital long terme indicatif', `${investableLabel}${investableQualification}. Cette fourchette est calculée à partir de la tranche de patrimoine financier déclarée et des besoins de court terme connus.`],
          ['Part acceptée en forte exposition', `${q25Label}. Cette donnée limite la part des sommes investissables que le client accepte de soumettre à une forte baisse temporaire.`],
          ['Connaissances', `${clean(result.niveau_connaissances ?? result.synthese_dimensions?.connaissances?.niveau)}${knowledgeGaps.length ? `. Points à expliquer / vérifier : ${knowledgeGaps.join(', ')}.` : '. Aucun point de vigilance spécifique identifié sur les questions obligatoires.'}`],
          ['Expérience', practicedFamilies.length ? `${practicedFamilies.length} famille(s) déjà pratiquée(s) : ${practicedFamilies.join(' ; ')}.` : 'Aucune famille de placements déjà pratiquée déclarée.'],
          ['Conclusion', `Niveau de risque maximal compatible : ${level} - classe interne ${operationalRank}. Cette classe interne ne correspond pas au SRI d’un produit et ne s’applique qu’au capital réellement investissable à long terme.`],
        ], [35, 65]);

        if (expDetails) {
          const seniorityLabels: Record<string,string> = { aucune:'Aucune expérience', moins_2_ans:'Moins de 2 ans', '2_5_ans':'2 à 5 ans', '5_10_ans':'5 à 10 ans', plus_10_ans:'Plus de 10 ans' };
          const amountLabels: Record<string,string> = { moins_10k:'Moins de 10 000 EUR', '10_50k':'10 000 à 50 000 EUR', '50_100k':'50 000 à 100 000 EUR', plus_100k:'Plus de 100 000 EUR' };
          const modeLabels: Record<string,string> = { accompagne_conseille:'Principalement accompagné / conseillé', gestion_libre:'Principalement en gestion libre', gestion_sous_mandat:'Principalement sous mandat', mixte:'Mixte selon les placements' };
          drawText(ctx, `Expérience déclarée : ${seniorityLabels[expDetails.anciennete_experience] ?? clean(expDetails.anciennete_experience)} · montant habituel des opérations : ${amountLabels[expDetails.montant_habituel_operation] ?? clean(expDetails.montant_habituel_operation)} · mode de gestion : ${modeLabels[expDetails.mode_gestion] ?? clean(expDetails.mode_gestion)}.`, { size: 8.4, color: rgb(0.32,0.38,0.46), after: 8 });
        }

        drawText(ctx, result.ecart_declared_objective === true
          ? `Plafonnement du profil : ${clean(result.justification_ecart)}`
          : 'Tolérance au risque et capacité de perte : compatibles. Des contraintes de liquidité, de projet ou de concentration du risque peuvent néanmoins conduire à sécuriser une partie de l’épargne.',
          { size: 8.8, bold: true, color: result.ecart_declared_objective === true ? rgb(0.65, 0.35, 0.05) : GREEN, after: 8 }
        );

        if (liquidityAlerts.length) {
          heading(ctx, 'Point d’attention : liquidité et projets', 2);
          drawText(ctx, `Contraintes identifiées : ${liquidityAlerts.join(' ; ')}. En pratique, il faut distinguer une poche disponible / sécurisée à court terme du capital réellement investissable à long terme.`, { size: 8.8, color: NAVY, after: 6 });
          drawText(ctx, `Conclusion pour le conseil : la classe interne ${operationalRank} est compatible avec la partie du capital réellement disponible pour un investissement de long terme. Elle ne doit pas être appliquée indistinctement à l’ensemble de l’épargne et reste distincte du SRI des produits.`, { size: 8.8, bold: true, color: GREEN, after: 8 });
        }
      }
    } else {
      const pref = snapshot.esgPreferences.find((r: Json) => r.session_id === session.id); const esgScore = Math.max(0, Math.min(100, answers.reduce((sum: number, a: Json) => sum + num(a.points_awarded), 0))); const level = esgLevel(esgScore); const taxo = pref?.taxonomie_choix === 'oui' ? `Taxonomie européenne : minimum ${pct(pref.taxonomie_min_pct)}` : 'Taxonomie européenne : non retenue'; const sfdr = pref?.sfdr_choix === 'oui' ? `Investissements durables : minimum ${pct(pref.sfdr_min_pct)}` : 'Investissements durables : non retenus'; const exclusions = Array.isArray(pref?.exclusions_sectorielles) && pref.exclusions_sectorielles.length ? `Exclusions : ${readable(pref.exclusions_sectorielles)}` : 'Aucune exclusion sectorielle détaillée'; drawResultPanel(ctx, 'PROFIL DE DURABILITÉ', `${esgScore} / 100`, level, `Sensibilité à la durabilité ${level.toLowerCase()}. ${taxo}. ${sfdr}. ${exclusions}.`, 'Ces préférences doivent être confrontées aux caractéristiques de durabilité des solutions proposées. Elles peuvent réduire l’univers de produits compatibles. Tout écart entre les préférences exprimées et une solution envisagée doit être identifié et traité dans le processus d’adéquation avant recommandation.', 'Le score ESG est un indicateur interne du cabinet destiné à synthétiser l’intensité des préférences exprimées. Ce n’est ni une note de performance financière, ni une note de risque, ni un score réglementaire officiel.');
      if (pref) drawTable(ctx, ['Thème', 'Préférence'], [['Périmètre', readable(pref.perimetre)], ['Taxonomie - choix', readable(pref.taxonomie_choix)], ['Taxonomie - minimum', pct(pref.taxonomie_min_pct)], ['Objectifs environnementaux', readable(pref.taxonomie_objectifs)], ['Investissements durables - choix', readable(pref.sfdr_choix)], ['Investissements durables - minimum', pct(pref.sfdr_min_pct)], ['Thématiques durables', readable(pref.sfdr_thematiques)], ['PAI - choix', readable(pref.pai_choix)], ['Priorités PAI', readable(pref.pai_priorites)], ['Exclusions sectorielles', readable(pref.exclusions_sectorielles)], ['Conséquences acceptées', readable(pref.limitations_sectorielles)], ['Besoins spécifiques', clean(pref.besoins_specifiques, 'Aucune précision complémentaire')], ['Synthèse', clean(pref.synthese_reglementaire)]], [44, 56]);
    }
    const q8 = questions.find((q: Json) => q.ordre === 8); const q8a = q8 ? answerByQuestion.get(q8.id) : null; const q8code = q8a?.option_id ? snapshot.optionMap.get(q8a.option_id)?.code_option : null;
    ensure(ctx, 165); heading(ctx, 'Détail réglementaire du questionnaire', 2);
    if (type === 'QPI') {
      drawText(ctx, 'Méthode de lecture : seules les questions 21 à 25 alimentent le score de tolérance au risque sur 25 points. Les autres questions actives ne sont pas notées : elles servent à apprécier séparément l’horizon de placement, les besoins de liquidité, la capacité de perte, les connaissances et l’expérience. Le bloc « Résultat » en présente uniquement la synthèse utile au conseil ; l’ensemble des réponses est reproduit ci-dessous.', { size: 8.2, bold: true, color: NAVY, after: 7 });
      const unansweredOptional = questions.filter((q: Json) => q.obligatoire === false && !(answerByQuestion.get(q.id)?.id));
      if (unansweredOptional.length) {
        drawText(ctx, `Les questions non renseignées suivantes sont facultatives dans le questionnaire actuel : ${unansweredOptional.map((q: Json) => q.code ?? `Q${q.ordre}`).join(', ')}. Leur absence de réponse n’empêche pas la finalisation du profil, mais l’information reste non documentée.`, { size: 8.2, color: rgb(0.32, 0.38, 0.46), after: 8 });
      }
    }
    drawTable(ctx, ['N', 'Question', 'Réponse', 'Points'], questions.map((q: Json) => { const a = answerByQuestion.get(q.id) ?? {}; let response = answerValue(a, snapshot.optionMap); let points = a.points_awarded === null || a.points_awarded === undefined ? '-' : clean(a.points_awarded); if (type === 'ESG' && !a.id) { if ([9, 10].includes(q.ordre) && q8code === 'NON') { response = 'Non applicable compte tenu de la réponse précédente'; points = '-'; } else if (q.ordre === 13) { response = 'Aucune précision complémentaire'; points = '-'; } } return [String(q.ordre), clean(q.libelle), response, points]; }), [7, 52, 31, 10]);
  }
  ensure(ctx, 155); heading(ctx, 'Validation et signatures'); const signers = type === 'ESG' ? investors.filter((inv: Json) => sessions.some((s: Json) => s.investisseur_id === inv.id)) : investors; const singular = signers.length === 1; drawText(ctx, type === 'QPI' ? (singular ? 'En signant, le client confirme avoir pris connaissance des réponses reproduites, du résultat du profil, de sa capacité de perte et des éventuelles contraintes de liquidité ou de projet identifiées.' : 'En signant, les clients confirment avoir pris connaissance des réponses reproduites, du résultat de leur profil, de leur capacité de perte et des éventuelles contraintes de liquidité ou de projet identifiées.') : (singular ? 'En signant, le client confirme que les préférences de durabilité reproduites correspondent à ses réponses à la date du questionnaire.' : 'En signant, les clients confirment que les préférences de durabilité reproduites correspondent à leurs réponses à la date du questionnaire.'), { size: 8.6, after: 12 }); signatureBoxes(ctx, signers); footer(ctx); return new Uint8Array(await ctx.pdf.save({ useObjectStreams: false }));
}



function originalClientLines(snapshot: Json) {
  const primaryInvestor = snapshot.investors[0];
  const primaryMap = primaryInvestor ? extractByCode(snapshot.sections, primaryInvestor.id) : {};
  const primaryAddress = primaryMap.identity?.address ?? {};
  const taxAddress = clean(primaryMap.tax?.adresse_fiscale, '');
  return snapshot.investors.map((inv: Json) => {
    const sectionMap = extractByCode(snapshot.sections, inv.id);
    const identity = sectionMap.identity ?? {};
    const civilite = clean(identity.civilite ?? inv.civilite, '').trim();
    const name = investorName(inv);
    const address = identity?.address ?? {};
    let addressLine = [address.numero_voie, address.complement, address.code_postal, address.ville, address.pays].filter(Boolean).join(' ');
    if (!addressLine) {
      const ownTaxAddress = clean(sectionMap.tax?.adresse_fiscale, '');
      addressLine = ownTaxAddress || taxAddress || [primaryAddress.numero_voie, primaryAddress.complement, primaryAddress.code_postal, primaryAddress.ville, primaryAddress.pays].filter(Boolean).join(' ');
    }
    return {
      heading: [civilite, name].filter(Boolean).join(' ').trim(),
      details: [addressLine, inv.email, identity.mobile ?? inv.mobile].filter(Boolean).map((value) => clean(value)),
    };
  });
}
function primaryClientCity(snapshot: Json) {
  const primary = snapshot.investors[0];
  if (!primary) return '____________________';
  const identity = extractByCode(snapshot.sections, primary.id).identity ?? {};
  return clean(identity?.address?.ville, '____________________');
}

function regulatoryText(ctx: PdfContext, value: string, options: Json = {}) {
  drawText(ctx, value, {
    ...options,
    x: options.x ?? REG_MARGIN,
    width: options.width ?? (A4.width - 2 * REG_MARGIN),
    color: options.color ?? BODY,
  });
}

function regulatoryHeadingLevel(block: RegulatoryModelBlock, value: string, type: 'der' | 'mission') {
  const t = clean(value).trim();
  const normalized = t.toUpperCase();
  if (!t) return 0;

  if (type === 'mission') {
    if (/^\d{1,2}\.\s/.test(t) || /^ANNEXE\b/.test(normalized) || /^ENTRE LES SOUSSIGN/.test(normalized)) return 1;
    if (/^\d{1,2}\.\d+\.\s/.test(t) || /^\d{1,2}\.\d+\s/.test(t)) return 2;
    if (/^\d{1,2}\.\d+\.\d+/.test(t)) return 3;
    if (['PRÉAMBULE', 'CONTEXTE DE LA PRESTATION', 'CARACTÉRISTIQUES DE LA PRESTATION'].includes(normalized)) return 2;
  } else {
    if (
      normalized === 'INTRODUCTION' ||
      normalized.startsWith('SECTEUR ') ||
      normalized === 'ASSISTANCE PATRIMONIALE ET FISCALE' ||
      normalized === 'RÉMUNÉRATION' ||
      normalized.startsWith('RÉCLAMATIONS') ||
      normalized === 'RGPD' ||
      normalized.startsWith('MOYENS DE COMMUNICATION')
    ) return 1;

    if (
      normalized === 'STATUTS LÉGAUX ET AUTORITÉS DE TUTELLE :' ||
      normalized === 'CONSEILLER EN INVESTISSEMENTS FINANCIERS' ||
      normalized.startsWith('INTERMÉDIAIRE EN ASSURANCE') ||
      normalized.startsWith('INTERMÉDIAIRE EN OPÉRATIONS') ||
      normalized.startsWith('TRANSACTION IMMOBILIERE') ||
      normalized === 'RESPONSABILITÉ CIVILE PROFESSIONNELLE' ||
      normalized === 'GARANTIES FINANCIÈRES' ||
      normalized === 'PARTENAIRES' ||
      normalized === 'POLITIQUE EN MATIÈRE DE DURABILITÉ' ||
      normalized === 'RÉMUNÉRATION IOBSP' ||
      normalized.startsWith("QU'EST-CE QU'UN CONSEIL") ||
      normalized === 'COMMISSIONNEMENT :' ||
      normalized === "MODALITÉS DE SAISINE DE L'ENTREPRISE" ||
      normalized.startsWith('TRAITEMENT DES RÉCLAMATIONS') ||
      normalized === 'MISE À JOUR DES INFORMATIONS'
    ) return 2;

    if (
      normalized === 'INFORMATIONS' ||
      normalized === 'VOTRE CONTACT' ||
      normalized === "COURTIER D'ASSURANCE" ||
      /^\d+\.\s/.test(t) ||
      /^HONORAIRES\b/.test(normalized) ||
      /^COMMISSION\b/.test(normalized)
    ) return 3;
  }

  if (block.k === 'h' && t.length <= 74 && !/:\s+\S{3,}/.test(t) && !/\d{4,}/.test(t)) return 2;
  return 0;
}

function regulatoryHeadingDisplay(value: string, type: 'der' | 'mission') {
  const t = clean(value).trim();
  const n = t.toUpperCase();
  if (type === 'der') {
    const map: Record<string, string> = {
      'STATUTS LÉGAUX ET AUTORITÉS DE TUTELLE :': 'Statuts légaux et autorités de tutelle',
      'CONSEILLER EN INVESTISSEMENTS FINANCIERS': 'Conseiller en investissements financiers',
      'INTERMÉDIAIRE EN ASSURANCE :': 'Intermédiaire en assurance',
      'INTERMÉDIAIRE EN ASSURANCE': 'Intermédiaire en assurance',
      'INTERMÉDIAIRE EN OPÉRATIONS BANCAIRES ET SERVICES DE PAIEMENTS': 'Intermédiaire en opérations bancaires et services de paiement',
      'TRANSACTION IMMOBILIERE (SANS MANIEMENT DE FONDS)': 'Transaction immobilière (sans maniement de fonds)',
      'RESPONSABILITÉ CIVILE PROFESSIONNELLE': 'Responsabilité civile professionnelle',
      'GARANTIES FINANCIÈRES': 'Garanties financières',
      'PARTENAIRES': 'Partenaires',
      'POLITIQUE EN MATIÈRE DE DURABILITÉ': 'Politique en matière de durabilité',
      'RÉMUNÉRATION IOBSP': 'Rémunération IOBSP',
      'COMMISSIONNEMENT :': 'Commissionnement',
      'INFORMATIONS': 'Informations',
      'VOTRE CONTACT': 'Votre contact',
      "COURTIER D'ASSURANCE": "Courtier d'assurance",
      '1. FINANCIER :': '1. Investissements financiers',
      '2. SCPI (SOCIÉTÉS CIVILES DE PLACEMENT IMMOBILIER) :': '2. SCPI',
      "- IMMOBILIER : RÉMUNÉRATION D'AGENT IMMOBILIER": '3. Immobilier',
      "1. RÉMUNÉRATION D'AGENT IMMOBILIER :": "3.1. Rémunération d'agent immobilier",
    };
    if (map[n]) return map[n];
  }
  return t;
}

function drawRegulatoryHeading(ctx: PdfContext, value: string, level: number, type: 'der' | 'mission') {
  const display = regulatoryHeadingDisplay(value, type);
  const size = level === 1 ? 14.2 : level === 2 ? 11.3 : 10.2;
  const before = level === 1 ? 18 : level === 2 ? 11 : 7;
  const after = level === 1 ? 8 : level === 2 ? 5.5 : 4;
  const color = level === 1 || level === 2 ? BLUE : BODY;
  ensure(ctx, before + size * 1.45 + after + (level === 1 ? 6 : 0));
  ctx.y -= before;
  regulatoryText(ctx, display, { bold: true, size, lineHeight: size * 1.22, color, after });
  if (level === 1) {
    ctx.page.drawLine({
      start: { x: REG_MARGIN, y: ctx.y + 3 },
      end: { x: A4.width - REG_MARGIN, y: ctx.y + 3 },
      thickness: 0.7,
      color: BORDER,
    });
    ctx.y -= 3;
  }
}

function drawClientCards(ctx: PdfContext, clients: Array<{ heading: string; details: string[] }>) {
  const width = A4.width - 2 * REG_MARGIN;
  const gap = 8;
  for (const client of clients) {
    const detailText = client.details.join(' - ');
    const detailLines = detailText ? wrap(ctx.regular, clean(detailText), 9.15, width - 24) : [];
    const height = Math.max(52, 33 + detailLines.length * 11.8);
    ensure(ctx, height + gap);
    ctx.page.drawRectangle({
      x: REG_MARGIN,
      y: ctx.y - height,
      width,
      height,
      borderWidth: 0.8,
      borderColor: BORDER,
      color: LIGHT_BLUE,
    });
    ctx.page.drawText(clean(client.heading), { x: REG_MARGIN + 11, y: ctx.y - 18, size: 10.4, font: ctx.bold, color: NAVY });
    let ty = ctx.y - 34;
    for (const line of detailLines) {
      ctx.page.drawText(line, { x: REG_MARGIN + 11, y: ty, size: 9.15, font: ctx.regular, color: BODY });
      ty -= 11.8;
    }
    ctx.y -= height + gap;
  }
}

function drawRegulatoryTable(ctx: PdfContext, rows: string[][]) {
  if (!rows.length) return;
  const normalized = rows.map((row) => row.map((value) => clean(value)));
  const colCount = Math.max(...normalized.map((row) => row.length), 1);
  const available = A4.width - 2 * REG_MARGIN;
  const padded = normalized.map((row) => Array.from({ length: colCount }, (_, i) => row[i] ?? ''));
  const headers = padded[0];
  const body = padded.slice(1);

  const charWeights = Array.from({ length: colCount }, (_, i) => {
    const maxChars = Math.max(...padded.map((row) => String(row[i] ?? '').length), 8);
    return Math.min(34, Math.max(10, maxChars));
  });
  const totalWeight = charWeights.reduce((a, b) => a + b, 0);
  const colWidths = charWeights.map((weight) => available * weight / totalWeight);

  const paddingX = 6;
  const paddingY = 6;
  const fontSize = colCount >= 4 ? 7.45 : 8;
  const lineHeight = fontSize * 1.32;
  const isAmount = (value: string) => /^-?[\d\s.,]+(?:\s*(?:€|EUR|%))?$/i.test(value.trim());

  const measure = (values: string[], bold: boolean) => {
    const font = bold ? ctx.bold : ctx.regular;
    const wrapped = Array.from({ length: colCount }, (_, i) =>
      wrap(font, clean(values[i] ?? ''), fontSize, colWidths[i] - paddingX * 2)
    );
    return {
      wrapped,
      height: Math.max(24, Math.max(...wrapped.map((lines) => lines.length), 1) * lineHeight + paddingY * 2),
    };
  };

  const drawRow = (values: string[], isHeader: boolean, bodyIndex = 0) => {
    const measured = measure(values, isHeader);
    const font = isHeader ? ctx.bold : ctx.regular;
    let x = REG_MARGIN;
    for (let i = 0; i < colCount; i++) {
      const fill = isHeader ? NAVY : (bodyIndex % 2 === 1 ? ZEBRA : WHITE);
      ctx.page.drawRectangle({
        x,
        y: ctx.y - measured.height,
        width: colWidths[i],
        height: measured.height,
        borderWidth: 0.55,
        borderColor: BORDER,
        color: fill,
      });
      let ty = ctx.y - paddingY - fontSize;
      const amountCell = !isHeader && isAmount(values[i] ?? '');
      for (const line of measured.wrapped[i]) {
        const lineWidth = font.widthOfTextAtSize(line, fontSize);
        const tx = amountCell ? x + colWidths[i] - paddingX - lineWidth : x + paddingX;
        ctx.page.drawText(line, {
          x: tx,
          y: ty,
          size: fontSize,
          font,
          color: isHeader ? WHITE : BODY,
        });
        ty -= lineHeight;
      }
      x += colWidths[i];
    }
    ctx.y -= measured.height;
  };

  const headerHeight = measure(headers, true).height;
  const firstHeight = body.length ? measure(body[0], false).height : 0;
  ensure(ctx, headerHeight + firstHeight + 18);
  ctx.y -= 4;
  drawRow(headers, true);
  for (let i = 0; i < body.length; i++) {
    const rowHeight = measure(body[i], false).height;
    if (ctx.y - rowHeight < 56) {
      addPage(ctx);
      drawRow(headers, true);
    }
    drawRow(body[i], false, i);
  }
  ctx.y -= 14;
}

function drawBulletParagraph(ctx: PdfContext, value: string, options: Json = {}) {
  const text = clean(value).replace(/^[-•]\s*/, '');
  const x = options.x ?? (REG_MARGIN + 14);
  const width = options.width ?? (A4.width - REG_MARGIN - x);
  const size = options.size ?? 9.7;
  const lineHeight = options.lineHeight ?? 13.1;
  const font = options.bold ? ctx.bold : ctx.regular;
  const lines = wrap(font, text, size, width);
  const height = lines.length * lineHeight + (options.after ?? 5);
  ensure(ctx, height);
  ctx.page.drawCircle({ x: REG_MARGIN + 4.5, y: ctx.y - 6.3, size: 1.7, color: options.bulletColor ?? BLUE });
  for (const line of lines) {
    ctx.page.drawText(line, { x, y: ctx.y - size, size, font, color: options.color ?? BODY });
    ctx.y -= lineHeight;
  }
  ctx.y -= options.after ?? 5;
}

function derCommunicationBullet(value: string) {
  const normalized = clean(value).trim();
  return [
    'Réunions physiques',
    'Réunion à distance',
    'Courrier',
    'Signature électronique via Youtrust et échanges sur supports durables sécurisés, le cas échéant',
    'Envois de courriels',
    'Téléphone',
  ].includes(normalized);
}

function derActivityBullet(value: string) {
  const normalized = clean(value).trim().toUpperCase();
  return [
    'CONSEILLER EN INVESTISSEMENTS FINANCIERS',
    'INTERMÉDIAIRE EN ASSURANCE :',
    'INTERMÉDIAIRE EN ASSURANCE',
    'INTERMÉDIAIRE EN OPÉRATIONS BANCAIRES ET SERVICES DE PAIEMENTS',
    'TRANSACTION IMMOBILIERE (SANS MANIEMENT DE FONDS)',
  ].includes(normalized);
}

function derSuppressSourceBullet(value: string) {
  const normalized = clean(value).trim();
  return normalized.startsWith('Carte professionnelle n°') || normalized.startsWith('Délégation n°');
}

function drawRegulatoryNote(ctx: PdfContext, value: string) {
  const width = A4.width - 2 * REG_MARGIN;
  const size = 9.65;
  const lines = wrap(ctx.bold, clean(value), size, width - 20);
  const height = Math.max(34, lines.length * 12.5 + 16);
  ensure(ctx, height + 4);
  ctx.page.drawRectangle({
    x: REG_MARGIN,
    y: ctx.y - height,
    width,
    height,
    borderWidth: 0.8,
    borderColor: BORDER,
    color: LIGHT_BLUE,
  });
  let ty = ctx.y - 15;
  for (const line of lines) {
    ctx.page.drawText(line, { x: REG_MARGIN + 10, y: ty, size, font: ctx.bold, color: BODY });
    ty -= 12.5;
  }
  ctx.y -= height + 6;
}

function drawSignaturePanel(ctx: PdfContext, snapshot: Json, type: 'der' | 'mission') {
  const city = primaryClientCity(snapshot);
  const clients = originalClientLines(snapshot);
  const titleText = type === 'der' ? 'Lieu, date et signature' : 'Signatures';
  const panelHeight = Math.max(150, 104 + Math.max(0, clients.length - 1) * 20);

  if (ctx.y - panelHeight - 48 < 54) addPage(ctx);
  drawRegulatoryHeading(ctx, titleText, 1, type);

  const gap = 12;
  const totalWidth = A4.width - 2 * REG_MARGIN;
  const colWidth = (totalWidth - gap) / 2;
  const top = ctx.y;
  const clientX = REG_MARGIN;
  const adviserX = REG_MARGIN + colWidth + gap;

  for (const [x, headingText] of [[clientX, 'Le(s) Client(s)'], [adviserX, 'Le Conseiller']] as Array<[number,string]>) {
    ctx.page.drawRectangle({ x, y: top - panelHeight, width: colWidth, height: panelHeight, borderWidth: 0.9, borderColor: BORDER, color: WHITE });
    ctx.page.drawRectangle({ x, y: top - 30, width: colWidth, height: 30, borderWidth: 0, color: LIGHT_BLUE });
    ctx.page.drawText(headingText, { x: x + 10, y: top - 20, size: 9.8, font: ctx.bold, color: NAVY });
  }

  let clientY = top - 48;
  for (const client of clients) {
    ctx.page.drawText(clean(client.heading), { x: clientX + 10, y: clientY, size: 9.1, font: ctx.bold, color: BODY });
    clientY -= 14;
  }
  ctx.page.drawText(clean(`Lieu : ${city}`), { x: clientX + 10, y: top - 88, size: 8.5, font: ctx.regular, color: BODY });
  ctx.page.drawText('Date :', { x: clientX + 10, y: top - 104, size: 8.5, font: ctx.regular, color: BODY });
  ctx.page.drawText('Zone de signature Youtrust', { x: clientX + 10, y: top - panelHeight + 22, size: 8, font: ctx.bold, color: BLUE });

  ctx.page.drawText('Eric Bellaiche', { x: adviserX + 10, y: top - 48, size: 9.1, font: ctx.bold, color: BODY });
  ctx.page.drawText('Lieu : Allevard', { x: adviserX + 10, y: top - 88, size: 8.5, font: ctx.regular, color: BODY });
  ctx.page.drawText('Date :', { x: adviserX + 10, y: top - 104, size: 8.5, font: ctx.regular, color: BODY });
  ctx.page.drawText('Zone de signature Youtrust', { x: adviserX + 10, y: top - panelHeight + 22, size: 8, font: ctx.bold, color: GREEN });

  ctx.y -= panelHeight + 8;
}

function replaceSignatureProvider(value: string, type: 'der' | 'mission') {
  if (type !== 'mission') return value;
  return value.replace(/Yousign/g, 'Youtrust').replace(/YOUSIGN/g, 'YOUTRUST');
}

function finalizeRegulatoryPdf(ctx: PdfContext, type: 'der' | 'mission', snapshot: Json) {
  const partyNames = snapshot.investors.map((inv: Json) => investorName(inv)).filter(Boolean).join(' / ');
  const documentLabel = type === 'der' ? "Document d'entrée en relation (DER)" : 'Lettre de mission patrimoniale';
  const footerLabel = type === 'der' ? 'DER' : 'Lettre de mission';

  ctx.pdf.setTitle(`${documentLabel} - Eric Bellaiche - ${partyNames}`);
  ctx.pdf.setAuthor('Eric Bellaiche');
  ctx.pdf.setSubject(`${documentLabel} - Conseiller en investissements financiers`);
  ctx.pdf.setCreator('Cabinet Eric Bellaiche - CRM');
  ctx.pdf.setProducer('Cabinet Eric Bellaiche');
  ctx.pdf.setKeywords([footerLabel, 'CIF', 'Eric Bellaiche', 'ORIAS 13001580', 'CNCEF Patrimoine']);
  ctx.pdf.setCreationDate(new Date());
  ctx.pdf.setModificationDate(new Date());

  const pages = ctx.pdf.getPages();
  const total = pages.length;
  const left = `${footerLabel} - Eric Bellaiche - ORIAS 13001580`;
  pages.forEach((page, index) => {
    page.drawLine({
      start: { x: REG_MARGIN, y: 33 },
      end: { x: A4.width - REG_MARGIN, y: 33 },
      thickness: 0.45,
      color: BORDER,
    });
    page.drawText(left, { x: REG_MARGIN, y: 19, size: 6.8, font: ctx.regular, color: MUTED });
    const right = `Page ${index + 1} / ${total}`;
    const rightWidth = ctx.regular.widthOfTextAtSize(right, 6.8);
    page.drawText(right, { x: A4.width - REG_MARGIN - rightWidth, y: 19, size: 6.8, font: ctx.regular, color: MUTED });
  });
}

async function renderOriginalModel(ctx: PdfContext, blocks: RegulatoryModelBlock[], type: 'der' | 'mission', snapshot: Json) {
  const clientLines = originalClientLines(snapshot);
  const clientCity = primaryClientCity(snapshot);
  let insertedMissionClients = false;
  let skipOriginalSignatureLines = false;
  let inDerActivitiesList = false;
  let inDerCommunicationsList = false;

  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    const nextBlock = blocks[index + 1];

    if (block.k === 'table') {
      if (!skipOriginalSignatureLines) drawRegulatoryTable(ctx, block.rows);
      continue;
    }

    let value = replaceSignatureProvider(block.t, type).trim();
    if (!value) continue;

    if (type === 'der' && value.startsWith('Vous pouvez vérifier cette immatriculation sur le site internet')) {
      inDerActivitiesList = true;
    }
    if (type === 'der' && value === 'Informations') {
      inDerActivitiesList = false;
    }
    if (type === 'der' && value === 'Moyens de communication entre Eric Bellaiche et le client') {
      inDerCommunicationsList = true;
    }
    if (type === 'der' && value === 'Mise à jour des informations') {
      inDerCommunicationsList = false;
    }

    if (type === 'der' && value === 'Mr') {
      drawClientCards(ctx, clientLines);
      continue;
    }
    if (type === 'der' && /^Lieu\s*:$/.test(value)) {
      value = `Lieu : ${clientCity}`;
    }

    if (type === 'mission' && !insertedMissionClients && value.includes('Ci-après le(s) « Client(s) »')) {
      drawClientCards(ctx, clientLines);
      insertedMissionClients = true;
    }

    if (type === 'der' && value === 'Lieu, date et signature') {
      drawSignaturePanel(ctx, snapshot, type);
      skipOriginalSignatureLines = true;
      continue;
    }
    if (type === 'der' && skipOriginalSignatureLines && (
      value.startsWith('Le(s) Client(s)') ||
      value.startsWith('Lieu :') ||
      value.startsWith('Date :') ||
      value.startsWith('Signature :')
    )) continue;

    if (type === 'mission' && value === 'Fait à : Fait à : Allevard') {
      drawSignaturePanel(ctx, snapshot, type);
      skipOriginalSignatureLines = true;
      continue;
    }
    if (type === 'mission' && skipOriginalSignatureLines && (
      value.startsWith('Date :') ||
      value.startsWith('Pour le(s) clients') ||
      value.startsWith('Pour le conseiller')
    )) continue;

    if (type === 'der' && value === 'DOCUMENT') {
      const nextText = nextBlock && nextBlock.k !== 'table' ? replaceSignatureProvider(nextBlock.t, type).trim() : '';
      if (nextText === "D'ENTRÉE EN RELATION") {
        ensure(ctx, 54);
        regulatoryText(ctx, "DOCUMENT D'ENTRÉE EN RELATION", { bold: true, size: 18, lineHeight: 21, color: NAVY, after: 10 });
        index += 1;
        continue;
      }
    }

    if (type === 'mission' && value === "Lettre de mission d'Audit Patrimonial Global") {
      const nextText = nextBlock && nextBlock.k !== 'table' ? replaceSignatureProvider(nextBlock.t, type).trim() : '';
      if (nextText === 'et gestion de patrimoine') {
        ensure(ctx, 58);
        regulatoryText(ctx, "Lettre de mission d'Audit Patrimonial Global et gestion de patrimoine", { bold: true, size: 15.2, lineHeight: 18.6, color: NAVY, after: 10 });
        index += 1;
        continue;
      }
    }

    if (type === 'der' && value === '- Immobilier : Rémunération d\'Agent Immobilier') {
      value = '3. Immobilier';
    }
    if (type === 'der' && value === '1. Rémunération d\'Agent Immobilier :') {
      value = "3.1. Rémunération d'Agent Immobilier";
    }

    if (type === 'der' && inDerActivitiesList && derActivityBullet(value)) {
      const display = regulatoryHeadingDisplay(value, type);
      drawBulletParagraph(ctx, display, { bold: true, size: 9.8 });
      continue;
    }

    if (type === 'der' && inDerCommunicationsList && derCommunicationBullet(value)) {
      drawBulletParagraph(ctx, value);
      continue;
    }

    if (type === 'der' && value.startsWith('Assistance patrimoniale à la préparation déclarative fiscale')) {
      const parts = value.split(/\n+/).map((part) => part.trim()).filter(Boolean);
      drawRegulatoryHeading(ctx, parts[0], 3, type);
      if (parts.length > 1) regulatoryText(ctx, parts.slice(1).join(' '), { size: 9.7, lineHeight: 13.1, after: 6 });
      continue;
    }

    if (type === 'der' && value === 'Conseil financier & Assuranciel : Rémunération non indépendante') {
      drawRegulatoryHeading(ctx, 'Conseil financier & assuranciel : rémunération non indépendante', 3, type);
      continue;
    }

    const headingLevel = regulatoryHeadingLevel(block, value, type);
    if (headingLevel) {
      const normalizedHeading = value.trim().toUpperCase();
      const isDerSectorHeading = type === 'der' && normalizedHeading.startsWith('SECTEUR ');
      const shouldStartSectorOnFreshPage =
        isDerSectorHeading &&
        normalizedHeading === 'SECTEUR ASSURANCE' &&
        ctx.y < A4.height - 120;

      if (shouldStartSectorOnFreshPage) addPage(ctx);

      const minBlock =
        nextBlock?.k === 'table'
          ? (headingLevel === 1 ? 210 : headingLevel === 2 ? 175 : 120)
          : headingLevel === 1
            ? 190
            : headingLevel === 2
              ? 125
              : 82;

      ensure(ctx, minBlock);
      drawRegulatoryHeading(ctx, value, headingLevel, type);
      continue;
    }

    if (value === 'Dans votre cas, ce bilan est offert.') {
      drawRegulatoryNote(ctx, value);
      continue;
    }

    if (type === 'der' && derSuppressSourceBullet(value)) {
      regulatoryText(ctx, value, { x: REG_MARGIN + 14, width: A4.width - 2 * REG_MARGIN - 14, size: 9.5, lineHeight: 12.8, after: 4.5 });
      continue;
    }

    if (block.k === 'bullet' || /^[-•]\s+/.test(value)) {
      drawBulletParagraph(ctx, value);
      continue;
    }

    regulatoryText(ctx, value, { size: 9.7, lineHeight: 13.1, after: 6 });
  }
}
async function buildDer(snapshot: Json) {
  const ctx = await newPdfContext('der');
  const blocks = await loadDerModel();
  await renderOriginalModel(ctx, blocks, 'der', snapshot);
  finalizeRegulatoryPdf(ctx, 'der', snapshot);
  return new Uint8Array(await ctx.pdf.save({ useObjectStreams: false }));
}
async function buildMission(snapshot: Json) {
  const ctx = await newPdfContext('mission');
  const blocks = await loadMissionModel();
  await renderOriginalModel(ctx, blocks, 'mission', snapshot);
  finalizeRegulatoryPdf(ctx, 'mission', snapshot);
  return new Uint8Array(await ctx.pdf.save({ useObjectStreams: false }));
}

async function loadSnapshot(client: any, dossierId: string) {
  const [dossierRes, investorRes, sectionRes, sessionRes] = await Promise.all([client.from('dossiers').select('*').eq('id', dossierId).single(), client.from('dossier_investisseurs').select('*,investisseurs(*)').eq('dossier_id', dossierId).order('role_dossier'), client.from('recueil_sections').select('*').eq('dossier_id', dossierId), client.from('questionnaire_sessions').select('*').eq('dossier_id', dossierId)]); for (const r of [dossierRes, investorRes, sectionRes, sessionRes]) if (r.error) throw r.error; const links = investorRes.data ?? []; const investors = links.map((row: Json) => ({ ...(Array.isArray(row.investisseurs) ? row.investisseurs[0] : row.investisseurs), ...row, id: row.investisseur_id })); const sessions = sessionRes.data ?? []; const templateIds = [...new Set(sessions.map((s: Json) => s.template_id).filter(Boolean))]; let templates: Json[] = [], questions: Json[] = [], answers: Json[] = [], options: Json[] = [], qpiResults: Json[] = [], esgPreferences: Json[] = [], qpiProductExperience: Json[] = [], qpiExperienceDetails: Json[] = [];
  if (templateIds.length) { const templateRes = await client.from('questionnaire_templates').select('*').in('id', templateIds); if (templateRes.error) throw templateRes.error; templates = templateRes.data ?? []; const questionRes = await client.from('questionnaire_questions').select('*').in('template_id', templateIds); if (questionRes.error) throw questionRes.error; questions = questionRes.data ?? []; const questionIds = questions.map((q: Json) => q.id); if (questionIds.length) { const optionRes = await client.from('questionnaire_options').select('*').in('question_id', questionIds); if (optionRes.error) throw optionRes.error; options = optionRes.data ?? []; } }
  const sessionIds = sessions.map((s: Json) => s.id); if (sessionIds.length) { const [answerRes, qpiRes, esgRes, expRes, expDetailsRes] = await Promise.all([client.from('questionnaire_answers').select('*').in('session_id', sessionIds), client.from('qpi_results').select('*').in('session_id', sessionIds), client.from('esg_preferences').select('*').in('session_id', sessionIds), client.from('qpi_product_experience').select('*').in('session_id', sessionIds), client.from('qpi_experience_details').select('*').in('session_id', sessionIds)]); for (const r of [answerRes, qpiRes, esgRes, expRes, expDetailsRes]) if (r.error) throw r.error; answers = answerRes.data ?? []; qpiResults = qpiRes.data ?? []; esgPreferences = esgRes.data ?? []; qpiProductExperience = expRes.data ?? []; qpiExperienceDetails = expDetailsRes.data ?? []; }
  const completenessRows: Json[] = [];
  for (const investor of investors) {
    const completionRes = await client.rpc('get_recueil_completeness', { p_dossier_id: dossierId, p_investisseur_id: investor.id });
    if (completionRes.error) throw completionRes.error;
    completenessRows.push({ investisseur_id: investor.id, ...(completionRes.data ?? {}) });
  }
  const templateById: Json = Object.fromEntries(templates.map((t: Json) => [t.id, t])); const optionMap = new Map(options.map((o: Json) => [o.id, o])); const recueilDates = links.map((x: Json) => x.recueil_validated_at).filter(Boolean).sort(); const qpiDates = sessions.filter((s: Json) => templateById[s.template_id]?.type_questionnaire === 'QPI').map((s: Json) => s.completed_at ?? s.validated_at).filter(Boolean).sort(); const esgDates = sessions.filter((s: Json) => templateById[s.template_id]?.type_questionnaire === 'ESG').map((s: Json) => s.completed_at ?? s.validated_at).filter(Boolean).sort(); return { dossier: dossierRes.data, investors, sections: sectionRes.data ?? [], sessions, templates, templateById, questions, answers, options, optionMap, qpiResults, esgPreferences, qpiProductExperience, qpiExperienceDetails, recueilCompleteness: completenessRows, recueil_date: recueilDates.at(-1) ?? dossierRes.data.updated_at, qpi_date: qpiDates.at(-1) ?? dossierRes.data.updated_at, esg_date: esgDates.at(-1) ?? dossierRes.data.updated_at };
}
function validateReady(snapshot: Json, type: DocumentType) {
  if (type === 'recueil') {
    if (!Array.isArray(snapshot.sections) || snapshot.sections.length === 0) throw new Error('Aucune donnée de recueil disponible pour générer le PDF.');
    return;
  }
  if (type === 'qpi') {
    const invalid = snapshot.investors.filter((i: Json) => !['completed', 'validated'].includes(i.qpi_status));
    if (invalid.length) throw new Error('Le profil investisseur doit être terminé pour tous les investisseurs avant génération du PDF.');
    return;
  }
  if (type === 'esg') {
    const invalid = snapshot.investors.filter((i: Json) => !['completed', 'validated', 'not_applicable'].includes(i.esg_status));
    if (invalid.length) throw new Error('Le choix ESG doit être finalisé pour tous les investisseurs avant génération du PDF.');
    return;
  }
  if (type === 'der') {
    const missing = snapshot.investors.filter((i: Json) => {
      const identity = extractByCode(snapshot.sections, i.id).identity ?? {};
      return !i.prenom || !i.nom || !i.email || !identity.civilite;
    });
    if (missing.length) throw new Error("Identité, civilité et e-mail requis pour tous les clients avant génération du DER.");
    return;
  }
  if (type === 'mission') {
    const primary = snapshot.investors[0];
    const map = primary ? extractByCode(snapshot.sections, primary.id) : {};
    const objectives = Array.isArray(map.objectives?.items) ? map.objectives.items : [];
    if (!primary || !['completed', 'validated'].includes(primary.recueil_status) || objectives.length === 0) throw new Error("Le recueil principal validé et les objectifs de mission sont requis avant génération de la lettre de mission.");
    const missingParty = snapshot.investors.some((i: Json) => !i.prenom || !i.nom || !i.email);
    if (missingParty) throw new Error("Les coordonnées des parties sont requises avant génération de la lettre de mission.");
  }
}

function scopeSnapshotToInvestor(snapshot: Json, investorId: string) {
  const investor = snapshot.investors.find((item: Json) => item.id === investorId);
  if (!investor) throw new Error('Investisseur introuvable dans ce dossier.');
  const sessions = snapshot.sessions.filter((session: Json) => session.investisseur_id === investorId);
  const sessionIds = new Set(sessions.map((session: Json) => session.id));
  const qpiDates = sessions.filter((session: Json) => snapshot.templateById[session.template_id]?.type_questionnaire === 'QPI').map((session: Json) => session.completed_at ?? session.validated_at).filter(Boolean).sort();
  const esgDates = sessions.filter((session: Json) => snapshot.templateById[session.template_id]?.type_questionnaire === 'ESG').map((session: Json) => session.completed_at ?? session.validated_at).filter(Boolean).sort();
  return {
    ...snapshot,
    investors: [investor],
    sections: snapshot.sections.filter((section: Json) => section.investisseur_id === investorId),
    sessions,
    answers: snapshot.answers.filter((answer: Json) => sessionIds.has(answer.session_id)),
    qpiResults: snapshot.qpiResults.filter((result: Json) => sessionIds.has(result.session_id)),
    esgPreferences: snapshot.esgPreferences.filter((result: Json) => sessionIds.has(result.session_id)),
    qpiProductExperience: snapshot.qpiProductExperience.filter((result: Json) => sessionIds.has(result.session_id)),
    qpiExperienceDetails: snapshot.qpiExperienceDetails.filter((result: Json) => sessionIds.has(result.session_id)),
    recueilCompleteness: (snapshot.recueilCompleteness ?? []).filter((row: Json) => row.investisseur_id === investorId),
    recueil_date: investor.recueil_validated_at ?? snapshot.recueil_date,
    qpi_date: qpiDates.at(-1) ?? snapshot.qpi_date,
    esg_date: esgDates.at(-1) ?? snapshot.esg_date,
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin'); const headers = corsHeaders(origin); if (req.method === 'OPTIONS') return new Response('ok', { headers }); if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405, headers }); if (origin && !allowedOrigins.has(origin)) return new Response(JSON.stringify({ error: 'Origine non autorisée' }), { status: 403, headers });
  try {
    const auth = req.headers.get('Authorization') ?? ''; if (!auth.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Authentification requise' }), { status: 401, headers }); const supabaseUrl = Deno.env.get('SUPABASE_URL'); const anonKey = Deno.env.get('SUPABASE_ANON_KEY'); const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); if (!supabaseUrl || !anonKey || !serviceKey) throw new Error('Configuration Supabase incomplète'); const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } }); const { data: appUser, error: userError } = await userClient.from('app_users').select('role,actif').maybeSingle(); if (userError) throw userError; if (!appUser?.actif || !['cif', 'admin'].includes(appUser.role)) return new Response(JSON.stringify({ error: 'Accès réservé au cabinet' }), { status: 403, headers });
    const payload = await req.json(); const dossierId = typeof payload?.dossier_id === 'string' ? payload.dossier_id : ''; if (!/^[0-9a-f-]{36}$/i.test(dossierId)) return new Response(JSON.stringify({ error: 'Dossier invalide' }), { status: 400, headers }); const targetInvestorId = typeof payload?.investisseur_id === 'string' ? payload.investisseur_id : ''; if (targetInvestorId && !/^[0-9a-f-]{36}$/i.test(targetInvestorId)) return new Response(JSON.stringify({ error: 'Investisseur invalide' }), { status: 400, headers }); const requested = Array.isArray(payload?.document_types) ? payload.document_types : ['recueil', 'qpi', 'esg']; const types = requested.filter((x: string): x is DocumentType => ['recueil', 'qpi', 'esg', 'der', 'mission'].includes(x)); if (!types.length) return new Response(JSON.stringify({ error: 'Aucun type de document demandé' }), { status: 400, headers }); const fullSnapshot = await loadSnapshot(userClient, dossierId); const snapshot = targetInvestorId ? scopeSnapshotToInvestor(fullSnapshot, targetInvestorId) : fullSnapshot; const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }); const results: Json[] = []; const generationErrors: Json[] = [];
    for (const type of types) {
      try {
        validateReady(snapshot, type);
      const snapshotHash = await sha256Hex(JSON.stringify({ type, version: PDF_VERSION, dossier: snapshot.dossier, investor_id: targetInvestorId || null, investors: snapshot.investors, sections: snapshot.sections, sessions: snapshot.sessions, qpi: snapshot.qpiResults, esg: snapshot.esgPreferences, qpi_experience: snapshot.qpiProductExperience, qpi_experience_details: snapshot.qpiExperienceDetails, answers: snapshot.answers, recueil_completeness: snapshot.recueilCompleteness ?? [] })); const { data: existing } = await admin.from('documents_reglementaires').select('id,storage_bucket,storage_path_pdf,metadata,date_generation').eq('dossier_id', dossierId).eq('type_document', type).eq('version_modele', PDF_VERSION).eq('metadata->>snapshot_hash', snapshotHash).eq('statut', 'generated').order('created_at', { ascending: false }).limit(1).maybeSingle(); if (existing?.storage_path_pdf) { const { data: signed } = await admin.storage.from(existing.storage_bucket ?? BUCKET).createSignedUrl(existing.storage_path_pdf, 3600); results.push({ type, investisseur_id: targetInvestorId || null, format: 'pdf', document_id: existing.id, reused: true, signed_url: signed?.signedUrl ?? null, path: existing.storage_path_pdf }); continue; }
      const bytes = type === 'recueil' ? await buildRecueil(snapshot) : type === 'qpi' ? await buildQuestionnaire(snapshot, 'QPI') : type === 'esg' ? await buildQuestionnaire(snapshot, 'ESG') : type === 'der' ? await buildDer(snapshot) : await buildMission(snapshot); const fileHash = await sha256Hex(bytes); const datePart = new Date().toISOString().slice(0, 10); const reference = slug(snapshot.dossier.reference || snapshot.dossier.libelle || dossierId.slice(0, 8)); const investorSlug = targetInvestorId ? `-${slug(investorName(snapshot.investors[0]))}` : ''; const isRegulatoryHousehold = !targetInvestorId && (type === 'der' || type === 'mission'); const fileName = isRegulatoryHousehold ? regulatoryPdfFileName(type as 'der' | 'mission', snapshot, datePart) : `${type}-${reference}${investorSlug}-${datePart}-${fileHash.slice(0, 10)}.pdf`; const storagePath = targetInvestorId ? `${dossierId}/${targetInvestorId}/${type}/${fileName}` : isRegulatoryHousehold ? `${dossierId}/${type}/${fileHash.slice(0, 10)}/${fileName}` : `${dossierId}/${type}/${fileName}`; const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, bytes, { contentType: 'application/pdf', upsert: true }); if (uploadError) throw uploadError; const { data: row, error: insertError } = await admin.from('documents_reglementaires').insert({ dossier_id: dossierId, type_document: type, version_modele: PDF_VERSION, statut: 'generated', storage_bucket: BUCKET, storage_path_pdf: storagePath, date_generation: new Date().toISOString(), hash_sha256: fileHash, metadata: { snapshot_hash: snapshotHash, generated_from: 'portal_supabase_pdf', final_format: 'pdf', signature_provider: ['der','mission'].includes(type) ? 'youtrust_manual' : 'youtrust', signature_status: ['der','mission'].includes(type) ? 'pdf_ready_for_manual_upload' : type === 'recueil' && !((snapshot.recueilCompleteness ?? []).length > 0 && (snapshot.recueilCompleteness ?? []).every((row: Json) => row.complete === true)) ? 'draft' : 'ready_to_send', recueil_complete: type === 'recueil' ? ((snapshot.recueilCompleteness ?? []).length > 0 && (snapshot.recueilCompleteness ?? []).every((row: Json) => row.complete === true)) : null, recueil_percentage: type === 'recueil' && (snapshot.recueilCompleteness ?? []).length ? Math.round((snapshot.recueilCompleteness ?? []).reduce((sum: number, row: Json) => sum + Number(row.percentage ?? 0), 0) / (snapshot.recueilCompleteness ?? []).length) : null, document_date: type === 'recueil' ? snapshot.recueil_date : type === 'qpi' ? snapshot.qpi_date : type === 'esg' ? snapshot.esg_date : new Date().toISOString(), investor_id: targetInvestorId || null, investor_ids: snapshot.investors.map((i: Json) => i.id), source_word_generator: 'generate-cif-documents' } }).select('id').single(); if (insertError) throw insertError; const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(storagePath, 3600); results.push({ type, investisseur_id: targetInvestorId || null, format: 'pdf', document_id: row.id, reused: false, signed_url: signed?.signedUrl ?? null, path: storagePath, hash_sha256: fileHash });
      } catch (documentError) {
        const message = documentError instanceof Error ? documentError.message : 'Génération impossible';
        console.error('generate-cif-pdfs document', { dossierId, targetInvestorId, type, message });
        generationErrors.push({ type, investisseur_id: targetInvestorId || null, error: message });
      }
    }
    return new Response(JSON.stringify({ ok: generationErrors.length === 0, partial: results.length > 0 && generationErrors.length > 0, version: PDF_VERSION, format: 'pdf', documents: results, errors: generationErrors }), { status: 200, headers });
  } catch (error) { console.error('generate-cif-pdfs', error); const message = error instanceof Error ? error.message : 'Génération PDF impossible'; return new Response(JSON.stringify({ error: message }), { status: 500, headers }); }
});