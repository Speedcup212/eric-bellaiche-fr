const FALLBACK_SUPABASE_URL = 'https://xeloauyhlnhrvqojdudr.supabase.co';
const FALLBACK_SUPABASE_KEY = 'sb_publishable_cbSjZNq4I5l_JlAobFUDVA_3UHkFaBA';
const EVENT_TYPE_URI = 'https://api.calendly.com/event_types/1fe0220e-9d29-4cec-aa90-1ed35f88239f';
const MAX_BOOKING_TIME_SECONDS = 14 * 24 * 60 * 60;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

async function prospectRpc(params: { secret: string; leadId: string; email: string; bookingUrl?: string | null }) {
  const supabaseUrl = Netlify.env.get('VITE_SUPABASE_URL') || FALLBACK_SUPABASE_URL;
  const supabaseKey = Netlify.env.get('VITE_SUPABASE_PUBLISHABLE_KEY') || FALLBACK_SUPABASE_KEY;
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/manage_prospect_booking_link`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      p_secret: params.secret,
      p_lead_id: params.leadId,
      p_email: params.email,
      p_booking_url: params.bookingUrl ?? null,
    }),
  });
  if (!response.ok) throw new Error(`Prospect authorization ${response.status}: ${(await response.text()).slice(0, 400)}`);
  return response.json() as Promise<{ ok?: boolean; eligible?: boolean; qualification?: string; first_name?: string; email?: string; booking_url?: string | null }>;
}

async function createShare(token: string) {
  const response = await fetch('https://api.calendly.com/shares', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      event_type: EVENT_TYPE_URI,
      period_type: 'moving',
      max_booking_time: MAX_BOOKING_TIME_SECONDS,
      availability_rule: {
        timezone: 'Europe/Paris',
        rules: [
          { type: 'wday', wday: 'tuesday', intervals: [{ from: '11:00', to: '11:30' }, { from: '16:30', to: '17:00' }] },
          { type: 'wday', wday: 'wednesday', intervals: [{ from: '11:00', to: '11:30' }, { from: '16:30', to: '17:00' }] },
          { type: 'wday', wday: 'thursday', intervals: [{ from: '11:00', to: '11:30' }, { from: '16:30', to: '17:00' }] },
        ],
      },
    }),
  });
  if (!response.ok) throw new Error(`Calendly share ${response.status}: ${(await response.text()).slice(0, 500)}`);
  const data = await response.json() as { resource?: { scheduling_links?: Array<{ booking_url?: string }> } };
  const bookingUrl = data.resource?.scheduling_links?.[0]?.booking_url?.trim() ?? '';
  if (!bookingUrl.startsWith('https://calendly.com/')) throw new Error('Calendly did not return a booking URL.');
  return bookingUrl;
}

export default async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'Méthode non autorisée.' });
  try {
    const token = (Netlify.env.get('CALENDLY_API_TOKEN') || '').trim();
    const syncSecret = (Netlify.env.get('CALENDLY_SYNC_SECRET') || '').trim();
    if (!token || !syncSecret) return json(500, { error: 'Configuration de réservation incomplète.' });

    const payload = await req.json() as { leadId?: string; email?: string };
    const leadId = String(payload.leadId ?? '').trim();
    const email = String(payload.email ?? '').trim().toLowerCase();
    if (!validUuid(leadId) || !validEmail(email)) return json(400, { error: 'Prospect invalide.' });

    const authorization = await prospectRpc({ secret: syncSecret, leadId, email });
    if (!authorization.eligible) return json(403, { error: 'Ce parcours ne donne pas accès à la réservation individuelle.' });

    if (authorization.booking_url?.startsWith('https://calendly.com/')) {
      return json(200, { ok: true, bookingUrl: authorization.booking_url, qualification: authorization.qualification });
    }

    const shareUrl = await createShare(token);
    await prospectRpc({ secret: syncSecret, leadId, email, bookingUrl: shareUrl });

    const prefill = new URL(shareUrl);
    if (authorization.first_name) prefill.searchParams.set('name', authorization.first_name);
    prefill.searchParams.set('email', email);
    prefill.searchParams.set('utm_source', 'photographie-patrimoniale');
    prefill.searchParams.set('utm_content', leadId);

    return json(200, { ok: true, bookingUrl: prefill.toString(), qualification: authorization.qualification });
  } catch (error) {
    console.error('prospect-booking-link failed', error);
    return json(500, { error: 'Impossible de préparer les créneaux de rendez-vous pour le moment.' });
  }
};

export const config = { path: '/api/prospect-booking-link' };
