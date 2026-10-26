/**
 * Fiscal source hierarchy:
 * 1. an available household income-tax notice;
 * 2. tax data collected in the client's recueil when no notice is available.
 * Household figures from a joint notice are not individual figures to add up.
 */
export type FiscalSection={investisseur_id:string;payload:Record<string,unknown>|null};
export type FiscalSource={categorie:string;portee_document?:string;statut_analyse:string;nom_fichier:string};
export type FiscalNumber={value:number;found:boolean};
export type FiscalConsolidation={
  tmi:FiscalNumber;taxableIncome:FiscalNumber;rfr:FiscalNumber;incomeTax:FiscalNumber;
  perCeiling:FiscalNumber;perByInvestor:[FiscalNumber,FiscalNumber];
  ifi:FiscalNumber;landDeficit:FiscalNumber;year:number|null;
  source:'avis_foyer'|'recueil_sans_avis';warnings:string[];
  isFoyerTaxReturn:boolean;
};
const empty=():FiscalNumber=>({value:0,found:false});
function val(v:unknown):number|null{
 if(v===null||v===undefined||v==='')return null;
 const n=typeof v==='number'?v:Number(String(v).replace(/[\s\u00a0\u202f]/g,'').replace(',','.'));
 return Number.isFinite(n)?n:null;
}
function number(v:unknown):FiscalNumber {
 const n=val(v);return n===null?empty():{value:n,found:true};
}
function yearOf(row:FiscalSection):number|null{
 const n=val(row.payload?.annee_imposition);
 return n!==null&&Number.isInteger(n)&&n>=2000&&n<=2100?n:null;
}
function noticeYear(s:FiscalSource):number|null{
 // Filenames often delimit the year with underscores, which are word characters.
 const m=s.nom_fichier.match(/(?:^|[^0-9])(20\d{2})(?=[^0-9]|$)/);
 return m?Number(m[1]):null;
}
export function consolidateFiscalNotice(
 rows:FiscalSection[],docs:FiscalSource[]
):FiscalConsolidation{
 const notices=docs.filter(d=>d.categorie==='avis_imposition' && d.statut_analyse!=='rejected');
 const official=notices.length>0;
 const avisFoyer=notices.some(d=>d.portee_document==='foyer');
 const yearsFromNotice=notices.map(noticeYear).filter((v):v is number=>v!==null);
 const year=official&&yearsFromNotice.length ? Math.max(...yearsFromNotice):
   Math.max(...rows.map(yearOf).filter((v):v is number=>v!==null),0)||null;
 const eligible=rows.filter(r=>r.payload&&(year===null||yearOf(r)===year));
 const warnings:string[]=[];
 if(official&&!eligible.length)warnings.push('Avis d’imposition présent mais données fiscales de cet exercice non rapprochées : aucun remplacement par le Word.');
 if(notices.length>1)warnings.push('Plusieurs avis fiscaux : vérifier les foyers et exercices avant agrégation.');
 const p=eligible.map(r=>r.payload??{});
 // A household return must never be summed across both portal logins.
 // Differing non-empty values for the same common household field are conflicts,
 // not an opportunity to select an arbitrary "first" value.
 const unique=(keys:string[]):FiscalNumber=>{
   const values=p.flatMap(payload=>keys.map(k=>number(payload[k])).filter(x=>x.found).map(x=>x.value));
   const distinct=[...new Set(values)];
   if(distinct.length>1){
     warnings.push('Contradiction entre les profils sur '+keys[0]+' : montant suspendu.');
     return empty();
   }
   return distinct.length?{value:distinct[0],found:true}:empty();
 };
 const tmi=unique(['tmi']);
 const rfr=unique(['revenu_fiscal_reference','rfr']);
 const taxableIncome=unique(['revenu_imposable']);
 const incomeTax=unique(['impot_revenu_net','ir_net']);
 const ifi=unique(['ifi_net']);
 const landDeficit=unique(['deficit_foncier_reportable']);
 const currentYear=year??new Date().getFullYear();
 // "identifiant" keys are the application's reconciled holders, NOT sums
 // alongside the duplicate "declarant" keys from the same tax notice.
 const current=(i:1|2):FiscalNumber=>{
   const primary=unique([`plafond_per_${currentYear}_identifiant_${i}`]);
   const fallback=unique([`plafond_per_${currentYear}_declarant_${i}`]);
   if(primary.found&&fallback.found&&Math.abs(primary.value-fallback.value)>0.01){
     warnings.push('Plafond PER : numérotation déclarant/identifiant divergente, montant à rapprocher.');
   }
   return primary.found?primary:fallback;
 };
 const by1=current(1),by2=current(2);
 const explicit=unique(['plafond_disponible_avis']);
 let perCeiling=explicit;
 if(!perCeiling.found && by1.found && by2.found)
   perCeiling={value:by1.value+by2.value,found:true};
 else if(!perCeiling.found && (by1.found||by2.found)){
   warnings.push('Plafond PER incomplet : un déclarant manque.');
 }
 if(perCeiling.found)warnings.push('Plafond PER informatif issu de l’avis ; vérifier les reports, versements et règles de mutualisation avant conseil.');
 if(!official)warnings.push('Aucun avis d’imposition disponible : chiffres fiscaux uniquement déclaratifs.');
 if(avisFoyer&&rows.length>1)warnings.push('Avis commun aux deux identifiants : consolidé une seule fois.');
 return {
  tmi,rfr,taxableIncome,incomeTax,perCeiling,perByInvestor:[by1,by2],
  ifi,landDeficit,year,source:official?'avis_foyer':'recueil_sans_avis',
  warnings,isFoyerTaxReturn:avisFoyer,
 };
}
