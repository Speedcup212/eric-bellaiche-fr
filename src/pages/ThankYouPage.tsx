import { Calendar } from 'lucide-react';
import { useEffect } from 'react';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export default function ThankYouPage() {
  useEffect(() => {
    window.scrollTo(0, 0);

    if (typeof window.gtag === 'function') {
      window.gtag('event', 'conversion', {
        'send_to': 'AW-932681130/VOTRE_NOUVEAU_LIBELLE_ICI'
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F2B46] via-slate-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <div className="flex flex-col items-center text-center">
            <img
              src="/cercleeb.svg"
              alt="Eric Bellaiche"
              className="w-32 h-32 rounded-full mb-6 object-cover"
            />

            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
              Merci pour votre confiance !
            </h1>

            <p className="text-lg text-slate-600 mb-8 max-w-2xl">
              Votre rendez-vous a été confirmé avec succès. Vous allez recevoir un email de confirmation avec tous les détails.
            </p>

            <div className="w-full max-w-2xl bg-[#F8F9FA] rounded-lg p-6 mb-8">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-4 flex items-center justify-center gap-2">
                <Calendar className="w-6 h-6 text-[#C5A059]" />
                Prochaines étapes
              </h2>
              <ul className="text-left space-y-3 text-slate-700">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-[#0F2B46] text-white rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold mt-0.5">
                    1
                  </div>
                  <span>Vous recevrez un email de confirmation de Calendly avec le lien de visioconférence</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-[#0F2B46] text-white rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold mt-0.5">
                    2
                  </div>
                  <span>Préparez vos questions et réflexions sur vos objectifs financiers</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-[#0F2B46] text-white rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold mt-0.5">
                    3
                  </div>
                  <span>Préparez votre dernier avis d'imposition</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-[#0F2B46] text-white rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold mt-0.5">
                    4
                  </div>
                  <span>Le jour J, rejoignez la visioconférence à l'heure prévue</span>
                </li>
              </ul>
            </div>

            <div className="w-full max-w-2xl bg-slate-50 rounded-lg p-6 mb-8">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-4">
                Besoin de modifier votre rendez-vous ?
              </h2>
              <p className="text-slate-600">
                Vous pouvez modifier ou annuler votre rendez-vous directement via le lien dans l'email de confirmation.
              </p>
            </div>

            <div className="text-center">
              <p className="text-slate-600 mb-6">
                En attendant notre rendez-vous, n'hésitez pas à préparer vos questions.
              </p>
              <a
                href="/"
                className="inline-block bg-[#C5A059] text-white px-8 py-3 rounded-lg font-bold uppercase hover:bg-[#B89048] shadow-lg hover:shadow-xl transition"
              >
                Retour à l'accueil
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-slate-500">
          <p>Eric Bellaiche - Conseiller en Gestion de Patrimoine</p>
          <p className="mt-1">CIF et ORIAS certifié</p>
        </div>
      </div>
    </div>
  );
}
