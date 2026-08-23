import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Pencil, UsersRound } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ClientRecueilJourneyBase from './ClientRecueilJourneyBase';
import RecueilValidationGuard from './RecueilValidationGuard';
import { JourneyProgress, PageIntro, WizardCard } from '../../portal/FintechJourney';
import { supabase } from '../../lib/supabase';
import { dossierHref, fetchPortalProgress, messageFromError, selectedProgress, type PortalProgress } from '../../portal/portalHelpers';

type DossierScope = '' | 'individual' | 'couple';

type FamilyDraft = {
  dossier_scope: DossierScope;
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
  dossier_scope: '',
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

const individualSituations = ['Célibataire', 'Divorcé', 'Séparé', 'Veuf / Veuve'];
const coupleSituations = ['Marié', 'Pacsé', 'Concubinage'];
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

  const isCouple = family.dossier_scope === 'couple';
  const legalDetailsRequired = useMemo(() => ['Marié', 'Pacsé'].includes(family.situation), [family.situation]);
  const situations = isCouple ? coupleSituations : individualSituations;

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
      const savedSituation = String(payload.situation ?? '');
      const savedScope = String(payload.dossier_scope ?? '') as DossierScope;
      const inferredScope: DossierScope = savedScope || (coupleSituations.includes(savedSituation) ? 'couple' : savedSituation ? 'individual' : '');

      setFamily({
        dossier_scope: inferredScope,
        situation: savedSituation,
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

  const chooseScope = (scope: DossierScope) => {
    setFamily((state) => ({
      ...state,
      dossier_scope: scope,
      situation: '',
      date_evenement: '',
      regime_convention: '',
      conjoint_civilite: scope === 'couple' ? state.conjoint_civilite : '',
      conjoint_prenom: scope === 'couple' ? state.conjoint_prenom : '',
      conjoint_nom: scope === 'couple' ? state.conjoint_nom : '',
      conjoint_email: scope === 'couple' ? state.conjoint_email : '',
      conjoint_mobile: scope === 'couple' ? state.conjoint_mobile : '',
    }));
  };

  const saveFamilySetup = async () => {
    if (!progress) return;
    setBusy(true);
    setErrorMessage('');
    try {
      if (!family.dossier_scope) throw new Error('Indiquez si ce dossier concerne une personne ou un couple.');
      if (!family.situation || family.nombre_enfants === '') throw new Error('Indiquez votre situation familiale et le nombre d’enfants.');
      if (legalDetailsRequired && (!family.date_evenement || !family.regime_convention)) throw new Error('Pour une situation mariée ou pacsée, indiquez la date et le régime / la convention.');
      if (isCouple && (!family.conjoint_civilite || !family.conjoint_prenom.trim() || !family.conjoint_nom.trim() || !family.conjoint_email.trim())) {
        throw new Error('Complétez les informations de la deuxième personne : civilité, prénom, nom et email personnel.');
      }

      const payload = {
        dossier_scope: family.dossier_scope,
        situation: family.situation,
        date_evenement: legalDetailsRequired ? family.date_evenement : '',
        regime_convention: legalDetailsRequired ? family.regime_convention : 'Sans convention / non applicable',
        avantage_matrimonial: '',
        evolution_prevue: '',
        notaire_nom_ville: '',
        expert_comptable_nom_ville: '',
        nombre_enfants: family.nombre_enfants,
        commentaires: '',
        conjoint_civilite: isCouple ? family.conjoint_civilite : '',
        conjoint_prenom: isCouple ? family.conjoint_prenom.trim() : '',
        conjoint_nom: isCouple ? family.conjoint_nom.trim() : '',
        conjoint_email: isCouple ? family.conjoint_email.trim().toLowerCase() : '',
        conjoint_mobile: isCouple ? family.conjoint_mobile.trim() : '',
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
        p_situation: isCouple ? family.situation : 'individuel',
        p_civilite: isCouple ? family.conjoint_civilite : null,
        p_prenom: isCouple ? family.conjoint_prenom.trim() : null,
        p_nom: isCouple ? family.conjoint_nom.trim() : null,
        p_email: isCouple ? family.conjoint_email.trim().toLowerCase() : null,
        p_mobile: isCouple ? family.conjoint_mobile.trim() || null : null,
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
      <PageIntro eyebrow="Étape 1" title="Qui est concerné par ce dossier ?" description="Ce choix détermine le nombre de personnes à accompagner et donc le nombre de profils investisseurs et de questionnaires individuels à compléter." icon={<UsersRound className="h-5 w-5" />} />
      <WizardCard className="p-6 sm:p-8">
        <p className="text-sm font-semibold text-slate-800">Ce dossier concerne : *</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => chooseScope('individual')} className={`rounded-2xl border p-5 text-left transition ${family.dossier_scope === 'individual' ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
            <span className="block font-semibold text-slate-900">Une seule personne</span>
            <span className="mt-1 block text-sm leading-6 text-slate-600">1 recueil, 1 profil investisseur et 1 questionnaire de durabilité si applicable.</span>
          </button>
          <button type="button" onClick={() => chooseScope('couple')} className={`rounded-2xl border p-5 text-left transition ${family.dossier_scope === 'couple' ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
            <span className="block font-semibold text-slate-900">Un couple</span>
            <span className="mt-1 block text-sm leading-6 text-slate-600">2 personnes : chacun aura son profil investisseur et son questionnaire de durabilité si applicable.</span>
          </button>
        </div>

        {family.dossier_scope && <>
          <p className="mt-7 text-sm font-semibold text-slate-800">Quelle est votre situation familiale ? *</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {situations.map((item) => <button key={item} type="button" onClick={() => setFamily((state) => ({ ...state, situation: item }))} className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${family.situation === item ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{item}</button>)}
          </div>

          <label className="mt-6 block text-sm font-semibold text-slate-700">Nombre d’enfants *<input type="number" min="0" value={family.nombre_enfants} onChange={(event) => setFamily((state) => ({ ...state, nombre_enfants: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
        </>}

        {isCouple && family.situation && <div className="mt-7 rounded-2xl border border-blue-200 bg-blue-50/60 p-5 sm:p-6">
          <h3 className="font-semibold text-slate-900">Deuxième personne du dossier</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">Le dossier comportera deux personnes. Les informations communes du foyer ne seront pas redemandées inutilement ; les données personnelles, le profil investisseur et la durabilité restent propres à chacun.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div><p className="text-sm font-semibold text-slate-700">Civilité *</p><div className="mt-2 grid grid-cols-2 gap-2">{['Mr', 'Mme'].map((item) => <button key={item} type="button" onClick={() => setFamily((state) => ({ ...state, conjoint_civilite: item }))} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${family.conjoint_civilite === item ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{item}</button>)}</div></div>
            <label className="text-sm font-semibold text-slate-700">Prénom *<input value={family.conjoint_prenom} onChange={(event) => setFamily((state) => ({ ...state, conjoint_prenom: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
            <label className="text-sm font-semibold text-slate-700">Nom *<input value={family.conjoint_nom} onChange={(event) => setFamily((state) => ({ ...state, conjoint_nom: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
            <label className="text-sm font-semibold text-slate-700">Email personnel *<input type="email" value={family.conjoint_email} onChange={(event) => setFamily((state) => ({ ...state, conjoint_email: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
            <label className="text-sm font-semibold text-slate-700">Mobile<input value={family.conjoint_mobile} onChange={(event) => setFamily((state) => ({ ...state, conjoint_mobile: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
            {legalDetailsRequired && <>
              <label className="text-sm font-semibold text-slate-700">Date du mariage / PACS *<input type="month" value={family.date_evenement ? family.date_evenement.slice(0, 7) : ''} onChange={(event) => setFamily((state) => ({ ...state, date_evenement: event.target.value ? `${event.target.value}-01` : '' }))} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Régime / convention *<select value={family.regime_convention} onChange={(event) => setFamily((state) => ({ ...state, regime_convention: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"><option value="">Sélectionner</option>{regimes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            </>}
          </div>
        </div>}

        {family.dossier_scope === 'individual' && family.situation && <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600"><strong className="text-slate-900">Dossier individuel.</strong> Un seul profil investisseur et un seul questionnaire individuel seront créés.</div>}
        {errorMessage && <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>}
        <button type="button" disabled={busy || !family.dossier_scope || !family.situation} onClick={() => void saveFamilySetup()} className="mt-6 rounded-xl bg-[#0b1f3a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Enregistrement…' : 'Continuer le recueil'}</button>
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
