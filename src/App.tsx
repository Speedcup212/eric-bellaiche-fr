import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import ConsentBanner from './components/ConsentBanner';

const HomePage = lazy(() => import('./pages/HomePage'));
const GrenoblePageWrapper = lazy(() => import('./pages/GrenoblePageWrapper'));
const MontrougePageWrapper = lazy(() => import('./pages/MontrougePageWrapper'));
const ToulousePageWrapper = lazy(() => import('./pages/ToulousePageWrapper'));
const RennesPageWrapper = lazy(() => import('./pages/RennesPageWrapper'));
const AixPageWrapper = lazy(() => import('./pages/AixPageWrapper'));
const NantesPageWrapper = lazy(() => import('./pages/NantesPageWrapper'));
const ThankYouPage = lazy(() => import('./pages/ThankYouPage'));
const CgpCifRedirect = lazy(() => import('./pages/CgpCifRedirect'));
const ConseillerScpiRedirect = lazy(() => import('./pages/ConseillerScpiRedirect'));
const ArticlePageWrapper = lazy(() => import('./pages/ArticlePageWrapper'));
const ArticlesHubPage = lazy(() => import('./pages/ArticlesHubPage'));

export default function App() {
  return (
    <BrowserRouter>
      <ConsentBanner />
      <Suspense fallback={<div style={{ minHeight: '100vh', background: '#f8fafc' }} />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/conseil-investissement-grenoble" element={<GrenoblePageWrapper />} />
          <Route path="/conseil-investissement-montrouge" element={<MontrougePageWrapper />} />
          <Route path="/conseil-investissement-toulouse" element={<ToulousePageWrapper />} />
          <Route path="/conseil-investissement-rennes" element={<RennesPageWrapper />} />
          <Route path="/conseil-investissement-aix-en-provence" element={<AixPageWrapper />} />
          <Route path="/conseil-investissement-nantes" element={<NantesPageWrapper />} />
          <Route path="/merci" element={<ThankYouPage />} />
          <Route path="/eric-bellaiche-cgp-cif" element={<CgpCifRedirect />} />
          <Route path="/eric-bellaiche-cgp-cif/*" element={<CgpCifRedirect />} />
          <Route path="/conseiller-scpi" element={<ConseillerScpiRedirect />} />
          <Route path="/conseiller-scpi/*" element={<ConseillerScpiRedirect />} />
          {/* Articles hub */}
          <Route path="/articles" element={<ArticlesHubPage />} />
          {/* Individual articles rendered from content layer (with static HTML fallback in public/) */}
          <Route path="/articles/conseiller-scpi" element={<ArticlePageWrapper slug="conseiller-scpi" />} />
          <Route path="/articles/conseiller-scpi/*" element={<ArticlePageWrapper slug="conseiller-scpi" />} />
          <Route path="/articles/audit-patrimonial-en-ligne" element={<ArticlePageWrapper slug="audit-patrimonial-en-ligne" />} />
          <Route path="/articles/audit-patrimonial-en-ligne/*" element={<ArticlePageWrapper slug="audit-patrimonial-en-ligne" />} />
          <Route path="/articles/scpi-fiscalite" element={<ArticlePageWrapper slug="scpi-fiscalite" />} />
          <Route path="/articles/scpi-fiscalite/*" element={<ArticlePageWrapper slug="scpi-fiscalite" />} />
          <Route path="/articles/scpi-assurance-vie-ou-direct" element={<ArticlePageWrapper slug="scpi-assurance-vie-ou-direct" />} />
          <Route path="/articles/scpi-assurance-vie-ou-direct/*" element={<ArticlePageWrapper slug="scpi-assurance-vie-ou-direct" />} />
          <Route path="/articles/per-ou-assurance-vie" element={<ArticlePageWrapper slug="per-ou-assurance-vie" />} />
          <Route path="/articles/per-ou-assurance-vie/*" element={<ArticlePageWrapper slug="per-ou-assurance-vie" />} />
          {/* Catch-all */}
          <Route path="*" element={<HomePage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
