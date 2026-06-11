import { ArticleContent } from '../../content/articles/articleTypes';

export default function ArticleCard({ article }: { article: ArticleContent }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '0.75rem',
      padding: '1.5rem',
      transition: 'border-color 0.15s, box-shadow 0.15s',
      cursor: 'pointer',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#C5A059'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(197,160,89,0.12)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <span style={{
        display: 'inline-block',
        background: '#0F2B46',
        color: '#fff',
        fontSize: '0.7rem',
        fontWeight: 600,
        padding: '0.2rem 0.6rem',
        borderRadius: '0.25rem',
        marginBottom: '0.75rem',
        textTransform: 'uppercase',
        letterSpacing: '0.02em',
      }}>
        {article.category}
      </span>
      <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0F2B46', marginBottom: '0.5rem', lineHeight: 1.3 }}>
        {article.title}
      </h3>
      <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem', lineHeight: 1.6 }}>
        {article.metaDescription}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
          {article.readingTime} min de lecture
        </span>
        <a
          href={`/articles/${article.slug}/`}
          style={{
            color: '#C5A059',
            fontWeight: 600,
            fontSize: '0.875rem',
            textDecoration: 'none',
          }}
        >
          Lire l'article →
        </a>
      </div>
    </div>
  );
}
