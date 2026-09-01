const fs = require('fs');
const file = 'src/pages/portal/CifAdminPage.tsx';
let source = fs.readFileSync(file, 'utf8');
const oldFn = ` const listInvestors=async(id:string)=>{const inv=rows.find(x=>x.id===id)?.investors??[];if(!inv.length){setErrorMessage('Aucun investisseur rattaché.');return}if(inv.length===1){await createInvite(id,inv[0]);return}const labels=inv.map((x,i)=>\`${i+1}. \${x.investisseurs?.prenom??''} \${x.investisseurs?.nom??''}\${x.invite_sent_at?\` — envoyée \${formatSentAt(x.invite_sent_at)}\`:' — jamais envoyée'}\`).join('\\n'),answer=window.prompt(\`Quelle personne inviter ?\\n\${labels}\`,'1'),idx=Number(answer)-1;if(Number.isInteger(idx)&&inv[idx])await createInvite(id,inv[idx])};`;
const newFn = ` const listInvestors=async(id:string)=>{const inv=rows.find(x=>x.id===id)?.investors??[];if(!inv.length){setErrorMessage('Aucun investisseur rattaché.');return}const primary=inv.find(x=>x.role_dossier==='investisseur_1')??inv[0];if(!primary.investisseurs?.email?.trim()){setErrorMessage('Email de l’identifiant 1 manquant.');return}await createInvite(id,primary)};`;
if (!source.includes(oldFn)) throw new Error('listInvestors block not found');
source = source.replace(oldFn, newFn);
fs.writeFileSync(file, source);
console.log('Primary invite flow applied.');
