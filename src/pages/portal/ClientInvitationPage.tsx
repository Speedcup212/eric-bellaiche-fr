import { useEffect, useState } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { messageFromError } from '../../portal/portalHelpers';

export default function ClientInvitationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || localStorage.getItem('cgp_pending_invite_token') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
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
    setMessage('');
    try {
      localStorage.setItem('cgp_pending_invite_token', token);
      const redirect = `${window.location.origin}/espace-client/invitation?token=${encodeURIComponent(token)}`;
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: redirect },
      });
      if (error) throw error;
      if (data.session) {
        const { error: claimError } = await supabase.rpc('claim_client_invite', { p_token: token });
        if (claimError) throw claimError;
        localStorage.removeItem('cgp_pending_invite_token');
        navigate('/espace-client', { replace: true });
        return;
      }
      setMessage('Votre compte a été créé. Vérifiez votre messagerie pour confirmer votre adresse email, puis revenez sur ce lien.');
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
          <h1 className="text-2xl font-semibold">Lien d’invitation manquant</h1>
          <p className="mt-3 text-slate-600">Utilisez le lien sécurisé transmis par le cabinet.</p>
          <Link to="/espace-client/connexion" className="mt-6 inline-block font-semibold text-slate-900 underline">Accéder à la connexion</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12 flex items-center justify-center">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl">
        <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><ShieldCheck className="h-6 w-6" /></div>
        <h1 className="text-2xl font-semibold">Activer votre espace client</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Cette invitation est personnelle. L’adresse email utilisée doit correspondre à celle enregistrée dans votre dossier.</p>
        {message ? (
          <div className="mt-6 rounded-2xl bg-emerald-50 p-5 text-emerald-800">
            <CheckCircle2 className="mb-2 h-5 w-5" />
            <p className="text-sm leading-6">{message}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-7 space-y-5">
            <label className="block text-sm font-medium text-slate-700">Adresse email
              <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Créer un mot de passe
              <input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900" />
            </label>
            {errorMessage && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>}
            <button disabled={busy} className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Activation…' : 'Activer mon espace'}</button>
          </form>
        )}
        <p className="mt-6 text-sm text-slate-500">Vous avez déjà activé votre compte ? <Link to={`/espace-client/connexion?token=${encodeURIComponent(token)}`} className="font-semibold text-slate-900 underline">Connectez-vous</Link>.</p>
      </div>
    </div>
  );
}
