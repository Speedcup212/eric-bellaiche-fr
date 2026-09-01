const fs = require('fs');
const file = 'src/pages/portal/CifDossierSummaryPage.tsx';
let source = fs.readFileSync(file, 'utf8');

const documentsStart = source.indexOf('    <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-start gap-3"><div className="rounded-2xl bg-emerald-50 p-3"><FileText');
const snapshotStart = source.indexOf('    <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-start gap-3"><div className="rounded-2xl bg-blue-50 p-3"><Home');
const investorStart = source.indexOf('    {investorSummaries.map(', snapshotStart);

if (documentsStart < 0 || snapshotStart < 0 || investorStart < 0) throw new Error('Summary sections not found');
if (snapshotStart < documentsStart) {
  console.log('Patrimonial snapshot already above documents.');
  process.exit(0);
}

const snapshotBlock = source.slice(snapshotStart, investorStart);
const beforeDocuments = source.slice(0, documentsStart);
const documentsBlock = source.slice(documentsStart, snapshotStart);
const afterSnapshot = source.slice(investorStart);

source = beforeDocuments + snapshotBlock + documentsBlock + afterSnapshot;
fs.writeFileSync(file, source);
console.log('Patrimonial snapshot moved above dossier documents.');
