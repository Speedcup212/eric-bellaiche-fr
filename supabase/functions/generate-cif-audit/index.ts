import { createClient } from 'npm:@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'npm:pdf-lib@1.17.1';

const VERSION = 'AUDIT-CLIENT-2026-08-31-1';
const BUCKET = 'regulatory-docs';
const A4 = { width: 595.28, height: 841.89 };
const M = 42;
const DARK = rgb(15/255,23/255,42/255);
const BLUE = rgb(23/255,58/255,99/255);
const GREEN = rgb(44/255,143/255,137/255);
const GREY = rgb(95/255,107/255,120/255);
const LIGHT = rgb(248/255,250/255,252/255);
const BORDER = rgb(212/255,220/255,229/255);
const PALETTE = [rgb(.12,.32,.48),rgb(.10,.52,.46),rgb(.72,.45,.18),rgb(.42,.38,.66),rgb(.55,.62,.68),rgb(.26,.54,.72),rgb(.55,.36,.28),rgb(.30,.62,.38)];
type J = Record<string, any>;
type Ctx = { pdf: PDFDocument; page: PDFPage; regular: PDFFont; bold: PDFFont; y: number; pageNo: number };

function cors(origin:string|null){ const allowed=new Set(['https://eric-bellaiche.fr','https://www.eric-bellaiche.fr','http://localhost:5173']); return {'Access-Control-Allow-Origin':origin&&allowed.has(origin)?origin:'https://eric-bellaiche.fr','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'}; }
function clean(v:any,f='Non renseigné'){ if(v===null||v===undefined||v==='') return f; if(Array.isArray(v)) return v.map(x=>clean(x,'')).join(', '); if(typeof v==='object') return JSON.stringify(v); return String(v); }
function n(v:any){ const x=Number(String(v??0).replace(/\s/g,'').replace(',','.')); return Number.isFinite(x)?x:0; }
function eur(v:any){ return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n(v)); }
function pct(v:any){ return `${new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(n(v))} %`; }
function slug(s:string){ return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'').toLowerCase(); }
async function hash(data:Uint8Array|string){ const b=typeof data==='string'?new TextEncoder().encode(data):data; return [...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join(''); }
function byCode(sections:J[],id:string){ return Object.fromEntries(sections.filter(s=>s.investisseur_id===id).map(s=>[s.section_code,s.payload??{}])); }
function invName(i:J){ return `${clean(i.prenom,'')} ${clean(i.nom,'')}`.trim(); }
function wrap(font:PDFFont,s:string,size:number,width:number){ const words=clean(s).split(/\s+/); const lines:string[]=[]; let l=''; for(const w of words){ const candidate=l?`${l} ${w}`:w; if(font.widthOfTextAtSize(candidate,size)<=width) l=candidate; else { if(l) lines.push(l); l=w; } } if(l) lines.push(l); return lines.length?lines:['']; }
async function makeCtx(){ const pdf=await PDFDocument.create(); const regular=await pdf.embedFont(StandardFonts.Helvetica); const bold=await pdf.embedFont(StandardFonts.HelveticaBold); const page=pdf.addPage([A4.width,A4.height]); return {pdf,page,regular,bold,y:A4.height-M,pageNo:1} as Ctx; }
function footer(c:Ctx){ c.page.drawText(`Cabinet Eric Bellaiche — Audit patrimonial 2026 — ${c.pageNo}`,{x:M,y:18,size:7.5,font:c.regular,color:GREY}); }
function newPage(c:Ctx){ footer(c); c.page=c.pdf.addPage([A4.width,A4.height]); c.pageNo++; c.y=A4.height-M; }
function ensure(c:Ctx,h:number){ if(c.y-h<42) newPage(c); }
function text(c:Ctx,s:string,o:J={}){ const size=o.size??9.2, font=o.bold?c.bold:c.regular, width=o.width??A4.width-2*M, lh=o.lh??size*1.26; const lines=wrap(font,clean(s),size,width); ensure(c,lines.length*lh+(o.after??3)); for(const line of lines){ c.page.drawText(line,{x:o.x??M,y:c.y-size,size,font,color:o.color??DARK}); c.y-=lh; } c.y-=o.after??3; }
function h(c:Ctx,s:string){ text(c,s,{bold:true,size:14,color:BLUE,after:7}); }
function sub(c:Ctx,s:string){ text(c,s,{bold:true,size:10.2,color:BLUE,after:4}); }
function mini(c:Ctx,label:string,value:string){ text(c,label,{bold:true,size:9.1,color:BLUE,after:1}); text(c,value,{size:8.7,after:5}); }
function table(c:Ctx,heads:string[],rows:string[][],weights?:number[]){ const W=A4.width-2*M, ws=weights??heads.map(()=>1), total=ws.reduce((a,b)=>a+b,0), cols=ws.map(x=>W*x/total), fs=heads.length>=5?7.4:8.2, pad=4; const row=(vals:string[],head=false)=>{ const font=head?c.bold:c.regular; const lines=vals.map((v,i)=>wrap(font,clean(v),fs,cols[i]-pad*2)); const rh=Math.max(19,Math.max(...lines.map(x=>x.length))*fs*1.25+pad*2); ensure(c,rh+1); let x=M; vals.forEach((_,i)=>{ c.page.drawRectangle({x,y:c.y-rh,width:cols[i],height:rh,borderWidth:.5,borderColor:BORDER,color:head?BLUE:rgb(1,1,1)}); let yy=c.y-pad-fs; lines[i].forEach(line=>{ c.page.drawText(line,{x:x+pad,y:yy,size:fs,font,color:head?rgb(1,1,1):DARK}); yy-=fs*1.25; }); x+=cols[i]; }); c.y-=rh; }; row(heads,true); rows.forEach(r=>{ if(c.y<85){newPage(c);row(heads,true);} row(r);}); c.y-=7; }
function polar(cx:number,cy:number,r:number,a:number){ const t=(a-90)*Math.PI/180; return [cx+r*Math.cos(t),cy+r*Math.sin(t)]; }
function wedgePath(cx:number,cy:number,r:number,start:number,end:number){ const [x1,y1]=polar(cx,cy,r,start),[x2,y2]=polar(cx,cy,r,end); const large=end-start>180?1:0; return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`; }
function donut(c:Ctx,title:string,items:J[]){ const valid=items.map((x,i)=>({label:clean(x.label??x.poche??x.name??`Poche ${i+1}`),value:n(x.montant??x.value),color:PALETTE[i%PALETTE.length]})).filter(x=>x.value>0); if(!valid.length)return; const total=valid.reduce((s,x)=>s+x.value,0); ensure(c,220); text(c,title,{bold:true,size:10.2,color:BLUE,after:4}); const cx=M+95,cy=c.y-88,r=66; let a=0; valid.forEach(x=>{ const span=x.value/total*360; c.page.drawSvgPath(wedgePath(cx,cy,r,a,a+span),{color:x.color}); a+=span; }); c.page.drawCircle({x:cx,y:cy,size:31,color:rgb(1,1,1)}); c.page.drawText(eur(total),{x:cx-29,y:cy-3,size:8.5,font:c.bold,color:DARK}); let yy=c.y-9; valid.forEach(x=>{ const xx=M+195; c.page.drawRectangle({x:xx,y:yy-5,width:9,height:9,color:x.color}); const label=`${x.label} — ${eur(x.value)} — ${pct(x.value/total*100)}`; const lines=wrap(c.regular,label,8.8,A4.width-M-xx-16); lines.forEach(line=>{ c.page.drawText(line,{x:xx+14,y:yy-5,size:8.8,font:c.regular,color:DARK}); yy-=11; }); yy-=6; }); c.y-=198; }
function supportsFor(rec:J,type:string){ const raw=rec.supports?.[type]??[]; return Array.isArray(raw)?raw:[]; }
function explainEnvelope(c:Ctx,key:string){
  if(key==='scpi'){
    mini(c,'Fonctionnement et rôle','Une SCPI est un placement immobilier collectif : le client achète des parts d’un portefeuille d’immeubles géré par une société de gestion. Dans cette allocation, elle constitue une poche immobilière professionnelle diversifiée de long terme, sans gestion locative directe.');
    mini(c,'Fiscalité','La fiscalité dépend du mode de détention et de la localisation des immeubles. Les revenus de source française et étrangère peuvent relever de traitements différents.');
  }
  if(key==='assurance_vie'){
    mini(c,'Rôle de l’assurance-vie','L’assurance-vie est utilisée comme enveloppe de diversification et de capitalisation. Elle peut accueillir un fonds en euros et des unités de compte, notamment obligataires, actions, ETF ou immobilières selon le contrat.');
  }
  if(key==='cto'){
    mini(c,'Fonctionnement et rôle','Le compte-titres ordinaire permet d’investir sans plafond légal sur une large gamme de titres et d’ETF en France comme à l’international. Il complète le PEA pour les marchés et supports non éligibles.');
    mini(c,'Fiscalité','Dividendes, intérêts et plus-values réalisées relèvent de la fiscalité mobilière applicable au contribuable.');
  }
  if(key==='pea'){
    mini(c,'Fonctionnement et rôle','Le PEA est une enveloppe réglementée destinée principalement aux actions et ETF éligibles européens. Il est utilisé pour une poche actions de long terme dans un cadre fiscal spécifique.');
    mini(c,'Fiscalité','Après cinq ans, les gains retirés sont exonérés d’impôt sur le revenu ; les prélèvements sociaux restent dus selon la réglementation applicable.');
  }
}
function defaultSupportDescription(x:J,key:string){ const raw=`${clean(x.nom??x.support,'')} ${clean(x.type_support??x.nature??x.classe_actif,'')}`.toLowerCase(); if(key==='scpi'||raw.includes('scpi')) return 'SCPI investie dans un portefeuille immobilier géré par une société de gestion, apportant une diversification géographique et/ou sectorielle selon sa stratégie.'; if(raw.includes('nasdaq')) return 'ETF exposé aux grandes sociétés non financières cotées sur le Nasdaq, avec une forte présence des secteurs technologiques et de croissance.'; if(raw.includes('world')||raw.includes('msci monde')) return 'ETF donnant accès à un large ensemble d’actions internationales et constituant une base diversifiée pour la poche actions.'; if(raw.includes('em')||raw.includes('emerg')) return 'ETF donnant accès aux marchés émergents afin de compléter la diversification géographique du portefeuille.'; if(raw.includes('europe')) return 'ETF exposé à un ensemble d’actions européennes réparties entre plusieurs pays et secteurs.'; if(raw.includes('cac 40')) return 'ETF répliquant les principales grandes capitalisations françaises composant l’indice CAC 40.'; if(raw.includes('oblig')||raw.includes('bond')) return 'Support obligataire investi dans des titres de dette émis par des États ou des entreprises selon la stratégie retenue.'; if(key==='assurance_vie') return 'Unité de compte sélectionnée au sein de l’assurance-vie pour compléter la diversification du contrat.'; return 'Support sélectionné pour remplir une fonction précise dans l’allocation patrimoniale.'; }
function selectedSupportCards(c:Ctx,key:string,s:J[]){ if(!s.length)return; sub(c,'Supports sélectionnés'); for(const x of s){ ensure(c,55); text(c,clean(x.nom??x.support),{bold:true,size:9.5,color:BLUE,after:2}); text(c,clean(x.description,defaultSupportDescription(x,key)),{size:8.6,after:2}); if(x.role) text(c,`Rôle dans l’allocation : ${clean(x.role)}`,{size:8.5,bold:true,after:6}); else c.y-=4; } }
function signatureSection(c:Ctx,investors:J[]){ newPage(c); h(c,'Signatures'); text(c,'Validation du document par les clients et le conseiller.',{size:8.8,color:GREY,after:10}); const people=[...investors.map(i=>({name:invName(i),role:'Client'})),{name:'Eric Bellaiche',role:'Conseiller'}].slice(0,3); const gap=10, totalW=A4.width-2*M, boxW=(totalW-gap*(people.length-1))/people.length, boxH=145; ensure(c,boxH+10); people.forEach((p,i)=>{ const x=M+i*(boxW+gap); c.page.drawRectangle({x,y:c.y-boxH,width:boxW,height:boxH,borderWidth:.7,borderColor:BORDER,color:LIGHT}); c.page.drawText(p.name,{x:x+8,y:c.y-18,size:8.6,font:c.bold,color:BLUE}); c.page.drawText(p.role,{x:x+8,y:c.y-33,size:7.5,font:c.regular,color:GREY}); c.page.drawText('Fait à : __________________',{x:x+8,y:c.y-55,size:7.6,font:c.regular,color:DARK}); c.page.drawText('Date : __________________',{x:x+8,y:c.y-73,size:7.6,font:c.regular,color:DARK}); c.page.drawText('Signature :',{x:x+8,y:c.y-95,size:7.6,font:c.bold,color:DARK}); }); c.y-=boxH+8; }

async function build(snapshot:J,rec:J){ const c=await makeCtx(); const names=snapshot.investors.map(invName).join(' & '); const maps=snapshot.investors.map((i:J)=>({i,m:byCode(snapshot.sections,i.id)})); const profiles=snapshot.qpiResults.map((r:J)=>clean(r.profil_operationnel_final??r.profil_indicatif)).filter(Boolean); const before:J[]=[]; for(const {m} of maps){ const items=m.financial?.items??m.patrimony?.placements??[]; items.forEach((x:J)=>before.push({label:clean(x.categorie??x.type??x.libelle??'Placement'),montant:n(x.montant??x.valeur??x.encours)})); }
  text(c,`ÉTUDE PATRIMONIALE — ${names.toUpperCase()}`,{bold:true,size:10,color:BLUE,after:5});
  text(c,'CABINET DE CONSEIL EN GESTION DE PATRIMOINE',{bold:true,size:8,color:GREY,after:5});
  text(c,'AUDIT PATRIMONIAL ET PROPOSITION D’INVESTISSEMENT',{bold:true,size:18,color:DARK,after:8});
  text(c,names,{bold:true,size:13,color:GREEN,after:14});
  h(c,'Objet de l’audit');
  text(c,'Présenter les principaux constats patrimoniaux, l’allocation recommandée et les modalités de mise en œuvre à partir des informations recueillies et validées avec les clients.');
  table(c,['Repère','Donnée retenue pour la décision'],[['Épargne financière à arbitrer',eur(rec.epargne_a_arbitrer)],['Réserve de sécurité',eur(rec.reserve_securite)],['Profil',profiles.join(' / ')||'À confirmer'],['Projet à préserver',clean(rec.projet_a_preserver)],['Conseiller','Eric Bellaiche']],[40,60]);
  h(c,'Décision proposée'); text(c,clean(rec.diagnostic));

  newPage(c); h(c,'1. Synthèse exécutive');
  sub(c,'Diagnostic patrimonial'); text(c,clean(rec.diagnostic));
  donut(c,'Allocation actuelle — Avant',before);
  donut(c,'Allocation cible — Après',rec.allocation??[]);
  table(c,['Poche cible','Montant','Poids','Fonction'],(rec.allocation??[]).map((x:J)=>[clean(x.label??x.poche),eur(x.montant),pct(x.poids??(n(x.montant)/(n(rec.epargne_a_arbitrer)||1)*100)),clean(x.fonction)]),[31,20,14,35]);

  newPage(c); h(c,'2. Arbitrage patrimonial et séquencement');
  table(c,['Phase','Opération','Montant / commentaire'],(rec.sequencing??[]).map((x:J)=>[clean(x.phase),clean(x.operation),x.montant?eur(x.montant):clean(x.commentaire)]),[20,48,32]);

  const supportSections=[['scpi','3. SCPI — immobilier collectif diversifié'],['assurance_vie','4. Assurance-vie — diversification et capitalisation'],['cto','5. CTO — exposition internationale'],['pea','6. PEA — actions Europe / France']];
  for(const [key,title] of supportSections){ const s=supportsFor(rec,key); if(!s.length)continue; newPage(c); h(c,title); explainEnvelope(c,key); table(c,['Support','ISIN / société','Montant','Poids','Rôle'],s.map((x:J)=>[clean(x.nom??x.support),clean(x.isin??x.societe_gestion),eur(x.montant),pct(x.poids),clean(x.role)]),[31,22,16,12,19]); donut(c,`Répartition ${key.toUpperCase()}`,s.map((x:J)=>({label:x.nom??x.support,montant:x.montant}))); selectedSupportCards(c,key,s); }

  newPage(c); h(c,'7. Arbitrages fiscaux, crédit et protection');
  const taxRows=maps.map(({i,m}:J)=>[invName(i),clean(m.tax?.tmi?`${m.tax.tmi} %`:'À confirmer'),clean(m.tax?.revenu_fiscal_reference?eur(m.tax.revenu_fiscal_reference):'À confirmer')]);
  table(c,['Titulaire','TMI','RFR'],taxRows,[38,20,42]);
  (rec.fiscal_notes??[]).forEach((x:any)=>text(c,`• ${clean(x)}`));
  if(rec.protection_notes) text(c,clean(rec.protection_notes));

  newPage(c); h(c,'8. Adéquation, risques et justification');
  text(c,'La proposition tient compte du profil investisseur, de la capacité à supporter des pertes, des objectifs, de l’horizon de placement, de la situation financière et, le cas échéant, des préférences de durabilité.');
  text(c,'Les supports en unités de compte, ETF, actions et SCPI présentent un risque de perte en capital. La liquidité, la volatilité, le risque de marché, de change, de taux, de crédit et immobilier doivent être appréciés support par support.');

  newPage(c); h(c,'9. Plan de mise en œuvre');
  (rec.controls??[]).forEach((x:any)=>text(c,`• ${clean(x)}`));
  text(c,'Chaque opération reste conditionnée à la remise et à l’examen des documents précontractuels et réglementaires nécessaires à la souscription.');

  newPage(c); h(c,'10. Conclusion');
  text(c,clean(rec.diagnostic));
  text(c,'L’allocation proposée organise l’épargne entre liquidités de sécurité, immobilier, obligations et actions. Sa mise en œuvre doit rester progressive et compatible avec les projets patrimoniaux à court et moyen terme.');

  newPage(c); h(c,'Annexe 1 — Comprendre le PEA'); explainEnvelope(c,'pea');
  newPage(c); h(c,'Annexe 2 — Comprendre le CTO'); explainEnvelope(c,'cto');
  newPage(c); h(c,'Annexe 3 — Comprendre la SCPI'); explainEnvelope(c,'scpi');
  signatureSection(c,snapshot.investors);
  footer(c);
  return new Uint8Array(await c.pdf.save({useObjectStreams:false}));
}

Deno.serve(async(req)=>{
  const headers=cors(req.headers.get('origin'));
  if(req.method==='OPTIONS') return new Response('ok',{headers});
  if(req.method!=='POST') return new Response(JSON.stringify({error:'Méthode non autorisée'}),{status:405,headers});
  try{
    const auth=req.headers.get('Authorization')??'';
    if(!auth.startsWith('Bearer ')) return new Response(JSON.stringify({error:'Authentification requise'}),{status:401,headers});
    const url=Deno.env.get('SUPABASE_URL')!, anon=Deno.env.get('SUPABASE_ANON_KEY')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const user=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
    const {data:app,error:ae}=await user.from('app_users').select('role,actif').maybeSingle();
    if(ae) throw ae;
    if(!app?.actif||!['cif','admin'].includes(app.role)) return new Response(JSON.stringify({error:'Accès réservé au cabinet'}),{status:403,headers});
    const body=await req.json();
    const dossierId=clean(body?.dossier_id,'');
    if(!/^[0-9a-f-]{36}$/i.test(dossierId)) return new Response(JSON.stringify({error:'Dossier invalide'}),{status:400,headers});
    const [d,links,sections,sessions,rec]=await Promise.all([
      user.from('dossiers').select('*').eq('id',dossierId).single(),
      user.from('dossier_investisseurs').select('*,investisseurs(*)').eq('dossier_id',dossierId).order('role_dossier'),
      user.from('recueil_sections').select('*').eq('dossier_id',dossierId),
      user.from('questionnaire_sessions').select('*').eq('dossier_id',dossierId),
      user.from('audit_recommendations').select('*').eq('dossier_id',dossierId).eq('statut','validated').maybeSingle(),
    ]);
    for(const r of[d,links,sections,sessions,rec]) if(r.error) throw r.error;
    if(!rec.data) throw new Error('La recommandation conseiller doit être validée avant génération de l’audit.');
    const investors=(links.data??[]).map((x:J)=>({...((Array.isArray(x.investisseurs)?x.investisseurs[0]:x.investisseurs)??{}),...x,id:x.investisseur_id}));
    if(investors.some((i:J)=>!['completed','validated'].includes(i.recueil_status)||!['completed','validated'].includes(i.qpi_status)||!['completed','validated','not_applicable'].includes(i.esg_status))) throw new Error('Recueil, profil et ESG doivent être finalisés pour tous les investisseurs.');
    const sessionIds=(sessions.data??[]).map((x:J)=>x.id);
    let qpiResults:J[]=[];
    if(sessionIds.length){ const q=await user.from('qpi_results').select('*').in('session_id',sessionIds); if(q.error) throw q.error; qpiResults=q.data??[]; }
    const snap={dossier:d.data,investors,sections:sections.data??[],sessions:sessions.data??[],qpiResults};
    const snapshotHash=await hash(JSON.stringify({version:VERSION,snap,rec:rec.data}));
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:old}=await admin.from('documents_reglementaires').select('*').eq('dossier_id',dossierId).eq('type_document','audit_patrimonial').eq('version_modele',VERSION).eq('metadata->>snapshot_hash',snapshotHash).eq('statut','generated').order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(old?.storage_path_pdf){ const {data:signed}=await admin.storage.from(old.storage_bucket??BUCKET).createSignedUrl(old.storage_path_pdf,3600); return new Response(JSON.stringify({ok:true,reused:true,document_id:old.id,signed_url:signed?.signedUrl??null,version:VERSION}),{headers}); }
    const bytes=await build(snap,rec.data);
    const fileHash=await hash(bytes);
    const ref=slug(d.data.reference||d.data.libelle||dossierId.slice(0,8));
    const path=`${dossierId}/audit/audit-patrimonial-${ref}-${fileHash.slice(0,10)}.pdf`;
    const up=await admin.storage.from(BUCKET).upload(path,bytes,{contentType:'application/pdf',upsert:false});
    if(up.error) throw up.error;
    const ins=await admin.from('documents_reglementaires').insert({dossier_id:dossierId,type_document:'audit_patrimonial',version_modele:VERSION,statut:'generated',storage_bucket:BUCKET,storage_path_pdf:path,date_generation:new Date().toISOString(),hash_sha256:fileHash,metadata:{snapshot_hash:snapshotHash,generated_from:'portal_supabase_audit',final_format:'pdf',signature_required:true,signature_mode:'manual_youtrust',model_version:'CLIENT-2026-08-31',recommendation_id:rec.data.id,recommendation_validated_at:rec.data.validated_at}}).select('id').single();
    if(ins.error) throw ins.error;
    const {data:signed}=await admin.storage.from(BUCKET).createSignedUrl(path,3600);
    return new Response(JSON.stringify({ok:true,reused:false,document_id:ins.data.id,signed_url:signed?.signedUrl??null,version:VERSION}),{headers});
  }catch(e){ console.error('generate-cif-audit',e); return new Response(JSON.stringify({error:e instanceof Error?e.message:'Génération audit impossible'}),{status:500,headers}); }
});
