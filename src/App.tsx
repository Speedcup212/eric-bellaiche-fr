import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import ConsentBanner from './components/ConsentBanner';
import PortalErrorBoundary from './portal/PortalErrorBoundary';

function lazyWithReload(factory: Parameters<typeof lazy>[0], key: string) {
  return lazy(async () => {
    try {
      const module = await factory();
      sessionStorage.removeItem(`lazy-retry:${key}`);
      return module;
    } catch (error) {
      const retryKey = `lazy-retry:${key}`;
      if (!sessionStorage.getItem(retryKey)) {
        sessionStorage.setItem(retryKey, '1');
        window.location.reload();
        return new Promise<never>(() => {});
      }
      sessionStorage.removeItem(retryKey);
      throw error;
    }
  });
}

function AppLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="rounded-2xl border border-[#dbe4ef] bg-white px-6 py-5 text-center shadow-sm">
        <p className="text-sm font-semibold text-[#0b1f3a]">Ouverture de votre espace sécurisé…</p>
        <p className="mt-1 text-xs text-[#6f8198]">La page se charge. Ne fermez pas cette fenêtre.</p>
      </div>
    </div>
  );
}

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
const ClientLoginPage = lazyWithReload(() => import('./pages/portal/ClientLoginPage'), 'client-login');
const ClientInvitationPage = lazyWithReload(() => import('./pages/portal/ClientInvitationPage'), 'client-invitation');
const PortalShell = lazyWithReload(() => import('./portal/PortalShell'), 'portal-shell');
const ClientDashboardPage = lazyWithReload(() => import('./pages/portal/ClientDashboardPage'), 'client-dashboard');
const ClientDocumentsPage = lazyWithReload(() => import('./pages/portal/ClientDocumentsPage'), 'client-documents');
const ClientRecueilEntryPage = lazyWithReload(() => import('./pages/portal/ClientRecueilEntryPage'), 'client-recueil-entry');
const ClientRecueilPage = lazyWithReload(() => import('./pages/portal/ClientRecueilJourneyPage'), 'client-recueil');
const QuestionnairePage = lazyWithReload(() => import('./pages/portal/QuestionnairePage'), 'client-questionnaire');
const ClientSummaryPage = lazyWithReload(() => import('./pages/portal/ClientSummaryPage'), 'client-summary');
const CifAdminPage = lazyWithReload(() => import('./pages/portal/CifAdminGate'), 'cif-admin');
const CifDossierSummaryPage = lazyWithReload(() => import('./pages/portal/CifDossierSummaryPage'), 'cif-dossier-summary');
const CifAuditPage = lazyWithReload(() => import('./pages/portal/CifAuditPage'), 'cif-audit');
const CifAdequationPage = lazyWithReload(() => import('./pages/portal/CifAdequationPage'), 'cif-adequation');

const articleSlugs = ['conseiller-scpi','audit-patrimonial-en-ligne','scpi-fiscalite','scpi-assurance-vie-ou-direct','per-ou-assurance-vie','scpi-a-credit','scpi-demembrement','scpi-retraite','scpi-revenus-complementaires','scpi-succession-transmission','per-fiscalite','assurance-vie-fiscalite','assurance-vie-apres-70-ans','reduire-impot-sans-risque-excessif','fiscalite-revenus-fonciers','lmnp-ou-location-nue','sci-ir-ou-sci-is','immobilier-locatif-fiscalite','deficit-foncier','investissement-locatif-retraite','conseiller-patrimoine-en-ligne','structurer-son-patrimoine','preparer-retraite-patrimoine','transmission-patrimoine-famille-recomposee','erreurs-gestion-patrimoine'];

function PublicDossierAccess() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/espace-client') || pathname.startsWith('/cabinet')) return null;
  return (
    <Link
      to="/espace-client/connexion"
      aria-label="Reprendre mon dossier patrimonial"
      className="public-dossier-access fixed right-3 top-[62px] z-[100] flex min-h-7 items-center justify-center whitespace-nowrap rounded-md border border-[#C5A059] bg-white/95 px-2 py-1 text-[9px] font-bold uppercase tracking-tight text-[#8A6D2F] shadow-sm backdrop-blur transition hover:bg-[#F7F1E6] sm:right-4 sm:top-3 sm:min-h-0 sm:rounded-lg sm:px-4 sm:py-2 sm:text-xs sm:tracking-wide xl:right-[145px]"
    >
      Mon dossier
    </Link>
  );
}

export default function App() {
  return <BrowserRouter><ConsentBanner /><PublicDossierAccess /><Suspense fallback={<AppLoadingFallback />}><Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/conseil-investissement-grenoble" element={<GrenoblePageWrapper />} /><Route path="/conseil-investissement-montrouge" element={<MontrougePageWrapper />} /><Route path="/conseil-investissement-toulouse" element={<ToulousePageWrapper />} /><Route path="/conseil-investissement-rennes" element={<RennesPageWrapper />} /><Route path="/conseil-investissement-aix-en-provence" element={<AixPageWrapper />} /><Route path="/conseil-investissement-nantes" element={<NantesPageWrapper />} />
    <Route path="/merci" element={<ThankYouPage />} /><Route path="/eric-bellaiche-cgp-cif" element={<CgpCifRedirect />} /><Route path="/eric-bellaiche-cgp-cif/*" element={<CgpCifRedirect />} /><Route path="/conseiller-scpi" element={<ConseillerScpiRedirect />} /><Route path="/conseiller-scpi/*" element={<ConseillerScpiRedirect />} />
    <Route path="/articles" element={<ArticlesHubPage />} />{articleSlugs.map((slug) => <Route key={slug} path={`/articles/${slug}`} element={<ArticlePageWrapper slug={slug} />} />)}{articleSlugs.map((slug) => <Route key={`${slug}-wildcard`} path={`/articles/${slug}/*`} element={<ArticlePageWrapper slug={slug} />} />)}
    <Route path="/espace-client/connexion" element={<PortalErrorBoundary><ClientLoginPage /></PortalErrorBoundary>} /><Route path="/espace-client/invitation" element={<PortalErrorBoundary><ClientInvitationPage /></PortalErrorBoundary>} />
    <Route path="/espace-client" element={<PortalErrorBoundary><PortalShell /></PortalErrorBoundary>}><Route index element={<ClientDashboardPage />} /><Route path="documents" element={<ClientDocumentsPage />} /><Route path="recueil" element={<ClientRecueilEntryPage />} /><Route path="recueil/parcours" element={<ClientRecueilPage />} /><Route path="profil-investisseur" element={<QuestionnairePage mode="QPI" />} /><Route path="esg" element={<QuestionnairePage mode="ESG" />} /><Route path="synthese" element={<ClientSummaryPage />} /></Route>
    <Route path="/cabinet" element={<PortalErrorBoundary><CifAdminPage /></PortalErrorBoundary>} />
    <Route path="/cabinet/synthese" element={<PortalErrorBoundary><CifDossierSummaryPage /></PortalErrorBoundary>} />
    <Route path="/cabinet/audit" element={<PortalErrorBoundary><CifAuditPage /></PortalErrorBoundary>} />
    <Route path="/cabinet/adequation" element={<PortalErrorBoundary><CifAdequationPage /></PortalErrorBoundary>} />
    <Route path="*" element={<HomePage />} />
  </Routes></Suspense></BrowserRouter>;
}