import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const roots = ['src/portal', 'src/pages/portal'];
const forbidden = [
  ['MutationObserver', 'MutationObserver'],
  ['document.createElement', 'document.createElement'],
  ['insertAdjacentElement', 'insertAdjacentElement'],
  ['.appendChild(', 'appendChild'],
  ['.removeChild(', 'removeChild'],
  ['.replaceChild(', 'replaceChild'],
  ['.innerHTML =', 'innerHTML assignment'],
  ['.outerHTML =', 'outerHTML assignment'],
  ['document.write(', 'document.write'],
  ['dangerouslySetInnerHTML', 'dangerouslySetInnerHTML'],
];

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

const violations = [];
for (const root of roots) {
  for (const file of walk(root)) {
    const source = readFileSync(file, 'utf8');
    for (const [needle, label] of forbidden) {
      if (source.includes(needle)) violations.push(`${relative('.', file)}: ${label}`);
    }
  }
}

if (violations.length) {
  console.error('Unsafe portal DOM patterns detected:\n' + violations.map((v) => `- ${v}`).join('\n'));
  process.exit(1);
}

console.log('Portal runtime safety check: OK');
