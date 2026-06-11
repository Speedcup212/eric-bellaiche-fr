import { ArticleContent } from './articleTypes';

const article: ArticleContent = {
  slug: 'scpi-fiscalite',
  category: 'scpi',
  title: "SCPI et fiscalité : ce qu'il faut vérifier avant d'investir",
  metaTitle: "SCPI et fiscalité : ce qu'il faut vérifier avant d'investir",
  metaDescription: "Fiscalité des SCPI : revenus fonciers, TMI, prélèvements sociaux, SCPI européennes, assurance-vie, démembrement, SCI. Eric Bellaiche, CGP-CIF ORIAS 13001580, vous accompagne dans l'analyse.",
  canonical: 'https://eric-bellaiche.fr/articles/scpi-fiscalite/',
  badge: 'Fiscalité SCPI &bull; Analyse CGP-CIF',
  intro: "Investir en SCPI sans analyser l'impact fiscal peut réduire significativement le rendement net attendu. Eric Bellaiche, CGP-CIF, vous aide à comprendre les implications fiscales avant toute souscription.",
  shortAnswer: "Les revenus SCPI sont imposés à l'impôt sur le revenu (dans la catégorie des revenus fonciers) et aux prélèvements sociaux. La fiscalité varie selon la TMI, le type de SCPI, le mode de détention et la situation personnelle de l'investisseur.",
  summaryItems: [
    { label: 'Les revenus SCPI et leur imposition', anchor: 'revenus-scpi-imposition' },
    { label: 'Les paramètres fiscaux à vérifier', anchor: 'parametres-fiscaux' },
    { label: 'SCPI fiscales vs SCPI de rendement', anchor: 'scpi-fiscales-vs-rendement' },
    { label: 'Questions fréquentes', anchor: 'faq' },
  ],
  readingTime: 5,
  updatedAt: '2026-06-11',
  author: 'Eric Bellaiche, CGP-CIF',
  tags: ['SCPI', 'fiscalité', 'impôt', 'TMI', 'CGP-CIF'],
  sections: [
    {
      id: 'revenus-scpi-imposition',
      title: 'Les revenus SCPI et leur imposition',
      level: 'h2',
      type: 'normal',
      content: [
        "Les revenus distribués par les SCPI sont imposés dans la catégorie des revenus fonciers. Ils sont soumis au barème progressif de l'impôt sur le revenu (TMI) et aux prélèvements sociaux (17,2 %). Le taux d'imposition réel dépend de la tranche marginale d'imposition du foyer fiscal.",
      ],
    },
    {
      id: 'parametres-fiscaux',
      title: 'Les paramètres fiscaux à vérifier',
      level: 'h2',
      type: 'normal',
      content: [
        "Plusieurs paramètres fiscaux doivent être analysés avant un investissement SCPI : la TMI, les prélèvements sociaux, le régime des SCPI européennes, la détention en assurance-vie, le démembrement et la détention via SCI.",
      ],
    },
    {
      id: 'scpi-fiscales-vs-rendement',
      title: 'SCPI fiscales vs SCPI de rendement',
      level: 'h2',
      type: 'normal',
      content: [
        "Certaines SCPI dites fiscales offrent des avantages fiscaux spécifiques (Pinel, Malraux, Déficit Foncier) mais présentent des contraintes et des risques propres. Le choix entre SCPI fiscale et SCPI de rendement dépend de la situation personnelle et des objectifs du client.",
      ],
    },
  ],
  faq: [
    { question: 'Comment sont imposés les revenus des SCPI ?', answer: "Les revenus SCPI sont soumis à l'impôt sur le revenu dans la catégorie des revenus fonciers, auxquels s'ajoutent les prélèvements sociaux. La fiscalité varie selon le type de SCPI et le mode de détention." },
    { question: 'Les SCPI européennes sont-elles fiscalement avantageuses ?', answer: "Les SCPI européennes peuvent offrir une fiscalité différente selon les conventions fiscales entre la France et le pays d'investissement. Une analyse personnalisée est nécessaire." },
    { question: 'Quelle fiscalité pour des SCPI détenues en assurance-vie ?', answer: "Les SCPI détenues en unités de compte dans un contrat d'assurance-vie bénéficient de la fiscalité propre à l'assurance-vie : exonération d'impôt sur le revenu des plus-values en cas de rachat après 8 ans (sous conditions), prélèvements sociaux applicables." },
  ],
  ctaTitle: "Vous souhaitez analyser l'impact fiscal d'un projet SCPI ?",
  ctaText: "Réservez un créneau gratuit pour échanger avec Eric Bellaiche.",
  ctaLink: 'https://calendly.com/eric-bellaiche/consultation-avec-eric-bellaiche-clone',
  externalLinks: [
    { href: 'https://maximusscpi.com/', label: 'MaximusSCPI', onlyInScpi: true },
  ],
  hasRisks: true,
};

export default article;
