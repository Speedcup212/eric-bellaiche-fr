import { ArrowLeft, ClipboardList, Leaf, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ClientRecueilJourneyBase from './ClientRecueilJourneyBase';
import QuestionnairePageBase from './QuestionnairePageBase';
import RecueilValidationGuard from './RecueilValidationGuard';

type View = 'recueil' | 'qpi' | 'esg';

const views = [
  { key: 'recueil' as const, label: 'Recueil d’informations', detail: 'Parcours client complet', icon: ClipboardList },
  { key: 'qpi' as const, label: 'Profil investisseur', detail: 'Questionnaire et résultat', icon: UserRound },
  { key: 'esg' as const, label: 'Questionnaire ESG', detail: 'Préférences de durabilité', icon: Leaf },
];

function ClientPreviewShell({ view, close }: { view: View; close: () => void }) {
  return <div className="min-h-screen bg-white text-[#0b1f3a] transition-colors duration-300">
    <header className="sticky top-0 z-50 border-b border-[#dbe4ef] bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <button type="button" onClick={close} className="text-left">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0b1f3a] text-white shadow-lg shadow-[#0b1f3a]/10"><ShieldCheck className="h-5 w-5" /></span>
            <div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7f8da1]">Cabinet Eric Bellaiche</p><h1 className="text-base font-semibold tracking-tight text-[#0b1f3a] sm:text-lg">Mon dossier patrimonial</h1></div>
          </div>
        </button>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-[#7f8da1] sm:block">Connexion sécurisée</span>
          <button type="button" onClick={close} className="inline-flex items-center gap-2 rounded-xl border border-[#dbe4ef] bg-white px-3 py-2 text-sm font-semibold text-[#5b6b82] shadow-sm transition hover:border-[#9fb1c7] hover:text-[#0b1f3a]"><LogOut className="h-4 w-4" /> Quitter</button>
        </div>
      </div>
    </header>
    <main className="relative mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {view === 'recueil' && <div className="recueil-safe"><RecueilValidationGuard /><ClientRecueilJourneyBase cabinetPreview /></div>}
      {view === 'qpi' && <QuestionnairePageBase mode="QPI" cabinetPreview />}
      {view === 'esg' && <QuestionnairePageBase mode="ESG" cabinetPreview />}
    </main>
  </div>;
}

export default function CifQuestionnairesPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const requested = params.get('vue');
  const view: View | null = requested === 'recueil' || requested === 'qpi' || requested === 'esg' ? requested : null;

  if (view) return <ClientPreviewShell view={view} close={() => setParams({})} />;

  return <div className="min-h-screen bg-[#F6F9FD] text-[#0F172A]">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-5">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Espace cabinet</p><h1 className="mt-1 text-2xl font-semibold">Tester les questionnaires clients</h1></div>
        <button type="button" onClick={() => navigate('/cabinet')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold"><ArrowLeft className="h-4 w-4" /> Retour au cabinet</button>
      </div>
    </header>
    <main className="mx-auto max-w-5xl px-5 py-8">
      <p className="mb-6 text-sm leading-6 text-slate-500">Choisis un parcours. Il s’ouvrira dans une reproduction exacte de l’espace client, sans enregistrer les réponses dans un dossier.</p>
      <div className="grid gap-4 md:grid-cols-3">
        {views.map(({ key, label, detail, icon: Icon }) => <button key={key} type="button" onClick={() => setParams({ vue: key })} className="rounded-[24px] border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-lg">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon className="h-5 w-5" /></span>
          <span className="mt-5 block font-semibold">{label}</span><span className="mt-1 block text-sm text-slate-500">{detail}</span>
        </button>)}
      </div>
    </main>
  </div>;
}
