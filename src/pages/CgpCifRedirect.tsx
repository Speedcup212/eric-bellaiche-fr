import { useEffect } from 'react';

export default function CgpCifRedirect() {
  useEffect(() => {
    window.location.href = '/eric-bellaiche-cgp-cif/';
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.9375rem' }}>
      Redirection vers la page Eric Bellaiche CGP-CIF...
    </div>
  );
}
