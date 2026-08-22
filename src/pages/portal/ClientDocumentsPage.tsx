import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, FileCheck2, FileUp, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { JourneyProgress, PageIntro, SecureNote, WizardCard, WizardFooter } from '../../portal/FintechJourney';
import { REGULATORY_DOCUMENTS_BUCKET, SOURCE_DOCUMENTS_BUCKET, supabase } from '../../lib/supabase';
import { dossierHref, fetchPortalProgress, messageFromError, nextStepHref, selectedProgress, type PortalProgress } from '../../portal/portalHelpers';

interface SourceDocument { id: string; categorie: string; nom_fichier: string; storage_bucket: string | null; storage_path: string | null; statut_analyse: string; created_at: string; }
interface RegulatoryDocument { id: string; type_document: string; statut: string; storage_bucket: string | null; storage_path_pdf: string | null; storage_path_docx: string | null; date_generation: string | null; }

const categories = [
  ['avis_imposition', 'Avis d’imposition'],
  ['tableau_amortissement', 'Tableau d’amortissement / prêt'],
  ['comptes_liquidites', 'Comptes bancaires / liquidités'],
  ['patrimoine_financier', 'Placements / épargne'],
  ['patrimoine_immobilier', 'Bien immobilier / acte notarié'],
  ['sci_societe', 'SCI / société'],
  ['autre', 'Autre document'],
] as const;

const legacyCategoryLabels: Record<string, string> = {
  identite: 'Pièce d’identité',
  justificatif_domicile: 'Justificatif de domicile',
};

function safeName(name: string): string { return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-'); }
function categoryLabel(value: string) { return categories.find(([code]) => code === value)?.[1] ?? legacyCategoryLabels[value] ?? value.replaceAll('_', ' '); }

export default function ClientDocumentsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [progressRows, setProgressRows] = useState<PortalProgress[]>([]);
  const [sources, setSources] = useState<SourceDocument[]>([]);
  const [regulatory, setRegulatory] = useState<RegulatoryDocument[]>([]);
  const [category, setCategory] = useState<string>('avis_imposition');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [finishBusy, setFinishBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const dossierId = searchParams.get('dossier');
  const progress = useMemo(() => selectedProgress(progressRows, dossierId), [progressRows, dossierId]);

  const loadDocuments = async (row: PortalProgress) => {
    const [{ data: sourceData, error: sourceError }, { data: regulatoryData, error: regulatoryError }] = await Promise.all([
      supabase.from('documents_sources').select('id,categorie,nom_fichier,storage_bucket,storage_path,statut_analyse,created_at').eq('dossier_id', row.dossier_id).order('created_at', { ascending: false }),
      supabase.from('documents_reglementaires').select('id,type_document,statut,storage_bucket,storage_path_pdf,storage_path_docx,date_generation').eq('dossier_id', row.dossier_id).order('created_at', { ascending: false }),
    ]);
    if (sourceError) throw sourceError;
    if (regulatoryError) throw regulatoryError;
    setSources((sourceData ?? []) as SourceDocument[]);
    setRegulatory((regulatoryData ?? []) as RegulatoryDocument[]);
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

  const upload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!progress || !file || progress.transmitted_at) return;
    if (file.size > 20 * 1024 * 1024) { setErrorMessage('Le fichier dépasse la limite de 20 Mo.'); return; }
    setBusy(true); setMessage(''); setErrorMessage('');
    const path = `${progress.dossier_id}/${crypto.randomUUID()}-${safeName(file.name)}`;
    try {
      const { error: uploadError } = await supabase.storage.from(SOURCE_DOCUMENTS_BUCKET).upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { error: registerError } = await supabase.rpc('register_source_document', { p_dossier_id: progress.dossier_id, p_investisseur_id: progress.investisseur_id, p_categorie: category, p_nom_fichier: file.name, p_storage_path: path, p_date_document: null, p_annee_reference: null });
      if (registerError) { await supabase.storage.from(SOURCE_DOCUMENTS_BUCKET).remove([path]); throw registerError; }
      setFile(null);
      const input = document.getElementById('client-document-file') as HTMLInputElement | null; if (input) input.value = '';
      setMessage('Document transmis. Vous pouvez en ajouter un autre avant de finaliser votre dossier.');
      await loadDocuments(progress);
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

  return (
    <div>
      <JourneyProgress current="documents" esgEnabled={progress.esg_opt_in !== false} />
      <PageIntro eyebrow="Dernière étape" title="Transmettre vos documents" description="Vous avez terminé les questionnaires. Déposez maintenant vos justificatifs : les informations utiles seront associées à votre dossier sans nouvelle saisie de votre part." icon={<UploadCloud className="h-5 w-5" />} />
      <WizardCard>
        {!transmitted ? (
          <div className="px-6 py-7 sm:px-9 sm:py-9">
            <h3 className="text-xl font-semibold text-slate-950">Ajouter un justificatif</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">Choisissez la catégorie, puis sélectionnez un PDF, un scan ou une capture d’écran lisible. Vous pouvez transmettre autant de documents que nécessaire.</p>
            <form onSubmit={upload} className="mt-7 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">Type de document<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none transition focus:border-slate-400 focus:bg-white">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="text-sm font-semibold text-slate-700">Fichier<input id="client-document-file" type="file" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png" className="mt-2 block w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white" /></label>
              </div>
              <SecureNote>Formats acceptés : PDF, DOCX, XLSX, JPG et PNG. Taille maximale : 20 Mo par fichier.</SecureNote>
              {message && <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}
              {errorMessage && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>}
              <button disabled={busy || !file} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 disabled:opacity-40">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Transmettre ce document</button>
            </form>
          </div>
        ) : (
          <div className="px-6 py-7 sm:px-9 sm:py-9">
            <div className="rounded-2xl bg-emerald-50 p-5 text-emerald-800"><p className="font-semibold">Dossier déjà transmis</p><p className="mt-1 text-sm leading-6">Les justificatifs sont désormais figés afin de préserver la traçabilité de la transmission.</p></div>
          </div>
        )}

        <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-6 sm:px-9">
          <div className="flex items-center justify-between gap-4"><div><h3 className="font-semibold text-slate-950">Documents transmis</h3><p className="mt-1 text-sm text-slate-500">{sources.length === 0 ? 'Aucun document transmis pour le moment.' : `${sources.length} document${sources.length > 1 ? 's' : ''} déjà enregistré${sources.length > 1 ? 's' : ''}.`}</p></div>{sources.length > 0 && <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><FileCheck2 className="h-5 w-5" /></div>}</div>
          {sources.length > 0 && <div className="mt-5 divide-y divide-slate-200/70 rounded-2xl border border-slate-200 bg-white px-4">{sources.map((doc) => <div key={doc.id} className="flex items-center justify-between gap-4 py-4"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{doc.nom_fichier}</p><p className="mt-1 text-xs text-slate-400">{categoryLabel(doc.categorie)}</p></div><div className="flex shrink-0 items-center gap-2">{doc.storage_path && <button type="button" onClick={() => void openPrivateFile(doc.storage_bucket || SOURCE_DOCUMENTS_BUCKET, doc.storage_path!)} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" title="Ouvrir"><Download className="h-4 w-4" /></button>}{!transmitted && <button type="button" disabled={deletingId === doc.id} onClick={() => void deleteSource(doc)} className="rounded-xl border border-red-100 p-2 text-red-500 transition hover:bg-red-50 disabled:opacity-40" title="Supprimer ce justificatif">{deletingId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button>}</div></div>)}</div>}
        </div>
        {!transmitted && <WizardFooter onPrevious={() => navigate(dossierHref(previousPath, progress.dossier_id))} onNext={() => void finish()} previousLabel="Précédent" nextLabel="Finaliser et transmettre" nextDisabled={sources.length === 0} busy={finishBusy} />}
      </WizardCard>
      {regulatory.length > 0 && <div className="mt-6 rounded-2xl border border-slate-200 bg-white/80 p-5 backdrop-blur"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><p className="text-sm font-semibold text-slate-800">Documents réglementaires disponibles</p></div><div className="mt-3 space-y-2">{regulatory.map((doc) => { const path = doc.storage_path_pdf || doc.storage_path_docx; return <div key={doc.id} className="flex items-center justify-between text-sm"><span className="capitalize text-slate-600">{doc.type_document.replaceAll('_', ' ')}</span>{path && <button type="button" onClick={() => void openPrivateFile(doc.storage_bucket || REGULATORY_DOCUMENTS_BUCKET, path)} className="inline-flex items-center gap-1.5 font-semibold text-slate-800"><Download className="h-4 w-4" /> Ouvrir</button>}</div>; })}</div></div>}
    </div>
  );
}
