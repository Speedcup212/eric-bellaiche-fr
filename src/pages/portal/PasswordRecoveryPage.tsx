import { FormEvent, useEffect, useMemo, useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function PasswordRecoveryPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const isClientRecovery = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return window.location.pathname.startsWith('/espace-client') || params.get('client-recovery') === '1';
  }, []);

  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (active) setReady(Boolean(data.session));
    };

    void checkSession();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (password.length < 10) {
      setError('Le mot de passe doit contenir au moins 10 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne sont pas identiques.');
      return;
    }

    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setBusy(false);
      setError(updateError.message || 'Impossible de modifier le mot de passe.');
      return;
    }

    if (isClientRecovery) {
      await supabase.auth.signOut();
    }

    setBusy(false);
    setDone(true);
    const destination = isClientRecovery ? '/espace-client/connexion?reset=ok' : '/cabinet';
    window.history.replaceState({}, document.title, destination);
    window.setTimeout(() => window.location.assign(destination), 900);
  };

  return (
    <div className="min-h-screen bg-[#081426] px-4 py-12 flex items-center justify-center">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-white p-8 shadow-2xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F172A] text-white">
          {done ? <ShieldCheck className="h-6 w-6" /> : <KeyRound className="h-6 w-6" />}
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[.2em] text-[#3B82F6]">Espace sécurisé</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#0F172A]">Nouveau mot de passe</h1>
        <p className="mt-2 text-sm leading-6 text-[#52627A]">
          {isClientRecovery
            ? 'Choisissez un nouveau mot de passe pour votre espace client sécurisé.'
            : 'Choisissez un nouveau mot de passe pour votre accès au cabinet Eric Bellaiche.'}
        </p>

        {!ready && !done ? (
          <div className="mt-7 rounded-2xl border border-[#D9E5F5] bg-[#F8FBFF] p-4 text-sm text-[#52627A]">
            Vérification du lien sécurisé en cours…
          </div>
        ) : done ? (
          <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
            {isClientRecovery ? 'Mot de passe modifié. Retour à la connexion…' : 'Mot de passe modifié. Ouverture du cockpit…'}
          </div>
        ) : (
          <form onSubmit={submit} className="mt-7 space-y-4">
            <input
              type="password"
              minLength={10}
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nouveau mot de passe"
              className="w-full rounded-2xl border border-[#D9E5F5] bg-[#F8FBFF] px-4 py-3.5 outline-none transition focus:border-[#3B82F6]"
            />
            <input
              type="password"
              minLength={10}
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirmer le mot de passe"
              className="w-full rounded-2xl border border-[#D9E5F5] bg-[#F8FBFF] px-4 py-3.5 outline-none transition focus:border-[#3B82F6]"
            />
            <button
              disabled={busy}
              className="w-full rounded-2xl bg-[#0F172A] px-5 py-3.5 font-semibold text-white shadow-lg shadow-slate-900/10 disabled:opacity-50"
            >
              {busy ? 'Modification…' : 'Enregistrer le nouveau mot de passe'}
            </button>
          </form>
        )}

        {error && <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-700">{error}</p>}
      </div>
    </div>
  );
}
