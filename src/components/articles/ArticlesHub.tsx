import { articles, articlesBySlug } from '../../content/articles/articlesIndex';
import ArticleCard from './ArticleCard';
import { ArticleContent } from '../../content/articles/articleTypes';

interface HubSection {
  id: string;
  title: string;
  description: string;
  slugs: string[];
}

const SECTIONS: HubSection[] = [
  {
    id: 'cles',
    title: 'Articles clés',
    description: 'Les analyses essentielles pour comprendre les fondamentaux de la gestion de patrimoine.',
    slugs: [
      'conseiller-scpi',
      'audit-patrimonial-en-ligne',
      'scpi-fiscalite',
      'scpi-assurance-vie-ou-direct',
      'per-ou-assurance-vie',
    ],
  },
  {
    id: 'scpi',
    title: 'SCPI',
    description: 'Investir dans l\'immobilier papier : crédit, démembrement, succession, revenus complémentaires.',
    slugs: [
      'scpi-a-credit',
      'scpi-demembrement',
      'scpi-retraite',
      'scpi-revenus-complementaires',
      'scpi-succession-transmission',
    ],
  },
  {
    id: 'fiscalite',
    title: 'Fiscalité & Enveloppes',
    description: 'Optimiser sa fiscalité : PER, assurance-vie, revenus fonciers, réduction d\'impôt.',
    slugs: [
      'per-fiscalite',
      'assurance-vie-fiscalite',
      'assurance-vie-apres-70-ans',
      'reduire-impot-sans-risque-excessif',
      'fiscalite-revenus-fonciers',
    ],
  },
  {
    id: 'immobilier',
    title: 'Immobilier Patrimonial',
    description: 'Location meublée, SCI, déficit foncier : les stratégies immobilières pour bâtir son patrimoine.',
    slugs: [
      'lmnp-ou-location-nue',
      'sci-ir-ou-sci-is',
      'immobilier-locatif-fiscalite',
      'deficit-foncier',
      'investissement-locatif-retraite',
    ],
  },
  {
    id: 'patrimoine',
    title: 'Méthode & Patrimoine',
    description: 'Structurer, préparer, transmettre : une approche globale avec la méthode Eric Bellaiche.',
    slugs: [
      'conseiller-patrimoine-en-ligne',
      'structurer-son-patrimoine',
      'preparer-retraite-patrimoine',
      'transmission-patrimoine-famille-recomposee',
      'erreurs-gestion-patrimoine',
    ],
  },
];

const GRID_STYLES = `
  .hub-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.25rem;
  }
  @media (max-width: 1024px) {
    .hub-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (max-width: 640px) {
    .hub-grid {
      grid-template-columns: 1fr;
    }
  }
`;

export default function ArticlesHub() {
  return (
    <section style={{ padding: '3.5rem 0' }}>
      <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '0 1rem' }}>
        {/* Intro */}
        <div style={{ marginBottom: '2.5rem' }}>
          <p style={{ fontSize: '1rem', color: '#475569', lineHeight: 1.7, maxWidth: '48rem' }}>
            Retrouvez des analyses pédagogiques pour mieux comprendre les SCPI, l'assurance-vie, le PER, la fiscalité
            patrimoniale, l'immobilier, la retraite et la transmission. Ces contenus sont informatifs et ne remplacent
            pas une analyse personnalisée de votre situation.
          </p>
        </div>

        <style>{GRID_STYLES}</style>

        {SECTIONS.map((section) => {
          const sectionArticles = section.slugs
            .map((slug) => articlesBySlug[slug])
            .filter(Boolean) as ArticleContent[];

          if (sectionArticles.length === 0) return null;

          return (
            <div key={section.id} style={{ marginBottom: '3rem' }}>
              {/* Section header */}
              <h2
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#0F2B46',
                  marginBottom: '0.5rem',
                  paddingBottom: '0.5rem',
                  borderBottom: '2px solid #C5A059',
                  display: 'inline-block',
                }}
              >
                {section.title}
              </h2>
              <p
                style={{
                  fontSize: '0.9rem',
                  color: '#64748b',
                  marginBottom: '1.25rem',
                  marginTop: '0.5rem',
                  lineHeight: 1.5,
                }}
              >
                {section.description}
              </p>

              {/* Article cards grid */}
              <div className="hub-grid">
                {sectionArticles.map((article) => (
                  <ArticleCard key={article.slug} article={article} />
                ))}
              </div>
            </div>
          );
        })}

        {/* Total count */}
        <div
          style={{
            textAlign: 'center',
            padding: '1.5rem 0 0',
            color: '#94a3b8',
            fontSize: '0.85rem',
            borderTop: '1px solid #e2e8f0',
          }}
        >
          {articles.length} articles pédagogiques — Eric Bellaiche, CGP-CIF inscrit ORIAS n°13001580
        </div>
      </div>
    </section>
  );
}
