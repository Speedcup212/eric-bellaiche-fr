import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
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
        // Ignore parsing errors and fall back to the generic message.
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
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) return;
    localStorage.setItem('cgp_pending_invite_token', token);
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const { error } = await supabase.rpc('claim_client_invite', { p_token: token });
      if (!error) {
        localStorage.removeItem('cgp_pending_invite_token');
        navigate('/espace-client', { replace: true });
      }
    });
  }, [navigate, token]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;

    setBusy(true);
    setErrorMessage('');
    const cleanEmail = email.trim().toLowerCase();
    localStorage.setItem('cgp_pending_invite_token', token);

    try {
      const { data: existingSession, error: existingLoginError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (!existingLoginError && existingSession.session) {
        const { error: claimError } = await supabase.rpc('claim_client_invite', { p_token: token });
        if (claimError) throw claimError;
        localStorage.removeItem('cgp_pending_invite_token');
        navigate('/espace-client', { replace: true });
        return;
      }

      await supabase.auth.signOut();

      const { error: activationError } = await supabase.functions.invoke('activate-client', {
        body: { token, email: cleanEmail, password },
      });

      if (activationError) throw new Error(await functionErrorMessage(activationError));

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (loginError) throw loginError;

      localStorage.removeItem('cgp_pending_invite_token');
      navigate('/espace-client', { replace: true });
    } catch (error) {
      setErrorMessage(messageFromError(error));
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-12 flex items-center justify-center">
        <div className="w-full max-w-lg rounded-3xl bg-white p-8">
          <h1 className="text-2xl font-semibold">Lien personnel manquant</h1>
          <p className="mt-3 text-slate-600">Utilisez le lien sécurisé transmis par le cabinet pour accéder à votre dossier.</p>
          <Link to="/espace-client/connexion" className="mt-6 inline-block font-semibold text-slate-900 underline">Reprendre un dossier déjà activé</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12 flex items-center justify-center">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl">
        <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cabinet Eric Bellaiche</p>
        <h1 className="mt-2 text-2xl font-semibold">Accéder à votre dossier patrimonial</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Ce lien est personnel. Créez simplement votre mot de passe pour commencer. Vous pourrez interrompre le parcours et le reprendre ultérieurement.
        </p>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <label className="block text-sm font-medium text-slate-700">Adresse email
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900" />
          </label>
          <label className="block text-sm font-medium text-slate-700">Créer votre mot de passe
            <input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900" />
          </label>
          {errorMessage && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white disabled:opacity-50">
            {busy ? 'Activation…' : 'Commencer mon dossier'}
          </button>
        </form>
        <p className="mt-6 text-sm text-slate-500">
          Dossier déjà activé ? <Link to={`/espace-client/connexion?token=${encodeURIComponent(token)}`} className="font-semibold text-slate-900 underline">Reprendre mon dossier</Link>.
        </p>
      </div>
    </div>
  );
}
