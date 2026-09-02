const sha = process.env.COMMIT_REF || process.env.GITHUB_SHA || '';
const context = process.env.CONTEXT || '';
const repo = 'Speedcup212/eric-bellaiche-fr';
const workflowPath = '.github/workflows/portal-ci.yml';
const timeoutMs = 8 * 60 * 1000;
const pollMs = 15000;

if (context !== 'production' || !sha) {
  console.log(`CI deploy gate skipped (context=${context || 'local'}, sha=${sha || 'missing'}).`);
  process.exit(0);
}

const startedAt = Date.now();
const endpoint = `https://api.github.com/repos/${repo}/actions/runs?head_sha=${encodeURIComponent(sha)}&event=push&per_page=20`;

async function readPortalRun() {
  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'eric-bellaiche-netlify-ci-gate',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub Actions API ${response.status}: ${body.slice(0, 300)}`);
  }

  const payload = await response.json();
  return (payload.workflow_runs || []).find((run) => run.path === workflowPath) || null;
}

while (Date.now() - startedAt < timeoutMs) {
  const run = await readPortalRun();

  if (!run) {
    console.log(`CI deploy gate: Portal CI not visible yet for ${sha.slice(0, 8)}; retrying…`);
  } else if (run.status !== 'completed') {
    console.log(`CI deploy gate: Portal CI ${run.status}; waiting…`);
  } else if (run.conclusion === 'success') {
    console.log(`CI deploy gate: Portal CI passed for ${sha.slice(0, 8)}. Production build authorized.`);
    process.exit(0);
  } else {
    throw new Error(`Production deployment blocked: Portal CI concluded ${run.conclusion || 'unknown'} for ${sha}.`);
  }

  await new Promise((resolve) => setTimeout(resolve, pollMs));
}

throw new Error(`Production deployment blocked: Portal CI did not complete successfully within ${timeoutMs / 60000} minutes for ${sha}.`);
