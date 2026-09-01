const fs = require('fs');
const path = 'src/pages/portal/CifDossierSummaryPage.tsx';
let source = fs.readFileSync(path, 'utf8');

function findSectionByMarker(text, marker) {
  const markerIndex = text.indexOf(marker);
  if (markerIndex === -1) throw new Error(`Marker not found: ${marker}`);
  const start = text.lastIndexOf('<section', markerIndex);
  if (start === -1) throw new Error(`Section start not found for: ${marker}`);
  let cursor = start;
  let depth = 0;
  while (cursor < text.length) {
    const open = text.indexOf('<section', cursor);
    const close = text.indexOf('</section>', cursor);
    if (close === -1) throw new Error(`Section end not found for: ${marker}`);
    if (open !== -1 && open < close) {
      depth += 1;
      cursor = open + 8;
    } else {
      depth -= 1;
      cursor = close + 10;
      if (depth === 0) return { start, end: cursor, block: text.slice(start, cursor) };
    }
  }
  throw new Error(`Unbalanced section for: ${marker}`);
}

const docs = findSectionByMarker(source, 'Documents du dossier');
const photo = findSectionByMarker(source, 'Photographie patrimoniale du foyer');

if (docs.start < photo.start && source.slice(docs.end, photo.start).trim() === '') {
  console.log('Correct order already present.');
  process.exit(0);
}

for (const block of [docs, photo].sort((a, b) => b.start - a.start)) {
  source = source.slice(0, block.start) + source.slice(block.end);
}

const headerStart = source.indexOf('<header className="rounded-3xl bg-slate-950');
if (headerStart === -1) throw new Error('Summary header not found');
const headerEnd = source.indexOf('</header>', headerStart);
if (headerEnd === -1) throw new Error('Summary header end not found');
const insertionPoint = headerEnd + 9;

source = source.slice(0, insertionPoint)
  + '\n\n    ' + docs.block
  + '\n\n    ' + photo.block
  + source.slice(insertionPoint);

fs.writeFileSync(path, source);
console.log('Final order applied: Documents du dossier then Photographie patrimoniale du foyer.');
