import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowLeft, LogOut } from 'lucide-react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function PortalShell() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setLoading(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600">Chargement sécurisé…</div>;
  }

  if (!session) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/espace-client/connexion?next=${next}`} replace />;
  }

  const dossier = new URLSearchParams(location.search).get('dossier');
  const homeHref = dossier ? `/espace-client?dossier=${encodeURIComponent(dossier)}` : '/espace-client';
  const isJourneyHome = location.pathname === '/espace-client' || location.pathname === '/espace-client/';

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/espace-client/connexion', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Cabinet Eric Bellaiche</p>
            <h1 className="text-lg font-semibold">Mon dossier patrimonial</h1>
          </div>
          <button onClick={signOut} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50">
            <LogOut className="h-4 w-4" /> Quitter
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {!isJourneyHome && (
          <Link to={homeHref} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950">
            <ArrowLeft className="h-4 w-4" /> Retour à mon dossier
          </Link>
        )}
        <Outlet />
      </main>
    </div>
  );
}
