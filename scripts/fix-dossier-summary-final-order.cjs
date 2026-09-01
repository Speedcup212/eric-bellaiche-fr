const fs = require('fs');

const file = 'src/pages/portal/CifDossierSummaryPage.tsx';
let source = fs.readFileSync(file, 'utf8');

const docsMarker = '<section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-start gap-3"><div className="rounded-2xl bg-emerald-50 p-3"><FileText';
const snapshotMarker = '<section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-start gap-3"><div className="rounded-2xl bg-blue-50 p-3"><Home';
const investorMarker = '{investorSummaries.map(';
const closingMarker = '  </div></div>;\n}';

const docsStart = source.indexOf(docsMarker);
const snapshotStart = source.indexOf(snapshotMarker);
const investorStart = source.indexOf(investorMarker);
const closingStart = source.lastIndexOf(closingMarker);

if ([docsStart, snapshotStart, investorStart, closingStart].some((index) => index < 0)) {
  throw new Error('Required dossier summary markers not found');
}

const starts = [docsStart, snapshotStart, investorStart].sort((a, b) => a - b);
const firstBlockStart = starts[0];
const prefix = source.slice(0, firstBlockStart);

function block(start, otherStarts, end) {
  const next = otherStarts.filter((value) => value > start).sort((a, b) => a - b)[0] ?? end;
  return source.slice(start, next).trimEnd();
}

const docsBlock = block(docsStart, [snapshotStart, investorStart], closingStart);
const snapshotBlock = block(snapshotStart, [docsStart, investorStart], closingStart);
const investorBlock = block(investorStart, [docsStart, snapshotStart], closingStart);
const suffix = source.slice(closingStart);

source = `${prefix}${snapshotBlock}\n\n    ${investorBlock}\n\n    ${docsBlock}\n\n${suffix}`;

fs.writeFileSync(file, source);
console.log('Final dossier summary order applied: snapshot -> investor -> documents.');
