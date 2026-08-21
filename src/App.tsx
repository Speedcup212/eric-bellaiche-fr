import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
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
const ClientLoginPage = lazy(() => import('./pages/portal/ClientLoginPage'));
const ClientInvitationPage = lazy(() => import('./pages/portal/ClientInvitationPage'));
const PortalShell = lazy(() => import('./portal/PortalShell'));
const ClientDashboardPage = lazy(() => import('./pages/portal/ClientDashboardPage'));
const ClientDocumentsPage = lazy(() => import('./pages/portal/ClientDocumentsPage'));
const ClientRecueilPage = lazy(() => import('./pages/portal/ClientRecueilPage'));
const QuestionnairePage = lazy(() => import('./pages/portal/QuestionnairePage'));
const ClientSummaryPage = lazy(() => import('./pages/portal/ClientSummaryPage'));
const CifAdminPage = lazy(() => import('./pages/portal/CifAdminPage'));

const articleSlugs = ['conseiller-scpi','audit-patrimonial-en-ligne','scpi-fiscalite','scpi-assurance-vie-ou-direct','per-ou-assurance-vie','scpi-a-credit','scpi-demembrement','scpi-retraite','scpi-revenus-complementaires','scpi-succession-transmission','per-fiscalite','assurance-vie-fiscalite','assurance-vie-apres-70-ans','reduire-impot-sans-risque-excessif','fiscalite-revenus-fonciers','lmnp-ou-location-nue','sci-ir-ou-sci-is','immobilier-locatif-fiscalite','deficit-foncier','investissement-locatif-retraite','conseiller-patrimoine-en-ligne','structurer-son-patrimoine','preparer-retraite-patrimoine','transmission-patrimoine-famille-recomposee','erreurs-gestion-patrimoine'];

function PublicDossierAccess() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/espace-client') || pathname.startsWith('/cabinet')) return null;

  return (
    <Link
      to="/espace-client/connexion"
      aria-label="Reprendre mon dossier patrimonial"
      className="fixed right-[76px] top-3 z-[100] rounded-lg border border-[#C5A059] bg-white/95 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#8A6D2F] shadow-sm backdrop-blur transition hover:bg-[#F7F1E6] sm:right-4 sm:px-4 sm:py-2 sm:text-xs xl:right-[145px]"
    >
      Mon dossier
    </Link>
  );
}

export default function App() {
  return <BrowserRouter><ConsentBanner /><PublicDossierAccess /><Suspense fallback={<div style={{ minHeight: '100vh', background: '#f8fafc' }} />}><Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/conseil-investissement-grenoble" element={<GrenoblePageWrapper />} /><Route path="/conseil-investissement-montrouge" element={<MontrougePageWrapper />} /><Route path="/conseil-investissement-toulouse" element={<ToulousePageWrapper />} /><Route path="/conseil-investissement-rennes" element={<RennesPageWrapper />} /><Route path="/conseil-investissement-aix-en-provence" element={<AixPageWrapper />} /><Route path="/conseil-investissement-nantes" element={<NantesPageWrapper />} />
    <Route path="/merci" element={<ThankYouPage />} /><Route path="/eric-bellaiche-cgp-cif" element={<CgpCifRedirect />} /><Route path="/eric-bellaiche-cgp-cif/*" element={<CgpCifRedirect />} /><Route path="/conseiller-scpi" element={<ConseillerScpiRedirect />} /><Route path="/conseiller-scpi/*" element={<ConseillerScpiRedirect />} />
    <Route path="/articles" element={<ArticlesHubPage />} />{articleSlugs.map((slug) => <Route key={slug} path={`/articles/${slug}`} element={<ArticlePageWrapper slug={slug} />} />)}{articleSlugs.map((slug) => <Route key={`${slug}-wildcard`} path={`/articles/${slug}/*`} element={<ArticlePageWrapper slug={slug} />} />)}
    <Route path="/espace-client/connexion" element={<ClientLoginPage />} /><Route path="/espace-client/invitation" element={<ClientInvitationPage />} />
    <Route path="/espace-client" element={<PortalShell />}><Route index element={<ClientDashboardPage />} /><Route path="documents" element={<ClientDocumentsPage />} /><Route path="recueil" element={<ClientRecueilPage />} /><Route path="profil-investisseur" element={<QuestionnairePage mode="QPI" />} /><Route path="esg" element={<QuestionnairePage mode="ESG" />} /><Route path="synthese" element={<ClientSummaryPage />} /></Route>
    <Route path="/cabinet" element={<CifAdminPage />} />
    <Route path="*" element={<HomePage />} />
  </Routes></Suspense></BrowserRouter>;
}
