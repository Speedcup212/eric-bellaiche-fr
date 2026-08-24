import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, Download, FileCheck2, FileUp, Loader2, Trash2, UploadCloud, UsersRound } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { JourneyProgress, PageIntro, SecureNote, WizardCard, WizardFooter } from '../../portal/FintechJourney';
import { REGULATORY_DOCUMENTS_BUCKET, SOURCE_DOCUMENTS_BUCKET, supabase } from '../../lib/supabase';
import { dossierHref, fetchPortalProgress, messageFromError, nextStepHref, selectedProgress, type PortalProgress } from '../../portal/portalHelpers';

interface SourceDocument { id: string; categorie: string; nom_fichier: string; storage_bucket: string | null; storage_path: string | null; statut_analyse: string; created_at: string; }
interface RegulatoryDocument { id: string; type_document: string; statut: string; storage_bucket: string | null; storage_path_pdf: string | null; storage_path_docx: string | null; date_generation: string | null; }
interface DocumentContext {
  dossier_id: string;
  investisseur_id: string;
  tax_status: 'personal_notice' | 'attached_parents' | 'no_personal_notice' | null;
  has_liquidities: boolean | null;
  has_financial_assets: boolean | null;
  has_real_estate: boolean | null;
  has_credits: boolean | null;
  has_sci_company: boolean | null;
}

type RequirementStatus = 'required' | 'conditional' | 'optional';
interface Requirement {
  category: string;
  label: string;
  description: string;
  status: RequirementStatus;
  expectedCount: number;
  receivedCount: number;
}

const categories = [
  ['identite', 'Pièce d’identité'],
  ['justificatif_domicile', 'Justificatif de domicile'],
  ['avis_imposition', 'Avis d’imposition'],
  ['tableau_amortissement', 'Tableau d’amortissement / prêt'],
  ['comptes_liquidites', 'Comptes bancaires / liquidités'],
  ['patrimoine_financier', 'Placements / épargne'],
  ['patrimoine_immobilier', 'Bien immobilier / acte notarié'],
  ['sci_societe', 'SCI / société'],
  ['autre', 'Autre document'],
] as const;

function safeName(name: string): string { return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-'); }
function categoryLabel(value: string) { return categories.find(([code]) => code === value)?.[1] ?? value.replaceAll('_', ' '); }
function contextComplete(context: DocumentContext | undefined): boolean {
  return Boolean(context && context.tax_status !== null && context.has_liquidities !== null && context.has_financial_assets !== null && context.has_real_estate !== null && context.has_credits !== null && context.has_sci_company !== null);
}

export default function ClientDocumentsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [progressRows, setProgressRows] = useState<PortalProgress[]>([]);
  const [sources, setSources] = useState<SourceDocument[]>([]);
  const [regulatory, setRegulatory] = useState<RegulatoryDocument[]>([]);
  const [contexts, setContexts] = useState<DocumentContext[]>([]);
  const [professionalStatus, setProfessionalStatus] = useState('');
  const [category, setCategory] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [contextBusy, setContextBusy] = useState(false);
  const [finishBusy, setFinishBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const dossierId = searchParams.get('dossier');
  const progress = useMemo(() => selectedProgress(progressRows, dossierId), [progressRows, dossierId]);
  const currentContext = useMemo(() => contexts.find((item) => item.investisseur_id === progress?.investisseur_id), [contexts, progress?.investisseur_id]);

  const refreshProgress = async () => {
    const rows = await fetchPortalProgress();
    setProgressRows(rows);
    return selectedProgress(rows, dossierId);
  };

  const loadDocuments = async (row: PortalProgress) => {
    const [{ data: sourceData, error: sourceError }, { data: regulatoryData, error: regulatoryError }, { data: contextData, error: contextError }, { data: professionalData, error: professionalError }] = await Promise.all([
      supabase.from('documents_sources').select('id,categorie,nom_fichier,storage_bucket,storage_path,statut_analyse,created_at').eq('dossier_id', row.dossier_id).order('created_at', { ascending: false }),
      supabase.from('documents_reglementaires').select('id,type_document,statut,storage_bucket,storage_path_pdf,storage_path_docx,date_generation').eq('dossier_id', row.dossier_id).order('created_at', { ascending: false }),
      supabase.from('document_context_answers').select('dossier_id,investisseur_id,tax_status,has_liquidities,has_financial_assets,has_real_estate,has_credits,has_sci_company').eq('dossier_id', row.dossier_id),
      supabase.from('recueil_sections').select('payload').eq('dossier_id', row.dossier_id).eq('investisseur_id', row.investisseur_id).eq('section_code', 'professional').maybeSingle(),
    ]);
    if (sourceError) throw sourceError;
    if (regulatoryError) throw regulatoryError;
    if (contextError) throw contextError;
    if (professionalError) throw professionalError;
    setSources((sourceData ?? []) as SourceDocument[]);
    setRegulatory((regulatoryData ?? []) as RegulatoryDocument[]);
    setContexts((contextData ?? []) as DocumentContext[]);
    const professionalPayload = (professionalData?.payload ?? {}) as Record<string, unknown>;
    setProfessionalStatus(String(professionalPayload.statut ?? ''));
  };

  useEffect(() => {
    let active = true;
    void fetchPortalProgress().then(async (rows) => {
      if (!active) return;
      setProgressRows(rows);
      const row = selectedProgress(rows, dossierId);
      if (!row) return;
      if (row.next_step !== 'DOCUMENTS' && row.documents_status !== 'completed' && row.next_step !== 'TERMINE') {
        navigate(nextStepHref(row), { replace: true });
        return;
      }
      if (!row.transmitted_at) {
        const { error: startError } = await supabase.rpc('start_my_documents', { p_dossier_id: row.dossier_id });
        if (startError) throw startError;
      }
      if (!active) return;
      await loadDocuments(row);
    }).catch((error) => { if (active) setErrorMessage(messageFromError(error)); });
    return () => { active = false; };
  }, [dossierId, navigate]);

  useEffect(() => {
    if (!progress?.is_couple || progress.dossier_ready_for_documents || progress.transmitted_at) return;
    const timer = window.setInterval(() => { void refreshProgress().catch(() => undefined); }, 15000);
    return () => window.clearInterval(timer);
  }, [progress?.is_couple, progress?.dossier_ready_for_documents, progress?.transmitted_at, dossierId]);

  const saveContext = async (patch: Partial<DocumentContext>) => {
    if (!progress || progress.transmitted_at) return;
    setContextBusy(true);
    setErrorMessage('');
    try {
      const next: DocumentContext = {
        dossier_id: progress.dossier_id,
        investisseur_id: progress.investisseur_id,
        tax_status: currentContext?.tax_status ?? null,
        has_liquidities: currentContext?.has_liquidities ?? null,
        has_financial_assets: currentContext?.has_financial_assets ?? null,
        has_real_estate: currentContext?.has_real_estate ?? null,
        has_credits: currentContext?.has_credits ?? null,
        has_sci_company: currentContext?.has_sci_company ?? null,
        ...patch,
      };
      const { error } = await supabase.from('document_context_answers').upsert({ ...next, updated_at: new Date().toISOString() }, { onConflict: 'dossier_id,investisseur_id' });
      if (error) throw error;
      await loadDocuments(progress);
    } catch (error) {
      setErrorMessage(messageFromError(error));
    } finally {
      setContextBusy(false);
    }
  };

  const selectCategory = (nextCategory: string) => {
    setCategory((current) => current === nextCategory ? '' : nextCategory);
    setFile(null);
    setMessage('');
    setErrorMessage('');
  };

  const upload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!progress || !file || !category || progress.transmitted_at) return;
    if (file.size > 20 * 1024 * 1024) { setErrorMessage('Le fichier dépasse la limite de 20 Mo.'); return; }
    setBusy(true); setMessage(''); setErrorMessage('');
    const uploadCategory = category;
    const path = `${progress.dossier_id}/${crypto.randomUUID()}-${safeName(file.name)}`;
    try {
      const { error: uploadError } = await supabase.storage.from(SOURCE_DOCUMENTS_BUCKET).upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { error: registerError } = await supabase.rpc('register_source_document', { p_dossier_id: progress.dossier_id, p_investisseur_id: progress.investisseur_id, p_categorie: uploadCategory, p_nom_fichier: file.name, p_storage_path: path, p_date_document: null, p_annee_reference: null });
      if (registerError) { await supabase.storage.from(SOURCE_DOCUMENTS_BUCKET).remove([path]); throw registerError; }
      setFile(null);
      setMessage(`${categoryLabel(uploadCategory)} transmis avec succès.`);
      await loadDocuments(progress);
      setCategory('');
    } catch (error) { setErrorMessage(messageFromError(error)); } finally { setBusy(false); }
  };

  const deleteSource = async (doc: SourceDocument) => {
    if (!progress || progress.transmitted_at || deletingId) return;
    const confirmed = window.confirm(`Supprimer définitivement « ${doc.nom_fichier} » ?`);
    if (!confirmed) return;
    setDeletingId(doc.id); setMessage(''); setErrorMessage('');
    try {
      if (doc.storage_path) {
        const { error: storageError } = await supabase.storage.from(doc.storage_bucket || SOURCE_DOCUMENTS_BUCKET).remove([doc.storage_path]);
        if (storageError) throw storageError;
      }
      const { error: deleteError } = await supabase.from('documents_sources').delete().eq('id', doc.id);
      if (deleteError) throw deleteError;
      setMessage('Justificatif supprimé.');
      await loadDocuments(progress);
    } catch (error) {
      setErrorMessage(messageFromError(error));
      await loadDocuments(progress).catch(() => undefined);
    } finally {
      setDeletingId(null);
    }
  };

  const finish = async () => {
    if (!progress || progress.transmitted_at) return;
    setFinishBusy(true); setErrorMessage('');
    try {
      const refreshed = await refreshProgress();
      if (!refreshed?.dossier_ready_for_documents) throw new Error('La transmission finale reste verrouillée tant que chaque personne du dossier n’a pas terminé son parcours individuel.');
      const { error } = await supabase.rpc('complete_my_documents', { p_dossier_id: progress.dossier_id });
      if (error) throw error;
      navigate(dossierHref('/espace-client/synthese', progress.dossier_id));
    } catch (error) { setErrorMessage(messageFromError(error)); } finally { setFinishBusy(false); }
  };

  const openPrivateFile = async (bucket: string, path: string) => {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 90);
    if (error) { setErrorMessage(messageFromError(error)); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  if (!progress) {
    if (errorMessage) return <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>;
    return <p className="text-sm text-slate-500">Chargement du dossier…</p>;
  }

  const previousPath = progress.esg_opt_in ? '/espace-client/esg' : '/espace-client/profil-investisseur';
  const transmitted = Boolean(progress.transmitted_at);
  const waitingPartner = progress.is_couple && !progress.dossier_ready_for_documents && !transmitted;
  const completeContexts = contexts.filter(contextComplete).length;
  const allContextsComplete = completeContexts >= progress.dossier_members_total;
  const categoryCounts = Object.fromEntries(categories.map(([code]) => [code, sources.filter((doc) => doc.categorie === code).length])) as Record<string, number>;
  const aggregate = {
    tax: contexts.some((item) => item.tax_status === 'personal_notice'),
    liquidities: contexts.some((item) => item.has_liquidities === true),
    assets: contexts.some((item) => item.has_financial_assets === true),
    realEstate: contexts.some((item) => item.has_real_estate === true),
    credits: contexts.some((item) => item.has_credits === true),
    sci: contexts.some((item) => item.has_sci_company === true),
  };
  const conditionalStatus = (required: boolean): RequirementStatus => required ? 'required' : allContextsComplete ? 'optional' : 'conditional';
  const requirements: Requirement[] = [
    { category: 'identite', label: 'Pièce d’identité', description: `Une pièce d’identité est attendue pour chaque personne du dossier (${progress.dossier_members_total} au total).`, status: 'required', expectedCount: progress.dossier_members_total, receivedCount: categoryCounts.identite ?? 0 },
    { category: 'justificatif_domicile', label: 'Justificatif de domicile', description: 'Un justificatif de domicile est nécessaire pour sécuriser les coordonnées du dossier.', status: 'required', expectedCount: 1, receivedCount: categoryCounts.justificatif_domicile ?? 0 },
    { category: 'avis_imposition', label: 'Avis d’imposition', description: aggregate.tax ? 'Au moins une personne dispose d’un avis d’imposition personnel ou commun : il est attendu pour l’analyse fiscale.' : 'Il n’est demandé que si vous disposez d’un avis personnel ou commun. Un étudiant rattaché au foyer fiscal de ses parents peut l’indiquer ci-dessus.', status: conditionalStatus(aggregate.tax), expectedCount: aggregate.tax ? 1 : 0, receivedCount: categoryCounts.avis_imposition ?? 0 },
    { category: 'comptes_liquidites', label: 'Comptes bancaires / liquidités', description: 'À transmettre lorsque des comptes ou liquidités doivent être intégrés à l’analyse patrimoniale.', status: conditionalStatus(aggregate.liquidities), expectedCount: aggregate.liquidities ? 1 : 0, receivedCount: categoryCounts.comptes_liquidites ?? 0 },
    { category: 'patrimoine_financier', label: 'Placements / épargne', description: 'À transmettre en présence d’assurance-vie, PER, PEA, compte-titres, SCPI ou autres placements.', status: conditionalStatus(aggregate.assets), expectedCount: aggregate.assets ? 1 : 0, receivedCount: categoryCounts.patrimoine_financier ?? 0 },
    { category: 'patrimoine_immobilier', label: 'Patrimoine immobilier', description: 'À transmettre si vous détenez un bien immobilier.', status: conditionalStatus(aggregate.realEstate), expectedCount: aggregate.realEstate ? 1 : 0, receivedCount: categoryCounts.patrimoine_immobilier ?? 0 },
    { category: 'tableau_amortissement', label: 'Crédits en cours', description: 'À transmettre si un crédit est en cours : tableau d’amortissement ou justificatif équivalent.', status: conditionalStatus(aggregate.credits), expectedCount: aggregate.credits ? 1 : 0, receivedCount: categoryCounts.tableau_amortissement ?? 0 },
    { category: 'sci_societe', label: 'SCI / société', description: 'À transmettre si une SCI ou une société doit être prise en compte dans l’analyse.', status: conditionalStatus(aggregate.sci), expectedCount: aggregate.sci ? 1 : 0, receivedCount: categoryCounts.sci_societe ?? 0 },
    { category: 'autre', label: 'Autre document', description: 'Facultatif : ajoutez ici tout document complémentaire utile qui ne correspond pas aux catégories ci-dessus.', status: 'optional', expectedCount: 0, receivedCount: categoryCounts.autre ?? 0 },
  ];
  const missingRequired = requirements.filter((item) => item.status === 'required' && item.receivedCount < item.expectedCount);
  const finalBlocked = waitingPartner || !allContextsComplete || missingRequired.length > 0;
  const isStudent = professionalStatus.toLowerCase().includes('étudiant') || professionalStatus.toLowerCase().includes('etudiant');

  const badgeClass = (status: RequirementStatus) => status === 'required'
    ? 'bg-rose-50 text-rose-700 border-rose-200'
    : status === 'conditional'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : 'bg-slate-50 text-slate-600 border-slate-200';
  const badgeLabel = (status: RequirementStatus) => status === 'required' ? 'Obligatoire' : status === 'conditional' ? 'Selon votre situation' : 'Facultatif';

  const boolChoice = (label: string, key: keyof Pick<DocumentContext, 'has_liquidities' | 'has_financial_assets' | 'has_real_estate' | 'has_credits' | 'has_sci_company'>, value: boolean | null | undefined) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-800">{label}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={contextBusy || transmitted} onClick={() => void saveContext({ [key]: true })} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${value === true ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>Oui</button>
        <button type="button" disabled={contextBusy || transmitted} onClick={() => void saveContext({ [key]: false })} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${value === false ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>Non</button>
      </div>
    </div>
  );

  return (
    <div>
      <JourneyProgress current="documents" esgEnabled={progress.esg_opt_in !== false} />
      <PageIntro eyebrow="Dernière étape" title="Documents du dossier" description="La liste des pièces attendues s’adapte à votre situation. Les documents marqués « Obligatoire » sont nécessaires pour finaliser le dossier ; les autres ne sont demandés que lorsqu’ils correspondent à votre situation." icon={<UploadCloud className="h-5 w-5" />} />
      <WizardCard>
        {waitingPartner && <div className="border-b border-amber-200 bg-amber-50 px-6 py-5 sm:px-9"><div className="flex items-start gap-3"><UsersRound className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div><p className="font-semibold text-amber-950">Transmission finale en attente de l’autre personne</p><p className="mt-1 text-sm leading-6 text-amber-800">{progress.dossier_members_ready}/{progress.dossier_members_total} parcours individuels sont terminés. Vous pouvez déjà déposer les justificatifs communs ; le bouton de transmission finale se débloquera automatiquement lorsque les deux parcours seront complets.</p>{!progress.partner_activated && <p className="mt-2 text-sm font-semibold text-amber-900">L’autre personne n’a pas encore activé son accès sécurisé.</p>}</div></div></div>}

        {!transmitted && <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-7 sm:px-9">
          <div className="flex items-start justify-between gap-4">
            <div><h3 className="text-lg font-semibold text-slate-950">Votre situation documentaire</h3><p className="mt-1 text-sm leading-6 text-slate-500">Ces réponses permettent de distinguer automatiquement les pièces obligatoires des pièces facultatives. Elles ne remplacent pas votre recueil patrimonial.</p></div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">{completeContexts}/{progress.dossier_members_total} personne{progress.dossier_members_total > 1 ? 's' : ''}</span>
          </div>
          {isStudent && <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900"><strong>Vous avez indiqué être étudiant.</strong> Si vous êtes rattaché au foyer fiscal de vos parents, vous n’avez pas besoin d’un avis d’imposition personnel. Vous pouvez l’indiquer ci-dessous.</div>}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-900">Quelle est votre situation concernant l’avis d’imposition ? *</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {[
                ['personal_notice', 'J’ai un avis personnel ou commun'],
                ['attached_parents', 'Je suis rattaché au foyer fiscal de mes parents'],
                ['no_personal_notice', 'Je n’ai pas d’avis personnel'],
              ].map(([value, label]) => <button key={value} type="button" disabled={contextBusy} onClick={() => void saveContext({ tax_status: value as DocumentContext['tax_status'] })} className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold ${currentContext?.tax_status === value ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{label}</button>)}
            </div>
            {currentContext?.tax_status === 'attached_parents' && <p className="mt-3 text-sm leading-6 text-slate-500">L’avis d’imposition des parents pourra être transmis s’il est utile au dossier, mais il n’est pas considéré comme une pièce personnelle obligatoire.</p>}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {boolChoice('Avez-vous des comptes ou liquidités à intégrer à l’analyse ?', 'has_liquidities', currentContext?.has_liquidities)}
            {boolChoice('Détenez-vous des placements ou produits d’épargne ?', 'has_financial_assets', currentContext?.has_financial_assets)}
            {boolChoice('Détenez-vous un ou plusieurs biens immobiliers ?', 'has_real_estate', currentContext?.has_real_estate)}
            {boolChoice('Avez-vous un ou plusieurs crédits en cours ?', 'has_credits', currentContext?.has_credits)}
            {boolChoice('Détenez-vous une SCI ou une société à intégrer à l’analyse ?', 'has_sci_company', currentContext?.has_sci_company)}
          </div>
        </div>}

        <div className="border-b border-slate-200 px-6 py-7 sm:px-9">
          <div className="flex items-center justify-between gap-4"><div><h3 className="text-lg font-semibold text-slate-950">Pièces attendues</h3><p className="mt-1 text-sm text-slate-500">Cliquez sur « Importer » au niveau de la pièce concernée. La catégorie est sélectionnée automatiquement.</p></div>{missingRequired.length === 0 && allContextsComplete && <CheckCircle2 className="h-6 w-6 text-emerald-600" />}</div>
          {message && <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}
          {errorMessage && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>}
          <div className="mt-5 grid gap-3">
            {requirements.map((item) => {
              const satisfied = item.status !== 'required' || item.receivedCount >= item.expectedCount;
              const active = category === item.category;
              const itemDocs = sources.filter((doc) => doc.categorie === item.category);
              return <div key={item.category} className={`overflow-hidden rounded-2xl border transition ${active ? 'border-blue-400 bg-blue-50/40 ring-2 ring-blue-100' : 'border-slate-200 bg-white'}`}>
                <button type="button" disabled={transmitted} onClick={() => selectCategory(item.category)} className="w-full p-4 text-left disabled:cursor-default">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2"><span className="font-semibold text-slate-900">{item.label}</span>{satisfied && item.receivedCount > 0 && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}</div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(item.status)}`}>{badgeLabel(item.status)}</span>
                      {item.expectedCount > 0 && <span className="text-xs font-semibold text-slate-500">{item.receivedCount}/{item.expectedCount}</span>}
                      {!transmitted && <span className="inline-flex items-center gap-1 rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white">{active ? 'Fermer' : item.receivedCount > 0 ? 'Ajouter' : 'Importer'} <ChevronDown className={`h-3.5 w-3.5 transition ${active ? 'rotate-180' : ''}`} /></span>}
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                </button>

                {active && !transmitted && <form onSubmit={upload} className="border-t border-blue-100 bg-white px-4 py-4 sm:px-5">
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <label className="text-sm font-semibold text-slate-700">Sélectionner le fichier
                      <input type="file" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png" className="mt-2 block w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white" />
                    </label>
                    <button type="submit" disabled={busy || !file} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 disabled:opacity-40">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Transmettre</button>
                  </div>
                  <div className="mt-3"><SecureNote>PDF, DOCX, XLSX, JPG ou PNG — 20 Mo maximum par fichier.</SecureNote></div>
                </form>}

                {itemDocs.length > 0 && <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Déjà transmis</p>
                  <div className="mt-2 space-y-2">{itemDocs.map((doc) => <div key={doc.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5"><p className="min-w-0 truncate text-sm font-medium text-slate-700">{doc.nom_fichier}</p><div className="flex shrink-0 items-center gap-1.5">{doc.storage_path && <button type="button" onClick={() => void openPrivateFile(doc.storage_bucket || SOURCE_DOCUMENTS_BUCKET, doc.storage_path!)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" title="Ouvrir"><Download className="h-4 w-4" /></button>}{!transmitted && <button type="button" disabled={deletingId === doc.id} onClick={() => void deleteSource(doc)} className="rounded-lg border border-red-100 p-2 text-red-500 hover:bg-red-50 disabled:opacity-40" title="Supprimer">{deletingId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button>}</div></div>)}</div>
                </div>}
              </div>;
            })}
          </div>
        </div>

        {transmitted && <div className="px-6 py-7 sm:px-9 sm:py-9"><div className="rounded-2xl bg-emerald-50 p-5 text-emerald-800"><p className="font-semibold">Dossier déjà transmis</p><p className="mt-1 text-sm leading-6">Les justificatifs sont désormais figés afin de préserver la traçabilité de la transmission.</p></div></div>}

        <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-6 sm:px-9">
          <div className="flex items-center justify-between gap-4"><div><h3 className="font-semibold text-slate-950">Documents du dossier</h3><p className="mt-1 text-sm text-slate-500">{sources.length === 0 ? 'Aucun document transmis pour le moment.' : `${sources.length} document${sources.length > 1 ? 's' : ''} enregistré${sources.length > 1 ? 's' : ''} dans le dossier commun.`}</p></div>{sources.length > 0 && <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><FileCheck2 className="h-5 w-5" /></div>}</div>
        </div>

        {!transmitted && <div>
          {finalBlocked && <div className="border-t border-amber-200 bg-amber-50 px-6 py-4 text-sm leading-6 text-amber-900 sm:px-9">{waitingPartner ? 'La transmission reste en attente de l’autre parcours individuel.' : !allContextsComplete ? 'Chaque personne doit d’abord préciser sa situation documentaire.' : `Pièce${missingRequired.length > 1 ? 's' : ''} obligatoire${missingRequired.length > 1 ? 's' : ''} manquante${missingRequired.length > 1 ? 's' : ''} : ${missingRequired.map((item) => item.label).join(', ')}.`}</div>}
          <WizardFooter onPrevious={() => navigate(dossierHref(previousPath, progress.dossier_id))} onNext={() => void finish()} previousLabel="Précédent" nextLabel={finalBlocked ? 'Dossier incomplet' : 'Finaliser et transmettre le dossier'} nextDisabled={finalBlocked} busy={finishBusy} />
        </div>}
      </WizardCard>
      {regulatory.length > 0 && <div className="mt-6 rounded-2xl border border-slate-200 bg-white/80 p-5 backdrop-blur"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><p className="text-sm font-semibold text-slate-800">Documents réglementaires disponibles</p></div><div className="mt-3 space-y-2">{regulatory.map((doc) => { const path = doc.storage_path_pdf || doc.storage_path_docx; return <div key={doc.id} className="flex items-center justify-between text-sm"><span className="capitalize text-slate-600">{doc.type_document.replaceAll('_', ' ')}</span>{path && <button type="button" onClick={() => void openPrivateFile(doc.storage_bucket || REGULATORY_DOCUMENTS_BUCKET, path)} className="inline-flex items-center gap-1.5 font-semibold text-slate-800"><Download className="h-4 w-4" /> Ouvrir</button>}</div>; })}</div></div>}
    </div>
  );
}
