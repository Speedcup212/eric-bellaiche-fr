import { createHash } from 'node:crypto';

// A public verifier for a high-entropy server credential, never the credential
// itself. This same digest is pinned in the Supabase bridge source.
export default async (req: Request) => {
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  if (req.method !== 'GET') return new Response(null, { status: 405, headers });
  const token = (Netlify.env.get('CALENDLY_API_TOKEN') || '').trim();
  if (token.length < 43) return new Response(JSON.stringify({ configured: false }), { status: 503, headers });
  return new Response(JSON.stringify({ configured: true, sha256: createHash('sha256').update(token).digest('hex') }), { status: 200, headers });
};

export const config = { path: '/api/calendly-bridge-status' };
