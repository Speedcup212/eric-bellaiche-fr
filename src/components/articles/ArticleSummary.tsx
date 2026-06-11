import { ArticleContent } from '../../content/articles/articleTypes';
import { Icon, ICONS } from './ArticleIcons';

export default function ArticleSummary({ article }: { article: ArticleContent }) {
  if (!article.shortAnswer) return null;

  return (
    <div style={{
      background: '#f0f7ff',
      borderLeft: '4px solid #C5A059',
      borderRadius: '0 0.75rem 0.75rem 0',
      padding: '1.5rem 1.75rem',
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
        marginBottom: '0.5rem',
      }}>
        <Icon icon={ICONS.summary} size={18} color="#C5A059" />
        Réponse courte
      </span>
      <p style={{
        color: '#1e3a5f',
        fontSize: '1rem',
        lineHeight: 1.7,
        margin: 0,
      }}>
        {article.shortAnswer}
      </p>
    </div>
  );
}
