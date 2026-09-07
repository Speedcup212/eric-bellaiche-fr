import tls from 'node:tls';

const FALLBACK_SUPABASE_URL = 'https://xeloauyhlnhrvqojdudr.supabase.co';
const FALLBACK_SUPABASE_KEY = 'sb_publishable_cbSjZNq4I5l_JlAobFUDVA_3UHkFaBA';

function json(status:number,payload:Record<string,unknown>){return new Response(JSON.stringify(payload),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
function clean(v:string){return v.replace(/[\r\n]+/g,' ').trim()}
function validEmail(v:string){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)&&v.length<=254}
function validUuid(v:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)}
function wrapBase64(v:string){return Buffer.from(v,'utf8').toString('base64').match(/.{1,76}/g)?.join('\r\n')??''}
function encoded(v:string){return `=?UTF-8?B?${Buffer.from(v,'utf8').toString('base64')}?=`}
function dotStuff(v:string){return v.replace(/(^|\r\n)\./g,'$1..')}
function readReply(socket:tls.TLSSocket):Promise<{code:number;text:string}>{return new Promise((resolve,reject)=>{let buffer='';const onError=(e:Error)=>{cleanup();reject(e)};const onData=(chunk:Buffer|string)=>{buffer+=chunk.toString();const lines=buffer.split(/\r?\n/).filter(Boolean);const last=lines.at(-1)??'';const m=last.match(/^(\d{3}) /);if(!m)return;cleanup();resolve({code:Number(m[1]),text:buffer.trim()})};const cleanup=()=>{socket.off('data',onData);socket.off('error',onError)};socket.on('data',onData);socket.on('error',onError)})}
async function command(socket:tls.TLSSocket,value:string,expected:number|number[]){socket.write(`${value}\r\n`);const r=await readReply(socket);const ok=Array.isArray(expected)?expected:[expected];if(!ok.includes(r.code))throw new Error(`SMTP ${r.code}`);return r}
async function sendMail(user:string,password:string,to:string,subject:string,body:string){const socket=tls.connect({host:'smtp.gmail.com',port:465,servername:'smtp.gmail.com',rejectUnauthorized:true});socket.setTimeout(15000,()=>socket.destroy(new Error('Délai SMTP dépassé')));await new Promise<void>((resolve,reject)=>{socket.once('secureConnect',resolve);socket.once('error',reject)});try{const hello=await readReply(socket);if(hello.code!==220)throw new Error('SMTP indisponible');await command(socket,'EHLO eric-bellaiche.fr',250);await command(socket,'AUTH LOGIN',334);await command(socket,Buffer.from(user).toString('base64'),334);await command(socket,Buffer.from(password).toString('base64'),235);await command(socket,`MAIL FROM:<${user}>`,250);await command(socket,`RCPT TO:<${to}>`,[250,251]);await command(socket,'DATA',354);const mime=[`From: "Eric Bellaiche" <${user}>`,`To: <${to}>`,`Subject: ${encoded(subject)}`,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64',`Date: ${new Date().toUTCString()}`,'',wrapBase64(body)].join('\r\n');socket.write(`${dotStuff(mime)}\r\n.\r\n`);const sent=await readReply(socket);if(sent.code!==250)throw new Error('Envoi SMTP refusé');await command(socket,'QUIT',221).catch(()=>undefined);return sent.text}finally{socket.end()}}

type Lead = {
  first_name:string;
  email:string;
  qualification:string;
  financial_assets_band:string;
  real_estate_band:string;
  savings_band:string;
  primary_goal:string;
  horizon:string;
  income_tax_band:string|null;
  event_12m:string;
};

const financialLabels:Record<string,string>={lt20:'Moins de 20 000 €','20_50':'20 000 à 50 000 €','50_100':'50 000 à 100 000 €','100_250':'100 000 à 250 000 €','250_500':'250 000 à 500 000 €','500plus':'Plus de 500 000 €'};
const realEstateLabels:Record<string,string>={none:'Aucun',lt200:'Moins de 200 000 €','200_400':'200 000 à 400 000 €','400_700':'400 000 à 700 000 €','700_1200':'700 000 à 1,2 M€','1200plus':'Plus de 1,2 M€'};
const savingsLabels:Record<string,string>={lt300:'Moins de 300 €/mois','300_700':'300 à 700 €/mois','700_1500':'700 à 1 500 €/mois','1500_3000':'1 500 à 3 000 €/mois','3000plus':'Plus de 3 000 €/mois'};
const goalLabels:Record<string,string>={placements:'Mieux placer votre épargne',revenus:'Créer des revenus complémentaires',retraite:'Préparer votre retraite',fiscalite:'Réduire votre fiscalité',immobilier:'Investir dans l’immobilier',transmission:'Préparer une transmission',tresorerie:'Optimiser une trésorerie',autre:'Autre objectif'};
const horizonLabels:Record<string,string>={'12m':'Dans les 12 mois','1_3y':'Dans 1 à 3 ans',later:'À plus long terme'};
const taxLabels:Record<string,string>={lt1500:'Moins de 1 500 €','1500_3000':'1 500 à 3 000 €','3000_6000':'3 000 à 6 000 €','6000_12000':'6 000 à 12 000 €','12000plus':'Plus de 12 000 €',unknown:'Non précisé'};
const eventLabels:Record<string,string>={vente:'Vente immobilière',succession:'Succession',cession:'Cession d’entreprise',retraite:'Départ en retraite',capital:'Réception d’un capital',none:'Aucun événement particulier'};

function supabaseConfig(){
  const url=(Netlify.env.get('VITE_SUPABASE_URL')||FALLBACK_SUPABASE_URL).trim();
  const key=(Netlify.env.get('VITE_SUPABASE_PUBLISHABLE_KEY')||FALLBACK_SUPABASE_KEY).trim();
  return {url,key,headers:{apikey:key,Authorization:`Bearer ${key}`,'content-type':'application/json'}};
}

async function authorizeLead(leadId:string,email:string){
  const {url,headers}=supabaseConfig();
  const r=await fetch(`${url}/rest/v1/rpc/authorize_prospect_result`,{method:'POST',headers,body:JSON.stringify({p_lead_id:leadId,p_email:email})});
  if(!r.ok)throw new Error(`Autorisation résultat ${r.status}`);
  const rows=await r.json() as Lead[];
  return rows[0]??null;
}

async function completeLead(leadId:string,email:string){
  const {url,headers}=supabaseConfig();
  const r=await fetch(`${url}/rest/v1/rpc/complete_prospect_result`,{method:'POST',headers,body:JSON.stringify({p_lead_id:leadId,p_email:email})});
  if(!r.ok)throw new Error(`Traçabilité résultat ${r.status}`);
  return Boolean(await r.json());
}

export default async(req:Request)=>{
 if(req.method!=='POST')return json(405,{error:'Méthode non autorisée.'});
 try{
  const origin=req.headers.get('origin')??'';
  if(origin && !/^https:\/\/(www\.)?eric-bellaiche\.fr$/i.test(origin))return json(403,{error:'Origine non autorisée.'});
  const p=await req.json() as {leadId?:string;email?:string};
  const leadId=clean(String(p.leadId??'')),email=clean(String(p.email??'')).toLowerCase();
  if(!validUuid(leadId)||!validEmail(email))return json(400,{error:'Données invalides.'});

  const lead=await authorizeLead(leadId,email);
  if(!lead)return json(409,{error:'Résultat déjà envoyé, demande expirée ou non autorisée.'});

  const lines=[
   `Bonjour ${clean(lead.first_name).slice(0,100)},`,'',
   'Voici la synthèse de votre photographie patrimoniale réalisée sur eric-bellaiche.fr.','',
   `Placements financiers déclarés : ${financialLabels[lead.financial_assets_band]??'Non précisé'}`,
   `Patrimoine immobilier déclaré : ${realEstateLabels[lead.real_estate_band]??'Non précisé'}`,
   `Capacité d’épargne : ${savingsLabels[lead.savings_band]??'Non précisé'}`,
   `Objectif principal : ${goalLabels[lead.primary_goal]??'Autre objectif'}`,
   `Horizon : ${horizonLabels[lead.horizon]??'Non précisé'}`,
   lead.income_tax_band?`Impôt sur le revenu déclaré : ${taxLabels[lead.income_tax_band]??'Non précisé'}`:'',
   `Événement à 12 mois : ${eventLabels[lead.event_12m]??'Non précisé'}`,'',
   'Cette photographie est indicative et ne constitue pas une recommandation personnalisée.','',
   'Bien cordialement,','Eric Bellaiche'
  ].filter(Boolean);

  const user=(Netlify.env.get('GMAIL_USER')||'').trim(),password=(Netlify.env.get('GMAIL_APP_PASSWORD')||'').trim();
  if(!user||!password)return json(503,{error:'Service de messagerie indisponible.'});
  await sendMail(user,password,lead.email,'Votre photographie patrimoniale',lines.join('\r\n'));
  await completeLead(leadId,email);
  return json(200,{ok:true});
 }catch(e){console.error('send-prospect-result',e);return json(500,{error:'Impossible d’envoyer le résultat pour le moment.'})}
};
