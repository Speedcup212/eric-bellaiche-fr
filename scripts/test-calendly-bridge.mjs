import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';

const testSecret = 'test-only-bridge-credential-with-at-least-43-characters';
const testHash = createHash('sha256').update(testSecret).digest('hex');
const token = 'test-only-calendly-api-token';
const leadId = '68a88ad0-bb36-446b-a062-d1293327637f';
const bridgePath = 'supabase/functions/calendly-db-bridge/index.ts';

function loadHandler(path, env = {}, fetcher = () => { throw new Error('Unexpected fetch'); }) {
  const exports = {};
  const context = vm.createContext({
    exports, module: { exports }, crypto: webcrypto, TextEncoder, Request, Response, URL, URLSearchParams,
    fetch: fetcher,
    console: { log() {}, warn() {}, error() {} },
    Netlify: { env: { get: (key) => env[key] } },
    Deno: { serve() {}, env: { get: (key) => env[key] } },
  });
  const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), {
    fileName: 'handler.ts',
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  vm.runInContext(outputText, context, { timeout: 5000 });
  return exports;
}

const request = (body) => new Request('https://example.test/bridge', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const serverEnv = { SUPABASE_URL: 'https://database.example.test', SUPABASE_SERVICE_ROLE_KEY: 'server-only-test-key' };

test('missing, wrong and former Calendly credentials cannot reach the database', async () => {
  const handler = loadHandler(bridgePath, serverEnv).createBridgeHandler(testHash);
  for (const secret of [undefined, '', token, 'x'.repeat(64), 123]) {
    const response = await handler(request({ operation: 'sync', secret }));
    assert.equal(response.status, 401);
  }
});

for (const [operation, rpc] of [['sync', 'sync_calendly_prospect'], ['booking', 'manage_prospect_booking_link']]) {
  test(`authenticated ${operation} only invokes its allowed RPC with server credentials`, async () => {
    const calls = [];
    const handler = loadHandler(bridgePath, serverEnv, async (url, options) => {
      calls.push({ url, options });
      return Response.json({ ok: true });
    }).createBridgeHandler(testHash);
    const response = await handler(request({ operation, secret: testSecret, params: { p_email: 'fixture@example.test', p_secret: 'untrusted' } }));
    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `${serverEnv.SUPABASE_URL}/rest/v1/rpc/${rpc}`);
    assert.equal(calls[0].options.headers.Authorization, `Bearer ${serverEnv.SUPABASE_SERVICE_ROLE_KEY}`);
    assert.equal(JSON.parse(calls[0].options.body).p_secret, 'validated-calendly-bridge');
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
}

test('unsupported operations, methods and oversized requests never invoke an RPC', async () => {
  const handler = loadHandler(bridgePath, serverEnv).createBridgeHandler(testHash);
  assert.equal((await handler(new Request('https://example.test'))).status, 405);
  assert.equal((await handler(request({ secret: testSecret, operation: 'arbitrary_rpc' }))).status, 400);
  const oversized = request({ secret: testSecret, operation: 'sync' });
  oversized.headers.set('content-length', '32001');
  assert.equal((await handler(oversized)).status, 413);
});

test('missing database configuration fails closed', async () => {
  const handler = loadHandler(bridgePath).createBridgeHandler(testHash);
  assert.equal((await handler(request({ operation: 'sync', secret: testSecret }))).status, 500);
});

test('an upstream RPC refusal remains a refusal', async () => {
  const handler = loadHandler(bridgePath, serverEnv, async () => Response.json({ error: 'not_allowed' }, { status: 403 })).createBridgeHandler(testHash);
  const response = await handler(request({ operation: 'booking', secret: testSecret }));
  assert.equal(response.status, 403);
});

test('scheduled sync separates Calendly API authentication from bridge authentication', async () => {
  const calls = [];
  const handler = loadHandler('netlify/functions/sync-calendly-prospects.mts', {
    CALENDLY_API_TOKEN: token, CALENDLY_BRIDGE_SECRET: testSecret,
  }, async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/scheduled_events?')) return Response.json({ collection: [{ uri: 'https://api.calendly.com/scheduled_events/test-event', name: 'Fixture', start_time: new Date().toISOString() }] });
    if (url.includes('/invitees?')) return Response.json({ collection: [{ uri: 'https://api.calendly.com/scheduled_events/test-event/invitees/test-invitee', first_name: 'Test', last_name: 'Fixture', email: 'fixture@example.test', created_at: new Date().toISOString() }] });
    if (url.endsWith('/functions/v1/calendly-db-bridge')) return Response.json({ action: 'already_synced' });
    throw new Error(`Unexpected URL ${url}`);
  }).default;
  await handler();
  assert.equal(calls.length, 3);
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${token}`);
  assert.equal(calls[1].options.headers.Authorization, `Bearer ${token}`);
  assert.equal(JSON.parse(calls[2].options.body).secret, testSecret);
  assert.ok(!calls[2].options.body.includes(token));
});

test('scheduled sync without a bridge credential stops before any external call', async () => {
  const handler = loadHandler('netlify/functions/sync-calendly-prospects.mts', { CALENDLY_API_TOKEN: token }).default;
  await assert.rejects(handler(), /CALENDLY_BRIDGE_SECRET/);
});

test('booking without a bridge credential fails before contacting any service', async () => {
  const handler = loadHandler('netlify/functions/prospect-booking-link.mts', { CALENDLY_API_TOKEN: token }).default;
  assert.equal((await handler(request({ leadId, email: 'fixture@example.test' }))).status, 500);
});

test('existing booking links are returned through the dedicated bridge credential', async () => {
  const handler = loadHandler('netlify/functions/prospect-booking-link.mts', {
    CALENDLY_API_TOKEN: token, CALENDLY_BRIDGE_SECRET: testSecret,
  }, async (url, options) => {
    assert.ok(url.endsWith('/functions/v1/calendly-db-bridge'));
    assert.equal(JSON.parse(options.body).secret, testSecret);
    return Response.json({ eligible: true, qualification: 'A', booking_url: 'https://calendly.com/example/test' });
  }).default;
  const response = await handler(request({ leadId, email: 'fixture@example.test' }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).bookingUrl, 'https://calendly.com/example/test');
});

test('new booking links keep API token and bridge credential separated', async () => {
  const calls = [];
  const handler = loadHandler('netlify/functions/prospect-booking-link.mts', {
    CALENDLY_API_TOKEN: token, CALENDLY_BRIDGE_SECRET: testSecret,
  }, async (url, options) => {
    calls.push(url);
    if (url.endsWith('/shares')) {
      assert.equal(options.headers.Authorization, `Bearer ${token}`);
      return Response.json({ resource: { scheduling_links: [{ booking_url: 'https://calendly.com/example/new' }] } });
    }
    assert.equal(JSON.parse(options.body).secret, testSecret);
    assert.ok(!options.body.includes(token));
    return Response.json({ eligible: true, qualification: 'A', first_name: 'Test' });
  }).default;
  const response = await handler(request({ leadId, email: 'fixture@example.test' }));
  assert.equal(response.status, 200);
  assert.equal(calls.length, 3);
  assert.equal(new URL((await response.json()).bookingUrl).searchParams.get('utm_content'), leadId);
});
