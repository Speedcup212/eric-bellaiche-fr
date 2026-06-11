import { ArticleContent } from './articleTypes';

const article: ArticleContent = {
  slug: 'audit-patrimonial-en-ligne',
  category: 'audit',
  title: 'Audit patrimonial en ligne : méthode, intérêt et points de vigilance',
  metaTitle: 'Audit patrimonial en ligne : méthode, intérêt et points de vigilance',
  metaDescription: "L'audit patrimonial permet d'obtenir une vision globale de sa situation : fiscalité, retraite, immobilier, transmission, placements, capacité de risque et objectifs. Eric Bellaiche, CGP-CIF ORIAS 13001580.",
  canonical: 'https://eric-bellaiche.fr/articles/audit-patrimonial-en-ligne/',
  badge: 'Audit patrimonial &bull; CGP-CIF &bull; ORIAS 13001580',
  intro: "Un audit patrimonial permet d'obtenir une vision complète et objective de votre situation financière, fiscale et patrimoniale. Réalisé en visioconférence par un CGP-CIF, il constitue la première étape indispensable avant toute décision d'investissement.",
  shortAnswer: "L'audit patrimonial est une analyse complète de votre situation : actifs, passifs, fiscalité, retraite, immobilier, placements, capacité de risque, objectifs. Il permet d'identifier les leviers d'optimisation et de structurer une stratégie cohérente.",
  summaryItems: [
    { label: "Qu'est-ce qu'un audit patrimonial ?", anchor: 'quest-ce-quun-audit-patrimonial' },
    { label: 'Pourquoi réaliser un audit patrimonial ?', anchor: 'pourquoi-realiser' },
    { label: 'Les étapes d\'un audit patrimonial', anchor: 'etapes-audit' },
    { label: 'Points de vigilance', anchor: 'points-de-vigilance' },
    { label: 'Questions fréquentes', anchor: 'faq' },
  ],
  readingTime: 5,
  updatedAt: '2026-06-11',
  author: 'Eric Bellaiche, CGP-CIF',
  tags: ['audit patrimonial', 'bilan patrimonial', 'CGP-CIF', 'fiscalité', 'retraite'],
  sections: [
    {
      id: 'quest-ce-quun-audit-patrimonial',
      title: "Qu'est-ce qu'un audit patrimonial ?",
      level: 'h2',
      type: 'normal',
      content: [
        "Un audit patrimonial est une analyse complète de votre situation : actifs immobiliers et financiers, passifs, fiscalité (IR, IFI, plus-values), préparation retraite, transmission, capacité d'épargne et de risque, objectifs personnels et professionnels. Il permet d'identifier les axes d'optimisation et de structurer une stratégie cohérente.",
      ],
    },
    {
      id: 'pourquoi-realiser',
      title: 'Pourquoi réaliser un audit patrimonial ?',
      level: 'h2',
      type: 'list',
      content: [],
      listItems: [
        'Avoir une vision globale de son patrimoine',
        'Identifier les leviers fiscaux adaptés à sa situation',
        'Structurer une stratégie retraite',
        'Anticiper la transmission',
        'Éviter les décisions d\'investissement isolées sans vision d\'ensemble',
      ],
    },
    {
      id: 'etapes-audit',
      title: "Les étapes d'un audit patrimonial",
      level: 'h2',
      type: 'method-steps',
      content: [],
      methodSteps: [
        { title: 'Recueil des données', description: 'Patrimoniales, fiscales et financières.' },
        { title: 'Analyse et objectifs', description: 'Analyse de la situation et identification des objectifs.' },
        { title: 'Profil investisseur', description: 'Évaluation des connaissances, expérience, capacité de perte, horizon.' },
        { title: 'Solutions et recommandations', description: 'Comparaison des solutions adaptées et formalisation.' },
        { title: 'Suivi périodique', description: 'Ajustement de la stratégie dans le temps.' },
      ],
    },
    {
      id: 'points-de-vigilance',
      title: 'Points de vigilance',
      level: 'h2',
      type: 'normal',
      content: [
        "Un audit patrimonial est un outil d'aide à la décision. Il ne constitue pas une garantie de résultat. Les recommandations sont adaptées à la situation personnelle du client et tiennent compte de sa capacité de risque, de ses objectifs et de son horizon de placement.",
      ],
    },
  ],
  faq: [
    { question: "Qu'est-ce qu'un audit patrimonial ?", answer: "Un audit patrimonial est une analyse complète de la situation d'un client : actifs, passifs, fiscalité, retraite, immobilier, placements, capacité de risque, objectifs. Il permet d'identifier les leviers d'optimisation." },
    { question: 'Un audit patrimonial est-il payant ?', answer: 'Eric Bellaiche propose un premier bilan gratuit en visioconférence. Un audit approfondi peut être réalisé sur devis.' },
    { question: 'Peut-on réaliser un audit patrimonial à distance ?', answer: "Oui, l'audit est réalisé en visioconférence, avec signature électronique et suivi personnalisé. L'accompagnement est accessible depuis toute la France." },
  ],
  ctaTitle: 'Vous souhaitez faire le point sur votre situation patrimoniale ?',
  ctaText: 'Réservez un créneau gratuit pour échanger avec Eric Bellaiche.',
  ctaLink: 'https://calendly.com/eric-bellaiche/consultation-avec-eric-bellaiche-clone',
};

export default article;
