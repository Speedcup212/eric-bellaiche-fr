import { ArticleContent } from '../../content/articles/articleTypes';

const CATEGORY_LABELS: Record<string, string> = {
  scpi: 'SCPI',
  fiscalite: 'Fiscalité',
  'assurance-vie': 'Assurance-vie',
  retraite: 'Retraite',
  audit: 'Audit',
  patrimoine: 'Patrimoine',
};

const CATEGORY_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  scpi: { bg: '#1E3A5F', text: '#93C5FD' },
  fiscalite: { bg: '#064E3B', text: '#6EE7B7' },
  'assurance-vie': { bg: '#3B0764', text: '#C4B5FD' },
  retraite: { bg: '#451A03', text: '#FCD34D' },
  audit: { bg: '#083344', text: '#67E8F9' },
  patrimoine: { bg: '#4A0E3B', text: '#F9A8D4' },
};

export default function ArticleCard({ article }: { article: ArticleContent }) {
  const categoryLabel = CATEGORY_LABELS[article.category] || article.category;
  const badgeColors = CATEGORY_BADGE_COLORS[article.category] || { bg: '#1e293b', text: '#94a3b8' };

  return (
    <a
      href={`/articles/${article.slug}/`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <div
        style={{
          background: '#111827',
          border: '1px solid #1e293b',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#D4A84F';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(212,168,79,0.12)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#1e293b';
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        {/* Category badge */}
        <span
          style={{
            display: 'inline-block',
            background: badgeColors.bg,
            color: badgeColors.text,
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
            color: '#f1f5f9',
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
            color: '#94a3b8',
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

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
            {article.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: '0.68rem',
                  color: '#64748b',
                  background: '#1e293b',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '0.2rem',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer: reading time + CTA */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 'auto',
            paddingTop: '0.75rem',
            borderTop: '1px solid #1e293b',
          }}
        >
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
            {article.readingTime} min de lecture
          </span>
          <span
            style={{
              color: '#D4A84F',
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
