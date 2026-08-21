import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Save } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { fetchPortalProgress, messageFromError, selectedProgress, type PortalProgress } from '../../portal/portalHelpers';

const objectiveOptions = [
  ['optimisation_fiscale', 'Optimiser la fiscalité'],
  ['achat_immobilier', 'Financer un achat immobilier'],
  ['constitution_patrimoine', 'Constituer / développer un patrimoine'],
  ['epargne_precaution', 'Constituer une épargne de précaution'],
  ['liquidites_court_terme', 'Conserver des liquidités à court terme'],
  ['optimisation_rendement', 'Optimiser le rendement de l’épargne'],
  ['retraite', 'Préparer la retraite'],
  ['aide_enfants', 'Aider les enfants / proches'],
  ['protection_conjoint', 'Protéger le conjoint / les proches'],
  ['transmission', 'Préparer la transmission'],
  ['revenus_complementaires', 'Générer des revenus complémentaires'],
  ['autre', 'Autre objectif'],
] as const;

export default function ClientRecueilPage() {
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<PortalProgress[]>([]);
  const [objectives, setObjectives] = useState<string[]>([]);
  const [profession, setProfession] = useState('');
  const [societe, setSociete] = useState('');
  const [secteur, setSecteur] = useState('');
  const [statutPro, setStatutPro] = useState('');
  const [epargneMensuelle, setEpargneMensuelle] = useState('');
  const [epargnePrecaution, setEpargnePrecaution] = useState('');
  const [apport, setApport] = useState('');
  const [esg, setEsg] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const dossierId = searchParams.get('dossier');
  const progress = useMemo(() => selectedProgress(rows, dossierId), [rows, dossierId]);

  useEffect(() => {
    void fetchPortalProgress().then(async (progressRows) => {
      setRows(progressRows);
      const row = selectedProgress(progressRows, dossierId);
      if (!row) return;
      setEsg(row.esg_opt_in);
      await supabase.rpc('start_my_recueil', { p_dossier_id: row.dossier_id });
      const [{ data: obj }, { data: pro }, { data: cap }] = await Promise.all([
        supabase.from('objectifs_patrimoniaux').select('code_objectif').eq('dossier_id', row.dossier_id),
        supabase.from('situations_professionnelles').select('profession_actuelle,societe,secteur_activite,statut').eq('dossier_id', row.dossier_id).eq('investisseur_id', row.investisseur_id).maybeSingle(),
        supabase.from('capacites_financieres').select('capacite_epargne_mensuelle,epargne_precaution_cible,apport_immobilier_possible').eq('dossier_id', row.dossier_id).eq('investisseur_id', row.investisseur_id).maybeSingle(),
      ]);
      setObjectives((obj ?? []).map((item) => item.code_objectif));
      setProfession(pro?.profession_actuelle ?? '');
      setSociete(pro?.societe ?? '');
      setSecteur(pro?.secteur_activite ?? '');
      setStatutPro(pro?.statut ?? '');
      setEpargneMensuelle(cap?.capacite_epargne_mensuelle?.toString() ?? '');
      setEpargnePrecaution(cap?.epargne_precaution_cible?.toString() ?? '');
      setApport(cap?.apport_immobilier_possible?.toString() ?? '');
    }).catch((error) => setErrorMessage(messageFromError(error)));
  }, [dossierId]);

  const save = async (validate = false) => {
    if (!progress) return;
    setBusy(true);
    setMessage('');
    setErrorMessage('');
    try {
      const { error: deleteObjectivesError } = await supabase.from('objectifs_patrimoniaux').delete().eq('dossier_id', progress.dossier_id).eq('portee', progress.role_dossier);
      if (deleteObjectivesError) throw deleteObjectivesError;
      if (objectives.length > 0) {
        const { error } = await supabase.from('objectifs_patrimoniaux').insert(objectives.map((code) => ({ dossier_id: progress.dossier_id, portee: progress.role_dossier, code_objectif: code })));
        if (error) throw error;
      }
      const { error: proError } = await supabase.from('situations_professionnelles').upsert({
        dossier_id: progress.dossier_id,
        investisseur_id: progress.investisseur_id,
        profession_actuelle: profession || null,
        societe: societe || null,
        secteur_activite: secteur || null,
        statut: statutPro || null,
      }, { onConflict: 'dossier_id,investisseur_id' });
      if (proError) throw proError;

      const { error: capError } = await supabase.from('capacites_financieres').upsert({
        dossier_id: progress.dossier_id,
        investisseur_id: progress.investisseur_id,
        capacite_epargne_mensuelle: epargneMensuelle ? Number(epargneMensuelle) : null,
        epargne_precaution_cible: epargnePrecaution ? Number(epargnePrecaution) : null,
        apport_immobilier_possible: apport ? Number(apport) : null,
      }, { onConflict: 'dossier_id,investisseur_id' });
      if (capError) throw capError;

      if (esg === null) throw new Error('Merci d’indiquer si vous souhaitez exprimer des préférences de durabilité.');
      const { error: esgError } = await supabase.rpc('set_my_esg_opt_in', { p_dossier_id: progress.dossier_id, p_opt_in: esg });
      if (esgError) throw esgError;

      if (validate) {
        const { error: validateError } = await supabase.rpc('validate_my_recueil', { p_dossier_id: progress.dossier_id });
        if (validateError) throw validateError;
        setMessage('Votre partie du Recueil est validée. Le QPI devient disponible dès que les autres investisseurs éventuels ont également validé leur partie.');
      } else {
        setMessage('Vos informations ont été enregistrées.');
      }
      const refreshed = await fetchPortalProgress();
      setRows(refreshed);
    } catch (error) {
      setErrorMessage(messageFromError(error));
    } finally {
      setBusy(false);
    }
  };

  const toggleObjective = (code: string) => {
    setObjectives((current) => current.includes(code) ? current.filter((value) => value !== code) : [...current, code]);
  };

  if (!progress) return <p className="text-slate-600">Aucun dossier sélectionné.</p>;

  const locked = progress.recueil_status === 'validated';

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Recueil d’informations patrimoniales</p>
        <h2 className="mt-2 text-3xl font-semibold">Vos informations</h2>
        <p className="mt-3 max-w-3xl text-slate-600">Les données issues de vos justificatifs sont vérifiées séparément par le cabinet. Vous complétez ici les informations déclaratives utiles à l’accompagnement.</p>
      </div>

      {locked && <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-5 text-emerald-800"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><p className="text-sm">Le Recueil du dossier est validé. Les données sont désormais figées pour préserver la traçabilité.</p></div>}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <h3 className="text-lg font-semibold">Objectifs patrimoniaux</h3>
        <p className="mt-2 text-sm text-slate-500">Sélectionnez au moins un objectif.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {objectiveOptions.map(([code, label]) => (
            <label key={code} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 hover:border-slate-400">
              <input type="checkbox" disabled={locked} checked={objectives.includes(code)} onChange={() => toggleObjective(code)} className="mt-1" />
              <span className="text-sm font-medium">{label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <h3 className="text-lg font-semibold">Situation professionnelle</h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Profession<input disabled={locked} value={profession} onChange={(e) => setProfession(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
          <label className="text-sm font-medium">Employeur / société<input disabled={locked} value={societe} onChange={(e) => setSociete(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
          <label className="text-sm font-medium">Secteur d’activité<input disabled={locked} value={secteur} onChange={(e) => setSecteur(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
          <label className="text-sm font-medium">Statut / contrat<input disabled={locked} value={statutPro} onChange={(e) => setStatutPro(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <h3 className="text-lg font-semibold">Capacité financière</h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-medium">Épargne mensuelle disponible (€)<input type="number" min="0" disabled={locked} value={epargneMensuelle} onChange={(e) => setEpargneMensuelle(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
          <label className="text-sm font-medium">Épargne de précaution cible (€)<input type="number" min="0" disabled={locked} value={epargnePrecaution} onChange={(e) => setEpargnePrecaution(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
          <label className="text-sm font-medium">Apport immobilier possible (€)<input type="number" min="0" disabled={locked} value={apport} onChange={(e) => setApport(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <h3 className="text-lg font-semibold">Préférences de durabilité</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">Souhaitez-vous exprimer des préférences en matière de durabilité ? Si vous répondez Oui, le questionnaire ESG s’ouvrira uniquement après le questionnaire de profil investisseur. Si vous répondez Non, il ne sera pas proposé.</p>
        <div className="mt-5 flex gap-3">
          {[true, false].map((value) => <button type="button" disabled={locked} key={String(value)} onClick={() => setEsg(value)} className={`rounded-xl border px-5 py-3 text-sm font-semibold ${esg === value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white'}`}>{value ? 'Oui' : 'Non'}</button>)}
        </div>
      </section>

      {message && <p className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">{message}</p>}
      {errorMessage && <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>}
      {!locked && <div className="flex flex-wrap gap-3"><button disabled={busy} onClick={() => void save(false)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold"><Save className="h-4 w-4" /> Enregistrer</button><button disabled={busy} onClick={() => void save(true)} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Valider ma partie du Recueil</button></div>}
    </div>
  );
}
