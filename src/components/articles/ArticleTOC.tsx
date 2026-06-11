import { ArticleContent } from '../../content/articles/articleTypes';
import { Icon, ICONS } from './ArticleIcons';

export default function ArticleTOC({ article }: { article: ArticleContent }) {
  if (!article.summaryItems || article.summaryItems.length === 0) return null;

  const items = article.summaryItems;
  const colCount = items.length >= 8 ? 2 : 1;

  return (
    <div style={{
      background: '#fafafa',
      border: '1px solid #e2e8f0',
      borderRadius: '0.75rem',
      padding: '1.5rem 1.75rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <span style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontWeight: 700,
        color: '#0F2B46',
        fontSize: '0.8125rem',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        marginBottom: '1rem',
      }}>
        <Icon icon={ICONS.toc} size={17} color="#0F2B46" />
        Sommaire
      </span>
      <div style={{
        display: 'grid',
        gridTemplateColumns: colCount === 2 ? '1fr 1fr' : '1fr',
        gap: '0.2rem 1.5rem',
      }}>
        {items.map((item) => (
          <a
            key={item.anchor}
            href={`#${item.anchor}`}
            style={{
              color: '#1e40af',
              fontSize: '0.9375rem',
              textDecoration: 'none',
              lineHeight: 1.65,
              padding: '0.2rem 0',
              borderBottom: '1px solid transparent',
              transition: 'border-color 0.12s, color 0.12s',
            }}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(item.anchor)?.scrollIntoView({ behavior: 'smooth' });
            }}
            onMouseEnter={(e) => {
              const el = e.target as HTMLElement;
              el.style.borderBottomColor = '#C5A059';
              el.style.color = '#C5A059';
            }}
            onMouseLeave={(e) => {
              const el = e.target as HTMLElement;
              el.style.borderBottomColor = 'transparent';
              el.style.color = '#1e40af';
            }}
          >
            {item.label}
          </a>
        ))}
      </div>
    </div>
  );
}
