import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, FileCheck2, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { messageFromError } from '../../portal/portalHelpers';

type Allocation = { label: string; montant: number; poids?: number; fonction: string };
type SupportType = 'scpi' | 'assurance_vie' | 'cto' | 'pea';
type Support = { type: SupportType; nom: string; isin?: string; societe_gestion?: string; montant: number; poids?: number; role?: string; description?: string };
type Sequence = { phase: string; operation: string; montant?: number; commentaire?: string };
type Recommendation = {
  id?: string;
  dossier_id: string;
  statut: 'draft' | 'validated';
  diagnostic: string;
  projet_a_preserver: string;
  reserve_securite: number;
  epargne_a_arbitrer: number;
  allocation: Allocation[];
  supports: Record<string, unknown>;
  sequencing: Sequence[];
  fiscal_notes: string[];
  protection_notes: string;
  controls: string[];
  validated_at?: string | null;
};

const supportTypes: SupportType[] = ['scpi', 'assurance_vie', 'cto', 'pea'];
const emptyRecommendation = (dossierId: string): Recommendation => ({ dossier_id: dossierId, statut: 'draft', diagnostic: '', projet_a_preserver: '', reserve_securite: 0, epargne_a_arbitrer: 0, allocation: [], supports: { scpi: [], assurance_vie: [], cto: [], pea: [] }, sequencing: [], fiscal_notes: [], protection_notes: '', controls: [] });
const euro = (value: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value || 0);
const lines = (value: string) => value.split('\n').map((item) => item.trim()).filter(Boolean);

export default function CifAuditPage() {
  const [params] = useSearchParams();
  const dossierId = params.get('dossier') ?? '';
  const [recommendation, setRecommendation] = useState<Recommendation>(() => emptyRecommendation(dossierId));
  const [supports, setSupports] = useState<Support[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [download, setDownload] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!dossierId) throw new Error('Dossier manquant.');
      const { data: current, error: roleError } = await supabase.from('app_users').select('role,actif').maybeSingle();
      if (roleError) throw roleError;
      if (!current?.actif || !['cif', 'admin'].includes(current.role)) throw new Error('Accès réservé au cabinet.');
      const { data, error: loadError } = await supabase.from('audit_recommendations').select('*').eq('dossier_id', dossierId).maybeSingle();
      if (loadError) throw loadError;
      if (!active || !data) return;
      setRecommendation(data as Recommendation);
      const grouped = (data.supports ?? {}) as Record<string, Omit<Support, 'type'>[]>;
      setSupports(supportTypes.flatMap((type) => (grouped[type] ?? []).map((item) => ({ ...item, type }))));
    };
    void load().catch((loadError) => { if (active) setError(messageFromError(loadError)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [dossierId]);

  const allocationTotal = useMemo(() => recommendation.allocation.reduce((sum, item) => sum + (Number(item.montant) || 0), 0), [recommendation.allocation]);
  const markDraft = <T extends object>(state: T, patch: Partial<T>) => ({ ...state, ...patch, statut: 'draft' as const, validated_at: null });
  const updateAllocation = (index: number, patch: Partial<Allocation>) => setRecommendation((current) => markDraft(current, { allocation: current.allocation.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  const updateSequence = (index: number, patch: Partial<Sequence>) => setRecommendation((current) => markDraft(current, { sequencing: current.sequencing.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  const updateSupport = (index: number, patch: Partial<Support>) => setSupports((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const groupedSupports = () => Object.fromEntries(supportTypes.map((type) => [type, supports.filter((support) => support.type === type).map((support) => ({ nom: support.nom, isin: support.isin, societe_gestion: support.societe_gestion, montant: support.montant, poids: support.poids, role: support.role, description: support.description }))]));

  async function save(validate = false) {
    setSaving(true); setError(''); setMessage(''); setDownload(null);
    try {
      const payload = { ...recommendation, statut: validate ? 'validated' : 'draft', validated_at: validate ? new Date().toISOString() : null, supports: groupedSupports(), updated_at: new Date().toISOString() };
      const { data, error: saveError } = await supabase.from('audit_recommendations').upsert(payload, { onConflict: 'dossier_id' }).select('*').single();
      if (saveError) throw saveError;
      setRecommendation(data as Recommendation);
      setMessage(validate ? 'Recommandation validée. L’audit peut être généré.' : 'Brouillon enregistré.');
    } catch (saveError) { setError(messageFromError(saveError)); }
    finally { setSaving(false); }
  }

  async function generate() {
    if (recommendation.statut !== 'validated') { setError('Valide d’abord la recommandation conseiller.'); return; }
    setGenerating(true); setError(''); setMessage('');
    try {
      const { data, error: generationError } = await supabase.functions.invoke('generate-cif-audit', { body: { dossier_id: dossierId } });
      if (generationError) throw generationError;
      if (!data?.ok) throw new Error(data?.error || 'Génération impossible.');
      setDownload(data.signed_url ?? null);
      setMessage(data.reused ? 'Audit existant réutilisé.' : 'Audit généré et archivé.');
    } catch (generationError) { setError(messageFromError(generationError)); }
    finally { setGenerating(false); }
  }

  if (loading) return <div className="min-h-screen bg-slate-50 p-10 text-sm text-slate-500">Chargement de l’audit…</div>;
  if (!dossierId) return <div className="p-10 text-red-700">{error || 'Dossier manquant.'}</div>;

  return <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6"><div className="mx-auto max-w-6xl space-y-6">
    <div>
      <Link to={`/cabinet/synthese?dossier=${encodeURIComponent(dossierId)}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><ArrowLeft className="h-4 w-4" /> Retour à la synthèse</Link>
      <p className="mt-5 text-xs font-bold uppercase tracking-[.16em] text-blue-600">Audit patrimonial</p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-950">Préparation de la recommandation</h1>
      <p className="mt-2 text-sm text-slate-500">Valide l’allocation, les supports, leur présentation client et le séquencement avant de générer le document final.</p>
    </div>
    {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div>}

    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-semibold">Décision patrimoniale</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">Épargne à arbitrer<input type="number" value={recommendation.epargne_a_arbitrer} onChange={(event) => setRecommendation((current) => markDraft(current, { epargne_a_arbitrer: Number(event.target.value) }))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold">Réserve de sécurité<input type="number" value={recommendation.reserve_securite} onChange={(event) => setRecommendation((current) => markDraft(current, { reserve_securite: Number(event.target.value) }))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
      </div>
      <label className="mt-4 block text-sm font-semibold">Projet à préserver<input value={recommendation.projet_a_preserver} onChange={(event) => setRecommendation((current) => markDraft(current, { projet_a_preserver: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
      <label className="mt-4 block text-sm font-semibold">Diagnostic et recommandation<textarea rows={5} value={recommendation.diagnostic} onChange={(event) => setRecommendation((current) => markDraft(current, { diagnostic: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
    </section>

    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">Allocation cible</h2><p className="mt-1 text-sm text-slate-500">Total : {euro(allocationTotal)}</p></div><button onClick={() => setRecommendation((current) => markDraft(current, { allocation: [...current.allocation, { label: '', montant: 0, fonction: '' }] }))} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700"><Plus className="h-4 w-4" /> Ajouter</button></div>
      <div className="mt-5 space-y-3">{recommendation.allocation.map((item, index) => <div key={index} className="grid gap-2 rounded-2xl bg-slate-50 p-3 sm:grid-cols-[1.3fr_.7fr_1.8fr_auto]"><input placeholder="Poche (SCPI, PEA…)" value={item.label} onChange={(event) => updateAllocation(index, { label: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2" /><input type="number" placeholder="Montant" value={item.montant} onChange={(event) => updateAllocation(index, { montant: Number(event.target.value) })} className="rounded-xl border border-slate-200 px-3 py-2" /><input placeholder="Fonction patrimoniale" value={item.fonction} onChange={(event) => updateAllocation(index, { fonction: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2" /><button onClick={() => setRecommendation((current) => markDraft(current, { allocation: current.allocation.filter((_, itemIndex) => itemIndex !== index) }))} className="rounded-xl p-2 text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>)}</div>
    </section>

    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">Supports sélectionnés</h2><p className="mt-1 text-sm text-slate-500">La description client doit rester courte : nature du support, exposition et rôle dans l’allocation.</p></div><button onClick={() => { setSupports((current) => [...current, { type: 'scpi', nom: '', montant: 0 }]); setRecommendation((current) => markDraft(current, {})); }} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700"><Plus className="h-4 w-4" /> Ajouter</button></div>
      <div className="mt-5 space-y-4">{supports.map((item, index) => <div key={index} className="rounded-2xl bg-slate-50 p-4"><div className="grid gap-2 lg:grid-cols-[.7fr_1.5fr_1.2fr_.7fr_.6fr_auto]"><select value={item.type} onChange={(event) => { updateSupport(index, { type: event.target.value as SupportType }); setRecommendation((current) => markDraft(current, {})); }} className="rounded-xl border border-slate-200 px-3 py-2"><option value="scpi">SCPI</option><option value="assurance_vie">Assurance-vie</option><option value="cto">CTO</option><option value="pea">PEA</option></select><input placeholder="Support" value={item.nom} onChange={(event) => { updateSupport(index, { nom: event.target.value }); setRecommendation((current) => markDraft(current, {})); }} className="rounded-xl border border-slate-200 px-3 py-2" /><input placeholder="ISIN / société" value={item.isin ?? item.societe_gestion ?? ''} onChange={(event) => { updateSupport(index, { isin: event.target.value, societe_gestion: event.target.value }); setRecommendation((current) => markDraft(current, {})); }} className="rounded-xl border border-slate-200 px-3 py-2" /><input type="number" placeholder="Montant" value={item.montant} onChange={(event) => { updateSupport(index, { montant: Number(event.target.value) }); setRecommendation((current) => markDraft(current, {})); }} className="rounded-xl border border-slate-200 px-3 py-2" /><input type="number" placeholder="%" value={item.poids ?? ''} onChange={(event) => { updateSupport(index, { poids: Number(event.target.value) }); setRecommendation((current) => markDraft(current, {})); }} className="rounded-xl border border-slate-200 px-3 py-2" /><button onClick={() => { setSupports((current) => current.filter((_, itemIndex) => itemIndex !== index)); setRecommendation((current) => markDraft(current, {})); }} className="rounded-xl p-2 text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div><textarea rows={2} placeholder="Description courte pour le client. Exemple : SCPI diversifiée à dominante internationale, investie sur plusieurs typologies d’actifs immobiliers professionnels." value={item.description ?? ''} onChange={(event) => { updateSupport(index, { description: event.target.value }); setRecommendation((current) => markDraft(current, {})); }} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2" /><input placeholder="Rôle dans l’allocation" value={item.role ?? ''} onChange={(event) => { updateSupport(index, { role: event.target.value }); setRecommendation((current) => markDraft(current, {})); }} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2" /></div>)}</div>
    </section>

    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">Séquencement</h2><p className="mt-1 text-sm text-slate-500">Ordre prévu pour la mise en œuvre des opérations.</p></div><button onClick={() => setRecommendation((current) => markDraft(current, { sequencing: [...current.sequencing, { phase: '', operation: '' }] }))} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700"><Plus className="h-4 w-4" /> Ajouter</button></div>
      <div className="mt-5 space-y-3">{recommendation.sequencing.map((item, index) => <div key={index} className="grid gap-2 rounded-2xl bg-slate-50 p-3 sm:grid-cols-[.7fr_1.8fr_.7fr_1.4fr_auto]"><input placeholder="Phase" value={item.phase} onChange={(event) => updateSequence(index, { phase: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2" /><input placeholder="Opération" value={item.operation} onChange={(event) => updateSequence(index, { operation: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2" /><input type="number" placeholder="Montant" value={item.montant ?? ''} onChange={(event) => updateSequence(index, { montant: event.target.value === '' ? undefined : Number(event.target.value) })} className="rounded-xl border border-slate-200 px-3 py-2" /><input placeholder="Commentaire" value={item.commentaire ?? ''} onChange={(event) => updateSequence(index, { commentaire: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2" /><button onClick={() => setRecommendation((current) => markDraft(current, { sequencing: current.sequencing.filter((_, itemIndex) => itemIndex !== index) }))} className="rounded-xl p-2 text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>)}</div>
    </section>

    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-semibold">Notes et contrôles</h2>
      <label className="mt-4 block text-sm font-semibold">Fiscalité — une conclusion par ligne<textarea rows={4} value={recommendation.fiscal_notes.join('\n')} onChange={(event) => setRecommendation((current) => markDraft(current, { fiscal_notes: lines(event.target.value) }))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
      <label className="mt-4 block text-sm font-semibold">Protection<textarea rows={3} value={recommendation.protection_notes} onChange={(event) => setRecommendation((current) => markDraft(current, { protection_notes: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
      <label className="mt-4 block text-sm font-semibold">Contrôles avant exécution — un par ligne<textarea rows={4} value={recommendation.controls.join('\n')} onChange={(event) => setRecommendation((current) => markDraft(current, { controls: lines(event.target.value) }))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
    </section>

    <div className="sticky bottom-4 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
      <span className={`mr-auto rounded-full px-3 py-2 text-xs font-bold ${recommendation.statut === 'validated' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{recommendation.statut === 'validated' ? 'Recommandation validée' : 'Brouillon'}</span>
      <button disabled={saving} onClick={() => { void save(false); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold"><Save className="h-4 w-4" /> Enregistrer</button>
      <button disabled={saving} onClick={() => { void save(true); }} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"><FileCheck2 className="h-4 w-4" /> Valider la recommandation</button>
      <button disabled={generating || recommendation.statut !== 'validated'} onClick={() => { void generate(); }} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />} Générer l’audit</button>
      {download && <a href={download} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><Download className="h-4 w-4" /> Télécharger</a>}
    </div>
  </div></div>;
}
