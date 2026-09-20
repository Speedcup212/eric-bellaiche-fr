const FALLBACK_SUPABASE_URL = 'https://xeloauyhlnhrvqojdudr.supabase.co';
const FALLBACK_PUBLISHABLE_KEY = 'sb_publishable_cbSjZNq4I5l_JlAobFUDVA_3UHkFaBA';
const CABINET_EMAIL = 'eric.bellaiche@gmail.com';
const TOKEN_TTL_SECONDS = 12 * 60 * 60;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlEncodeText(value: string) {
  return base64UrlEncode(new TextEncoder().encode(value));
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

async function secureEqual(left: string, right: string) {
  const leftHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(left));
  const rightHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(right));
  const a = new Uint8Array(leftHash);
  const b = new Uint8Array(rightHash);
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function getAuthenticatedUser(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;

  const supabaseUrl = Netlify.env.get('VITE_SUPABASE_URL') || FALLBACK_SUPABASE_URL;
  const publishableKey = Netlify.env.get('VITE_SUPABASE_PUBLISHABLE_KEY') || FALLBACK_PUBLISHABLE_KEY;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: publishableKey,
      authorization,
    },
  });
  if (!response.ok) return null;
  return response.json() as Promise<{ id: string; email?: string | null }>;
}

async function issueToken(userId: string, secret: string) {
  const payload = base64UrlEncodeText(JSON.stringify({
    uid: userId,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  }));
  return `${payload}.${await hmac(payload, secret)}`;
}

async function validateToken(token: string, userId: string, secret: string) {
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return false;
  const expected = await hmac(payload, secret);
  if (!(await secureEqual(signature, expected))) return false;

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    const decoded = atob(padded);
    const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes)) as { uid?: string; exp?: number };
    return data.uid === userId && typeof data.exp === 'number' && data.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export default async (request: Request) => {
  if (request.method !== 'POST') return json(405, { error: 'Méthode non autorisée.' });

  const user = await getAuthenticatedUser(request);
  if (!user || (user.email || '').toLowerCase() !== CABINET_EMAIL) {
    return json(401, { error: 'Session non autorisée.' });
  }

  const configuredCode = (Netlify.env.get('CABINET_ACCESS_CODE') || '').trim();
  const signingSecret = (Netlify.env.get('CABINET_ACCESS_SIGNING_SECRET') || '').trim();
  if (!configuredCode || !signingSecret) return json(503, { error: 'Code cabinet non configuré.' });

  let body: { code?: string; accessToken?: string };
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Requête invalide.' });
  }

  if (body.accessToken) {
    const valid = await validateToken(body.accessToken, user.id, signingSecret);
    return valid ? json(200, { valid: true }) : json(401, { valid: false });
  }

  const submittedCode = String(body.code || '').trim();
  if (!/^\d{6}$/.test(submittedCode) || !(await secureEqual(submittedCode, configuredCode))) {
    return json(401, { error: 'Code incorrect.' });
  }

  return json(200, {
    valid: true,
    accessToken: await issueToken(user.id, signingSecret),
  });
};
