import { useEffect } from 'react';
import { articles } from '../content/articles/articlesIndex';
import JsonLdArticle from '../components/articles/JsonLdArticle';
import ArticlesHub from '../components/articles/ArticlesHub';

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

const META_TITLE = 'Articles patrimoniaux — SCPI, fiscalité, retraite et immobilier';
const META_DESC = 'Analyses patrimoniales pédagogiques sur les SCPI, l\'assurance-vie, le PER, la fiscalité, l\'immobilier, la retraite et la transmission avec Eric Bellaiche, CGP-CIF inscrit ORIAS n°13001580.';

export default function ArticlesHubPage() {
  useEffect(() => {
    document.title = META_TITLE;
    setOrCreateMeta('description', META_DESC);
    setOrCreateCanonical('https://eric-bellaiche.fr/articles/');
    setOrCreateOgMeta('og:title', META_TITLE);
    setOrCreateOgMeta('og:description', META_DESC);
    setOrCreateOgMeta('og:type', 'website');
    setOrCreateOgMeta('og:url', 'https://eric-bellaiche.fr/articles/');
    setOrCreateOgMeta('og:site_name', 'Eric Bellaiche');
    setOrCreateOgMeta('og:locale', 'fr_FR');
  }, []);

  return (
    <>
      {/* Hub uses a simpler JSON-LD — just for this listing page */}
      <JsonLdArticle
        article={{
          slug: 'articles',
          category: 'patrimoine',
          title: META_TITLE,
          metaTitle: META_TITLE,
          metaDescription: META_DESC,
          canonical: 'https://eric-bellaiche.fr/articles/',
          badge: '',
          intro: '',
          shortAnswer: '',
          summaryItems: [],
          readingTime: 0,
          updatedAt: '',
          author: '',
          tags: [],
          sections: [],
          faq: [
            { question: 'Quels sont les sujets abordés dans ces articles ?', answer: 'Les articles couvrent les SCPI, l\'assurance-vie, le PER, la fiscalité patrimoniale, l\'immobilier, la retraite et la transmission.' },
            { question: 'Ces articles remplacent-ils un conseil personnalisé ?', answer: 'Non, ces contenus sont informatifs et ne remplacent pas une analyse personnalisée de votre situation par un CGP-CIF.' },
            { question: 'Qui rédige ces articles ?', answer: 'Les articles sont rédigés par Eric Bellaiche, CGP-CIF inscrit ORIAS n°13001580.' },
          ],
          ctaTitle: '',
          ctaText: '',
          ctaLink: '',
        }}
        faq={[
          { question: 'Quels sont les sujets abordés dans ces articles ?', answer: 'Les articles couvrent les SCPI, l\'assurance-vie, le PER, la fiscalité patrimoniale, l\'immobilier, la retraite et la transmission.' },
          { question: 'Ces articles remplacent-ils un conseil personnalisé ?', answer: 'Non, ces contenus sont informatifs et ne remplacent pas une analyse personnalisée de votre situation par un CGP-CIF.' },
          { question: 'Qui rédige ces articles ?', answer: 'Les articles sont rédigés par Eric Bellaiche, CGP-CIF inscrit ORIAS n°13001580.' },
        ]}
      />

      {/* Navigation */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0.75rem 0' }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <a href="/" style={{ fontWeight: 700, color: '#0F2B46', fontSize: '1rem', textDecoration: 'none' }}>Eric Bellaiche</a>
          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>&middot;</span>
          <a href="/" style={{ color: '#64748b', fontSize: '0.875rem', textDecoration: 'none' }}>Accueil</a>
        </div>
      </nav>

      {/* Hero */}
      <header style={{ background: 'linear-gradient(135deg, #0F2B46 0%, #1a3f64 100%)', color: '#fff', padding: '5rem 0 4rem' }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '0 1rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1.2, marginBottom: '1.25rem' }}>
            Articles patrimoniaux
          </h1>
          <p style={{ fontSize: '1.0625rem', color: '#cbd5e1', maxWidth: '48rem', lineHeight: 1.7 }}>
            Analyses pédagogiques pour mieux comprendre les SCPI, l'assurance-vie, le PER, la fiscalité patrimoniale,
            l'immobilier, la retraite et la transmission.
          </p>
        </div>
      </header>

      {/* Articles grid */}
      <ArticlesHub />

      {/* Footer */}
      <footer style={{ background: '#0F2B46', color: '#94a3b8', padding: '2rem 0', fontSize: '0.875rem' }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '0 1rem', textAlign: 'center' }}>
          <p style={{ marginBottom: '0.75rem' }}>
            <a href="/" style={{ color: '#fff', fontWeight: 600, textDecoration: 'none' }}>eric-bellaiche.fr</a>
            <span style={{ margin: '0 0.5rem' }}>&bull;</span>
            <a href="/" style={{ color: '#94a3b8', textDecoration: 'none' }}>Retour au cabinet</a>
          </p>
          <p>&copy; 2025 Eric Bellaiche &mdash; CGP-CIF &bull; ORIAS 13001580</p>
        </div>
      </footer>
    </>
  );
}
