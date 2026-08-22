import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Pencil, UsersRound } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ClientRecueilJourneyBase from './ClientRecueilJourneyBase';
import RecueilValidationGuard from './RecueilValidationGuard';
import { JourneyProgress, PageIntro, WizardCard } from '../../portal/FintechJourney';
import { supabase } from '../../lib/supabase';
import { dossierHref, fetchPortalProgress, messageFromError, selectedProgress, type PortalProgress } from '../../portal/portalHelpers';

type FamilyDraft = {
  situation: string;
  date_evenement: string;
  regime_convention: string;
  nombre_enfants: string;
  conjoint_civilite: string;
  conjoint_prenom: string;
  conjoint_nom: string;
  conjoint_email: string;
  conjoint_mobile: string;
};

const emptyFamily: FamilyDraft = {
  situation: '',
  date_evenement: '',
  regime_convention: '',
  nombre_enfants: '',
  conjoint_civilite: '',
  conjoint_prenom: '',
  conjoint_nom: '',
  conjoint_email: '',
  conjoint_mobile: '',
};

const situations = ['Célibataire', 'Marié', 'Pacsé', 'Concubinage', 'Divorcé', 'Séparé', 'Veuf / Veuve'];
const regimes = ['Communauté réduite aux acquêts', 'Communauté universelle', 'Séparation de biens', 'Participation aux acquêts', 'PACS - séparation des patrimoines', 'PACS - indivision', 'Sans convention / non applicable'];

export default function ClientRecueilJourneyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [progress, setProgress] = useState<PortalProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [familyReady, setFamilyReady] = useState<boolean | null>(null);
  const [family, setFamily] = useState<FamilyDraft>(emptyFamily);
  const dossierId = searchParams.get('dossier');

  const spouseRequired = useMemo(() => ['Marié', 'Pacsé'].includes(family.situation), [family.situation]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const rows = await fetchPortalProgress();
      const selected = selectedProgress(rows, dossierId);
      if (!active) return;
      setProgress(selected);
      if (!selected) return;

      const { data, error } = await supabase
        .from('recueil_sections')
        .select('payload,completed_at')
        .eq('dossier_id', selected.dossier_id)
        .eq('investisseur_id', selected.investisseur_id)
        .eq('section_code', 'family')
        .maybeSingle();
      if (error) throw error;
      if (!active) return;

      const payload = (data?.payload ?? {}) as Record<string, unknown>;
      setFamily({
        situation: String(payload.situation ?? ''),
        date_evenement: String(payload.date_evenement ?? ''),
        regime_convention: String(payload.regime_convention ?? ''),
        nombre_enfants: String(payload.nombre_enfants ?? ''),
        conjoint_civilite: String(payload.conjoint_civilite ?? ''),
        conjoint_prenom: String(payload.conjoint_prenom ?? ''),
        conjoint_nom: String(payload.conjoint_nom ?? ''),
        conjoint_email: String(payload.conjoint_email ?? ''),
        conjoint_mobile: String(payload.conjoint_mobile ?? ''),
      });
      setFamilyReady(Boolean(data?.completed_at));
    };

    void load()
      .catch((error) => { if (active) setErrorMessage(messageFromError(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [dossierId]);

  const edit = async () => {
    if (!progress || progress.transmitted_at) return;
    setBusy(true);
    setErrorMessage('');
    try {
      const { error } = await supabase.rpc('reopen_my_recueil', { p_dossier_id: progress.dossier_id });
      if (error) throw error;
      setEditing(true);
    } catch (error) {
      setErrorMessage(messageFromError(error));
    } finally {
      setBusy(false);
    }
  };

  const saveFamilySetup = async () => {
    if (!progress) return;
    setBusy(true);
    setErrorMessage('');
    try {
      if (!family.situation || family.nombre_enfants === '') throw new Error('Indiquez votre situation familiale et le nombre d’enfants.');
      if (spouseRequired && (!family.date_evenement || !family.regime_convention)) throw new Error('Pour une situation mariée ou pacsée, indiquez la date et le régime / la convention.');
      if (spouseRequired && (!family.conjoint_civilite || !family.conjoint_prenom.trim() || !family.conjoint_nom.trim() || !family.conjoint_email.trim())) {
        throw new Error('Complétez les informations du conjoint : civilité, prénom, nom et email personnel.');
      }

      const payload = {
        situation: family.situation,
        date_evenement: spouseRequired ? family.date_evenement : '',
        regime_convention: spouseRequired ? family.regime_convention : 'Sans convention / non applicable',
        avantage_matrimonial: '',
        evolution_prevue: '',
        notaire_nom_ville: '',
        expert_comptable_nom_ville: '',
        nombre_enfants: family.nombre_enfants,
        commentaires: '',
        conjoint_civilite: spouseRequired ? family.conjoint_civilite : '',
        conjoint_prenom: spouseRequired ? family.conjoint_prenom.trim() : '',
        conjoint_nom: spouseRequired ? family.conjoint_nom.trim() : '',
        conjoint_email: spouseRequired ? family.conjoint_email.trim().toLowerCase() : '',
        conjoint_mobile: spouseRequired ? family.conjoint_mobile.trim() : '',
      };

      const { error: familyError } = await supabase.rpc('save_my_recueil_section', {
        p_dossier_id: progress.dossier_id,
        p_section_code: 'family',
        p_payload: payload,
        p_completed: true,
      });
      if (familyError) throw familyError;

      const { error: spouseError } = await supabase.rpc('sync_my_spouse_from_family', {
        p_dossier_id: progress.dossier_id,
        p_situation: family.situation,
        p_civilite: spouseRequired ? family.conjoint_civilite : null,
        p_prenom: spouseRequired ? family.conjoint_prenom.trim() : null,
        p_nom: spouseRequired ? family.conjoint_nom.trim() : null,
        p_email: spouseRequired ? family.conjoint_email.trim().toLowerCase() : null,
        p_mobile: spouseRequired ? family.conjoint_mobile.trim() || null : null,
      });
      if (spouseError) throw spouseError;

      setFamilyReady(true);
    } catch (error) {
      setErrorMessage(messageFromError(error));
    } finally {
      setBusy(false);
    }
  };

  if (loading || familyReady === null) return <p className="text-sm text-slate-500">Chargement du recueil…</p>;
  if (errorMessage && !progress) return <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>;
  if (!progress) return <p className="text-sm text-slate-500">Dossier introuvable.</p>;

  if (!familyReady && progress.recueil_status !== 'validated') {
    return <div>
      <JourneyProgress current="recueil" esgEnabled={progress.esg_opt_in !== false} />
      <PageIntro eyebrow="Étape 1" title="Votre situation familiale" description="Cette réponse détermine automatiquement si le dossier reste individuel ou si un conjoint doit être rattaché au dossier." icon={<UsersRound className="h-5 w-5" />} />
      <WizardCard className="p-6 sm:p-8">
        <p className="text-sm font-semibold text-slate-800">Quelle est votre situation familiale ? *</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {situations.map((item) => <button key={item} type="button" onClick={() => setFamily((state) => ({ ...state, situation: item }))} className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${family.situation === item ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{item}</button>)}
        </div>

        <label className="mt-6 block text-sm font-semibold text-slate-700">Nombre d’enfants *<input type="number" min="0" value={family.nombre_enfants} onChange={(event) => setFamily((state) => ({ ...state, nombre_enfants: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>

        {spouseRequired && <div className="mt-7 rounded-2xl border border-blue-200 bg-blue-50/60 p-5 sm:p-6">
          <h3 className="font-semibold text-slate-900">Informations du conjoint / partenaire</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">Parce que vous êtes {family.situation.toLowerCase()}, le dossier comportera automatiquement deux personnes. Chacun aura ensuite son propre profil investisseur et, le cas échéant, son propre questionnaire de durabilité.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div><p className="text-sm font-semibold text-slate-700">Civilité *</p><div className="mt-2 grid grid-cols-2 gap-2">{['Mr', 'Mme'].map((item) => <button key={item} type="button" onClick={() => setFamily((state) => ({ ...state, conjoint_civilite: item }))} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${family.conjoint_civilite === item ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{item}</button>)}</div></div>
            <label className="text-sm font-semibold text-slate-700">Prénom *<input value={family.conjoint_prenom} onChange={(event) => setFamily((state) => ({ ...state, conjoint_prenom: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
            <label className="text-sm font-semibold text-slate-700">Nom *<input value={family.conjoint_nom} onChange={(event) => setFamily((state) => ({ ...state, conjoint_nom: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
            <label className="text-sm font-semibold text-slate-700">Email personnel *<input type="email" value={family.conjoint_email} onChange={(event) => setFamily((state) => ({ ...state, conjoint_email: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
            <label className="text-sm font-semibold text-slate-700">Mobile<input value={family.conjoint_mobile} onChange={(event) => setFamily((state) => ({ ...state, conjoint_mobile: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
            <label className="text-sm font-semibold text-slate-700">Date du mariage / PACS *<input type="month" value={family.date_evenement ? family.date_evenement.slice(0, 7) : ''} onChange={(event) => setFamily((state) => ({ ...state, date_evenement: event.target.value ? `${event.target.value}-01` : '' }))} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Régime / convention *<select value={family.regime_convention} onChange={(event) => setFamily((state) => ({ ...state, regime_convention: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"><option value="">Sélectionner</option>{regimes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          </div>
        </div>}

        {!spouseRequired && family.situation && <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600"><strong className="text-slate-900">Dossier individuel.</strong> Pour cette situation, aucun second déclarant n’est créé. Le concubinage reste notamment traité comme un dossier à une seule personne.</div>}
        {errorMessage && <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>}
        <button type="button" disabled={busy || !family.situation} onClick={() => void saveFamilySetup()} className="mt-6 rounded-xl bg-[#0b1f3a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Enregistrement…' : 'Continuer le recueil'}</button>
      </WizardCard>
    </div>;
  }

  if (!editing && progress.recueil_status === 'validated' && !progress.transmitted_at) {
    return <div>
      <JourneyProgress current="recueil" esgEnabled={progress.esg_opt_in !== false} />
      <PageIntro eyebrow="Étape 1" title="Recueil d’informations" description="Votre recueil est validé. Vous pouvez encore corriger ou compléter vos informations tant que le dossier n’a pas été transmis définitivement au cabinet." icon={<CheckCircle2 className="h-5 w-5" />} />
      <WizardCard className="p-8">
        <div className="rounded-2xl bg-emerald-50 p-5 text-emerald-800">
          <p className="font-semibold">Recueil validé</p>
          <p className="mt-1 text-sm leading-6">Toute modification sera enregistrée et vous devrez valider de nouveau le recueil avant de poursuivre.</p>
        </div>
        {errorMessage && <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={() => void edit()} className="inline-flex items-center gap-2 rounded-xl bg-[#0b1f3a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><Pencil className="h-4 w-4" /> {busy ? 'Ouverture…' : 'Modifier mon recueil'}</button>
          <button type="button" onClick={() => navigate(dossierHref('/espace-client/profil-investisseur', progress.dossier_id))} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">Continuer</button>
        </div>
      </WizardCard>
    </div>;
  }

  return <div className="recueil-safe"><RecueilValidationGuard /><ClientRecueilJourneyBase /></div>;
}
