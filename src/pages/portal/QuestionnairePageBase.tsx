import { useEffect, useMemo, useState } from 'react';
import { BrainCircuit, CheckCircle2, Leaf, Pencil } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChoiceButton, JourneyProgress, PageIntro, QuestionHeader, SecureNote, WizardCard, WizardFooter } from '../../portal/FintechJourney';
import { supabase } from '../../lib/supabase';
import { dossierHref, fetchPortalProgress, messageFromError, nextStepHref, selectedProgress, type PortalProgress } from '../../portal/portalHelpers';

type Mode = 'QPI' | 'ESG';
interface OptionRow { id: string; code: string; libelle: string; ordre: number; metadata?: { exclusive?: boolean; value_pct?: number } | null; }
interface QuestionRow { id: string; code: string; libelle: string; ordre: number; type_reponse: string; obligatoire: boolean; metadata: Record<string, unknown>; options?: OptionRow[]; }
interface AnswerRow { question_id: string; option_id: string | null; answer_text: string | null; answer_numeric: number | null; answer_json: unknown; }
type ExpState = { connaissance: '' | 'true' | 'false'; sources: string[]; precision: string; anciennete: string; montant: string; mode: string };

const experienceFamilies = [
  ['liquidites', 'Livrets, dépôts et fonds euros'], ['obligations', 'Obligations'], ['actions', 'Actions, OPC et ETF'], ['diversifies', 'Fonds diversifiés / multi-actifs'], ['immobilier_papier', 'SCPI, OPCI et fonds immobiliers'], ['av_per', 'Assurance-vie, capitalisation et PER'], ['structures', 'Produits structurés'], ['non_cote', 'Non coté, private equity, FIP, FCPI, FCPR'], ['fia', 'FIA et fonds spécialisés'], ['derives', 'Produits à effet de levier et dérivés'],
] as const;
const experienceLevels = [['jamais', 'Jamais utilisé'], ['deja_detenu', 'Déjà détenu'], ['plusieurs_operations', 'Plusieurs opérations'], ['pratique_reguliere', 'Pratique régulière']] as const;
const knowledgeSources = [['formation', 'Formation financière ou patrimoniale'], ['profession', 'Expérience professionnelle liée à la finance'], ['lecture', 'Lecture / autoformation régulière'], ['autre', 'Autre source de connaissance']] as const;
const seniorityOptions = [['aucune', 'Aucune expérience'], ['moins_2_ans', 'Moins de 2 ans'], ['2_5_ans', '2 à 5 ans'], ['5_10_ans', '5 à 10 ans'], ['plus_10_ans', 'Plus de 10 ans']] as const;
const amountOptions = [['moins_10k', 'Moins de 10 000 €'], ['10_50k', '10 000 à 50 000 €'], ['50_100k', '50 000 à 100 000 €'], ['plus_100k', 'Plus de 100 000 €']] as const;
const managementOptions = [['accompagne_conseille', 'Principalement accompagné / conseillé'], ['gestion_libre', 'Principalement en gestion libre'], ['gestion_sous_mandat', 'Principalement sous mandat'], ['mixte', 'Mixte selon les placements']] as const;

function visible(question: QuestionRow, selectedCodes: Record<string, string>): boolean {
  const showIf = question.metadata?.show_if as { question?: string; equals?: string } | undefined;
  return !showIf?.question || selectedCodes[showIf.question] === showIf.equals;
}

function answerObject(answer?: AnswerRow): Record<string, unknown> {
  return answer?.answer_json && !Array.isArray(answer.answer_json) && typeof answer.answer_json === 'object' ? answer.answer_json as Record<string, unknown> : {};
}

function questionExplanation(mode: Mode, question: QuestionRow): string {
  if (mode === 'ESG') return 'Choisissez la réponse qui traduit le mieux vos préférences. Elle servira à vérifier la compatibilité des solutions étudiées avec vos critères de durabilité.';
  if (question.code === 'Q1') return 'Sélectionnez un ou plusieurs objectifs correspondant à votre situation patrimoniale. Vous pouvez également ajouter une note pour préciser votre démarche.';
  if (question.ordre <= 12) return 'Répondez selon votre situation réelle et votre propre appréciation. Cette réponse contribue à l’analyse de votre horizon, de vos besoins de liquidité et de votre capacité de perte.';
  if (question.ordre <= 20) return 'Cette question porte sur vos connaissances financières. Répondez sans assistance afin que le cabinet puisse apprécier correctement votre niveau de compréhension.';
  return 'Choisissez la réaction qui vous correspond le mieux. Ces questions évaluent votre tolérance comportementale aux fluctuations et au risque de perte.';
}

export default function QuestionnairePage({ mode }: { mode: Mode }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [progressRows, setProgressRows] = useState<PortalProgress[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerRow>>({});
  const [multi, setMulti] = useState<Record<string, string[]>>({});
  const [experiences, setExperiences] = useState<Record<string, string>>({});
  const [expDetails, setExpDetails] = useState<ExpState>({ connaissance: '', sources: [], precision: '', anciennete: '', montant: '', mode: '' });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [done, setDone] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const dossierId = searchParams.get('dossier');
  const progress = useMemo(() => selectedProgress(progressRows, dossierId), [progressRows, dossierId]);
  const sessionId = mode === 'QPI' ? progress?.qpi_session_id : progress?.esg_session_id;

  useEffect(() => {
    void fetchPortalProgress().then(async (rows) => {
      setProgressRows(rows);
      const row = selectedProgress(rows, dossierId);
      if (!row) return;
      if (mode === 'QPI' && !row.qpi_session_id) throw new Error('Le questionnaire investisseur n’est pas encore disponible. Terminez d’abord les étapes précédentes.');
      if (mode === 'ESG' && !row.esg_session_id) throw new Error(row.esg_opt_in ? 'Le questionnaire de durabilité sera disponible après validation du profil investisseur.' : 'Vous avez choisi de ne pas exprimer de préférences de durabilité.');
      const id = mode === 'QPI' ? row.qpi_session_id! : row.esg_session_id!;
      const { error: startError } = await supabase.rpc('start_questionnaire_session', { p_session_id: id });
      if (startError) throw startError;
      const { data: session, error: sessionError } = await supabase.from('questionnaire_sessions').select('template_id,statut').eq('id', id).single();
      if (sessionError) throw sessionError;
      setDone(['completed', 'validated'].includes(session.statut));
      const { data: qData, error: qError } = await supabase.from('questionnaire_questions').select('id,code,libelle,ordre,type_reponse,obligatoire,metadata,questionnaire_options(id,code,libelle,ordre,metadata)').eq('template_id', session.template_id).order('ordre');
      if (qError) throw qError;
      const normalized = (qData ?? []).map((q) => ({ ...q, options: [...(q.questionnaire_options ?? [])].sort((a, b) => a.ordre - b.ordre) })) as unknown as QuestionRow[];
      setQuestions(normalized);
      const { data: aData, error: aError } = await supabase.from('questionnaire_answers').select('question_id,option_id,answer_text,answer_numeric,answer_json').eq('session_id', id);
      if (aError) throw aError;
      const answerMap: Record<string, AnswerRow> = {};
      const multiMap: Record<string, string[]> = {};
      for (const answer of (aData ?? []) as AnswerRow[]) {
        answerMap[answer.question_id] = answer;
        if (Array.isArray(answer.answer_json)) multiMap[answer.question_id] = answer.answer_json as string[];
      }
      setAnswers(answerMap);
      setMulti(multiMap);
      if (mode === 'QPI') {
        const [{ data: expRows, error: expError }, { data: details, error: detailsError }] = await Promise.all([
          supabase.from('qpi_product_experience').select('famille_produit,niveau_experience').eq('session_id', id),
          supabase.from('qpi_experience_details').select('*').eq('session_id', id).maybeSingle(),
        ]);
        if (expError) throw expError;
        if (detailsError) throw detailsError;
        const map: Record<string, string> = {};
        for (const rowExp of expRows ?? []) map[rowExp.famille_produit] = rowExp.niveau_experience;
        setExperiences(map);
        if (details) setExpDetails({ connaissance: details.connaissance_par_formation_ou_profession === true ? 'true' : details.connaissance_par_formation_ou_profession === false ? 'false' : '', sources: details.sources_pertinentes ?? [], precision: details.precisions_formation_profession ?? '', anciennete: details.anciennete_experience ?? '', montant: details.montant_habituel_operation ?? '', mode: details.mode_gestion ?? '' });
      }
    }).catch((error) => setErrorMessage(messageFromError(error)));
  }, [dossierId, mode]);

  const optionCodeByQuestion = useMemo(() => {
    const result: Record<string, string> = {};
    for (const q of questions) {
      const selected = q.options?.find((option) => option.id === answers[q.id]?.option_id);
      if (selected) result[q.code] = selected.code;
    }
    return result;
  }, [answers, questions]);
  const visibleQuestions = useMemo(() => questions.filter((q) => visible(q, optionCodeByQuestion)), [questions, optionCodeByQuestion]);
  const extraQpiSteps = mode === 'QPI' ? experienceFamilies.length + 4 : 0;
  const totalSteps = visibleQuestions.length + extraQpiSteps;
  useEffect(() => { if (totalSteps > 0 && currentIndex > totalSteps - 1) setCurrentIndex(totalSteps - 1); }, [currentIndex, totalSteps]);

  const upsertQuestionAnswer = async (question: QuestionRow, patch: Partial<AnswerRow>) => {
    if (!sessionId || done) return;
    const current = answers[question.id] ?? { question_id: question.id, option_id: null, answer_text: null, answer_numeric: null, answer_json: null };
    const next: AnswerRow = { ...current, ...patch, question_id: question.id };
    setAnswers((state) => ({ ...state, [question.id]: next }));
    const { data, error } = await supabase.from('questionnaire_answers').upsert({ session_id: sessionId, question_id: question.id, option_id: next.option_id, answer_text: next.answer_text, answer_numeric: next.answer_numeric, answer_json: next.answer_json }, { onConflict: 'session_id,question_id' }).select('question_id,option_id,answer_text,answer_numeric,answer_json').single();
    if (error) throw error;
    setAnswers((state) => ({ ...state, [question.id]: data as AnswerRow }));
  };

  const updateLocal = (question: QuestionRow, patch: Partial<AnswerRow>) => setAnswers((state) => ({ ...state, [question.id]: { ...(state[question.id] ?? { question_id: question.id, option_id: null, answer_text: null, answer_numeric: null, answer_json: null }), ...patch } }));

  const saveMulti = async (question: QuestionRow, option: OptionRow) => {
    if (!sessionId || done) return;
    const current = multi[question.id] ?? [];
    const exclusive = Boolean(option.metadata?.exclusive);
    const next = exclusive ? [option.code] : current.includes(option.code) ? current.filter((value) => value !== option.code) : [...current.filter((code) => code !== 'AUCUNE'), option.code];
    setMulti((state) => ({ ...state, [question.id]: next }));
    await upsertQuestionAnswer(question, { option_id: null, answer_json: next });
  };

  const saveExperience = async (family: string, level: string) => {
    if (!sessionId || done) return;
    const { error } = await supabase.from('qpi_product_experience').upsert({ session_id: sessionId, famille_produit: family, niveau_experience: level }, { onConflict: 'session_id,famille_produit' });
    if (error) throw error;
    setExperiences((state) => ({ ...state, [family]: level }));
  };

  const saveExperienceDetails = async (state: ExpState = expDetails) => {
    if (!sessionId || done) return;
    const knowledge = state.connaissance === 'true' ? true : state.connaissance === 'false' ? false : null;
    const { error } = await supabase.from('qpi_experience_details').upsert({ session_id: sessionId, connaissance_par_formation_ou_profession: knowledge, sources_pertinentes: state.sources, precisions_formation_profession: state.precision.trim() || null, anciennete_experience: state.anciennete || null, montant_habituel_operation: state.montant || null, mode_gestion: state.mode || null }, { onConflict: 'session_id' });
    if (error) throw error;
  };

  const currentQuestion = currentIndex < visibleQuestions.length ? visibleQuestions[currentIndex] : null;
  const extraIndex = currentIndex - visibleQuestions.length;
  const familyStep = mode === 'QPI' && extraIndex >= 0 && extraIndex < experienceFamilies.length ? experienceFamilies[extraIndex] : null;
  const detailStep = mode === 'QPI' && extraIndex >= experienceFamilies.length ? extraIndex - experienceFamilies.length : -1;

  const questionComplete = (question: QuestionRow): boolean => {
    const answer = answers[question.id];
    if (question.type_reponse === 'single') {
      if (!answer?.option_id) return false;
      const selected = question.options?.find((option) => option.id === answer.option_id);
      if (question.code === 'ESG_SCOPE' && selected?.code === 'AUTRE') return Boolean(answer.answer_text?.trim());
      if ((question.code === 'ESG_TAX_MIN' || question.code === 'ESG_SFDR_MIN') && selected?.code === 'AUTRE') return answer.answer_numeric !== null && answer.answer_numeric !== undefined && answer.answer_numeric >= 0 && answer.answer_numeric <= 100;
      return true;
    }
    if (question.type_reponse === 'multiple') {
      const values = multi[question.id] ?? [];
      if (question.obligatoire || question.code === 'ESG_PAI_PRIORITIES' || question.code === 'ESG_PAI_MODALITIES') return values.length > 0;
      return true;
    }
    if (question.type_reponse === 'text') return !question.obligatoire || Boolean(answer?.answer_text?.trim());
    return true;
  };

  const currentComplete = currentQuestion ? questionComplete(currentQuestion) : familyStep ? Boolean(experiences[familyStep[0]]) : detailStep === 0 ? expDetails.connaissance === 'false' || (expDetails.connaissance === 'true' && (expDetails.sources.length > 0 || Boolean(expDetails.precision.trim()))) : detailStep === 1 ? Boolean(expDetails.anciennete) : detailStep === 2 ? Boolean(expDetails.montant) : detailStep === 3 ? Boolean(expDetails.mode) : false;

  const stepCompleteAt = (index: number): boolean => {
    if (index < visibleQuestions.length) return questionComplete(visibleQuestions[index]);
    const extra = index - visibleQuestions.length;
    if (mode !== 'QPI') return true;
    if (extra >= 0 && extra < experienceFamilies.length) return Boolean(experiences[experienceFamilies[extra][0]]);
    const detail = extra - experienceFamilies.length;
    if (detail === 0) return expDetails.connaissance === 'false' || (expDetails.connaissance === 'true' && (expDetails.sources.length > 0 || Boolean(expDetails.precision.trim())));
    if (detail === 1) return Boolean(expDetails.anciennete);
    if (detail === 2) return Boolean(expDetails.montant);
    if (detail === 3) return Boolean(expDetails.mode);
    return true;
  };

  const stepLabelAt = (index: number): string => {
    if (index < visibleQuestions.length) {
      const question = visibleQuestions[index];
      return `${question.code} · ${question.libelle}`;
    }
    const extra = index - visibleQuestions.length;
    if (extra >= 0 && extra < experienceFamilies.length) return `Expérience · ${experienceFamilies[extra][1]}`;
    const detailLabels = ['Origine des connaissances financières', 'Ancienneté de votre expérience', 'Montant habituel de vos opérations', 'Mode de gestion habituel'];
    return detailLabels[extra - experienceFamilies.length] ?? `Élément ${index + 1}`;
  };

  const incompleteSteps = Array.from({ length: totalSteps }, (_, index) => index).filter((index) => !stepCompleteAt(index));
  const persistCurrentQuestion = async () => { if (!currentQuestion) return; const answer = answers[currentQuestion.id]; if (answer) await upsertQuestionAnswer(currentQuestion, answer); };

  const finish = async () => {
    if (!sessionId || !progress) return;
    if (mode === 'QPI') await saveExperienceDetails();
    const { error } = await supabase.rpc('complete_questionnaire_session', { p_session_id: sessionId });
    if (error) throw error;
    setDone(true);
    const refreshed = await fetchPortalProgress();
    setProgressRows(refreshed);
    const nextProgress = selectedProgress(refreshed, progress.dossier_id);
    if (nextProgress) navigate(nextStepHref(nextProgress));
    else navigate('/espace-client');
  };

  const next = async () => {
    if (!currentComplete) { setErrorMessage('Sélectionnez au moins une réponse pour continuer.'); return; }
    setBusy(true);
    setErrorMessage('');
    try {
      await persistCurrentQuestion();
      if (detailStep >= 0) await saveExperienceDetails();
      if (currentIndex < totalSteps - 1) {
        setCurrentIndex((index) => index + 1);
        setNoteOpen(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setValidationAttempted(true);
        if (incompleteSteps.length > 0) {
          setCurrentIndex(incompleteSteps[0]);
          setErrorMessage(`${incompleteSteps.length} élément${incompleteSteps.length > 1 ? 's restent' : ' reste'} à compléter avant la validation.`);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        await finish();
      }
    } catch (error) {
      if (currentIndex === totalSteps - 1) setValidationAttempted(true);
      setErrorMessage(messageFromError(error));
    } finally {
      setBusy(false);
    }
  };

  const previous = () => {
    if (!progress) return;
    setErrorMessage('');
    setNoteOpen(false);
    if (currentIndex > 0) {
      setCurrentIndex((index) => index - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else navigate(dossierHref(mode === 'QPI' ? '/espace-client/recueil' : '/espace-client/profil-investisseur', progress.dossier_id));
  };

  if (!progress) return <p className="text-sm text-slate-500">Chargement du questionnaire…</p>;

  if (done) {
    const nextPath = nextStepHref(progress);
    return <div><JourneyProgress current={mode === 'QPI' ? 'qpi' : 'esg'} esgEnabled={progress.esg_opt_in !== false} /><PageIntro eyebrow={mode === 'QPI' ? 'Étape 2' : 'Étape 3'} title={mode === 'QPI' ? 'Profil investisseur' : 'Préférences de durabilité'} description="Cette étape a déjà été validée. Les réponses sont figées afin de préserver la traçabilité du dossier." icon={<CheckCircle2 className="h-5 w-5" />} /><WizardCard className="p-8"><div className="rounded-2xl bg-emerald-50 p-5 text-emerald-800"><p className="font-semibold">Étape terminée</p><p className="mt-1 text-sm leading-6">Vous pouvez poursuivre votre parcours.</p></div><button type="button" onClick={() => navigate(nextPath)} className="mt-6 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Continuer</button></WizardCard></div>;
  }

  const introTitle = mode === 'QPI' ? 'Votre profil investisseur' : 'Vos préférences de durabilité';
  const introDescription = mode === 'QPI' ? 'Le questionnaire s’affiche une question à la fois. Vos réponses permettent d’évaluer votre situation, vos connaissances, votre expérience, votre capacité de perte et votre tolérance au risque.' : 'Le questionnaire s’affiche une question à la fois. Il ne produit pas de score ESG : il enregistre précisément les préférences que le cabinet devra prendre en compte.';
  let cardTitle = '';
  let cardDescription = '';
  let cardLabel = `Question ${currentIndex + 1} sur ${totalSteps}`;
  if (currentQuestion) {
    cardTitle = currentQuestion.libelle;
    cardDescription = questionExplanation(mode, currentQuestion);
    cardLabel = currentQuestion.code.startsWith('Q') ? `${currentQuestion.code} · ${currentIndex + 1}/${totalSteps}` : `Question ${currentIndex + 1} sur ${totalSteps}`;
  } else if (familyStep) {
    cardTitle = `Quelle est votre expérience avec : ${familyStep[1]} ?`;
    cardDescription = 'Indiquez votre niveau de pratique réel. Cette information permet de vérifier que les produits étudiés restent adaptés à votre expérience.';
    cardLabel = `Expérience · ${currentIndex + 1}/${totalSteps}`;
  } else if (detailStep === 0) {
    cardTitle = 'Avez-vous acquis des connaissances financières par votre formation ou votre profession ?';
    cardDescription = 'Précisez l’origine de ces connaissances. Le cabinet utilise cette information pour apprécier votre compréhension des mécanismes et risques financiers.';
    cardLabel = `Expérience générale · ${currentIndex + 1}/${totalSteps}`;
  } else if (detailStep === 1) {
    cardTitle = 'Depuis combien de temps investissez-vous sur des produits financiers ?';
    cardDescription = 'Indiquez l’ancienneté qui correspond le mieux à votre expérience personnelle.';
    cardLabel = `Expérience générale · ${currentIndex + 1}/${totalSteps}`;
  } else if (detailStep === 2) {
    cardTitle = 'Quel est le montant habituel de vos opérations d’investissement ?';
    cardDescription = 'Sélectionnez l’ordre de grandeur le plus représentatif de vos opérations habituelles.';
    cardLabel = `Expérience générale · ${currentIndex + 1}/${totalSteps}`;
  } else if (detailStep === 3) {
    cardTitle = 'Comment gérez-vous habituellement vos placements ?';
    cardDescription = 'Choisissez le mode de gestion qui correspond le mieux à vos habitudes d’investissement.';
    cardLabel = `Expérience générale · ${currentIndex + 1}/${totalSteps}`;
  }

  const objectiveNoteVisible = currentQuestion?.code === 'Q1' && (noteOpen || Boolean(answers[currentQuestion.id]?.answer_text));

  return <div>
    <JourneyProgress current={mode === 'QPI' ? 'qpi' : 'esg'} esgEnabled={progress.esg_opt_in !== false} />
    <PageIntro eyebrow={mode === 'QPI' ? 'Étape 2' : 'Étape 3'} title={introTitle} description={introDescription} icon={mode === 'QPI' ? <BrainCircuit className="h-5 w-5" /> : <Leaf className="h-5 w-5" />} />
    <WizardCard>
      <QuestionHeader current={currentIndex + 1} total={totalSteps} label={cardLabel} title={cardTitle} description={cardDescription} />
      <div className="px-6 py-7 sm:px-9 sm:py-9">
        {currentQuestion?.type_reponse === 'single' && <div className="grid gap-3">{currentQuestion.options?.map((option) => <ChoiceButton key={option.id} selected={answers[currentQuestion.id]?.option_id === option.id} onClick={() => void upsertQuestionAnswer(currentQuestion, { option_id: option.id }).catch((error) => setErrorMessage(messageFromError(error)))}>{option.libelle}</ChoiceButton>)}</div>}

        {currentQuestion?.type_reponse === 'multiple' && <div className="grid gap-3 sm:grid-cols-2">{currentQuestion.options?.map((option) => {
          const selected = (multi[currentQuestion.id] ?? []).includes(option.code);
          return <button type="button" key={option.id} onClick={() => void saveMulti(currentQuestion, option).catch((error) => setErrorMessage(messageFromError(error)))} className={`flex items-start gap-3 rounded-2xl border p-4 text-left text-sm leading-6 transition ${selected ? 'border-[#0b1f3a] bg-[#0b1f3a] text-white shadow-lg shadow-[#0b1f3a]/10' : 'border-[#dbe4ef] bg-white text-[#33465f] hover:-translate-y-0.5 hover:border-[#6f8fb4] hover:shadow-sm'}`}><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected ? 'border-white/30 bg-white text-[#0b1f3a]' : 'border-[#b8c5d5]'}`}>{selected ? '✓' : ''}</span>{option.libelle}</button>;
        })}</div>}

        {currentQuestion?.code === 'Q1' && <div className="mt-5 border-t border-[#e7edf5] pt-5">
          <button type="button" onClick={() => setNoteOpen((open) => !open)} className="inline-flex items-center gap-2 rounded-xl border border-[#dbe4ef] bg-[#f7f9fc] px-4 py-2.5 text-sm font-semibold text-[#173967] transition hover:border-[#9eb2c9] hover:bg-white">
            <Pencil className="h-4 w-4" /> {objectiveNoteVisible ? 'Masquer la note' : 'Ajouter une note'}
          </button>
          {objectiveNoteVisible && <div className="mt-4">
            <label className="block text-sm font-semibold text-[#33465f]">Note / précisions <span className="font-normal text-[#7f8da1]">— facultatif</span>
              <textarea value={answers[currentQuestion.id]?.answer_text ?? ''} onChange={(event) => updateLocal(currentQuestion, { answer_text: event.target.value })} onBlur={() => void persistCurrentQuestion().catch((error) => setErrorMessage(messageFromError(error)))} rows={4} className="mt-2 w-full resize-none rounded-2xl border border-[#dbe4ef] bg-[#f7f9fc] px-4 py-3.5 text-sm leading-6 outline-none transition focus:border-[#6f8fb4] focus:bg-white" placeholder="Ex. : priorité donnée à la préparation de la retraite, projet immobilier à moyen terme, transmission familiale…" />
            </label>
          </div>}
        </div>}

        {currentQuestion?.type_reponse === 'text' && <textarea value={answers[currentQuestion.id]?.answer_text ?? ''} onChange={(e) => updateLocal(currentQuestion, { answer_text: e.target.value })} rows={5} className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 outline-none focus:border-slate-400 focus:bg-white" placeholder="Ajoutez vos précisions ici…" />}

        {currentQuestion?.code === 'Q4' && answers[currentQuestion.id]?.option_id && <div className="mt-6 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Montant estimé du besoin (€)<input type="number" min="0" value={String(answerObject(answers[currentQuestion.id]).montant_besoin_futur ?? '')} onChange={(e) => updateLocal(currentQuestion, { answer_json: { ...answerObject(answers[currentQuestion.id]), montant_besoin_futur: e.target.value ? Number(e.target.value) : null } })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400 focus:bg-white" /></label><label className="text-sm font-semibold text-slate-700">Échéance envisagée<input type="date" value={String(answerObject(answers[currentQuestion.id]).echeance ?? '')} onChange={(e) => updateLocal(currentQuestion, { answer_json: { ...answerObject(answers[currentQuestion.id]), echeance: e.target.value || null } })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400 focus:bg-white" /></label></div>}
        {currentQuestion?.code === 'Q5' && answers[currentQuestion.id]?.option_id && <div className="mt-6 border-t border-slate-100 pt-6"><label className="block max-w-sm text-sm font-semibold text-slate-700">Montant de l’investissement envisagé (€)<input type="number" min="0" value={String(answerObject(answers[currentQuestion.id]).montant_investissement_envisage ?? '')} onChange={(e) => updateLocal(currentQuestion, { answer_json: { ...answerObject(answers[currentQuestion.id]), montant_investissement_envisage: e.target.value ? Number(e.target.value) : null } })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400 focus:bg-white" /></label></div>}
        {currentQuestion?.code === 'Q10' && answers[currentQuestion.id]?.option_id && <div className="mt-6 border-t border-slate-100 pt-6"><label className="block max-w-md text-sm font-semibold text-slate-700">Montant maximum de perte estimé (€) <span className="font-normal text-slate-400">— facultatif</span><input type="number" min="0" value={String(answerObject(answers[currentQuestion.id]).perte_max_declairee_montant ?? '')} onChange={(e) => updateLocal(currentQuestion, { answer_json: { ...answerObject(answers[currentQuestion.id]), perte_max_declairee_montant: e.target.value ? Number(e.target.value) : null } })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400 focus:bg-white" /></label></div>}
        {currentQuestion?.code === 'ESG_SCOPE' && currentQuestion.options?.find((option) => option.id === answers[currentQuestion.id]?.option_id)?.code === 'AUTRE' && <div className="mt-6 border-t border-slate-100 pt-6"><label className="block text-sm font-semibold text-slate-700">Précisez le périmètre souhaité<input value={answers[currentQuestion.id]?.answer_text ?? ''} onChange={(e) => updateLocal(currentQuestion, { answer_text: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400 focus:bg-white" /></label></div>}
        {(currentQuestion?.code === 'ESG_TAX_MIN' || currentQuestion?.code === 'ESG_SFDR_MIN') && currentQuestion.options?.find((option) => option.id === answers[currentQuestion.id]?.option_id)?.code === 'AUTRE' && <div className="mt-6 border-t border-slate-100 pt-6"><label className="block max-w-sm text-sm font-semibold text-slate-700">Pourcentage minimum souhaité<input type="number" min="0" max="100" value={answers[currentQuestion.id]?.answer_numeric ?? ''} onChange={(e) => updateLocal(currentQuestion, { answer_numeric: e.target.value ? Number(e.target.value) : null })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400 focus:bg-white" /></label></div>}

        {familyStep && <div className="grid gap-3">{experienceLevels.map(([value, label]) => <ChoiceButton key={value} selected={experiences[familyStep[0]] === value} onClick={() => void saveExperience(familyStep[0], value)}>{label}</ChoiceButton>)}</div>}
        {detailStep === 0 && <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2"><ChoiceButton selected={expDetails.connaissance === 'true'} onClick={() => { const nextState = { ...expDetails, connaissance: 'true' as const }; setExpDetails(nextState); void saveExperienceDetails(nextState); }}>Oui</ChoiceButton><ChoiceButton selected={expDetails.connaissance === 'false'} onClick={() => { const nextState = { ...expDetails, connaissance: 'false' as const, sources: [], precision: '' }; setExpDetails(nextState); void saveExperienceDetails(nextState); }}>Non</ChoiceButton></div>{expDetails.connaissance === 'true' && <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5"><p className="font-semibold text-slate-800">Origine de vos connaissances</p><p className="mt-1 text-sm leading-6 text-slate-500">Sélectionnez au moins une source ou précisez-la librement.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{knowledgeSources.map(([code, label]) => { const selected = expDetails.sources.includes(code); return <button key={code} type="button" onClick={() => setExpDetails((state) => ({ ...state, sources: selected ? state.sources.filter((value) => value !== code) : [...state.sources, code] }))} className={`rounded-xl border px-4 py-3 text-left text-sm ${selected ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white'}`}>{selected ? '✓ ' : ''}{label}</button>; })}</div><textarea value={expDetails.precision} onChange={(e) => setExpDetails((state) => ({ ...state, precision: e.target.value }))} rows={3} className="mt-4 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="Précision facultative…" /></div>}</div>}
        {detailStep === 1 && <div className="grid gap-3">{seniorityOptions.map(([value, label]) => <ChoiceButton key={value} selected={expDetails.anciennete === value} onClick={() => { const nextState = { ...expDetails, anciennete: value }; setExpDetails(nextState); void saveExperienceDetails(nextState); }}>{label}</ChoiceButton>)}</div>}
        {detailStep === 2 && <div className="grid gap-3">{amountOptions.map(([value, label]) => <ChoiceButton key={value} selected={expDetails.montant === value} onClick={() => { const nextState = { ...expDetails, montant: value }; setExpDetails(nextState); void saveExperienceDetails(nextState); }}>{label}</ChoiceButton>)}</div>}
        {detailStep === 3 && <div className="grid gap-3">{managementOptions.map(([value, label]) => <ChoiceButton key={value} selected={expDetails.mode === value} onClick={() => { const nextState = { ...expDetails, mode: value }; setExpDetails(nextState); void saveExperienceDetails(nextState); }}>{label}</ChoiceButton>)}</div>}

        {validationAttempted && incompleteSteps.length > 0 && <div className="mt-6 rounded-2xl border-2 border-red-200 bg-red-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div><p className="font-semibold text-red-800">Validation impossible : éléments à compléter</p><p className="mt-1 text-sm leading-6 text-red-700">Les éléments en rouge ci-dessous doivent être complétés avant de pouvoir valider le questionnaire.</p></div>
            <span className="shrink-0 rounded-full bg-red-700 px-3 py-1 text-xs font-bold text-white">{incompleteSteps.length} restant{incompleteSteps.length > 1 ? 's' : ''}</span>
          </div>
          <div className="mt-4 grid gap-2">{incompleteSteps.map((index) => <button key={index} type="button" onClick={() => { setCurrentIndex(index); setErrorMessage(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${index === currentIndex ? 'border-red-700 bg-red-700 text-white' : 'border-red-200 bg-white text-red-800 hover:border-red-400 hover:bg-red-100'}`}>À compléter · {stepLabelAt(index)}</button>)}</div>
        </div>}
        {validationAttempted && !currentComplete && <div className="mt-5 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">Cette question doit être complétée avant la validation du questionnaire.</div>}
        <div className="mt-6"><SecureNote>Vos réponses sont confidentielles et utilisées exclusivement pour l’analyse et la traçabilité de votre dossier patrimonial.</SecureNote></div>
        {errorMessage && <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>}
      </div>
      <WizardFooter onPrevious={previous} onNext={() => void next()} nextLabel={currentIndex === totalSteps - 1 ? 'Valider le questionnaire' : 'Suivant'} nextDisabled={!currentComplete} busy={busy} />
    </WizardCard>
  </div>;
}
