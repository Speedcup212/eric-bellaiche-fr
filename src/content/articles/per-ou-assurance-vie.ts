import { ArticleContent } from './articleTypes';

const article: ArticleContent = {
  slug: 'per-ou-assurance-vie',
  category: 'retraite',
  title: 'PER ou assurance-vie : quelle enveloppe pour préparer sa retraite ?',
  metaTitle: 'PER ou assurance-vie : quelle enveloppe pour préparer sa retraite ?',
  metaDescription: "Comparaison entre PER et assurance-vie pour la préparation retraite : disponibilité, fiscalité à l'entrée et à la sortie, horizon, transmission, souplesse. Eric Bellaiche, CGP-CIF ORIAS 13001580.",
  canonical: 'https://eric-bellaiche.fr/articles/per-ou-assurance-vie/',
  badge: 'Comparatif &bull; Retraite &bull; Fiscalité',
  intro: "PER ou assurance-vie ? Ces deux enveloppes répondent à des logiques différentes. Eric Bellaiche, CGP-CIF, vous aide à comprendre leurs spécificités avant de structurer votre stratégie retraite.",
  shortAnswer: "Le PER est conçu pour la retraite : l'épargne est bloquée jusqu'à la retraite (sauf exceptions), mais les versements sont déductibles du revenu imposable. L'assurance-vie offre plus de souplesse avec des rachats possibles à tout moment et une fiscalité allégée après 8 ans.",
  summaryItems: [
    { label: 'PER et assurance-vie : deux objectifs différents', anchor: 'deux-objectifs' },
    { label: 'Comparaison des critères', anchor: 'comparaison-criteres' },
    { label: 'PER : avantages et points d\'attention', anchor: 'per-avantages' },
    { label: 'Assurance-vie : avantages et points d\'attention', anchor: 'assurance-vie-avantages' },
    { label: 'Questions fréquentes', anchor: 'faq' },
  ],
  readingTime: 5,
  updatedAt: '2026-06-11',
  author: 'Eric Bellaiche, CGP-CIF',
  tags: ['PER', 'assurance-vie', 'retraite', 'épargne', 'CGP-CIF', 'fiscalité'],
  sections: [
    {
      id: 'deux-objectifs',
      title: 'PER et assurance-vie : deux enveloppes aux objectifs différents',
      level: 'h2',
      type: 'normal',
      content: [
        "Le Plan d'Épargne Retraite (PER) est un produit d'épargne dédié à la retraite. Les versements sont déductibles du revenu imposable dans la limite d'un plafond, mais les fonds sont bloqués jusqu'à la retraite (sauf cas de déblocage anticipé prévus par la loi).",
        "L'assurance-vie est une enveloppe plus souple qui permet des rachats à tout moment. Elle offre une fiscalité allégée après 8 ans de détention et un cadre successoral avantageux.",
      ],
    },
    {
      id: 'comparaison-criteres',
      title: 'Comparaison des critères',
      level: 'h2',
      type: 'table',
      content: [],
      table: {
        headers: ['Critère', 'PER', 'Assurance-vie'],
        rows: [
          ['Objectif principal', 'Préparation retraite dédiée', 'Épargne polyvalente et transmission'],
          ['Disponibilité', 'Bloqué jusqu\'à la retraite (sauf exceptions)', 'Rachats possibles à tout moment'],
          ["Fiscalité à l'entrée", 'Versements déductibles du revenu imposable', "Versements non déductibles (sauf contrats spécifiques)"],
          ['Fiscalité à la sortie', "Capital soumis à l'IR (ou rente), prélèvements sociaux", 'Plus-values imposables (exonération partielle après 8 ans)'],
          ['Plafond de versement', "Plafond annuel (10 % des revenus, limité à 35 194 € en 2025)", 'Pas de plafond (limite des primes selon l\'âge)'],
          ['Transmission', 'Capital transmis (hors droits de succession sous conditions)', 'Cadre successoral très avantageux'],
          ['Souplesse', 'Faible (blocage jusqu\'à la retraite)', 'Élevée (rachats, arbitrages)'],
          ['Horizon conseillé', 'Long terme (jusqu\'à la retraite)', 'Moyen à long terme (8+ ans recommandé)'],
        ],
      },
    },
    {
      id: 'per-avantages',
      title: "PER : avantages et points d'attention",
      level: 'h2',
      type: 'normal',
      content: [
        "Le PER permet de déduire les versements du revenu imposable, ce qui peut être intéressant pour les TMI élevées. En contrepartie, les fonds sont bloqués jusqu'à la retraite. La sortie peut se faire en capital, en rente, ou en mixte.",
      ],
    },
    {
      id: 'assurance-vie-avantages',
      title: "Assurance-vie : avantages et points d'attention",
      level: 'h2',
      type: 'normal',
      content: [
        "L'assurance-vie offre une grande souplesse avec des rachats possibles à tout moment. Après 8 ans de détention, la fiscalité des plus-values est allégée. Le cadre successoral est particulièrement avantageux. En contrepartie, les versements ne sont pas déductibles du revenu imposable.",
      ],
    },
  ],
  faq: [
    { question: 'Quelle différence entre PER et assurance-vie ?', answer: "Le PER est conçu pour la retraite : l'épargne est bloquée jusqu'à la retraite (sauf exceptions). L'assurance-vie offre plus de souplesse avec des rachats possibles à tout moment. La fiscalité diffère également." },
    { question: 'Quelle enveloppe est la plus avantageuse fiscalement ?', answer: "Le PER permet de déduire les versements du revenu imposable, ce qui peut être intéressant pour les TMI élevées. L'assurance-vie offre une fiscalité allégée sur les plus-values après 8 ans." },
    { question: 'Peut-on cumuler PER et assurance-vie ?', answer: "Oui, ces deux enveloppes peuvent être complémentaires. Le PER pour la déduction fiscale et la constitution d'une épargne retraite dédiée, l'assurance-vie pour la souplesse et la transmission." },
  ],
  ctaTitle: 'Vous souhaitez structurer votre stratégie retraite ?',
  ctaText: "Réservez un créneau gratuit pour échanger avec Eric Bellaiche.",
  ctaLink: 'https://calendly.com/eric-bellaiche/consultation-avec-eric-bellaiche-clone',
};

export default article;
