import { useEffect, useState } from 'react';
import CifAdminPage from './CifAdminPage';
import { supabase } from '../../lib/supabase';

export default function CifAdminGate() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    const verify = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        if (active) setChecking(false);
        return;
      }

      const { data: current } = await supabase.from('app_users').select('role,actif').maybeSingle();
      const isStaff = Boolean(current?.actif && ['cif', 'admin'].includes(current.role));

      if (!isStaff) {
        await supabase.auth.signOut();
      }

      if (active) setChecking(false);
    };

    void verify().catch(async () => {
      try { await supabase.auth.signOut(); } catch { /* no-op */ }
      if (active) setChecking(false);
    });

    return () => { active = false; };
  }, []);

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center bg-[#081426] px-4"><div className="rounded-3xl border border-white/10 bg-white px-6 py-5 text-center shadow-2xl"><p className="text-sm font-semibold text-[#0F172A]">Ouverture du cockpit cabinet…</p><p className="mt-1 text-xs text-[#64748B]">Vérification de la session sécurisée.</p></div></div>;
  }

  return <CifAdminPage />;
}
