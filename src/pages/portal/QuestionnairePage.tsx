import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { fetchPortalProgress, messageFromError, selectedProgress, type PortalProgress } from '../../portal/portalHelpers';

type Mode = 'QPI' | 'ESG';
interface OptionRow { id: string; code: string; libelle: string; ordre: number; metadata?: { exclusive?: boolean } | null; }
interface QuestionRow { id: string; code: string; libelle: string; ordre: number; type_reponse: string; metadata: Record<string, unknown>; options?: OptionRow[]; }
interface AnswerRow { question_id: string; option_id: string | null; answer_text: string | null; answer_numeric: number | null; answer_json: unknown; }

const experienceFamilies = [
  ['liquidites', 'Livrets / dépôts / fonds euros'],
  ['obligations', 'Obligations'],
  ['actions', 'Actions / OPC / ETF'],
  ['diversifies', 'Fonds diversifiés / multi-actifs'],
  ['immobilier_papier', 'SCPI / OPCI / fonds immobiliers'],
  ['av_per', 'Assurance-vie / capitalisation / PER'],
  ['structures', 'Produits structurés'],
  ['non_cote', 'Non coté / private equity / FIP / FCPI / FCPR'],
  ['fia', 'FIA / fonds spécialisés'],
  ['derives', 'Produits à effet de levier / dérivés'],
] as const;
const experienceLevels = [
  ['jamais', 'Jamais'], ['deja_detenu', 'Déjà détenu'], ['plusieurs_operations', 'Plusieurs opérations'], ['pratique_reguliere', 'Pratique régulière'],
] as const;

function visible(question: QuestionRow, selectedCodes: Record<string, string>): boolean {
  const metadata = question.metadata || {};
  const showIf = metadata.show_if as { question?: string; equals?: string } | undefined;
  return !showIf?.question || selectedCodes[showIf.question] === showIf.equals;
}

export default function QuestionnairePage({ mode }: { mode: Mode }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [progressRows, setProgressRows] = useState<PortalProgress[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerRow>>({});
  const [multi, setMulti] = useState<Record<string, string[]>>({});
  const [experiences, setExperiences] = useState<Record<string, string>>({});
  const [expDetails, setExpDetails] = useState({ connaissance: '', sources: [] as string[], precision: '', anciennete: '', montant: '', mode: '' });
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [done, setDone] = useState(false);
  const dossierId = searchParams.get('dossier');
  const progress = useMemo(() => selectedProgress(progressRows, dossierId), [progressRows, dossierId]);
  const sessionId = mode === 'QPI' ? progress?.qpi_session_id : progress?.esg_session_id;

  useEffect(() => {
    void fetchPortalProgress().then(async (rows) => {
      setProgressRows(rows);
      const row = selectedProgress(rows, dossierId);
      if (!row) return;
      if (mode === 'QPI' && !row.qpi_session_id) throw new Error('Le questionnaire investisseur n’est pas encore disponible.');
      if (mode === 'ESG' && !row.esg_session_id) throw new Error(row.esg_opt_in ? 'Le questionnaire ESG sera disponible après validation du QPI.' : 'Vous n’avez pas demandé à exprimer de préférences ESG.');
      const id = mode === 'QPI' ? row.qpi_session_id! : row.esg_session_id!;
      const { error: startError } = await supabase.rpc('start_questionnaire_session', { p_session_id: id });
      if (startError) throw startError;
      const { data: session, error: sessionError } = await supabase.from('questionnaire_sessions').select('template_id,statut').eq('id', id).single();
      if (sessionError) throw sessionError;
      setDone(['completed', 'validated'].includes(session.statut));
      const { data: qData, error: qError } = await supabase.from('questionnaire_questions').select('id,code,libelle,ordre,type_reponse,metadata,questionnaire_options(id,code,libelle,ordre,metadata)').eq('template_id', session.template_id).order('ordre');
      if (qError) throw qError;
      const normalized = (qData ?? []).map((q) => ({ ...q, options: [...(q.questionnaire_options ?? [])].sort((a, b) => a.ordre - b.ordre) })) as unknown as QuestionRow[];
      setQuestions(normalized);
      const { data: aData } = await supabase.from('questionnaire_answers').select('question_id,option_id,answer_text,answer_numeric,answer_json').eq('session_id', id);
      const answerMap: Record<string, AnswerRow> = {};
      const multiMap: Record<string, string[]> = {};
      for (const answer of (aData ?? []) as AnswerRow[]) {
        answerMap[answer.question_id] = answer;
        if (Array.isArray(answer.answer_json)) multiMap[answer.question_id] = answer.answer_json as string[];
      }
      setAnswers(answerMap); setMulti(multiMap);
      if (mode === 'QPI') {
        const [{ data: expRows }, { data: details }] = await Promise.all([
          supabase.from('qpi_product_experience').select('famille_produit,niveau_experience').eq('session_id', id),
          supabase.from('qpi_experience_details').select('*').eq('session_id', id).maybeSingle(),
        ]);
        const map: Record<string, string> = {}; for (const rowExp of expRows ?? []) map[rowExp.famille_produit] = rowExp.niveau_experience; setExperiences(map);
        if (details) setExpDetails({ connaissance: String(details.connaissance_par_formation_ou_profession), sources: details.sources_pertinentes ?? [], precision: details.precisions_formation_profession ?? '', anciennete: details.anciennete_experience ?? '', montant: details.montant_habituel_operation ?? '', mode: details.mode_gestion ?? '' });
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

  const saveSingle = async (question: QuestionRow, option: OptionRow, extraText?: string, extraNumber?: number, extraJson?: unknown) => {
    if (!sessionId || done) return;
    const payload = { session_id: sessionId, question_id: question.id, option_id: option.id, answer_text: extraText ?? null, answer_numeric: extraNumber ?? null, answer_json: extraJson ?? null };
    const { data, error } = await supabase.from('questionnaire_answers').upsert(payload, { onConflict: 'session_id,question_id' }).select('question_id,option_id,answer_text,answer_numeric,answer_json').single();
    if (error) throw error;
    setAnswers((current) => ({ ...current, [question.id]: data as AnswerRow }));
  };

  const saveText = async (question: QuestionRow, value: string) => {
    if (!sessionId || done) return;
    const payload = { session_id: sessionId, question_id: question.id, option_id: null, answer_text: value || null, answer_numeric: null, answer_json: null };
    const { data, error } = await supabase.from('questionnaire_answers').upsert(payload, { onConflict: 'session_id,question_id' }).select('question_id,option_id,answer_text,answer_numeric,answer_json').single();
    if (error) throw error;
    setAnswers((current) => ({ ...current, [question.id]: data as AnswerRow }));
  };

  const saveMulti = async (question: QuestionRow, option: OptionRow) => {
    if (!sessionId || done) return;
    const exclusive = Boolean(option.metadata?.exclusive);
    const current = multi[question.id] ?? [];
    const next = exclusive ? [option.code] : current.includes(option.code) ? current.filter((v) => v !== option.code) : [...current.filter((code) => code !== 'AUCUNE'), option.code];
    const payload = { session_id: sessionId, question_id: question.id, option_id: null, answer_text: null, answer_numeric: null, answer_json: next };
    const { error } = await supabase.from('questionnaire_answers').upsert(payload, { onConflict: 'session_id,question_id' });
    if (error) throw error;
    setMulti((state) => ({ ...state, [question.id]: next }));
  };

  const saveExperience = async (family: string, level: string) => {
    if (!sessionId || done) return;
    const { error } = await supabase.from('qpi_product_experience').upsert({ session_id: sessionId, famille_produit: family, niveau_experience: level }, { onConflict: 'session_id,famille_produit' });
    if (error) throw error;
    setExperiences((current) => ({ ...current, [family]: level }));
  };

  const saveExperienceDetails = async () => {
    if (!sessionId || done) return;
    const knowledge = expDetails.connaissance === 'true' ? true : expDetails.connaissance === 'false' ? false : null;
    const { error } = await supabase.from('qpi_experience_details').upsert({ session_id: sessionId, connaissance_par_formation_ou_profession: knowledge, sources_pertinentes: expDetails.sources, precisions_formation_profession: expDetails.precision || null, anciennete_experience: expDetails.anciennete || null, montant_habituel_operation: expDetails.montant || null, mode_gestion: expDetails.mode || null }, { onConflict: 'session_id' });
    if (error) throw error;
  };

  const complete = async () => {
    if (!sessionId) return;
    setBusy(true); setErrorMessage('');
    try {
      if (mode === 'QPI') await saveExperienceDetails();
      const { error } = await supabase.rpc('complete_questionnaire_session', { p_session_id: sessionId });
      if (error) throw error;
      setDone(true);
      navigate(`/espace-client/synthese?dossier=${encodeURIComponent(progress!.dossier_id)}`);
    } catch (error) { setErrorMessage(messageFromError(error)); } finally { setBusy(false); }
  };

  if (!progress) return <p>Aucun dossier sélectionné.</p>;

  return <div className="space-y-8">
    <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">{mode === 'QPI' ? 'Questionnaire de profil investisseur' : 'Questionnaire de durabilité'}</p><h2 className="mt-2 text-3xl font-semibold">{mode === 'QPI' ? 'Votre profil investisseur' : 'Vos préférences ESG'}</h2><p className="mt-3 max-w-3xl text-slate-600">{mode === 'QPI' ? 'Les questions Q1 à Q20 évaluent votre situation, vos connaissances et votre expérience. Seules Q21 à Q25 alimentent l’indicateur de tolérance comportementale ; le profil final reste soumis aux contrôles d’adéquation.' : 'Aucun score ESG client n’est produit. Vos seuils et préférences sont enregistrés pour le matching avec les solutions recommandées.'}</p></div>
    {done && <div className="flex gap-3 rounded-2xl bg-emerald-50 p-5 text-emerald-800"><CheckCircle2 className="h-5 w-5" /><p className="text-sm">Questionnaire complété et figé.</p></div>}
    {questions.filter((q) => visible(q, optionCodeByQuestion)).map((question) => <section key={question.id} className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{question.code}</p><h3 className="mt-2 text-lg font-semibold leading-7">{question.libelle}</h3>
      {question.type_reponse === 'single' && <div className="mt-5 grid gap-3">{question.options?.map((option) => <button type="button" disabled={done} key={option.id} onClick={() => void saveSingle(question, option)} className={`rounded-xl border px-4 py-3 text-left text-sm ${answers[question.id]?.option_id === option.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 hover:border-slate-400'}`}>{option.libelle}</button>)}</div>}
      {question.type_reponse === 'multiple' && <div className="mt-5 grid gap-3 sm:grid-cols-2">{question.options?.map((option) => <label key={option.id} className="flex gap-3 rounded-xl border border-slate-200 p-4 text-sm"><input disabled={done} type="checkbox" checked={(multi[question.id] ?? []).includes(option.code)} onChange={() => void saveMulti(question, option)} /><span>{option.libelle}</span></label>)}</div>}
      {question.type_reponse === 'text' && <textarea disabled={done} defaultValue={answers[question.id]?.answer_text ?? ''} onBlur={(event) => void saveText(question, event.target.value)} rows={4} className="mt-5 w-full rounded-xl border border-slate-300 px-4 py-3" />}
      {question.code === 'ESG_SCOPE' && optionCodeByQuestion.ESG_SCOPE === 'AUTRE' && <input disabled={done} placeholder="Précisez le périmètre" value={answers[question.id]?.answer_text ?? ''} onChange={(e) => setAnswers((current) => ({ ...current, [question.id]: { ...current[question.id], question_id: question.id, answer_text: e.target.value, option_id: current[question.id]?.option_id ?? null, answer_numeric: null, answer_json: null } }))} onBlur={(e) => { const selected = question.options?.find((o) => o.id === answers[question.id]?.option_id); if (selected) void saveSingle(question, selected, e.target.value); }} className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3" />}
      {(question.code === 'ESG_TAX_MIN' || question.code === 'ESG_SFDR_MIN') && question.options?.find((o) => o.id === answers[question.id]?.option_id)?.code === 'AUTRE' && <input type="number" min="0" max="100" disabled={done} placeholder="Pourcentage minimum" value={answers[question.id]?.answer_numeric ?? ''} onChange={(e) => setAnswers((current) => ({ ...current, [question.id]: { ...current[question.id], question_id: question.id, answer_numeric: e.target.value ? Number(e.target.value) : null, option_id: current[question.id]?.option_id ?? null, answer_text: null, answer_json: null } }))} onBlur={(e) => { const selected = question.options?.find((o) => o.id === answers[question.id]?.option_id); if (selected) void saveSingle(question, selected, undefined, Number(e.target.value)); }} className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3" />}
      {question.code === 'Q10' && <input type="number" min="0" disabled={done} placeholder="Montant maximum de perte déclaré en euros (facultatif)" defaultValue={((answers[question.id]?.answer_json as { perte_max_declairee_montant?: number } | null)?.perte_max_declairee_montant) ?? ''} onBlur={(e) => { const selected = question.options?.find((o) => o.id === answers[question.id]?.option_id); if (selected) void saveSingle(question, selected, undefined, undefined, e.target.value ? { perte_max_declairee_montant: Number(e.target.value) } : null); }} className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3" />}
    </section>)}
    {mode === 'QPI' && <><section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8"><h3 className="text-lg font-semibold">Expérience par famille de produits</h3><div className="mt-5 space-y-4">{experienceFamilies.map(([family, label]) => <div key={family} className="grid gap-2 border-b border-slate-100 pb-4 sm:grid-cols-[1fr_220px] sm:items-center"><span className="text-sm font-medium">{label}</span><select disabled={done} value={experiences[family] ?? ''} onChange={(e) => void saveExperience(family, e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Sélectionner</option>{experienceLevels.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></div>)}</div></section>
    <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8"><h3 className="text-lg font-semibold">Formation et expérience générale</h3><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Connaissance via formation ou profession<select disabled={done} value={expDetails.connaissance} onChange={(e) => setExpDetails((d) => ({ ...d, connaissance: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"><option value="">Sélectionner</option><option value="false">Non</option><option value="true">Oui</option></select></label><label className="text-sm font-medium">Ancienneté d’expérience<select disabled={done} value={expDetails.anciennete} onChange={(e) => setExpDetails((d) => ({ ...d, anciennete: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"><option value="">Sélectionner</option><option value="aucune">Aucune</option><option value="moins_2">Moins de 2 ans</option><option value="2_5">2 à 5 ans</option><option value="5_10">5 à 10 ans</option><option value="plus_10">Plus de 10 ans</option></select></label><label className="text-sm font-medium">Montant habituel d’une opération<select disabled={done} value={expDetails.montant} onChange={(e) => setExpDetails((d) => ({ ...d, montant: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"><option value="">Sélectionner</option><option value="moins_10k">Moins de 10 000 €</option><option value="10_50k">10 000 à 50 000 €</option><option value="50_100k">50 000 à 100 000 €</option><option value="plus_100k">Plus de 100 000 €</option></select></label><label className="text-sm font-medium">Mode de gestion habituel<select disabled={done} value={expDetails.mode} onChange={(e) => setExpDetails((d) => ({ ...d, mode: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"><option value="">Sélectionner</option><option value="conseillee">Gestion conseillée</option><option value="libre">Gestion libre</option><option value="mandat">Gestion sous mandat</option><option value="mixte">Mixte</option></select></label></div>{expDetails.connaissance === 'true' && <textarea disabled={done} value={expDetails.precision} onChange={(e) => setExpDetails((d) => ({ ...d, precision: e.target.value }))} rows={3} placeholder="Précisez le diplôme, la formation ou l’expérience professionnelle pertinente" className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3" />}</section></>}
    {errorMessage && <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>}
    {!done && <button disabled={busy} onClick={() => void complete()} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Validation…' : 'Valider le questionnaire'}</button>}
  </div>;
}
