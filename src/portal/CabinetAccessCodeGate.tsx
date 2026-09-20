import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { verifyCabinetCode } from './cabinetAccess';

export default function CabinetAccessCodeGate({ onVerified }: { onVerified: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await verifyCabinetCode(code);
      onVerified();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Code incorrect.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="min-h-screen bg-[#081426] px-4 py-12 flex items-center justify-center">
    <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-white p-8 shadow-2xl">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F172A] text-white"><ShieldCheck className="h-6 w-6" /></div>
      <p className="mt-6 text-xs font-bold uppercase tracking-[.2em] text-[#3B82F6]">Accès cabinet</p>
      <h1 className="mt-2 text-3xl font-semibold text-[#0F172A]">Code personnel</h1>
      <p className="mt-2 text-sm text-[#52627A]">Saisis ton code fixe à 6 chiffres.</p>

      <form onSubmit={submit} className="mt-7 space-y-4">
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="Code à 6 chiffres"
          className="w-full rounded-2xl border border-[#D9E5F5] bg-[#F8FBFF] px-4 py-3.5 text-center text-xl tracking-[.35em] outline-none transition focus:border-[#3B82F6]"
        />
        <button disabled={busy || code.length !== 6} className="w-full rounded-2xl bg-[#0F172A] px-5 py-3.5 font-semibold text-white shadow-lg shadow-slate-900/10 disabled:opacity-50">
          {busy ? 'Vérification…' : 'Entrer dans le cabinet'}
        </button>
      </form>

      {error && <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-700">{error}</p>}
    </div>
  </div>;
}
