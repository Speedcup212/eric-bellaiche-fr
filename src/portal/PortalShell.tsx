import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function PortalShell() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setAuthError(true);
          return;
        }
        setSession(data.session);
      })
      .catch(() => { if (active) setAuthError(true); })
      .finally(() => { if (active) setLoading(false); });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthError(false);
      setLoading(false);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#071827] text-white/75">Ouverture de votre espace sécurisé…</div>;
  }

  if (authError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#071827] px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-6 text-center shadow-2xl shadow-black/20">
          <p className="font-semibold text-[#0b1f3a]">Connexion momentanément indisponible</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">La vérification de votre session n’a pas abouti. Vos données ne sont pas affectées.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0b1f3a] px-5 py-3 text-sm font-semibold text-white"><RefreshCw className="h-4 w-4" /> Réessayer</button>
        </div>
      </div>
    );
  }

  if (!session) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/espace-client/connexion?next=${next}`} replace />;
  }

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/espace-client/connexion', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#071827] text-[#0b1f3a]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_14%_0%,rgba(59,130,246,0.18),transparent_34%),radial-gradient(circle_at_88%_0%,rgba(56,189,248,0.10),transparent_30%),linear-gradient(180deg,rgba(7,24,39,0.96),rgba(5,17,31,1))]" />
      <header className="sticky top-0 z-50 border-b border-[#dbe4ef] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => navigate('/espace-client')} className="text-left">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0b1f3a] text-white shadow-lg shadow-[#0b1f3a]/10">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7f8da1]">Cabinet Eric Bellaiche</p>
                <h1 className="text-base font-semibold tracking-tight text-[#0b1f3a] sm:text-lg">Mon dossier patrimonial</h1>
              </div>
            </div>
          </button>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-[#7f8da1] sm:block">Connexion sécurisée</span>
            <button onClick={signOut} className="inline-flex items-center gap-2 rounded-xl border border-[#dbe4ef] bg-white px-3 py-2 text-sm font-semibold text-[#5b6b82] shadow-sm transition hover:border-[#9fb1c7] hover:text-[#0b1f3a]">
              <LogOut className="h-4 w-4" /> Quitter
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
