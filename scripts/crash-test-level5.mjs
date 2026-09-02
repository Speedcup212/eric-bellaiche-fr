import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
const passes = [];

function check(name, condition, detail = '') {
  if (condition) passes.push(name);
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

function includesAll(source, values) {
  return values.every((value) => source.includes(value));
}

const app = read('src/App.tsx');
const recueil = read('src/pages/portal/ClientRecueilJourneyBase.tsx');
const portalShell = read('src/portal/PortalShell.tsx');
const invitation = read('src/pages/portal/ClientInvitationPage.tsx');
const clientLogin = read('src/pages/portal/ClientLoginPage.tsx');
const passwordRecovery = read('src/pages/portal/PasswordRecoveryPage.tsx');
const invitationMailer = read('netlify/functions/send-client-invite.mts');
const activateClient = read('supabase/functions/activate-client/index.ts');
const inviteMigration = read('supabase/migrations/20260902082000_block_staff_email_client_invites.sql');
const identityMigration = read('supabase/migrations/20260902063147_harden_staff_client_identity_boundary.sql');
const rpcMigration = read('supabase/migrations/20260902063730_tighten_invite_rpc_and_esg_function_security.sql');
const workflow = read('.github/workflows/portal-ci.yml');

check(
  'L5-01 selected investor email is fetched from investisseurs',
  /from\(['"]investisseurs['"]\)[\s\S]*select\([^)]*email/.test(recueil),
  'Le recueil doit charger l’email de l’investisseur ciblé.'
);
check(
  'L5-02 displayed email comes from selected investor, never auth session',
  recueil.includes("setAccountEmail(investor?.email ?? '')") && !recueil.includes("setAccountEmail(data.user?.email"),
  'Une session cabinet ne doit jamais devenir l’email affiché du client.'
);
check(
  'L5-03 client portal has an explicit role boundary',
  includesAll(portalShell, ["accountRole === 'cif'", "accountRole === 'admin'", '<Navigate to="/cabinet" replace />']),
  'Les comptes cabinet doivent être redirigés hors du parcours client.'
);
check(
  'L5-04 invitation page blocks an active cabinet session',
  includesAll(invitation, ["account.role === 'cif'", "account.role === 'admin'", "navigate('/cabinet'"]),
  'Un CIF/admin connecté ne doit pas pouvoir consommer un lien client.'
);
check(
  'L5-05 invite creation/claim/service reject staff addresses',
  (inviteMigration.match(/email_belongs_to_staff/g) ?? []).length >= 4 && /compte cabinet/i.test(inviteMigration),
  'La protection doit exister aux trois points d’entrée.'
);
check(
  'L5-06 investisseurs table rejects staff identity collisions',
  includesAll(identityMigration, ['trg_guard_investor_staff_identity', 'email_belongs_to_staff', "role in ('cif','admin')"]),
  'La base doit bloquer la collision même si une future UI oublie le contrôle.'
);
check(
  'L5-07 sensitive staff RPCs are revoked from public/anon',
  includesAll(rpcMigration, ['get_client_invite_statuses() from public, anon', 'mark_client_invite_sent(uuid, uuid, timestamptz, text) from public, anon']),
  'Réduction de surface RPC anonyme attendue.'
);
check(
  'L5-08 dependency audit cannot suppress quality tests',
  /jobs:\s*[\s\S]*dependency-audit:/.test(workflow) && /\n\s{2}quality:/.test(workflow),
  'Audit dépendances et tests fonctionnels doivent être dans des jobs indépendants.'
);
check(
  'L5-09 client login exposes secure password recovery',
  includesAll(clientLogin, ['Mot de passe oublié ?', 'resetPasswordForEmail', 'client-recovery=1']),
  'Le client doit pouvoir demander un lien de réinitialisation depuis la page de connexion.'
);
check(
  'L5-10 client recovery returns to client login, not cabinet',
  includesAll(passwordRecovery, ["params.get('client-recovery') === '1'", "'/espace-client/connexion?reset=ok'", 'await supabase.auth.signOut()']),
  'Une récupération client ne doit jamais ouvrir le cockpit cabinet.'
);
check(
  'L5-11 public site exposes a permanent Espace client entry point',
  includesAll(app, ['Espace client', 'to="/espace-client/connexion"', 'aria-label="Accéder à mon espace client"']),
  'Le client doit savoir où revenir sans retrouver son email d’invitation.'
);
check(
  'L5-12 used invitation explains that the client space is already active',
  includesAll(invitation, ['Votre espace client est déjà activé', 'Accéder à mon espace client', "status === 'used'", "localStorage.removeItem('cgp_pending_invite_token')"]),
  'Un second clic sur le lien ne doit jamais être présenté comme une invitation simplement invalide.'
);
check(
  'L5-13 invitation email documents the permanent login URL',
  includesAll(invitationMailer, ["const CLIENT_LOGIN_URL = 'https://eric-bellaiche.fr/espace-client/connexion'", 'bouton « Espace client »', '${CLIENT_LOGIN_URL}']),
  'L’email initial doit indiquer où reprendre le dossier après activation.'
);
check(
  'L5-14 activate-client distinguishes used, expired and invalid invitations',
  includesAll(activateClient, ["status: 'used'", "status: 'expired'", "status: 'invalid'", "code: 'INVITE_USED'", "code: 'INVITE_EXPIRED'"]),
  'Le backend doit exposer un statut explicite au lieu de fusionner tous les cas.'
);

const baseUrl = process.env.LEVEL5_BASE_URL || 'https://eric-bellaiche.fr';
const supabaseUrl = process.env.LEVEL5_SUPABASE_URL || 'https://xeloauyhlnhrvqojdudr.supabase.co';
const publishableKey = process.env.LEVEL5_SUPABASE_KEY || 'sb_publishable_cbSjZNq4I5l_JlAobFUDVA_3UHkFaBA';

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal, redirect: 'manual' });
  } finally {
    clearTimeout(timer);
  }
}

async function productionChecks() {
  for (const route of ['/', '/espace-client/connexion', '/espace-client/invitation']) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}${route}`);
      check(`L5-HTTP route ${route}`, response.status >= 200 && response.status < 400, `HTTP ${response.status}`);
    } catch (error) {
      failures.push(`L5-HTTP route ${route} — ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/send-client-invite`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    check('L5-HTTP invitation mail endpoint rejects anonymous caller', response.status === 401, `HTTP ${response.status}`);
  } catch (error) {
    failures.push(`L5-HTTP invitation mail endpoint — ${error instanceof Error ? error.message : String(error)}`);
  }

  const anonHeaders = {
    apikey: publishableKey,
    Authorization: `Bearer ${publishableKey}`,
    'content-type': 'application/json',
  };

  try {
    const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/activate-client`, {
      method: 'POST',
      headers: anonHeaders,
      body: JSON.stringify({ action: 'lookup', token: '0'.repeat(64) }),
    });
    const body = await response.json().catch(() => ({}));
    check('L5-EDGE activate-client returns explicit invalid lookup status', response.status === 200 && body?.status === 'invalid', `HTTP ${response.status}; status ${body?.status ?? 'none'}`);
  } catch (error) {
    failures.push(`L5-EDGE activate-client — ${error instanceof Error ? error.message : String(error)}`);
  }

  for (const table of ['investisseurs', 'dossiers', 'client_invites']) {
    try {
      const response = await fetchWithTimeout(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, { headers: anonHeaders });
      const text = await response.text();
      const exposedRows = response.ok && /^\s*\[\s*\{/.test(text);
      check(`L5-RLS anon cannot read ${table}`, !exposedRows, `HTTP ${response.status}; body starts ${text.slice(0, 80)}`);
    } catch (error) {
      failures.push(`L5-RLS ${table} — ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  for (const rpc of ['get_client_invite_statuses', 'claim_client_invite']) {
    try {
      const body = rpc === 'claim_client_invite' ? { p_token: 'level5-invalid-token' } : {};
      const response = await fetchWithTimeout(`${supabaseUrl}/rest/v1/rpc/${rpc}`, {
        method: 'POST',
        headers: anonHeaders,
        body: JSON.stringify(body),
      });
      check(`L5-RPC anon denied ${rpc}`, [401, 403, 404].includes(response.status), `HTTP ${response.status}`);
    } catch (error) {
      failures.push(`L5-RPC ${rpc} — ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

await productionChecks();

console.log(`\nLEVEL 5 CRASH TEST — ${passes.length} contrôles PASS / ${failures.length} FAIL`);
for (const item of passes) console.log(`PASS  ${item}`);
if (failures.length) {
  console.error('\nÉCHECS BLOQUANTS');
  for (const item of failures) console.error(`FAIL  ${item}`);
  process.exit(1);
}
console.log('\nPASS GLOBAL — frontières identité/roles, accès client permanent, invitations, surface publique et RLS anonyme contrôlés.');
