const fs = require('fs');

const file = 'src/pages/portal/CifDossierSummaryPage.tsx';
let source = fs.readFileSync(file, 'utf8');

function extractSection(startMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`Section start not found: ${startMarker}`);
  const endMarker = '\n    </section>';
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`Section end not found: ${startMarker}`);
  return { start, end: end + endMarker.length, text: source.slice(start, end + endMarker.length) };
}

const documentsMarker = '    <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-start gap-3"><div className="rounded-2xl bg-emerald-50 p-3"><FileText';
const snapshotMarker = '    <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-start gap-3"><div className="rounded-2xl bg-blue-50 p-3"><Home';
const investorMarker = '    {investorSummaries.map(';
const investorEndMarker = '\n    </section>; })}';

const documents = extractSection(documentsMarker);
const snapshotRaw = extractSection(snapshotMarker);

const investorStart = source.indexOf(investorMarker);
if (investorStart < 0) throw new Error('Investor block start not found');
const investorEndIndex = source.indexOf(investorEndMarker, investorStart);
if (investorEndIndex < 0) throw new Error('Investor block end not found');
const investorEnd = investorEndIndex + investorEndMarker.length;
const investorRaw = source.slice(investorStart, investorEnd);

const objectiveStartMarker = '      <div className="mt-5 overflow-hidden rounded-2xl border border-amber-500/60 bg-[#0B1A2F]';
const objectiveEndMarker = '      {household.warnings.length > 0';
const objectiveStart = snapshotRaw.text.indexOf(objectiveStartMarker);
const objectiveEnd = snapshotRaw.text.indexOf(objectiveEndMarker, objectiveStart);
if (objectiveStart < 0 || objectiveEnd < 0) throw new Error('Objectives block not found inside snapshot');
let objectiveBlock = snapshotRaw.text.slice(objectiveStart, objectiveEnd).trimEnd();
objectiveBlock = objectiveBlock.replace('className="mt-5 overflow-hidden', 'className="overflow-hidden');
const snapshot = snapshotRaw.text.slice(0, objectiveStart) + snapshotRaw.text.slice(objectiveEnd);

const controlsStartMarker = '      <div className="mt-6 grid gap-5 lg:grid-cols-2">';
const controlsStart = investorRaw.indexOf(controlsStartMarker);
const controlsEnd = investorRaw.lastIndexOf('\n    </section>; })}');
if (controlsStart < 0 || controlsEnd < 0 || controlsEnd <= controlsStart) throw new Error('Controls block not found inside investor block');
const controlsBlock = investorRaw.slice(controlsStart, controlsEnd).trimEnd();
const investorsBlock = investorRaw.slice(0, controlsStart) + investorRaw.slice(controlsEnd);

const controlsSection = `    <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">\n      <div className="flex items-start gap-3"><div className="rounded-2xl bg-blue-50 p-3"><ShieldCheck className="h-5 w-5 text-blue-700" /></div><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Contrôles du dossier</p><h2 className="mt-1 text-xl font-semibold text-slate-950">Contrôles CIF à traiter et Complétude réglementaire</h2><p className="mt-1 text-sm text-slate-500">Lecture consolidée des incohérences, données manquantes et validations réglementaires.</p></div></div>\n      <div className="mt-5 space-y-5">{investorSummaries.map(({ investor, issues, summary }) => <div key={investor.investisseur_id}>{investorSummaries.length > 1 && <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-blue-500">{investor.role_dossier === 'investisseur_1' ? 'Identifiant 1' : 'Identifiant 2'} · {investor.investisseurs?.prenom} {investor.investisseurs?.nom}</p>}\n${controlsBlock}\n      </div>)}</div>\n    </section>`;

// Remove the three original top-level blocks, from the end backwards to preserve offsets.
const removals = [
  { start: documents.start, end: documents.end },
  { start: snapshotRaw.start, end: snapshotRaw.end },
  { start: investorStart, end: investorEnd },
].sort((a, b) => b.start - a.start);
for (const r of removals) source = source.slice(0, r.start) + source.slice(r.end);

const headerEndMarker = '</header>';
const headerEnd = source.indexOf(headerEndMarker);
if (headerEnd < 0) throw new Error('Header end not found');
const insertAt = headerEnd + headerEndMarker.length;

const ordered = `\n\n${documents.text}\n\n    ${objectiveBlock.trimStart()}\n\n${controlsSection}\n\n${snapshot}\n\n${investorsBlock}`;
source = source.slice(0, insertAt) + ordered + source.slice(insertAt);

// Guard the definitive visual order.
const positions = [
  source.indexOf('Synthèse patrimoniale conseiller'),
  source.indexOf('Documents du dossier'),
  source.indexOf('Objectifs prioritaires du foyer'),
  source.indexOf('Contrôles CIF à traiter et Complétude réglementaire'),
  source.indexOf('Photographie patrimoniale du foyer'),
  source.indexOf("'Identifiant 1'"),
];
if (positions.some((p) => p < 0) || !positions.every((p, i) => i === 0 || p > positions[i - 1])) {
  throw new Error(`Definitive order validation failed: ${positions.join(', ')}`);
}

fs.writeFileSync(file, source);

// Remove every known reorder mechanism so no later workflow can silently undo this layout.
const obsolete = [
  '.github/workflows/apply-final-documents-before-snapshot.yml',
  '.github/workflows/apply-move-documents-block-top.yml',
  '.github/workflows/apply-summary-force-visual-order.yml',
  '.github/workflows/apply-summary-photo-after-documents.yml',
  '.github/workflows/apply-summary-snapshot-top.yml',
  'scripts/patch-final-documents-before-snapshot.cjs',
  'scripts/patch-move-documents-block-top.cjs',
  'scripts/patch-summary-force-visual-order.cjs',
  'scripts/patch-summary-photo-after-documents.cjs',
  'scripts/patch-summary-snapshot-top.cjs',
  'scripts/patch-summary-definitive-order.cjs',
  '.github/workflows/apply-summary-definitive-order.yml',
];
for (const path of obsolete) if (fs.existsSync(path)) fs.unlinkSync(path);

// Self-clean this one-off patch too.
for (const path of ['scripts/apply-definitive-summary-layout.cjs', '.github/workflows/apply-definitive-summary-layout.yml']) {
  if (fs.existsSync(path)) fs.unlinkSync(path);
}

console.log('Definitive dossier summary order applied and reorder workflows removed.');
