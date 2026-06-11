import { ArticleContent } from './articleTypes';

import conseillerScpi from './conseiller-scpi';
import auditPatrimonialEnLigne from './audit-patrimonial-en-ligne';
import scpiFiscalite from './scpi-fiscalite';
import scpiAssuranceVieOuDirect from './scpi-assurance-vie-ou-direct';
import perOuAssuranceVie from './per-ou-assurance-vie';

export const articles: ArticleContent[] = [
  conseillerScpi,
  auditPatrimonialEnLigne,
  scpiFiscalite,
  scpiAssuranceVieOuDirect,
  perOuAssuranceVie,
];

export const articlesBySlug: Record<string, ArticleContent> = {};
for (const article of articles) {
  articlesBySlug[article.slug] = article;
}

export function getArticleBySlug(slug: string): ArticleContent | undefined {
  return articlesBySlug[slug];
}

export function getArticlesByCategory(category: string): ArticleContent[] {
  return articles.filter((a) => a.category === category);
}
