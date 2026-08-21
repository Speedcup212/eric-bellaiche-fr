import { useEffect, useMemo, useState } from 'react';
import { Briefcase, CheckCircle2, Coins, Leaf, Target } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { JourneyProgress, PageIntro, QuestionHeader, SecureNote, WizardCard, WizardFooter } from '../../portal/FintechJourney';
import { supabase } from '../../lib/supabase';
import { dossierHref, fetchPortalProgress, messageFromError, selectedProgress, type PortalProgress } from '../../portal/portalHelpers';

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

type ObjectiveDetail = { horizon: string; note: string; labelOther: string };

const steps = [
  { title: 'Vos objectifs patrimoniaux', description: 'Sélectionnez les objectifs qui motivent votre démarche. Pour chacun, indiquez l’horizon envisagé et ajoutez si nécessaire une précision utile au cabinet.', icon: Target },
  { title: 'Votre situation professionnelle', description: 'Ces informations permettent d’apprécier la stabilité et l’origine de vos revenus dans le cadre de l’analyse patrimoniale.', icon: Briefcase },
  { title: 'Votre capacité financière', description: 'Indiquez les montants que vous estimez disponibles. Ils servent à vérifier que les futures recommandations restent cohérentes avec votre situation.', icon: Coins },
  { title: 'Vos préférences de durabilité', description: 'Indiquez simplement si vous souhaitez intégrer des critères environnementaux ou sociaux. Si vous répondez Oui, un questionnaire dédié vous sera proposé après le profil investisseur.', icon: Leaf },
] as const;

export default function ClientRecueilPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [rows, setRows] = useState<PortalProgress[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [objectives, setObjectives] = useState<string[]>([]);
  const [objectiveDetails, setObjectiveDetails] = useState<Record<string, ObjectiveDetail>>({});
  const [profession, setProfession] = useState('');
  const [societe, setSociete] = useState('');
  const [secteur, setSecteur] = useState('');
  const [statutPro, setStatutPro] = useState('');
  const [epargneMensuelle, setEpargneMensuelle] = useState('');
  const [epargnePrecaution, setEpargnePrecaution] = useState('');
  const [apport, setApport] = useState('');
  const [esg, setEsg] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const dossierId = searchParams.get('dossier');
  const progress = useMemo(() => selectedProgress(rows, dossierId), [rows, dossierId]);

  useEffect(() => {
    void fetchPortalProgress().then(async (progressRows) => {
      setRows(progressRows);
      const row = selectedProgress(progressRows, dossierId);
      if (!row) return;
      setEsg(row.esg_opt_in);
      if (row.recueil_status !== 'validated') await supabase.rpc('start_my_recueil', { p_dossier_id: row.dossier_id });
      const [{ data: obj }, { data: pro }, { data: cap }] = await Promise.all([
        supabase.from('objectifs_patrimoniaux').select('code_objectif,libelle_autre,horizon_annees,commentaire').eq('dossier_id', row.dossier_id).eq('portee', row.role_dossier),
        supabase.from('situations_professionnelles').select('profession_actuelle,societe,secteur_activite,statut').eq('dossier_id', row.dossier_id).eq('investisseur_id', row.investisseur_id).maybeSingle(),
        supabase.from('capacites_financieres').select('capacite_epargne_mensuelle,epargne_precaution_cible,apport_immobilier_possible').eq('dossier_id', row.dossier_id).eq('investisseur_id', row.investisseur_id).maybeSingle(),
      ]);
      const objectiveRows = obj ?? [];
      setObjectives(objectiveRows.map((item) => item.code_objectif));
      const detailMap: Record<string, ObjectiveDetail> = {};
      for (const item of objectiveRows) {
        detailMap[item.code_objectif] = {
          horizon: item.horizon_annees?.toString() ?? '',
          note: item.commentaire ?? '',
          labelOther: item.libelle_autre ?? '',
        };
      }
      setObjectiveDetails(detailMap);
      setProfession(pro?.profession_actuelle ?? '');
      setSociete(pro?.societe ?? '');
      setSecteur(pro?.secteur_activite ?? '');
      setStatutPro(pro?.statut ?? '');
      setEpargneMensuelle(cap?.capacite_epargne_mensuelle?.toString() ?? '');
      setEpargnePrecaution(cap?.epargne_precaution_cible?.toString() ?? '');
      setApport(cap?.apport_immobilier_possible?.toString() ?? '');
    }).catch((error) => setErrorMessage(messageFromError(error)));
  }, [dossierId]);

  const updateObjectiveDetail = (code: string, patch: Partial<ObjectiveDetail>) => {
    setObjectiveDetails((current) => ({
      ...current,
      [code]: {
        ...(current[code] ?? { horizon: '', note: '', labelOther: '' }),
        ...patch,
      },
    }));
  };

  const toggleObjective = (code: string) => {
    setObjectives((current) => current.includes(code) ? current.filter((value) => value !== code) : [...current, code]);
    if (!objectiveDetails[code]) updateObjectiveDetail(code, {});
  };

  const saveObjectives = async (row: PortalProgress) => {
    if (objectives.length === 0) throw new Error('Sélectionnez au moins un objectif pour continuer.');
    for (const code of objectives) {
      const horizon = Number(objectiveDetails[code]?.horizon);
      if (!Number.isFinite(horizon) || horizon <= 0) throw new Error('Indiquez un horizon en années pour chaque objectif sélectionné.');
      if (code === 'autre' && !objectiveDetails[code]?.labelOther.trim()) throw new Error('Précisez votre autre objectif.');
    }
    const { error: deleteError } = await supabase.from('objectifs_patrimoniaux').delete().eq('dossier_id', row.dossier_id).eq('portee', row.role_dossier);
    if (deleteError) throw deleteError;
    const { error } = await supabase.from('objectifs_patrimoniaux').insert(objectives.map((code) => ({
      dossier_id: row.dossier_id,
      portee: row.role_dossier,
      code_objectif: code,
      libelle_autre: code === 'autre' ? objectiveDetails[code]?.labelOther.trim() || null : null,
      horizon_annees: Number(objectiveDetails[code]?.horizon),
      commentaire: objectiveDetails[code]?.note.trim() || null,
    })));
    if (error) throw error;
  };

  const saveProfessional = async (row: PortalProgress) => {
    const { error } = await supabase.from('situations_professionnelles').upsert({
      dossier_id: row.dossier_id,
      investisseur_id: row.investisseur_id,
      profession_actuelle: profession.trim() || null,
      societe: societe.trim() || null,
      secteur_activite: secteur.trim() || null,
      statut: statutPro.trim() || null,
    }, { onConflict: 'dossier_id,investisseur_id' });
    if (error) throw error;
  };

  const saveCapacity = async (row: PortalProgress) => {
    const { error } = await supabase.from('capacites_financieres').upsert({
      dossier_id: row.dossier_id,
      investisseur_id: row.investisseur_id,
      capacite_epargne_mensuelle: epargneMensuelle ? Number(epargneMensuelle) : null,
      epargne_precaution_cible: epargnePrecaution ? Number(epargnePrecaution) : null,
      apport_immobilier_possible: apport ? Number(apport) : null,
    }, { onConflict: 'dossier_id,investisseur_id' });
    if (error) throw error;
  };

  const saveEsg = async (row: PortalProgress) => {
    if (esg === null) throw new Error('Indiquez si vous souhaitez exprimer des préférences de durabilité.');
    const { error } = await supabase.rpc('set_my_esg_opt_in', { p_dossier_id: row.dossier_id, p_opt_in: esg });
    if (error) throw error;
  };

  const saveCurrent = async () => {
    if (!progress) return;
    if (stepIndex === 0) await saveObjectives(progress);
    if (stepIndex === 1) await saveProfessional(progress);
    if (stepIndex === 2) await saveCapacity(progress);
    if (stepIndex === 3) await saveEsg(progress);
  };

  const next = async () => {
    if (!progress) return;
    setBusy(true);
    setErrorMessage('');
    try {
      await saveCurrent();
      if (stepIndex < steps.length - 1) {
        setStepIndex((value) => value + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const { error: validateError } = await supabase.rpc('validate_my_recueil', { p_dossier_id: progress.dossier_id });
      if (validateError) throw validateError;
      const refreshed = await fetchPortalProgress();
      setRows(refreshed);
      const nextProgress = selectedProgress(refreshed, progress.dossier_id);
      if (nextProgress?.next_step === 'QPI') navigate(dossierHref('/espace-client/profil-investisseur', progress.dossier_id));
      else navigate('/espace-client');
    } catch (error) {
      setErrorMessage(messageFromError(error));
    } finally {
      setBusy(false);
    }
  };

  const previous = () => {
    if (!progress) return;
    setErrorMessage('');
    if (stepIndex === 0) navigate(dossierHref('/espace-client', progress.dossier_id));
    else setStepIndex((value) => value - 1);
  };

  if (!progress) return <p className="text-sm text-slate-500">Chargement du dossier…</p>;
  const locked = progress.recueil_status === 'validated';
  const currentStep = steps[stepIndex];
  const CurrentIcon = currentStep.icon;

  if (locked) {
    return <div><JourneyProgress current="recueil" esgEnabled={progress.esg_opt_in !== false} /><PageIntro eyebrow="Étape 1" title="Recueil d’informations" description="Votre recueil a déjà été validé. Les informations sont figées afin de préserver la traçabilité du dossier." icon={<CheckCircle2 className="h-5 w-5" />} /><WizardCard className="p-8"><div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-5 text-emerald-800"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Recueil validé</p><p className="mt-1 text-sm leading-6">Vous pouvez poursuivre avec votre profil investisseur.</p></div></div><button type="button" onClick={() => navigate(dossierHref('/espace-client/profil-investisseur', progress.dossier_id))} className="mt-6 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Continuer vers le profil investisseur</button></WizardCard></div>;
  }

  return (
    <div>
      <JourneyProgress current="recueil" esgEnabled={esg !== false} />
      <PageIntro eyebrow="Étape 1" title="Recueil d’informations" description="Répondez en quatre écrans simples. Chaque partie est enregistrée lorsque vous cliquez sur Continuer." icon={<CurrentIcon className="h-5 w-5" />} />

      <WizardCard>
        <QuestionHeader current={stepIndex + 1} total={steps.length} label={`Partie ${stepIndex + 1} sur ${steps.length}`} title={currentStep.title} description={currentStep.description} />
        <div className="px-6 py-7 sm:px-9 sm:py-9">
          {stepIndex === 0 && (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {objectiveOptions.map(([code, label]) => {
                  const selected = objectives.includes(code);
                  return <button type="button" key={code} onClick={() => toggleObjective(code)} className={`flex items-center gap-3 rounded-2xl border p-4 text-left text-sm font-semibold transition ${selected ? 'border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/10' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full border ${selected ? 'border-white/30 bg-white text-slate-950' : 'border-slate-300'}`}>{selected ? '✓' : ''}</span>{label}</button>;
                })}
              </div>
              {objectives.length > 0 && <div className="space-y-4 border-t border-slate-100 pt-6">
                <div><h4 className="font-semibold text-slate-950">Horizon et précisions</h4><p className="mt-1 text-sm leading-6 text-slate-500">Complétez ces informations pour chaque objectif sélectionné. L’horizon est obligatoire ; la note est facultative.</p></div>
                {objectives.map((code) => {
                  const label = objectiveOptions.find(([value]) => value === code)?.[1] ?? code;
                  const detail = objectiveDetails[code] ?? { horizon: '', note: '', labelOther: '' };
                  return <div key={code} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5"><p className="font-semibold text-slate-800">{label}</p>{code === 'autre' && <label className="mt-4 block text-sm font-semibold text-slate-700">Précisez l’objectif<input value={detail.labelOther} onChange={(e) => updateObjectiveDetail(code, { labelOther: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-400" placeholder="Ex. financer les études des enfants" /></label>}<div className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr]"><label className="text-sm font-semibold text-slate-700">Horizon (années)<input type="number" min="0.5" step="0.5" value={detail.horizon} onChange={(e) => updateObjectiveDetail(code, { horizon: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-400" placeholder="Ex. 8" /></label><label className="text-sm font-semibold text-slate-700">Notes / précisions<textarea value={detail.note} onChange={(e) => updateObjectiveDetail(code, { note: e.target.value })} rows={3} className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-400" placeholder="Échéance, montant, contexte, priorité…" /></label></div></div>;
                })}
              </div>}
            </div>
          )}

          {stepIndex === 1 && <div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Profession actuelle<input value={profession} onChange={(e) => setProfession(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-slate-400 focus:bg-white" placeholder="Ex. Cadre commercial" /></label><label className="text-sm font-semibold text-slate-700">Employeur / société<input value={societe} onChange={(e) => setSociete(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-slate-400 focus:bg-white" /></label><label className="text-sm font-semibold text-slate-700">Secteur d’activité<input value={secteur} onChange={(e) => setSecteur(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-slate-400 focus:bg-white" /></label><label className="text-sm font-semibold text-slate-700">Statut / contrat<input value={statutPro} onChange={(e) => setStatutPro(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-slate-400 focus:bg-white" placeholder="CDI, indépendant, retraité…" /></label></div>}

          {stepIndex === 2 && <div className="space-y-5"><div className="grid gap-5 sm:grid-cols-3"><label className="text-sm font-semibold text-slate-700">Épargne mensuelle disponible (€)<input type="number" min="0" value={epargneMensuelle} onChange={(e) => setEpargneMensuelle(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-slate-400 focus:bg-white" /></label><label className="text-sm font-semibold text-slate-700">Épargne de précaution cible (€)<input type="number" min="0" value={epargnePrecaution} onChange={(e) => setEpargnePrecaution(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-slate-400 focus:bg-white" /></label><label className="text-sm font-semibold text-slate-700">Apport immobilier possible (€)<input type="number" min="0" value={apport} onChange={(e) => setApport(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-slate-400 focus:bg-white" /></label></div><SecureNote>Indiquez des montants réalistes à date. Le cabinet pourra les rapprocher des justificatifs transmis et vous demander une précision si nécessaire.</SecureNote></div>}

          {stepIndex === 3 && <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><button type="button" onClick={() => setEsg(true)} className={`rounded-2xl border p-5 text-left transition ${esg === true ? 'border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/10' : 'border-slate-200 hover:border-slate-400'}`}><p className="font-semibold">Oui, je souhaite les préciser</p><p className={`mt-2 text-sm leading-6 ${esg === true ? 'text-slate-300' : 'text-slate-500'}`}>Un questionnaire dédié vous sera proposé après le profil investisseur.</p></button><button type="button" onClick={() => setEsg(false)} className={`rounded-2xl border p-5 text-left transition ${esg === false ? 'border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/10' : 'border-slate-200 hover:border-slate-400'}`}><p className="font-semibold">Non, je ne souhaite pas en exprimer</p><p className={`mt-2 text-sm leading-6 ${esg === false ? 'text-slate-300' : 'text-slate-500'}`}>Aucun questionnaire de durabilité supplémentaire ne vous sera présenté.</p></button></div><SecureNote>Ce choix ne détermine pas votre profil de risque. Il concerne uniquement la prise en compte de préférences de durabilité dans les solutions étudiées.</SecureNote></div>}

          {errorMessage && <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>}
        </div>
        <WizardFooter onPrevious={previous} onNext={() => void next()} nextLabel={stepIndex === steps.length - 1 ? 'Valider et continuer' : 'Continuer'} busy={busy} />
      </WizardCard>
    </div>
  );
}
