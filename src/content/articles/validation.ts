import { ArticleContent } from './articleTypes';

interface ValidationWarning {
  slug: string;
  field: string;
  message: string;
}

export function validateArticle(article: ArticleContent): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (!article.metaDescription || article.metaDescription.length < 50) {
    warnings.push({ slug: article.slug, field: 'metaDescription', message: 'Meta description manquante ou trop courte' });
  }
  if (!article.faq || article.faq.length < 2) {
    warnings.push({ slug: article.slug, field: 'faq', message: 'Moins de 2 FAQ questions' });
  }
  if (!article.shortAnswer || article.shortAnswer.length < 30) {
    warnings.push({ slug: article.slug, field: 'shortAnswer', message: 'Réponse courte manquante ou trop courte' });
  }
  if (!article.ctaTitle || !article.ctaLink) {
    warnings.push({ slug: article.slug, field: 'cta', message: 'CTA incomplet (titre ou lien manquant)' });
  }
  if (!article.canonical) {
    warnings.push({ slug: article.slug, field: 'canonical', message: 'Canonical manquant' });
  }
  if (article.hasRisks && (!article.sections.find((s) => s.type === 'risk') && !article.sections.find((s) => s.id === 'risques'))) {
    warnings.push({ slug: article.slug, field: 'risks', message: 'Article SCPI sans bloc risques explicite' });
  }
  if (!article.sections || article.sections.length < 2) {
    warnings.push({ slug: article.slug, field: 'sections', message: 'Moins de 2 sections de contenu' });
  }

  return warnings;
}

export function validateAllArticles(articles: ArticleContent[]): ValidationWarning[] {
  return articles.flatMap(validateArticle);
}
