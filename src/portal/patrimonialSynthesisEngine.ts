/**
 * Read-only advisory overview. A document being marked "validated" means its
 * processing workflow is closed, not that each value is bank certified.
 */
export type OverviewAsset = {
  amount:number|null;
  type:string;
  owner:string;
  institution:string;
  sourceStatus:string;
  sourceKind:string;
  needsDateReview:boolean;
  hasValuationDate:boolean;
  possibleOverlap:boolean;
  sourceRejected:boolean;
  sourceDocumentId?:string;
};
export type OverviewDebt = {
  outstanding:number|null;
  type:string;
  linkedProperty:boolean;
  isTheoreticalBalance:boolean;
  outstandingDate:string;
};
export type OverviewProperty = { value:number|null };

export type QualityOverview = {
  financialKnown:number;
  financialVerified:number;
  financialDeclared:number;
  financialUnknown:number;
  provisionalAssets:number;
  debtKnown:number;
  allDebtKnown:boolean;
  realEstateNet:number|null;
  householdNet:number|null;
  netComplete:boolean;
  dateWarnings:number;
  rejectedSources:number;
  overlapWarnings:number;
  unknownPropertyValues:number;
  unlinkedPropertyDebts:number;
  theoreticalDebts:number;
  asOfDates:string[];
};

export function buildPatrimonialOverview(input:{
  assets:OverviewAsset[];
  debts:OverviewDebt[];
  properties:OverviewProperty[];
  expectedPropertyCount?:number;
}):QualityOverview {
  let financialKnown=0,financialVerified=0,financialDeclared=0,financialUnknown=0;
  let dateWarnings=0,rejectedSources=0,overlapWarnings=0;
  const rejectedDocumentIds=new Set<string>();
  for(const asset of input.assets){
    if(asset.sourceRejected){
      const documentId=asset.sourceDocumentId?.trim();
      if(!documentId)rejectedSources++;
      else if(!rejectedDocumentIds.has(documentId)){
        rejectedDocumentIds.add(documentId);rejectedSources++;
      }
    }
    if(asset.needsDateReview||!asset.hasValuationDate) dateWarnings++;
    if(asset.possibleOverlap) overlapWarnings++;
    if(asset.amount===null||!Number.isFinite(asset.amount)||asset.amount<0){
      financialUnknown++;
      continue;
    }
    financialKnown+=asset.amount;
    // "Documented" is evidence quality, not regulatory certification.
    // A validated source, dated encours, and no overlap are all required.
    if(asset.sourceStatus==='validated' && !asset.sourceRejected &&
       asset.sourceKind!=='declaration_docx_conseiller' &&
       !asset.needsDateReview && asset.hasValuationDate &&
       !asset.possibleOverlap){
      financialVerified+=asset.amount;
    }else financialDeclared+=asset.amount;
  }
  const propertyValue=input.properties.reduce((sum,p)=>sum+(p.value??0),0);
  const unknownPropertyValues=input.properties.filter(p=>p.value===null||!Number.isFinite(p.value)||p.value<0).length;
  const debtKnown=input.debts.reduce((sum,d)=>sum+(d.outstanding??0),0);
  const allDebtKnown=input.debts.every(d=>d.outstanding!==null && Number.isFinite(d.outstanding) && d.outstanding>=0);
  const unlinkedPropertyDebts=input.debts.filter(d=>/immob|hypoth|foncier/i.test(d.type)&&!d.linkedProperty).length;
  const propertyDebtIsKnown=input.debts.filter(d=>/immob|hypoth|foncier/i.test(d.type))
    .every(d=>d.outstanding!==null&&d.outstanding>=0);
  const realEstateNet=unknownPropertyValues===0 && propertyDebtIsKnown &&
    unlinkedPropertyDebts===0
    ? propertyValue-input.debts.filter(d=>/immob|hypoth|foncier/i.test(d.type)).reduce((s,d)=>s+(d.outstanding??0),0)
    : null;
  const netComplete=allDebtKnown&&financialUnknown===0&&unknownPropertyValues===0&&
    (input.expectedPropertyCount===undefined||input.properties.length===input.expectedPropertyCount);
  // Assets and liabilities are counted once. Liquidity is a subset of assets.
  // All debt types are subtracted from household equity, not only mortgages.
  const householdNet=netComplete?propertyValue+financialKnown-debtKnown:null;
  const asOfDates=[...new Set(input.debts.map(d=>d.outstandingDate).filter(Boolean))].sort();
  return {
    financialKnown,financialVerified,financialDeclared,financialUnknown,
    provisionalAssets:propertyValue+financialKnown,debtKnown,allDebtKnown,
    realEstateNet,householdNet,netComplete,dateWarnings,rejectedSources,
    overlapWarnings,unknownPropertyValues,unlinkedPropertyDebts,
    theoreticalDebts:input.debts.filter(d=>d.isTheoreticalBalance).length,
    asOfDates,
  };
}
