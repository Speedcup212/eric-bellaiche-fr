import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, Filter, Mail, RefreshCw, Search, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { messageFromError } from '../../portal/portalHelpers';

type ProspectStatus = 'new' | 'booked' | 'qualified' | 'mission' | 'nurturing' | 'closed';
type Qualification = 'A' | 'B' | 'C';

interface ProspectLead {
  id: string;
  created_at: string;
  first_name: string;
  email: string;
  age_band: string | null;
  household_status: string | null;
  professional_status: string | null;
  income_band: string | null;
  real_estate_band: string | null;
  financial_assets_band: string | null;
  savings_band: string | null;
  primary_goal: string | null;
  horizon: string | null;
  income_tax_band: string | null;
  event_12m: string | null;
  qualification: Qualification;
  marketing_consent: boolean;
  status: ProspectStatus;
  result_snapshot: Record<string, unknown> | null;
}

const labels: Record<string, Record<string, string>> = {
  professional_status: { salarie: 'Salarié', dirigeant: 'Dirigeant', tns: 'TNS / libéral', retraite: 'Retraité', autre: 'Autre' },
  income_band: { lt35: '< 35 k€', '35_60': '35–60 k€', '60_90': '60–90 k€', '90_150': '90–150 k€', '150plus': '≥ 150 k€' },
  real_estate_band: { none: 'Aucun', lt200: '< 200 k€', '200_400': '200–400 k€', '400_700': '400–700 k€', '700_1200': '700 k€–1,2 M€', '1200plus': '≥ 1,2 M€' },
  financial_assets_band: { lt20: '< 20 k€', '20_50': '20–50 k€', '50_100': '50–100 k€', '100_250': '100–250 k€', '250_500': '250–500 k€', '500plus': '≥ 500 k€' },
  savings_band: { lt300: '< 300 €', '300_700': '300–700 €', '700_1500': '700–1 500 €', '1500_3000': '1 500–3 000 €', '3000plus': '≥ 3 000 €' },
  primary_goal: { placements: 'Placements', revenus: 'Revenus complémentaires', retraite: 'Retraite', fiscalite: 'Fiscalité', immobilier: 'Immobilier', transmission: 'Transmission', tresorerie: 'Trésorerie entreprise', autre: 'Autre' },
  horizon: { '12m': '< 12 mois', '1_3y': '1–3 ans', later: 'Plus tard' },
  income_tax_band: { lt1500: '< 1 500 €', '1500_3000': '1 500–3 000 €', '3000_6000': '3 000–6 000 €', '6000_12000': '6 000–12 000 €', '12000plus': '≥ 12 000 €', unknown: 'Inconnu' },
  event_12m: { vente: 'Vente immobilière', succession: 'Succession / donation', cession: 'Cession entreprise', retraite: 'Départ retraite', capital: 'Capital prochainement disponible', none: 'Aucun' },
};

function label(field: string, value: string | null) {
  if (!value) return '—';
  return labels[field]?.[value] ?? value;
}

function qualificationClass(q: Qualification) {
  if (q === 'A') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (q === 'B') return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

export default function CifProspectsPage() {
  const [rows, setRows] = useState<ProspectLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | Qualification>('all');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: queryError } = await supabase
        .from('prospect_leads')
        .select('id,created_at,first_name,email,age_band,household_status,professional_status,income_band,real_estate_band,financial_assets_band,savings_band,primary_goal,horizon,income_tax_band,event_12m,qualification,marketing_consent,status,result_snapshot')
        .order('created_at', { ascending: false });
      if (queryError) throw queryError;
      setRows((data ?? []) as ProspectLead[]);
    } catch (e) {
      setError(messageFromError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const updateStatus = async (id: string, status: ProspectStatus) => {
    const { error: updateError } = await supabase.from('prospect_leads').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (updateError) { setError(messageFromError(updateError)); return; }
    setRows((current) => current.map((row) => row.id === id ? { ...row, status } : row));
  };

  const remove = async (row: ProspectLead) => {
    if (!window.confirm(`Supprimer le prospect ${row.first_name} (${row.email}) ?`)) return;
    const { error: deleteError } = await supabase.from('prospect_leads').delete().eq('id', row.id);
    if (deleteError) { setError(messageFromError(deleteError)); return; }
    setRows((current) => current.filter((item) => item.id !== row.id));
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== 'all' && row.qualification !== filter) return false;
      if (!q) return true;
      return [row.first_name, row.email, label('primary_goal', row.primary_goal), label('professional_status', row.professional_status)]
        .some((value) => value.toLowerCase().includes(q));
    });
  }, [rows, search, filter]);

  const counts = rows.reduce((acc, row) => ({ ...acc, [row.qualification]: (acc[row.qualification] ?? 0) + 1 }), { A: 0, B: 0, C: 0 } as Record<Qualification, number>);

  return (
    <div className="min-h-screen bg-[#F6F9FD] text-[#0F172A]">
      <header className="border-b border-slate-200 bg-[#0B172A] text-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D8BD7E]">Cabinet Eric Bellaiche</p>
            <h1 className="mt-1 text-2xl font-semibold">Prospects — photographie patrimoniale</h1>
          </div>
          <a href="/cabinet" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/10"><ArrowLeft className="h-4 w-4"/>Retour aux dossiers</a>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-6 p-5 lg:p-7">
        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Total leads</p><p className="mt-2 text-3xl font-semibold">{rows.length}</p></div>
          {(['A','B','C'] as Qualification[]).map((q) => <div key={q} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Catégorie {q}</p><p className="mt-2 text-3xl font-semibold">{counts[q]}</p></div>)}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2"><Search className="h-4 w-4 text-slate-400"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un prénom, email, objectif…" className="w-full bg-transparent text-sm outline-none"/></div>
            <div className="flex flex-wrap items-center gap-2"><Filter className="h-4 w-4 text-slate-400"/>{(['all','A','B','C'] as const).map((value) => <button key={value} onClick={() => setFilter(value)} className={`rounded-xl px-3 py-2 text-sm font-semibold ${filter === value ? 'bg-[#0B172A] text-white' : 'bg-slate-100 text-slate-700'}`}>{value === 'all' ? 'Tous' : `Cat. ${value}`}</button>)}<button onClick={() => void load()} className="rounded-xl border border-slate-200 p-2 text-slate-600"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/></button></div>
          </div>
        </section>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <section className="space-y-3">
          {filtered.map((row) => (
            <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{row.first_name}</h2>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${qualificationClass(row.qualification)}`}>Catégorie {row.qualification}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{new Date(row.created_at).toLocaleString('fr-FR', { dateStyle:'short', timeStyle:'short' })}</span>
                  </div>
                  <a href={`mailto:${row.email}`} className="mt-1 inline-flex items-center gap-1.5 text-sm text-blue-700"><Mail className="h-4 w-4"/>{row.email}</a>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div><p className="text-xs font-bold uppercase text-slate-400">Placements</p><p className="mt-1 text-sm font-semibold">{label('financial_assets_band', row.financial_assets_band)}</p></div>
                    <div><p className="text-xs font-bold uppercase text-slate-400">Épargne mensuelle</p><p className="mt-1 text-sm font-semibold">{label('savings_band', row.savings_band)}</p></div>
                    <div><p className="text-xs font-bold uppercase text-slate-400">Objectif</p><p className="mt-1 text-sm font-semibold">{label('primary_goal', row.primary_goal)}</p></div>
                    <div><p className="text-xs font-bold uppercase text-slate-400">Horizon</p><p className="mt-1 text-sm font-semibold">{label('horizon', row.horizon)}</p></div>
                    <div><p className="text-xs font-bold uppercase text-slate-400">Revenus foyer</p><p className="mt-1 text-sm font-semibold">{label('income_band', row.income_band)}</p></div>
                    <div><p className="text-xs font-bold uppercase text-slate-400">Immobilier</p><p className="mt-1 text-sm font-semibold">{label('real_estate_band', row.real_estate_band)}</p></div>
                    <div><p className="text-xs font-bold uppercase text-slate-400">IR annuel</p><p className="mt-1 text-sm font-semibold">{label('income_tax_band', row.income_tax_band)}</p></div>
                    <div><p className="text-xs font-bold uppercase text-slate-400">Événement 12 mois</p><p className="mt-1 text-sm font-semibold">{label('event_12m', row.event_12m)}</p></div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <select value={row.status} onChange={(e) => void updateStatus(row.id, e.target.value as ProspectStatus)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold">
                    <option value="new">Nouveau</option><option value="booked">RDV réservé</option><option value="qualified">Qualifié</option><option value="mission">Mission</option><option value="nurturing">À nourrir</option><option value="closed">Clos</option>
                  </select>
                  <a href="https://calendly.com/eric-bellaiche/gp-rendez-vous-conseil-avec-eric-bellaiche-clone" target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 p-2 text-slate-600" title="Ouvrir Calendly"><CalendarDays className="h-4 w-4"/></a>
                  <button onClick={() => void remove(row)} className="rounded-xl border border-red-200 p-2 text-red-600" title="Supprimer"><Trash2 className="h-4 w-4"/></button>
                </div>
              </div>
            </article>
          ))}
          {!loading && filtered.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Aucun prospect correspondant.</div>}
        </section>
      </main>
    </div>
  );
}
