import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import MandatoryMfa from './MandatoryMfa';
import CabinetAccessCodeGate from './CabinetAccessCodeGate';
import { hasValidCabinetAccess } from './cabinetAccess';

export default function CifProtectedRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [codeVerified, setCodeVerified] = useState(false);
  const [mfaVerified, setMfaVerified] = useState(false);

  const verify = async () => {
    setLoading(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        setAuthorized(false);
        setCodeVerified(false);
        setMfaVerified(false);
        return;
      }
      const { data: current, error: roleError } = await supabase
        .from('app_users')
        .select('role,actif')
        .eq('auth_user_id', auth.user.id)
        .maybeSingle();
      if (roleError || !current?.actif || !['cif', 'admin'].includes(current.role)) {
        setAuthorized(false);
        setCodeVerified(false);
        setMfaVerified(false);
        return;
      }

      setAuthorized(true);
      const codeOk = await hasValidCabinetAccess();
      setCodeVerified(codeOk);
      if (!codeOk) {
        setMfaVerified(false);
        return;
      }

      const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) throw aalError;
      setMfaVerified(aal.currentLevel === 'aal2');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void verify(); }, []);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#081426] text-sm font-semibold text-white">Vérification de l’accès sécurisé…</div>;
  if (!authorized) return <Navigate to="/cabinet" replace />;
  if (!codeVerified) return <CabinetAccessCodeGate onVerified={() => { setCodeVerified(true); void verify(); }} />;
  if (!mfaVerified) return <MandatoryMfa onVerified={() => { setMfaVerified(true); void verify(); }} />;
  return <>{children}</>;
}
