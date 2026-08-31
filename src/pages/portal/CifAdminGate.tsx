import { useEffect, useState } from 'react';
import CifAdminPage from './CifAdminPage';
import CifCabinetLogin from './CifCabinetLogin';
import { supabase } from '../../lib/supabase';

export default function CifAdminGate() {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const verify = async () => {
    setChecking(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      setAuthorized(false);
      setChecking(false);
      return;
    }

    const { data: current, error } = await supabase.from('app_users').select('role,actif').maybeSingle();
    if (error) throw error;
    const isStaff = Boolean(current?.actif && ['cif', 'admin'].includes(current.role));

    if (!isStaff) {
      await supabase.auth.signOut();
      setAuthorized(false);
    } else {
      setAuthorized(true);
    }
    setChecking(false);
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        await verify();
      } catch {
        try { await supabase.auth.signOut(); } catch { /* no-op */ }
        if (active) {
          setAuthorized(false);
          setChecking(false);
        }
      }
    };
    void run();
    const { data } = supabase.auth.onAuthStateChange(() => { if (active) void verify(); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center bg-[#081426] px-4"><div className="rounded-3xl border border-white/10 bg-white px-6 py-5 text-center shadow-2xl"><p className="text-sm font-semibold text-[#0F172A]">Ouverture du cockpit cabinet…</p><p className="mt-1 text-xs text-[#64748B]">Vérification de la session sécurisée.</p></div></div>;
  }

  if (!authorized) return <CifCabinetLogin onAuthenticated={() => { void verify(); }} />;
  return <CifAdminPage />;
}
