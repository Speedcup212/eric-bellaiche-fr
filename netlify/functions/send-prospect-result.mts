import tls from 'node:tls';

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

export default async(req:Request)=>{
 if(req.method!=='POST')return json(405,{error:'Méthode non autorisée.'});
 try{
  const origin=req.headers.get('origin')??'';
  if(origin && !/^https:\/\/(www\.)?eric-bellaiche\.fr$/i.test(origin))return json(403,{error:'Origine non autorisée.'});
  const p=await req.json() as {leadId?:string;firstName?:string;email?:string;qualification?:string;financial?:string;realEstate?:string;savings?:string;annualSavings?:string;goal?:string;horizon?:string;tax?:string;event?:string;insights?:string[]};
  const leadId=clean(String(p.leadId??'')),firstName=clean(String(p.firstName??'')).slice(0,100),email=clean(String(p.email??'')).toLowerCase();
  if(!validUuid(leadId)||!firstName||!validEmail(email))return json(400,{error:'Données invalides.'});
  const insights=Array.isArray(p.insights)?p.insights.map(x=>clean(String(x)).slice(0,500)).filter(Boolean).slice(0,4):[];
  const safe=(v:unknown)=>clean(String(v??'')).slice(0,300);
  const qualification=['A','B','C'].includes(String(p.qualification))?String(p.qualification):'C';
  const lines=[
   `Bonjour ${firstName},`,'',
   'Voici la synthèse de votre photographie patrimoniale réalisée sur eric-bellaiche.fr.','',
   `Placements financiers déclarés : ${safe(p.financial)}`,
   `Patrimoine immobilier déclaré : ${safe(p.realEstate)}`,
   `Capacité d’épargne : ${safe(p.savings)} (${safe(p.annualSavings)})`,
   `Objectif principal : ${safe(p.goal)}`,
   `Horizon : ${safe(p.horizon)}`,
   safe(p.tax)?`Impôt sur le revenu déclaré : ${safe(p.tax)}`:'',
   safe(p.event)?`Événement à 12 mois : ${safe(p.event)}`:'','',
   'Ce que vos réponses font ressortir :',
   ...insights.map((x,i)=>`${i+1}. ${x}`),'',
  ].filter(x=>x!==undefined);
  if(qualification==='A'||qualification==='B'){
   lines.push('Votre situation présente des éléments qui méritent d’être approfondis lors d’un échange individuel.','Vous pouvez réserver votre visio de 30 minutes ici :','https://calendly.com/eric-bellaiche/gp-rendez-vous-conseil-avec-eric-bellaiche-clone','');
  }else{
   lines.push('Au regard des seules informations déclarées, votre situation ne ressort pas aujourd’hui comme prioritaire pour un rendez-vous individuel selon les critères actuels du cabinet. Cette conclusion ne constitue pas une recommandation patrimoniale.','');
  }
  lines.push('Cette restitution est indicative et ne constitue ni un conseil en investissement ni une recommandation personnalisée.','','Bien cordialement,','Eric Bellaiche','Conseiller en gestion de patrimoine — CIF','ORIAS n°13001580 — membre CNCEF Patrimoine','https://eric-bellaiche.fr');
  const gmailUser=Netlify.env.get('GMAIL_USER')?.trim()??'';const gmailPassword=Netlify.env.get('GMAIL_APP_PASSWORD')?.replace(/\s+/g,'')??'';
  if(!gmailUser||!gmailPassword)return json(500,{error:'Configuration Gmail incomplète.'});
  const smtpReply=await sendMail(gmailUser,gmailPassword,email,'Votre photographie patrimoniale',lines.join('\n'));
  return json(200,{ok:true,sentAt:new Date().toISOString(),smtpReply});
 }catch(error){console.error('send-prospect-result failed',error);return json(500,{error:error instanceof Error?error.message:'Échec de l’envoi.'})}
};
export const config={path:'/api/send-prospect-result'};