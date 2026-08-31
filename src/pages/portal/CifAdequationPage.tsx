import { useEffect, useState } from 'react';
import { ArrowLeft, Download, FileCheck2, Loader2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { messageFromError } from '../../portal/portalHelpers';

type Source = {
  dossier_id: string;
  audit_recommendation_id: string;
  validated_at: string;
  diagnostic: string;
  allocation: Array<{ label?: string; poche?: string; montant?: number; fonction?: string }>;
  supports: Record<string, Array<{ nom?: string; support?: string; montant?: number; role?: string }>>;
};

const euro = (value: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value || 0);

export default function CifAdequationPage() {
  const [params] = useSearchParams();
  const dossierId = params.get('dossier') ?? '';
  const [source, setSource] = useState<Source | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [download, setDownload] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!dossierId) throw new Error('Dossier manquant.');
      const { data: current, error: roleError } = await supabase.from('app_users').select('role,actif').maybeSingle();
      if (roleError) throw roleError;
      if (!current?.actif || !['cif', 'admin'].includes(current.role)) throw new Error('Accès réservé au cabinet.');
      const { data, error: sourceError } = await supabase.from('adequation_source').select('*').eq('dossier_id', dossierId).maybeSingle();
      if (sourceError) throw sourceError;
      if (active) setSource((data as Source | null) ?? null);
    };
    void load().catch((e) => { if (active) setError(messageFromError(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [dossierId]);

  async function generate() {
    if (!source) { setError('Valide d’abord la recommandation dans l’audit patrimonial.'); return; }
    setGenerating(true); setError(''); setMessage('');
    try {
      const { data, error: generationError } = await supabase.functions.invoke('generate-cif-adequation', { body: { dossier_id: dossierId } });
      if (generationError) throw generationError;
      if (!data?.ok) throw new Error(data?.error || 'Génération impossible.');
      setDownload(data.signed_url ?? null);
      setMessage(data.reused ? 'Déclaration existante réutilisée.' : 'Déclaration d’adéquation générée et archivée.');
    } catch (e) { setError(messageFromError(e)); }
    finally { setGenerating(false); }
  }

  if (loading) return <div className="min-h-screen bg-slate-50 p-10 text-sm text-slate-500">Chargement de la déclaration d’adéquation…</div>;

  return <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6"><div className="mx-auto max-w-5xl space-y-6">
    <div>
      <Link to={`/cabinet/audit?dossier=${encodeURIComponent(dossierId)}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><ArrowLeft className="h-4 w-4" /> Retour à l’audit</Link>
      <p className="mt-5 text-xs font-bold uppercase tracking-[.16em] text-blue-600">Déclaration d’adéquation</p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-950">Génération réglementaire</h1>
      <p className="mt-2 text-sm text-slate-500">La déclaration reprend exclusivement la dernière recommandation d’audit validée. L’allocation et les supports ne sont pas recalculés ici.</p>
    </div>

    {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div>}

    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">Source validée</h2><p className="mt-1 text-sm text-slate-500">{source ? `Audit validé le ${new Date(source.validated_at).toLocaleDateString('fr-FR')}` : 'Aucune recommandation validée disponible.'}</p></div><span className={`rounded-full px-3 py-2 text-xs font-bold ${source ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{source ? 'Prêt à générer' : 'Audit à valider'}</span></div>
      {source && <><p className="mt-5 text-sm leading-6 text-slate-700">{source.diagnostic}</p><div className="mt-5 overflow-hidden rounded-2xl border border-slate-200"><div className="grid grid-cols-[1.2fr_.7fr_1.5fr] bg-slate-900 px-4 py-3 text-xs font-bold uppercase tracking-wide text-white"><span>Poche</span><span>Montant</span><span>Fonction</span></div>{(source.allocation ?? []).map((item, index) => <div key={index} className="grid grid-cols-[1.2fr_.7fr_1.5fr] border-t border-slate-100 px-4 py-3 text-sm"><span>{item.label ?? item.poche}</span><span>{euro(Number(item.montant) || 0)}</span><span>{item.fonction}</span></div>)}</div></>}
    </section>

    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-semibold">Règles de génération</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600"><strong className="text-slate-900">Allocation</strong><p className="mt-1">Reprise à l’identique depuis l’audit validé.</p></div><div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600"><strong className="text-slate-900">Coûts et frais</strong><p className="mt-1">Les informations ex ante restent remises séparément avant souscription.</p></div><div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600"><strong className="text-slate-900">Signature</strong><p className="mt-1">Cadres clients et conseiller prévus pour la signature manuelle via Youtrust.</p></div><div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600"><strong className="text-slate-900">Archivage</strong><p className="mt-1">PDF archivé avec hash et référence de l’audit validé.</p></div></div>
    </section>

    <div className="flex flex-wrap justify-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><button disabled={!source || generating} onClick={() => { void generate(); }} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />} Générer la déclaration</button>{download && <a href={download} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-800"><Download className="h-4 w-4" /> Télécharger</a>}</div>
  </div></div>;
}
