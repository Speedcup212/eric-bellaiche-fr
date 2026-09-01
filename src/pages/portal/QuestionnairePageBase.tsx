import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Leaf, Pencil } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChoiceButton, JourneyProgress, PageIntro, QuestionHeader, SecureNote, WizardCard, WizardFooter } from '../../portal/FintechJourney';
import { supabase } from '../../lib/supabase';
import { dossierHref, fetchPortalProgress, messageFromError, nextStepHref, selectedProgress, type PortalProgress } from '../../portal/portalHelpers';

type Mode = 'QPI' | 'ESG';
interface OptionRow { id: string; code: string; libelle: string; ordre: number; metadata?: { exclusive?: boolean; value_pct?: number } | null; }
interface QuestionRow { id: string; code: string; libelle: string; ordre: number; type_reponse: string; obligatoire: boolean; metadata: Record<string, unknown>; options?: OptionRow[]; }
interface AnswerRow { question_id: string; option_id: string | null; answer_text: string | null; answer_numeric: number | null; answer_json: unknown; }
type ExpState = { connaissance: '' | 'true' | 'false'; sources: string[]; precision: string; anciennete: string; montant: string; mode: string };
export interface QpiResultRow { profil_indicatif: string | null; profil_operationnel_final: string | null; ecart_declared_objective: boolean | null; synthese_dimensions: Record<string, unknown>; }

const experienceFamilies = [
  ['liquidites', 'Produits sécurisés, livrets et fonds euros'],
  ['obligations', 'Obligations et fonds obligataires'],
  ['actions', 'Actions, OPC, ETF et fonds diversifiés'],
  ['immobilier_papier', 'SCPI, OPCI et fonds immobiliers'],
  ['structures', 'Produits complexes, structurés et non cotés'],
] as const;
const experienceLevels = [['jamais', 'Aucune opération'], ['deja_detenu', '1 opération'], ['plusieurs_operations', '2 à 5 opérations'], ['pratique_reguliere', 'Plus de 5 opérations']] as const;
const knowledgeSources = [['formation', 'Formation financière ou patrimoniale'], ['profession', 'Expérience professionnelle liée à la finance'], ['lecture', 'Lecture / autoformation régulière'], ['autre', 'Autre source de connaissance']] as const;
const seniorityOptions = [['aucune', 'Aucune expérience'], ['moins_2_ans', 'Moins de 2 ans'], ['2_5_ans', '2 à 5 ans'], ['5_10_ans', '5 à 10 ans'], ['plus_10_ans', 'Plus de 10 ans']] as const;
const amountOptions = [['moins_10k', 'Moins de 10 000 €'], ['10_50k', '10 000 à 50 000 €'], ['50_100k', '50 000 à 100 000 €'], ['plus_100k', 'Plus de 100 000 €']] as const;
const managementOptions = [['accompagne_conseille', 'Principalement accompagné / conseillé'], ['gestion_libre', 'Principalement en gestion libre'], ['gestion_sous_mandat', 'Principalement sous mandat'], ['mixte', 'Mixte selon les placements']] as const;

function visible(question: QuestionRow, selectedCodes: Record<string, string>): boolean {
  if (question.metadata?.deprecated === true) return false;
  const showIf = question.metadata?.show_if as { question?: string; equals?: string; not_equals?: string } | undefined;
  if (!showIf?.question) return true;
  if (showIf.equals !== undefined) return selectedCodes[showIf.question] === showIf.equals;
  if (showIf.not_equals !== undefined) return Boolean(selectedCodes[showIf.question]) && selectedCodes[showIf.question] !== showIf.not_equals;
  return true;
}

function answerObject(answer?: AnswerRow): Record<string, unknown> {
  return answer?.answer_json && !Array.isArray(answer.answer_json) && typeof answer.answer_json === 'object' ? answer.answer_json as Record<string, unknown> : {};
}

function displayedOptions(question: QuestionRow): OptionRow[] {
  const options = question.options ?? [];
  if (!question.metadata?.correct_option) return options;
  const unknown = options.filter((option) => option.code === 'NSP');
  const answers = options.filter((option) => option.code !== 'NSP');
  if (answers.length === 0) return unknown;
  const shift = question.ordre % answers.length;
  return [...answers.slice(shift), ...answers.slice(0, shift), ...unknown];
}

function questionExplanation(mode: Mode, question: QuestionRow): string {
  if (mode === 'ESG' && question.code === 'ESG_TAX_PREF') return 'Il s’agit d’activités contribuant notamment au climat, à l’énergie, à la protection de l’eau, à l’économie circulaire, à la réduction de la pollution ou à la biodiversité. Ce cadre officiel est appelé « Taxonomie européenne ».';
  if (mode === 'ESG' && question.code === 'ESG_TAX_MIN') return 'Choisissez le pourcentage minimum que vous souhaitez voir pris en compte lors de l’étude des solutions.';
  if (mode === 'ESG' && question.code === 'ESG_SFDR_PREF') return 'Il s’agit d’investissements qui contribuent à un objectif environnemental ou social. Le terme réglementaire est « investissements durables au sens du règlement SFDR ».';
  if (mode === 'ESG' && question.code === 'ESG_SFDR_MIN') return 'Choisissez simplement le pourcentage minimum souhaité. Vous pourrez répondre « Je ne sais pas encore » si vous ne souhaitez pas fixer de seuil.';
  if (mode === 'ESG' && question.code === 'ESG_PAI_PREF') return 'Exemples : émissions de CO₂, pollution, atteintes à la biodiversité, mauvaises conditions de travail ou violations des droits humains. Le terme réglementaire est « principales incidences négatives (PAI) ».';
  if (mode === 'ESG' && question.code === 'ESG_PAI_PRIORITIES') return 'Cochez les conséquences que vous souhaitez voir limitées dans les placements étudiés.';
  if (mode === 'ESG' && question.code === 'ESG_PAI_MODALITIES') return 'Choisissez une ou plusieurs méthodes. Aucune connaissance financière n’est nécessaire.';
  if (mode === 'ESG' && question.code === 'ESG_EXCLUSIONS') return 'Cochez tous les secteurs dans lesquels vous ne souhaitez pas que votre argent soit investi.';
  if (mode === 'ESG' && question.code === 'ESG_LIMITATIONS') return 'Vous pouvez cocher une seule réponse ou les deux. Si vous n’acceptez aucune de ces conséquences, choisissez « Aucune de ces conséquences ».';
  if (mode === 'ESG') return 'Répondez selon vos convictions. Votre réponse permettra de vérifier que les solutions étudiées respectent vos préférences de durabilité.';
  if (question.code === 'Q1') return 'Sélectionnez un ou plusieurs objectifs correspondant à votre situation patrimoniale. Vous pouvez également ajouter une note pour préciser votre démarche.';
  if (question.code === 'Q3') return 'Indiquez dans quel délai vous devez pouvoir disposer d’une partie de votre argent.';
  if (question.code === 'Q4') return 'Pensez aux dépenses importantes prévues ou possibles au cours des cinq prochaines années.';
  if (question.code === 'Q9') return 'Pensez aux conséquences concrètes sur votre budget, votre niveau de vie et vos projets.';
  if (question.code === 'Q10') return 'Pensez uniquement à la perte que vous pourriez absorber sans réduire votre niveau de vie, renoncer à un projet ou manquer à vos engagements.';
  if (question.ordre <= 12) return 'Répondez selon votre situation réelle. Cette réponse contribue à l’analyse de votre expérience et de votre capacité financière.';
  if (question.code && ['Q13','Q14','Q15','Q16','Q17'].includes(question.code)) return 'Cette question vérifie un principe financier essentiel. Répondez sans assistance ; « Je ne sais pas » est une réponse parfaitement acceptable.';
  return 'Choisissez la réaction qui vous correspond le mieux. Ces questions évaluent votre tolérance comportementale aux fluctuations et au risque de perte.';
}

function numericDimension(value: unknown, key: string): number | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = (value as Record<string, unknown>)[key];
  return typeof result === 'number' ? result : null;
}

export function QpiResultSummary({ result }: { result: QpiResultRow | null }) {
  const dimensions = result?.synthese_dimensions ?? {};
  const knowledge = dimensions.connaissances;
  const capacity = dimensions.capacite_perte;
  const knowledgeScore = numericDimension(knowledge, 'bonnes_reponses');
  const capacityPct = numericDimension(capacity, 'pourcentage_declare');
  return <div className="space-y-5">
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950">
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-emerald-700">Profil retenu</p>
      <p className="mt-2 text-2xl font-bold">{result?.profil_operationnel_final ?? 'Calcul en cours'}</p>
      <p className="mt-2 text-sm leading-6">Ce profil constitue le niveau maximal de risque utilisable pour vos futures recommandations. Il ne vaut pas recommandation d’un produit.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tolérance déclarée</p><p className="mt-2 font-semibold text-slate-900">{result?.profil_indicatif ?? '—'}</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Capacité de perte</p><p className="mt-2 font-semibold text-slate-900">{capacityPct === null ? '—' : `${capacityPct} % maximum`}</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Connaissances</p><p className="mt-2 font-semibold text-slate-900">{knowledgeScore === null ? '—' : `${knowledgeScore} / 5`}</p></div>
    </div>
    {result?.ecart_declared_objective && <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>Mesure de prudence appliquée :</strong> votre tolérance au risque est supérieure à votre capacité de perte. Le profil retenu a donc été automatiquement limité au niveau le plus prudent.</p>}
  </div>;
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
  const [qpiResult, setQpiResult] = useState<QpiResultRow | null>(null);
  const dossierId = searchParams.get('dossier');
  const progress = useMemo(() => selectedProgress(progressRows, dossierId), [progressRows, dossierId]);
  const sessionId = mode === 'QPI' ? progress?.qpi_session_id : progress?.esg_session_id;

  useEffect(() => {
    // QPI and ESG share this component. Reset navigation immediately so a QPI
    // position can never leak into the ESG questionnaire during route changes.
    setCurrentIndex(0);
    setValidationAttempted(false);
    setErrorMessage('');
    setNoteOpen(false);
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

      if (mode === 'ESG') {
        const loadedSelectedCodes = {};
        for (const question of normalized) {
          const selected = question.options?.find((option) => option.id === answerMap[question.id]?.option_id);
          if (selected) loadedSelectedCodes[question.code] = selected.code;
        }
        const loadedVisibleQuestions = normalized.filter((question) => visible(question, loadedSelectedCodes));
        const loadedQuestionComplete = (question) => {
          const answer = answerMap[question.id];
          if (question.type_reponse === 'single') {
            if (!answer?.option_id) return false;
            const selected = question.options?.find((option) => option.id === answer.option_id);
            if ((question.code === 'ESG_TAX_MIN' || question.code === 'ESG_SFDR_MIN') && selected?.code === 'AUTRE') {
              return answer.answer_numeric !== null && answer.answer_numeric !== undefined && answer.answer_numeric >= 0 && answer.answer_numeric <= 100;
            }
            return true;
          }
          if (question.type_reponse === 'multiple') {
            const values = multiMap[question.id] ?? [];
            if (question.code === 'ESG_EXCLUSIONS' && values.includes('AUTRE') && !answer?.answer_text?.trim()) return false;
            if (question.obligatoire || question.code === 'ESG_PAI_PRIORITIES' || question.code === 'ESG_PAI_MODALITIES') return values.length > 0;
            return true;
          }
          if (question.type_reponse === 'text') return !question.obligatoire || Boolean(answer?.answer_text?.trim());
          return true;
        };
        const firstIncompleteIndex = loadedVisibleQuestions.findIndex((question) => !loadedQuestionComplete(question));
        setCurrentIndex(firstIncompleteIndex >= 0 ? firstIncompleteIndex : 0);
      }

      if (mode === 'QPI') {
        const [{ data: expRows, error: expError }, { data: details, error: detailsError }, { data: resultData, error: resultError }] = await Promise.all([
          supabase.from('qpi_product_experience').select('famille_produit,niveau_experience').eq('session_id', id),
          supabase.from('qpi_experience_details').select('*').eq('session_id', id).maybeSingle(),
          supabase.from('qpi_results').select('profil_indicatif,profil_operationnel_final,ecart_declared_objective,synthese_dimensions').eq('session_id', id).maybeSingle(),
        ]);
        if (expError) throw expError;
        if (detailsError) throw detailsError;
        if (resultError) throw resultError;
        const map: Record<string, string> = {};
        for (const rowExp of expRows ?? []) map[rowExp.famille_produit] = rowExp.niveau_experience;
        setExperiences(map);
        if (details) setExpDetails({ connaissance: details.connaissance_par_formation_ou_profession === true ? 'true' : details.connaissance_par_formation_ou_profession === false ? 'false' : '', sources: details.sources_pertinentes ?? [], precision: details.precisions_formation_profession ?? '', anciennete: details.anciennete_experience ?? '', montant: details.montant_habituel_operation ?? '', mode: details.mode_gestion ?? '' });
        if (resultData) setQpiResult(resultData as QpiResultRow);
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
  const extraQpiSteps = mode === 'QPI' ? 5 : 0;
  const totalSteps = visibleQuestions.length + extraQpiSteps;
  const qpiSections = [
    { key: 'horizon', label: 'Horizon & liquidité' },
    { key: 'capacity', label: 'Capacité de perte' },
    { key: 'knowledge', label: 'Connaissances' },
    { key: 'tolerance', label: 'Tolérance au risque' },
    { key: 'experience', label: 'Expérience' },
  ] as const;
  const currentQpiSectionKey = useMemo(() => {
    if (mode !== 'QPI') return null;
    if (currentIndex >= visibleQuestions.length) return 'experience';
    const code = visibleQuestions[currentIndex]?.code ?? '';
    if (['Q3', 'Q4'].includes(code)) return 'horizon';
    if (['Q9', 'Q10'].includes(code)) return 'capacity';
    if (['Q13', 'Q14', 'Q15', 'Q16', 'Q17'].includes(code)) return 'knowledge';
    if (['Q21', 'Q22', 'Q23', 'Q24', 'Q25'].includes(code)) return 'tolerance';
    return 'horizon';
  }, [mode, currentIndex, visibleQuestions]);
  const currentQpiSectionIndex = qpiSections.findIndex((section) => section.key === currentQpiSectionKey);
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
  const experienceStep = mode === 'QPI' && extraIndex === 0;
  const detailStep = mode === 'QPI' && extraIndex >= 1 ? extraIndex - 1 : -1;

  const questionComplete = (question: QuestionRow): boolean => {
    const answer = answers[question.id];
    if (question.type_reponse === 'single') {
      if (!answer?.option_id) return false;
      const selected = question.options?.find((option) => option.id === answer.option_id);
      if ((question.code === 'ESG_TAX_MIN' || question.code === 'ESG_SFDR_MIN') && selected?.code === 'AUTRE') return answer.answer_numeric !== null && answer.answer_numeric !== undefined && answer.answer_numeric >= 0 && answer.answer_numeric <= 100;
      return true;
    }
    if (question.type_reponse === 'multiple') {
      const values = multi[question.id] ?? [];
      if (question.code === 'ESG_EXCLUSIONS' && values.includes('AUTRE') && !answer?.answer_text?.trim()) return false;
      if (question.obligatoire || question.code === 'ESG_PAI_PRIORITIES' || question.code === 'ESG_PAI_MODALITIES') return values.length > 0;
      return true;
    }
    if (question.type_reponse === 'text') return !question.obligatoire || Boolean(answer?.answer_text?.trim());
    return true;
  };

  const allExperienceFamiliesComplete = experienceFamilies.every(([family]) => Boolean(experiences[family]));
  const currentComplete = currentQuestion ? questionComplete(currentQuestion) : experienceStep ? allExperienceFamiliesComplete : detailStep === 0 ? expDetails.connaissance === 'false' || (expDetails.connaissance === 'true' && (expDetails.sources.length > 0 || Boolean(expDetails.precision.trim()))) : detailStep === 1 ? Boolean(expDetails.anciennete) : detailStep === 2 ? Boolean(expDetails.montant) : detailStep === 3 ? Boolean(expDetails.mode) : false;

  const stepCompleteAt = (index: number): boolean => {
    if (index < visibleQuestions.length) return questionComplete(visibleQuestions[index]);
    const extra = index - visibleQuestions.length;
    if (mode !== 'QPI') return true;
    if (extra === 0) return allExperienceFamiliesComplete;
    const detail = extra - 1;
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
    if (extra === 0) return 'Expérience par famille de placements';
    const detailLabels = ['Origine des connaissances financières', 'Ancienneté de votre expérience', 'Montant habituel de vos opérations', 'Mode de gestion habituel'];
    return detailLabels[extra - 1] ?? `Élément ${index + 1}`;
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
    if (mode === 'QPI') {
      const { data, error: resultError } = await supabase.from('qpi_results').select('profil_indicatif,profil_operationnel_final,ecart_declared_objective,synthese_dimensions').eq('session_id', sessionId).single();
      if (resultError) throw resultError;
      setQpiResult(data as QpiResultRow);
    }
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

  const selectSingleAnswer = async (question: QuestionRow, option: OptionRow) => {
    await upsertQuestionAnswer(question, { option_id: option.id });
    // In the investor profile, every single-choice answer advances immediately.
    // Optional QPI precision fields must never force the client to click “Suivant”.
    // ESG keeps its explicit-detail exceptions when “Autre” requires a follow-up field.
    const needsDetails = mode === 'ESG'
      && ['ESG_SCOPE', 'ESG_TAX_MIN', 'ESG_SFDR_MIN'].includes(question.code)
      && option.code === 'AUTRE';
    if (!needsDetails && currentIndex < totalSteps - 1) {
      window.setTimeout(() => {
        setCurrentIndex((index) => Math.min(index + 1, totalSteps - 1));
        setNoteOpen(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 160);
    }
  };

  if (!progress) return <p className="text-sm text-slate-500">Chargement du questionnaire…</p>;

  if (done) {
    const nextPath = nextStepHref(progress);
    const qpiNextIsEsg = mode === 'QPI' && progress.esg_opt_in === true;
    const completionDescription = mode === 'QPI'
      ? qpiNextIsEsg
        ? 'Votre questionnaire est terminé. Vérifiez le résultat retenu avant de poursuivre vers vos préférences de durabilité.'
        : 'Votre questionnaire est terminé. Vérifiez le résultat retenu avant de poursuivre vers les documents.'
      : 'Cette étape a été validée.';
    const completionCta = qpiNextIsEsg ? 'Continuer vers la durabilité' : 'Continuer vers les documents';
    return <div><JourneyProgress current={mode === 'QPI' ? 'qpi' : 'esg'} esgEnabled={progress.esg_opt_in !== false} hideSubstepText={mode === 'QPI'} /><PageIntro compact eyebrow={mode === 'QPI' ? 'Étape 2' : 'Étape 3'} title={mode === 'QPI' ? 'Votre profil investisseur' : 'Préférences de durabilité'} description={completionDescription} icon={<CheckCircle2 className="h-5 w-5" />} /><WizardCard className="p-8">{mode === 'QPI' ? <QpiResultSummary result={qpiResult} /> : <div className="rounded-2xl bg-emerald-50 p-5 text-emerald-800"><p className="font-semibold">Étape terminée</p><p className="mt-1 text-sm leading-6">Vous pouvez poursuivre votre parcours.</p></div>}<button type="button" onClick={() => navigate(nextPath)} className="mt-6 rounded-xl bg-[#3B82F6] px-5 py-3 text-sm font-semibold text-white">{completionCta}</button></WizardCard></div>;
  }

  const introTitle = mode === 'QPI' ? 'Votre profil investisseur' : 'Vos préférences de durabilité';
  const introDescription = mode === 'QPI' ? 'Le questionnaire s’affiche une question à la fois. Vos réponses permettent d’évaluer votre situation, vos connaissances, votre expérience, votre capacité de perte et votre tolérance au risque.' : 'La durabilité correspond ici aux critères environnementaux, sociaux et de gouvernance (ESG). Répondez simplement selon vos convictions : aucune connaissance technique n’est nécessaire.';
  let cardTitle = '';
  let cardDescription = '';
  let cardLabel = `Question ${currentIndex + 1} sur ${totalSteps}`;
  if (currentQuestion) {
    cardTitle = currentQuestion.libelle;
    cardDescription = questionExplanation(mode, currentQuestion);
    cardLabel = `Question ${currentIndex + 1} sur ${totalSteps}`;
  } else if (experienceStep) {
    cardTitle = 'Combien d’opérations avez-vous déjà réalisées sur chaque type de placement ?';
    cardDescription = 'Une opération correspond à une souscription, un achat, une vente ou un arbitrage. Toutes les lignes doivent être renseignées.';
    cardLabel = `Expérience · ${currentIndex + 1}/${totalSteps}`;
  } else if (detailStep === 0) {
    cardTitle = 'Votre formation ou votre métier vous ont-ils apporté des connaissances financières ?';
    cardDescription = 'Précisez l’origine de ces connaissances. Le cabinet utilise cette information pour apprécier votre compréhension des mécanismes et risques financiers.';
    cardLabel = `Expérience générale · ${currentIndex + 1}/${totalSteps}`;
  } else if (detailStep === 1) {
    cardTitle = 'Depuis combien de temps investissez-vous ?';
    cardDescription = 'Indiquez l’ancienneté qui correspond le mieux à votre expérience personnelle.';
    cardLabel = `Expérience générale · ${currentIndex + 1}/${totalSteps}`;
  } else if (detailStep === 2) {
    cardTitle = 'Quel montant investissez-vous habituellement ?';
    cardDescription = 'Sélectionnez l’ordre de grandeur le plus représentatif de vos opérations habituelles.';
    cardLabel = `Expérience générale · ${currentIndex + 1}/${totalSteps}`;
  } else if (detailStep === 3) {
    cardTitle = 'Comment gérez-vous vos placements ?';
    cardDescription = 'Choisissez le mode de gestion qui correspond le mieux à vos habitudes d’investissement.';
    cardLabel = `Expérience générale · ${currentIndex + 1}/${totalSteps}`;
  }

  const objectiveNoteVisible = currentQuestion?.code === 'Q1' && (noteOpen || Boolean(answers[currentQuestion.id]?.answer_text));

  return <div>
    <JourneyProgress current={mode === 'QPI' ? 'qpi' : 'esg'} esgEnabled={progress.esg_opt_in !== false} hideSubstepText={mode === 'QPI'} />
    {mode === 'ESG' && <PageIntro compact eyebrow="Étape 3" title={introTitle} description={introDescription} icon={<Leaf className="h-5 w-5" />} />}
    {mode === 'ESG' && currentIndex === 0 && <section className="rounded-[22px] border border-[#dbe4ef] bg-white p-5 shadow-sm sm:p-6">
      <div className="max-w-3xl">
        <h2 className="text-lg font-bold text-[#0b1f3a]">Que signifie « durabilité » pour vos placements ?</h2>
        <p className="mt-1.5 text-sm leading-6 text-[#5b6b82]">Il s’agit de la manière dont les entreprises prennent en compte les trois critères ESG dans leurs activités.</p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4"><p className="font-semibold text-emerald-900">Environnement</p><p className="mt-1 text-sm leading-5 text-emerald-800">Climat, pollution, ressources naturelles et biodiversité.</p></div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4"><p className="font-semibold text-blue-900">Social</p><p className="mt-1 text-sm leading-5 text-blue-800">Droits humains, conditions de travail, santé et sécurité.</p></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4"><p className="font-semibold text-amber-900">Gouvernance</p><p className="mt-1 text-sm leading-5 text-amber-800">Éthique des affaires, corruption, dirigeants et droits des actionnaires.</p></div>
      </div>
      <p className="mt-4 text-sm leading-6 text-[#33465f]">Il n’y a pas de bonne ou de mauvaise réponse : indiquez simplement les critères que vous souhaitez voir pris en compte dans les solutions proposées.</p>
    </section>}
    <WizardCard>
      {mode === 'QPI' && <div className="border-b border-slate-100 bg-white px-6 pt-5 sm:px-9">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Profil investisseur</p>
          <p className="text-xs font-semibold text-slate-700">Partie {Math.max(currentQpiSectionIndex + 1, 1)} sur 5 — {qpiSections[Math.max(currentQpiSectionIndex, 0)]?.label}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 pb-5 sm:grid-cols-5">
          {qpiSections.map((section, index) => {
            const active = section.key === currentQpiSectionKey;
            const completed = currentQpiSectionIndex > index;
            return <div key={section.key} className={`rounded-xl border px-3 py-2.5 text-center text-xs font-semibold transition ${active ? 'border-[#3B82F6] bg-blue-50 text-blue-700 shadow-sm' : completed ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
              <span className="mr-1">{completed ? '✓' : index + 1}.</span>{section.label}
            </div>;
          })}
        </div>
      </div>}
      <QuestionHeader current={currentIndex + 1} total={totalSteps} label={cardLabel} title={cardTitle} description={cardDescription} />
      <div className="px-6 py-7 sm:px-9 sm:py-9">
        {currentQuestion?.type_reponse === 'single' && <div className="grid gap-3">{displayedOptions(currentQuestion).map((option) => <ChoiceButton key={option.id} selected={answers[currentQuestion.id]?.option_id === option.id} onClick={() => void selectSingleAnswer(currentQuestion, option).catch((error) => setErrorMessage(messageFromError(error)))}>{option.libelle}</ChoiceButton>)}</div>}

        {currentQuestion?.type_reponse === 'multiple' && <div className="grid gap-3 sm:grid-cols-2">{currentQuestion.options?.map((option) => {
          const selected = (multi[currentQuestion.id] ?? []).includes(option.code);
          return <button type="button" key={option.id} onClick={() => void saveMulti(currentQuestion, option).catch((error) => setErrorMessage(messageFromError(error)))} className={`flex items-start gap-3 rounded-2xl border p-4 text-left text-sm leading-6 transition ${selected ? 'border-[#0b1f3a] bg-[#0b1f3a] text-white shadow-lg shadow-[#0b1f3a]/10' : 'border-[#dbe4ef] bg-white text-[#33465f] hover:-translate-y-0.5 hover:border-[#6f8fb4] hover:shadow-sm'}`}><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected ? 'border-white/30 bg-white text-[#0b1f3a]' : 'border-[#b8c5d5]'}`}>{selected ? '✓' : ''}</span>{option.libelle}</button>;
        })}</div>}

        {currentQuestion?.code === 'ESG_EXCLUSIONS' && (multi[currentQuestion.id] ?? []).includes('AUTRE') && <div className="mt-6 border-t border-slate-100 pt-6"><label className="block text-sm font-semibold text-slate-700">Précisez le secteur ou l’activité à exclure *<input value={answers[currentQuestion.id]?.answer_text ?? ''} onChange={(e) => updateLocal(currentQuestion, { answer_text: e.target.value })} onBlur={() => void persistCurrentQuestion().catch((error) => setErrorMessage(messageFromError(error)))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400 focus:bg-white" placeholder="Ex. élevage intensif, fourrure…" /></label></div>}

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

        {currentQuestion?.code === 'Q4' && currentQuestion.options?.find((option) => option.id === answers[currentQuestion.id]?.option_id)?.code !== 'A' && answers[currentQuestion.id]?.option_id && <div className="mt-6 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Montant estimé du besoin (€) <span className="font-normal text-slate-400">— facultatif</span><input type="number" min="0" value={String(answerObject(answers[currentQuestion.id]).montant_besoin_futur ?? '')} onChange={(e) => updateLocal(currentQuestion, { answer_json: { ...answerObject(answers[currentQuestion.id]), montant_besoin_futur: e.target.value ? Number(e.target.value) : null } })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400 focus:bg-white" /></label><label className="text-sm font-semibold text-slate-700">Échéance envisagée <span className="font-normal text-slate-400">— facultatif</span><input type="date" value={String(answerObject(answers[currentQuestion.id]).echeance ?? '')} onChange={(e) => updateLocal(currentQuestion, { answer_json: { ...answerObject(answers[currentQuestion.id]), echeance: e.target.value || null } })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400 focus:bg-white" /></label></div>}
        {currentQuestion?.code === 'Q5' && answers[currentQuestion.id]?.option_id && <div className="mt-6 border-t border-slate-100 pt-6"><label className="block max-w-sm text-sm font-semibold text-slate-700">Montant de l’investissement envisagé (€)<input type="number" min="0" value={String(answerObject(answers[currentQuestion.id]).montant_investissement_envisage ?? '')} onChange={(e) => updateLocal(currentQuestion, { answer_json: { ...answerObject(answers[currentQuestion.id]), montant_investissement_envisage: e.target.value ? Number(e.target.value) : null } })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400 focus:bg-white" /></label></div>}
        {currentQuestion?.code === 'Q10' && answers[currentQuestion.id]?.option_id && <div className="mt-6 border-t border-slate-100 pt-6"><label className="block max-w-md text-sm font-semibold text-slate-700">Montant maximum de perte estimé (€) <span className="font-normal text-slate-400">— facultatif</span><input type="number" min="0" value={String(answerObject(answers[currentQuestion.id]).perte_max_declairee_montant ?? '')} onChange={(e) => updateLocal(currentQuestion, { answer_json: { ...answerObject(answers[currentQuestion.id]), perte_max_declairee_montant: e.target.value ? Number(e.target.value) : null } })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400 focus:bg-white" /></label></div>}
        {currentQuestion?.code === 'ESG_SCOPE' && currentQuestion.options?.find((option) => option.id === answers[currentQuestion.id]?.option_id)?.code === 'AUTRE' && <div className="mt-6 border-t border-slate-100 pt-6"><label className="block text-sm font-semibold text-slate-700">Précisez les placements concernés <span className="font-normal text-slate-400">— facultatif</span><input value={answers[currentQuestion.id]?.answer_text ?? ''} onChange={(e) => updateLocal(currentQuestion, { answer_text: e.target.value })} onBlur={() => void persistCurrentQuestion().catch((error) => setErrorMessage(messageFromError(error)))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400 focus:bg-white" placeholder="Ex. assurance-vie et PER" /></label></div>}
        {(currentQuestion?.code === 'ESG_TAX_MIN' || currentQuestion?.code === 'ESG_SFDR_MIN') && currentQuestion.options?.find((option) => option.id === answers[currentQuestion.id]?.option_id)?.code === 'AUTRE' && <div className="mt-6 border-t border-slate-100 pt-6"><label className="block max-w-sm text-sm font-semibold text-slate-700">Pourcentage minimum souhaité<input type="number" min="0" max="100" value={answers[currentQuestion.id]?.answer_numeric ?? ''} onChange={(e) => updateLocal(currentQuestion, { answer_numeric: e.target.value ? Number(e.target.value) : null })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400 focus:bg-white" /></label></div>}

        {experienceStep && <div className="space-y-4">
          {experienceFamilies.map(([family, familyLabel]) => <div key={family} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
            <p className="mb-3 font-semibold text-slate-900">{familyLabel}</p>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {experienceLevels.map(([value, label]) => {
                const selected = experiences[family] === value;
                return <button type="button" key={value} onClick={() => void saveExperience(family, value).catch((error) => setErrorMessage(messageFromError(error)))} className={`min-h-12 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold leading-5 transition sm:text-sm ${selected ? 'border-[#0b1f3a] bg-[#0b1f3a] text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-[#6f8fb4]'}`}>{selected ? '✓ ' : ''}{label}</button>;
              })}
            </div>
          </div>)}
          {!allExperienceFamiliesComplete && <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">Renseignez les {experienceFamilies.filter(([family]) => !experiences[family]).length} famille{experienceFamilies.filter(([family]) => !experiences[family]).length > 1 ? 's' : ''} restante{experienceFamilies.filter(([family]) => !experiences[family]).length > 1 ? 's' : ''}.</p>}
        </div>}
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
