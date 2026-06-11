import { useEffect } from 'react';

export default function ArticlesRedirect() {
  useEffect(() => {
    // Force full page load to serve static HTML from public/articles/
    window.location.href = window.location.pathname;
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.9375rem' }}>
      Redirection...
    </div>
  );
}
