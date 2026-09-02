import { createClient } from 'npm:@supabase/supabase-js@2';

const allowedOrigins = new Set([
  'https://eric-bellaiche.fr',
  'https://www.eric-bellaiche.fr',
]);

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

function json(status: number, payload: Record<string, unknown>, headers: Record<string, string>) {
  return new Response(JSON.stringify(payload), { status, headers });
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return json(405, { error: 'Méthode non autorisée' }, headers);
  if (origin && !allowedOrigins.has(origin)) return json(403, { error: 'Origine non autorisée' }, headers);

  try {
    const payload = await req.json();
    const action = payload?.action === 'lookup' ? 'lookup' : 'activate';
    const cleanToken = typeof payload?.token === 'string' ? payload.token.trim() : '';

    if (!/^[a-f0-9]{64}$/i.test(cleanToken)) {
      return action === 'lookup'
        ? json(200, { ok: false, status: 'invalid' }, headers)
        : json(400, { error: 'Invitation invalide', code: 'INVITE_INVALID' }, headers);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Configuration serveur incomplète');

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const tokenHash = await sha256Hex(cleanToken);
    const { data: invite, error: inviteError } = await admin
      .from('client_invites')
      .select('id,dossier_id,investisseur_id,email,expires_at,used_at,investisseurs(prenom,nom)')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (inviteError) throw inviteError;
    if (!invite) {
      return action === 'lookup'
        ? json(200, { ok: false, status: 'invalid' }, headers)
        : json(400, { error: 'Invitation invalide', code: 'INVITE_INVALID' }, headers);
    }

    if (invite.used_at) {
      return action === 'lookup'
        ? json(200, { ok: false, status: 'used' }, headers)
        : json(409, { error: 'Votre espace client est déjà activé. Connectez-vous avec votre adresse e-mail et votre mot de passe.', code: 'INVITE_USED' }, headers);
    }

    if (new Date(invite.expires_at).getTime() <= Date.now()) {
      return action === 'lookup'
        ? json(200, { ok: false, status: 'expired' }, headers)
        : json(410, { error: 'Ce lien d’activation a expiré. Demandez au cabinet de vous transmettre un nouveau lien.', code: 'INVITE_EXPIRED' }, headers);
    }

    const investor = Array.isArray(invite.investisseurs) ? invite.investisseurs[0] : invite.investisseurs;
    const firstName = investor?.prenom ?? '';
    const lastName = investor?.nom ?? '';

    if (action === 'lookup') {
      return json(200, {
        ok: true,
        status: 'ready',
        email: String(invite.email).trim().toLowerCase(),
        first_name: firstName,
      }, headers);
    }

    const cleanEmail = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const cleanPassword = typeof payload?.password === 'string' ? payload.password : '';

    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      return json(400, { error: 'Adresse email invalide' }, headers);
    }
    if (cleanPassword.length < 8) {
      return json(400, { error: 'Le mot de passe doit contenir au moins 8 caractères' }, headers);
    }
    if (String(invite.email).trim().toLowerCase() !== cleanEmail) {
      return json(400, { error: 'Cette invitation ne correspond pas à cette adresse email' }, headers);
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: cleanEmail,
      password: cleanPassword,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        account_type: 'client',
      },
    });

    if (createError) {
      const msg = createError.message.toLowerCase();
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        return json(409, {
          error: 'Un compte existe déjà avec cette adresse. Connectez-vous avec votre mot de passe pour utiliser cette invitation.',
          code: 'USER_EXISTS',
        }, headers);
      }
      throw createError;
    }

    const userId = created.user?.id;
    if (!userId) throw new Error('Création du compte impossible');

    const { error: claimError } = await admin.rpc('service_activate_client_invite', {
      p_token: cleanToken,
      p_email: cleanEmail,
      p_auth_user_id: userId,
    });

    if (claimError) {
      console.error('service_activate_client_invite', claimError);
      await admin.auth.admin.deleteUser(userId);
      throw claimError;
    }

    return json(200, { ok: true, status: 'activated', first_name: firstName }, headers);
  } catch (error) {
    console.error('activate-client', error);
    return json(500, { error: 'Impossible d’activer cet espace client pour le moment.' }, headers);
  }
});
