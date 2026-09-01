import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  BarChart3,
  ChevronRight,
  Copy,
  FileCheck2,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { messageFromError } from '../../portal/portalHelpers';

interface DossierRow {
  id: string;
  reference: string | null;
  libelle: string | null;
  recueil_status: string;
  statut: string;
  created_at?: string | null;
}

interface InvestorInviteRow {
  investisseur_id: string;
  role_dossier: string;
  recueil_status?: string | null;
  qpi_status?: string | null;
  esg_status?: string | null;
  investisseurs: { prenom: string; nom: string; email: string | null } | null;
}

interface InviteDraft { email: string; subject: string; body: string; link: string; }

interface DossierView extends DossierRow {
  investors: InvestorInviteRow[];
}

function invitationBody(firstName: string, link: string): string {
  return `Bonjour ${firstName || ''},

Dans le cadre de notre accompagnement, je vous ai ouvert un espace client personnel et sécurisé sur eric-bellaiche.fr.

Cet espace vous permettra notamment de :
- déposer les documents nécessaires à l’étude de votre situation ;
- compléter et valider votre recueil d’informations patrimoniales ;
- remplir votre questionnaire de profil investisseur ;
- renseigner, si vous souhaitez exprimer des préférences de durabilité, le questionnaire correspondant ;
- consulter les documents réglementaires mis à votre disposition.

Si votre situation familiale est « Marié » ou « Pacsé », le conjoint sera rattaché automatiquement au dossier lors du recueil et disposera ensuite de son propre accès pour ses questionnaires personnels.

Pour activer votre accès, utilisez votre lien personnel :
${link}

Ce lien est personnel, valable 7 jours et ne doit pas être transféré.

Bien cordialement,

Eric Bellaiche
Conseiller en gestion de patrimoine — CIF
https://eric-bellaiche.fr`;
}

const done = (value?: string | null) => ['completed', 'validated', 'not_applicable'].includes(value ?? '');

function progressOf(dossier: DossierView) {
  if (!dossier.investors.length) return 0;
  const checks = dossier.investors.flatMap((investor) => [
    done(investor.recueil_status),
    done(investor.qpi_status),
    done(investor.esg_status),
  ]);
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function initials(dossier: DossierView) {
  const names = dossier.investors.map((item) => item.investisseurs).filter(Boolean) as Array<{ prenom: string; nom: string }>;
  if (!names.length) return 'CL';
  return names.slice(0, 2).map((name) => `${name.prenom?.[0] ?? ''}${name.nom?.[0] ?? ''}`).join('').slice(0, 3).toUpperCase();
}

function clientLabel(dossier: DossierView) {
  const names = dossier.investors.map((item) => item.investisseurs).filter(Boolean) as Array<{ prenom: string; nom: string }>;
  if (names.length) return names.map((name) => `${name.prenom} ${name.nom}`).join(' & ');
  return dossier.libelle || dossier.reference || 'Dossier client';
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-blue-100 bg-blue-50 text-blue-700'}`}>{label}</span>;
}

export default function CifAdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<DossierView[]>([]);
  const [auth, setAuth] = useState({ email: 'eric.bellaiche@gmail.com', password: '' });
  const [form, setForm] = useState({ reference: '', libelle: '', p1: '', n1: '', e1: '', m1: '' });
  const [errorMessage, setErrorMessage] = useState('');
  const [message, setMessage] = useState('');
  const [inviteDraft, setInviteDraft] = useState<InviteDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'progress' | 'ready'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  const load = async () => {
    const { data: current } = await supabase.from('app_users').select('role,actif').maybeSingle();
    if (!current?.actif || !['cif', 'admin'].includes(current.role)) { setReady(false); return; }
    setReady(true);

    const [dossiersResult, linksResult] = await Promise.all([
      supabase.from('dossiers').select('id,reference,libelle,recueil_status,statut,created_at').order('created_at', { ascending: false }),
      supabase.from('dossier_investisseurs').select('dossier_id,investisseur_id,role_dossier,recueil_status,qpi_status,esg_status,investisseurs(prenom,nom,email)').order('role_dossier'),
    ]);
    if (dossiersResult.error) throw dossiersResult.error;
    if (linksResult.error) throw linksResult.error;

    const links = (linksResult.data ?? []) as unknown as Array<InvestorInviteRow & { dossier_id: string }>;
    const grouped = new Map<string, InvestorInviteRow[]>();
    links.forEach((link) => grouped.set(link.dossier_id, [...(grouped.get(link.dossier_id) ?? []), link]));

    setRows(((dossiersResult.data ?? []) as DossierRow[]).map((row) => ({ ...row, investors: grouped.get(row.id) ?? [] })));
  };

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) void load().catch((error) => setErrorMessage(messageFromError(error)));
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) void load().catch((error) => setErrorMessage(messageFromError(error)));
      else setReady(false);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setErrorMessage(''); setMessage('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: auth.email.trim(), password: auth.password });
      if (error) throw error;
      await load();
    } catch (error) { setErrorMessage(messageFromError(error)); }
    finally { setBusy(false); }
  };

  const bootstrap = async () => {
    setErrorMessage('');
    try { const { error } = await supabase.rpc('bootstrap_cif'); if (error) throw error; await load(); setMessage('Accès CIF initialisé.'); }
    catch (error) { setErrorMessage(messageFromError(error)); }
  };

  const signOut = async () => { await supabase.auth.signOut(); setReady(false); setRows([]); };

  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setErrorMessage(''); setMessage('');
    try {
      const { data, error } = await supabase.rpc('create_client_dossier', {
        p_reference: form.reference || null, p_libelle: form.libelle || null,
        p_inv1_prenom: form.p1, p_inv1_nom: form.n1, p_inv1_email: form.e1.trim().toLowerCase(), p_inv1_mobile: form.m1 || null,
        p_inv2_prenom: null, p_inv2_nom: null, p_inv2_email: null, p_inv2_mobile: null,
      });
      if (error) throw error;
      setMessage(`Dossier créé : ${(data as { reference?: string }).reference ?? ''}.`);
      setForm({ reference: '', libelle: '', p1: '', n1: '', e1: '', m1: '' });
      setShowCreate(false);
      await load();
    } catch (error) { setErrorMessage(messageFromError(error)); }
    finally { setBusy(false); }
  };

  const createInvite = async (dossierId: string, investor: InvestorInviteRow) => {
    setErrorMessage(''); setInviteDraft(null);
    try {
      const email = investor.investisseurs?.email?.trim();
      if (!email) throw new Error('Email investisseur manquant.');
      const { data: token, error } = await supabase.rpc('create_client_invite', { p_dossier_id: dossierId, p_investisseur_id: investor.investisseur_id, p_email: email, p_validity_days: 7 });
      if (error) throw error;
      const link = `https://eric-bellaiche.fr/espace-client/invitation?token=${encodeURIComponent(token as string)}`;
      const subject = 'Votre espace client sécurisé — Cabinet Eric Bellaiche';
      const body = invitationBody(investor.investisseurs?.prenom ?? '', link);
      setInviteDraft({ email, subject, body, link });
      await navigator.clipboard.writeText(`Objet : ${subject}\n\n${body}`);
      setMessage('Invitation prête : le texte personnalisé a été copié.');
    } catch (error) { setErrorMessage(messageFromError(error)); }
  };

  const listInvestors = async (dossierId: string) => {
    setErrorMessage('');
    const dossier = rows.find((item) => item.id === dossierId);
    const investors = dossier?.investors ?? [];
    if (!investors.length) { setErrorMessage('Aucun investisseur rattaché.'); return; }
    if (investors.length === 1) { await createInvite(dossierId, investors[0]); return; }
    const labels = investors.map((item, index) => `${index + 1}. ${item.investisseurs?.prenom ?? ''} ${item.investisseurs?.nom ?? ''}`).join('\n');
    const answer = window.prompt(`Quelle personne inviter ?\n${labels}`, '1');
    const index = Number(answer) - 1;
    if (Number.isInteger(index) && investors[index]) await createInvite(dossierId, investors[index]);
  };

  const deleteDossier = async (row: DossierView) => {
    const label = clientLabel(row);
    const confirmed = window.confirm(
      `Supprimer définitivement le dossier « ${label} » ?\n\nLe recueil, le profil investisseur, l’ESG, les documents et les données rattachées à ce dossier seront supprimés. Cette action est irréversible.`,
    );
    if (!confirmed) return;

    setDeletingId(row.id);
    setErrorMessage('');
    setMessage('');
    try {
      const [sourcesResult, regulatoryResult] = await Promise.all([
        supabase.from('documents_sources').select('storage_bucket,storage_path').eq('dossier_id', row.id),
        supabase.from('documents_reglementaires').select('storage_bucket,storage_path_docx,storage_path_pdf').eq('dossier_id', row.id),
      ]);
      if (sourcesResult.error) throw sourcesResult.error;
      if (regulatoryResult.error) throw regulatoryResult.error;

      const filesByBucket = new Map<string, string[]>();
      const addFile = (bucket?: string | null, path?: string | null) => {
        if (!bucket || !path) return;
        filesByBucket.set(bucket, [...(filesByBucket.get(bucket) ?? []), path]);
      };

      (sourcesResult.data ?? []).forEach((doc) => addFile(doc.storage_bucket, doc.storage_path));
      (regulatoryResult.data ?? []).forEach((doc) => {
        addFile(doc.storage_bucket, doc.storage_path_docx);
        addFile(doc.storage_bucket, doc.storage_path_pdf);
      });

      for (const [bucket, paths] of filesByBucket.entries()) {
        const uniquePaths = [...new Set(paths)];
        if (!uniquePaths.length) continue;
        const { error } = await supabase.storage.from(bucket).remove(uniquePaths);
        if (error) throw error;
      }

      const { error } = await supabase.from('dossiers').delete().eq('id', row.id);
      if (error) throw error;

      setRows((current) => current.filter((item) => item.id !== row.id));
      setMessage(`Dossier supprimé : ${label}.`);
    } catch (error) {
      setErrorMessage(messageFromError(error));
    } finally {
      setDeletingId(null);
    }
  };

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const progress = progressOf(row);
      if (filter === 'progress' && (progress === 0 || progress === 100)) return false;
      if (filter === 'ready' && progress !== 100) return false;
      if (!query) return true;
      return [row.reference, row.libelle, clientLabel(row), ...row.investors.map((i) => i.investisseurs?.email)].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
    });
  }, [rows, search, filter]);

  const totalClients = rows.reduce((sum, row) => sum + Math.max(1, row.investors.length), 0);
  const readyCount = rows.filter((row) => progressOf(row) === 100).length;
  const activeCount = rows.filter((row) => { const p = progressOf(row); return p > 0 && p < 100; }).length;

  if (!session) return <div className="min-h-screen bg-[#081426] px-4 py-12 flex items-center justify-center"><div className="w-full max-w-md rounded-[28px] border border-white/10 bg-white p-8 shadow-2xl"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F172A] text-white"><ShieldCheck className="h-6 w-6" /></div><p className="mt-6 text-xs font-bold uppercase tracking-[.2em] text-[#3B82F6]">Espace privé</p><h1 className="mt-2 text-3xl font-semibold text-[#0F172A]">Cabinet Eric Bellaiche</h1><p className="mt-2 text-sm text-[#52627A]">Accès réservé au conseiller.</p><form onSubmit={signIn} className="mt-7 space-y-4"><input type="email" required value={auth.email} onChange={(e) => setAuth({ ...auth, email: e.target.value })} className="w-full rounded-2xl border border-[#D9E5F5] bg-[#F8FBFF] px-4 py-3.5 outline-none transition focus:border-[#3B82F6]" /><input type="password" minLength={8} required value={auth.password} onChange={(e) => setAuth({ ...auth, password: e.target.value })} placeholder="Mot de passe" className="w-full rounded-2xl border border-[#D9E5F5] bg-[#F8FBFF] px-4 py-3.5 outline-none transition focus:border-[#3B82F6]" /><button disabled={busy} className="w-full rounded-2xl bg-[#0F172A] px-5 py-3.5 font-semibold text-white shadow-lg shadow-slate-900/10">{busy ? 'Connexion…' : 'Ouvrir mon cockpit'}</button></form>{errorMessage && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>}</div></div>;

  if (!ready) return <div className="min-h-screen bg-[#081426] px-4 py-12 flex items-center justify-center"><div className="max-w-lg rounded-[28px] bg-white p-8"><h1 className="text-2xl font-semibold text-[#0F172A]">Vérification de l’accès cabinet</h1><button onClick={() => void bootstrap()} className="mt-6 rounded-2xl bg-[#0F172A] px-5 py-3 font-semibold text-white">Vérifier / initialiser mon accès CIF</button><button onClick={() => void signOut()} className="ml-3 mt-6 rounded-2xl border border-[#D9E5F5] px-5 py-3 font-semibold">Déconnexion</button>{errorMessage && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>}</div></div>;

  return <div className="min-h-screen bg-[#F6F9FD] text-[#0F172A]">
    <div className="flex min-h-screen">
      <aside className={`${mobileMenu ? 'fixed inset-y-0 left-0 z-50 flex' : 'hidden'} w-[280px] flex-col bg-[#0B172A] px-5 py-6 text-white lg:static lg:flex`}>
        <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.24em] text-[#6EA8FF]">Cabinet privé</p><p className="mt-1 text-xl font-semibold">Eric Bellaiche</p></div><button className="lg:hidden" onClick={() => setMobileMenu(false)}><X className="h-5 w-5" /></button></div>
        <nav className="mt-10 space-y-2">
          <a href="/cabinet" className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold"><LayoutDashboard className="h-4 w-4" /> Vue d’ensemble</a>
          <a href="#dossiers" className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-white/75 transition hover:bg-white/5 hover:text-white"><Users className="h-4 w-4" /> Dossiers clients</a>
          <a href="#integrations" className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-white/75 transition hover:bg-white/5 hover:text-white"><Sparkles className="h-4 w-4" /> Intégrations</a>
        </nav>
        <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs font-semibold text-white">Architecture modulaire</p><p className="mt-1 text-xs leading-5 text-white/55">Le cockpit est prêt à accueillir des connecteurs futurs : signature, email, agenda, stockage, automatisations.</p></div>
        <button onClick={() => void signOut()} className="mt-4 inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/5 hover:text-white"><LogOut className="h-4 w-4" /> Déconnexion</button>
      </aside>

      {mobileMenu && <button aria-label="Fermer le menu" className="fixed inset-0 z-40 bg-[#081426]/55 lg:hidden" onClick={() => setMobileMenu(false)} />}

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-[#E4EDF8] bg-white/90 px-4 py-4 backdrop-blur sm:px-6 lg:px-8"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4"><div className="flex items-center gap-3"><button className="rounded-xl border border-[#D9E5F5] p-2.5 lg:hidden" onClick={() => setMobileMenu(true)}><Menu className="h-5 w-5" /></button><div><p className="text-xs font-semibold text-[#5B6E87]">Cockpit conseiller</p><h1 className="text-xl font-semibold">Gestion des dossiers</h1></div></div><button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-2xl bg-[#0F172A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nouveau dossier</span></button></div></header>

        <div className="mx-auto max-w-[1500px] space-y-8 px-4 py-7 sm:px-6 lg:px-8">
          <section className="overflow-hidden rounded-[30px] bg-[#0F172A] p-7 text-white shadow-xl shadow-slate-900/10 sm:p-9"><div className="grid gap-8 lg:grid-cols-[1.3fr_.7fr]"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#7DB2FF]">Pilotage cabinet</p><h2 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">Tous tes dossiers, documents et validations dans un seul espace.</h2><p className="mt-4 max-w-2xl text-sm leading-6 text-white/65">Le parcours client reste séparé. Ici, tu pilotes le dossier : recueil, profil, ESG, documents réglementaires, audit et adéquation.</p></div><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-3xl font-semibold">{rows.length}</p><p className="mt-1 text-xs text-white/55">Dossiers</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-3xl font-semibold">{totalClients}</p><p className="mt-1 text-xs text-white/55">Clients</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-3xl font-semibold text-[#72E4B2]">{readyCount}</p><p className="mt-1 text-xs text-white/55">Complets</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-3xl font-semibold text-[#7DB2FF]">{activeCount}</p><p className="mt-1 text-xs text-white/55">En cours</p></div></div></div></section>

          {(message || errorMessage) && <div className="space-y-3">{message && <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</p>}{errorMessage && <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>}</div>}

          {inviteDraft && <section className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-6"><div className="flex items-start justify-between gap-4"><div><p className="font-semibold">Invitation client prête</p><p className="mt-1 text-sm text-emerald-800">{inviteDraft.email}</p></div><button onClick={() => setInviteDraft(null)} className="rounded-xl p-2 text-emerald-800 hover:bg-white/60"><X className="h-4 w-4" /></button></div><div className="mt-4 max-h-60 overflow-auto rounded-2xl bg-white p-5 text-sm whitespace-pre-wrap"><strong>Objet : {inviteDraft.subject}</strong>{'\n\n'}{inviteDraft.body}</div><div className="mt-4 flex gap-3"><button onClick={() => void navigator.clipboard.writeText(`Objet : ${inviteDraft.subject}\n\n${inviteDraft.body}`)} className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-3 text-sm font-semibold"><Copy className="h-4 w-4" /> Copier</button><a href={`mailto:${encodeURIComponent(inviteDraft.email)}?subject=${encodeURIComponent(inviteDraft.subject)}&body=${encodeURIComponent(inviteDraft.body)}`} className="inline-flex items-center gap-2 rounded-xl bg-[#0F172A] px-4 py-3 text-sm font-semibold text-white"><Mail className="h-4 w-4" /> Messagerie</a></div></section>}

          <section id="dossiers" className="space-y-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#3B82F6]">Portefeuille clients</p><h2 className="mt-2 text-2xl font-semibold">Dossiers</h2></div><div className="flex flex-col gap-3 sm:flex-row"><div className="relative min-w-[280px]"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6D7F97]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un client, email, référence…" className="w-full rounded-2xl border border-[#D9E5F5] bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[#3B82F6]" /></div><div className="flex rounded-2xl border border-[#D9E5F5] bg-white p-1">{([['all','Tous'],['progress','En cours'],['ready','Complets']] as const).map(([value,label]) => <button key={value} onClick={() => setFilter(value)} className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${filter === value ? 'bg-[#0F172A] text-white' : 'text-[#5B6E87] hover:bg-[#F3F7FC]'}`}>{label}</button>)}</div></div></div>

            <div className="grid gap-4">
              {filteredRows.map((row) => {
                const progress = progressOf(row);
                const allRecueil = row.investors.length > 0 && row.investors.every((i) => done(i.recueil_status));
                const allQpi = row.investors.length > 0 && row.investors.every((i) => done(i.qpi_status));
                const allEsg = row.investors.length > 0 && row.investors.every((i) => done(i.esg_status));
                return <article key={row.id} className="group rounded-[26px] border border-[#E0EAF6] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/5 sm:p-6">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex min-w-0 items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EAF3FF] text-sm font-bold text-[#2563EB]">{initials(row)}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-lg font-semibold">{clientLabel(row)}</h3>{row.reference && <span className="rounded-full bg-[#F3F7FC] px-2.5 py-1 text-[10px] font-semibold text-[#60728A]">{row.reference}</span>}</div><p className="mt-1 text-sm text-[#667991]">{row.libelle || 'Dossier patrimonial'} · {row.investors.length || 1} investisseur{row.investors.length > 1 ? 's' : ''}</p><div className="mt-3 flex flex-wrap gap-2"><StatusPill ok={allRecueil} label="Recueil" /><StatusPill ok={allQpi} label="Profil" /><StatusPill ok={allEsg} label="ESG" /></div></div></div>

                    <div className="w-full xl:max-w-[360px]"><div className="mb-2 flex items-center justify-between text-xs"><span className="font-semibold text-[#667991]">Avancement réglementaire</span><span className="font-bold text-[#0F172A]">{progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[#EAF1F8]"><div className="h-full rounded-full bg-[#3B82F6] transition-all" style={{ width: `${progress}%` }} /></div></div>

                    <div className="flex flex-wrap gap-2 xl:justify-end"><a href={`/cabinet/synthese?dossier=${encodeURIComponent(row.id)}`} className="inline-flex items-center gap-2 rounded-xl bg-[#0F172A] px-3.5 py-2.5 text-sm font-semibold text-white">Ouvrir le dossier <ChevronRight className="h-4 w-4" /></a><a href={`/cabinet/audit?dossier=${encodeURIComponent(row.id)}`} className="inline-flex items-center gap-2 rounded-xl border border-[#D9E5F5] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#0F172A]"><BarChart3 className="h-4 w-4" /> Audit</a><a href={`/cabinet/adequation?dossier=${encodeURIComponent(row.id)}`} className="inline-flex items-center gap-2 rounded-xl border border-[#D9E5F5] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#0F172A]"><FileCheck2 className="h-4 w-4" /> Adéquation</a><button onClick={() => void listInvestors(row.id)} className="inline-flex items-center gap-2 rounded-xl border border-[#D9E5F5] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#0F172A]"><Mail className="h-4 w-4" /> Inviter</button><button type="button" disabled={deletingId === row.id} onClick={() => void deleteDossier(row)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50" title="Supprimer définitivement ce dossier"><Trash2 className="h-4 w-4" /> {deletingId === row.id ? 'Suppression…' : 'Supprimer'}</button></div>
                  </div>
                </article>;
              })}
              {!filteredRows.length && <div className="rounded-[26px] border border-dashed border-[#C9D9EC] bg-white p-10 text-center"><UserRound className="mx-auto h-7 w-7 text-[#6A7D95]" /><p className="mt-3 font-semibold">Aucun dossier trouvé</p><p className="mt-1 text-sm text-[#667991]">Modifie la recherche ou le filtre.</p></div>}
            </div>
          </section>

          <section id="integrations" className="rounded-[30px] border border-[#E0EAF6] bg-white p-6 sm:p-8"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#3B82F6]">Architecture extensible</p><h2 className="mt-2 text-2xl font-semibold">Intégrations futures</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#667991]">Ces modules ne sont pas activés automatiquement. Le cockpit est structuré pour les accueillir sans refaire le CRM.</p></div><Sparkles className="hidden h-8 w-8 text-[#C5A059] sm:block" /></div><div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
            ['Signature électronique','Youtrust / signature'],
            ['Messagerie','Gmail / suivi client'],
            ['Agenda','Rendez-vous / relances'],
            ['Documents','Drive / archivage'],
          ].map(([title,subtitle]) => <div key={title} className="rounded-2xl border border-[#E0EAF6] bg-[#F9FBFE] p-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#3B82F6] shadow-sm"><FileText className="h-4 w-4" /></div><p className="mt-4 font-semibold">{title}</p><p className="mt-1 text-xs text-[#6A7D95]">{subtitle}</p><span className="mt-4 inline-flex rounded-full bg-[#EEF5FF] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#3B82F6]">Disponible plus tard</span></div>)}</div></section>
        </div>
      </main>
    </div>

    {showCreate && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#081426]/60 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.currentTarget === e.target) setShowCreate(false); }}><form onSubmit={create} className="w-full max-w-2xl rounded-[30px] bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#3B82F6]">Nouveau dossier</p><h2 className="mt-2 text-2xl font-semibold">Créer un client</h2><p className="mt-2 text-sm text-[#667991]">Le conjoint sera ajouté automatiquement si le recueil l’exige.</p></div><button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border border-[#E0EAF6] p-2.5"><X className="h-4 w-4" /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><input placeholder="Référence (facultatif)" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="rounded-2xl border border-[#D9E5F5] bg-[#F9FBFE] px-4 py-3.5 outline-none focus:border-[#3B82F6]" /><input placeholder="Libellé du dossier" value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} className="rounded-2xl border border-[#D9E5F5] bg-[#F9FBFE] px-4 py-3.5 outline-none focus:border-[#3B82F6]" /><input required placeholder="Prénom" value={form.p1} onChange={(e) => setForm({ ...form, p1: e.target.value })} className="rounded-2xl border border-[#D9E5F5] bg-[#F9FBFE] px-4 py-3.5 outline-none focus:border-[#3B82F6]" /><input required placeholder="Nom" value={form.n1} onChange={(e) => setForm({ ...form, n1: e.target.value })} className="rounded-2xl border border-[#D9E5F5] bg-[#F9FBFE] px-4 py-3.5 outline-none focus:border-[#3B82F6]" /><input required type="email" placeholder="Email personnel" value={form.e1} onChange={(e) => setForm({ ...form, e1: e.target.value })} className="rounded-2xl border border-[#D9E5F5] bg-[#F9FBFE] px-4 py-3.5 outline-none focus:border-[#3B82F6]" /><input placeholder="Mobile" value={form.m1} onChange={(e) => setForm({ ...form, m1: e.target.value })} className="rounded-2xl border border-[#D9E5F5] bg-[#F9FBFE] px-4 py-3.5 outline-none focus:border-[#3B82F6]" /></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setShowCreate(false)} className="rounded-2xl border border-[#D9E5F5] px-5 py-3 text-sm font-semibold">Annuler</button><button disabled={busy} className="inline-flex items-center gap-2 rounded-2xl bg-[#0F172A] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> {busy ? 'Création…' : 'Créer le dossier'}</button></div></form></div>}
  </div>;
}
