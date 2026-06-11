import { ArticleContent } from '../../content/articles/articleTypes';

export default function ArticleCTA({ article }: { article: ArticleContent }) {
  return (
    <section
      style={{
        background: 'linear-gradient(135deg, #0F2B46 0%, #1a3f64 100%)',
        color: '#fff',
        padding: '3.5rem 0',
        textAlign: 'center' as const,
      }}
    >
      <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '0 1rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem', color: '#fff' }}>
          {article.ctaTitle}
        </h2>
        {article.ctaText && (
          <p style={{ color: '#94a3b8', marginBottom: '2rem', fontSize: '1.0625rem', maxWidth: '36rem', marginLeft: 'auto', marginRight: 'auto' }}>
            {article.ctaText}
          </p>
        )}
        <a
          href={article.ctaLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: '#C5A059',
            color: '#fff',
            fontWeight: 700,
            fontSize: '1.0625rem',
            padding: '1rem 2.5rem',
            borderRadius: '0.5rem',
            textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          Prendre rendez-vous
        </a>
      </div>
    </section>
  );
}
