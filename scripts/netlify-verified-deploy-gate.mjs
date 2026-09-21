import { execSync } from 'node:child_process';

const marker = '[netlify-verified]';
let message = '';

try {
  message = execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim();
} catch (error) {
  console.error('Netlify deploy gate: impossible de lire le dernier commit.', error);
  // Fail closed: Netlify interprets exit 0 as "ignore this deploy".
  process.exit(0);
}

if (message.includes(marker)) {
  console.log('Netlify deploy gate: commit vérifié par CI, build autorisé.');
  // Netlify "ignore" convention: non-zero means continue the build.
  process.exit(1);
}

console.log('Netlify deploy gate: commit non vérifié, build ignoré. La CI créera un commit de release après validation.');
process.exit(0);
