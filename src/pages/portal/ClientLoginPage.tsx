import { useEffect, useState } from 'react';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
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
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;

      const token = searchParams.get('token') || localStorage.getItem('cgp_pending_invite_token');
      if (token) {
        const { error: claimError } = await supabase.rpc('claim_client_invite', { p_token: token });
        if (claimError) throw claimError;
        localStorage.removeItem('cgp_pending_invite_token');
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
    <div className="min-h-screen bg-slate-950 px-4 py-12 flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Retour au site
        </Link>
        <div className="mb-8">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold">Accéder à mon dossier patrimonial</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Retrouvez l’étape en cours et reprenez votre dossier là où vous l’avez laissé.</p>
        </div>
        <form onSubmit={submit} className="space-y-5">
          <label className="block text-sm font-medium text-slate-700">
            Adresse email
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Mot de passe
            <input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900" />
          </label>
          {errorMessage && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white disabled:opacity-50">
            {busy ? 'Connexion…' : 'Reprendre mon dossier'}
          </button>
        </form>
        <p className="mt-6 text-center text-xs leading-5 text-slate-500">Le premier accès se fait uniquement depuis le lien personnel transmis par le cabinet.</p>
      </div>
    </div>
  );
}
