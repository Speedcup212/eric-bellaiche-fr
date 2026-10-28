// Only the SHA-256 digest is public. The random credential stays in Netlify's
// CALENDLY_BRIDGE_SECRET server environment variable.
const BRIDGE_SECRET_SHA256 = '3dd0aeb4dd995b7badc50706a9a071146cb232fa338c52b8aef446a1f2e74629';
const MAX_BODY_BYTES = 32_000;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

async function validBridgeSecret(secret: string, expectedHash: string) {
  if (secret.length < 43 || secret.length > 1000 || !/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  const actual = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  let difference = 0;
  for (let index = 0; index < expectedHash.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expectedHash.charCodeAt(index);
  }
  return difference === 0;
}

export function createBridgeHandler(expectedHash = BRIDGE_SECRET_SHA256) {
  return async (req: Request) => {
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
    const length = Number(req.headers.get('content-length') ?? '0');
    if (Number.isFinite(length) && length > MAX_BODY_BYTES) return json(413, { error: 'Payload too large' });

    try {
      const body = await req.json() as { operation?: string; secret?: string; params?: Record<string, unknown> };
      const secret = typeof body.secret === 'string' ? body.secret.trim() : '';
      if (!(await validBridgeSecret(secret, expectedHash))) return json(401, { error: 'Unauthorized' });

      const operation = body.operation;
      const rpc = operation === 'booking' ? 'manage_prospect_booking_link' : operation === 'sync' ? 'sync_calendly_prospect' : null;
      if (!rpc) return json(400, { error: 'Unsupported operation' });

      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      if (!supabaseUrl || !serviceRoleKey) return json(500, { error: 'Server configuration missing' });

      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpc}`, {
        method: 'POST',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ ...(body.params ?? {}), p_secret: 'validated-calendly-bridge' }),
      });
      const text = await response.text();
      return new Response(text, {
        status: response.status,
        headers: {
          'content-type': response.headers.get('content-type') ?? 'application/json',
          'cache-control': 'no-store',
        },
      });
    } catch {
      return json(400, { error: 'Invalid request' });
    }
  };
}

Deno.serve(createBridgeHandler());

