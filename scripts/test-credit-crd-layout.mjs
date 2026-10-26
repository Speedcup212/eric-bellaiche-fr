import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual TypeScript parser, not a reimplementation in the test.
const source=readFileSync('supabase/functions/extract-source-document/index.ts','utf8');
const parseFrom=source.indexOf('function parseFrenchNumber(');
const parseTo=source.indexOf('function numberCandidates(',parseFrom);
const begin=source.indexOf('type CreditScheduleRow =');
const end=source.indexOf('/** Only the embedded raster',begin);
assert.ok(parseFrom>=0&&parseTo>parseFrom&&begin>=0&&end>begin,'Reader functions must be present');
const code=ts.transpileModule(
 source.slice(parseFrom,parseTo)+'\n'+source.slice(begin,end),
 {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}
).outputText;
const context=vm.createContext({});
vm.runInContext(code+'\n globalThis.realReader={parseCreditScheduleLines,validateCreditSchedule};',context,{timeout:5000});
const {parseCreditScheduleLines,validateCreditSchedule}=context.realReader;
const raw=[
  '0075 05/08/2026 1 251,75 800,02 292,10 244 317,29 159,63 0,00 0,00',
  '0076 05/09/2026 1 251,75 801,49 291,15 243 515,80 159,11 0,00 0,00',
  '0077 05/10/2026 1 251,75 802,97 290,19 242 712,83 158,59 0,00 0,00',
  '0078 05/11/2026 1 251,75 804,45 289,23 241 908,38 158,07 0,00 0,00',
  '0079 05/12/2026 1 251,75 805,93 288,28 241 102,45 157,54 0,00 0,00',
  '0080 05/01/2027 1 251,75 807,42 287,31 240 295,03 157,02 0,00 0,00',
  '0081 05/02/2027 1 251,75 808,91 286,35 239 486,12 156,49 0,00 0,00',
  '0082 05/03/2027 1 251,75 810,40 285,38 238 675,72 155,97 0,00 0,00',
];
const parsed=parseCreditScheduleLines(raw);
assert.equal(parsed.length,8,'All bank rows must be recognized');
const validated=validateCreditSchedule(parsed,'pdf_native');
assert.equal(validated.validation.status,'verified','Caisse d’Epargne seven-numeric-column layout must validate');
assert.equal(validated.validation.numeric_columns,7);
assert.equal(validated.validation.balance_column,3,'CRD follows principal and interest, before insurance');
assert.equal(validated.validation.principal_column,1);
assert.ok(validated.validation.pairs_valid>=7,'All consecutive balance changes must reconcile to amortization');
assert.equal(validated.rows.find(x=>x.date==='2026-10-05').crd,242712.83);
assert.equal(validated.rows.find(x=>x.date==='2026-10-05').capital,802.97);
// CRD in the last column must still be supported for other lenders.
const alternate=raw.map(line=>{
  const m=line.match(/^(\d+) (\d\d\/\d\d\/\d{4}) (.*)$/);
  const values=[...m[3].matchAll(/(?:\d{1,3}(?: \d{3})+|\d+),\d{2}/g)].map(x=>x[0]);
  return m[1]+' '+m[2]+' '+[values[0],values[1],values[2],values[4],values[3]].join(' ');
});
const alternateEvidence=validateCreditSchedule(parseCreditScheduleLines(alternate),'pdf_native');
assert.equal(alternateEvidence.validation.status,'verified','Other bank column order remains supported');
assert.equal(alternateEvidence.validation.balance_column,4);
const corrupt=raw.map((line,i)=>i%2===0?line.replace(/(24[0-4] \d{3},\d{2})/, '201 000,00'):line);
const rejected=validateCreditSchedule(parseCreditScheduleLines(corrupt),'pdf_native');
assert.notEqual(rejected.validation.status,'verified','Mismatched balances must be rejected');
console.log('CRD amortization regression: real bank excerpt, alternate layout, and corruption refusal passed.');
