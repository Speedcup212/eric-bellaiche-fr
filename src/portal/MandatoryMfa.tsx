import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function MandatoryMfa({ onVerified }: { onVerified: () => void }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const prepare = async () => {
      try {
        const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalError) throw aalError;
        if (aal.currentLevel === 'aal2') {
          if (active) onVerified();
          return;
        }

        const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
        if (listError) throw listError;
        const verified = factors.totp.find((factor) => factor.status === 'verified');
        if (verified) {
          if (active) setFactorId(verified.id);
          return;
        }

        const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Cabinet Eric Bellaiche' });
        if (enrollError) throw enrollError;
        if (active) {
          setFactorId(enrolled.id);
          setQrCode(enrolled.totp.qr_code);
          setSecret(enrolled.totp.secret);
        }
      } catch (e) {
        if (!active) return;
        const message = e instanceof Error ? e.message : '';
        if (/factor.*already exists|already exists.*factor/i.test(message)) {
          setError('Une méthode de double authentification est déjà associée à ce compte.');
        } else {
          setError(message || 'Impossible de préparer la double authentification.');
        }
      } finally {
        if (active) setBusy(false);
      }
    };
    void prepare();
    return () => { active = false; };
  }, [onVerified]);

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError('');
    try {
      const cleanCode = code.replace(/\s+/g, '');
      if (!/^\d{6}$/.test(cleanCode)) throw new Error('Saisissez le code à 6 chiffres de votre application d’authentification.');
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: cleanCode });
      if (verifyError) throw verifyError;
      onVerified();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Code de sécurité incorrect.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#081426] px-4 py-10">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-white p-7 shadow-2xl sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F172A] text-white"><ShieldCheck className="h-6 w-6" /></div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[.18em] text-[#3B82F6]">Sécurité renforcée</p>
        <h1 className="mt-2 text-2xl font-semibold text-[#0F172A]">Double authentification obligatoire</h1>
        <p className="mt-3 text-sm leading-6 text-[#52627A]">Pour protéger vos données personnelles et patrimoniales, une seconde vérification est nécessaire après votre mot de passe. Ouvrez votre application d’authentification et saisissez le code à 6 chiffres affiché.</p>

        {busy && !factorId && <p className="mt-6 rounded-2xl bg-[#F8FBFF] p-4 text-sm text-[#52627A]">Préparation de la vérification sécurisée…</p>}

        {qrCode && (
          <div className="mt-6 rounded-2xl border border-[#D9E5F5] bg-[#F8FBFF] p-4">
            <p className="text-sm font-semibold text-[#0F172A]">Première activation</p>
            <p className="mt-1 text-xs leading-5 text-[#64748B]">Scannez ce QR code avec votre application d’authentification, puis saisissez le code à 6 chiffres généré.</p>
            <img src={qrCode} alt="QR code pour activer la double authentification" className="mx-auto mt-4 h-48 w-48 rounded-xl bg-white p-2" />
            {secret && <details className="mt-3 text-xs text-[#64748B]"><summary className="cursor-pointer font-semibold">Afficher la clé manuelle</summary><code className="mt-2 block break-all rounded-lg bg-white p-2">{secret}</code></details>}
          </div>
        )}

        {factorId && (
          <form onSubmit={verify} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-[#0F172A]">Code de sécurité
              <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="mt-2 w-full rounded-2xl border border-[#D9E5F5] bg-[#F8FBFF] px-4 py-3.5 text-center text-xl tracking-[.35em] outline-none transition focus:border-[#3B82F6]" placeholder="000000" />
            </label>
            {error && <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <button disabled={busy} className="w-full rounded-2xl bg-[#0F172A] px-5 py-3.5 font-semibold text-white disabled:opacity-50">{busy ? 'Vérification…' : 'Vérifier et continuer'}</button>
          </form>
        )}

        {!factorId && error && <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="button" onClick={() => void signOut()} className="mt-5 w-full text-center text-sm font-semibold text-[#64748B] hover:text-[#0F172A]">Se déconnecter</button>
      </div>
    </div>
  );
}
