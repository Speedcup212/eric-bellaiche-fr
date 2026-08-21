import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, LockKeyhole, Sparkles } from 'lucide-react';

export type JourneyStage = 'documents' | 'recueil' | 'qpi' | 'esg' | 'done';

const stages: Array<{ key: JourneyStage; label: string }> = [
  { key: 'recueil', label: 'Recueil' },
  { key: 'qpi', label: 'Profil' },
  { key: 'esg', label: 'Durabilité' },
  { key: 'documents', label: 'Documents' },
  { key: 'done', label: 'Transmission' },
];

const stagePaths: Record<JourneyStage, string> = {
  recueil: '/espace-client/recueil',
  qpi: '/espace-client/profil-investisseur',
  esg: '/espace-client/esg',
  documents: '/espace-client/documents',
  done: '/espace-client/synthese',
};

export interface JourneySubstep {
  current: number;
  total: number;
  label?: string;
}

export function JourneyProgress({ current, esgEnabled = true, substep }: { current: JourneyStage; esgEnabled?: boolean; substep?: JourneySubstep }) {
  const visible = esgEnabled ? stages : stages.filter((stage) => stage.key !== 'esg');
  const currentIndex = Math.max(0, visible.findIndex((stage) => stage.key === current));
  const dossierId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('dossier') : null;
  const activeStage = visible[currentIndex];
  const fraction = substep && substep.total > 0 ? Math.min(1, Math.max(0, substep.current / substep.total)) : current === 'done' ? 1 : 0.35;
  const globalPct = Math.min(100, Math.max(1, Math.round(((currentIndex + fraction) / visible.length) * 100)));

  return (
    <div className="sticky top-[72px] z-40 mb-6 rounded-2xl border border-[#cbd8e7] bg-white/95 p-3 shadow-[0_14px_36px_-24px_rgba(11,31,58,0.55)] backdrop-blur-xl sm:p-4">
      <div className="flex items-start justify-between gap-4 px-1 pb-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6f8198]">Étape {currentIndex + 1} sur {visible.length} · {activeStage?.label}</p>
          {substep ? (
            <p className="mt-1 truncate text-sm font-semibold text-[#0b1f3a]">Partie {substep.current} sur {substep.total}{substep.label ? ` · ${substep.label}` : ''}</p>
          ) : (
            <p className="mt-1 text-sm font-semibold text-[#0b1f3a]">Votre parcours patrimonial sécurisé</p>
          )}
        </div>
        <div className="shrink-0 rounded-full bg-[#e9f0f8] px-3 py-1 text-xs font-bold text-[#173967]">{globalPct}%</div>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[#e7edf5]">
        <div className="h-full rounded-full bg-gradient-to-r from-[#173967] to-[#4a78a8] transition-all duration-300" style={{ width: `${globalPct}%` }} />
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        {visible.map((stage, index) => {
          const complete = index < currentIndex;
          const active = index === currentIndex;
          const href = complete && dossierId ? `${stagePaths[stage.key]}?dossier=${encodeURIComponent(dossierId)}` : null;
          const stageContent = (
            <div className={`flex items-center justify-center gap-2 rounded-xl px-2 py-2.5 transition sm:px-3 ${active ? 'bg-[#0b1f3a] text-white shadow-md shadow-[#0b1f3a]/10' : complete ? 'bg-[#eaf2fb] text-[#173967]' : 'bg-[#f6f8fb] text-[#9aa9bc]'} ${href ? 'cursor-pointer hover:-translate-y-0.5 hover:bg-[#dfeaf7] hover:shadow-sm' : ''}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${active ? 'bg-white/12 text-white' : complete ? 'bg-blue-100 text-blue-700' : 'bg-white text-[#7f8da1]'}`}>
                {complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className="hidden truncate text-xs font-semibold md:block">{stage.label}</span>
            </div>
          );

          return (
            <div key={stage.key} className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
              <div className="min-w-0 flex-1">
                {href ? <Link to={href} aria-label={`Revenir à l’étape ${stage.label}`}>{stageContent}</Link> : stageContent}
              </div>
              {index < visible.length - 1 && <div className={`h-px w-2 shrink-0 sm:w-4 ${index < currentIndex ? 'bg-[#91acd0]' : 'bg-[#dbe4ef]'}`} />}
            </div>
          );
        })}
      </div>
      {currentIndex > 0 && <p className="mt-2 px-1 text-[11px] text-[#7f8da1]">Les étapes déjà terminées restent accessibles tant que le dossier n’a pas été transmis définitivement.</p>}
    </div>
  );
}

export function PageIntro({ eyebrow, title, description, icon }: { eyebrow: string; title: string; description: string; icon?: ReactNode }) {
  return (
    <div className="mb-6 overflow-hidden rounded-[28px] border border-[#173967] bg-gradient-to-br from-[#071a33] via-[#0b1f3a] to-[#173967] px-6 py-6 text-white shadow-[0_24px_60px_-30px_rgba(11,31,58,0.65)] sm:px-8 sm:py-7">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white">
          {icon ?? <Sparkles className="h-5 w-5" />}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h2>
        </div>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-blue-100/80 sm:text-base">{description}</p>
    </div>
  );
}

export function WizardCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-[28px] border border-[#dbe4ef] bg-white shadow-[0_26px_70px_-34px_rgba(11,31,58,0.30)] ${className}`}>{children}</section>;
}

export function QuestionHeader({ current, total, label, title, description }: { current: number; total: number; label?: string; title: string; description: string }) {
  const pct = total > 0 ? Math.max(4, Math.round((current / total) * 100)) : 0;
  return (
    <div className="border-b border-[#173967] bg-gradient-to-br from-[#071a33] via-[#0b1f3a] to-[#173967] px-6 py-6 text-white sm:px-9 sm:py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-200">{label ?? `Question ${current} sur ${total}`}</p>
          <h3 className="mt-3 max-w-3xl text-xl font-semibold leading-8 text-white sm:text-2xl">{title}</h3>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-100/80">{description}</p>
        </div>
        <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-blue-100 sm:flex">
          <LockKeyhole className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-blue-300 via-blue-400 to-sky-300 transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function WizardFooter({ onPrevious, onNext, previousLabel = 'Précédent', nextLabel = 'Continuer', nextDisabled = false, busy = false, hidePrevious = false }: { onPrevious?: () => void; onNext: () => void; previousLabel?: string; nextLabel?: string; nextDisabled?: boolean; busy?: boolean; hidePrevious?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[#e7edf5] bg-[#f7f9fc] px-6 py-5 sm:px-9">
      <div>
        {!hidePrevious && onPrevious ? (
          <button type="button" onClick={onPrevious} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#5b6b82] transition hover:bg-white hover:text-[#0b1f3a]">
            <ArrowLeft className="h-4 w-4" /> {previousLabel}
          </button>
        ) : <span />}
      </div>
      <button type="button" disabled={nextDisabled || busy} onClick={onNext} className="inline-flex items-center gap-2 rounded-xl bg-[#0b1f3a] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#0b1f3a]/15 transition hover:-translate-y-0.5 hover:bg-[#173967] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40">
        {busy ? 'Enregistrement…' : nextLabel} <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ChoiceButton({ selected, children, onClick, disabled = false }: { selected: boolean; children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`group flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left text-sm leading-6 transition sm:px-5 ${selected ? 'border-[#0b1f3a] bg-[#0b1f3a] text-white shadow-lg shadow-[#0b1f3a]/10' : 'border-[#dbe4ef] bg-[#fbfdff] text-[#33465f] hover:-translate-y-0.5 hover:border-[#6f8fb4] hover:bg-white hover:shadow-md'} disabled:cursor-not-allowed disabled:opacity-60`}>
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-white/30 bg-white text-[#0b1f3a]' : 'border-[#b8c5d5] bg-white'}`}>
        {selected && <Check className="h-3.5 w-3.5" />}
      </span>
      <span className="font-medium">{children}</span>
    </button>
  );
}

export function SecureNote({ children }: { children: ReactNode }) {
  return <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-[#f2f7fd] px-3 py-2.5 text-xs leading-5 text-[#5b6b82]"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#355f8d]" />{children}</div>;
}
