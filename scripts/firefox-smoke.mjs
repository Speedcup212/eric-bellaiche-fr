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
const viewports = [
  ['mobile-390', { width: 390, height: 844 }],
  ['mobile-430', { width: 430, height: 932 }],
  ['ipad-portrait', { width: 820, height: 1180 }],
  ['ipad-landscape', { width: 1180, height: 820 }],
  ['desktop', { width: 1440, height: 900 }],
];
const checks = [
  ['/', null],
  ['/articles', null],
  ['/espace-client/connexion', 'Reprendre mon dossier'],
];

async function assertResponsive(page, label, route) {
  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const viewportWidth = window.innerWidth;
    const scrollWidth = Math.max(root.scrollWidth, body.scrollWidth);
    const offenders = Array.from(document.querySelectorAll('input, textarea, select, button, a'))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || el.getAttribute('placeholder') || '').trim().slice(0, 60),
          left: rect.left,
          right: rect.right,
          width: rect.width,
          visible: rect.width > 0 && rect.height > 0,
        };
      })
      .filter((item) => item.visible && (item.left < -2 || item.right > viewportWidth + 2));
    return { viewportWidth, scrollWidth, offenders: offenders.slice(0, 8) };
  });
  if (metrics.scrollWidth > metrics.viewportWidth + 2) failures.push(`${label} ${route}: horizontal overflow ${metrics.scrollWidth}px > ${metrics.viewportWidth}px`);
  if (metrics.offenders.length) failures.push(`${label} ${route}: clipped interactive elements ${JSON.stringify(metrics.offenders)}`);
}

let browser;
try {
  await waitForServer();
  browser = await firefox.launch({ headless: true });

  for (const [label, viewport] of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.on('pageerror', (error) => failures.push(`${label} pageerror: ${error.message}`));

    for (const [route, expectedText] of checks) {
      await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(600);
      const text = (await page.locator('body').innerText()).trim();
      if (!text) failures.push(`${label} ${route}: blank body`);
      if (expectedText && !text.includes(expectedText)) failures.push(`${label} ${route}: missing text « ${expectedText} »`);
      await assertResponsive(page, label, route);
    }

    await page.goto(`${base}/espace-client/recueil?dossier=smoke-test`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(800);
    if (!page.url().includes('/espace-client/connexion')) failures.push(`${label}: protected route did not redirect to login: ${page.url()}`);
    const protectedText = (await page.locator('body').innerText()).trim();
    if (!protectedText) failures.push(`${label} /espace-client/recueil: blank body after auth redirect`);
    await assertResponsive(page, label, '/espace-client/recueil->connexion');

    await context.close();
  }
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 100));
}

if (failures.length) {
  console.error('Firefox responsive smoke failures:\n' + failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
console.log(`Firefox responsive smoke test: OK (${viewports.length} viewports)`);
