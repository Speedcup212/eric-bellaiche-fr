const fs = require('fs');
const file = 'src/pages/portal/CifAdminPage.tsx';
let source = fs.readFileSync(file, 'utf8');
const oldCode = "const done=(value?:string|null)=>['completed','validated','not_applicable'].includes(value??'');\nfunction progressOf(d:DossierView){if(!d.investors.length)return 0;const c=d.investors.reduce<boolean[]>((a,i)=>a.concat([done(i.recueil_status),done(i.qpi_status),done(i.esg_status)]),[]);return Math.round((c.filter(Boolean).length/c.length)*100);}";
const newCode = "const done=(value?:string|null)=>['completed','validated'].includes(value??'');\nfunction progressOf(d:DossierView){if(!d.investors.length)return 0;const steps=d.investors.flatMap(i=>{const base=[done(i.recueil_status),done(i.qpi_status)];return i.esg_status==='not_applicable'?base:[...base,done(i.esg_status)];});return steps.length?Math.round((steps.filter(Boolean).length/steps.length)*100):0;}";
if (!source.includes(oldCode)) throw new Error('Progress calculation block not found');
source = source.replace(oldCode, newCode);
fs.writeFileSync(file, source);
console.log('Dashboard progress fixed: not_applicable no longer counts as completed.');
