import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

type MfaMode = 'enroll' | 'resume' | 'challenge';

type PendingEnrollment = {
  userId: string;
  factorId: string;
  qrCode: string;
  secret: string;
};

// Conservé uniquement en mémoire tant que l'application reste ouverte.
// Cela permet de retrouver le même QR code après une navigation interne,
// sans stocker le secret MFA dans localStorage/sessionStorage.
let pendingEnrollment: PendingEnrollment | null = null;

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/invalid.*totp|totp.*invalid|invalid.*code|code.*invalid/i.test(message)) {
    return 'Le code est incorrect ou a expiré. Saisissez le nouveau code à 6 chiffres affiché dans votre application.';
  }
  if (/factor.*already exists|already exists.*factor/i.test(message)) {
    return 'Une activation est déjà en cours. Vous pouvez la reprendre ci-dessous.';
  }
  if (/factor.*not found|not found.*factor/i.test(message)) {
    return 'Cette activation n’est plus disponible. Recommencez l’activation pour obtenir un nouveau QR code.';
  }
  return message || 'Impossible de préparer la double authentification.';
}

export default function MandatoryMfa({ onVerified }: { onVerified: () => void }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [mode, setMode] = useState<MfaMode>('enroll');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const applyEnrollment = (userId: string, enrolled: { id: string; totp: { qr_code: string; secret: string } }) => {
    pendingEnrollment = {
      userId,
      factorId: enrolled.id,
      qrCode: enrolled.totp.qr_code,
      secret: enrolled.totp.secret,
    };
    setFactorId(enrolled.id);
    setQrCode(enrolled.totp.qr_code);
    setSecret(enrolled.totp.secret);
    setMode('enroll');
  };

  const enrollFresh = async (userId: string) => {
    const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Cabinet Eric Bellaiche',
    });

    if (!enrollError && enrolled) {
      applyEnrollment(userId, enrolled);
      return;
    }

    // En cas de course entre deux préparations, on reprend le facteur existant
    // plutôt que d'afficher une erreur technique au client.
    const message = enrollError?.message || '';
    if (/factor.*already exists|already exists.*factor/i.test(message)) {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;
      const existing = factors.totp.find((factor) => factor.status === 'unverified');
      if (existing) {
        setFactorId(existing.id);
        setQrCode(null);
        setSecret(null);
        setMode('resume');
        return;
      }
    }

    if (enrollError) throw enrollError;
    throw new Error('Impossible de démarrer la double authentification.');
  };

  useEffect(() => {
    let active = true;

    const prepare = async () => {
      try {
        setError('');

        const { data: auth, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!auth.user) throw new Error('Votre session a expiré. Reconnectez-vous.');

        const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalError) throw aalError;
        if (aal.currentLevel === 'aal2') {
          pendingEnrollment = null;
          if (active) onVerified();
          return;
        }

        const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
        if (listError) throw listError;

        const verified = factors.totp.find((factor) => factor.status === 'verified');
        if (verified) {
          pendingEnrollment = null;
          if (active) {
            setFactorId(verified.id);
            setQrCode(null);
            setSecret(null);
            setMode('challenge');
          }
          return;
        }

        const unverified = factors.totp.filter((factor) => factor.status === 'unverified');

        // Après une simple navigation dans l'application, on réutilise exactement
        // le QR code déjà affiché au lieu de recréer un facteur MFA.
        if (
          pendingEnrollment?.userId === auth.user.id &&
          unverified.some((factor) => factor.id === pendingEnrollment?.factorId)
        ) {
          if (active) {
            setFactorId(pendingEnrollment.factorId);
            setQrCode(pendingEnrollment.qrCode);
            setSecret(pendingEnrollment.secret);
            setMode('enroll');
          }
          return;
        }

        // Après un rechargement complet, le QR secret n'est volontairement pas
        // conservé dans le navigateur. On permet donc de reprendre si le QR avait
        // déjà été scanné, ou de recommencer proprement avec un bouton dédié.
        if (unverified.length > 0) {
          const latest = [...unverified].sort((a, b) =>
            String(b.created_at || '').localeCompare(String(a.created_at || '')),
          )[0];
          if (active) {
            setFactorId(latest.id);
            setQrCode(null);
            setSecret(null);
            setMode('resume');
          }
          return;
        }

        await enrollFresh(auth.user.id);
      } catch (e) {
        if (active) setError(friendlyError(e));
      } finally {
        if (active) setBusy(false);
      }
    };

    void prepare();
    return () => {
      active = false;
    };
  }, [onVerified]);

  const restartEnrollment = async () => {
    setBusy(true);
    setError('');
    setCode('');

    try {
      const { data: auth, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!auth.user) throw new Error('Votre session a expiré. Reconnectez-vous.');

      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;

      const unverified = factors.totp.filter((factor) => factor.status === 'unverified');
      for (const factor of unverified) {
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (unenrollError) throw unenrollError;
      }

      pendingEnrollment = null;
      setFactorId(null);
      setQrCode(null);
      setSecret(null);
      await enrollFresh(auth.user.id);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!factorId) return;

    setBusy(true);
    setError('');

    try {
      const cleanCode = code.replace(/\s+/g, '');
      if (!/^\d{6}$/.test(cleanCode)) {
        throw new Error('Saisissez le code à 6 chiffres de votre application d’authentification.');
      }

      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: cleanCode,
      });
      if (verifyError) throw verifyError;

      pendingEnrollment = null;
      onVerified();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    pendingEnrollment = null;
    await supabase.auth.signOut();
    window.location.reload();
  };

  const isFirstActivation = mode === 'enroll' || mode === 'resume';

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#081426] px-4 py-10">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-white p-7 shadow-2xl sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F172A] text-white">
          <ShieldCheck className="h-6 w-6" />
        </div>

        <p className="mt-6 text-xs font-bold uppercase tracking-[.18em] text-[#3B82F6]">Sécurité renforcée</p>
        <h1 className="mt-2 text-2xl font-semibold text-[#0F172A]">Double authentification obligatoire</h1>
        <p className="mt-3 text-sm leading-6 text-[#52627A]">
          {mode === 'challenge'
            ? 'Ouvrez votre application d’authentification et saisissez le code à 6 chiffres affiché.'
            : 'Pour protéger vos données personnelles et patrimoniales, une seconde vérification est nécessaire après votre mot de passe.'}
        </p>

        {busy && !factorId && (
          <p className="mt-6 rounded-2xl bg-[#F8FBFF] p-4 text-sm text-[#52627A]">
            Préparation de la vérification sécurisée…
          </p>
        )}

        {qrCode && (
          <div className="mt-6 rounded-2xl border border-[#D9E5F5] bg-[#F8FBFF] p-4">
            <p className="text-sm font-semibold text-[#0F172A]">Première activation</p>
            <p className="mt-1 text-xs leading-5 text-[#64748B]">
              Si vous n’avez pas encore d’application d’authentification, vous pouvez installer gratuitement Google Authenticator ou Microsoft Authenticator sur votre téléphone.
            </p>
            <p className="mt-2 text-xs leading-5 text-[#64748B]">
              Scannez ensuite ce QR code avec l’application, puis saisissez le code à 6 chiffres généré.
            </p>
            <img
              src={qrCode}
              alt="QR code pour activer la double authentification"
              className="mx-auto mt-4 h-48 w-48 rounded-xl bg-white p-2"
            />
            {secret && (
              <details className="mt-3 text-xs text-[#64748B]">
                <summary className="cursor-pointer font-semibold">Afficher la clé manuelle</summary>
                <code className="mt-2 block break-all rounded-lg bg-white p-2">{secret}</code>
              </details>
            )}
          </div>
        )}

        {mode === 'resume' && (
          <div className="mt-6 rounded-2xl border border-[#D9E5F5] bg-[#F8FBFF] p-4">
            <p className="text-sm font-semibold text-[#0F172A]">Activation déjà commencée</p>
            <p className="mt-1 text-xs leading-5 text-[#64748B]">
              Si vous avez déjà scanné le QR code, saisissez simplement le code à 6 chiffres ci-dessous.
            </p>
            <p className="mt-2 text-xs leading-5 text-[#64748B]">
              Sinon, recommencez l’activation pour afficher un nouveau QR code.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void restartEnrollment()}
              className="mt-3 w-full rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-50"
            >
              Afficher un nouveau QR code
            </button>
          </div>
        )}

        {factorId && (
          <form onSubmit={verify} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-[#0F172A]">
              Code de sécurité
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="mt-2 w-full rounded-2xl border border-[#D9E5F5] bg-[#F8FBFF] px-4 py-3.5 text-center text-xl tracking-[.35em] outline-none transition focus:border-[#3B82F6]"
                placeholder="000000"
              />
            </label>

            {error && (
              <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
            )}

            <button
              disabled={busy}
              className="w-full rounded-2xl bg-[#0F172A] px-5 py-3.5 font-semibold text-white disabled:opacity-50"
            >
              {busy ? 'Vérification…' : isFirstActivation ? 'Activer et continuer' : 'Vérifier et continuer'}
            </button>
          </form>
        )}

        {!factorId && error && (
          <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-5 w-full text-center text-sm font-semibold text-[#64748B] hover:text-[#0F172A]"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
