import { useEffect, useState } from 'react';
import { ArrowLeft, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { stabilizeAuthSession } from '../../portal/authSession';
import { messageFromError } from '../../portal/portalHelpers';

export default function ClientLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate('/espace-client', { replace: true });
    });
  }, [navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setErrorMessage('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      await stabilizeAuthSession(data.session);

      const explicitToken = searchParams.get('token');
      const pendingToken = localStorage.getItem('cgp_pending_invite_token');

      if (explicitToken) {
        const { error: claimError } = await supabase.rpc('claim_client_invite', { p_token: explicitToken });
        if (claimError) throw claimError;
        localStorage.removeItem('cgp_pending_invite_token');
      } else if (pendingToken) {
        const { error: claimError } = await supabase.rpc('claim_client_invite', { p_token: pendingToken });
        if (claimError) {
          const { data: existingDossiers, error: progressError } = await supabase
            .from('portal_progress')
            .select('dossier_id')
            .limit(1);
          localStorage.removeItem('cgp_pending_invite_token');
          if (progressError || !existingDossiers?.length) throw claimError;
        } else {
          localStorage.removeItem('cgp_pending_invite_token');
        }
      }

      const next = searchParams.get('next');
      navigate(next && next.startsWith('/espace-client') ? next : '/espace-client', { replace: true });
    } catch (error) {
      setErrorMessage(messageFromError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07111f] px-4 py-10 sm:py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(6,182,212,0.22),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(79,70,229,0.22),transparent_32%),radial-gradient(circle_at_50%_100%,rgba(16,185,129,0.12),transparent_35%)]" />
      <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-5xl items-center gap-10 lg:grid-cols-[1.05fr_.95fr]">
        <div className="hidden text-white lg:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-cyan-200 backdrop-blur"><Sparkles className="h-3.5 w-3.5" /> Parcours patrimonial digital</div>
          <h1 className="mt-7 max-w-xl text-5xl font-semibold leading-[1.05] tracking-tight">Votre dossier patrimonial, simplement.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">Un parcours sécurisé, guidé étape par étape, pour transmettre vos documents et compléter les informations nécessaires à votre accompagnement.</p>
          <div className="mt-8 grid max-w-lg gap-3 text-sm text-slate-300">
            <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-cyan-300"><ShieldCheck className="h-4 w-4" /></span> Données protégées et accès personnel</div>
            <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-indigo-300"><LockKeyhole className="h-4 w-4" /></span> Reprise automatique là où vous vous êtes arrêté</div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md rounded-[30px] border border-white/10 bg-white/95 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Retour au site</Link>
          <div className="mt-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/10"><LockKeyhole className="h-6 w-6" /></div>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Cabinet Eric Bellaiche</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Reprendre mon dossier</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">Connectez-vous pour retrouver immédiatement la prochaine étape de votre parcours.</p>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-5">
            <label className="block text-sm font-semibold text-slate-700">Adresse email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none transition focus:border-slate-400 focus:bg-white" placeholder="vous@exemple.fr" /></label>
            <label className="block text-sm font-semibold text-slate-700">Mot de passe<input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none transition focus:border-slate-400 focus:bg-white" /></label>
            {errorMessage && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>}
            <button disabled={busy} className="w-full rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50">{busy ? 'Connexion…' : 'Reprendre mon dossier'}</button>
          </form>
          <p className="mt-6 text-center text-xs leading-5 text-slate-400">Le premier accès s’effectue depuis le lien personnel transmis par le cabinet.</p>
        </div>
      </div>
    </div>
  );
}
