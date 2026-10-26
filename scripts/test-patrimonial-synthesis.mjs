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
  hasValuationDate:true,valuationDate:'2026-10-01',automaticFieldsApplied:1,
  amountEnteredManually:false,possibleOverlap:false,sourceRejected:false,...overrides,
});
const base=calc({
  properties:[{value:515000},{value:265000}],
  debts:[{outstanding:242712.83,type:'credit immobilier locatif',linkedProperty:true,isTheoreticalBalance:true,outstandingDate:'2026-10-05'}],
  assets:[asset(69702),asset(279500,{sourceStatus:'rejected',sourceKind:'declaration_docx_conseiller',needsDateReview:true,hasValuationDate:false,sourceRejected:true})],
  expectedPropertyCount:2,
  asOfDate:'2026-10-26',
});
assert.equal(base.financialKnown,349202);
assert.equal(base.financialVerified,69702);
assert.equal(base.financialDeclared,279500);
assert.equal(base.financialStatementLinked,0);
assert.equal(base.clientDeclaredPositions,1);
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
const multiClientWord=calc({
  properties:[],debts:[],
  assets:[asset(1000,{sourceStatus:'rejected',sourceKind:'declaration_docx_conseiller',
    sourceRejected:true,sourceDocumentId:'word123',needsDateReview:true,hasValuationDate:false}),
    asset(2000,{sourceStatus:'rejected',sourceKind:'declaration_docx_conseiller',
    sourceRejected:true,sourceDocumentId:'word123',needsDateReview:true,hasValuationDate:false})],
});
assert.equal(multiClientWord.financialDeclared,3000,'Keep both client-declared positions');
assert.equal(multiClientWord.rejectedSources,1,'One technically rejected client document is one incident, not two falsified investments');
const manuallyLinked=calc({properties:[],debts:[],asOfDate:'2026-10-26',assets:[asset(69702,{
  valuationDate:'2026-04-04',amountEnteredManually:true,automaticFieldsApplied:0,
  sourceStatus:'validated',sourceDocumentId:'aep-file',type:'Assurance-vie / capitalisation',
})]});
assert.equal(manuallyLinked.financialVerified,0,'Manual PDF linking must not become automatic certification');
assert.equal(manuallyLinked.financialStatementLinked,69702);
assert.equal(manuallyLinked.staleStatements,1,'Historical valuation of life policy must be flagged');
assert.equal(manuallyLinked.financialKnown,69702);
const documentError=calc({properties:[],debts:[],assets:[asset(1500,{
 sourceKind:'declaration_docx_conseiller',sourceRejected:true,sourceStatus:'rejected',
 hasValuationDate:false,sourceDocumentId:'word-1'}),asset(2000,{
 sourceKind:'declaration_docx_conseiller',sourceRejected:true,sourceStatus:'rejected',
 hasValuationDate:false,sourceDocumentId:'word-1'})]});
assert.equal(documentError.financialDeclared,3500);
assert.equal(documentError.rejectedSources,1,'Technical document rejection counted only once');
const ui=readFileSync('src/pages/portal/CifDossierSummaryPage.tsx','utf8');
for(const phrase of ['buildPatrimonialOverview','Patrimoine net indicatif','Encours déclarés par le client (à rapprocher)','Encours saisis depuis un relevé','Co-souscription à rapprocher','Marge de mensualité théorique à 35 %','Contrôles utiles avant préconisation','Équité immobilière indicative']){
 assert.ok(ui.includes(phrase),'Missing synthesis UI requirement: '+phrase);
}
assert.ok(!ui.includes('label="Disponible bancaire"'));
assert.ok(!ui.includes('label="Ressaisies neutralisées"'));
console.log('Patrimonial overview: single-count assets, provisional evidence, all liabilities, negative equity, and missing data OK.');
