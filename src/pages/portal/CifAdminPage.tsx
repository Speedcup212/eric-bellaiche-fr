import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Copy, LogOut, Mail, Plus, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { messageFromError } from '../../portal/portalHelpers';

interface DossierRow { id: string; reference: string | null; libelle: string | null; recueil_status: string; statut: string; }
interface InvestorInviteRow { investisseur_id: string; role_dossier: string; investisseurs: { prenom: string; nom: string; email: string | null } | null; }
interface InviteDraft { email: string; subject: string; body: string; link: string; }

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

export default function CifAdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<DossierRow[]>([]);
  const [auth, setAuth] = useState({ email: 'eric.bellaiche@gmail.com', password: '' });
  const [form, setForm] = useState({ reference: '', libelle: '', p1: '', n1: '', e1: '', m1: '' });
  const [errorMessage, setErrorMessage] = useState('');
  const [message, setMessage] = useState('');
  const [inviteDraft, setInviteDraft] = useState<InviteDraft | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data: current } = await supabase.from('app_users').select('role,actif').maybeSingle();
    if (!current?.actif || !['cif', 'admin'].includes(current.role)) { setReady(false); return; }
    setReady(true);
    const { data, error } = await supabase.from('dossiers').select('id,reference,libelle,recueil_status,statut').order('created_at', { ascending: false });
    if (error) throw error;
    setRows((data ?? []) as DossierRow[]);
  };

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => { if (!active) return; setSession(data.session); if (data.session) void load().catch((error) => setErrorMessage(messageFromError(error))); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); if (next) void load().catch((error) => setErrorMessage(messageFromError(error))); else setReady(false); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setErrorMessage(''); setMessage('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: auth.email.trim(), password: auth.password });
      if (error) throw error; await load();
    } catch (error) { setErrorMessage(messageFromError(error)); } finally { setBusy(false); }
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
      setMessage(`Dossier créé : ${(data as { reference?: string }).reference ?? ''}. La situation familiale déterminera automatiquement si un conjoint doit être ajouté.`);
      setForm({ reference: '', libelle: '', p1: '', n1: '', e1: '', m1: '' });
      await load();
    } catch (error) { setErrorMessage(messageFromError(error)); } finally { setBusy(false); }
  };

  const createInvite = async (dossierId: string, investor: InvestorInviteRow) => {
    setErrorMessage(''); setInviteDraft(null);
    try {
      const email = investor.investisseurs?.email?.trim(); if (!email) throw new Error('Email investisseur manquant.');
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
    const { data, error } = await supabase.from('dossier_investisseurs').select('investisseur_id,role_dossier,investisseurs(prenom,nom,email)').eq('dossier_id', dossierId).order('role_dossier');
    if (error) { setErrorMessage(error.message); return; }
    const investors = (data ?? []) as unknown as InvestorInviteRow[];
    if (!investors.length) { setErrorMessage('Aucun investisseur rattaché.'); return; }
    if (investors.length === 1) { await createInvite(dossierId, investors[0]); return; }
    const labels = investors.map((item, index) => `${index + 1}. ${item.investisseurs?.prenom ?? ''} ${item.investisseurs?.nom ?? ''}`).join('\n');
    const answer = window.prompt(`Quelle personne inviter ?\n${labels}`, '1');
    const index = Number(answer) - 1;
    if (Number.isInteger(index) && investors[index]) await createInvite(dossierId, investors[index]);
  };

  if (!session) return <div className="min-h-screen bg-slate-950 px-4 py-12 flex items-center justify-center"><div className="w-full max-w-md rounded-3xl bg-white p-8"><ShieldCheck className="h-8 w-8" /><h1 className="mt-4 text-2xl font-semibold">Accès cabinet</h1><form onSubmit={signIn} className="mt-6 space-y-4"><input type="email" required value={auth.email} onChange={(e) => setAuth({ ...auth, email: e.target.value })} className="w-full rounded-xl border border-slate-300 px-4 py-3" /><input type="password" minLength={8} required value={auth.password} onChange={(e) => setAuth({ ...auth, password: e.target.value })} placeholder="Mot de passe" className="w-full rounded-xl border border-slate-300 px-4 py-3" /><button disabled={busy} className="w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white">{busy ? 'Connexion…' : 'Se connecter'}</button></form>{errorMessage && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>}</div></div>;

  if (!ready) return <div className="min-h-screen bg-slate-950 px-4 py-12 flex items-center justify-center"><div className="max-w-lg rounded-3xl bg-white p-8"><h1 className="text-2xl font-semibold">Vérification de l’accès CIF</h1><button onClick={() => void bootstrap()} className="mt-6 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white">Vérifier / initialiser mon accès CIF</button><button onClick={() => void signOut()} className="ml-3 mt-6 rounded-xl border border-slate-300 px-5 py-3 font-semibold">Déconnexion</button>{errorMessage && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>}</div></div>;

  return <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6"><div className="mx-auto max-w-6xl space-y-8">
    <div className="flex items-center justify-between"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Back-office</p><h1 className="mt-2 text-3xl font-semibold">Cabinet CIF / CGP</h1></div><button onClick={() => void signOut()} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold"><LogOut className="h-4 w-4" /> Déconnexion</button></div>
    <form onSubmit={create} className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8"><h2 className="text-xl font-semibold">Nouveau dossier client</h2><p className="mt-2 text-sm leading-6 text-slate-600">Crée uniquement le premier déclarant. Le recueil déterminera ensuite automatiquement si un conjoint doit être ajouté en fonction de la situation familiale.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><input placeholder="Référence (facultatif)" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="rounded-xl border border-slate-300 px-4 py-3" /><input placeholder="Libellé du dossier" value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} className="rounded-xl border border-slate-300 px-4 py-3" /><input required placeholder="Prénom" value={form.p1} onChange={(e) => setForm({ ...form, p1: e.target.value })} className="rounded-xl border border-slate-300 px-4 py-3" /><input required placeholder="Nom" value={form.n1} onChange={(e) => setForm({ ...form, n1: e.target.value })} className="rounded-xl border border-slate-300 px-4 py-3" /><input required type="email" placeholder="Email personnel" value={form.e1} onChange={(e) => setForm({ ...form, e1: e.target.value })} className="rounded-xl border border-slate-300 px-4 py-3" /><input placeholder="Mobile" value={form.m1} onChange={(e) => setForm({ ...form, m1: e.target.value })} className="rounded-xl border border-slate-300 px-4 py-3" /></div><button disabled={busy} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> {busy ? 'Création…' : 'Créer le dossier'}</button></form>
    {message && <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{message}</p>}{errorMessage && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>}
    {inviteDraft && <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6"><p className="font-semibold">Invitation client prête</p><p className="mt-2 text-sm">Destinataire : {inviteDraft.email}</p><div className="mt-4 rounded-2xl bg-white p-5 text-sm whitespace-pre-wrap"><strong>Objet : {inviteDraft.subject}</strong>{'\n\n'}{inviteDraft.body}</div><div className="mt-4 flex gap-3"><button onClick={() => void navigator.clipboard.writeText(`Objet : ${inviteDraft.subject}\n\n${inviteDraft.body}`)} className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-3 text-sm font-semibold"><Copy className="h-4 w-4" /> Copier</button><a href={`mailto:${encodeURIComponent(inviteDraft.email)}?subject=${encodeURIComponent(inviteDraft.subject)}&body=${encodeURIComponent(inviteDraft.body)}`} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"><Mail className="h-4 w-4" /> Messagerie</a></div></section>}
    <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8"><h2 className="text-xl font-semibold">Dossiers</h2><div className="mt-5 divide-y divide-slate-100">{rows.map((row) => <div key={row.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{row.reference || row.libelle}</p><p className="text-xs text-slate-500">Recueil : {row.recueil_status} · Dossier : {row.statut}</p></div><button onClick={() => void listInvestors(row.id)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"><Mail className="h-4 w-4" /> Préparer l’invitation</button></div>)}</div></section>
  </div></div>;
}
