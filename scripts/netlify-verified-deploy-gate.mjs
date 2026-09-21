import { execSync } from 'node:child_process';

const marker = '[netlify-verified]';
const context = process.env.CONTEXT || 'production';

// Branch deploys / Deploy Previews remain available for testing.
// Only production is locked behind the verified marker.
if (context !== 'production') {
  console.log(`Netlify deploy gate: contexte ${context}, build de prévisualisation autorisé.`);
  process.exit(1);
}

let message = '';

try {
  message = execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim();
} catch (error) {
  console.error('Netlify deploy gate: impossible de lire le dernier commit.', error);
  // Fail closed: Netlify interprets exit 0 as "ignore this deploy".
  process.exit(0);
}

if (message.includes(marker)) {
  console.log('Netlify deploy gate: commit vérifié par CI, build production autorisé.');
  // Netlify "ignore" convention: non-zero means continue the build.
  process.exit(1);
}

console.log('Netlify deploy gate: commit production non vérifié, build ignoré. La CI doit valider tests, TypeScript, lint et build avant publication.');
process.exit(0);
