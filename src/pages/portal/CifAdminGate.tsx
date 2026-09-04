import { useCallback, useEffect, useState } from 'react';
import CifAdminPage from './CifAdminPage';
import CifCabinetLogin from './CifCabinetLogin';
import CifQuestionnairesPage from './CifQuestionnairesPage';
import CifProspectsPage from './CifProspectsPage';
import { supabase } from '../../lib/supabase';

export default function CifAdminGate({ view = 'dashboard' }: { view?: 'dashboard' | 'questionnaires' | 'prospects' }) {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const verify = useCallback(async () => {
    setChecking(true);

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;

    const session = sessionData.session;
    if (!session) {
      setAuthorized(false);
      setChecking(false);
      return;
    }

    const { data: current, error } = await supabase
      .from('app_users')
      .select('role,actif')
      .eq('auth_user_id', session.user.id)
      .maybeSingle();

    if (error) throw error;

    const isStaff = Boolean(current?.actif && ['cif', 'admin'].includes(current.role));
    if (!isStaff) {
      await supabase.auth.signOut();
      setAuthorized(false);
      setChecking(false);
      return;
    }

    setAuthorized(true);
    setChecking(false);

    if (window.location.hash) {
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        await verify();
      } catch {
        if (active) {
          setAuthorized(false);
          setChecking(false);
        }
      }
    };

    void run();

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === 'SIGNED_OUT' || !session) {
        setAuthorized(false);
        setChecking(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        window.setTimeout(() => {
          if (active) void run();
        }, 0);
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [verify]);

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center bg-[#081426] px-4"><div className="rounded-3xl border border-white/10 bg-white px-6 py-5 text-center shadow-2xl"><p className="text-sm font-semibold text-[#0F172A]">Ouverture du cockpit cabinet…</p><p className="mt-1 text-xs text-[#64748B]">Vérification de la session sécurisée.</p></div></div>;
  }

  if (!authorized) return <CifCabinetLogin onAuthenticated={() => { void verify(); }} />;
  if (view === 'questionnaires') return <CifQuestionnairesPage />;
  if (view === 'prospects') return <CifProspectsPage />;
  return <CifAdminPage />;
}
