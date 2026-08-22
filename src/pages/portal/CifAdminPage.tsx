import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Copy, LogOut, Mail, Plus, ShieldCheck, UserRound, UsersRound } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { messageFromError } from '../../portal/portalHelpers';

interface DossierRow {
  id: string;
  reference: string | null;
  libelle: string | null;
  recueil_status: string;
  statut: string;
}

interface InvestorInviteRow {
  investisseur_id: string;
  role_dossier: string;
  investisseurs: { prenom: string; nom: string; email: string | null } | null;
}

interface InviteDraft {
  email: string;
  subject: string;
  body: string;
  link: string;
}

type DossierMode = 'single' | 'couple';

function invitationBody(firstName: string, link: string): string {
  return `Bonjour ${firstName || ''},

Dans le cadre de notre accompagnement, je vous ai ouvert un espace client personnel et sécurisé sur eric-bellaiche.fr.

Cet espace vous permettra notamment de :
- déposer les documents nécessaires à l’étude de votre situation ;
- compléter et valider votre recueil d’informations patrimoniales ;
- remplir votre questionnaire personnel de profil investisseur ;
- renseigner, si vous souhaitez exprimer des préférences de durabilité, votre questionnaire personnel correspondant ;
- consulter les documents réglementaires mis à votre disposition.

Si votre dossier concerne un couple, chaque membre dispose de son propre accès et complète séparément son profil investisseur et ses préférences de durabilité. Les profils ne sont pas moyennés entre les deux personnes.

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
  const [dossierMode, setDossierMode] = useState<DossierMode>('single');
  const [form, setForm] = useState({
    reference: '', libelle: '', p1: '', n1: '', e1: '', m1: '',
    p2: '', n2: '', e2: '', m2: '',
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [message, setMessage] = useState('');
  const [inviteDraft, setInviteDraft] = useState<InviteDraft | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data: current } = await supabase.from('app_users').select('role,actif').maybeSingle();
    if (!current?.actif || !['cif', 'admin'].includes(current.role)) {
      setReady(false);
      return;
    }
    setReady(true);
    const { data, error } = await supabase
      .from('dossiers')
      .select('id,reference,libelle,recueil_status,statut')
      .order('created_at', { ascending: false });
    if (error) throw error;
    setRows((data ?? []) as DossierRow[]);
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
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setErrorMessage('');
    setMessage('');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: auth.email.trim(),
        password: auth.password,
      });
      if (error) throw error;
      await load();
    } catch (error) {
      setErrorMessage(messageFromError(error));
    } finally {
      setBusy(false);
    }
  };

  const bootstrap = async () => {
    setErrorMessage('');
    try {
      const { error } = await supabase.rpc('bootstrap_cif');
      if (error) throw error;
      await load();
      setMessage('Accès CIF initialisé.');
    } catch (error) {
      setErrorMessage(messageFromError(error));
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setReady(false);
    setRows([]);
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    setMessage('');
    setBusy(true);
    try {
      const firstEmail = form.e1.trim().toLowerCase();
      const secondEmail = form.e2.trim().toLowerCase();
      if (dossierMode === 'couple') {
        if (!form.p2.trim() || !form.n2.trim() || !secondEmail) {
          throw new Error('Pour un dossier couple, renseignez le prénom, le nom et l’email de la deuxième personne.');
        }
        if (firstEmail === secondEmail) {
          throw new Error('Chaque membre du couple doit disposer de sa propre adresse email afin de conserver des questionnaires individuels et traçables.');
        }
      }

      const { data, error } = await supabase.rpc('create_client_dossier', {
        p_reference: form.reference || null,
        p_libelle: form.libelle || null,
        p_inv1_prenom: form.p1,
        p_inv1_nom: form.n1,
        p_inv1_email: firstEmail,
        p_inv1_mobile: form.m1 || null,
        p_inv2_prenom: dossierMode === 'couple' ? form.p2 : null,
        p_inv2_nom: dossierMode === 'couple' ? form.n2 : null,
        p_inv2_email: dossierMode === 'couple' ? secondEmail : null,
        p_inv2_mobile: dossierMode === 'couple' ? form.m2 || null : null,
      });
      if (error) throw error;
      setMessage(`Dossier ${dossierMode === 'couple' ? 'couple' : 'individuel'} créé : ${(data as { reference?: string }).reference ?? ''}. ${dossierMode === 'couple' ? 'Deux accès personnels sont disponibles ; QPI et ESG seront remplis séparément.' : ''}`);
      setForm({ reference: '', libelle: '', p1: '', n1: '', e1: '', m1: '', p2: '', n2: '', e2: '', m2: '' });
      setDossierMode('single');
      await load();
    } catch (error) {
      setErrorMessage(messageFromError(error));
    } finally {
      setBusy(false);
    }
  };

  const createInvite = async (dossierId: string, investor: InvestorInviteRow) => {
    setErrorMessage('');
    setInviteDraft(null);
    try {
      const email = investor.investisseurs?.email?.trim();
      if (!email) throw new Error('Email investisseur manquant.');

      const { data: token, error } = await supabase.rpc('create_client_invite', {
        p_dossier_id: dossierId,
        p_investisseur_id: investor.investisseur_id,
        p_email: email,
        p_validity_days: 7,
      });
      if (error) throw error;

      const link = `https://eric-bellaiche.fr/espace-client/invitation?token=${encodeURIComponent(token as string)}`;
      const subject = 'Votre espace client sécurisé — Cabinet Eric Bellaiche';
      const body = invitationBody(investor.investisseurs?.prenom ?? '', link);
      const draft = { email, subject, body, link };
      setInviteDraft(draft);

      await navigator.clipboard.writeText(`Objet : ${subject}\n\n${body}`);
      setMessage('Invitation prête : le texte personnalisé a été copié.');
    } catch (error) {
      setErrorMessage(messageFromError(error));
    }
  };

  const copyDraft = async () => {
    if (!inviteDraft) return;
    await navigator.clipboard.writeText(`Objet : ${inviteDraft.subject}\n\n${inviteDraft.body}`);
    setMessage('Email d’invitation copié.');
  };

  const listInvestors = async (dossierId: string) => {
    setErrorMessage('');
    const { data, error } = await supabase
      .from('dossier_investisseurs')
      .select('investisseur_id,role_dossier,investisseurs(prenom,nom,email)')
      .eq('dossier_id', dossierId)
      .order('role_dossier');
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const investors = (data ?? []) as unknown as InvestorInviteRow[];
    if (investors.length === 0) {
      setErrorMessage('Aucun investisseur rattaché.');
      return;
    }
    if (investors.length === 1) {
      await createInvite(dossierId, investors[0]);
      return;
    }

    const labels = investors
      .map((item, index) => `${index + 1}. ${item.investisseurs?.prenom ?? ''} ${item.investisseurs?.nom ?? ''}`)
      .join('\n');
    const answer = window.prompt(`Dossier couple : quelle personne inviter ?\nChaque personne reçoit son propre accès.\n\n${labels}`, '1');
    const index = Number(answer) - 1;
    if (Number.isInteger(index) && investors[index]) await createInvite(dossierId, investors[index]);
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-12 flex items-center justify-center">
        <div className="w-full max-w-md rounded-3xl bg-white p-8">
          <ShieldCheck className="h-8 w-8" />
          <h1 className="mt-4 text-2xl font-semibold">Accès cabinet</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">Espace réservé au CIF. Utilisez le compte cabinet déjà activé.</p>
          <form onSubmit={signIn} className="mt-6 space-y-4">
            <input type="email" required value={auth.email} onChange={(event) => setAuth({ ...auth, email: event.target.value })} className="w-full rounded-xl border border-slate-300 px-4 py-3" />
            <input type="password" minLength={8} required value={auth.password} onChange={(event) => setAuth({ ...auth, password: event.target.value })} placeholder="Mot de passe" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
            <button disabled={busy} className="w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Connexion…' : 'Se connecter'}</button>
          </form>
          {message && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
          {errorMessage && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>}
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-12 flex items-center justify-center">
        <div className="max-w-lg rounded-3xl bg-white p-8">
          <ShieldCheck className="h-8 w-8" />
          <h1 className="mt-4 text-2xl font-semibold">Vérification de l’accès CIF</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">Le compte est authentifié mais le rôle cabinet n’est pas encore reconnu.</p>
          <button onClick={() => void bootstrap()} className="mt-6 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white">Vérifier / initialiser mon accès CIF</button>
          <button onClick={() => void signOut()} className="ml-3 mt-6 rounded-xl border border-slate-300 px-5 py-3 font-semibold">Déconnexion</button>
          {message && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
          {errorMessage && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Back-office</p>
            <h1 className="mt-2 text-3xl font-semibold">Cabinet CIF / CGP</h1>
          </div>
          <button onClick={() => void signOut()} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold">
            <LogOut className="h-4 w-4" /> Déconnexion
          </button>
        </div>

        <form onSubmit={create} className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Nouveau dossier client</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Choisissez d’abord si le dossier concerne une seule personne ou un couple. En mode couple, chaque personne aura un accès, un profil investisseur et un questionnaire ESG distincts.</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setDossierMode('single')} className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${dossierMode === 'single' ? 'border-slate-900 bg-slate-900 text-white shadow-md' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}>
              <UserRound className="mt-0.5 h-5 w-5 shrink-0" />
              <span><strong className="block">Une personne</strong><span className={`mt-1 block text-xs leading-5 ${dossierMode === 'single' ? 'text-slate-200' : 'text-slate-500'}`}>Un investisseur, un recueil, un profil et un questionnaire de durabilité.</span></span>
            </button>
            <button type="button" onClick={() => setDossierMode('couple')} className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${dossierMode === 'couple' ? 'border-slate-900 bg-slate-900 text-white shadow-md' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}>
              <UsersRound className="mt-0.5 h-5 w-5 shrink-0" />
              <span><strong className="block">Un couple</strong><span className={`mt-1 block text-xs leading-5 ${dossierMode === 'couple' ? 'text-slate-200' : 'text-slate-500'}`}>Un dossier commun, deux personnes identifiées et deux profils réglementaires individuels.</span></span>
            </button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <input placeholder="Référence (facultatif)" value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} className="rounded-xl border border-slate-300 px-4 py-3" />
            <input placeholder="Libellé du dossier" value={form.libelle} onChange={(event) => setForm({ ...form, libelle: event.target.value })} className="rounded-xl border border-slate-300 px-4 py-3" />
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center gap-2"><UserRound className="h-5 w-5 text-slate-600" /><h3 className="font-semibold text-slate-900">Personne 1</h3></div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <input required placeholder="Prénom" value={form.p1} onChange={(event) => setForm({ ...form, p1: event.target.value })} className="rounded-xl border border-slate-300 px-4 py-3" />
              <input required placeholder="Nom" value={form.n1} onChange={(event) => setForm({ ...form, n1: event.target.value })} className="rounded-xl border border-slate-300 px-4 py-3" />
              <input required type="email" placeholder="Email personnel" value={form.e1} onChange={(event) => setForm({ ...form, e1: event.target.value })} className="rounded-xl border border-slate-300 px-4 py-3" />
              <input placeholder="Mobile" value={form.m1} onChange={(event) => setForm({ ...form, m1: event.target.value })} className="rounded-xl border border-slate-300 px-4 py-3" />
            </div>
          </div>

          {dossierMode === 'couple' && (
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-5">
              <div className="flex items-center gap-2"><UserRound className="h-5 w-5 text-blue-700" /><h3 className="font-semibold text-slate-900">Personne 2</h3></div>
              <p className="mt-1 text-xs leading-5 text-slate-600">Une adresse email personnelle différente est nécessaire : les réponses QPI et ESG sont rattachées individuellement à cette personne.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <input required placeholder="Prénom" value={form.p2} onChange={(event) => setForm({ ...form, p2: event.target.value })} className="rounded-xl border border-slate-300 px-4 py-3" />
                <input required placeholder="Nom" value={form.n2} onChange={(event) => setForm({ ...form, n2: event.target.value })} className="rounded-xl border border-slate-300 px-4 py-3" />
                <input required type="email" placeholder="Email personnel" value={form.e2} onChange={(event) => setForm({ ...form, e2: event.target.value })} className="rounded-xl border border-slate-300 px-4 py-3" />
                <input placeholder="Mobile" value={form.m2} onChange={(event) => setForm({ ...form, m2: event.target.value })} className="rounded-xl border border-slate-300 px-4 py-3" />
              </div>
            </div>
          )}

          <button disabled={busy} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            <Plus className="h-4 w-4" /> {busy ? 'Création…' : `Créer le dossier ${dossierMode === 'couple' ? 'couple' : 'individuel'}`}
          </button>
        </form>

        {message && <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{message}</p>}
        {errorMessage && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>}

        {inviteDraft && (
          <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700">Invitation client prête</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">Email personnalisé</h2>
            <p className="mt-3 text-sm text-slate-600">Destinataire : {inviteDraft.email}</p>
            <div className="mt-4 rounded-2xl bg-white p-5 text-sm leading-6 text-slate-700 whitespace-pre-wrap">
              <strong>Objet : {inviteDraft.subject}</strong>{'\n\n'}{inviteDraft.body}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={() => void copyDraft()} className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-3 text-sm font-semibold">
                <Copy className="h-4 w-4" /> Copier l’email
              </button>
              <a href={`mailto:${encodeURIComponent(inviteDraft.email)}?subject=${encodeURIComponent(inviteDraft.subject)}&body=${encodeURIComponent(inviteDraft.body)}`} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
                <Mail className="h-4 w-4" /> Ouvrir dans ma messagerie
              </a>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Dossiers</h2>
          <div className="mt-5 divide-y divide-slate-100">
            {rows.map((row) => (
              <div key={row.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{row.reference || row.libelle}</p>
                  <p className="text-xs text-slate-500">Recueil : {row.recueil_status} · Dossier : {row.statut}</p>
                </div>
                <button onClick={() => void listInvestors(row.id)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">
                  <Mail className="h-4 w-4" /> Préparer l’invitation
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
