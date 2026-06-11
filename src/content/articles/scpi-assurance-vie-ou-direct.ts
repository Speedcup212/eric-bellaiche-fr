import { ArticleContent } from './articleTypes';

const article: ArticleContent = {
  slug: 'scpi-assurance-vie-ou-direct',
  category: 'scpi',
  title: 'SCPI en direct ou via assurance-vie : comment comparer ?',
  metaTitle: 'SCPI en direct ou via assurance-vie : comment comparer ?',
  metaDescription: "Comparaison entre détention directe de SCPI et investissement via assurance-vie : frais, fiscalité, liquidité, choix des SCPI, rendement, horizon, succession. Eric Bellaiche, CGP-CIF ORIAS 13001580.",
  canonical: 'https://eric-bellaiche.fr/articles/scpi-assurance-vie-ou-direct/',
  badge: 'SCPI &bull; Assurance-vie &bull; Comparatif',
  intro: "Faut-il investir en SCPI en direct ou via une assurance-vie ? Le choix dépend de nombreux critères personnels. Eric Bellaiche, CGP-CIF, vous aide à comparer les options avant toute décision.",
  shortAnswer: "La détention directe offre un choix plus large de SCPI mais une fiscalité moins avantageuse sur les plus-values et la transmission. L'assurance-vie offre un cadre fiscal et successoral optimisé mais limite le choix des SCPI disponibles.",
  summaryItems: [
    { label: 'Comprendre les deux modes de détention', anchor: 'comprendre-deux-modes' },
    { label: 'Comparaison des critères', anchor: 'comparaison-criteres' },
    { label: 'SCPI et assurance-vie', anchor: 'scpi-assurance-vie' },
    { label: 'SCPI en direct', anchor: 'scpi-direct' },
    { label: 'Questions fréquentes', anchor: 'faq' },
  ],
  readingTime: 5,
  updatedAt: '2026-06-11',
  author: 'Eric Bellaiche, CGP-CIF',
  tags: ['SCPI', 'assurance-vie', 'détention directe', 'comparatif', 'CGP-CIF'],
  sections: [
    {
      id: 'comprendre-deux-modes',
      title: 'Comprendre les deux modes de détention',
      level: 'h2',
      type: 'normal',
      content: [
        "En direct, vous achetez des parts de SCPI directement auprès de la société de gestion. Via assurance-vie, les parts sont logées dans un contrat d'assurance-vie en unités de compte. Chaque mode a des implications différentes en termes de frais, fiscalité, liquidité et succession.",
      ],
    },
    {
      id: 'comparaison-criteres',
      title: 'Comparaison des critères',
      level: 'h2',
      type: 'table',
      content: [],
      table: {
        headers: ['Critère', 'SCPI en direct', 'SCPI via assurance-vie'],
        rows: [
          ["Frais d'entrée", "8 à 12 % (frais de souscription)", "Frais d'entrée du contrat + éventuels frais sur UC"],
          ['Fiscalité des revenus', "IR (TMI) + PS (17,2 %) dans la catégorie des revenus fonciers", "Capitalisation dans le contrat, fiscalité différée jusqu'au rachat"],
          ['Fiscalité des plus-values', "IR + PS sur les plus-values immobilières", "Exonération d'IR après 8 ans (sous conditions)"],
          ['Liquidité', "Revente des parts auprès du marché secondaire", "Rachat de parts du contrat (délai variable)"],
          ['Choix des SCPI', 'Large (toutes les SCPI)', 'Limité aux SCPI éligibles au contrat'],
          ['Horizon', '8 à 10 ans recommandé', '8 ans recommandé (optimisation fiscale)'],
          ['Succession', "Transmission des parts (droits de mutation)", "Cadre successoral avantageux (hors succession)"],
        ],
      },
    },
    {
      id: 'scpi-assurance-vie',
      title: 'SCPI et assurance-vie : ce qu\'il faut savoir',
      level: 'h2',
      type: 'normal',
      content: [
        "L'investissement en SCPI via assurance-vie permet de bénéficier de la fiscalité propre à l'assurance-vie : exonération d'impôt sur le revenu des plus-values après 8 ans (dans la limite d'un abattement annuel), cadre successoral avantageux. En contrepartie, le choix des SCPI est limité à celles éligibles au contrat.",
      ],
    },
    {
      id: 'scpi-direct',
      title: 'SCPI en direct : ce qu\'il faut savoir',
      level: 'h2',
      type: 'normal',
      content: [
        "La détention directe offre un choix plus large de SCPI et une simplicité de gestion. En revanche, les revenus sont soumis à l'impôt sur le revenu et aux prélèvements sociaux, et la transmission est soumise aux droits de mutation classiques.",
      ],
    },
  ],
  faq: [
    { question: 'Quelle différence entre SCPI en direct et via assurance-vie ?', answer: "En direct, vous achetez des parts de SCPI directement. Via assurance-vie, les parts sont logées dans un contrat d'assurance-vie en unités de compte. Chaque mode a des implications différentes en termes de frais, fiscalité, liquidité et succession." },
    { question: 'Quel mode de détention est le plus avantageux fiscalement ?', answer: "Cela dépend de la situation personnelle. La détention en assurance-vie offre une fiscalité allégée sur les plus-values à long terme et des avantages successoraux. La détention directe peut être plus adaptée selon les objectifs et l'horizon du client." },
    { question: 'Peut-on investir dans toutes les SCPI via assurance-vie ?', answer: 'Non, seules les SCPI éligibles aux contrats d\'assurance-vie sont accessibles. Le choix est plus large en direct.' },
  ],
  ctaTitle: 'Vous hésitez entre SCPI en direct et assurance-vie ?',
  ctaText: "Réservez un créneau gratuit pour échanger avec Eric Bellaiche.",
  ctaLink: 'https://calendly.com/eric-bellaiche/consultation-avec-eric-bellaiche-clone',
  externalLinks: [
    { href: 'https://maximusscpi.com/', label: 'MaximusSCPI', onlyInScpi: true },
  ],
  hasRisks: true,
};

export default article;
