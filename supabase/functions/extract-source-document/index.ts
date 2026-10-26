import { createClient } from 'npm:@supabase/supabase-js@2';
import { extractText, getDocumentProxy } from 'npm:unpdf@1.8.1';
import { unzipSync } from 'npm:fflate@0.8.2';

const allowedOrigins = new Set([
  'https://eric-bellaiche.fr',
  'https://www.eric-bellaiche.fr',
  'http://localhost:5173',
]);

type Json = Record<string, any>;
type Member = { investisseur_id: string; role_dossier: string; prenom: string; nom: string };

function cors(origin: string | null) {
  const allowed = origin && allowedOrigins.has(origin) ? origin : 'https://eric-bellaiche.fr';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
  };
}

function normalizeText(value: string) {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[\t ]+/g, ' ')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

function identityText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseFrenchNumber(raw: string): number | null {
  const cleaned = raw
    .replace(/[€%]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function numberCandidates(text: string) {
  const matches = text.match(/-?(?:\d{1,3}(?:[ .\u00a0]\d{3})+|\d+)(?:[,.]\d{1,2})?/g) ?? [];
  return matches
    .map((raw) => ({ raw, value: parseFrenchNumber(raw) }))
    .filter((item) => item.value !== null) as Array<{ raw: string; value: number }>;
}

function findLineNumber(
  pages: string[],
  label: RegExp,
  opts: { min?: number; max?: number; percent?: boolean; preferLast?: boolean } = {},
): { value: number; page: number } | null {
  const min = opts.min ?? -Infinity;
  const max = opts.max ?? Infinity;
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const lines = pages[pageIndex].split('\n');
    for (const line of lines) {
      const re = new RegExp(label.source, label.flags.replace('g', ''));
      const match = re.exec(line);
      if (!match) continue;
      const after = line.slice(match.index + match[0].length);
      if (opts.percent) {
        const percentages = [...after.matchAll(/(-?\d{1,2}(?:[,.]\d{1,2})?)\s*%/g)]
          .map((m) => parseFrenchNumber(m[1]))
          .filter((v): v is number => v !== null && v >= min && v <= max);
        if (percentages.length) return { value: opts.preferLast === false ? percentages[0] : percentages.at(-1)!, page: pageIndex + 1 };
      } else {
        const values = numberCandidates(after).map((x) => x.value).filter((v) => v >= min && v <= max);
        if (values.length) return { value: opts.preferLast === false ? values[0] : values.at(-1)!, page: pageIndex + 1 };
      }
    }
  }
  return null;
}

async function findPdfRowValues(
  pdf: any,
  label: RegExp,
  opts: { min?: number; max?: number } = {},
): Promise<{ values: number[]; page: number } | null> {
  const min = opts.min ?? -Infinity;
  const max = opts.max ?? Infinity;
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const items = (content.items ?? [])
      .filter((item: any) => typeof item?.str === 'string')
      .map((item: any) => ({ str: String(item.str ?? '').trim(), x: Number(item.transform?.[4] ?? 0), y: Number(item.transform?.[5] ?? 0), width: Number(item.width ?? 0) }))
      .filter((item: any) => item.str);

    for (const target of items) {
      const re = new RegExp(label.source, label.flags.replace('g',''));
      if (!re.test(target.str)) continue;
      const row = items
        .filter((item: any) => Math.abs(item.y - target.y) <= 2.4 && item.x > target.x + Math.max(target.width * 0.65, 12))
        .sort((a: any,b: any) => a.x - b.x);
      const values = row.flatMap((item: any) => numberCandidates(item.str).map((candidate) => candidate.value))
        .filter((value: number) => value >= min && value <= max);
      if (values.length) return { values, page: pageNo };
    }
  }
  return null;
}

async function findPdfRowTextRight(pdf: any, label: RegExp): Promise<{ value: string; page: number } | null> {
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const items = (content.items ?? [])
      .filter((item: any) => typeof item?.str === 'string')
      .map((item: any) => ({ str: String(item.str ?? '').trim(), x: Number(item.transform?.[4] ?? 0), y: Number(item.transform?.[5] ?? 0), width: Number(item.width ?? 0) }))
      .filter((item: any) => item.str);

    for (const target of items) {
      const re = new RegExp(label.source, label.flags.replace('g',''));
      if (!re.test(target.str)) continue;
      const right = items
        .filter((item: any) => Math.abs(item.y - target.y) <= 2.4 && item.x > target.x + Math.max(target.width * 0.65, 12))
        .sort((a: any,b: any) => a.x - b.x)
        .map((item: any) => item.str)
        .join(' ')
        .trim();
      if (right) return { value: right, page: pageNo };
    }
  }
  return null;
}

function findDateNear(pages: string[], label: RegExp): { value: string; page: number } | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pages[pageIndex];
    const re = new RegExp(label.source, label.flags.replace('g', ''));
    const match = re.exec(page);
    if (!match) continue;
    const slice = page.slice(match.index + match[0].length, match.index + match[0].length + 240);
    const date = slice.match(/(\d{2})[\/.\-](\d{2})[\/.\-](20\d{2})/);
    if (date) return { value: `${date[3]}-${date[2]}-${date[1]}`, page: pageIndex + 1 };
  }
  return null;
}

function findTaxParts(pages: string[], rfr: number | null) {
  const direct = findLineNumber(pages, /Nombre de parts/i, { min: 0.5, max: 20, preferLast: true });
  if (direct) return direct;
  if (!rfr || !pages[0]) return null;

  const lines = pages[0].split('\n');
  const normalizedRfr = String(Math.round(rfr));
  for (let i = 0; i < lines.length; i++) {
    const digits = lines[i].replace(/[^0-9]/g, '');
    if (digits !== normalizedRfr) continue;
    for (let j = i + 1; j <= Math.min(lines.length - 1, i + 4); j++) {
      const values = numberCandidates(lines[j]).map((x) => x.value).filter((v) => v >= 0.5 && v <= 20);
      if (values.length) return { value: values[0], page: 1 };
    }
  }
  return null;
}

function findStringNear(pages: string[], label: RegExp, valuePattern: RegExp): { value: string; page: number } | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pages[pageIndex];
    const re = new RegExp(label.source, label.flags.replace('g', ''));
    const match = re.exec(page);
    if (!match) continue;
    const slice = page.slice(match.index + match[0].length, match.index + match[0].length + 220);
    const value = valuePattern.exec(slice);
    if (value?.[1]) return { value: value[1].trim(), page: pageIndex + 1 };
  }
  return null;
}

function amountToBand(amount: number) {
  if (amount < 10_000) return 'under_10k';
  if (amount < 50_000) return '10k_50k';
  if (amount < 100_000) return '50k_100k';
  if (amount < 250_000) return '100k_250k';
  if (amount < 500_000) return '250k_500k';
  return 'over_500k';
}

function institutionFromText(name: string, text: string) {
  const lower = `${name} ${text}`.toLowerCase();
  if (lower.includes('cic')) return 'CIC';
  if (lower.includes('interactive brokers') || lower.includes('ibkr')) return 'Interactive Brokers';
  if (lower.includes('bnp')) return 'BNP Paribas';
  if (lower.includes('crédit agricole') || lower.includes('credit agricole')) return 'Crédit Agricole';
  if (lower.includes('banque populaire')) return 'Banque Populaire';
  if (lower.includes('axa')) return 'AXA';
  return null;
}

function detectMembers(text: string, members: Member[]) {
  const haystack = identityText(text);
  return members.filter((member) => {
    const first = identityText(member.prenom);
    const last = identityText(member.nom);
    if (!first || !last) return false;
    return haystack.includes(`${first} ${last}`) || haystack.includes(`${last} ${first}`);
  }).map((member) => member.investisseur_id);
}

function uniqueIds(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

async function findPdfRowNumber(
  pdf: any,
  label: RegExp,
  opts: { min?: number; max?: number; percent?: boolean } = {},
): Promise<{ value: number; page: number } | null> {
  const min = opts.min ?? -Infinity;
  const max = opts.max ?? Infinity;
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const items = (content.items ?? [])
      .filter((item: any) => typeof item?.str === 'string')
      .map((item: any) => ({
        str: String(item.str ?? '').trim(),
        x: Number(item.transform?.[4] ?? 0),
        y: Number(item.transform?.[5] ?? 0),
        width: Number(item.width ?? 0),
      }))
      .filter((item: any) => item.str);

    for (const target of items) {
      const re = new RegExp(label.source, label.flags.replace('g',''));
      if (!re.test(target.str)) continue;
      const row = items
        .filter((item: any) => Math.abs(item.y - target.y) <= 2.2 && item.x > target.x + Math.max(target.width * 0.65, 12))
        .sort((a: any,b: any) => a.x - b.x);

      const joined = row.map((item: any) => item.str).join('');
      const joinedValues = numberCandidates(joined).map((candidate) => candidate.value)
        .filter((value) => value >= min && value <= max);
      if (joinedValues.length) {
        if (!opts.percent || /%/.test(joined) || joinedValues[0] <= 45) {
          return { value: joinedValues[0], page: pageNo };
        }
      }

      for (const item of row) {
        const values = numberCandidates(item.str).map((candidate) => candidate.value)
          .filter((value) => value >= min && value <= max);
        if (!values.length) continue;
        if (opts.percent && !/%/.test(item.str) && values[0] > 45) continue;
        return { value: values[0], page: pageNo };
      }
    }
  }
  return null;
}

async function ocrImage(bytes: Uint8Array) {
  const { Buffer } = await import('node:buffer');
  const mod: any = await import('npm:nocr@1.2.0');
  const nocr: any = mod.default ?? mod;
  if (typeof nocr.decodeBuffer !== 'function') throw new Error('OCR engine unavailable');
  const text = await new Promise<string>((resolve, reject) => {
    nocr.decodeBuffer(Buffer.from(bytes), (error: unknown, value: unknown) => {
      if (error) reject(error);
      else resolve(String(value ?? ''));
    });
  });
  const normalized = normalizeText(text);
  return {
    text: normalized,
    confidence: normalized.replace(/\s/g,'').length >= 8 ? 80 : 0,
  };
}

function financialInstrument(fileName: string, text: string) {
  const haystack = `${fileName} ${text}`.toLowerCase();
  if (/livret\s*a/.test(haystack)) return 'Livret A';
  if (/ldds|livret de développement durable/.test(haystack)) return 'LDDS';
  if (/ibkr|interactive brokers/.test(haystack)) return 'Compte-titres / bourse';
  if (/pee|plan d.?épargne entreprise/.test(haystack)) return 'PEE';
  if (/\bper\b|plan d.?épargne retraite/.test(haystack)) return 'PER';
  if (/assurance.?vie/.test(haystack)) return 'Assurance-vie';
  if (/crypto|bitcoin|ethereum/.test(haystack)) return 'Cryptoactifs';
  return 'Placement financier';
}

function parseFinancialDisplayNumber(raw: string, brokerStyle = false) {
  let value = raw.trim().replace(/\s+/g,'');
  const k = /k$/i.test(value);
  value = value.replace(/k$/i,'');
  if (brokerStyle && /^-?\d{1,3},\d{3}$/.test(value)) {
    value = value.replace(',','');
  } else if (/^-?\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(value)) {
    value = value.replace(/\./g,'').replace(',','.');
  } else if (/^-?\d{1,3}(?: \d{3})+(?:,\d{1,2})?$/.test(raw.trim())) {
    value = raw.trim().replace(/ /g,'').replace(',','.');
  } else if (/^-?\d+[.,]\d{1,2}$/.test(value)) {
    value = value.replace(',','.');
  } else if (/^-?\d{1,3}(?:,\d{3})+$/.test(value)) {
    value = value.replace(/,/g,'');
  }
  const n = Number(value.replace(/[^0-9.-]/g,''));
  if (!Number.isFinite(n)) return null;
  return k ? n * 1000 : n;
}

function financialNumberCandidates(line: string, brokerStyle = false) {
  const matches = line.match(/-?\d[\d\s.,]*(?:[kK])?/g) ?? [];
  return matches
    .map((raw) => parseFinancialDisplayNumber(raw, brokerStyle))
    .filter((value): value is number => value !== null && value >= 0 && value <= 100000000);
}

function findFinancialImageAmount(text: string, instrument: string) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const brokerStyle = /bourse|titres/i.test(instrument) || /ibkr|interactive brokers/i.test(text);

  const rules = /livret|ldds/i.test(instrument)
    ? [/(?:solde au|solde disponible|solde comptable|encours)/i]
    : [
        /(?:valeur nette liquidative|net liquidation value|net asset value|valorisation(?: totale)?|valeur du portefeuille)/i,
        /(?:total des espèces|total portefeuille|total des avoirs|solde disponible|encours total)/i,
      ];

  for (const pattern of rules) {
    for (let i = 0; i < lines.length; i++) {
      if (!pattern.test(lines[i])) continue;
      for (const candidateLine of lines.slice(i, Math.min(lines.length, i + 3))) {
        const amounts = financialNumberCandidates(candidateLine, brokerStyle)
          .filter((value) => value >= 100);
        if (amounts.length) return amounts[0];
      }
    }
  }

  const currencyAmounts: number[] = [];
  for (const line of lines) {
    if (!/(?:€|EUR|USD|CHF|\bK\b)/i.test(line)) continue;
    currencyAmounts.push(...financialNumberCandidates(line, brokerStyle).filter((value) => value >= 100));
  }
  return currencyAmounts.length ? Math.max(...currencyAmounts) : null;
}

function parseFinancialImage(
  text: string,
  confidence: number,
  documentId: string,
  fileName: string,
  targetIds: string[],
  members: Member[],
) {
  const institution = institutionFromText(fileName, text);
  const instrument = financialInstrument(fileName, text);
  const amount = findFinancialImageAmount(text, instrument);
  const owner = targetIds.length === 1 ? members.find((member) => member.investisseur_id === targetIds[0]) : null;
  const item: Json = {
    type_placement: instrument,
    organisme: institution ?? 'Non identifié',
    proprietaire: owner ? `${owner.prenom} ${owner.nom}`.trim() : targetIds.length > 1 ? 'Foyer' : 'Non identifié',
    source_file: fileName,
    source_type: 'justificatif_image',
    ocr_confidence: Math.round(confidence * 10) / 10,
  };
  if (amount !== null) item.montant = Math.round(amount * 100) / 100;

  const safe = targetIds.length === 1 && amount !== null && amount >= 100 && confidence >= 45;
  return {
    patches: safe ? [{
      section_code: 'financial',
      target_investisseur_ids: targetIds,
      fields: { __merge_financial_items: [item] },
      source_pages: { __merge_financial_items: 'image' },
    }] : [],
    summary: {
      parser: 'financial_image_ocr_v1',
      file_name: fileName,
      institution,
      instrument,
      extracted_amount: amount,
      ocr_confidence: Math.round(confidence * 10) / 10,
      tax_declarant_mapping: [
        { source_declarant: 1, name: fields.nom_declarant_1 ?? null, investisseur_id: memberForDeclarant1?.investisseur_id ?? null, role_dossier: memberForDeclarant1?.role_dossier ?? null },
        { source_declarant: 2, name: fields.nom_declarant_2 ?? null, investisseur_id: memberForDeclarant2?.investisseur_id ?? null, role_dossier: memberForDeclarant2?.role_dossier ?? null },
      ],
      source_document_id: documentId,
      ocr_text_excerpt: text.slice(0, 1200),
    },
    status: safe ? 'extracted' : 'to_review',
  };
}

async function parseTaxNotice(pdf: any, pages: string[], documentId: string, fileName: string, targetIds: string[], members: Member[]) {
  const all = pages.join('\n');
  const yearMatch = all.match(/revenus (?:de |per[cç]us en )?(20\d{2})/i);
  const incomeYear = yearMatch ? Number(yearMatch[1]) : null;
  const assessmentYear = incomeYear && incomeYear >= 2000 && incomeYear <= 2100 ? incomeYear + 1 : null;

  const revenuImposable = await findPdfRowNumber(pdf, /Revenu imposable/i, { min: 0, max: 10000000 })
    ?? findLineNumber(pages, /^\s*Revenu imposable/i, { min: 0, max: 10000000 });
  const rfr = await findPdfRowNumber(pdf, /Revenu fiscal de r[ée]f[ée]rence/i, { min: 1000, max: 10000000 })
    ?? findLineNumber(pages, /Revenu fiscal de r[ée]f[ée]rence/i, { min: 1000, max: 10000000 });
  const parts = await findPdfRowNumber(pdf, /Nombre de parts/i, { min: 0.5, max: 20 })
    ?? findTaxParts(pages, rfr?.value ?? null);
  const impotNet = await findPdfRowNumber(pdf, /Total de l['’]imp[oô]t sur le revenu net/i, { min: 0, max: 1000000 })
    ?? findLineNumber(pages, /Total de l['’]imp[oô]t sur le revenu net/i, { min: 0, max: 1000000 });
  const prelevements = await findPdfRowNumber(pdf, /Total des pr[ée]l[èe]vements sociaux nets/i, { min: 0, max: 1000000 })
    ?? findLineNumber(pages, /Total des pr[ée]l[èe]vements sociaux nets/i, { min: 0, max: 1000000 });
  const tmi = await findPdfRowNumber(pdf, /Taux marginal d['’]imposition/i, { min: 0, max: 45, percent: true })
    ?? findLineNumber(pages, /Taux marginal d['’]imposition/i, { min: 0, max: 45, percent: true });
  const tauxMoyen = await findPdfRowNumber(pdf, /Taux moyen d['’]imposition/i, { min: 0, max: 100, percent: true })
    ?? findLineNumber(pages, /Taux moyen d['’]imposition/i, { min: 0, max: 100, percent: true });
  const revenusFonciers = await findPdfRowNumber(pdf, /Revenus fonciers nets/i, { min: 0, max: 10000000 })
    ?? findLineNumber(pages, /^\s*Revenus fonciers nets/i, { min: 0, max: 10000000 });

  const fields: Json = {};
  const sourcePages: Json = {};

  if (assessmentYear) fields.annee_imposition = String(assessmentYear);
  const found: Record<string, { value: number; page: number } | null> = {
    revenu_imposable: revenuImposable,
    revenu_fiscal_reference: rfr,
    nombre_parts: parts,
    impot_revenu_net: impotNet,
    prelevements_sociaux_nets: prelevements,
    tmi,
    taux_imposition: tauxMoyen,
    revenus_fonciers_nets: revenusFonciers,
  };

  for (const [key, item] of Object.entries(found)) {
    if (!item) continue;
    fields[key] = String(Math.round(item.value * 100) / 100);
    sourcePages[key] = String(item.page);
  }

  const putTax = (key: string, value: unknown, page?: number) => {
    if (value === null || value === undefined || String(value).trim() === '') return;
    fields[key] = typeof value === 'number' ? String(Math.round(value * 100) / 100) : String(value).trim();
    if (page) sourcePages[key] = String(page);
  };
  const at = (row: { values:number[]; page:number } | null, index: number) => row && row.values.length > index ? row.values[index] : null;
  const last = (row: { values:number[]; page:number } | null) => row?.values?.length ? row.values[row.values.length - 1] : null;

  const fiscal1 = await findPdfRowTextRight(pdf, /D[ée]clarant 1 \(C\)/i);
  const fiscal2 = await findPdfRowTextRight(pdf, /D[ée]clarant 2 \(C\)/i);
  if (fiscal1 && /^\d{2}(?:\s+\d{2}){1,}\s+\d{3}$/.test(fiscal1.value)) putTax('numero_fiscal_declarant_1', fiscal1.value, fiscal1.page);
  if (fiscal2 && /^\d{2}(?:\s+\d{2}){1,}\s+\d{3}$/.test(fiscal2.value)) putTax('numero_fiscal_declarant_2', fiscal2.value, fiscal2.page);
  const name1 = all.match(/D[ée]clarant 1\s*-\s*Nom de naissance\s*:\s*([^\n]+)/i);
  const name2 = all.match(/D[ée]clarant 2\s*-\s*Nom de naissance\s*:\s*([^\n]+)/i);
  if (name1?.[1]) putTax('nom_declarant_1', name1[1], 2);
  if (name2?.[1]) putTax('nom_declarant_2', name2[1], 2);

  const salaries = await findPdfRowValues(pdf, /^\s*Salaires\.{2,}/i, { min: 0, max: 10000000 });
  putTax('salaires_declarant_1', at(salaries,0), salaries?.page);
  putTax('salaires_declarant_2', at(salaries,1), salaries?.page);
  const totalSalaires = await findPdfRowValues(pdf, /Total des salaires et assimil[ée]s/i, { min: 0, max: 10000000 });
  putTax('total_salaires_declarant_1', at(totalSalaires,0), totalSalaires?.page);
  putTax('total_salaires_declarant_2', at(totalSalaires,1), totalSalaires?.page);
  const deduction = await findPdfRowValues(pdf, /D[ée]duction 10%|D[ée]duction 10 %|frais r[ée]els/i, { min: 0, max: 10000000 });
  putTax('deduction_10_declarant_1', at(deduction,0), deduction?.page);
  putTax('deduction_10_declarant_2', at(deduction,1), deduction?.page);
  const salairesNets = await findPdfRowValues(pdf, /Salaires, pensions, rentes nets/i, { min: 0, max: 10000000 });
  putTax('salaires_nets_declarant_1', at(salairesNets,0), salairesNets?.page);
  putTax('salaires_nets_declarant_2', at(salairesNets,1), salairesNets?.page);

  const extraSingles: Array<[string, RegExp, number, number]> = [
    ['revenu_brut_global', /Revenu brut global/i, 0, 10000000],
    ['csg_deductible_revenu_global', /^\s*CSG d[ée]ductible/i, 0, 10000000],
    ['revenus_taux_forfaitaire', /Revenus au taux forfaitaire/i, 0, 10000000],
    ['impot_revenus_bareme', /Imp[oô]t sur les revenus soumis au bar[èe]me/i, 0, 1000000],
    ['decote', /^\s*D[ée]cote/i, 0, 1000000],
    ['impot_proportionnel', /Imp[oô]t proportionnel/i, 0, 1000000],
    ['impot_total_avant_credits', /Imp[oô]t total avant cr[ée]dits d['’]imp[oô]t/i, 0, 1000000],
    ['credit_impot_calcule', /Montant du cr[ée]dit d['’]imp[oô]t calcul[ée]/i, 0, 1000000],
    ['rcm_deja_soumis_ps_csg_deductible', /RCM d[ée]j[àa] soumis aux pr[ée]l[èe]vements sociaux/i, 0, 10000000],
  ];
  for (const [key,label,min,max] of extraSingles) {
    const item = await findPdfRowNumber(pdf, label, { min, max });
    if (item) putTax(key,item.value,item.page);
  }

  const foreignTax = await findPdfRowValues(pdf, /Imp[oô]t [ée]tranger imput[ée] sur l['’]IR/i, { min: 0, max: 1000000 });
  putTax('impot_etranger_declare', at(foreignTax,0), foreignTax?.page);
  putTax('impot_etranger_impute', at(foreignTax,1), foreignTax?.page);
  const forfait = await findPdfRowValues(pdf, /Pr[ée]l[èe]vement forfaitaire d[ée]j[àa] vers[ée]/i, { min: 0, max: 1000000 });
  putTax('prelevement_forfaitaire_deja_verse', last(forfait), forfait?.page);
  const garde = await findPdfRowValues(pdf, /Frais de garde des jeunes enfants/i, { min: 0, max: 1000000 });
  putTax('frais_garde_declares', at(garde,0), garde?.page);
  putTax('frais_garde_retenus', at(garde,1), garde?.page);

  const psRcm = await findPdfRowValues(pdf, /Revenus de capitaux mobiliers/i, { min: 0, max: 10000000 });
  putTax('revenus_capitaux_mobiliers_ps', at(psRcm,0), psRcm?.page);
  const psPv = await findPdfRowValues(pdf, /Plus-values et gains divers/i, { min: 0, max: 10000000 });
  putTax('plus_values_gains_divers_ps', at(psPv,0), psPv?.page);
  const psBase = await findPdfRowValues(pdf, /BASE IMPOSABLE/i, { min: 0, max: 10000000 });
  putTax('base_prelevements_sociaux', at(psBase,0), psBase?.page);
  const psRates = await findPdfRowValues(pdf, /Taux de l['’]imposition/i, { min: 0, max: 100 });
  putTax('taux_csg_crds', at(psRates,0), psRates?.page);
  putTax('taux_prelevement_solidarite', at(psRates,1), psRates?.page);
  const psAmounts = await findPdfRowValues(pdf, /Montant de l['’]imposition/i, { min: 0, max: 1000000 });
  putTax('montant_csg_crds', at(psAmounts,0), psAmounts?.page);
  putTax('montant_prelevement_solidarite', at(psAmounts,1), psAmounts?.page);

  const perRows: Array<[string,string,RegExp]> = [
    ['plafond_total_2024_declarant_1','plafond_total_2024_declarant_2',/Plafond total de 2024/i],
    ['plafond_non_utilise_2023_declarant_1','plafond_non_utilise_2023_declarant_2',/Plafond non utilis[ée] pour les revenus de 2023/i],
    ['plafond_non_utilise_2024_declarant_1','plafond_non_utilise_2024_declarant_2',/Plafond non utilis[ée] pour les revenus de 2024/i],
    ['plafond_non_utilise_2025_declarant_1','plafond_non_utilise_2025_declarant_2',/Plafond non utilis[ée] pour les revenus de 2025/i],
    ['plafond_calcule_revenus_2025_declarant_1','plafond_calcule_revenus_2025_declarant_2',/Plafond calcul[ée] sur les revenus de 2025/i],
    ['plafond_per_2026_declarant_1','plafond_per_2026_declarant_2',/Plafond pour les cotisations vers[ée]es en 2026/i],
  ];
  for (const [key1,key2,label] of perRows) {
    const values = await findPdfRowValues(pdf,label,{min:0,max:1000000});
    putTax(key1,at(values,0),values?.page);
    putTax(key2,at(values,1),values?.page);
  }

  const matchMember = (rawName: unknown) => {
    const wanted = identityText(String(rawName ?? ''));
    if (!wanted) return null;
    return members.find((member) => {
      const familyFirst = identityText(`${member.nom} ${member.prenom}`);
      const givenFirst = identityText(`${member.prenom} ${member.nom}`);
      return wanted === familyFirst || wanted === givenFirst || wanted.includes(familyFirst) || wanted.includes(givenFirst);
    }) ?? null;
  };
  const memberForDeclarant1 = matchMember(fields.nom_declarant_1);
  const memberForDeclarant2 = matchMember(fields.nom_declarant_2);
  const suffixFor = (member: Member | null) => member?.role_dossier === 'investisseur_1'
    ? 'identifiant_1'
    : member?.role_dossier === 'investisseur_2'
      ? 'identifiant_2'
      : null;

  for (const [sourceSuffix, member] of [['_declarant_1', memberForDeclarant1], ['_declarant_2', memberForDeclarant2]] as const) {
    const targetSuffix = suffixFor(member);
    if (!targetSuffix) continue;
    for (const key of Object.keys(fields)) {
      if (!key.endsWith(sourceSuffix)) continue;
      const mappedKey = `${key.slice(0, -sourceSuffix.length)}_${targetSuffix}`;
      fields[mappedKey] = fields[key];
      if (sourcePages[key]) sourcePages[mappedKey] = sourcePages[key];
    }
  }

  const required = ['annee_imposition','revenu_imposable','revenu_fiscal_reference','nombre_parts','tmi','impot_revenu_net'];
  const missingRequired = required.filter((key) => fields[key] === undefined || fields[key] === '');

  return {
    patches: Object.keys(fields).length ? [{
      section_code: 'tax',
      target_investisseur_ids: targetIds,
      fields,
      source_pages: sourcePages,
    }] : [],
    summary: {
      parser: 'avis_imposition_fr_v3',
      file_name: fileName,
      extracted_fields: Object.keys(fields),
      extracted_field_count: Object.keys(fields).length,
      missing_required_tax_fields: missingRequired,
      direct_completion_possible: missingRequired.length === 0,
      source_document_id: documentId,
    },
    status: missingRequired.length === 0 ? 'extracted' : 'to_review',
  };
}



type CreditScheduleRow = {
  n:number;date:string;payment:number;fees:number;interest:number;capital:number;crd:number;unpaid:number;
  balanceReliable:boolean; rawValues:number[]; reader:'pdf_native'|'ocr_embedded_image';
};
type ScheduleEvidence = {
  rows:CreditScheduleRow[];
  validation: {status:'verified'|'insufficient'|'ambiguous'; source:string; numeric_columns:number|null;
    balance_column:number|null; principal_column:number|null; pairs_checked:number; pairs_valid:number;
    decreasing_pairs:number; method:string};
};
function creditDate(raw:string) {
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;
  const fr = raw.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
  return fr ? fr[3]+'-'+fr[2]+'-'+fr[1] : null;
}
function parseCreditScheduleLines(lines:string[],reader:'pdf_native'|'ocr_embedded_image'='pdf_native'): CreditScheduleRow[] {
  const rows:CreditScheduleRow[] = [];
  const moneyRe = /-?(?:\d{1,3}(?:[ .\u00a0\u202f]\d{3})+|\d+)(?:,\d{2}|\.\d{2})/g;
  for (const original of lines) {
    const line=original.replace(/[\u00a0\u202f]/g,' ').replace(/\s+/g,' ').trim();
    const match=line.match(/^(\d{1,4})\s+(\d{2}[./-]\d{2}[./-]\d{4}|\d{4}-\d{2}-\d{2})\s+(.+)$/);
    if(!match)continue;
    const date=creditDate(match[2]);if(!date)continue;
    const values=[...match[3].matchAll(moneyRe)].map((m)=>parseFrenchNumber(m[0]));
    if(values.length<4||values.length>7||values.some((v)=>v===null))continue;
    const v=values as number[];
    if(v[0]<=0||v[0]>200000||v.some((n)=>!Number.isFinite(n)||Math.abs(n)>10000000))continue;
    rows.push({
      n:Number(match[1]),date,payment:v[0],fees:0,interest:0,capital:0,crd:0,unpaid:0,
      balanceReliable:false,rawValues:v,reader,
    });
  }
  const byKey=new Map<string,CreditScheduleRow>();
  for(const row of rows)byKey.set(row.n+'|'+row.date,row);
  return [...byKey.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.n-b.n);
}
function validateCreditSchedule(rawRows:CreditScheduleRow[],reader:'pdf_native'|'ocr_embedded_image'):ScheduleEvidence {
  const rows=[...rawRows].sort((a,b)=>a.date.localeCompare(b.date)||a.n-b.n);
  const layouts:Array<{width:number;balance:number;principal:number;checked:number;valid:number;declining:number;score:number}>=[];
  for(const width of [4,5,6,7]){
    const ofWidth=rows.filter((row)=>row.rawValues.length===width);
    if(ofWidth.length<6)continue;
    // A fifth numeric field can mean "outstanding" OR "unpaid"; never assume its role.
    for(const balance of [width-1,width-2]){
      if(balance<3)continue;
      for(let principal=1;principal<width;principal++){
        if(principal===balance)continue;
        let checked=0,valid=0,declining=0;
        for(let i=1;i<ofWidth.length;i++){
          const previous=ofWidth[i-1],current=ofWidth[i];
          if(current.n!==previous.n+1||current.date<=previous.date)continue;
          const before=previous.rawValues[balance],after=current.rawValues[balance];
          const paidCapital=current.rawValues[principal];
          if(before<0||after<0||before>10000000||after>10000000||after>before+0.15||paidCapital<0)continue;
          const difference=before-after;
          checked++;
          if(difference>0.15) declining++;
          if(Math.abs(difference-paidCapital)<=Math.max(0.35,current.payment*0.001))valid++;
        }
        if(checked<5||declining<3||valid/checked<0.94)continue;
        layouts.push({width,balance,principal,checked,valid,declining,
          score:(valid/checked)*10000+checked+declining*0.01});
      }
    }
  }
  layouts.sort((a,b)=>b.score-a.score);
  const top=layouts[0]??null,second=layouts[1]??null;
  // A different column pair that checks almost as well requires manual arbitration.
  const ambiguous=Boolean(top&&second&&top.width===second.width&&
    (top.balance!==second.balance||top.principal!==second.principal)&&
    second.valid/second.checked>=0.94&&
    Math.abs(top.score-second.score)<2);
  if(top&&!ambiguous){
    for(const row of rows){
      if(row.rawValues.length!==top.width)continue;
      const v=row.rawValues;
      row.crd=v[top.balance];
      row.capital=v[top.principal];
      row.interest=Math.max(0,row.payment-row.capital);
      row.balanceReliable=true;
    }
  }
  return {rows,validation:{
    status:top?(ambiguous?'ambiguous':'verified'):'insufficient',source:reader,
    numeric_columns:top?.width??null,balance_column:top?.balance??null,
    principal_column:top?.principal??null,pairs_checked:top?.checked??0,
    pairs_valid:top?.valid??0,decreasing_pairs:top?.declining??0,
    method:'adjacent CRD difference equals principal repaid on successive dated instalments',
  }};
}
/** Only the embedded raster images of a scanned PDF can be OCRed here.
 * Vector-only PDF rasterization needs a dedicated compatible renderer. */
async function encodeRawImageAsPng(image:any):Promise<Uint8Array|null>{
  const width=Number(image?.width??0),height=Number(image?.height??0);
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<600||height<600||width*height>4500000)return null;
  const data=image?.data;if(!(data instanceof Uint8Array||data instanceof Uint8ClampedArray))return null;
  let pixels:Uint8Array;
  if(data.length===width*height*4){
    pixels=new Uint8Array(data);
  }else if(data.length===width*height*3){
    pixels=new Uint8Array(width*height*4);
    for(let k=0;k<width*height;k++){pixels[4*k]=data[3*k];pixels[4*k+1]=data[3*k+1];pixels[4*k+2]=data[3*k+2];pixels[4*k+3]=255;}
  }else if(data.length===width*height){
    pixels=new Uint8Array(width*height*4);
    for(let k=0;k<width*height;k++){pixels[4*k]=data[k];pixels[4*k+1]=data[k];pixels[4*k+2]=data[k];pixels[4*k+3]=255;}
  }else return null;
  const png=(await import('npm:upng-js@2.1.0')).default;
  const encoded=png.encode([pixels.buffer],width,height,0);
  return new Uint8Array(encoded);
}
async function readPdfEmbeddedImageOcr(pdf:any, pageLimit=12){
  const pageTexts:string[]=[];
  const errors:string[]=[];
  let imagesScanned=0;
  for(let pageNo=1;pageNo<=Math.min(pdf.numPages,pageLimit);pageNo++){
    let content='';
    try{
      const page=await pdf.getPage(pageNo);
      const ops=await page.getOperatorList();
      const seen=new Set<string>();
      for(let i=0;i<ops.fnArray.length&&imagesScanned<pageLimit;i++){
        const args=ops.argsArray[i];
        if(!Array.isArray(args))continue;
        const id=typeof args[0]==='string' ? args[0] : null;
        if(id&&(!/(?:^img_|^g_.*img)/.test(id)||seen.has(id)))continue;
        if(id)seen.add(id);
        let img:any=null;
        try{
          if(id){
            const store=id.startsWith('g_')?page.commonObjs:page.objs;
            if(!store?.has?.(id))continue;
            img=store.get(id);
          }else if(args[0]&&typeof args[0]==='object'&&'width'in args[0]&&'data'in args[0])img=args[0];
          if(!img)continue;
          const png=await encodeRawImageAsPng(img);
          if(!png)continue;
          imagesScanned++;
          const result=await ocrImage(png);
          if(result.confidence>0)content+='\n'+result.text;
        }catch(err){errors.push('page '+pageNo+': '+String(err).slice(0,90));}
        if(imagesScanned>=pageLimit)break;
      }
    }catch(err){errors.push('page '+pageNo+': '+String(err).slice(0,90));}
    pageTexts.push(content);
  }
  return {lines:pageTexts.flatMap((txt)=>txt.split('\n')), pages:pageTexts.filter(Boolean).length,
    images_scanned:imagesScanned,errors:errors.slice(0,4),
    mode:imagesScanned?'embedded_pdf_images':'unavailable_no_compatible_pdf_raster',
  };
}

async function creditLayoutLines(pdf:any):Promise<string[]> {
  const lines:string[] = [];
  for (let pageNo=1;pageNo<=pdf.numPages;pageNo++) {
    const page=await pdf.getPage(pageNo);
    const data=await page.getTextContent();
    const tokens=(data.items??[]).filter((item:any)=>typeof item?.str==='string' && item.str.trim())
      .map((item:any)=>({text:String(item.str).trim(),x:Number(item.transform?.[4]??0),y:Number(item.transform?.[5]??0)}))
      .filter((item:any)=>Number.isFinite(item.x)&&Number.isFinite(item.y))
      .sort((a:any,b:any)=>b.y-a.y||a.x-b.x);
    const groups:Array<Array<{text:string;x:number;y:number}>>=[];
    for(const token of tokens){
      const group=groups.find((g)=>Math.abs(g[0].y-token.y)<=2.2);
      if(group)group.push(token);else groups.push([token]);
    }
    for(const group of groups){
      group.sort((a,b)=>a.x-b.x);
      lines.push(group.map((x)=>x.text).join(' '));
    }
  }
  return lines;
}

async function parseCredit(
  pdf: any,
  pages: string[],
  documentId: string,
  fileName: string,
  targetIds: string[],
  detectedMembers: string[],
  members: Member[],
) {
  const all = pages.join('\n');
  const layoutLines=await creditLayoutLines(pdf);
  const creditPages=[...pages, layoutLines.join('\n')];
  const rate = findLineNumber(creditPages, /(?:taux (?:actuel du pr[êe]t|nominal|d[ée]biteur|du pr[êe]t|du cr[ée]dit)|taux d['’]int[ée]r[êe]t)/i, { min: 0, max: 20, percent: true });
  const taeg = findLineNumber(creditPages, /(?:TAEG|taux annuel effectif global)/i, { min: 0, max: 30, percent: true });
  const outstanding = findLineNumber(creditPages, /(?:capital restant d[uû]|capital restant|CRD)/i, { min: 0, max: 10000000 });
  const initial = findLineNumber(creditPages, /(?:capital emprunt[ée]|montant (?:initial )?du pr[êe]t|montant emprunt[ée])/i, { min: 100, max: 10000000, preferLast: false });
  const totalCreditCost = findLineNumber(creditPages, /co[uû]t total (?:du )?cr[ée]dit/i, { min: 0, max: 10000000 });
  const totalInsuranceCost = findLineNumber(creditPages, /co[uû]t total (?:de l['’])?assurance/i, { min: 0, max: 10000000 });
  const insuranceRate = findLineNumber(creditPages, /taux (?:annuel )?(?:de l['’])?assurance/i, { min: 0, max: 20, percent: true });
  const insurancePayment = findLineNumber(creditPages, /(?:cotisation|prime) (?:mensuelle )?(?:de l['’])?assurance/i, { min: 0, max: 10000 });

  const institution = institutionFromText(fileName, all);
  const contractMatch = all.match(/Contrat\s*:\s*([^\n]+)/i);
  const referenceMatch = all.match(/(?:Votre r[ée]f[ée]rence [àa] rappeler pour tout [ée]change|R[ée]f\.? [àa] rappeler)\s*:\s*([^\n]+)/i);
  const loanDateMatch = all.match(/Date de pr[êe]t\s*:\s*([^\n]+)/i);
  const taDateMatch = all.match(/Date de constitution du TA\s*:\s*([^\n]+)/i);
  const currencyMatch = all.match(/Devise de gestion du contrat\s*:\s*([A-Z]{3})/i);
  const originalDurationMatch = all.match(/sur une dur[ée]e de\s*(\d{1,4})\s*mois/i);
  const remainingDurationMatch = all.match(/Dur[ée]e actualis[ée]e restante\s*:\s*(\d{1,4})/i);
  const paymentDayMatch = all.match(/Date des r[èe]glements\s*:\s*le\s*(\d{1,2})\b/i);
  const crdDateMatch = all.match(/Capital restant d[uû] au\s*(\d{2}\/\d{2}\/\d{4})/i);

  const monthMap: Record<string,string> = {
    janvier:'01',fevrier:'02',février:'02',mars:'03',avril:'04',mai:'05',juin:'06',
    juillet:'07',aout:'08',août:'08',septembre:'09',octobre:'10',novembre:'11',decembre:'12',décembre:'12',
  };
  const toIso = (raw: string | undefined | null) => {
    if (!raw) return null;
    const s = raw.trim().toLowerCase();
    let m = s.match(/^(\d{2})[./](\d{2})[./](\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    m = s.match(/^(\d{1,2})\s+([a-zàâäéèêëïîôöùûüç]+)\s+(\d{4})$/i);
    if (m && monthMap[m[2]]) return `${m[3]}-${monthMap[m[2]]}-${m[1].padStart(2,'0')}`;
    return null;
  };

  const nativeEvidence=validateCreditSchedule(
    parseCreditScheduleLines([...pages.flatMap((p)=>p.split('\n')), ...layoutLines]),'pdf_native');
  let selected=nativeEvidence;
  let ocrResult:{lines:string[];pages:number;images_scanned:number;errors:string[];mode:string}|null=null;
  let ocrEvidence:ScheduleEvidence|null=null;
  if(nativeEvidence.validation.status!=='verified'||
     nativeEvidence.rows.every((row)=>!row.balanceReliable)){
    ocrResult=await readPdfEmbeddedImageOcr(pdf);
    if(ocrResult.lines.length){
      ocrEvidence=validateCreditSchedule(parseCreditScheduleLines(ocrResult.lines,'ocr_embedded_image'),'ocr_embedded_image');
      if(ocrEvidence.validation.status==='verified'&&nativeEvidence.validation.status!=='verified'){
        selected=ocrEvidence;
      }
    }
  }
  const scheduleRows=selected.rows;
  const mutuallyVerified=ocrEvidence?.validation.status==='verified'
    &&nativeEvidence.validation.status==='verified';
  const pdfOcrMismatch=Boolean(mutuallyVerified&&
    ocrEvidence?.rows.find((row)=>row.date<=new Date().toISOString().slice(0,10)&&row.balanceReliable)
    &&nativeEvidence.rows.find((row)=>row.date<=new Date().toISOString().slice(0,10)&&row.balanceReliable)
    &&(()=>{
       const lastPdf=nativeEvidence.rows.filter((row)=>row.date<=new Date().toISOString().slice(0,10)&&row.balanceReliable).at(-1);
       const lastOcr=ocrEvidence?.rows.filter((row)=>row.date<=new Date().toISOString().slice(0,10)&&row.balanceReliable).at(-1);
       return lastPdf&&lastOcr&&lastPdf.date===lastOcr.date&&Math.abs(lastPdf.crd-lastOcr.crd)>0.50;
     })());

  const today=new Date().toISOString().slice(0,10);
  const lastPaid=scheduleRows.filter((row)=>row.date<=today).at(-1)??null;
  const nextDue=scheduleRows.find((row)=>row.date>today)??null;
  const currentBalance=!pdfOcrMismatch&&lastPaid&&nextDue&&lastPaid.balanceReliable&&
    lastPaid.crd>=0&&lastPaid.crd<=10000000 ? lastPaid : null;
  const currentPayment=nextDue&&
    (Date.parse(nextDue.date+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))<=45*86400000
    ? nextDue : null;
  const firstRow = scheduleRows[0] ?? null;
  const lastRow = scheduleRows.at(-1) ?? null;
  // A "future" instalment must follow the upcoming instalment, not the first historic row.
  const changedPayment = nextDue
    ? scheduleRows.find((row) => row.date > nextDue.date &&
      Math.abs(row.payment - nextDue.payment) > 0.01 && row.payment > 0)
    : null;

  const fact: Json = { source_document_id: documentId, source_file: fileName };
  const sourcePages: Json = {};
  if (institution) { fact.organisme = institution; fact.banque = institution; }
  if (contractMatch?.[1]) fact.contrat = contractMatch[1].trim();
  if (referenceMatch?.[1]) fact.reference_pret = referenceMatch[1].trim().replace(/\s+\/.*$/,'');
  const effectiveRate=rate??await findPdfRowNumber(pdf,/taux (?:nominal|actuel du pr[êe]t|du cr[ée]dit|d['’]int[ée]r[êe]t)/i,{min:0,max:20,percent:true});
  if (effectiveRate) { fact.taux_credit = effectiveRate.value; sourcePages.__merge_credit_items = String(effectiveRate.page); }
  if (taeg) fact.taeg = taeg.value;
  // Historical outstanding figures are not used as the current debt balance.
  if (outstanding) fact.solde_historique_reference= Math.round(outstanding.value*100)/100;
  if (currentBalance) { fact.capital_restant_du=Math.round(currentBalance.crd*100)/100; fact.capital_restant_du_date=currentBalance.date; }
  if (initial) { fact.montant_initial = Math.round(initial.value * 100) / 100; sourcePages.__merge_credit_items ??= String(initial.page); }
  if (loanDateMatch?.[1]) { const d=toIso(loanDateMatch[1]); if (d) { fact.date_pret=d; fact.date_ouverture=d; } }
  if (taDateMatch?.[1]) { const d=toIso(taDateMatch[1]); if (d) fact.date_constitution_tableau=d; }
  if (currencyMatch?.[1]) fact.devise=currencyMatch[1].toUpperCase();
  if (crdDateMatch?.[1]) { const d=toIso(crdDateMatch[1]); if (d) fact.date_derniere_echeance_prelevee=d; }
  if (originalDurationMatch?.[1]) { fact.duree_initiale_mois=Number(originalDurationMatch[1]); fact.duree_mois=Number(originalDurationMatch[1]); }
  if (remainingDurationMatch?.[1]) fact.duree_actualisee_restante_mois=Number(remainingDurationMatch[1]);
  if (paymentDayMatch?.[1]) fact.jour_echeance=Number(paymentDayMatch[1]);
  if (/taux d['’]int[ée]r[êe]t fixe|taux actuel du pr[êe]t/i.test(all)) fact.taux_type='Fixe';
  if (/hors assurance/i.test(all)) fact.taux_hors_assurance=true;
  if (firstRow) fact.date_premiere_echeance_tableau=firstRow.date;
  if (currentPayment) fact.mensualite_actuelle=Math.round(currentPayment.payment*100)/100;
  if (firstRow && firstRow.fees>0 && firstRow.balanceReliable) fact.frais_tableau=Math.round(firstRow.fees*100)/100;
  if (changedPayment) {
    fact.mensualite_future=Math.round(changedPayment.payment*100)/100;
    fact.mensualite_future_date=changedPayment.date;
  }
  if (lastRow) {
    fact.date_fin=lastRow.date;
    fact.montant_derniere_echeance=Math.round(lastRow.payment*100)/100;
    fact.nombre_echeances_tableau=lastRow.n;
  }
  if (/assurance externe|assurance hors groupe|substitution d['’]assurance groupe vers hors groupe/i.test(all)) {
    fact.assurance_mode='Assurance externe / hors groupe';
    fact.assurance_externe=true;
    fact.assurance_cout_documente=Boolean(totalInsuranceCost || insuranceRate || insurancePayment);
  }
  if (totalInsuranceCost) fact.cout_total_assurance=Math.round(totalInsuranceCost.value*100)/100;
  if (insuranceRate) fact.taux_assurance=insuranceRate.value;
  if (insurancePayment) fact.cotisation_assurance=Math.round(insurancePayment.value*100)/100;
  if (totalCreditCost) fact.cout_total_credit=Math.round(totalCreditCost.value*100)/100;

  if (/suspension totale du paiement de vos [ée]ch[ée]ances/i.test(all)) {
    fact.phase_credit = changedPayment
      ? `Suspension totale des échéances jusqu'à la reprise du ${changedPayment.date}`
      : 'Suspension totale des échéances';
  } else if (scheduleRows.length && scheduleRows.slice(0,Math.min(12,scheduleRows.length)).every((row)=>row.capital===0) && scheduleRows.some((row)=>row.interest>0)) {
    fact.phase_credit="Échéances d'intérêts seuls avant amortissement du capital";
  }

  const contractIdentity = identityText(String(fact.contrat ?? ''));
  const contractMembers = members.filter((member) => contractIdentity.includes(identityText(member.nom)));
  const borrowerMembers = contractMembers.length ? contractMembers : members.filter((member) => detectedMembers.includes(member.investisseur_id));
  if (borrowerMembers.length === 1) {
    fact.emprunteur_investisseur_id = borrowerMembers[0].investisseur_id;
    fact.emprunteur = borrowerMembers[0].role_dossier === 'investisseur_2' ? 'Identifiant 2' : 'Identifiant 1';
  } else if (borrowerMembers.length > 1) {
    fact.emprunteur = 'Identifiant 1 et 2';
  }

  const extractedFields = Object.keys(fact).filter((key) => !['source_document_id','source_file','emprunteur_investisseur_id'].includes(key));
  return {
    patches: extractedFields.length ? [{
      section_code: 'credits',
      target_investisseur_ids: targetIds,
      fields: { __merge_credit_items: [fact] },
      source_pages: sourcePages,
    }] : [],
    summary: {
      parser: 'credit_schedule_dual_v5',
      readers:{
        pdf_native:{status:nativeEvidence.validation.status,rows:nativeEvidence.rows.length,
          column_validation:nativeEvidence.validation},
        ocr:ocrResult?{mode:ocrResult.mode,images_scanned:ocrResult.images_scanned,
          pages_with_text:ocrResult.pages,rows:ocrEvidence?.rows.length??0,
          status:ocrEvidence?.validation.status??'unavailable',
          errors:ocrResult.errors}: {mode:'not_needed_validated_native_pdf',status:'not_run'},
        selected: selected===nativeEvidence?'pdf_native':'ocr_embedded_image',
        disagreement:pdfOcrMismatch,
      },
      file_name: fileName,
      extracted_fields: extractedFields,
      extracted_field_count: extractedFields.length,
      borrower_matches: borrowerMembers.map((member)=>member.investisseur_id),
      schedule_rows_read: scheduleRows.length,
      layout_lines_read: layoutLines.length,
      current_balance_found: Boolean(currentBalance),
      current_payment_found: Boolean(currentPayment),
      balance_date: currentBalance?.date ?? null,
      source_document_id: documentId,
      safe_crd_rule: 'date_scoped_consecutive_instalments_arithmetic_validation_not_bank_confirmed',
      insurance_cost_documented: fact.assurance_cout_documente ?? null,
    },
    // A partial amortization analysis is not a completed loan reconciliation.
    status: extractedFields.length && scheduleRows.length > 0 &&
      Boolean(currentPayment) && Boolean(currentBalance) && !pdfOcrMismatch
      ? 'extracted' : 'to_review',
  };
}

function parseFinancial(pages: string[], documentId: string, fileName: string, targetIds: string[]) {
  const all = pages.join('\n');
  const institution = institutionFromText(fileName, all);
  const total = findLineNumber(
    pages,
    /(?:valorisation totale|valeur totale|total portefeuille|encours total|total des avoirs|solde disponible|solde du compte)/i,
    { min: 0, max: 100000000 },
  );

  const fields: Json = {};
  const sourcePages: Json = {};
  if (total) {
    fields.total_band = amountToBand(total.value);
    sourcePages.total_band = String(total.page);
  }

  return {
    patches: Object.keys(fields).length && targetIds.length === 1 ? [{
      section_code: 'financial',
      target_investisseur_ids: targetIds,
      fields,
      source_pages: sourcePages,
    }] : [],
    summary: {
      parser: 'financial_statement_fr_v2',
      file_name: fileName,
      institution,
      extracted_fields: Object.keys(fields),
      exact_total_amount: total?.value ?? null,
      household_statement_requires_review: targetIds.length > 1,
      source_document_id: documentId,
    },
    status: Object.keys(fields).length && targetIds.length === 1 ? 'extracted' : 'to_review',
  };
}

function parseIdentity(pages: string[], documentId: string, fileName: string, targetIds: string[]) {
  if (targetIds.length !== 1) {
    return {
      patches: [],
      summary: { parser: 'identity_text_fr_v1', file_name: fileName, source_document_id: documentId, reason: 'Pièce d’identité sans titulaire unique.' },
      status: 'to_review',
    };
  }

  const birthDate = findDateNear(pages, /(?:date de naissance|n[ée]e? le)/i);
  const nationality = findStringNear(pages, /nationalit[ée]/i, /([A-ZÀ-ÖØ-öø-ÿ -]{3,40})/i);
  const birthPlace = findStringNear(pages, /(?:lieu de naissance|n[ée]e? [àa])/i, /([A-ZÀ-ÖØ-öø-ÿ' -]{2,60})/i);

  const fields: Json = {};
  const sourcePages: Json = {};
  if (birthDate) { fields.date_naissance = birthDate.value; sourcePages.date_naissance = String(birthDate.page); }
  if (nationality) { fields.nationalite = nationality.value; sourcePages.nationalite = String(nationality.page); }
  if (birthPlace) { fields.lieu_naissance = birthPlace.value; sourcePages.lieu_naissance = String(birthPlace.page); }

  return {
    patches: Object.keys(fields).length ? [{
      section_code: 'identity',
      target_investisseur_ids: targetIds,
      fields,
      source_pages: sourcePages,
    }] : [],
    summary: {
      parser: 'identity_text_fr_v1',
      file_name: fileName,
      extracted_fields: Object.keys(fields),
      source_document_id: documentId,
    },
    status: Object.keys(fields).length ? 'extracted' : 'to_review',
  };
}

function parsePropertyOrAccounts(_pages: string[], documentId: string, fileName: string, pageCount: number) {
  return {
    patches: [],
    summary: {
      parser: 'property_accounts_safe_v2',
      file_name: fileName,
      page_count: pageCount,
      source_document_id: documentId,
      reason: 'Document conservé et analysable sans limite courte de pages, mais aucune donnée patrimoniale n’est injectée sans correspondance certaine avec un bien ou une société du recueil.',
    },
    status: 'to_review',
  };
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, '0')).join('');
}


function xmlUnescape(value: string):string {
  const named: Record<string,string> = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
    (whole,ref:string)=>{
      if(ref[0]==='#'){
        const cp=ref[1]?.toLowerCase()==='x' ? parseInt(ref.slice(2),16) : parseInt(ref.slice(1),10);
        return Number.isInteger(cp)&&cp>0&&cp<=0x10ffff ? String.fromCodePoint(cp) : whole;
      }
      return named[ref.toLowerCase()]??whole;
    });
}
function docxWords(fragment:string):string {
  return [...fragment.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br(?:\s[^>]*)?\/>/g)]
    .map((match)=>match[1]!==undefined?xmlUnescape(match[1]):' ')
    .join('').replace(/\s+/g,' ').trim();
}
function parseDocxContents(bytes:Uint8Array) {
  if(bytes.length<4||bytes[0]!==0x50||bytes[1]!==0x4b)throw new Error('Document Word DOCX invalide (archive ZIP absente)');
  const zipped=unzipSync(bytes,{filter:(entry)=>entry.name==='word/document.xml'&&entry.originalSize<=3_000_000});
  const xmlBytes=zipped['word/document.xml'];
  if(!xmlBytes)throw new Error('Structure Word DOCX inaccessible ou trop volumineuse');
  const xml=new TextDecoder('utf-8',{fatal:true}).decode(xmlBytes);
  const tableRows:Array<string[]>=[];
  for(const table of xml.matchAll(/<w:tbl(?:\s[^>]*)?>([\s\S]*?)<\/w:tbl>/g)){
    for(const row of table[1].matchAll(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g)){
      const cells=[...row[1].matchAll(/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g)]
        .map((cell)=>docxWords(cell[1]));
      if(cells.some(Boolean)&&cells.length<=24)tableRows.push(cells);
    }
  }
  const outside=xml.replace(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g,'');
  const paragraphs=[...outside.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)]
    .map((p)=>docxWords(p[1])).filter(Boolean).slice(0,150);
  if(tableRows.length===0&&paragraphs.length===0)throw new Error('Word DOCX sans texte exploitable');
  if(tableRows.length>3000)throw new Error('Document Word trop long pour extraction sécurisée');
  return {paragraphs,tableRows};
}
function financialDocxPreview(
  parsed:{paragraphs:string[],tableRows:string[][]}, members:Member[],documentId:string,fileName:string
) {
  const owners:Array<{id:string|null;role:string;label:string;third_party:boolean}>=[];
  const suggestions:Array<{holder:string;investisseur_id:string|null;third_party:boolean;support:string;montant:number;row:number}>=[];
  const findHolder=(name:string)=>{
    const needle=identityText(name);
    const member=members.find((m)=>identityText(m.prenom)===needle || identityText(m.prenom+' '+m.nom)===needle);
    return {id:member?.investisseur_id??null, role:member?.role_dossier??'',label:name,third_party:!member};
  };
  for(let i=0;i<parsed.tableRows.length;i++){
    const cells=parsed.tableRows[i];
    if(cells.length!==3)continue;
    if(!cells[1]?.trim()&&cells[0]&&cells[2]){
      owners[0]=findHolder(cells[0]);owners[1]=findHolder(cells[2]);continue;
    }
    for(const [index,col] of [[0,0],[1,2]] as const) {
      const holder=owners[index];
      const value=String(cells[col]??'').trim();
      if(!holder||!value||!/^[-\d\s.,€]+$/.test(value)||!/\d/.test(value))continue;
      const amount=parseFrenchNumber(value);
      if(amount===null||amount<0||amount>100000000)continue;
      suggestions.push({holder:holder.label,investisseur_id:holder.id,third_party:holder.third_party,
        support:cells[1]??'',montant:amount,row:i+1});
    }
  }
  return {
    patches:[],
    summary:{
      parser:'financial_docx_tables_fr_v1',file_name:fileName,source_document_id:documentId,
      extracted_rows:suggestions.length,
      recognized_household_rows:suggestions.filter((r)=>!r.third_party).length,
      third_party_rows:suggestions.filter((r)=>r.third_party).length,
      financial_rows:suggestions.slice(0,150),
      narrative:parsed.paragraphs.slice(0,30),
      needs_document_date_review:true,requires_cif_reconciliation:true,
      reason:'Lecture du document réussie, valeurs et titulaires à rapprocher avant intégration.',
    },
    status:'to_review',
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = cors(origin);
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405, headers });
  if (origin && !allowedOrigins.has(origin)) return new Response(JSON.stringify({ error: 'Origine non autorisée' }), { status: 403, headers });

  let admin: any = null;
  let documentId = '';
  let previewOnly = false;

  try {
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Authentification requise' }), { status: 401, headers });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) throw new Error('Configuration Supabase incomplète');

    const body = await req.json().catch(() => ({}));
    documentId = typeof body?.document_id === 'string' ? body.document_id : '';
    previewOnly=body?.preview_only===true;
    if (!/^[0-9a-f-]{36}$/i.test(documentId)) return new Response(JSON.stringify({ error: 'Document invalide' }), { status: 400, headers });

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false },
    });
    admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const bearerToken = auth.slice('Bearer '.length).trim();
    const documentClient = bearerToken === serviceKey ? admin : userClient;

    const { data: doc, error: docError } = await documentClient
      .from('documents_sources')
      .select('id,dossier_id,investisseur_id,categorie,nom_fichier,storage_bucket,storage_path,statut_analyse,metadata,portee_document,concerne_investisseur_ids')
      .eq('id', documentId)
      .single();
    if (docError || !doc) return new Response(JSON.stringify({ error: 'Document inaccessible' }), { status: 404, headers });

    const { data: memberRows, error: memberError } = await admin
      .from('dossier_investisseurs')
      .select('investisseur_id,role_dossier,investisseurs(prenom,nom)')
      .eq('dossier_id', doc.dossier_id)
      .order('role_dossier');
    if (memberError) throw memberError;

    const members: Member[] = (memberRows ?? []).map((row: any) => ({
      investisseur_id: row.investisseur_id,
      role_dossier: row.role_dossier,
      prenom: row.investisseurs?.prenom ?? '',
      nom: row.investisseurs?.nom ?? '',
    }));
    const primaryId = members.find((m) => m.role_dossier === 'investisseur_1')?.investisseur_id ?? doc.investisseur_id;

    if(!previewOnly){
      await admin.from('documents_sources').update({
        statut_analyse: 'processing',
        metadata: { ...(doc.metadata ?? {}), analysis_started_at: new Date().toISOString(), analysis_error: null },
        updated_at: new Date().toISOString(),
      }).eq('id', documentId);
    }

    if (!doc.storage_bucket || !doc.storage_path) throw new Error('Fichier source non disponible');
    const { data: blob, error: downloadError } = await admin.storage.from(doc.storage_bucket).download(doc.storage_path);
    if (downloadError || !blob) throw downloadError ?? new Error('Téléchargement impossible');
    if (blob.size > 25 * 1024 * 1024) throw new Error('Document trop volumineux pour l’analyse automatique');

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const fileHash = await sha256Hex(bytes);
    const lowerName = String(doc.nom_fichier ?? '').toLowerCase();
    const isPdf = blob.type === 'application/pdf' || lowerName.endsWith('.pdf');
    const isDocx = lowerName.endsWith('.docx');
    if(isDocx) {
      const parsedDocx=parseDocxContents(bytes);
      const scopeIds=doc.portee_document==='foyer'
        ? members.map((m)=>m.investisseur_id)
        : uniqueIds((doc.concerne_investisseur_ids??[]).map(String));
      const parsed=doc.categorie==='patrimoine_financier'
        ? financialDocxPreview(parsedDocx,members,documentId,doc.nom_fichier)
        : {patches:[],summary:{parser:'docx_text_v1',file_name:doc.nom_fichier,
          source_document_id:documentId,paragraph_count:parsedDocx.paragraphs.length,
          table_rows:parsedDocx.tableRows.length,requires_cif_review:true},status:'to_review'};
      const extraction={
        parser_version:'source-doc-v4',category:doc.categorie,format:'docx',
        text_length:JSON.stringify(parsedDocx).length,
        scope_detection:{configured_scope:doc.portee_document,
          concerned_investor_ids:scopeIds},
        summary:parsed.summary,patches:[],
      };
      const {data:applied,error:applyError}=await admin.rpc('apply_source_document_extraction',{
        p_document_id:documentId,p_extraction:extraction,p_status:'to_review',p_hash_sha256:fileHash,
      });
      if(applyError)throw applyError;
      return new Response(JSON.stringify({ok:true,document_id:documentId,result:applied}),{headers});
    }

    if (!isPdf) {
      const explicitIds = uniqueIds((doc.concerne_investisseur_ids ?? []).map(String));
      const scopeIds = doc.portee_document === 'foyer'
        ? members.map((m) => m.investisseur_id)
        : explicitIds.length ? explicitIds : [doc.investisseur_id].filter(Boolean);

      let parsedImage: any = {
        patches: [],
        summary: {
          parser: 'generic_image_v1',
          file_name: doc.nom_fichier,
          source_document_id: documentId,
          reason: 'Image reçue mais catégorie non prise en charge par la lecture automatique.',
        },
        status: 'to_review',
      };

      if (doc.categorie === 'patrimoine_financier') {
        const ocr = await ocrImage(bytes);
        parsedImage = parseFinancialImage(ocr.text, ocr.confidence, documentId, doc.nom_fichier, scopeIds, members);
      }

      const extraction = {
        parser_version: 'source-doc-v3',
        category: doc.categorie,
        format: blob.type || 'image',
        scope_detection: { mode: doc.portee_document, concerned_investor_ids: scopeIds },
        summary: parsedImage.summary,
        patches: parsedImage.patches,
      };

      await admin.from('documents_sources').update({
        portee_document: doc.portee_document === 'auto' && scopeIds.length > 1 ? 'foyer' : doc.portee_document === 'auto' ? 'investisseur' : doc.portee_document,
        concerne_investisseur_ids: scopeIds,
      }).eq('id', documentId);

      const { data: applied, error: applyError } = await admin.rpc('apply_source_document_extraction', {
        p_document_id: documentId,
        p_extraction: extraction,
        p_status: parsedImage.status,
        p_hash_sha256: fileHash,
      });
      if (applyError) throw applyError;
      return new Response(JSON.stringify({ ok: true, document_id: documentId, result: applied }), { headers });
    }

    const pdf = await getDocumentProxy(bytes, { maxImageSize: 16_777_216 });
    if (pdf.numPages > 120) throw new Error('Document de plus de 120 pages : contrôle manuel requis');

    const extracted: any = await extractText(pdf, { mergePages: false });
    const rawText = extracted?.text;
    const pages = (Array.isArray(rawText) ? rawText : [rawText ?? '']).map((x) => normalizeText(String(x ?? '')));
    const allText = pages.join('\n');

    const explicitIds = uniqueIds((doc.concerne_investisseur_ids ?? []).map(String));
    const detected = detectMembers(allText, members);
    let concernedIds: string[];

    if (doc.portee_document === 'foyer') concernedIds = members.map((m) => m.investisseur_id);
    else if (doc.portee_document === 'investisseur' && explicitIds.length) concernedIds = explicitIds;
    else if (detected.length) concernedIds = uniqueIds(detected);
    else concernedIds = explicitIds.length ? explicitIds : [doc.investisseur_id].filter(Boolean);

    const resolvedScope = concernedIds.length > 1 ? 'foyer' : 'investisseur';

    if(!previewOnly){
      await admin.from('documents_sources').update({
        portee_document: resolvedScope,
        concerne_investisseur_ids: concernedIds,
      }).eq('id', documentId);
    }

    let parsed: any;

    if (doc.categorie === 'avis_imposition') {
      parsed = await parseTaxNotice(pdf, pages, documentId, doc.nom_fichier, concernedIds, members);
    } else if (doc.categorie === 'tableau_amortissement') {
      const creditTargetIds = primaryId ? [primaryId] : concernedIds.slice(0, 1);
      parsed = await parseCredit(pdf, pages, documentId, doc.nom_fichier, creditTargetIds, detected, members);
    } else if (doc.categorie === 'patrimoine_financier') {
      parsed = parseFinancial(pages, documentId, doc.nom_fichier, concernedIds);
    } else if (doc.categorie === 'identite') {
      parsed = parseIdentity(pages, documentId, doc.nom_fichier, concernedIds);
    } else if (doc.categorie === 'patrimoine_immobilier' || doc.categorie === 'sci_societe') {
      parsed = parsePropertyOrAccounts(pages, documentId, doc.nom_fichier, pdf.numPages);
    } else {
      parsed = {
        patches: [],
        summary: {
          parser: 'generic_safe_v2',
          file_name: doc.nom_fichier,
          source_document_id: documentId,
          reason: 'Catégorie conservée sans injection automatique.',
        },
        status: 'to_review',
      };
    }

    const extraction = {
      parser_version: 'source-doc-v3',
      category: doc.categorie,
      page_count: pdf.numPages,
      text_length: pages.reduce((sum, page) => sum + page.length, 0),
      scope_detection: {
        configured_scope: doc.portee_document,
        resolved_scope: resolvedScope,
        detected_investor_ids: detected,
        concerned_investor_ids: concernedIds,
      },
      summary: parsed.summary,
      patches: parsed.patches,
    };

    if(previewOnly){
      if(doc.categorie!=='tableau_amortissement'){
        return new Response(JSON.stringify({error:'Prévisualisation réservée aux tableaux d’amortissement'}),{status:400,headers});
      }
      const loanFact=parsed?.patches?.[0]?.fields?.__merge_credit_items?.[0]??{};
      return new Response(JSON.stringify({
        ok:true,preview_only:true,document_id:documentId,
        summary:parsed.summary,
        theoretical_balance:loanFact.capital_restant_du??null,
        theoretical_balance_date:loanFact.capital_restant_du_date??null,
        note:'Aucune donnée client modifiée. CRD théorique issu du tableau, à confirmer sur relevé bancaire.',
      }),{headers});
    }

    const { data: applied, error: applyError } = await admin.rpc('apply_source_document_extraction', {
      p_document_id: documentId,
      p_extraction: extraction,
      p_status: parsed.status,
      p_hash_sha256: fileHash,
    });
    if (applyError) throw applyError;

    return new Response(JSON.stringify({ ok: true, document_id: documentId, result: applied }), { headers });
  } catch (error) {
    if (admin && documentId && !previewOnly) {
      const message = error instanceof Error ? error.message : String(error);
      const { data: current } = await admin.from('documents_sources').select('metadata').eq('id', documentId).maybeSingle();
      await admin.from('documents_sources').update({
        statut_analyse: 'to_review',
        metadata: { ...(current?.metadata ?? {}), analysis_error: message, analysis_completed_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }).eq('id', documentId);
    }
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers });
  }
});
