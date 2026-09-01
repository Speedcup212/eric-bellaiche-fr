const fs = require('fs');

const file = 'src/pages/portal/CifAdminPage.tsx';
let src = fs.readFileSync(file, 'utf8');

function replaceOnce(from, to, label) {
  if (!src.includes(from)) {
    if (src.includes(to)) return;
    throw new Error(`Patch target not found: ${label}`);
  }
  src = src.replace(from, to);
}

replaceOnce(
  "  Sparkles,\n  UserRound,",
  "  Sparkles,\n  Trash2,\n  UserRound,",
  'Trash2 import',
);

replaceOnce(
  "  const [busy, setBusy] = useState(false);\n  const [search, setSearch] = useState('');",
  "  const [busy, setBusy] = useState(false);\n  const [deletingId, setDeletingId] = useState<string | null>(null);\n  const [search, setSearch] = useState('');",
  'deleting state',
);

const deleteFunction = `  const deleteDossier = async (row: DossierView) => {
    const label = clientLabel(row);
    const confirmed = window.confirm(
      \`Supprimer définitivement le dossier « \${label} » ?\\n\\nLe recueil, le profil investisseur, l’ESG, les documents et les données rattachées à ce dossier seront supprimés. Cette action est irréversible.\`,
    );
    if (!confirmed) return;

    setDeletingId(row.id);
    setErrorMessage('');
    setMessage('');
    try {
      const [sourcesResult, regulatoryResult] = await Promise.all([
        supabase.from('documents_sources').select('storage_bucket,storage_path').eq('dossier_id', row.id),
        supabase.from('documents_reglementaires').select('storage_bucket,storage_path_docx,storage_path_pdf').eq('dossier_id', row.id),
      ]);
      if (sourcesResult.error) throw sourcesResult.error;
      if (regulatoryResult.error) throw regulatoryResult.error;

      const filesByBucket = new Map<string, string[]>();
      const addFile = (bucket?: string | null, path?: string | null) => {
        if (!bucket || !path) return;
        filesByBucket.set(bucket, [...(filesByBucket.get(bucket) ?? []), path]);
      };

      (sourcesResult.data ?? []).forEach((doc) => addFile(doc.storage_bucket, doc.storage_path));
      (regulatoryResult.data ?? []).forEach((doc) => {
        addFile(doc.storage_bucket, doc.storage_path_docx);
        addFile(doc.storage_bucket, doc.storage_path_pdf);
      });

      for (const [bucket, paths] of filesByBucket.entries()) {
        const uniquePaths = [...new Set(paths)];
        if (!uniquePaths.length) continue;
        const { error } = await supabase.storage.from(bucket).remove(uniquePaths);
        if (error) throw error;
      }

      const { error } = await supabase.from('dossiers').delete().eq('id', row.id);
      if (error) throw error;

      setRows((current) => current.filter((item) => item.id !== row.id));
      setMessage(\`Dossier supprimé : \${label}.\`);
    } catch (error) {
      setErrorMessage(messageFromError(error));
    } finally {
      setDeletingId(null);
    }
  };

`;

replaceOnce(
  "  const filteredRows = useMemo(() => {",
  deleteFunction + "  const filteredRows = useMemo(() => {",
  'delete function',
);

const oldActions = `<div className="flex flex-wrap gap-2 xl:justify-end"><a href={\`/cabinet/synthese?dossier=\${encodeURIComponent(row.id)}\`} className="inline-flex items-center gap-2 rounded-xl bg-[#0F172A] px-3.5 py-2.5 text-sm font-semibold text-white">Ouvrir le dossier <ChevronRight className="h-4 w-4" /></a><a href={\`/cabinet/audit?dossier=\${encodeURIComponent(row.id)}\`} className="inline-flex items-center gap-2 rounded-xl border border-[#D9E5F5] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#0F172A]"><BarChart3 className="h-4 w-4" /> Audit</a><a href={\`/cabinet/adequation?dossier=\${encodeURIComponent(row.id)}\`} className="inline-flex items-center gap-2 rounded-xl border border-[#D9E5F5] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#0F172A]"><FileCheck2 className="h-4 w-4" /> Adéquation</a><button onClick={() => void listInvestors(row.id)} className="inline-flex items-center gap-2 rounded-xl border border-[#D9E5F5] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#0F172A]"><Mail className="h-4 w-4" /> Inviter</button></div>`;

const newActions = `<div className="flex flex-wrap gap-2 xl:justify-end"><a href={\`/cabinet/synthese?dossier=\${encodeURIComponent(row.id)}\`} className="inline-flex items-center gap-2 rounded-xl bg-[#0F172A] px-3.5 py-2.5 text-sm font-semibold text-white">Ouvrir le dossier <ChevronRight className="h-4 w-4" /></a><a href={\`/cabinet/audit?dossier=\${encodeURIComponent(row.id)}\`} className="inline-flex items-center gap-2 rounded-xl border border-[#D9E5F5] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#0F172A]"><BarChart3 className="h-4 w-4" /> Audit</a><a href={\`/cabinet/adequation?dossier=\${encodeURIComponent(row.id)}\`} className="inline-flex items-center gap-2 rounded-xl border border-[#D9E5F5] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#0F172A]"><FileCheck2 className="h-4 w-4" /> Adéquation</a><button onClick={() => void listInvestors(row.id)} className="inline-flex items-center gap-2 rounded-xl border border-[#D9E5F5] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#0F172A]"><Mail className="h-4 w-4" /> Inviter</button><button type="button" disabled={deletingId === row.id} onClick={() => void deleteDossier(row)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50" title="Supprimer définitivement ce dossier"><Trash2 className="h-4 w-4" /> {deletingId === row.id ? 'Suppression…' : 'Supprimer'}</button></div>`;

replaceOnce(oldActions, newActions, 'delete button');

fs.writeFileSync(file, src);
console.log('Cabinet dossier deletion UI patched.');
