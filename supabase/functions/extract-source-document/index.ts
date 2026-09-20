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
  const matches = text.match(/-?\d{1,3}(?:[ .\u00a0]\d{3})*(?:[,.]\d{1,2})?|-?\d+(?:[,.]\d{1,2})?/g) ?? [];
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

function parseTaxNotice(pages: string[], documentId: string, fileName: string, targetIds: string[]) {
  const all = pages.join('\n');
  const yearMatch = all.match(/revenus (?:de |per[cç]us en )?(20\d{2})/i);
  const incomeYear = yearMatch ? Number(yearMatch[1]) : null;
  const assessmentYear = incomeYear && incomeYear >= 2000 && incomeYear <= 2100 ? incomeYear + 1 : null;

  const revenuImposable = findLineNumber(pages, /^\s*Revenu imposable/i, { min: 0, max: 10000000 });
  const rfr = findLineNumber(pages, /Revenu fiscal de r[ée]f[ée]rence/i, { min: 0, max: 10000000 });
  const parts = findTaxParts(pages, rfr?.value ?? null);
  const impotNet = findLineNumber(pages, /Total de l['’]imp[oô]t sur le revenu net/i, { min: 0, max: 1000000 });
  const prelevements = findLineNumber(pages, /Total des pr[ée]l[èe]vements sociaux nets/i, { min: 0, max: 1000000 });
  const tmi = findLineNumber(pages, /Taux marginal d['’]imposition/i, { min: 0, max: 45, percent: true });
  const tauxMoyen = findLineNumber(pages, /Taux moyen d['’]imposition/i, { min: 0, max: 100, percent: true });
  const revenusFonciers = findLineNumber(pages, /^\s*Revenus fonciers nets/i, { min: 0, max: 10000000 });

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
      parser: 'avis_imposition_fr_v2',
      file_name: fileName,
      extracted_fields: Object.keys(fields),
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
  const rate = findLineNumber(pages, /(?:taux (?:nominal|d[ée]biteur|du pr[êe]t|du cr[ée]dit)|taux d['’]int[ée]r[êe]t)/i, { min: 0, max: 20, percent: true });
  const monthly = findLineNumber(pages, /(?:mensualit[ée]|montant de l['’][ée]ch[ée]ance|[ée]ch[ée]ance hors assurance)/i, { min: 1, max: 50000 });
  const outstanding = findLineNumber(pages, /(?:capital restant d[uû]|capital restant|CRD)/i, { min: 0, max: 10000000 });
  const initial = findLineNumber(pages, /(?:capital emprunt[ée]|montant (?:initial )?du pr[êe]t|montant emprunt[ée])/i, { min: 100, max: 10000000 });
  const endDate = findDateNear(pages, /(?:date de fin|derni[èe]re [ée]ch[ée]ance|fin du pr[êe]t|terme du pr[êe]t)/i);

  const fact: Json = {
    source_document_id: documentId,
    source_file: fileName,
  };
  const sourcePages: Json = {};
  if (rate) { fact.taux_credit = rate.value; sourcePages.__merge_credit_items = String(rate.page); }
  if (monthly) { fact.mensualite = Math.round(monthly.value * 100) / 100; sourcePages.__merge_credit_items ??= String(monthly.page); }
  if (outstanding) { fact.capital_restant_du = Math.round(outstanding.value * 100) / 100; sourcePages.__merge_credit_items ??= String(outstanding.page); }
  if (initial) { fact.montant_initial = Math.round(initial.value * 100) / 100; sourcePages.__merge_credit_items ??= String(initial.page); }
  if (endDate) { fact.date_fin = endDate.value; sourcePages.__merge_credit_items ??= String(endDate.page); }
  if (detectedMembers.length === 1) {
    const member = members.find((item) => item.investisseur_id === detectedMembers[0]);
    fact.emprunteur_investisseur_id = detectedMembers[0];
    if (member) fact.emprunteur = member.role_dossier === 'investisseur_2' ? 'Identifiant 2' : 'Identifiant 1';
  } else if (detectedMembers.length > 1) {
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
      parser: 'credit_schedule_fr_v2',
      file_name: fileName,
      extracted_fields: extractedFields,
      borrower_matches: detectedMembers,
      source_document_id: documentId,
      safe_crd_rule: 'same-line-label-only',
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

      const extraction = {
        parser_version: 'source-doc-v2',
        category: doc.categorie,
        format: blob.type || 'image',
        scope_detection: { mode: doc.portee_document, concerned_investor_ids: scopeIds },
        summary: {
          file_name: doc.nom_fichier,
          source_document_id: documentId,
          reason: 'Image reçue : aucune donnée n’est inventée sans lecture fiable. La pièce reste visible au cabinet pour contrôle.',
        },
        patches: [],
      };

      await admin.from('documents_sources').update({
        portee_document: doc.portee_document === 'auto' && scopeIds.length > 1 ? 'foyer' : doc.portee_document === 'auto' ? 'investisseur' : doc.portee_document,
        concerne_investisseur_ids: scopeIds,
      }).eq('id', documentId);

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
      parsed = parseTaxNotice(pages, documentId, doc.nom_fichier, concernedIds);
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
      parser_version: 'source-doc-v2',
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
