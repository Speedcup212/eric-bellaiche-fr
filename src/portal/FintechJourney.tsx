import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, LockKeyhole, Sparkles } from 'lucide-react';

export type JourneyStage = 'documents' | 'recueil' | 'qpi' | 'esg' | 'done';

const stages: Array<{ key: JourneyStage; label: string }> = [
  { key: 'recueil', label: 'Recueil' },
  { key: 'qpi', label: 'Profil' },
  { key: 'esg', label: 'Durabilité' },
  { key: 'documents', label: 'Documents' },
  { key: 'done', label: 'Transmission' },
];

export function JourneyProgress({ current, esgEnabled = true }: { current: JourneyStage; esgEnabled?: boolean }) {
  const visible = esgEnabled ? stages : stages.filter((stage) => stage.key !== 'esg');
  const currentIndex = visible.findIndex((stage) => stage.key === current);
  return (
    <div className="mb-8 rounded-2xl border border-white/70 bg-white/80 p-3 shadow-sm backdrop-blur-xl sm:p-4">
      <div className="flex items-center gap-1.5 sm:gap-2">
        {visible.map((stage, index) => {
          const complete = index < currentIndex;
          const active = index === currentIndex;
          return (
            <div key={stage.key} className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
              <div className="min-w-0 flex-1">
                <div className={`flex items-center gap-2 rounded-xl px-2 py-2 sm:px-3 ${active ? 'bg-slate-950 text-white shadow-lg shadow-slate-950/10' : complete ? 'bg-emerald-50 text-emerald-800' : 'text-slate-400'}`}>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${active ? 'bg-white/15' : complete ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                    {complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
                  </span>
                  <span className="hidden truncate text-xs font-semibold sm:block">{stage.label}</span>
                </div>
              </div>
              {index < visible.length - 1 && <div className={`h-px w-2 shrink-0 sm:w-4 ${index < currentIndex ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PageIntro({ eyebrow, title, description, icon }: { eyebrow: string; title: string; description: string; icon?: ReactNode }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/10">
          {icon ?? <Sparkles className="h-5 w-5" />}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{title}</h2>
        </div>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">{description}</p>
    </div>
  );
}

export function WizardCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_70px_-32px_rgba(15,23,42,0.28)] ${className}`}>{children}</section>;
}

export function QuestionHeader({ current, total, label, title, description }: { current: number; total: number; label?: string; title: string; description: string }) {
  const pct = total > 0 ? Math.max(4, Math.round((current / total) * 100)) : 0;
  return (
    <div className="border-b border-slate-100 bg-gradient-to-br from-white via-white to-slate-50/80 px-6 py-6 sm:px-9 sm:py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label ?? `Question ${current} sur ${total}`}</p>
          <h3 className="mt-3 max-w-3xl text-xl font-semibold leading-8 text-slate-950 sm:text-2xl">{title}</h3>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
        </div>
        <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm sm:flex">
          <LockKeyhole className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function WizardFooter({ onPrevious, onNext, previousLabel = 'Précédent', nextLabel = 'Continuer', nextDisabled = false, busy = false, hidePrevious = false }: { onPrevious?: () => void; onNext: () => void; previousLabel?: string; nextLabel?: string; nextDisabled?: boolean; busy?: boolean; hidePrevious?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-5 sm:px-9">
      <div>
        {!hidePrevious && onPrevious ? (
          <button type="button" onClick={onPrevious} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-950">
            <ArrowLeft className="h-4 w-4" /> {previousLabel}
          </button>
        ) : <span />}
      </div>
      <button type="button" disabled={nextDisabled || busy} onClick={onNext} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40">
        {busy ? 'Enregistrement…' : nextLabel} <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ChoiceButton({ selected, children, onClick, disabled = false }: { selected: boolean; children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`group flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left text-sm leading-6 transition sm:px-5 ${selected ? 'border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/10' : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md'} disabled:cursor-not-allowed disabled:opacity-60`}>
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-white/40 bg-white text-slate-950' : 'border-slate-300 bg-white'}`}>
        {selected && <Check className="h-3.5 w-3.5" />}
      </span>
      <span className="font-medium">{children}</span>
    </button>
  );
}

export function SecureNote({ children }: { children: ReactNode }) {
  return <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-500"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />{children}</div>;
}
