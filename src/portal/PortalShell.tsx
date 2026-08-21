import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { FileText, Home, LogOut, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
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
  const suffix = dossier ? `?dossier=${encodeURIComponent(dossier)}` : '';

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/espace-client/connexion', { replace: true });
  };

  const links = [
    { to: `/espace-client${suffix}`, label: 'Accueil', icon: Home },
    { to: `/espace-client/documents${suffix}`, label: 'Documents', icon: FileText },
    { to: `/espace-client/recueil${suffix}`, label: 'Recueil', icon: ShieldCheck },
    { to: `/espace-client/synthese${suffix}`, label: 'Synthèse', icon: UserRoundCheck },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Cabinet Eric Bellaiche</p>
            <h1 className="text-lg font-semibold">Espace client sécurisé</h1>
          </div>
          <button onClick={signOut} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50">
            <LogOut className="h-4 w-4" /> Déconnexion
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[220px_1fr] lg:px-8">
        <nav className="flex gap-2 overflow-x-auto lg:flex-col">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={label}
              to={to}
              end={label === 'Accueil'}
              className={({ isActive }) =>
                `inline-flex min-w-max items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-white'
                }`
              }
            >
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
