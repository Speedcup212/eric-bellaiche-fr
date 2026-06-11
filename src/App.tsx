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

const articleSlugs = [
  'conseiller-scpi',
  'audit-patrimonial-en-ligne',
  'scpi-fiscalite',
  'scpi-assurance-vie-ou-direct',
  'per-ou-assurance-vie',
  'scpi-a-credit',
  'scpi-demembrement',
  'scpi-retraite',
  'scpi-revenus-complementaires',
  'scpi-succession-transmission',
  'per-fiscalite',
  'assurance-vie-fiscalite',
  'assurance-vie-apres-70-ans',
  'reduire-impot-sans-risque-excessif',
  'fiscalite-revenus-fonciers',
  'lmnp-ou-location-nue',
  'sci-ir-ou-sci-is',
  'immobilier-locatif-fiscalite',
  'deficit-foncier',
  'investissement-locatif-retraite',
  'conseiller-patrimoine-en-ligne',
  'structurer-son-patrimoine',
  'preparer-retraite-patrimoine',
  'transmission-patrimoine-famille-recomposee',
  'erreurs-gestion-patrimoine',
];

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
          {/* All articles rendered from content layer */}
          {articleSlugs.map((slug) => (
            <Route key={slug} path={`/articles/${slug}`} element={<ArticlePageWrapper slug={slug} />} />
          ))}
          {articleSlugs.map((slug) => (
            <Route key={`${slug}-wildcard`} path={`/articles/${slug}/*`} element={<ArticlePageWrapper slug={slug} />} />
          ))}
          {/* Catch-all */}
          <Route path="*" element={<HomePage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
