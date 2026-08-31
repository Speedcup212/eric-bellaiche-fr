import { useState } from 'react';
import { Mail, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Props {
  onAuthenticated: () => void;
}

const CABINET_EMAIL = 'eric.bellaiche@gmail.com';
const CABINET_REDIRECT_URL = 'https://eric-bellaiche.fr/cabinet';

function friendlyError(message: string) {
  if (/invalid login credentials/i.test(message)) return 'Mot de passe incorrect. Utilise le lien sécurisé ci-dessous si tu ne te souviens plus du mot de passe.';
  if (/email rate limit/i.test(message)) return 'Trop de demandes ont été envoyées. Attends quelques minutes avant de redemander un lien.';
  return message;
}

export default function CifCabinetLogin({ onAuthenticated }: Props) {
  const [email] = useState(CABINET_EMAIL);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      onAuthenticated();
    } catch (e) {
      setError(friendlyError(e instanceof Error ? e.message : 'Connexion impossible.'));
    } finally {
      setBusy(false);
    }
  };

  const sendMagicLink = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: CABINET_REDIRECT_URL,
        },
      });
      if (otpError) throw otpError;
      setMessage('Lien sécurisé envoyé à ton adresse Gmail. Ouvre uniquement le dernier email reçu puis clique une seule fois sur le lien.');
    } catch (e) {
      setError(friendlyError(e instanceof Error ? e.message : 'Envoi impossible.'));
    } finally {
      setBusy(false);
    }
  };

  return <div className="min-h-screen bg-[#081426] px-4 py-12 flex items-center justify-center">
    <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-white p-8 shadow-2xl">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F172A] text-white"><ShieldCheck className="h-6 w-6" /></div>
      <p className="mt-6 text-xs font-bold uppercase tracking-[.2em] text-[#3B82F6]">Espace privé</p>
      <h1 className="mt-2 text-3xl font-semibold text-[#0F172A]">Cabinet Eric Bellaiche</h1>
      <p className="mt-2 text-sm text-[#52627A]">Accès réservé au conseiller.</p>

      <form onSubmit={signIn} className="mt-7 space-y-4">
        <input type="email" readOnly value={email} className="w-full rounded-2xl border border-[#D9E5F5] bg-[#F8FBFF] px-4 py-3.5 text-[#52627A] outline-none" />
        <input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" autoComplete="current-password" className="w-full rounded-2xl border border-[#D9E5F5] bg-[#F8FBFF] px-4 py-3.5 outline-none transition focus:border-[#3B82F6]" />
        <button disabled={busy} className="w-full rounded-2xl bg-[#0F172A] px-5 py-3.5 font-semibold text-white shadow-lg shadow-slate-900/10 disabled:opacity-50">{busy ? 'Connexion…' : 'Ouvrir mon cockpit'}</button>
      </form>

      <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-[#E4EDF8]" /><span className="text-[11px] font-semibold uppercase tracking-[.15em] text-[#8291A6]">ou</span><span className="h-px flex-1 bg-[#E4EDF8]" /></div>

      <button type="button" disabled={busy} onClick={() => void sendMagicLink()} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#CFE0F5] bg-[#F8FBFF] px-5 py-3.5 text-sm font-semibold text-[#0F172A] transition hover:border-[#3B82F6] hover:bg-[#EEF5FF] disabled:opacity-50"><Mail className="h-4 w-4" /> Recevoir un lien sécurisé par email</button>

      {message && <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm leading-5 text-emerald-800">{message}</p>}
      {error && <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-700">{error}</p>}
    </div>
  </div>;
}
