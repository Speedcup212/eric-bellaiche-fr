import { ArticleContent } from '../../content/articles/articleTypes';

const CATEGORY_LABELS: Record<string, string> = {
  scpi: 'SCPI',
  fiscalite: 'Fiscalité',
  'assurance-vie': 'Assurance-vie',
  retraite: 'Retraite',
  audit: 'Audit',
  patrimoine: 'Patrimoine',
};

const CATEGORY_COLORS: Record<string, string> = {
  scpi: '#0F2B46',
  fiscalite: '#2D6A4F',
  'assurance-vie': '#5B4B8A',
  retraite: '#9B6B3C',
  audit: '#1A5F7A',
  patrimoine: '#7C3A50',
};

export default function ArticleCard({ article }: { article: ArticleContent }) {
  const categoryLabel = CATEGORY_LABELS[article.category] || article.category;
  const categoryColor = CATEGORY_COLORS[article.category] || '#0F2B46';

  return (
    <a
      href={`/articles/${article.slug}/`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#C5A059';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(197,160,89,0.15)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#e2e8f0';
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        {/* Category badge */}
        <span
          style={{
            display: 'inline-block',
            background: categoryColor,
            color: '#fff',
            fontSize: '0.7rem',
            fontWeight: 600,
            padding: '0.2rem 0.6rem',
            borderRadius: '0.25rem',
            marginBottom: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            alignSelf: 'flex-start',
          }}
        >
          {categoryLabel}
        </span>

        {/* Title */}
        <h3
          style={{
            fontSize: '1.05rem',
            fontWeight: 700,
            color: '#0F2B46',
            marginBottom: '0.5rem',
            lineHeight: 1.35,
          }}
        >
          {article.title}
        </h3>

        {/* Description */}
        <p
          style={{
            fontSize: '0.85rem',
            color: '#64748b',
            marginBottom: '1rem',
            lineHeight: 1.6,
            flex: 1,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {article.metaDescription}
        </p>

        {/* Footer: reading time + CTA */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 'auto',
            paddingTop: '0.75rem',
            borderTop: '1px solid #f1f5f9',
          }}
        >
          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
            {article.readingTime} min de lecture
          </span>
          <span
            style={{
              color: '#C5A059',
              fontWeight: 600,
              fontSize: '0.85rem',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            Lire l'article →
          </span>
        </div>
      </div>
    </a>
  );
}
