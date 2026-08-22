import { spawn } from 'node:child_process';
import { firefox } from 'playwright';

const host = '127.0.0.1';
const port = 4174;
const base = `http://${host}:${port}`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', host, '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
server.stdout.on('data', (chunk) => { logs += chunk.toString(); });
server.stderr.on('data', (chunk) => { logs += chunk.toString(); });

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(base);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Preview server did not start.\n${logs}`);
}

const failures = [];
let browser;
try {
  await waitForServer();
  browser = await firefox.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));

  const checks = [
    ['/', null],
    ['/articles', null],
    ['/espace-client/connexion', 'Reprendre mon dossier'],
  ];

  for (const [route, expectedText] of checks) {
    await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(600);
    const text = (await page.locator('body').innerText()).trim();
    if (!text) failures.push(`${route}: blank body`);
    if (expectedText && !text.includes(expectedText)) failures.push(`${route}: missing text « ${expectedText} »`);
  }

  await page.goto(`${base}/espace-client/recueil?dossier=smoke-test`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(800);
  if (!page.url().includes('/espace-client/connexion')) failures.push(`protected route did not redirect to login: ${page.url()}`);
  const protectedText = (await page.locator('body').innerText()).trim();
  if (!protectedText) failures.push('/espace-client/recueil: blank body after auth redirect');

  await context.close();
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 100));
}

if (failures.length) {
  console.error('Firefox smoke failures:\n' + failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
console.log('Firefox portal smoke test: OK');
