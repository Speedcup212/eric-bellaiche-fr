import { createClient } from '@supabase/supabase-js';
import { writeFile } from 'node:fs/promises';

const url = process.env.QA_SUPABASE_URL;
const key = process.env.QA_SUPABASE_ANON_KEY;
const runId = process.env.QA_RUN_ID;
const expectPdf = process.env.QA_EXPECT_PDF !== 'false';
if (!url || !key || !runId) throw new Error('Missing QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY or QA_RUN_ID');

const password = `QaE2e!${runId}aA9`;
const emails = {
  cif: `qa.cgp.${runId}.cif@outlook.com`,
  client1: `qa.cgp.${runId}.client1@outlook.com`,
  client2: `qa.cgp.${runId}.client2@outlook.com`,
};
const reference = `QA-E2E-${runId}`;
const report = { runId, reference, emails, startedAt: new Date().toISOString(), checks: [], ids: {}, pdfs: [] };

function ok(label, details = undefined) {
  report.checks.push({ label, ok: true, details });
  console.log(`PASS ${label}${details ? ` — ${JSON.stringify(details)}` : ''}`);
}
function fail(label, error) {
  const message = error instanceof Error ? error.message : String(error);
  report.checks.push({ label, ok: false, error: message });
  throw new Error(`${label}: ${message}`);
}
function unwrap(label, result) {
  if (result.error) fail(label, result.error);
  ok(label);
  return result.data;
}
function client() {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
async function signupConfirmLogin(role) {
  const email = emails[role];
  const c = client();
  const signed = await c.auth.signUp({ email, password });
  if (signed.error) {
    ok(`Auth signup ${role} fallback`, { message: signed.error.message });
  } else if (signed.data.user) {
    ok(`Auth signup ${role}`, { userId: signed.data.user.id, sessionInitiallyPresent: Boolean(signed.data.session) });
  } else {
    ok(`Auth signup ${role} fallback`, { message: 'No user returned by signup' });
  }
  const provisioned = unwrap(`QA provision ${role}`, await c.rpc('qa_provision_test_user', { p_email: email, p_password: password }));
  unwrap(`QA confirm ${role}`, await c.rpc('qa_confirm_test_user', { p_email: email }));
  const login = await c.auth.signInWithPassword({ email, password });
  if (login.error) fail(`Auth login ${role}`, login.error);
  if (!login.data.session || !login.data.user) fail(`Auth login ${role}`, new Error('session not created'));
  if (provisioned && login.data.user.id !== provisioned) fail(`Auth identity consistency ${role}`, new Error(`login=${login.data.user.id} provisioned=${provisioned}`));
  ok(`Auth login ${role}`, { userId: login.data.user.id });
  return { c, user: login.data.user };
}
async function save(c, dossierId, code, payload) {
  unwrap(`Recueil ${code}`, await c.rpc('save_my_recueil_section', {
    p_dossier_id: dossierId,
    p_section_code: code,
    p_payload: payload,
    p_completed: true,
  }));
}
async function fillRecueil(c, dossierId, person, isPrimary) {
  await save(c, dossierId, 'identity', {
    civilite: person.civilite,
    prenom: person.prenom,
    nom: person.nom,
    nom_naissance: person.civilite === 'Mme' ? 'DURAND' : '',
    date_naissance: person.dateNaissance,
    lieu_naissance: 'Grenoble',
    pays_naissance: 'France',
    nationalite: 'Française',
    mesure_protection: false,
    mobile: person.mobile,
    telephone_bureau: '',
    telephone_domicile: '',
    numero_fiscal: person.numeroFiscal,
    address: { numero_voie: '12 rue de la QA', complement: '', code_postal: '38000', ville: 'Grenoble', pays: 'France', type_logement: 'Propriétaire' },
  });
  if (isPrimary) {
    unwrap('Recueil family + orchestration couple', await c.rpc('save_my_family_setup', {
      p_dossier_id: dossierId,
      p_payload: {
        situation: 'Marié', date_evenement: '2010-06-01', regime_convention: 'Communauté réduite aux acquêts', avantage_matrimonial: '', evolution_prevue: '', notaire_nom_ville: '', expert_comptable_nom_ville: '', nombre_enfants: 2, commentaires: 'Dossier QA E2E couple',
      },
      p_situation: 'Marié', p_civilite: 'Mme', p_prenom: 'BETA', p_nom: 'QA', p_email: emails.client2, p_mobile: '0622222222',
    }));
  }
  await save(c, dossierId, 'professional', {
    profession_actuelle: 'Ingénieur QA', societe: 'QA SAS', secteur_activite: 'Technologie', statut: 'Salarié', categorie_socioprofessionnelle: 'Cadre', date_entree: '2020-01', changement_professionnel_prevu: false, changement_professionnel_details: '', precisions: '',
  });
  await save(c, dossierId, 'objectives', {
    items: [{ code_objectif: 'constitution_patrimoine', horizon_annees: 10, commentaire: 'Test E2E' }],
  });
  await save(c, dossierId, 'capacity', {
    estimation_revenus_travail_annuels: isPrimary ? 60000 : 50000,
    estimation_revenus_fonciers_annuels: 0,
    epargne_precaution_cible: 15000,
    capacite_epargne_mensuelle: 1000,
    apport_immobilier_possible: 0,
  });
  await save(c, dossierId, 'tax', {
    annee_imposition: 2025,
    salaires_assimiles: isPrimary ? 60000 : 50000,
    pensions_retraites_rentes: 0,
    revenus_lmnp: 0,
    revenus_bnc_pro: 0,
    revenus_capitaux_mobiliers: 0,
    revenus_fonciers_nets: 0,
    revenu_imposable: isPrimary ? 52000 : 43000,
    impot_revenu_net: isPrimary ? 6500 : 4800,
    prelevements_sociaux_nets: 0,
    taux_imposition: 10,
    tmi: 30,
    revenu_fiscal_reference: isPrimary ? 54000 : 45000,
    nombre_parts: 1,
    deficit_foncier_reportable: 0,
    evolution_revenus_commentaire: 'Stable',
    plafond_disponible_avis: 5000,
    versements_a_deduire: 0,
    plafond_non_utilise_calcule: 5000,
    ifi_concerne: false,
  });
  await save(c, dossierId, 'patrimony', { has_real_estate: false, immobilier: [], placements: [], comptes_courants: [] });
  await save(c, dossierId, 'financial', { current_accounts_intentional: false, categories: ['none'], completeness_confirmed: true, other_details: '' });
  await save(c, dossierId, 'credits', { has_credits: false, items: [] });
  await save(c, dossierId, 'regulatory', {
    pays_residence_fiscale: 'France', citoyen_ou_resident_us: false, code_tin: '', fatca_crs_concerne: false,
    sanctions_declarees: false, ppe_declaree: false, ppe_entourage: false, ppe_personne_exposee: '', ppe_motif: '', ppe_pays_exercice: '', ppe_anciennete: '',
    commentaire_fiscal: '', commentaire_lcbft: '', esg_opt_in: true,
  });
}
async function completeQpi(c, sessionId) {
  unwrap('QPI start', await c.rpc('start_questionnaire_session', { p_session_id: sessionId }));
  const qs = unwrap('QPI load questions', await c.from('questionnaire_questions').select('id,code,obligatoire,scoree,metadata').eq('template_id', (await c.from('questionnaire_sessions').select('template_id').eq('id', sessionId).single()).data.template_id).eq('obligatoire', true).order('ordre'));
  const qids = qs.map((q) => q.id);
  const options = unwrap('QPI load options', await c.from('questionnaire_options').select('id,question_id,code,ordre,points').in('question_id', qids).order('ordre'));
  const byQ = new Map();
  for (const o of options) { if (!byQ.has(o.question_id)) byQ.set(o.question_id, []); byQ.get(o.question_id).push(o); }
  const desired = { Q3: 'C', Q4: 'A', Q9: 'C', Q10: 'D', Q21: 'D', Q22: 'D', Q23: 'D', Q24: 'D', Q25: 'D' };
  const answers = qs.map((q) => {
    const opts = byQ.get(q.id) ?? [];
    const code = q.metadata?.correct_option ?? desired[q.code] ?? opts[0]?.code;
    const opt = opts.find((o) => o.code === code);
    if (!opt) throw new Error(`No option for ${q.code}/${code}`);
    return { session_id: sessionId, question_id: q.id, option_id: opt.id, answer_json: q.code === 'Q10' ? { perte_max_declairee_montant: 20000 } : null };
  });
  unwrap('QPI save answers', await c.from('questionnaire_answers').insert(answers));
  const families = ['liquidites', 'obligations', 'actions', 'immobilier_papier', 'structures'];
  unwrap('QPI product experience', await c.from('qpi_product_experience').insert(families.map((famille_produit) => ({ session_id: sessionId, famille_produit, niveau_experience: 'deja_detenu' }))));
  unwrap('QPI general experience', await c.from('qpi_experience_details').insert({ session_id: sessionId, connaissance_par_formation_ou_profession: false, sources_pertinentes: [], precisions_formation_profession: '', anciennete_experience: '2_5_ans', montant_habituel_operation: '10_50k', mode_gestion: 'accompagne_conseille' }));
  unwrap('QPI complete', await c.rpc('complete_questionnaire_session', { p_session_id: sessionId }));
  const result = unwrap('QPI result', await c.from('qpi_results').select('score_tolerance,score_max,profil_indicatif,profil_operationnel_final,ecart_declared_objective,synthese_dimensions').eq('session_id', sessionId).single());
  if (!result.profil_operationnel_final) fail('QPI final profile', new Error('profile missing'));
  ok('QPI final profile', result);
  return result;
}
async function completeEsg(c, sessionId) {
  unwrap('ESG start', await c.rpc('start_questionnaire_session', { p_session_id: sessionId }));
  const session = unwrap('ESG session', await c.from('questionnaire_sessions').select('template_id').eq('id', sessionId).single());
  const qs = unwrap('ESG load questions', await c.from('questionnaire_questions').select('id,code,type_reponse,ordre').eq('template_id', session.template_id).order('ordre'));
  const qids = qs.map((q) => q.id);
  const options = unwrap('ESG load options', await c.from('questionnaire_options').select('id,question_id,code,ordre').in('question_id', qids).order('ordre'));
  const optionFor = (questionId, code) => {
    const o = options.find((x) => x.question_id === questionId && x.code === code);
    if (!o) throw new Error(`Missing ESG option ${code}`);
    return o.id;
  };
  const rows = [];
  for (const q of qs) {
    const base = { session_id: sessionId, question_id: q.id };
    if (q.code === 'ESG_SCOPE') rows.push({ ...base, option_id: optionFor(q.id, 'ALLOCATION') });
    else if (q.code === 'ESG_TAX_PREF' || q.code === 'ESG_SFDR_PREF' || q.code === 'ESG_PAI_PREF') rows.push({ ...base, option_id: optionFor(q.id, 'OUI') });
    else if (q.code === 'ESG_TAX_MIN' || q.code === 'ESG_SFDR_MIN') rows.push({ ...base, option_id: optionFor(q.id, '20') });
    else if (q.code === 'ESG_TAX_OBJECTIVES') rows.push({ ...base, answer_json: ['CLIMAT'] });
    else if (q.code === 'ESG_SFDR_THEMES') rows.push({ ...base, answer_json: ['ENVIRONNEMENT'] });
    else if (q.code === 'ESG_PAI_PRIORITIES') rows.push({ ...base, answer_json: ['GES'] });
    else if (q.code === 'ESG_PAI_MODALITIES') rows.push({ ...base, answer_json: ['EXCLUSION'] });
    else if (q.code === 'ESG_EXCLUSIONS') rows.push({ ...base, answer_json: ['TABAC'] });
    else if (q.code === 'ESG_LIMITATIONS') rows.push({ ...base, answer_json: ['OFFRE'] });
    else if (q.code === 'ESG_NEEDS') rows.push({ ...base, answer_text: 'Préférences QA E2E.' });
  }
  unwrap('ESG save answers', await c.from('questionnaire_answers').insert(rows));
  unwrap('ESG complete', await c.rpc('complete_questionnaire_session', { p_session_id: sessionId }));
  const pref = unwrap('ESG materialized preferences', await c.from('esg_preferences').select('*').eq('session_id', sessionId).single());
  if (!pref.synthese_reglementaire) fail('ESG regulatory summary', new Error('summary missing'));
  ok('ESG regulatory summary', { synthese: pref.synthese_reglementaire });
  return pref;
}
async function fillDocumentContext(c, dossierId, investorId) {
  unwrap('Document context', await c.from('document_context_answers').upsert({ dossier_id: dossierId, investisseur_id: investorId, tax_status: 'no_personal_notice', tax_absence_reason: 'first_declaration', tax_absence_other: null, has_liquidities: false, has_financial_assets: false, has_real_estate: false, has_credits: false, has_sci_company: false }, { onConflict: 'dossier_id,investisseur_id' }));
}

try {
  const cif = await signupConfirmLogin('cif');
  unwrap('CIF bootstrap', await cif.c.rpc('bootstrap_cif'));
  const cifRole = unwrap('CIF role check', await cif.c.from('app_users').select('role,actif').eq('auth_user_id', cif.user.id).single());
  if (!cifRole.actif || !['cif', 'admin'].includes(cifRole.role)) fail('CIF authorization', new Error('CIF role not active'));
  ok('CIF authorization', cifRole);

  const created = unwrap('Create couple dossier', await cif.c.rpc('create_client_dossier', {
    p_reference: reference, p_libelle: 'ALPHA QA & BETA QA',
    p_inv1_prenom: 'ALPHA', p_inv1_nom: 'QA', p_inv1_email: emails.client1, p_inv1_mobile: '0611111111',
    p_inv2_prenom: 'BETA', p_inv2_nom: 'QA', p_inv2_email: emails.client2, p_inv2_mobile: '0622222222',
  }));
  const dossierId = created.dossier_id;
  const inv1 = created.investisseur_1_id;
  const inv2 = created.investisseur_2_id;
  Object.assign(report.ids, { cifUserId: cif.user.id, dossierId, investor1Id: inv1, investor2Id: inv2 });

  const token1 = unwrap('Create invite client1', await cif.c.rpc('create_client_invite', { p_dossier_id: dossierId, p_investisseur_id: inv1, p_email: emails.client1, p_validity_days: 7 }));
  const token2 = unwrap('Create invite client2', await cif.c.rpc('create_client_invite', { p_dossier_id: dossierId, p_investisseur_id: inv2, p_email: emails.client2, p_validity_days: 7 }));

  const client1 = await signupConfirmLogin('client1');
  const client2 = await signupConfirmLogin('client2');
  unwrap('Claim invite client1', await client1.c.rpc('claim_client_invite', { p_token: token1 }));
  unwrap('Claim invite client2', await client2.c.rpc('claim_client_invite', { p_token: token2 }));
  Object.assign(report.ids, { client1UserId: client1.user.id, client2UserId: client2.user.id });

  const own1 = unwrap('Client1 own app_user only', await client1.c.from('app_users').select('auth_user_id,role'));
  if (own1.length !== 1 || own1[0].auth_user_id !== client1.user.id || own1[0].role !== 'client') fail('Client1 identity isolation', new Error(`Unexpected app_users visibility ${JSON.stringify(own1)}`));
  ok('Client1 identity isolation');

  await fillRecueil(client1.c, dossierId, { civilite: 'Mr', prenom: 'ALPHA', nom: 'QA', dateNaissance: '1980-01-15', mobile: '0611111111', numeroFiscal: '1111111111111' }, true);
  await fillRecueil(client2.c, dossierId, { civilite: 'Mme', prenom: 'BETA', nom: 'QA', dateNaissance: '1982-03-20', mobile: '0622222222', numeroFiscal: '2222222222222' }, false);
  await fillDocumentContext(client1.c, dossierId, inv1);
  await fillDocumentContext(client2.c, dossierId, inv2);
  unwrap('Validate recueil client1', await client1.c.rpc('validate_my_recueil', { p_dossier_id: dossierId }));
  unwrap('Validate recueil client2', await client2.c.rpc('validate_my_recueil', { p_dossier_id: dossierId }));

  const progress1 = unwrap('Portal progress client1', await client1.c.from('portal_progress').select('*').eq('dossier_id', dossierId).eq('investisseur_id', inv1).single());
  const progress2 = unwrap('Portal progress client2', await client2.c.from('portal_progress').select('*').eq('dossier_id', dossierId).eq('investisseur_id', inv2).single());
  if (!progress1.qpi_session_id || !progress2.qpi_session_id) fail('QPI session creation', new Error('QPI sessions missing'));
  ok('QPI session creation', { qpi1: progress1.qpi_session_id, qpi2: progress2.qpi_session_id });

  await completeQpi(client1.c, progress1.qpi_session_id);
  await completeQpi(client2.c, progress2.qpi_session_id);

  const afterQpi1 = unwrap('Progress after QPI client1', await client1.c.from('portal_progress').select('*').eq('dossier_id', dossierId).eq('investisseur_id', inv1).single());
  const afterQpi2 = unwrap('Progress after QPI client2', await client2.c.from('portal_progress').select('*').eq('dossier_id', dossierId).eq('investisseur_id', inv2).single());
  if (!afterQpi1.esg_session_id || !afterQpi2.esg_session_id) fail('ESG session creation', new Error('ESG sessions missing'));
  ok('ESG session creation', { esg1: afterQpi1.esg_session_id, esg2: afterQpi2.esg_session_id });

  await completeEsg(client1.c, afterQpi1.esg_session_id);
  await completeEsg(client2.c, afterQpi2.esg_session_id);

  const visibleToClient1 = unwrap('Client1 questionnaire isolation query', await client1.c.from('questionnaire_sessions').select('id,investisseur_id').eq('dossier_id', dossierId));
  if (visibleToClient1.some((x) => x.investisseur_id !== inv1)) fail('Client1 questionnaire isolation', new Error(`Client1 can see partner questionnaire: ${JSON.stringify(visibleToClient1)}`));
  ok('Client1 questionnaire isolation', { visibleSessions: visibleToClient1.length });

  const beforeSpouse = unwrap('Read spouse before forbidden update', await client1.c.from('investisseurs').select('id,prenom').eq('id', inv2).single());
  const forbiddenUpdate = await client1.c.from('investisseurs').update({ prenom: 'HACKED' }).eq('id', inv2).select('id,prenom');
  if (forbiddenUpdate.error) ok('Client write isolation enforced', { mode: 'RLS error', code: forbiddenUpdate.error.code });
  else if ((forbiddenUpdate.data ?? []).length === 0) ok('Client write isolation enforced', { mode: '0 rows updated' });
  else fail('Client write isolation enforced', new Error('Partner row was writable'));
  const afterSpouse = unwrap('Read spouse after forbidden update', await client1.c.from('investisseurs').select('id,prenom').eq('id', inv2).single());
  if (beforeSpouse.prenom !== afterSpouse.prenom) fail('Partner integrity after forbidden update', new Error(`${beforeSpouse.prenom} -> ${afterSpouse.prenom}`));
  ok('Partner integrity after forbidden update');

  unwrap('Final dossier transmission', await client1.c.rpc('complete_my_documents', { p_dossier_id: dossierId }));
  const finalRows = unwrap('CIF final investor statuses', await cif.c.from('dossier_investisseurs').select('investisseur_id,recueil_status,qpi_status,esg_status,documents_status,transmitted_at').eq('dossier_id', dossierId).order('role_dossier'));
  if (finalRows.length !== 2 || finalRows.some((x) => x.recueil_status !== 'validated' || !['completed', 'validated'].includes(x.qpi_status) || !['completed', 'validated'].includes(x.esg_status) || x.documents_status !== 'completed' || !x.transmitted_at)) fail('Final chain statuses', new Error(JSON.stringify(finalRows)));
  ok('Final chain statuses', finalRows);

  const dossier = unwrap('CIF dossier verification', await cif.c.from('dossiers').select('id,reference,libelle,recueil_status').eq('id', dossierId).single());
  if (dossier.reference !== reference || dossier.recueil_status !== 'validated') fail('CIF dossier verification', new Error(JSON.stringify(dossier)));
  ok('CIF dossier verification', dossier);

  const qpiRows = unwrap('CIF QPI verification', await cif.c.from('qpi_results').select('session_id,profil_operationnel_final,score_tolerance,score_max').in('session_id', [progress1.qpi_session_id, progress2.qpi_session_id]));
  if (qpiRows.length !== 2 || qpiRows.some((x) => !x.profil_operationnel_final)) fail('CIF QPI verification', new Error(JSON.stringify(qpiRows)));
  ok('CIF QPI verification', qpiRows);

  const esgRows = unwrap('CIF ESG verification', await cif.c.from('esg_preferences').select('session_id,synthese_reglementaire').in('session_id', [afterQpi1.esg_session_id, afterQpi2.esg_session_id]));
  if (esgRows.length !== 2 || esgRows.some((x) => !x.synthese_reglementaire)) fail('CIF ESG verification', new Error(JSON.stringify(esgRows)));
  ok('CIF ESG verification', { count: esgRows.length });

  if (expectPdf) {
    const generated = await cif.c.functions.invoke('generate-cif-pdfs', { body: { dossier_id: dossierId, document_types: ['recueil', 'qpi', 'esg'] } });
    if (generated.error) fail('Generate regulatory PDFs', generated.error);
    if (!generated.data?.ok || !Array.isArray(generated.data.documents) || generated.data.documents.length !== 3) fail('Generate regulatory PDFs', new Error(JSON.stringify(generated.data)));
    ok('Generate regulatory PDFs', { version: generated.data.version, count: generated.data.documents.length });
    for (const doc of generated.data.documents) {
      if (!doc.signed_url) fail(`PDF signed URL ${doc.type}`, new Error('missing signed_url'));
      const response = await fetch(doc.signed_url);
      if (!response.ok) fail(`PDF download ${doc.type}`, new Error(`HTTP ${response.status}`));
      const bytes = new Uint8Array(await response.arrayBuffer());
      const signature = new TextDecoder().decode(bytes.slice(0, 5));
      if (signature !== '%PDF-') fail(`PDF integrity ${doc.type}`, new Error(`bad signature ${signature}`));
      if (bytes.length < 1000) fail(`PDF integrity ${doc.type}`, new Error(`PDF too small: ${bytes.length}`));
      report.pdfs.push({ type: doc.type, documentId: doc.document_id, bytes: bytes.length, path: doc.path, reused: doc.reused });
      ok(`PDF integrity ${doc.type}`, { bytes: bytes.length, path: doc.path });
    }
  }

  report.finishedAt = new Date().toISOString();
  report.status = 'PASS';
  await writeFile('qa-e2e-report.json', JSON.stringify(report, null, 2));
  console.log(`E2E_RESULT PASS dossier=${report.ids.dossierId} checks=${report.checks.length} pdfs=${report.pdfs.length}`);
} catch (error) {
  report.finishedAt = new Date().toISOString();
  report.status = 'FAIL';
  report.error = error instanceof Error ? error.stack ?? error.message : String(error);
  await writeFile('qa-e2e-report.json', JSON.stringify(report, null, 2));
  console.error(report.error);
  process.exitCode = 1;
}
