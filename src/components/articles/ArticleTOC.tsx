import { ArticleContent } from '../../content/articles/articleTypes';

export default function ArticleTOC({ article }: { article: ArticleContent }) {
  if (!article.summaryItems || article.summaryItems.length === 0) return null;

  return (
    <div style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
      <div style={{ fontWeight: 700, color: '#0F2B46', fontSize: '0.9375rem', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        Sommaire
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {article.summaryItems.map((item) => (
          <li key={item.anchor} style={{ marginBottom: '0.3rem' }}>
            <a
              href={`#${item.anchor}`}
              style={{ color: '#1e40af', fontSize: '0.9375rem', textDecoration: 'none' }}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(item.anchor)?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
