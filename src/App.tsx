import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
          <Route path="*" element={<HomePage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
