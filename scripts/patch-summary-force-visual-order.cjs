const fs = require('fs');
const path = 'src/pages/portal/CifDossierSummaryPage.tsx';
let source = fs.readFileSync(path, 'utf8');

function replaceOnce(from, to, label) {
  if (source.includes(to)) return;
  const index = source.indexOf(from);
  if (index === -1) throw new Error(`Pattern not found for ${label}`);
  source = source.slice(0, index) + to + source.slice(index + from.length);
}

replaceOnce('className="mx-auto max-w-7xl space-y-6"', 'className="mx-auto flex max-w-7xl flex-col gap-6"', 'summary container');
replaceOnce('className="rounded-3xl bg-slate-950 p-7 text-white shadow-sm sm:p-9"', 'className="order-1 rounded-3xl bg-slate-950 p-7 text-white shadow-sm sm:p-9"', 'summary header');

function addOrderToSection(marker, orderClass) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) throw new Error(`Marker not found: ${marker}`);
  const sectionStart = source.lastIndexOf('<section', markerIndex);
  if (sectionStart === -1) throw new Error(`Section start not found: ${marker}`);
  const classStart = source.indexOf('className="', sectionStart);
  if (classStart === -1 || classStart > markerIndex) throw new Error(`Section class not found: ${marker}`);
  const valueStart = classStart + 'className="'.length;
  if (source.slice(valueStart, valueStart + orderClass.length + 1).startsWith(orderClass + ' ')) return;
  source = source.slice(0, valueStart) + orderClass + ' ' + source.slice(valueStart);
}

addOrderToSection('Documents du dossier', 'order-2');
addOrderToSection('Photographie patrimoniale du foyer', 'order-3');

const investorMarker = '{investorSummaries.map';
const investorIndex = source.indexOf(investorMarker);
if (investorIndex === -1) throw new Error('Investor summaries marker not found');
const investorSection = source.indexOf('<section', investorIndex);
if (investorSection === -1) throw new Error('Investor section not found');
const investorClass = source.indexOf('className="', investorSection);
if (investorClass === -1) throw new Error('Investor class not found');
const investorValueStart = investorClass + 'className="'.length;
if (!source.slice(investorValueStart, investorValueStart + 8).startsWith('order-4 ')) {
  source = source.slice(0, investorValueStart) + 'order-4 ' + source.slice(investorValueStart);
}

fs.writeFileSync(path, source);
console.log('Forced visual order: header, documents, patrimonial snapshot, investor details.');
