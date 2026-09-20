import { createClient } from 'npm:@supabase/supabase-js@2';
import { extractText, getDocumentProxy } from 'npm:unpdf@1.8.1';

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

function parseCredit(
  pages: string[],
  documentId: string,
  fileName: string,
  targetIds: string[],
  detectedMembers: string[],
  members: Member[],
) {
  const all = pages.join('\n');
  const rate = findLineNumber(pages, /(?:taux (?:actuel du pr[êe]t|nominal|d[ée]biteur|du pr[êe]t|du cr[ée]dit)|taux d['’]int[ée]r[êe]t)/i, { min: 0, max: 20, percent: true });
  const taeg = findLineNumber(pages, /(?:TAEG|taux annuel effectif global)/i, { min: 0, max: 30, percent: true });
  const outstanding = findLineNumber(pages, /(?:capital restant d[uû]|capital restant|CRD)/i, { min: 0, max: 10000000 });
  const initial = findLineNumber(pages, /(?:capital emprunt[ée]|montant (?:initial )?du pr[êe]t|montant emprunt[ée])/i, { min: 100, max: 10000000, preferLast: false });
  const totalCreditCost = findLineNumber(pages, /co[uû]t total (?:du )?cr[ée]dit/i, { min: 0, max: 10000000 });
  const totalInsuranceCost = findLineNumber(pages, /co[uû]t total (?:de l['’])?assurance/i, { min: 0, max: 10000000 });
  const insuranceRate = findLineNumber(pages, /taux (?:annuel )?(?:de l['’])?assurance/i, { min: 0, max: 20, percent: true });
  const insurancePayment = findLineNumber(pages, /(?:cotisation|prime) (?:mensuelle )?(?:de l['’])?assurance/i, { min: 0, max: 10000 });

  const institution = institutionFromText(fileName, all);
  const contractMatch = all.match(/Contrat\s*:\s*([^\n]+)/i);
  const referenceMatch = all.match(/(?:Votre r[ée]f[ée]rence [àa] rappeler pour tout [ée]change|R[ée]f\.? [àa] rappeler)\s*:\s*([^\n]+)/i);
  const loanDateMatch = all.match(/Date de pr[êe]t\s*:\s*([^\n]+)/i);
  const taDateMatch = all.match(/Date de constitution du TA\s*:\s*([^\n]+)/i);
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

  const scheduleRows: Array<{ n:number; date:string; payment:number; fees:number; interest:number; capital:number; crd:number; unpaid:number }> = [];
  for (const page of pages) {
    for (const line of page.split('\n')) {
      const m = line.trim().match(/^(\d{1,4})\s+(\d{2}\.\d{2}\.\d{4})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})$/);
      if (!m) continue;
      const vals = m.slice(3).map((raw) => parseFrenchNumber(raw) ?? 0);
      scheduleRows.push({
        n:Number(m[1]), date:toIso(m[2].replace(/\./g,'/')) ?? m[2],
        payment:vals[0], fees:vals[1], interest:vals[2], capital:vals[3], crd:vals[4], unpaid:vals[5],
      });
    }
  }
  scheduleRows.sort((a,b)=>a.n-b.n);
  const firstRow = scheduleRows[0] ?? null;
  const lastRow = scheduleRows.at(-1) ?? null;
  const changedPayment = firstRow
    ? scheduleRows.find((row) => Math.abs(row.payment - firstRow.payment) > 0.01 && row.payment > 0)
    : null;

  const fact: Json = { source_document_id: documentId, source_file: fileName };
  const sourcePages: Json = {};
  if (institution) { fact.organisme = institution; fact.banque = institution; }
  if (contractMatch?.[1]) fact.contrat = contractMatch[1].trim();
  if (referenceMatch?.[1]) fact.reference_pret = referenceMatch[1].trim().replace(/\s+\/.*$/,'');
  if (rate) { fact.taux_credit = rate.value; sourcePages.__merge_credit_items = String(rate.page); }
  if (taeg) fact.taeg = taeg.value;
  if (outstanding) { fact.capital_restant_du = Math.round(outstanding.value * 100) / 100; sourcePages.__merge_credit_items ??= String(outstanding.page); }
  if (initial) { fact.montant_initial = Math.round(initial.value * 100) / 100; sourcePages.__merge_credit_items ??= String(initial.page); }
  if (loanDateMatch?.[1]) { const d=toIso(loanDateMatch[1]); if (d) { fact.date_pret=d; fact.date_ouverture=d; } }
  if (taDateMatch?.[1]) { const d=toIso(taDateMatch[1]); if (d) fact.date_constitution_tableau=d; }
  if (crdDateMatch?.[1]) { const d=toIso(crdDateMatch[1]); if (d) fact.date_derniere_echeance_prelevee=d; }
  if (originalDurationMatch?.[1]) { fact.duree_initiale_mois=Number(originalDurationMatch[1]); fact.duree_mois=Number(originalDurationMatch[1]); }
  if (remainingDurationMatch?.[1]) fact.duree_actualisee_restante_mois=Number(remainingDurationMatch[1]);
  if (paymentDayMatch?.[1]) fact.jour_echeance=Number(paymentDayMatch[1]);
  if (/taux d['’]int[ée]r[êe]t fixe|taux actuel du pr[êe]t/i.test(all)) fact.taux_type='Fixe';
  if (/hors assurance/i.test(all)) fact.taux_hors_assurance=true;
  if (firstRow) {
    fact.date_premiere_echeance_tableau=firstRow.date;
    fact.mensualite_actuelle=Math.round(firstRow.payment*100)/100;
    fact.frais_inclus_dont_assurance_tableau=Math.round(firstRow.fees*100)/100;
  }
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
    fact.phase_credit='Suspension totale des échéances';
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
      parser: 'credit_schedule_fr_v3',
      file_name: fileName,
      extracted_fields: extractedFields,
      extracted_field_count: extractedFields.length,
      borrower_matches: borrowerMembers.map((member)=>member.investisseur_id),
      schedule_rows_read: scheduleRows.length,
      source_document_id: documentId,
      safe_crd_rule: 'same-line-label-only',
      insurance_cost_documented: fact.assurance_cout_documente ?? null,
    },
    status: extractedFields.length ? 'extracted' : 'to_review',
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

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = cors(origin);
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405, headers });
  if (origin && !allowedOrigins.has(origin)) return new Response(JSON.stringify({ error: 'Origine non autorisée' }), { status: 403, headers });

  let admin: any = null;
  let documentId = '';

  try {
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Authentification requise' }), { status: 401, headers });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) throw new Error('Configuration Supabase incomplète');

    const body = await req.json().catch(() => ({}));
    documentId = typeof body?.document_id === 'string' ? body.document_id : '';
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

    await admin.from('documents_sources').update({
      statut_analyse: 'processing',
      metadata: { ...(doc.metadata ?? {}), analysis_started_at: new Date().toISOString(), analysis_error: null },
      updated_at: new Date().toISOString(),
    }).eq('id', documentId);

    if (!doc.storage_bucket || !doc.storage_path) throw new Error('Fichier source non disponible');
    const { data: blob, error: downloadError } = await admin.storage.from(doc.storage_bucket).download(doc.storage_path);
    if (downloadError || !blob) throw downloadError ?? new Error('Téléchargement impossible');
    if (blob.size > 25 * 1024 * 1024) throw new Error('Document trop volumineux pour l’analyse automatique');

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const fileHash = await sha256Hex(bytes);
    const lowerName = String(doc.nom_fichier ?? '').toLowerCase();
    const isPdf = blob.type === 'application/pdf' || lowerName.endsWith('.pdf');

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

    await admin.from('documents_sources').update({
      portee_document: resolvedScope,
      concerne_investisseur_ids: concernedIds,
    }).eq('id', documentId);

    let parsed: any;

    if (doc.categorie === 'avis_imposition') {
      parsed = await parseTaxNotice(pdf, pages, documentId, doc.nom_fichier, concernedIds, members);
    } else if (doc.categorie === 'tableau_amortissement') {
      const creditTargetIds = primaryId ? [primaryId] : concernedIds.slice(0, 1);
      parsed = parseCredit(pages, documentId, doc.nom_fichier, creditTargetIds, detected, members);
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

    const { data: applied, error: applyError } = await admin.rpc('apply_source_document_extraction', {
      p_document_id: documentId,
      p_extraction: extraction,
      p_status: parsed.status,
      p_hash_sha256: fileHash,
    });
    if (applyError) throw applyError;

    return new Response(JSON.stringify({ ok: true, document_id: documentId, result: applied }), { headers });
  } catch (error) {
    if (admin && documentId) {
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
