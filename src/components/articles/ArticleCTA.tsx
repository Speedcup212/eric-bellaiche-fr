import { ArticleContent } from '../../content/articles/articleTypes';
import { Icon, ICONS } from './ArticleIcons';

export default function ArticleCTA({ article }: { article: ArticleContent }) {
  return (
    <section style={{
      background: 'linear-gradient(135deg, #0F2B46 0%, #1a3f64 100%)',
      color: '#fff',
      padding: '3.5rem 0',
      textAlign: 'center',
    }}>
      <div style={{
        maxWidth: '960px',
        margin: '0 auto',
        padding: '0 1.5rem',
      }}>
        <h2 style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          marginBottom: '0.75rem',
          color: '#fff',
          lineHeight: 1.25,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.45rem',
          flexWrap: 'wrap',
        }}>
          <span style={{ display: 'inline-flex', color: '#C5A059', lineHeight: 0 }}>
            <Icon icon={ICONS.cta} size={24} />
          </span>
          {article.ctaTitle}
        </h2>
        {article.ctaText && (
          <p style={{
            color: '#cbd5e1',
            marginBottom: '1.75rem',
            fontSize: '1.0625rem',
            lineHeight: 1.7,
            maxWidth: '640px',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
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
            letterSpacing: '0.02em',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = '0.88'; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = '1'; }}
        >
          Prendre rendez-vous
        </a>
      </div>
    </section>
  );
}
