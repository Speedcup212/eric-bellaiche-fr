import { useEffect, useMemo, useState } from 'react';
import { Download, FileUp, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { REGULATORY_DOCUMENTS_BUCKET, SOURCE_DOCUMENTS_BUCKET, supabase } from '../../lib/supabase';
import { fetchPortalProgress, messageFromError, selectedProgress, type PortalProgress } from '../../portal/portalHelpers';

interface SourceDocument {
  id: string;
  categorie: string;
  nom_fichier: string;
  storage_bucket: string | null;
  storage_path: string | null;
  statut_analyse: string;
  created_at: string;
}

interface RegulatoryDocument {
  id: string;
  type_document: string;
  statut: string;
  storage_bucket: string | null;
  storage_path_pdf: string | null;
  storage_path_docx: string | null;
  date_generation: string | null;
}

const categories = [
  ['avis_imposition', 'Avis d’imposition'],
  ['tableau_amortissement', 'Tableau d’amortissement'],
  ['patrimoine_financier', 'Patrimoine financier / relevé'],
  ['patrimoine_immobilier', 'Patrimoine immobilier'],
  ['identite', 'Pièce d’identité'],
  ['autre', 'Autre document'],
] as const;

function safeName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-');
}

export default function ClientDocumentsPage() {
  const [searchParams] = useSearchParams();
  const [progressRows, setProgressRows] = useState<PortalProgress[]>([]);
  const [sources, setSources] = useState<SourceDocument[]>([]);
  const [regulatory, setRegulatory] = useState<RegulatoryDocument[]>([]);
  const [category, setCategory] = useState<string>('avis_imposition');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
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
    void fetchPortalProgress().then((rows) => {
      setProgressRows(rows);
      const row = selectedProgress(rows, dossierId);
      if (row) return loadDocuments(row);
      return undefined;
    }).catch((error) => setErrorMessage(messageFromError(error)));
  }, [dossierId]);

  const upload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!progress || !file) return;
    if (file.size > 20 * 1024 * 1024) {
      setErrorMessage('Le fichier dépasse la limite de 20 Mo.');
      return;
    }
    setBusy(true);
    setMessage('');
    setErrorMessage('');
    const path = `${progress.dossier_id}/${crypto.randomUUID()}-${safeName(file.name)}`;
    try {
      const { error: uploadError } = await supabase.storage.from(SOURCE_DOCUMENTS_BUCKET).upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { error: registerError } = await supabase.rpc('register_source_document', {
        p_dossier_id: progress.dossier_id,
        p_investisseur_id: progress.investisseur_id,
        p_categorie: category,
        p_nom_fichier: file.name,
        p_storage_path: path,
        p_date_document: null,
        p_annee_reference: null,
      });
      if (registerError) {
        await supabase.storage.from(SOURCE_DOCUMENTS_BUCKET).remove([path]);
        throw registerError;
      }
      setFile(null);
      setMessage('Document transmis au cabinet.');
      await loadDocuments(progress);
    } catch (error) {
      setErrorMessage(messageFromError(error));
    } finally {
      setBusy(false);
    }
  };

  const openPrivateFile = async (bucket: string, path: string) => {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 90);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Pièces et justificatifs</p>
        <h2 className="mt-2 text-3xl font-semibold">Documents</h2>
        <p className="mt-3 text-slate-600">Déposez les pièces nécessaires au préremplissage et à la vérification de votre dossier. Les documents sont stockés dans un espace privé.</p>
      </div>

      <form onSubmit={upload} className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <h3 className="text-lg font-semibold">Transmettre un document</h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Type de document
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3">
              {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Fichier
            <input type="file" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 text-sm" />
          </label>
        </div>
        {message && <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}
        {errorMessage && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>}
        <button disabled={busy || !progress} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Envoyer
        </button>
      </form>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <h3 className="text-lg font-semibold">Pièces transmises</h3>
        <div className="mt-5 divide-y divide-slate-100">
          {sources.length === 0 && <p className="py-4 text-sm text-slate-500">Aucune pièce transmise.</p>}
          {sources.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between gap-4 py-4">
              <div><p className="font-medium">{doc.nom_fichier}</p><p className="text-xs text-slate-500">{doc.categorie} · {doc.statut_analyse}</p></div>
              {doc.storage_path && <button onClick={() => void openPrivateFile(doc.storage_bucket || SOURCE_DOCUMENTS_BUCKET, doc.storage_path!)} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50" title="Télécharger"><Download className="h-4 w-4" /></button>}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <h3 className="text-lg font-semibold">Documents réglementaires disponibles</h3>
        <div className="mt-5 divide-y divide-slate-100">
          {regulatory.length === 0 && <p className="py-4 text-sm text-slate-500">Aucun document réglementaire n’est encore disponible.</p>}
          {regulatory.map((doc) => {
            const path = doc.storage_path_pdf || doc.storage_path_docx;
            return <div key={doc.id} className="flex items-center justify-between gap-4 py-4">
              <div><p className="font-medium">{doc.type_document.replaceAll('_', ' ')}</p><p className="text-xs text-slate-500">Statut : {doc.statut}</p></div>
              {path && <button onClick={() => void openPrivateFile(doc.storage_bucket || REGULATORY_DOCUMENTS_BUCKET, path)} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50" title="Télécharger"><Download className="h-4 w-4" /></button>}
            </div>;
          })}
        </div>
      </section>
    </div>
  );
}
