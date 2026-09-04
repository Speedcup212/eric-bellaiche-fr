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

async function githubJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'eric-bellaiche-netlify-ci-gate',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 403 || response.status === 429) {
      const remaining = response.headers.get('x-ratelimit-remaining');
      const rateLimited = remaining === '0' || /rate limit/i.test(body);
      if (rateLimited) {
        console.warn(`CI deploy gate: GitHub API rate limit reached (${response.status}). Continuing with Netlify local tests, typecheck and build.`);
        process.exit(0);
      }
    }
    throw new Error(`GitHub Actions API ${response.status}: ${body.slice(0, 300)}`);
  }

  return response.json();
}

async function readPortalRun() {
  const payload = await githubJson(endpoint);
  return (payload.workflow_runs || []).find((run) => run.path === workflowPath) || null;
}

async function readQualityJob(run) {
  if (!run?.jobs_url) return null;
  const payload = await githubJson(`${run.jobs_url}?per_page=100`);
  return (payload.jobs || []).find((job) => job.name === 'quality') || null;
}

async function isGitHubActionsBotCommit() {
  const commit = await githubJson(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(sha)}`);
  return commit?.author?.login === 'github-actions[bot]'
    || commit?.committer?.login === 'github-actions[bot]'
    || String(commit?.commit?.author?.email || '').includes('github-actions[bot]');
}

let checkedBotCommit = false;
while (Date.now() - startedAt < timeoutMs) {
  const run = await readPortalRun();

  if (!run) {
    // Commits pushed by GitHub Actions with GITHUB_TOKEN do not trigger another
    // push workflow. In that case Portal CI can never appear. Netlify still runs
    // the full local test/typecheck/build chain immediately after this gate, so
    // skipping only the remote wait is safe and prevents an artificial timeout.
    if (!checkedBotCommit) {
      checkedBotCommit = true;
      if (await isGitHubActionsBotCommit()) {
        console.log(`CI deploy gate: trusted GitHub Actions commit ${sha.slice(0, 8)}; remote Portal CI cannot be triggered. Continuing with Netlify local checks.`);
        process.exit(0);
      }
    }
    console.log(`CI deploy gate: Portal CI not visible yet for ${sha.slice(0, 8)}; retrying…`);
  } else if (run.status !== 'completed') {
    // The independent dependency audit may take longer or become stuck on the
    // npm registry. Production safety is carried by the quality job (all portal
    // tests, typecheck, lint, build and browser smoke test), followed by the
    // same local test/typecheck/build chain on Netlify.
    const quality = await readQualityJob(run);
    if (quality?.status === 'completed' && quality.conclusion === 'success') {
      console.log(`CI deploy gate: Portal CI quality job passed for ${sha.slice(0, 8)}. Production build authorized.`);
      process.exit(0);
    }
    if (quality?.status === 'completed' && quality.conclusion !== 'success') {
      throw new Error(`Production deployment blocked: Portal CI quality job concluded ${quality.conclusion || 'unknown'} for ${sha}.`);
    }
    console.log(`CI deploy gate: Portal CI quality job ${quality?.status || run.status}; waiting…`);
  } else if (run.conclusion === 'success') {
    console.log(`CI deploy gate: Portal CI passed for ${sha.slice(0, 8)}. Production build authorized.`);
    process.exit(0);
  } else {
    throw new Error(`Production deployment blocked: Portal CI concluded ${run.conclusion || 'unknown'} for ${sha}.`);
  }

  await new Promise((resolve) => setTimeout(resolve, pollMs));
}

throw new Error(`Production deployment blocked: Portal CI did not complete successfully within ${timeoutMs / 60000} minutes for ${sha}.`);
