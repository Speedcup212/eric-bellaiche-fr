import { CalendarDays, ExternalLink } from 'lucide-react';

export default function FollowUpBooking() {
  return (
    <section aria-label="Rendez-vous de suivi" className="rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <CalendarDays className="mt-0.5 h-6 w-6 shrink-0 text-[#173967]" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-[#0b1f3a]">Prenez votre rendez-vous de suivi</h3>
          <p className="mt-2 text-sm leading-6 text-[#5b6b82]">Votre dossier est transmis. Choisissez maintenant un créneau avec Éric Bellaiche pour faire le point sur votre situation et les prochaines étapes de votre accompagnement.</p>
        </div>
      </div>
      <a href="https://calendly.com/eric-bellaiche/rendez-vous-de-suivi" target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#173967] px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#0b1f3a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#173967] sm:w-auto">
        Prendre mon rendez-vous de suivi <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="sr-only">(Calendly, nouvel onglet)</span>
      </a>
      <p className="mt-2 text-xs leading-5 text-[#5b6b82]">Le calendrier s’ouvre dans un nouvel onglet. Votre espace client reste accessible.</p>
    </section>
  );
}
