import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

type MfaMode = 'enroll' | 'challenge';

type PendingEnrollment = {
  userId: string;
  factorId: string;
  qrCode: string;
  secret: string;
};

type PendingEnrollmentRef = {
  userId: string;
  factorId: string;
};

const PENDING_MFA_STORAGE_KEY = 'cabinet_mfa_pending_factor_v1';

// Le secret TOTP et le QR code restent uniquement en mémoire.
// Seuls userId + factorId sont conservés dans sessionStorage afin qu'un simple
// rechargement de page ne crée PAS un nouveau facteur Supabase.
let pendingEnrollment: PendingEnrollment | null = null;

function savePendingFactorRef(ref: PendingEnrollmentRef) {
  try {
    sessionStorage.setItem(PENDING_MFA_STORAGE_KEY, JSON.stringify(ref));
  } catch {
    // Le flux continue même si le navigateur refuse sessionStorage.
  }
}

function loadPendingFactorRef(userId: string): PendingEnrollmentRef | null {
  try {
    const raw = sessionStorage.getItem(PENDING_MFA_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingEnrollmentRef>;
    if (parsed.userId !== userId || typeof parsed.factorId !== 'string' || !parsed.factorId) {
      sessionStorage.removeItem(PENDING_MFA_STORAGE_KEY);
      return null;
    }
    return { userId, factorId: parsed.factorId };
  } catch {
    return null;
  }
}

function clearPendingEnrollment() {
  pendingEnrollment = null;
  try {
    sessionStorage.removeItem(PENDING_MFA_STORAGE_KEY);
  } catch {
    // Rien à faire.
  }
}

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/invalid.*totp|totp.*invalid|invalid.*code|code.*invalid/i.test(message)) {
    return 'Le code est incorrect ou a expiré. Saisissez le nouveau code à 6 chiffres affiché dans votre application.';
  }
  if (/factor.*not found|not found.*factor|mfa_factor_not_found/i.test(message)) {
    return 'Cette activation n’est plus disponible. Recommencez l’activation.';
  }
  if (/ip.*mismatch|mfa_ip_address_mismatch/i.test(message)) {
    return 'Pour votre sécurité, l’activation doit être terminée depuis la même connexion internet. Recommencez l’activation.';
  }
  return message || 'Impossible de préparer la double authentification.';
}

function enrollmentFriendlyName() {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `Cabinet Eric Bellaiche ${suffix}`;
}

export default function MandatoryMfa({ onVerified }: { onVerified: () => void }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [mode, setMode] = useState<MfaMode>('enroll');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [resumedAfterReload, setResumedAfterReload] = useState(false);

  const applyEnrollment = (userId: string, enrolled: { id: string; totp: { qr_code: string; secret: string } }) => {
    pendingEnrollment = {
      userId,
      factorId: enrolled.id,
      qrCode: enrolled.totp.qr_code,
      secret: enrolled.totp.secret,
    };
    savePendingFactorRef({ userId, factorId: enrolled.id });
    setFactorId(enrolled.id);
    setQrCode(enrolled.totp.qr_code);
    setSecret(enrolled.totp.secret);
    setMode('enroll');
    setResumedAfterReload(false);
  };

  const enrollFresh = async (userId: string) => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: enrollmentFriendlyName(),
      });

      if (!enrollError && enrolled) {
        applyEnrollment(userId, enrolled);
        return;
      }

      const message = enrollError?.message || '';
      const codeValue = (enrollError as { code?: string } | null)?.code || '';
      const isNameConflict = /factor.*already exists|already exists.*factor|mfa_factor_name_conflict/i.test(`${codeValue} ${message}`);
      if (!isNameConflict || attempt === 1) {
        if (enrollError) throw enrollError;
        throw new Error('Impossible de démarrer la double authentification.');
      }
    }
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
          clearPendingEnrollment();
          if (active) onVerified();
          return;
        }

        const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
        if (listError) throw listError;

        const verified = factors.totp.find((factor) => factor.status === 'verified');
        if (verified) {
          clearPendingEnrollment();
          if (active) {
            setFactorId(verified.id);
            setQrCode(null);
            setSecret(null);
            setMode('challenge');
            setResumedAfterReload(false);
          }
          return;
        }

        if (pendingEnrollment?.userId === auth.user.id) {
          if (active) {
            setFactorId(pendingEnrollment.factorId);
            setQrCode(pendingEnrollment.qrCode);
            setSecret(pendingEnrollment.secret);
            setMode('enroll');
            setResumedAfterReload(false);
          }
          return;
        }

        const stored = loadPendingFactorRef(auth.user.id);
        if (stored) {
          if (active) {
            setFactorId(stored.factorId);
            setQrCode(null);
            setSecret(null);
            setMode('enroll');
            setResumedAfterReload(true);
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

      const currentFactorId = factorId || pendingEnrollment?.factorId || loadPendingFactorRef(auth.user.id)?.factorId;
      if (currentFactorId) {
        await supabase.auth.mfa.unenroll({ factorId: currentFactorId }).catch(() => undefined);
      }

      clearPendingEnrollment();
      setFactorId(null);
      setQrCode(null);
      setSecret(null);
      setResumedAfterReload(false);
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

      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;
      if (!challenge?.id) throw new Error('Impossible de créer le challenge MFA.');

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: cleanCode,
      });
      if (verifyError) throw verifyError;

      clearPendingEnrollment();
      onVerified();
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      const codeValue = (e as { code?: string } | null)?.code || '';
      if (/factor.*not found|not found.*factor|mfa_factor_not_found/i.test(`${codeValue} ${message}`)) {
        clearPendingEnrollment();
        setFactorId(null);
        setQrCode(null);
        setSecret(null);
        setResumedAfterReload(false);
        setError('Cette activation n’est plus disponible. Cliquez sur « Recommencer l’activation ».');
        return;
      }
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    clearPendingEnrollment();
    await supabase.auth.signOut();
    window.location.reload();
  };

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

        {resumedAfterReload && factorId && !qrCode && mode === 'enroll' && (
          <div className="mt-6 rounded-2xl border border-[#D9E5F5] bg-[#F8FBFF] p-4 text-sm leading-6 text-[#52627A]">
            L’activation en cours a été conservée. Utilisez le code à 6 chiffres de l’entrée déjà créée dans votre application d’authentification. Si vous ne l’avez pas encore configurée, recommencez l’activation pour obtenir un nouveau QR code.
          </div>
        )}

        {qrCode && (
          <div className="mt-6 rounded-2xl border border-[#D9E5F5] bg-[#F8FBFF] p-4">
            <p className="text-sm font-semibold text-[#0F172A]">Première activation</p>
            <p className="mt-1 text-xs leading-5 text-[#64748B]">
              Si vous n’avez pas encore d’application d’authentification, vous pouvez installer gratuitement <strong className="font-semibold text-[#0F172A]">Google Authenticator</strong> ou <strong className="font-semibold text-[#0F172A]">Microsoft Authenticator</strong> sur votre téléphone.
            </p>
            <p className="mt-2 text-xs leading-5 text-[#64748B]">
              Ajoutez ensuite votre compte en scannant le QR code ou en saisissant la clé manuellement, puis saisissez le code à 6 chiffres généré.
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
              {busy ? 'Vérification…' : mode === 'enroll' ? 'Activer et continuer' : 'Vérifier et continuer'}
            </button>

            {mode === 'enroll' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void restartEnrollment()}
                className="w-full text-center text-sm font-semibold text-[#64748B] hover:text-[#0F172A] disabled:opacity-50"
              >
                Recommencer l’activation
              </button>
            )}
          </form>
        )}

        <details className="mt-5 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm text-[#52627A]">
          <summary className="cursor-pointer font-semibold text-[#0F172A]">
            Besoin d’aide pour activer la double authentification ?
          </summary>
          <div className="mt-4 space-y-4 text-xs leading-5 text-[#64748B]">
            <div>
              <p className="font-semibold text-[#0F172A]">Quelle application dois-je utiliser ?</p>
              <p className="mt-1">
                Vous pouvez utiliser <strong className="font-semibold text-[#0F172A]">Google Authenticator</strong> ou <strong className="font-semibold text-[#0F172A]">Microsoft Authenticator</strong>, disponibles gratuitement sur smartphone.
              </p>
            </div>
            <div>
              <p className="font-semibold text-[#0F172A]">Mon appareil photo ne fonctionne pas.</p>
              <p className="mt-1">
                Cliquez sur <strong className="font-semibold text-[#0F172A]">Afficher la clé manuelle</strong>, puis choisissez dans votre application l’option permettant de saisir une clé de configuration.
              </p>
            </div>
            <div>
              <p className="font-semibold text-[#0F172A]">Mon code est refusé.</p>
              <p className="mt-1">
                Attendez l’apparition du prochain code à 6 chiffres et saisissez-le immédiatement. Vérifiez également que la date, l’heure et le fuseau horaire automatiques sont activés sur votre téléphone.
              </p>
            </div>
            <div>
              <p className="font-semibold text-[#0F172A]">Dois-je refaire cette activation à chaque connexion ?</p>
              <p className="mt-1">
                Non. L’activation de l’application se fait une seule fois. Lors des connexions suivantes nécessitant une vérification, saisissez simplement le code à 6 chiffres généré par votre application.
              </p>
            </div>
          </div>
        </details>

        {!factorId && error && (
          <div className="mt-5">
            <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void restartEnrollment()}
              className="mt-3 w-full rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-50"
            >
              Recommencer l’activation
            </button>
          </div>
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
