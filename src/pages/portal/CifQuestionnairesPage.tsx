import { ArrowLeft, ClipboardList, Eye, Leaf, UserRound } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import ClientRecueilJourneyBase from './ClientRecueilJourneyBase';
import QuestionnairePageBase from './QuestionnairePageBase';

type View = 'recueil' | 'qpi' | 'esg';
const views = [
  { key: 'recueil' as const, label: 'Recueil d’informations', icon: ClipboardList },
  { key: 'qpi' as const, label: 'Profil investisseur', icon: UserRound },
  { key: 'esg' as const, label: 'Questionnaire ESG', icon: Leaf },
];

export default function CifQuestionnairesPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('vue');
  const view: View = requested === 'qpi' || requested === 'esg' ? requested : 'recueil';
  return <div className="min-h-screen bg-white text-[#0b1f3a]">
    <header className="sticky top-0 z-50 border-b border-[#dbe4ef] bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600">Espace cabinet</p><h1 className="text-base font-semibold tracking-tight sm:text-lg">Test du parcours client</h1></div>
        <Link to="/cabinet" className="inline-flex items-center gap-2 rounded-xl border border-[#dbe4ef] bg-white px-3 py-2 text-sm font-semibold text-[#5b6b82] shadow-sm transition hover:border-[#9fb1c7] hover:text-[#0b1f3a]"><ArrowLeft className="h-4 w-4" /> Retour au cabinet</Link>
      </div>
    </header>
    <main className="relative mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950"><Eye className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" /><p><strong>Mode test cabinet :</strong> vous utilisez le même questionnaire qu’un client. Vos réponses de test ne sont enregistrées dans aucun dossier.</p></div>
      <nav aria-label="Choisir le questionnaire" className="mb-6 grid gap-3 sm:grid-cols-3">
        {views.map(({ key, label, icon: Icon }) => <button key={key} type="button" onClick={() => setParams({ vue: key })} className={`flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${view === key ? 'border-[#0b1f3a] bg-[#0b1f3a] text-white shadow-lg shadow-[#0b1f3a]/10' : 'border-[#dbe4ef] bg-white text-[#33465f] hover:border-[#6f8fb4]'}`}><Icon className={`h-5 w-5 shrink-0 ${view === key ? 'text-blue-300' : 'text-blue-600'}`} />{label}</button>)}
      </nav>
      {view === 'recueil' && <ClientRecueilJourneyBase cabinetPreview />}
      {view === 'qpi' && <QuestionnairePageBase mode="QPI" cabinetPreview />}
      {view === 'esg' && <QuestionnairePageBase mode="ESG" cabinetPreview />}
    </main>
  </div>;
}
