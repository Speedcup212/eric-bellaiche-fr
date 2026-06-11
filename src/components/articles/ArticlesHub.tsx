import { articles } from '../../content/articles/articlesIndex';
import ArticleCard from './ArticleCard';

export default function ArticlesHub() {
  return (
    <section style={{ padding: '3.5rem 0' }}>
      <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '0 1rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ fontSize: '1rem', color: '#475569', lineHeight: 1.7, maxWidth: '48rem' }}>
            Retrouvez des analyses pédagogiques pour mieux comprendre les SCPI, l'assurance-vie, le PER, la fiscalité patrimoniale,
            l'immobilier, la retraite et la transmission. Ces contenus sont informatifs et ne remplacent pas une analyse personnalisée
            de votre situation.
          </p>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1.25rem',
        }}>
          {articles.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      </div>
    </section>
  );
}
