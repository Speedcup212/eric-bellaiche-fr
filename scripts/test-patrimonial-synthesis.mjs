import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const src=readFileSync('src/portal/patrimonialSynthesisEngine.ts','utf8');
const js=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};
vm.runInNewContext(js,{exports});
const calc=exports.buildPatrimonialOverview;
assert.equal(typeof calc,'function');
const asset=(amount,overrides={})=>({
  amount,type:'Livret A',owner:'Mr',institution:'Banque',sourceStatus:'validated',
  sourceKind:'releve_bancaire',needsDateReview:false,
  hasValuationDate:true,possibleOverlap:false,sourceRejected:false,...overrides,
});
const base=calc({
  properties:[{value:515000},{value:265000}],
  debts:[{outstanding:242712.83,type:'credit immobilier locatif',linkedProperty:true,isTheoreticalBalance:true,outstandingDate:'2026-10-05'}],
  assets:[asset(69702),asset(279500,{sourceStatus:'rejected',sourceKind:'declaration_docx_conseiller',needsDateReview:true,hasValuationDate:false,sourceRejected:true})],
  expectedPropertyCount:2,
});
assert.equal(base.financialKnown,349202);
assert.equal(base.financialVerified,69702);
assert.equal(base.financialDeclared,279500);
assert.equal(base.realEstateNet,537287.17);
assert.ok(Math.abs(base.householdNet-886489.17)<1e-5,'Household net includes asset exactly once');
assert.equal(base.theoreticalDebts,1);
assert.equal(base.rejectedSources,1);
assert.deepEqual([...base.asOfDates],['2026-10-05']);
const debtTypes=calc({
  properties:[{value:100000}],
  debts:[
    {outstanding:60000,type:'pret immobilier',linkedProperty:true,isTheoreticalBalance:false,outstandingDate:''},
    {outstanding:20000,type:'pret personnel',linkedProperty:false,isTheoreticalBalance:false,outstandingDate:''},
  ],
  assets:[asset(10000)],
});
assert.equal(debtTypes.realEstateNet,40000,'Personal credit must not reduce real estate equity');
assert.equal(debtTypes.householdNet,30000,'All debts reduce the household equity');
const noClamp=calc({
 properties:[{value:25000}],
 debts:[{outstanding:60000,type:'pret immobilier',linkedProperty:true,isTheoreticalBalance:false,outstandingDate:''}],
 assets:[],
});
assert.equal(noClamp.realEstateNet,-35000,'Negative equity must be visible');
assert.equal(noClamp.householdNet,-35000);
const missing=calc({properties:[{value:25000}],debts:[{outstanding:null,type:'pret immobilier',linkedProperty:true,isTheoreticalBalance:false,outstandingDate:''}],assets:[asset(null)],expectedPropertyCount:1});
assert.equal(missing.householdNet,null,'Missing loan / asset blocks complete net');
assert.equal(missing.realEstateNet,null);
assert.equal(missing.financialUnknown,1);
const unmatched=calc({properties:[{value:25000}],debts:[{outstanding:5000,type:'pret immobilier',linkedProperty:false,isTheoreticalBalance:false,outstandingDate:''}],assets:[]});
assert.equal(unmatched.realEstateNet,null,'No unsupported property debt attribution');
assert.equal(unmatched.householdNet,20000,'All liabilities still contribute to overall net');
const ui=readFileSync('src/pages/portal/CifDossierSummaryPage.tsx','utf8');
for(const phrase of ['buildPatrimonialOverview','Patrimoine net indicatif','Encours déclarés à justifier','Marge de mensualité théorique à 35 %','Contrôles utiles avant préconisation','Équité immobilière indicative']){
 assert.ok(ui.includes(phrase),'Missing synthesis UI requirement: '+phrase);
}
assert.ok(!ui.includes('label="Disponible bancaire"'));
assert.ok(!ui.includes('label="Ressaisies neutralisées"'));
console.log('Patrimonial overview: single-count assets, provisional evidence, all liabilities, negative equity, and missing data OK.');
