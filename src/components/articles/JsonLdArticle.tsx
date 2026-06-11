import { useEffect } from 'react';
import { ArticleContent, FAQItem } from '../../content/articles/articleTypes';

const JSONLD_ID_PREFIX = 'jsonld-article-';

/** Injecte le JSON-LD WebPage + FAQPage dans le <head> */
export default function JsonLdArticle({ article, faq }: { article: ArticleContent; faq: FAQItem[] }) {
  useEffect(() => {
    const id = JSONLD_ID_PREFIX + article.slug;
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    const structuredData: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          name: article.metaTitle,
          url: article.canonical,
          description: article.metaDescription,
          about: { '@type': 'Person', name: 'Eric Bellaiche' },
        },
      ],
    };

    if (faq.length > 0) {
      (structuredData['@graph'] as unknown[]).push({
        '@type': 'FAQPage',
        mainEntity: faq.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      });
    }

    const script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);

    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, [article, faq]);

  return null;
}
