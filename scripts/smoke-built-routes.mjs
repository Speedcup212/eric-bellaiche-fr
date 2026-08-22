import { spawn } from 'node:child_process';

const routes = [
  '/',
  '/articles',
  '/conseil-investissement-grenoble',
  '/espace-client/connexion',
  '/espace-client/invitation',
  '/espace-client',
  '/espace-client/recueil?dossier=smoke-test',
  '/espace-client/profil-investisseur?dossier=smoke-test',
  '/espace-client/esg?dossier=smoke-test',
  '/espace-client/documents?dossier=smoke-test',
  '/espace-client/synthese?dossier=smoke-test',
  '/cabinet',
];

const host = '127.0.0.1';
const port = 4173;
const server = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'preview', '--', '--host', host, '--port', String(port)], {
  stdio: ['ignore', 'pipe', 'pipe'],
});

let logs = '';
server.stdout.on('data', (chunk) => { logs += chunk.toString(); });
server.stderr.on('data', (chunk) => { logs += chunk.toString(); });

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://${host}:${port}/`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Preview server did not start.\n${logs}`);
}

try {
  await waitForServer();
  const failures = [];
  for (const route of routes) {
    try {
      const response = await fetch(`http://${host}:${port}${route}`, { redirect: 'manual' });
      const body = await response.text();
      if (response.status !== 200 || !body.includes('id="root"')) failures.push(`${route}: HTTP ${response.status} / root missing`);
    } catch (error) {
      failures.push(`${route}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failures.length) throw new Error(`Route smoke failures:\n${failures.map((item) => `- ${item}`).join('\n')}`);
  console.log(`Built route smoke test: OK (${routes.length} routes)`);
} finally {
  server.kill('SIGTERM');
}
