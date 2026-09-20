import { createClient } from 'npm:@supabase/supabase-js@2';
import { extractText, getDocumentProxy } from 'npm:unpdf@1.8.1';

const allowedOrigins = new Set([
  'https://eric-bellaiche.fr',
  'https://www.eric-bellaiche.fr',
  'http://localhost:5173',
]);

type Json = Record<string, any>;
type FoundNumber = { value: number; page: number } | null;

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
  const matches = text.match(/-?\d{1,3}(?:[ .\u00a0]\d{3})*(?:[,.]\d{1,2})?|-?\d+(?:[,.]\d{1,2})?/g) ?? [];
  return matches.map((raw) => ({ raw, value: parseFrenchNumber(raw) })).filter((item) => item.value !== null) as Array<{ raw: string; value: number }>;
}

function findNear(
  pages: string[],
  label: RegExp,
  opts: { min?: number; max?: number; window?: number; percent?: boolean; standardRates?: number[] } = {},
): FoundNumber {
  const min = opts.min ?? -Infinity;
  const max = opts.max ?? Infinity;
  const windowSize = opts.window ?? 280;
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pages[pageIndex];
    const flags = label.flags.includes('g') ? label.flags : label.flags + 'g';
    const re = new RegExp(label.source, flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(page))) {
      const start = match.index + match[0].length;
      const slice = page.slice(start, start + windowSize);
      if (opts.percent) {
        const pct = slice.match(/(-?\d{1,2}(?:[,.]\d{1,2})?)\s*%/);
        if (pct) {
          const value = parseFrenchNumber(pct[1]);
          if (value !== null && value >= min && value <= max) {
            if (!opts.standardRates || opts.standardRates.some((x) => Math.abs(x - value) < 0.02)) return { value, page: pageIndex + 1 };
          }
        }
      } else {
        for (const candidate of numberCandidates(slice)) {
          if (candidate.value >= min && candidate.value <= max) return { value: candidate.value, page: pageIndex + 1 };
        }
      }
      if (match[0].length === 0) re.lastIndex++;
    }
  }
  return null;
}

function findDateNear(pages: string[], label: RegExp): { value: string; page: number } | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pages[pageIndex];
    const match = new RegExp(label.source, label.flags.replace('g', '')).exec(page);
    if (!match) continue;
    const slice = page.slice(match.index + match[0].length, match.index + match[0].length + 260);
    const date = slice.match(/(\d{2})[\/.\-](\d{2})[\/.\-](20\d{2})/);
    if (date) return { value: `${date[3]}-${date[2]}-${date[1]}`, page: pageIndex + 1 };
  }
  return null;
}

function sourcePageMap(found: Record<string, FoundNumber | { value: string; page: number } | null>) {
  return Object.fromEntries(Object.entries(found).filter(([, item]) => item).map(([key, item]) => [key, String((item as any).page)]));
}

function institutionFromFile(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('cic')) return 'CIC';
  if (lower.includes('ibkr') || lower.includes('interactive')) return 'Interactive Brokers';
  if (lower.includes('bnp')) return 'BNP Paribas';
  if (lower.includes('credit agricole') || lower.includes('crédit agricole')) return 'Crédit Agricole';
  if (lower.includes('banque populaire')) return 'Banque Populaire';
  if (lower.includes('axa')) return 'AXA';
  return null;
}

function parseTaxNotice(pages: string[], documentId: string, fileName: string) {
  const all = pages.join('\n');
  const yearMatch = all.match(/(?:imp[oô]t[^\n]{0,80})?revenus (?:de |per[cç]us en )?(20\d{2})/i);
  const incomeYear = yearMatch ? Number(yearMatch[1]) : null;
  const assessmentYear = incomeYear && incomeYear >= 2000 && incomeYear <= 2100 ? incomeYear + 1 : null;

  const found = {
    revenu_imposable: findNear(pages, /Revenu imposable/i, { min: 1000, max: 10000000, window: 420 }),
    revenu_fiscal_reference: findNear(pages, /Revenu fiscal de r[ée]f[ée]rence/i, { min: 1000, max: 10000000, window: 500 }),
    nombre_parts: findNear(pages, /Nombre de parts/i, { min: 0.5, max: 20, window: 220 }),
    impot_revenu_net: findNear(pages, /(?:Total de l['’]imp[oô]t sur le revenu net|IMP[OÔ]T NET)/i, { min: 0, max: 1000000, window: 400 }),
    prelevements_sociaux_nets: findNear(pages, /Total des pr[ée]l[èe]vements sociaux nets/i, { min: 0, max: 1000000, window: 300 }),
    revenus_fonciers_nets: findNear(pages, /Revenus fonciers nets/i, { min: 0, max: 10000000, window: 260 }),
    taux_imposition: findNear(pages, /Taux (?:moyen )?d['’]imposition/i, { min: 0, max: 100, window: 180, percent: true }),
    tmi: findNear(pages, /(?:TMI|Taux marginal d['’]imposition)/i, { min: 0, max: 45, window: 180, percent: true, standardRates: [0, 11, 30, 41, 45] }),
    plafond_disponible_avis: findNear(pages, /Plafond (?:pour les cotisations vers[ée]es|disponible pour la d[ée]duction)/i, { min: 100, max: 1000000, window: 700 }),
  };

  const fields: Json = {};
  const pagesByField: Json = {};
  if (assessmentYear) fields.annee_imposition = String(assessmentYear);
  for (const [key, item] of Object.entries(found)) {
    if (!item) continue;
    const value = item.value;
    fields[key] = ['tmi', 'taux_imposition', 'nombre_parts'].includes(key) ? String(value) : String(Math.round(value * 100) / 100);
    pagesByField[key] = String(item.page);
  }

  const required = ['annee_imposition','revenu_imposable','revenu_fiscal_reference','nombre_parts','tmi','impot_revenu_net'];
  const missingRequired = required.filter((key) => fields[key] === undefined || fields[key] === '');
  return {
    patches: Object.keys(fields).length ? [{ section_code: 'tax', fields, source_pages: pagesByField }] : [],
    summary: {
      parser: 'avis_imposition_fr_v1',
      file_name: fileName,
      extracted_fields: Object.keys(fields),
      missing_required_tax_fields: missingRequired,
      direct_completion_possible: missingRequired.length === 0,
      source_document_id: documentId,
    },
    status: missingRequired.length === 0 ? 'extracted' : 'to_review',
  };
}

function parseCredit(pages: string[], documentId: string, fileName: string) {
  const rate = findNear(pages, /(?:taux (?:nominal|d[ée]biteur|du pr[êe]t|du cr[ée]dit)|taux d['’]int[ée]r[êe]t)/i, { min: 0, max: 20, window: 260, percent: true });
  const monthly = findNear(pages, /(?:mensualit[ée]|montant de l['’][ée]ch[ée]ance|[ée]ch[ée]ance hors assurance)/i, { min: 10, max: 50000, window: 280 });
  const outstanding = findNear(pages, /(?:capital restant d[uû]|capital restant|CRD)/i, { min: 100, max: 10000000, window: 320 });
  const initial = findNear(pages, /(?:capital emprunt[ée]|montant (?:initial )?du pr[êe]t|montant emprunt[ée])/i, { min: 100, max: 10000000, window: 320 });
  const endDate = findDateNear(pages, /(?:date de fin|derni[èe]re [ée]ch[ée]ance|fin du pr[êe]t|terme du pr[êe]t)/i);

  const fact: Json = {
    source_document_id: documentId,
    fact_key: 'loan',
    source_file: fileName,
  };
  const sourcePages: Json = {};
  if (rate) { fact.taux_credit = rate.value; sourcePages.documented_loan_facts = String(rate.page); }
  if (monthly) { fact.mensualite = Math.round(monthly.value * 100) / 100; sourcePages.documented_loan_facts ??= String(monthly.page); }
  if (outstanding) { fact.capital_restant_du = Math.round(outstanding.value * 100) / 100; sourcePages.documented_loan_facts ??= String(outstanding.page); }
  if (initial) { fact.montant_initial = Math.round(initial.value * 100) / 100; sourcePages.documented_loan_facts ??= String(initial.page); }
  if (endDate) { fact.date_fin = endDate.value; sourcePages.documented_loan_facts ??= String(endDate.page); }

  const meaningful = Object.keys(fact).some((key) => !['source_document_id','fact_key','source_file'].includes(key));
  return {
    patches: meaningful ? [{ section_code: 'credits', fields: { documented_loan_facts: [fact] }, source_pages: sourcePages }] : [],
    summary: {
      parser: 'credit_schedule_fr_v1',
      file_name: fileName,
      extracted_fields: Object.keys(fact).filter((key) => !['source_document_id','fact_key','source_file'].includes(key)),
      source_document_id: documentId,
    },
    status: meaningful ? 'extracted' : 'to_review',
  };
}

function parseFinancial(pages: string[], documentId: string, fileName: string) {
  const institution = institutionFromFile(fileName);
  const liquidLike = /relev[ée].*(?:journalier|compte)|compte.*courant|cic/i.test(fileName);
  const balance = findNear(
    pages,
    liquidLike
      ? /(?:solde (?:disponible|cr[ée]diteur|du compte|au)|total avoirs disponibles)/i
      : /(?:valorisation totale|valeur totale|total portefeuille|encours total|total des avoirs)/i,
    { min: 0, max: 100000000, window: 380 },
  );

  const fact: Json = {
    source_document_id: documentId,
    fact_key: liquidLike ? 'cash_account' : 'financial_account',
    source_file: fileName,
    categorie_document: 'patrimoine_financier',
  };
  if (institution) fact.institution = institution;
  if (balance) {
    if (liquidLike) fact.solde_disponible = Math.round(balance.value * 100) / 100;
    else fact.valorisation = Math.round(balance.value * 100) / 100;
  }

  const meaningful = Boolean(balance);
  return {
    patches: meaningful ? [{
      section_code: 'financial',
      fields: { documented_accounts: [fact] },
      source_pages: { documented_accounts: String(balance!.page) },
    }] : [],
    summary: {
      parser: 'financial_statement_fr_v1',
      file_name: fileName,
      extracted_fields: meaningful ? [liquidLike ? 'solde_disponible' : 'valorisation'] : [],
      source_document_id: documentId,
    },
    status: meaningful ? 'extracted' : 'to_review',
  };
}

function parsePropertyOrAccounts(_pages: string[], documentId: string, fileName: string) {
  return {
    patches: [],
    summary: {
      parser: 'property_accounts_safe_v1',
      file_name: fileName,
      source_document_id: documentId,
      reason: 'Document reçu et conservé, mais aucune valeur patrimoniale n’est injectée automatiquement sans correspondance suffisamment sûre.',
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

    const { data: doc, error: docError } = await userClient
      .from('documents_sources')
      .select('id,dossier_id,investisseur_id,categorie,nom_fichier,storage_bucket,storage_path,statut_analyse,metadata')
      .eq('id', documentId)
      .single();
    if (docError || !doc) return new Response(JSON.stringify({ error: 'Document inaccessible' }), { status: 404, headers });

    await admin.from('documents_sources').update({
      statut_analyse: 'processing',
      metadata: { ...(doc.metadata ?? {}), analysis_started_at: new Date().toISOString(), analysis_error: null },
      updated_at: new Date().toISOString(),
    }).eq('id', documentId);

    if (!doc.storage_bucket || !doc.storage_path) throw new Error('Fichier source non disponible');
    const { data: blob, error: downloadError } = await admin.storage.from(doc.storage_bucket).download(doc.storage_path);
    if (downloadError || !blob) throw downloadError ?? new Error('Téléchargement impossible');
    if (blob.size > 20 * 1024 * 1024) throw new Error('Document trop volumineux pour l’analyse automatique');

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const fileHash = await sha256Hex(bytes);
    const lowerName = String(doc.nom_fichier ?? '').toLowerCase();
    const isPdf = blob.type === 'application/pdf' || lowerName.endsWith('.pdf');

    if (!isPdf) {
      const extraction = {
        parser_version: 'source-doc-v1',
        category: doc.categorie,
        format: blob.type || 'image',
        summary: {
          file_name: doc.nom_fichier,
          source_document_id: documentId,
          reason: 'Image reçue : extraction automatique différée, contrôle visuel nécessaire.',
        },
        patches: [],
      };
      const { data: applied, error: applyError } = await admin.rpc('apply_source_document_extraction', {
        p_document_id: documentId,
        p_extraction: extraction,
        p_status: 'to_review',
        p_hash_sha256: fileHash,
      });
      if (applyError) throw applyError;
      return new Response(JSON.stringify({ ok: true, document_id: documentId, result: applied }), { headers });
    }

    const pdf = await getDocumentProxy(bytes, { maxImageSize: 16_777_216 });
    if (pdf.numPages > 30) throw new Error('Document de plus de 30 pages : contrôle manuel requis');
    const extracted: any = await extractText(pdf, { mergePages: false });
    const rawText = extracted?.text;
    const pages = (Array.isArray(rawText) ? rawText : [rawText ?? '']).map((x) => normalizeText(String(x ?? '')));

    let parsed: any;
    if (doc.categorie === 'avis_imposition') parsed = parseTaxNotice(pages, documentId, doc.nom_fichier);
    else if (doc.categorie === 'tableau_amortissement') parsed = parseCredit(pages, documentId, doc.nom_fichier);
    else if (doc.categorie === 'patrimoine_financier') parsed = parseFinancial(pages, documentId, doc.nom_fichier);
    else if (doc.categorie === 'patrimoine_immobilier' || doc.categorie === 'sci_societe') parsed = parsePropertyOrAccounts(pages, documentId, doc.nom_fichier);
    else parsed = {
      patches: [],
      summary: { parser: 'generic_safe_v1', file_name: doc.nom_fichier, source_document_id: documentId, reason: 'Catégorie conservée sans injection automatique.' },
      status: 'to_review',
    };

    const extraction = {
      parser_version: 'source-doc-v1',
      category: doc.categorie,
      page_count: pdf.numPages,
      text_length: pages.reduce((sum, page) => sum + page.length, 0),
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
