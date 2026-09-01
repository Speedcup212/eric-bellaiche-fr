const FALLBACK_SUPABASE_URL = 'https://xeloauyhlnhrvqojdudr.supabase.co';
const FALLBACK_SUPABASE_KEY = 'sb_publishable_cbSjZNq4I5l_JlAobFUDVA_3UHkFaBA';

interface CalendlyEvent {
  uri: string;
  name: string;
  start_time: string;
}

interface CalendlyInvitee {
  uri: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  created_at?: string | null;
  questions_and_answers?: Array<{ question?: string; answer?: string }>;
  text_reminder_number?: string | null;
}

function normalize(value: string | null | undefined) {
  return (value ?? '').trim();
}

function answerFor(invitee: CalendlyInvitee, patterns: RegExp[]) {
  for (const item of invitee.questions_and_answers ?? []) {
    const question = normalize(item.question);
    if (patterns.some((pattern) => pattern.test(question))) return normalize(item.answer);
  }
  return '';
}

function splitName(invitee: CalendlyInvitee) {
  let firstName = normalize(invitee.first_name);
  let lastName = normalize(invitee.last_name);
  if (firstName && lastName) return { firstName, lastName };
  const full = normalize(invitee.name);
  if (!full) return { firstName, lastName };
  const parts = full.split(/\s+/).filter(Boolean);
  if (!firstName) firstName = parts.shift() ?? '';
  if (!lastName) lastName = parts.join(' ');
  return { firstName, lastName };
}

async function calendlyFetch<T>(path: string, token: string): Promise<T> {
  const response = await fetch(path.startsWith('http') ? path : `https://api.calendly.com${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  });
  if (!response.ok) throw new Error(`Calendly ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return response.json() as Promise<T>;
}

async function syncInvitee(event: CalendlyEvent, invitee: CalendlyInvitee, syncSecret: string) {
  const supabaseUrl = Netlify.env.get('VITE_SUPABASE_URL') || FALLBACK_SUPABASE_URL;
  const supabaseKey = Netlify.env.get('VITE_SUPABASE_PUBLISHABLE_KEY') || FALLBACK_SUPABASE_KEY;
  const { firstName, lastName } = splitName(invitee);
  const mobile = normalize(invitee.text_reminder_number) || answerFor(invitee, [/t[ée]l[ée]phone/i, /mobile/i, /phone/i]);
  const city = answerFor(invitee, [/ville/i, /city/i]);
  const needs = answerFor(invitee, [/besoin/i, /projet/i, /objectif/i, /need/i]);

  if (!firstName || !lastName || !normalize(invitee.email)) {
    console.warn('Calendly invitee ignored: incomplete identity', invitee.uri);
    return { action: 'ignored_incomplete_identity' };
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/sync_calendly_prospect`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      p_secret: syncSecret,
      p_event_uri: event.uri,
      p_invitee_uri: invitee.uri,
      p_event_name: event.name,
      p_event_start_at: event.start_time,
      p_first_name: firstName,
      p_last_name: lastName,
      p_email: normalize(invitee.email).toLowerCase(),
      p_mobile: mobile || null,
      p_city: city || null,
      p_needs: needs || null,
    }),
  });
  if (!response.ok) throw new Error(`Supabase sync ${response.status}: ${(await response.text()).slice(0, 500)}`);
  return response.json() as Promise<Record<string, unknown>>;
}

export default async () => {
  const token = normalize(Netlify.env.get('CALENDLY_API_TOKEN'));
  const syncSecret = normalize(Netlify.env.get('CALENDLY_SYNC_SECRET'));
  const syncFromRaw = normalize(Netlify.env.get('CALENDLY_SYNC_FROM'));
  if (!token || !syncSecret) {
    console.log('Calendly sync inactive: CALENDLY_API_TOKEN or CALENDLY_SYNC_SECRET missing.');
    return;
  }

  const syncFrom = syncFromRaw ? new Date(syncFromRaw) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const currentUser = await calendlyFetch<{ resource: { uri: string } }>('/users/me', token);
  const now = new Date();
  const max = new Date(now.getTime() + 366 * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    user: currentUser.resource.uri,
    status: 'active',
    min_start_time: now.toISOString(),
    max_start_time: max.toISOString(),
    count: '100',
    sort: 'start_time:asc',
  });
  const events = await calendlyFetch<{ collection: CalendlyEvent[] }>(`/scheduled_events?${params.toString()}`, token);

  let created = 0;
  let existing = 0;
  let skipped = 0;
  for (const event of events.collection ?? []) {
    const invitees = await calendlyFetch<{ collection: CalendlyInvitee[] }>(`${event.uri}/invitees?status=active&count=100`, token);
    for (const invitee of invitees.collection ?? []) {
      const createdAt = invitee.created_at ? new Date(invitee.created_at) : null;
      if (createdAt && createdAt < syncFrom) { skipped += 1; continue; }
      const result = await syncInvitee(event, invitee, syncSecret);
      if (result.action === 'created') created += 1;
      else if (result.action === 'existing_client' || result.action === 'already_synced') existing += 1;
      else skipped += 1;
    }
  }

  console.log(`Calendly sync complete: ${created} created, ${existing} existing, ${skipped} skipped.`);
};

export const config = { schedule: '*/5 * * * *' };
