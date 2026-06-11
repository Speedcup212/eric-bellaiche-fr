import { ArticleContent } from '../../content/articles/articleTypes';

const styles = {
  wrapper: { background: '#eff6ff', borderLeft: '4px solid #2563eb', borderRadius: '0 0.75rem 0.75rem 0', padding: '1.25rem 1.5rem', marginBottom: '1.5rem' } as React.CSSProperties,
  label: { fontWeight: 700, color: '#1e40af', fontSize: '0.8rem', textTransform: 'uppercase' as const, letterSpacing: '0.03em', marginBottom: '0.4rem' },
  text: { color: '#1e40af', fontSize: '0.9375rem', margin: 0 },
};

export default function ArticleSummary({ article }: { article: ArticleContent }) {
  if (!article.shortAnswer) return null;
  return (
    <div style={styles.wrapper}>
      <div style={styles.label}>Réponse courte</div>
      <p style={styles.text}>{article.shortAnswer}</p>
    </div>
  );
}
