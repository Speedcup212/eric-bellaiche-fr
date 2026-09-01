import tls from 'node:tls';

const FALLBACK_SUPABASE_URL = 'https://xeloauyhlnhrvqojdudr.supabase.co';
const FALLBACK_SUPABASE_KEY = 'sb_publishable_cbSjZNq4I5l_JlAobFUDVA_3UHkFaBA';

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

function wrapBase64(value: string) {
  return Buffer.from(value, 'utf8').toString('base64').match(/.{1,76}/g)?.join('\r\n') ?? '';
}

function encodedHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function dotStuff(value: string) {
  return value.replace(/(^|\r\n)\./g, '$1..');
}

async function verifyCabinetUser(req: Request) {
  const authorization = req.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return false;

  const supabaseUrl = Netlify.env.get('VITE_SUPABASE_URL') || FALLBACK_SUPABASE_URL;
  const supabaseKey = Netlify.env.get('VITE_SUPABASE_PUBLISHABLE_KEY') || FALLBACK_SUPABASE_KEY;
  const headers = { Authorization: authorization, apikey: supabaseKey };

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers });
  if (!userResponse.ok) return false;

  const roleResponse = await fetch(`${supabaseUrl}/rest/v1/app_users?select=role,actif&limit=1`, { headers });
  if (!roleResponse.ok) return false;
  const rows = await roleResponse.json() as Array<{ role?: string; actif?: boolean }>;
  return Boolean(rows[0]?.actif && ['cif', 'admin'].includes(rows[0]?.role ?? ''));
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

    const payload = await req.json() as { to?: string; subject?: string; body?: string };
    const to = cleanHeader(payload.to ?? '').toLowerCase();
    const subject = cleanHeader(payload.subject ?? '');
    const body = String(payload.body ?? '').trim();

    if (!validEmail(to)) return json(400, { error: 'Adresse email destinataire invalide.' });
    if (!subject || subject.length > 180) return json(400, { error: 'Objet du mail invalide.' });
    if (!body || body.length > 20_000) return json(400, { error: 'Contenu du mail invalide.' });

    const smtpReply = await sendWithGmail({ user: gmailUser, password: gmailPassword, to, subject, body });
    return json(200, { ok: true, sentAt: new Date().toISOString(), smtpReply });
  } catch (error) {
    console.error('send-client-invite failed', error);
    return json(500, { error: error instanceof Error ? error.message : 'Échec de l’envoi Gmail.' });
  }
};

export const config = { path: '/api/send-client-invite' };
