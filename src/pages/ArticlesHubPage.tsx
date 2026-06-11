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

const META_TITLE = 'Articles patrimoniaux — SCPI, fiscalité, assurance-vie, PER, immobilier, retraite, transmission';
const META_DESC = 'Analyses pédagogiques signées Eric Bellaiche, CGP-CIF : SCPI, fiscalité, assurance-vie, PER, immobilier, retraite, transmission. 25 articles longs avec FAQ, tableaux et exemples concrets.';

const HERO_STYLES = `
  .hub-hero {
    padding: 5rem 0 4rem;
  }
  @media (max-width: 640px) {
    .hub-hero {
      padding: 3rem 0 2.5rem;
    }
  }
`;

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
      <style>{HERO_STYLES}</style>

      {/* JSON-LD for hub page */}
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

      {/* ─── Navigation ─── */}
      <nav style={{ background: '#0B1220', borderBottom: '1px solid #1e293b', padding: '0.75rem 0' }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <a href="/" style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '1rem', textDecoration: 'none' }}>
            Eric Bellaiche
          </a>
          <span style={{ color: '#475569', fontSize: '0.75rem' }}>&middot;</span>
          <a href="/" style={{ color: '#64748b', fontSize: '0.875rem', textDecoration: 'none' }}>Accueil</a>
          <span style={{ color: '#475569', fontSize: '0.75rem' }}>&middot;</span>
          <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Articles</span>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <header
        className="hub-hero"
        style={{
          background: 'linear-gradient(135deg, #0B1220 0%, #111827 50%, #0f1729 100%)',
          color: '#f1f5f9',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative subtle gradient overlay */}
        <div
          style={{
            position: 'absolute',
            top: '-30%',
            right: '-10%',
            width: '40%',
            height: '80%',
            background: 'radial-gradient(ellipse, rgba(212,168,79,0.04) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '0 1rem', position: 'relative' }}>
          {/* Icon */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '3rem',
              height: '3rem',
              borderRadius: '0.75rem',
              background: 'rgba(212,168,79,0.1)',
              marginBottom: '1.5rem',
              fontSize: '1.35rem',
            }}
          >
            &#x1F4DA;
          </div>

          <h1 style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1.2, marginBottom: '1rem' }}>
            Articles patrimoniaux
          </h1>

          <p style={{ fontSize: '1.0625rem', color: '#94a3b8', maxWidth: '48rem', lineHeight: 1.7, marginBottom: '1.25rem' }}>
            SCPI, fiscalité, assurance-vie, PER, immobilier, retraite et transmission : des analyses pédagogiques
            pour structurer vos décisions patrimoniales.
          </p>

          {/* Badge */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {['Analyses', 'Pédagogie', 'Patrimoine', 'CGP-CIF'].map((tag) => (
              <span
                key={tag}
                style={{
                  display: 'inline-block',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#94a3b8',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  padding: '0.25rem 0.7rem',
                  borderRadius: '2rem',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* ─── Hub content (search, filters, stats, cards) ─── */}
      <ArticlesHub />

      {/* ─── Footer ─── */}
      <footer style={{ background: '#0B1220', borderTop: '1px solid #1e293b', color: '#64748b', padding: '2.5rem 0', fontSize: '0.875rem' }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '0 1rem', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <a href="/" style={{ color: '#94a3b8', textDecoration: 'none' }}>Accueil</a>
            <a href="/eric-bellaiche-cgp-cif/" style={{ color: '#94a3b8', textDecoration: 'none' }}>Qui suis-je</a>
            <a href="/conseiller-scpi/" style={{ color: '#94a3b8', textDecoration: 'none' }}>Conseiller SCPI</a>
          </div>
          <p>&copy; {new Date().getFullYear()} Eric Bellaiche &mdash; CGP-CIF &bull; ORIAS 13001580</p>
        </div>
      </footer>
    </>
  );
}
