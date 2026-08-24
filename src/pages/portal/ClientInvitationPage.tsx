import { useEffect, useState } from 'react';
import { CheckCircle2, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { messageFromError } from '../../portal/portalHelpers';

async function functionErrorMessage(error: unknown): Promise<string> {
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const payload = await context.clone().json() as { error?: string };
        if (payload?.error) return payload.error;
      } catch {
        // Fall back to the generic message.
      }
    }
  }
  return messageFromError(error);
}

export default function ClientInvitationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || localStorage.getItem('cgp_pending_invite_token') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingInvite, setLoadingInvite] = useState(Boolean(token));
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) return;
    localStorage.setItem('cgp_pending_invite_token', token);
    const initialize = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        const { error } = await supabase.rpc('claim_client_invite', { p_token: token });
        if (!error) {
          localStorage.removeItem('cgp_pending_invite_token');
          navigate('/espace-client', { replace: true });
          return;
        }
      }
      const { data, error } = await supabase.functions.invoke('activate-client', { body: { action: 'lookup', token } });
      if (error) throw new Error(await functionErrorMessage(error));
      if (!data?.email) throw new Error('Invitation invalide ou expirée');
      setEmail(String(data.email));
    };
    void initialize().catch((error) => setErrorMessage(messageFromError(error))).finally(() => setLoadingInvite(false));
  }, [navigate, token]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !email) return;
    setBusy(true); setErrorMessage('');
    const cleanEmail = email.trim().toLowerCase();
    localStorage.setItem('cgp_pending_invite_token', token);
    try {
      const { data: existingSession, error: existingLoginError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (!existingLoginError && existingSession.session) {
        const { error: claimError } = await supabase.rpc('claim_client_invite', { p_token: token });
        if (claimError) throw claimError;
        localStorage.removeItem('cgp_pending_invite_token');
        navigate('/espace-client', { replace: true });
        return;
      }
      await supabase.auth.signOut();
      const { error: activationError } = await supabase.functions.invoke('activate-client', { body: { action: 'activate', token, email: cleanEmail, password } });
      if (activationError) throw new Error(await functionErrorMessage(activationError));
      const { error: loginError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (loginError) throw loginError;
      localStorage.removeItem('cgp_pending_invite_token');
      navigate('/espace-client', { replace: true });
    } catch (error) {
      setErrorMessage(messageFromError(error));
    } finally {
      setBusy(false);
    }
  };

  const resumeActivatedDossier = () => {
    localStorage.removeItem('cgp_pending_invite_token');
  };

  if (!token) {
    return <div className="relative min-h-screen bg-[#07111f] px-4 py-12 flex items-center justify-center"><div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(6,182,212,.2),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(79,70,229,.2),transparent_35%)]" /><div className="relative w-full max-w-lg rounded-[30px] border border-white/10 bg-white/95 p-8 shadow-2xl"><ShieldCheck className="h-8 w-8 text-slate-400" /><h1 className="mt-5 text-2xl font-semibold">Lien personnel manquant</h1><p className="mt-3 text-sm leading-6 text-slate-500">Utilisez le lien sécurisé transmis par le cabinet pour activer votre dossier.</p><Link to="/espace-client/connexion" className="mt-6 inline-block font-semibold text-slate-900 underline">Reprendre un dossier déjà activé</Link></div></div>;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07111f] px-4 py-10 sm:py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_5%,rgba(6,182,212,.24),transparent_30%),radial-gradient(circle_at_85%_15%,rgba(79,70,229,.24),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(16,185,129,.12),transparent_35%)]" />
      <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-5xl items-center gap-10 lg:grid-cols-[1.05fr_.95fr]">
        <div className="hidden text-white lg:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-cyan-200 backdrop-blur"><Sparkles className="h-3.5 w-3.5" /> Accès personnel sécurisé</div>
          <h1 className="mt-7 max-w-xl text-5xl font-semibold leading-[1.05] tracking-tight">Votre accompagnement commence ici.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">Créez votre mot de passe, puis suivez un parcours simple : recueil d’informations, profil investisseur, préférences de durabilité si vous souhaitez en exprimer, puis transmission des documents en fin de parcours.</p>
          <div className="mt-8 space-y-3 text-sm text-slate-300"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-emerald-300"><CheckCircle2 className="h-4 w-4" /></span> Une seule étape affichée à la fois</div><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-cyan-300"><ShieldCheck className="h-4 w-4" /></span> Données enregistrées et protégées</div></div>
        </div>

        <div className="mx-auto w-full max-w-md rounded-[30px] border border-white/10 bg-white/95 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/10"><LockKeyhole className="h-6 w-6" /></div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Cabinet Eric Bellaiche</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Activer mon dossier patrimonial</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">Votre adresse a été associée à cette invitation. Créez simplement un mot de passe pour commencer le parcours.</p>

          <form onSubmit={submit} className="mt-7 space-y-5">
            <label className="block text-sm font-semibold text-slate-700">Adresse email<input type="email" required readOnly autoComplete="username" value={email} placeholder={loadingInvite ? 'Vérification de l’invitation…' : ''} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3.5 text-slate-500 outline-none" /></label>
            <label className="block text-sm font-semibold text-slate-700">Créer votre mot de passe<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none transition focus:border-slate-400 focus:bg-white" placeholder="8 caractères minimum" /></label>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">Ce mot de passe vous permettra de reprendre le dossier ultérieurement sans rechercher votre email d’invitation.</div>
            {errorMessage && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>}
            <button disabled={busy || loadingInvite || !email} className="w-full rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50">{busy ? 'Activation…' : loadingInvite ? 'Vérification…' : 'Commencer mon dossier'}</button>
          </form>
          <p className="mt-6 text-center text-xs leading-5 text-slate-400">Dossier déjà activé ? <Link to="/espace-client/connexion" onClick={resumeActivatedDossier} className="font-semibold text-slate-700 underline">Reprendre mon dossier</Link></p>
        </div>
      </div>
    </div>
  );
}