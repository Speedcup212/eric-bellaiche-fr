import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Netlify: 0 = skip build, 1 = proceed. Only the CI-generated release marker
// may trigger a production build; previews remain available.
const marker = /^chore\(deploy\): verified ([a-f0-9]{40}) \[netlify-verified\]$/;

export function allowNetlifyBuild({ context, message, author, email }) {
  if (context !== 'production') return true;
  const match = String(message ?? '').trim().match(marker);
  return Boolean(match &&
    author === 'github-actions[bot]' &&
    email === '41898282+github-actions[bot]@users.noreply.github.com');
}

const invokedDirectly = Boolean(process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url);

if (invokedDirectly) {
  const context = process.env.CONTEXT ?? '';
  if (context !== 'production') {
    console.log('[netlify-gate] Preview or branch deploy: build allowed.');
    process.exitCode = 1;
  } else {
    let verified = false;
    try {
      const ref = process.env.COMMIT_REF || 'HEAD';
      if (!/^(?:[a-f0-9]{40}|HEAD)$/.test(ref)) throw new Error('Invalid commit reference');
      const show = (format) => execFileSync('git', ['show', '-s', '--format=' + format, ref],
        { encoding: 'utf8', timeout: 5000, maxBuffer: 8192 }).trim();
      verified = allowNetlifyBuild({
        context, message: show('%B'), author: show('%an'), email: show('%ae'),
      });
    } catch (error) {
      // Fail closed: missing Git information must not publish an unverified commit.
      console.warn('[netlify-gate] Unable to verify release commit:', String(error));
    }
    console.log(verified
      ? '[netlify-gate] GitHub Actions-verified production release: build allowed.'
      : '[netlify-gate] Unverified main commit: build intentionally skipped.');
    process.exitCode = verified ? 1 : 0;
  }
}
