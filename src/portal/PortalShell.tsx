import { useEffect, useState, type MouseEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function PortalShell() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [accountRole, setAccountRole] = useState<string | null>(null);
  const [roleUserId, setRoleUserId] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const isRecueil = location.pathname === '/espace-client/recueil';

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
      if (!nextSession) {
        setAccountRole(null);
        setRoleUserId(null);
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;
    let active = true;
    void supabase
      .from('app_users')
      .select('role,actif')
      .eq('auth_user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setAuthError(true);
          return;
        }
        setAccountRole(data?.actif ? String(data.role ?? '') : null);
      })
      .catch(() => { if (active) setAuthError(true); })
      .finally(() => { if (active) setRoleUserId(userId); });
    return () => { active = false; };
  }, [session?.user.id]);

  const roleLoading = Boolean(session && roleUserId !== session.user.id);

  if (loading || roleLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-white text-[#5b6b82]">Ouverture de votre espace sécurisé…</div>;
  }

  if (authError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="w-full max-w-md rounded-2xl border border-[#dbe4ef] bg-white p-6 text-center shadow-sm">
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

  if (accountRole === 'cif' || accountRole === 'admin') {
    return <Navigate to="/cabinet" replace />;
  }

  if (accountRole !== 'client') {
    return <Navigate to="/espace-client/connexion" replace />;
  }

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/espace-client/connexion', { replace: true });
  };

  const guardRecueilNavigation = (event: MouseEvent<HTMLElement>) => {
    if (location.pathname !== '/espace-client/recueil/parcours') return;
    const element = event.target as HTMLElement;
    const button = element.closest('button');
    if (!button) return;

    const buttonText = (button.textContent ?? '').replace(/\s+/g, ' ').trim();
    const partMatch = document.body.innerText.match(/Partie\s+(\d+)\s*\/\s*(\d+)/i);
    const currentPart = Number(partMatch?.[1] ?? 0);

    if (buttonText.includes('Précédent') && currentPart === 1) {
      event.preventDefault();
      event.stopPropagation();
      navigate(`/espace-client/recueil${location.search}`);
      return;
    }

    const sectionMatch = buttonText.match(/^(?:✓\s*)?(\d+)\.\s+(Identité|Famille|Profession|Objectifs|Revenus|Réglementaire|Patrimoine)$/i);
    if (!sectionMatch || currentPart === 0) return;

    const targetPart = Number(sectionMatch[1]);
    const completed = buttonText.startsWith('✓');
    if (!completed && targetPart > currentPart) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <div className={`min-h-screen text-[#0b1f3a] transition-colors duration-300 ${isRecueil ? 'bg-[#F8FAFC]' : 'bg-white'}`}>
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

      <main onClickCapture={guardRecueilNavigation} className="relative mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
