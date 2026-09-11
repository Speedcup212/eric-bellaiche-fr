const fs = require('fs');

const file = 'src/pages/portal/CifAdminPage.tsx';
let src = fs.readFileSync(file, 'utf8');

function replaceOnce(from, to, label) {
  if (src.includes(to)) return;
  if (!src.includes(from)) throw new Error(`Patch target not found: ${label}`);
  src = src.replace(from, to);
}

replaceOnce(
  "import { BarChart3, CheckCircle2, ChevronRight, ClipboardList, FileCheck2, FileText, LayoutDashboard, LogOut, Mail, Menu, Plus, Search, ShieldCheck, Sparkles, Trash2, UserRound, Users, X } from 'lucide-react';",
  "import { Archive, BarChart3, CheckCircle2, ChevronRight, ClipboardList, FileCheck2, FileText, LayoutDashboard, LogOut, Mail, Menu, Plus, RotateCcw, Search, ShieldCheck, Sparkles, Trash2, UserRound, Users, X } from 'lucide-react';",
  'archive icons',
);

replaceOnce(
  "interface DossierRow { id:string; reference:string|null; libelle:string|null; recueil_status:string; statut:string; created_at?:string|null; }",
  "interface DossierRow { id:string; reference:string|null; libelle:string|null; recueil_status:string; statut:string; created_at?:string|null; archived_at?:string|null; archived_by?:string|null; }",
  'archive dossier fields',
);

replaceOnce(
  "interface DossierView extends DossierRow { investors:InvestorInviteRow[]; }",
  "interface DeletionEligibilityRow { dossier_id:string; can_delete:boolean; reason:string|null; }\ninterface DossierView extends DossierRow { investors:InvestorInviteRow[]; canDelete:boolean; deleteReason:string|null; }",
  'deletion eligibility interface',
);

replaceOnce(
  ",[deletingId,setDeletingId]=useState<string|null>(null),[search,setSearch]=useState(''),[filter,setFilter]=useState<'all'|'progress'|'ready'>('all'),",
  ",[deletingId,setDeletingId]=useState<string|null>(null),[archivingId,setArchivingId]=useState<string|null>(null),[search,setSearch]=useState(''),[filter,setFilter]=useState<'all'|'progress'|'ready'|'archived'>('all'),",
  'archive state and filter',
);

replaceOnce(
  "const[d,l,s]=await Promise.all([supabase.from('dossiers').select('id,reference,libelle,recueil_status,statut,created_at').order('created_at',{ascending:false}),supabase.from('dossier_investisseurs').select('dossier_id,investisseur_id,role_dossier,recueil_status,qpi_status,esg_status,investisseurs(prenom,nom,email)').order('role_dossier'),supabase.rpc('get_client_invite_statuses')]);if(d.error)throw d.error;if(l.error)throw l.error;if(s.error)throw s.error;",
  "const[d,l,s,e]=await Promise.all([supabase.from('dossiers').select('id,reference,libelle,recueil_status,statut,created_at,archived_at,archived_by').order('created_at',{ascending:false}),supabase.from('dossier_investisseurs').select('dossier_id,investisseur_id,role_dossier,recueil_status,qpi_status,esg_status,investisseurs(prenom,nom,email)').order('role_dossier'),supabase.rpc('get_client_invite_statuses'),supabase.rpc('get_dossier_deletion_eligibility')]);if(d.error)throw d.error;if(l.error)throw l.error;if(s.error)throw s.error;if(e.error)throw e.error;",
  'load archived fields and deletion eligibility',
);

replaceOnce(
  "const sm=new Map(((s.data??[])as InviteStatusRow[]).map(x=>[`${x.dossier_id}:${x.investisseur_id}`,x]));const g=new Map<string,InvestorInviteRow[]>();((l.data??[])as unknown as Array<InvestorInviteRow&{dossier_id:string}>).forEach(x=>{const st=sm.get(`${x.dossier_id}:${x.investisseur_id}`);g.set(x.dossier_id,[...(g.get(x.dossier_id)??[]),{...x,invite_sent_at:st?.last_sent_at??null,invite_send_count:Number(st?.send_count??0)}])});setRows(((d.data??[])as DossierRow[]).map(x=>({...x,investors:g.get(x.id)??[]})))",
  "const sm=new Map(((s.data??[])as InviteStatusRow[]).map(x=>[`${x.dossier_id}:${x.investisseur_id}`,x]));const em=new Map(((e.data??[])as DeletionEligibilityRow[]).map(x=>[x.dossier_id,x]));const g=new Map<string,InvestorInviteRow[]>();((l.data??[])as unknown as Array<InvestorInviteRow&{dossier_id:string}>).forEach(x=>{const st=sm.get(`${x.dossier_id}:${x.investisseur_id}`);g.set(x.dossier_id,[...(g.get(x.dossier_id)??[]),{...x,invite_sent_at:st?.last_sent_at??null,invite_send_count:Number(st?.send_count??0)}])});setRows(((d.data??[])as DossierRow[]).map(x=>({...x,investors:g.get(x.id)??[],canDelete:em.get(x.id)?.can_delete??false,deleteReason:em.get(x.id)?.reason??null})))",
  'map deletion eligibility',
);

const archiveFunction = `const archiveDossier=async(row:DossierView,archived:boolean)=>{const label=clientLabel(row);const action=archived?'Archivage':'Restauration';if(archived&&!window.confirm(\`Archiver le dossier « \${label} » ?\\n\\nLe dossier et toutes ses données resteront conservés. Tu pourras le restaurer à tout moment.\`))return;setArchivingId(row.id);setErrorMessage('');setMessage('');try{const{data,error}=await supabase.rpc('archive_client_dossier',{p_dossier_id:row.id,p_archived:archived});if(error)throw error;const result=data as {ok?:boolean;dossier_id?:string;archived?:boolean}|null;if(!result?.ok||result.dossier_id!==row.id)throw new Error(\`L’action n’a pas été confirmée par le serveur.\`);await load();setMessage(archived?\`Dossier archivé : \${label}.\`:\`Dossier restauré : \${label}.\`)}catch(x){setErrorMessage(\`\${action} impossible : \${messageFromError(x)}\`)}finally{setArchivingId(null)}};\n `;

replaceOnce(
  "const deleteDossier=async(row:DossierView)=>{",
  archiveFunction + "const deleteDossier=async(row:DossierView)=>{",
  'archive dossier action',
);

replaceOnce(
  "if(!window.confirm(`Supprimer définitivement le dossier « ${label} » ?\\n\\nCette action est irréversible.`))return;",
  "if(!window.confirm(`Supprimer définitivement le dossier « ${label} » ?\\n\\nCette action est irréversible et réservée aux dossiers créés par erreur, tests ou doublons.`))return;",
  'delete confirmation copy',
);

replaceOnce(
  "const filteredRows=useMemo(()=>rows.filter(r=>{const p=progressOf(r),q=search.trim().toLowerCase();if(filter==='progress'&&(p===0||p===100))return false;if(filter==='ready'&&p!==100)return false;return !q||[r.reference,r.libelle,clientLabel(r),...r.investors.map(i=>i.investisseurs?.email)].filter(Boolean).some(v=>String(v).toLowerCase().includes(q))}),[rows,search,filter]);",
  "const filteredRows=useMemo(()=>rows.filter(r=>{const p=progressOf(r),q=search.trim().toLowerCase(),archived=Boolean(r.archived_at);if(filter==='archived'&&!archived)return false;if(filter!=='archived'&&archived)return false;if(filter==='progress'&&(p===0||p===100))return false;if(filter==='ready'&&p!==100)return false;return !q||[r.reference,r.libelle,clientLabel(r),...r.investors.map(i=>i.investisseurs?.email)].filter(Boolean).some(v=>String(v).toLowerCase().includes(q))}),[rows,search,filter]);",
  'archive filtering',
);

replaceOnce(
  "const totalClients=rows.reduce((s,r)=>s+Math.max(1,r.investors.length),0),readyCount=rows.filter(r=>progressOf(r)===100).length,activeCount=rows.filter(r=>{const p=progressOf(r);return p>0&&p<100}).length;",
  "const activeRows=rows.filter(r=>!r.archived_at),archivedCount=rows.length-activeRows.length,totalClients=activeRows.reduce((s,r)=>s+Math.max(1,r.investors.length),0),readyCount=activeRows.filter(r=>progressOf(r)===100).length,activeCount=activeRows.filter(r=>{const p=progressOf(r);return p>0&&p<100}).length;",
  'active and archived counters',
);

replaceOnce(
  "<p className=\"mt-4\">{rows.length} dossiers · {totalClients} clients · {readyCount} complets · {activeCount} en cours</p>",
  "<p className=\"mt-4\">{activeRows.length} dossiers actifs · {totalClients} clients · {readyCount} complets · {activeCount} en cours · {archivedCount} archivés</p>",
  'dashboard archive count',
);

replaceOnce(
  "{(['all','progress','ready'] as const).map(f=><button key={f} onClick={()=>setFilter(f)} className=\"rounded-xl border px-3\">{f==='all'?'Tous':f==='progress'?'En cours':'Complets'}</button>)}",
  "{(['all','progress','ready','archived'] as const).map(f=><button key={f} onClick={()=>setFilter(f)} className={`rounded-xl border px-3 ${filter===f?'bg-[#0F172A] text-white':'bg-white'}`}>{f==='all'?'Tous':f==='progress'?'En cours':f==='ready'?'Complets':'Archivés'}</button>)}",
  'archived filter button',
);

replaceOnce(
  "{lastSent&&<span className=\"rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700\">Invitation envoyée · {formatSentAt(lastSent)}</span>}",
  "{lastSent&&<span className=\"rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700\">Invitation envoyée · {formatSentAt(lastSent)}</span>}{row.archived_at&&<span className=\"rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700\">Archivé</span>}",
  'archived badge',
);

const oldActions = `<button disabled={sendingInviteDossierId===row.id} onClick={()=>void listInvestors(row.id)} className={\`rounded-xl border px-3 py-2 text-sm \${primaryInvited?'bg-emerald-50 text-emerald-700':''}\`}><Mail className="inline h-4 w-4"/> {sendingInviteDossierId===row.id?'Envoi…':primaryInvited?'Renvoyer':'Inviter'}</button><button disabled={deletingId===row.id} onClick={()=>void deleteDossier(row)} className="rounded-xl border border-red-200 px-3 py-2 text-sm text-red-700 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 className="inline h-4 w-4"/> {deletingId===row.id?'Suppression…':'Supprimer'}</button>`;

const newActions = `{!row.archived_at&&<button disabled={sendingInviteDossierId===row.id} onClick={()=>void listInvestors(row.id)} className={\`rounded-xl border px-3 py-2 text-sm \${primaryInvited?'bg-emerald-50 text-emerald-700':''}\`}><Mail className="inline h-4 w-4"/> {sendingInviteDossierId===row.id?'Envoi…':primaryInvited?'Renvoyer':'Inviter'}</button>}{row.archived_at?<button disabled={archivingId===row.id} onClick={()=>void archiveDossier(row,false)} className="rounded-xl border border-blue-200 px-3 py-2 text-sm text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><RotateCcw className="inline h-4 w-4"/> {archivingId===row.id?'Restauration…':'Restaurer'}</button>:<button disabled={archivingId===row.id} onClick={()=>void archiveDossier(row,true)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"><Archive className="inline h-4 w-4"/> {archivingId===row.id?'Archivage…':'Archiver'}</button>}{row.canDelete&&<button disabled={deletingId===row.id||archivingId===row.id} onClick={()=>void deleteDossier(row)} className="rounded-xl border border-red-200 px-3 py-2 text-sm text-red-700 disabled:cursor-not-allowed disabled:opacity-50" title={row.deleteReason??'Supprimer définitivement ce dossier'}><Trash2 className="inline h-4 w-4"/> {deletingId===row.id?'Suppression…':'Supprimer'}</button>}`;

replaceOnce(oldActions, newActions, 'archive/restore/delete actions');

fs.writeFileSync(file, src);
console.log('Cabinet dossier archive and safe deletion UI patched.');
