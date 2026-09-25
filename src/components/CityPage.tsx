import React from 'react';
import { Calendar, Mail, CheckCircle2, Shield, TrendingUp, Users, Award, ChevronRight, Star, Video } from 'lucide-react';

import { CityData } from "../data/cities";

interface CityPageProps {
  cityData: CityData;
}

export default function CityPage({ cityData }: CityPageProps) {
  const ERIC_PHOTO_SRC = "/cercleeb.svg";

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0F2B46] via-slate-50 to-white">
      {/* Header Premium */}
      <header className="fixed top-0 w-full bg-white/95 backdrop-blur-sm shadow-sm z-50" style={{ willChange: 'transform', transform: 'translateZ(0)' }}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-4">
          <div className="flex justify-between items-center gap-2">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
              <img
                src="/cercleeb.svg"
                alt="Eric Bellaiche"
                width={56}
                height={56}
                fetchPriority="high"
                decoding="async"
                className="w-10 h-10 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-[#C5A059] shadow-md flex-shrink-0"
              />
             <div className="flex-1">
  <h1 className="text-base sm:text-2xl font-bold text-[#0F2B46] tracking-tight leading-tight"><span className="font-extrabold">Cabinet</span> Eric Bellaiche</h1>
  <p className="text-xs sm:text-sm text-slate-600 font-medium leading-tight">Cabinet de <strong>Gestion De Patrimoine</strong> · Accompagnement <strong>France Entière</strong> · Visio & Signature Électronique</p>
</div>
            </div>
            <div className="flex gap-2 sm:gap-4 items-center">
              <a
                href="https://calendly.com/eric-bellaiche/consultation-avec-eric-bellaiche-clone"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-block bg-[#C5A059] text-white px-6 py-2 rounded-lg font-bold uppercase hover:bg-[#B89048] shadow-md transition"
              >
                Prendre rdv
              </a>
              <a
                href="https://calendly.com/eric-bellaiche/consultation-avec-eric-bellaiche-clone"
                target="_blank"
                rel="noopener noreferrer"
                className="sm:hidden bg-[#C5A059] text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase hover:bg-[#B89048] shadow-md transition"
              >
                RDV
              </a>
            </div>
          </div>
        </div>
      </header>
      {/* Hero Section Ultra-Premium */}
      {/* Hero Section Ultra-Premium */}
      <section className="pt-28 sm:pt-36 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-[1.75rem] md:text-[2.25rem] font-bold text-white leading-[1.2] drop-shadow-lg">
                Conseiller en gestion de patrimoine en ligne
              </h1>

              <h2 className="text-sm sm:text-lg text-slate-200 mb-8 max-w-2xl mx-auto leading-relaxed">
              SCPI, assurance-vie, PER, fiscalité, immobilier et transmission : un accompagnement patrimonial structuré, conforme et adapté à votre situation.
</h2>
              <div className="flex flex-col gap-3 mb-6">
                <a
                  href="https://calendly.com/eric-bellaiche/consultation-avec-eric-bellaiche-clone"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#C5A059] text-white px-8 py-4 rounded-lg font-bold uppercase hover:bg-[#B89048] shadow-lg hover:shadow-xl transition hidden md:flex flex-col items-center justify-center gap-1 w-fit"
                >
                  <span className="flex items-center gap-2">
                    📅 RÉSERVER UN CRÉNEAU (Gratuit)
                    <ChevronRight className="w-5 h-5" />
                  </span>
                </a>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-white text-xs sm:text-lg font-medium drop-shadow">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <Star className="w-3.5 h-3.5 sm:w-6 sm:h-6 text-yellow-500 fill-yellow-500" />
                    <span className="whitespace-nowrap">5/5 (32 Avis)</span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-6 sm:h-6 text-green-400" />
                    <span className="whitespace-nowrap">CIF & ORIAS</span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <span className="text-base sm:text-2xl">💼</span>
                    <span className="font-bold whitespace-nowrap">15+ ans d'expérience</span>
                  </div>
                </div>
                <p className="text-slate-100 text-sm sm:text-base mt-2 drop-shadow leading-relaxed">
                  J'accompagne 150 clients partout en France (Marseille, Nantes, Bordeaux, Lyon...)
                </p>
              </div>

            </div>

            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl p-8 border border-slate-100 text-center">
                <div className="mb-6">
                  <img
                    src={ERIC_PHOTO_SRC}
                    alt="Eric Bellaiche"
                    width={96}
                    height={96}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    className="w-24 h-24 mx-auto mb-4 rounded-full object-cover border-4 border-blue-100"
                  />
                  <h3 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
                    Réservez votre consultation
                  </h3>
                  <p className="text-slate-600 mb-6">
                    Consultation en ligne • Visio Zoom
                  </p>
                </div>

                <a
                  href="https://calendly.com/eric-bellaiche/consultation-avec-eric-bellaiche-clone"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-[#C5A059] text-white px-6 py-4 rounded-lg font-bold uppercase text-lg hover:bg-[#B89048] shadow-lg transition mb-4"
                >
                  RÉSERVER MON BILAN OFFERT
                </a>

                <div className="flex items-center justify-center gap-2 text-slate-600 mb-4">
                  
                  <a href="tel:+33652565654" className="text-[#0F2B46] font-semibold hover:underline" aria-label="Appeler le 06 52 56 56 54">
                  </a>
                </div>

                <div className="space-y-2 text-xs text-slate-500">
                  <p>✓ Consultation en ligne sécurisée</p>
                  <p>✓ Réponse sous 24h si besoin</p>
                  <p>✓ Premier échange sans engagement</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section Confiance - Plus Humaine */}
      <section className="py-20 bg-[#F8F9FA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-6">
              Pourquoi mes clients me font confiance ?
            </h2>
            <p className="text-xl text-slate-600">
              Parce qu'au-delà des chiffres et des placements, je comprends que derrière chaque décision patrimoniale, 
              il y a des rêves, des inquiétudes et une famille à protéger.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-8 shadow-lg">
              <div className="text-5xl mb-4">🤝</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Architecture Ouverte</h3>
              <p className="text-slate-600">
                Je ne suis lié à aucun réseau ni à aucune banque. Je sélectionne librement les meilleures solutions du marché pour servir uniquement vos objectifs.
              </p>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-lg">
              <div className="text-5xl mb-4">👂</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Écoute personnalisée</h3>
              <p className="text-slate-600">
                Chaque situation est unique. Je prends le temps de comprendre vos objectifs, 
                vos contraintes et vos projets de vie avant toute recommandation.
              </p>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-lg">
              <div className="text-5xl mb-4">📞</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Disponibilités en temps réel</h3>
              <p className="text-slate-600">
                Consultez l'agenda en ligne, choisissez votre créneau et recevez instantanément le lien Zoom.
              </p>
            </div>
          </div>

          <div className="mt-12 bg-white rounded-xl p-8 shadow-lg max-w-3xl mx-auto">
            <div className="flex items-start gap-4">
              <div className="text-4xl">💡</div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  Ma promesse
                </h3>
                <p className="text-slate-600">
                  À la fin de notre premier échange, vous aurez des idées claires sur votre situation, 
                  les opportunités qui s'offrent à vous, et les prochaines étapes à envisager. 
                  Sans jargon technique, sans pression commerciale. Juste des explications simples et des conseils concrets.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Qui suis-je - Section Personnelle */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-12 items-center">
            <div className="md:w-1/3">
              <img 
                src="/cercleeb.svg"
                alt="Eric Bellaiche"
                width={192}
                height={192}
                loading="lazy"
                decoding="async"
                className="w-48 h-48 mx-auto rounded-full object-cover shadow-xl border-4 border-blue-100"
              />
            </div>
            <div className="md:w-2/3">
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-4">
                Bonjour, je suis Eric Bellaiche, Conseiller en <strong>Gestion De Patrimoine</strong> (CIF – ORIAS).
              </h2>
              <div className="space-y-4 text-slate-600">
                <p>
                  Depuis 15 ans, j'accompagne particuliers et entrepreneurs dans la structuration, l'optimisation et la sécurisation de leur patrimoine. Avec le temps, j'ai compris une vérité simple : <strong>l'argent n'est pas un objectif, c'est un levier pour réaliser vos projets de vie</strong>.
                </p>
                <p>
                  Derrière chaque mission, il y a un enjeu concret :
                </p>
                <ul className="list-disc ml-6 space-y-1">
                  <li>financer un achat immobilier</li>
                  <li>investir intelligemment (SCPI, assurance-vie, PER, marchés financiers)</li>
                  <li>optimiser la fiscalité</li>
                  <li>préparer une retraite stable</li>
                  <li>protéger sa famille</li>
                  <li>transmettre dans les meilleures conditions</li>
                </ul>
                <p>
                  <strong>Ma priorité : aligner votre stratégie patrimoniale avec vos objectifs réels.</strong><br />
                  Parfois, la solution consiste à investir. Parfois, à optimiser. Et parfois… à ne rien changer lorsque votre situation est déjà performante.
                </p>
                <p>
                  J'opère en architecture ouverte, avec plus de 100 partenaires, afin de garantir :
                </p>
                <ul className="list-disc ml-6 space-y-1">
                  <li>un conseil indépendant</li>
                  <li>aucune pression commerciale</li>
                  <li>des solutions réellement adaptées</li>
                  <li>une transparence totale</li>
                  <li>un cadre réglementaire strict (CIF, ORIAS)</li>
                </ul>
                <p className="text-[#0F2B46] font-semibold">
                  Si vous recherchez un professionnel capable de vous écouter, d'analyser votre situation avec précision et de vous proposer un plan d'action clair, je serai heureux d'échanger avec vous.
                </p>
                <p className="text-slate-900 font-bold text-lg">
                  Votre patrimoine mérite une vision stratégique.<br />
                  Commençons quand vous voulez.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap gap-4">
                <div className="flex items-center gap-2 bg-[#F8F9FA] px-4 py-2 rounded-lg">
                  <Award className="w-5 h-5 text-[#0F2B46]" />
                  <span className="text-sm font-semibold text-slate-700">CIF Certifié</span>
                </div>
                <div className="flex items-center gap-2 bg-[#F8F9FA] px-4 py-2 rounded-lg">
                  <Shield className="w-5 h-5 text-[#0F2B46]" />
                  <span className="text-sm font-semibold text-slate-700">ORIAS n°13001580</span>
                </div>
                <div className="flex items-center gap-2 bg-[#F8F9FA] px-4 py-2 rounded-lg">
                  <Users className="w-5 h-5 text-[#0F2B46]" />
                  <span className="text-sm font-semibold text-slate-700">Membre CNCEF</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Ce que je peux faire pour vous */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
              Ce que je peux faire pour vous
            </h2>
            <p className="text-xl text-slate-600">
              Des solutions concrètes pour vos préoccupations du quotidien
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl p-8 shadow-lg border-l-4 border-blue-600">
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight mb-4">Vous payez trop d'impôts ?</h3>
              <p className="text-slate-600 mb-4">
                Je vous aide à identifier toutes les niches fiscales adaptées à votre situation : 
                défiscalisation immobilière, SCPI, plans d'épargne retraite... 
                L'objectif : réduire légalement votre facture fiscale de 30 à 60%.
              </p>
              <div className="flex items-start gap-2 text-sm text-slate-600">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Économies constatées : 8 000€ à 25 000€ par an selon les profils</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-lg border-l-4 border-blue-600">
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight mb-4">Inquiet pour votre retraite ?</h3>
              <p className="text-slate-600 mb-4">
                Avec la baisse des pensions, préparer un complément est devenu indispensable. 
                Je construis avec vous une stratégie de capitalisation adaptée à votre horizon 
                et votre capacité d'épargne.
              </p>
              <div className="flex items-start gap-2 text-sm text-slate-600">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Même en commençant tard, des solutions existent pour rattraper le retard</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-lg border-l-4 border-blue-600">
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight mb-4">Envie d'investir dans l'immobilier ?</h3>
              <p className="text-slate-600 mb-4">
                Sans gérer de locataires ni de travaux, les SCPI et la location meublée 
                offrent des revenus réguliers. Je sélectionne pour vous les meilleurs 
                supports du marché selon vos objectifs.
              </p>
              <div className="flex items-start gap-2 text-sm text-slate-600">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Investissement à partir de 200€, rendements de 4 à 6% nets</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-lg border-l-4 border-blue-600">
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight mb-4">Protéger votre famille ?</h3>
              <p className="text-slate-600 mb-4">
                Anticiper la transmission de votre patrimoine permet d'éviter des droits 
                de succession élevés et de sécuriser l'avenir de vos proches. 
                Je vous accompagne dans l'optimisation de votre transmission.
              </p>
              <div className="flex items-start gap-2 text-sm text-slate-600">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Stratégies donation, assurance-vie, SCI familiale selon vos besoins</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Témoignages */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4 text-center">
            Ce que disent mes clients
          </h2>
          <p className="text-xl text-slate-600 mb-12 text-center">
            <a href="https://share.google/hyWSrYaa4j8kOae5h" target="_blank" rel="noopener noreferrer" className="hover:text-slate-800 transition-colors underline">
              Noté 5/5 sur 32 avis vérifiés
            </a>
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-slate-700 mb-4">
                "Mr BELLAICHE m'a accordé du temps pour me conseiller et m'orienter alors que je découvrais les options diverses de la gestion de patrimoine, je l'en remercie chaleureusement. Et également pour son professionnalisme."
              </p>
              <div>
                <div className="font-semibold text-slate-900">Lætitia</div>
                <div className="text-sm text-slate-600">Cliente vérifiée</div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-slate-700 mb-4">
                "Merci à Mr Bellaiche pour tous ses conseils précieux, son écoute, sa disponibilité et son professionnalisme sont vraiment des atouts qui rendent la gestion de patrimoine accessibles à tous."
              </p>
              <div>
                <div className="font-semibold text-slate-900">Aurélie</div>
                <div className="text-sm text-slate-600">Cliente vérifiée</div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-slate-700 mb-4">
                "J'ai apprécié l'analyse d'Eric BELLAICHE qui m'a permis d'économiser fiscalement, mais aussi, ses idées afin d'augmenter mes revenus. Très à l'écoute et excellent conseil."
              </p>
              <div>
                <div className="font-semibold text-slate-900">Martine</div>
                <div className="text-sm text-slate-600">Cliente vérifiée</div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-slate-600 text-sm">
              * Les prénoms ont été modifiés pour préserver la confidentialité
            </p>
          </div>
        </div>
      </section>

      {/* Processus Simple */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
              Comment je vous accompagne
            </h2>
            <p className="text-xl text-slate-600">
              Un parcours simple et transparent, à votre rythme
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#F8F9FA] text-[#0F2B46] rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">On fait connaissance</h3>
              <p className="text-slate-600">
                Un premier échange en visio pour comprendre votre situation et vos attentes.
                Aucun engagement de votre part.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-[#F8F9FA] text-[#0F2B46] rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">J'analyse votre situation</h3>
              <p className="text-slate-600">
                Je prends le temps d'étudier votre patrimoine actuel, vos revenus, 
                votre fiscalité et vos projets.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-[#F8F9FA] text-[#0F2B46] rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Je vous propose des solutions</h3>
              <p className="text-slate-600">
                Un plan d'action clair avec des chiffres concrets. Vous comprenez exactement 
                ce que je vous propose et pourquoi.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-[#F8F9FA] text-[#0F2B46] rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                4
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">On avance ensemble</h3>
              <p className="text-slate-600">
                Vous décidez à votre rythme. Je reste disponible pour vous accompagner 
                dans la mise en place et le suivi.
              </p>
            </div>
          </div>

          <div className="mt-12 bg-[#F8F9FA] rounded-xl p-8 max-w-3xl mx-auto">
            <h3 className="text-xl font-bold text-slate-900 mb-4 text-center">
              ⏱️ Combien de temps ça prend ?
            </h3>
            <div className="space-y-3 text-slate-600">
              <p>• <strong>Premier contact :</strong> 30' de visio pour échanger sur vos besoins.</p>
              <p>• <strong>2ème contact :</strong> Bilan détaillé : 2 heures d'explication sur les actions à mener.</p>
              <p>• <strong>3ème contact :</strong> Ouverture des contrats si vous souhaitez passer par mon cabinet.</p>
              <p>• <strong>4ème contact :</strong> Suivi dans le temps.</p>
              <p className="text-sm italic pt-2 bg-white px-4 py-3 rounded-lg">
                <strong>Consultations 100% en ligne</strong> : Depuis chez vous, à l'heure qui vous arrange.
                Vous ne payez rien pour cette première analyse. C'est seulement si vous décidez
                de mettre en place des solutions que des honoraires seront discutés en toute transparence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final Chaleureux */}
      <section id="contact" className="py-20 bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Prêt à faire le point sur votre situation ?
          </h2>
          <p className="text-xl mb-8 text-white">
            Réservez votre consultation en ligne ou appelez-moi directement.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="https://calendly.com/eric-bellaiche/consultation-avec-eric-bellaiche-clone"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-[#0F2B46] px-10 py-5 rounded-lg font-bold text-xl hover:bg-[#F8F9FA] transition inline-flex items-center gap-3"
            >
              Réserver ma consultation
              <ChevronRight className="w-6 h-6" />
            </a>
            <a href="tel:+33652565654" className="text-white text-lg hover:text-white transition flex items-center gap-2" aria-label="Appeler le 06 52 56 56 54">
              <Calendar className="w-6 h-6" />
            </a>
          </div>
          <p className="mt-8 text-white text-sm">
            Consultation en ligne • Visio sécurisée • 30 minutes
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0F2B46] text-slate-300 py-12 pb-24 md:pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-white font-bold text-lg mb-4">Eric Bellaiche</h3>
              <p className="text-sm mb-4">
                Conseil en <strong>Gestion De Patrimoine</strong><br />
                Membre CNCEF - CIF n&deg;D016571
              </p>
              <p className="text-sm">
                <a href="/eric-bellaiche-cgp-cif/" className="text-[#C5A059] hover:text-white transition-colors">En savoir plus sur Eric Bellaiche, CGP-CIF</a>
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Contact</h4>
              <p className="text-sm mb-2">✉️ eric.bellaiche@gmail.com</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Certifications</h4>
              <p className="text-sm mb-2">CIF n°D016571</p>
              <p className="text-sm mb-2">ORIAS n°13001580</p>
              <p className="text-sm">CPI 3101 2015000001813</p>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-sm">
            <p>© 2025 Eric Bellaiche - Tous droits réservés • <a href="/Mentions légales.pdf" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Mentions légales</a> • <a href="/Site web durabiilitè.pdf" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Politique de durabilité</a> • <a href="/articles/" className="hover:text-white transition-colors">Articles patrimoniaux</a></p>
        </div>
        </div>
      </footer>

      {/* Sticky Bottom Bar - Mobile Only */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.1)] p-4">
        <a
          href="https://calendly.com/eric-bellaiche/consultation-avec-eric-bellaiche-clone"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#C5A059] text-white px-8 py-4 rounded-lg font-bold uppercase hover:bg-[#B89048] shadow-lg hover:shadow-xl transition flex items-center justify-center gap-2 w-full"
        >
          📅 RÉSERVER UN CRÉNEAU (Gratuit)
          <ChevronRight className="w-5 h-5" />
        </a>
      </div>
    </main>
  );
}