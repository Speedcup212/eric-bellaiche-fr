import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardList, Leaf, Loader2, UserRound } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { messageFromError } from '../../portal/portalHelpers';

type View = 'recueil' | 'qpi' | 'esg';
type OptionRow = { id: string; libelle: string; ordre: number };
type QuestionRow = { id: string; libelle: string; ordre: number; obligatoire: boolean; questionnaire_options?: OptionRow[] };

const recueilSections = [
  ['Identité', 'Coordonnées et informations personnelles'],
  ['Famille', 'Situation familiale et organisation du foyer'],
  ['Profession', 'Activité et situation professionnelle'],
  ['Revenus', 'Revenus, charges et capacité d’épargne'],
  ['Fiscalité', 'Avis d’imposition et données fiscales'],
  ['Immobilier', 'Biens détenus et projets immobiliers'],
  ['Financier', 'Liquidités, épargne et placements'],
  ['Crédits', 'Emprunts immobiliers et crédits en cours'],
  ['Objectifs', 'Priorités, horizons et autres projets à connaître'],
  ['Réglementaire', 'Origine des fonds et informations de conformité'],
];

const viewMeta = {
  recueil: { label: 'Recueil d’informations', icon: ClipboardList },
  qpi: { label: 'Profil investisseur', icon: UserRound },
  esg: { label: 'Questionnaire ESG', icon: Leaf },
};

export default function CifQuestionnairesPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('vue');
  const view: View = requested === 'qpi' || requested === 'esg' ? requested : 'recueil';
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (view === 'recueil') { setQuestions([]); setLoading(false); return; }
    let active = true;
    setLoading(true);
    setErrorMessage('');
    void (async () => {
      const { data: template, error: templateError } = await supabase
        .from('questionnaire_templates')
        .select('id')
        .eq('type_questionnaire', view === 'qpi' ? 'QPI' : 'ESG')
        .eq('actif', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (templateError) throw templateError;
      if (!template?.id) throw new Error('Aucun questionnaire actif trouvé.');
      const { data, error } = await supabase
        .from('questionnaire_questions')
        .select('id,libelle,ordre,obligatoire,questionnaire_options(id,libelle,ordre)')
        .eq('template_id', template.id)
        .order('ordre');
      if (error) throw error;
      if (active) setQuestions((data ?? []) as unknown as QuestionRow[]);
    })().catch((error) => { if (active) setErrorMessage(messageFromError(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [view]);

  return <div className="min-h-screen bg-[#F6F9FD] text-[#0F172A]">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Espace cabinet</p><h1 className="mt-1 text-2xl font-semibold">Questionnaires</h1></div>
        <Link to="/cabinet" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold"><ArrowLeft className="h-4 w-4"/> Retour au cabinet</Link>
      </div>
    </header>
    <main className="mx-auto max-w-6xl px-5 py-8">
      <div className="grid gap-3 md:grid-cols-3">
        {(Object.keys(viewMeta) as View[]).map((key) => { const Icon = viewMeta[key].icon; const active = view === key; return <button key={key} type="button" onClick={() => setParams({ vue: key })} className={`flex items-center gap-4 rounded-2xl border p-5 text-left transition ${active ? 'border-blue-500 bg-[#0B172A] text-white shadow-lg' : 'border-slate-200 bg-white hover:border-blue-300'}`}><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${active ? 'bg-white/10' : 'bg-blue-50 text-blue-600'}`}><Icon className="h-5 w-5"/></span><span className="font-semibold">{viewMeta[key].label}</span></button> })}
      </div>

      <section className="mt-7 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-6">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Aperçu direct</p><h2 className="mt-2 text-2xl font-semibold">{viewMeta[view].label}</h2><p className="mt-2 text-sm text-slate-500">La version actuellement utilisée dans le parcours client.</p></div>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">Version active</span>
        </div>

        {view === 'recueil' && <div className="mt-6 grid gap-3 sm:grid-cols-2">{recueilSections.map(([title, detail], index) => <div key={title} className="flex gap-4 rounded-2xl border border-slate-200 p-5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B172A] text-sm font-bold text-white">{index + 1}</span><div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{detail}</p></div></div>)}</div>}
        {view !== 'recueil' && loading && <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin"/> Chargement du questionnaire actif…</div>}
        {errorMessage && <p className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>}
        {view !== 'recueil' && !loading && !errorMessage && <div className="mt-6 space-y-4">{questions.map((question) => <article key={question.id} className="rounded-2xl border border-slate-200 p-5"><div className="flex items-start gap-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B172A] text-sm font-bold text-white">{question.ordre}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-4"><h3 className="font-semibold leading-6">{question.libelle}</h3>{question.obligatoire && <span title="Réponse obligatoire"><CheckCircle2 className="h-4 w-4 text-blue-600"/></span>}</div>{Boolean(question.questionnaire_options?.length) && <div className="mt-4 flex flex-wrap gap-2">{[...(question.questionnaire_options ?? [])].sort((a,b) => a.ordre - b.ordre).map((option) => <span key={option.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{option.libelle}</span>)}</div>}</div></div></article>)}</div>}
      </section>
    </main>
  </div>;
}
