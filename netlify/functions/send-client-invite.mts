import tls from 'node:tls';

const FALLBACK_SUPABASE_URL = 'https://xeloauyhlnhrvqojdudr.supabase.co';
const FALLBACK_SUPABASE_KEY = 'sb_publishable_cbSjZNq4I5l_JlAobFUDVA_3UHkFaBA';
const ZOOM_URL = 'https://us06web.zoom.us/j/2254306545';

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function cleanHeader(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function wrapBase64(value: string) {
  return Buffer.from(value, 'utf8').toString('base64').match(/.{1,76}/g)?.join('\r\n') ?? '';
}

function encodedHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function dotStuff(value: string) {
  return value.replace(/(^|\r\n)\./g, '$1..');
}

function ensureInvitationDetails(value: string) {
  let body = value.trim();
  const preparationBlock = `Avant de commencer, je vous conseille de préparer les principaux documents utiles à l’étude de votre situation :\n- votre dernier avis d’imposition ;\n- vos relevés de placements et d’épargne ;\n- les tableaux d’amortissement de vos crédits en cours ;\n- les éléments utiles relatifs à votre patrimoine immobilier ;\n- vos justificatifs de revenus si nécessaire.`;
  const zoomBlock = `Pour vos prochains rendez-vous en visioconférence, vous pourrez utiliser le lien Zoom permanent du cabinet :\n${ZOOM_URL}`;

  const insertBeforeSignature = (text: string) => {
    const marker = '\nBien cordialement,';
    const index = body.indexOf(marker);
    if (index >= 0) body = `${body.slice(0, index)}\n\n${text}${body.slice(index)}`;
    else body = `${body}\n\n${text}`;
  };

  if (!body.includes('dernier avis d’imposition') && !body.includes('dernier avis d\'imposition')) {
    insertBeforeSignature(preparationBlock);
  }
  if (!body.includes(ZOOM_URL)) {
    insertBeforeSignature(zoomBlock);
  }
  return body;
}

function supabaseConfig(req: Request) {
  const authorization = req.headers.get('authorization') ?? '';
  const supabaseUrl = Netlify.env.get('VITE_SUPABASE_URL') || FALLBACK_SUPABASE_URL;
  const supabaseKey = Netlify.env.get('VITE_SUPABASE_PUBLISHABLE_KEY') || FALLBACK_SUPABASE_KEY;
  return {
    authorization,
    supabaseUrl,
    headers: { Authorization: authorization, apikey: supabaseKey, 'content-type': 'application/json' },
  };
}

async function verifyCabinetUser(req: Request) {
  const { authorization, supabaseUrl, headers } = supabaseConfig(req);
  if (!authorization.startsWith('Bearer ')) return false;

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers });
  if (!userResponse.ok) return false;

  const roleResponse = await fetch(`${supabaseUrl}/rest/v1/app_users?select=role,actif&limit=1`, { headers });
  if (!roleResponse.ok) return false;
  const rows = await roleResponse.json() as Array<{ role?: string; actif?: boolean }>;
  return Boolean(rows[0]?.actif && ['cif', 'admin'].includes(rows[0]?.role ?? ''));
}

async function markInviteSent(req: Request, dossierId: string, investisseurId: string, sentAt: string, smtpReply: string) {
  const { supabaseUrl, headers } = supabaseConfig(req);
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/mark_client_invite_sent`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      p_dossier_id: dossierId,
      p_investisseur_id: investisseurId,
      p_sent_at: sentAt,
      p_smtp_reply: smtpReply,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Email envoyé, mais traçabilité Supabase impossible : ${detail.slice(0, 300)}`);
  }
}

function readReply(socket: tls.TLSSocket): Promise<{ code: number; text: string }> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const onError = (error: Error) => { cleanup(); reject(error); };
    const onData = (chunk: Buffer | string) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines.at(-1) ?? '';
      const match = last.match(/^(\d{3}) /);
      if (!match) return;
      cleanup();
      resolve({ code: Number(match[1]), text: buffer.trim() });
    };
    const cleanup = () => {
      socket.off('data', onData);
      socket.off('error', onError);
    };
    socket.on('data', onData);
    socket.on('error', onError);
  });
}

async function command(socket: tls.TLSSocket, value: string, expected: number | number[]) {
  socket.write(`${value}\r\n`);
  const reply = await readReply(socket);
  const accepted = Array.isArray(expected) ? expected : [expected];
  if (!accepted.includes(reply.code)) throw new Error(`SMTP ${reply.code}: ${reply.text}`);
  return reply;
}

async function sendWithGmail({ user, password, to, subject, body }: { user: string; password: string; to: string; subject: string; body: string }) {
  const socket = tls.connect({ host: 'smtp.gmail.com', port: 465, servername: 'smtp.gmail.com', rejectUnauthorized: true });
  socket.setTimeout(15_000, () => socket.destroy(new Error('Délai SMTP dépassé.')));

  await new Promise<void>((resolve, reject) => {
    socket.once('secureConnect', resolve);
    socket.once('error', reject);
  });

  try {
    const hello = await readReply(socket);
    if (hello.code !== 220) throw new Error(`SMTP ${hello.code}: ${hello.text}`);
    await command(socket, 'EHLO eric-bellaiche.fr', 250);
    await command(socket, 'AUTH LOGIN', 334);
    await command(socket, Buffer.from(user).toString('base64'), 334);
    await command(socket, Buffer.from(password).toString('base64'), 235);
    await command(socket, `MAIL FROM:<${user}>`, 250);
    await command(socket, `RCPT TO:<${to}>`, [250, 251]);
    await command(socket, 'DATA', 354);

    const mime = [
      `From: "Eric Bellaiche" <${user}>`,
      `To: <${to}>`,
      `Subject: ${encodedHeader(subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      `Date: ${new Date().toUTCString()}`,
      '',
      wrapBase64(body),
    ].join('\r\n');

    socket.write(`${dotStuff(mime)}\r\n.\r\n`);
    const sent = await readReply(socket);
    if (sent.code !== 250) throw new Error(`SMTP ${sent.code}: ${sent.text}`);
    await command(socket, 'QUIT', 221).catch(() => undefined);
    return sent.text;
  } finally {
    socket.end();
  }
}

export default async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'Méthode non autorisée.' });

  try {
    if (!(await verifyCabinetUser(req))) return json(401, { error: 'Accès cabinet requis.' });

    const gmailUser = Netlify.env.get('GMAIL_USER')?.trim() ?? '';
    const gmailPassword = Netlify.env.get('GMAIL_APP_PASSWORD')?.replace(/\s+/g, '') ?? '';
    if (!gmailUser || !gmailPassword) return json(500, { error: 'Configuration Gmail incomplète.' });

    const payload = await req.json() as { to?: string; subject?: string; body?: string; dossierId?: string; investisseurId?: string };
    const to = cleanHeader(payload.to ?? '').toLowerCase();
    const subject = cleanHeader(payload.subject ?? '');
    const body = ensureInvitationDetails(String(payload.body ?? ''));
    const dossierId = String(payload.dossierId ?? '').trim();
    const investisseurId = String(payload.investisseurId ?? '').trim();

    if (!validEmail(to)) return json(400, { error: 'Adresse email destinataire invalide.' });
    if (!subject || subject.length > 180) return json(400, { error: 'Objet du mail invalide.' });
    if (!body || body.length > 20_000) return json(400, { error: 'Contenu du mail invalide.' });
    if (!validUuid(dossierId) || !validUuid(investisseurId)) return json(400, { error: 'Référence dossier/investisseur invalide.' });

    const smtpReply = await sendWithGmail({ user: gmailUser, password: gmailPassword, to, subject, body });
    const sentAt = new Date().toISOString();
    await markInviteSent(req, dossierId, investisseurId, sentAt, smtpReply);

    return json(200, { ok: true, sentAt, smtpReply });
  } catch (error) {
    console.error('send-client-invite failed', error);
    return json(500, { error: error instanceof Error ? error.message : 'Échec de l’envoi Gmail.' });
  }
};

export const config = { path: '/api/send-client-invite' };
