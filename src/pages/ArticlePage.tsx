import { useEffect } from 'react';
import ArticleLayout from '../components/articles/ArticleLayout';
import JsonLdArticle from '../components/articles/JsonLdArticle';
import { getArticleBySlug } from '../content/articles/articlesIndex';

function setOrCreateMeta(name: string, content: string) {
  const selector = `meta[name="${name}"]`;
  let el = document.querySelector(selector) as HTMLMetaElement | null;
  if (el) {
    el.setAttribute('content', content);
  } else {
    el = document.createElement('meta');
    el.name = name;
    el.content = content;
    document.head.appendChild(el);
  }
}

function setOrCreateOgMeta(property: string, content: string) {
  const selector = `meta[property="${property}"]`;
  let el = document.querySelector(selector) as HTMLMetaElement | null;
  if (el) {
    el.setAttribute('content', content);
  } else {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    el.content = content;
    document.head.appendChild(el);
  }
}

function setOrCreateCanonical(href: string) {
  const selector = 'link[rel="canonical"]';
  let el = document.querySelector(selector) as HTMLLinkElement | null;
  if (el) {
    el.setAttribute('href', href);
  } else {
    el = document.createElement('link');
    el.rel = 'canonical';
    el.href = href;
    document.head.appendChild(el);
  }
}

export default function ArticlePage({ slug }: { slug: string }) {
  const article = getArticleBySlug(slug);

  useEffect(() => {
    if (!article) return;

    document.title = article.metaTitle;
    setOrCreateMeta('description', article.metaDescription);
    setOrCreateCanonical(article.canonical);

    setOrCreateOgMeta('og:title', article.metaTitle);
    setOrCreateOgMeta('og:description', article.metaDescription);
    setOrCreateOgMeta('og:type', 'website');
    setOrCreateOgMeta('og:url', article.canonical);
    setOrCreateOgMeta('og:site_name', 'Eric Bellaiche');
    setOrCreateOgMeta('og:locale', 'fr_FR');
  }, [article]);

  if (!article) {
    return (
      <div style={{ padding: '4rem 1rem', textAlign: 'center', color: '#64748b' }}>
        <p>Article non trouvé.</p>
        <a href="/articles/" style={{ color: '#C5A059' }}>Voir tous les articles</a>
      </div>
    );
  }

  return (
    <>
      <JsonLdArticle article={article} faq={article.faq} />
      <ArticleLayout article={article} />
    </>
  );
}
