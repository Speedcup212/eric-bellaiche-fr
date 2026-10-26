import assert from 'node:assert/strict';
import ts from 'typescript';
import fs from 'node:fs';
import vm from 'node:vm';
const file='src/portal/fiscalSourcePriorityEngine.ts';
const source=fs.readFileSync(file,'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
vm.runInNewContext(js,{exports,Date});
const aggregate=exports.consolidateFiscalNotice;
const notice={categorie:'avis_imposition',portee_document:'foyer',statut_analyse:'extracted',
 nom_fichier:'Avis_d_impot_2026_sur_les_revenus_2025.pdf'};
const x={annee_imposition:2026,revenu_fiscal_reference:83982,revenu_imposable:80774,
 impot_revenu_net:5282,tmi:30,deficit_foncier_reportable:6729,
 plafond_per_2026_identifiant_1:11560,plafond_per_2026_identifiant_2:11965,
 plafond_per_2026_declarant_1:11965,plafond_per_2026_declarant_2:11560,
 plafond_total_2024_declarant_1:12969,plafond_total_2024_declarant_2:12564};
const double=aggregate([{investisseur_id:'catherine',payload:x},{investisseur_id:'eric',payload:{...x}}],[notice]);
assert.equal(double.rfr.value,83982);
assert.equal(double.taxableIncome.value,80774);
assert.equal(double.incomeTax.value,5282);
assert.equal(double.perCeiling.value,23525);
assert.equal(double.perByInvestor[0].value,11560);
assert.equal(double.perByInvestor[1].value,11965);
assert.equal(double.landDeficit.value,6729);
assert.equal(double.tmi.value,30);
assert.ok(double.warnings.some(x=>x.includes('Avis commun')));
assert.ok(double.warnings.some(x=>x.includes('numérotation')));
const conflict=aggregate([{investisseur_id:'i1',payload:x},{investisseur_id:'i2',payload:{...x,revenu_fiscal_reference:99999}}],[notice]);
assert.equal(conflict.rfr.found,false,'Conflicting joint return cannot produce certified RFR');
const older=aggregate([{investisseur_id:'i1',payload:{...x,annee_imposition:2025}}],[notice]);
assert.equal(older.rfr.found,false,'Never silently use previous tax year when newer notice exists');
const noNotice=aggregate([{investisseur_id:'i1',payload:x}],[]);
assert.equal(noNotice.source,'recueil_sans_avis');
assert.equal(noNotice.rfr.value,83982);
const incomplete=aggregate([{investisseur_id:'i1',payload:{...x,plafond_per_2026_identifiant_2:null,plafond_per_2026_declarant_2:null}}],[notice]);
assert.equal(incomplete.perCeiling.found,false,'Do not invent a household PER ceiling if spouse field missing');
console.log('Fiscal hierarchy: joint tax notice, no double count, conflict, fiscal period, PER by declarant passed');
