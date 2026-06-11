import { useState, useMemo, useRef } from 'react';
import { articles } from '../../content/articles/articlesIndex';
import ArticleCard from './ArticleCard';
import { ArticleContent } from '../../content/articles/articleTypes';

/* ── Filter / theme mapping ── */

interface FilterOption {
  id: string;
  label: string;
  test: (a: ArticleContent) => boolean;
}

const FILTERS: FilterOption[] = [
  { id: 'all', label: 'Tous les articles', test: () => true },
  {
    id: 'scpi',
    label: 'SCPI',
    test: (a) => a.category === 'scpi',
  },
  {
    id: 'fiscalite',
    label: 'Fiscalité',
    test: (a) =>
      a.category === 'fiscalite' ||
      a.slug.includes('impot') ||
      a.slug.includes('fiscalite'),
  },
  {
    id: 'assurance-vie-per',
    label: 'Assurance-vie & PER',
    test: (a) =>
      a.category === 'assurance-vie' ||
      a.slug.includes('assurance-vie') ||
      a.slug.includes('per-') ||
      a.slug.includes('per-ou'),
  },
  {
    id: 'immobilier',
    label: 'Immobilier',
    test: (a) =>
      a.category === 'fiscalite' &&
      (a.slug.includes('lmnp') ||
       a.slug.includes('sci-') ||
       a.slug.includes('immobilier') ||
       a.slug.includes('deficit') ||
       a.slug.includes('investissement-locatif')),
  },
  {
    id: 'retraite',
    label: 'Retraite',
    test: (a) => a.category === 'retraite',
  },
  {
    id: 'transmission',
    label: 'Transmission',
    test: (a) =>
      a.slug.includes('transmission') ||
      a.slug.includes('succession'),
  },
  {
    id: 'patrimoine',
    label: 'Méthode patrimoniale',
    test: (a) =>
      a.category === 'patrimoine' ||
      a.category === 'audit',
  },
];

/* ── Quick-access themes ── */

interface QuickTheme {
  id: string;
  label: string;
  icon: string;
  slug: string;
  test: (a: ArticleContent) => boolean;
}

const QUICK_THEMES: QuickTheme[] = [
  {
    id: 'scpi',
    label: 'Investir en SCPI',
    icon: '📈',
    slug: '#filter-scpi',
    test: (a) => a.category === 'scpi',
  },
  {
    id: 'fiscalite',
    label: 'Fiscalité et enveloppes',
    icon: '📋',
    slug: '#filter-fiscalite',
    test: (a) =>
      a.category === 'fiscalite' || a.category === 'assurance-vie' || a.slug.includes('per-'),
  },
  {
    id: 'immobilier',
    label: 'Immobilier locatif',
    icon: '🏠',
    slug: '#filter-immobilier',
    test: (a) =>
      (a.category === 'fiscalite') &&
      (a.slug.includes('lmnp') || a.slug.includes('sci-') || a.slug.includes('immobilier') || a.slug.includes('deficit') || a.slug.includes('investissement-locatif')),
  },
  {
    id: 'retraite',
    label: 'Préparer sa retraite',
    icon: '⏳',
    slug: '#filter-retraite',
    test: (a) => a.category === 'retraite',
  },
  {
    id: 'transmission',
    label: 'Transmission patrimoniale',
    icon: '📜',
    slug: '#filter-transmission',
    test: (a) => a.slug.includes('transmission') || a.slug.includes('succession'),
  },
  {
    id: 'methode',
    label: 'Structurer son patrimoine',
    icon: '⚙️',
    slug: '#filter-patrimoine',
    test: (a) => a.category === 'patrimoine' || a.category === 'audit',
  },
];

/* ── Helpers ── */

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeText(s: string): string {
  return stripAccents(s).toLowerCase();
}

/* ── Styles ── */

const HUB_STYLES = `
  .hub-search-input {
    width: 100%;
    background: #0f1729;
    border: 1px solid #1e293b;
    color: #f1f5f9;
    font-size: 1rem;
    padding: 0.85rem 1rem 0.85rem 2.75rem;
    border-radius: 0.625rem;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .hub-search-input:focus {
    border-color: #D4A84F;
    box-shadow: 0 0 0 3px rgba(212, 168, 79, 0.15);
  }
  .hub-search-input::placeholder {
    color: #475569;
  }
  .hub-filter-btn {
    background: transparent;
    border: 1px solid #1e293b;
    color: #94a3b8;
    font-size: 0.85rem;
    padding: 0.45rem 1rem;
    border-radius: 2rem;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;
    font-family: inherit;
  }
  .hub-filter-btn:hover {
    border-color: #334155;
    color: #e2e8f0;
  }
  .hub-filter-btn.active {
    background: rgba(212, 168, 79, 0.12);
    border-color: #D4A84F;
    color: #D4A84F;
  }
  .hub-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.25rem;
  }
  @media (max-width: 1024px) {
    .hub-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 640px) {
    .hub-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 768px) {
    .hub-filters-scroll {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      padding-bottom: 0.5rem;
    }
    .hub-filters-scroll::-webkit-scrollbar { display: none; }
    .hub-search-input { padding-left: 2.5rem; }
  }
`;

export default function ArticlesHub() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [showAllArticles, setShowAllArticles] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  /* ── Filtered & searched articles ── */

  const filteredArticles = useMemo(() => {
    const f = FILTERS.find((fl) => fl.id === activeFilter);
    const filtered = f ? articles.filter(f.test) : articles;

    if (!searchQuery.trim()) return filtered;

    const q = normalizeText(searchQuery);
    return filtered.filter((a) => {
      const fields = [
        a.title,
        a.metaTitle,
        a.metaDescription,
        a.badge,
        a.category,
        a.intro,
        ...(a.tags || []),
      ];
      return fields.some((f) => f && normalizeText(f).includes(q));
    });
  }, [activeFilter, searchQuery]);

  /* ── Quick-access counts ── */

  const quickCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const qt of QUICK_THEMES) {
      counts[qt.id] = articles.filter(qt.test).length;
    }
    return counts;
  }, []);

  /* ── Stats ── */

  const totalArticles = articles.length;
  const themesCount = FILTERS.length - 1;

  /* ── Apply filter from quick access ── */

  const applyQuickFilter = (themeId: string) => {
    const mapped: Record<string, string> = {
      scpi: 'scpi',
      fiscalite: 'fiscalite',
      immobilier: 'immobilier',
      retraite: 'retraite',
      transmission: 'transmission',
      methode: 'patrimoine',
    };
    setActiveFilter(mapped[themeId] || 'all');
    setSearchQuery('');
    setShowAllArticles(true);
    searchRef.current?.focus();
  };

  /* ── Search icon ── */

  const hasResults = filteredArticles.length > 0;

  return (
    <section style={{ background: '#0B1220', padding: '3rem 0 4rem' }}>
      <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '0 1rem' }}>
        <style>{HUB_STYLES}</style>

        {/* ──────── SEARCH ──────── */}

        <div
          style={{
            maxWidth: '42rem',
            margin: '0 auto 2.5rem',
            position: 'relative',
          }}
        >
          {/* Search icon */}
          <span
            style={{
              position: 'absolute',
              left: '0.9rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#64748b',
              fontSize: '1.1rem',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            &#x1F50D;
          </span>
          <label htmlFor="hub-search" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
            Rechercher un article
          </label>
          <input
            id="hub-search"
            ref={searchRef}
            type="text"
            className="hub-search-input"
            placeholder="Rechercher un article : SCPI, fiscalité, assurance-vie, PER, SCI, LMNP, transmission..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowAllArticles(true);
            }}
            aria-label="Rechercher un article patrimonial"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setShowAllArticles(false); }}
              style={{
                position: 'absolute',
                right: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: '#1e293b',
                border: 'none',
                color: '#94a3b8',
                width: '1.6rem',
                height: '1.6rem',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}
              aria-label="Effacer la recherche"
            >
              &times;
            </button>
          )}
        </div>

        {/* ──────── FILTERS ──────── */}

        <div
          className="hub-filters-scroll"
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.5rem',
            marginBottom: '2rem',
            flexWrap: 'wrap' as const,
          }}
          role="group"
          aria-label="Filtrer par thématique"
        >
          {FILTERS.map((fl) => (
            <button
              key={fl.id}
              className={`hub-filter-btn ${activeFilter === fl.id ? 'active' : ''}`}
              onClick={() => { setActiveFilter(fl.id); setShowAllArticles(true); }}
              aria-pressed={activeFilter === fl.id}
            >
              {fl.label}
            </button>
          ))}
        </div>

        {/* ──────── STATS BANNER ──────── */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '1rem',
            marginBottom: '3rem',
          }}
        >
          {[
            { value: totalArticles, label: 'Articles patrimoniaux', sub: 'analyses pédagogiques' },
            { value: `${themesCount}`, label: 'Grandes thématiques', sub: 'SCPI, fiscalité, immobilier…' },
            { value: '✅', label: 'FAQ, tableaux & exemples', sub: 'pédagogie patrimoniale' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: '#111827',
                border: '1px solid #1e293b',
                borderRadius: '0.75rem',
                padding: '1.25rem',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '1.75rem',
                  fontWeight: 800,
                  color: '#D4A84F',
                  lineHeight: 1.1,
                  marginBottom: '0.35rem',
                }}
              >
                {stat.value}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600, marginBottom: '0.15rem' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {stat.sub}
              </div>
            </div>
          ))}
        </div>

        {/* ──────── QUICK ACCESS ──────── */}

        {!searchQuery && activeFilter === 'all' && !showAllArticles && (
          <div style={{ marginBottom: '3rem' }}>
            <h2
              style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: '#f1f5f9',
                marginBottom: '1rem',
              }}
            >
              Accès rapide par thématique
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '0.85rem',
              }}
            >
              {QUICK_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => applyQuickFilter(theme.id)}
                  style={{
                    background: '#111827',
                    border: '1px solid #1e293b',
                    borderRadius: '0.625rem',
                    padding: '1rem 1.25rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'border-color 0.2s, transform 0.15s',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#D4A84F';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#1e293b';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ fontSize: '1.25rem', marginBottom: '0.35rem' }}>{theme.icon}</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '0.2rem' }}>
                    {theme.label}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {quickCounts[theme.id]} article{(quickCounts[theme.id] || 0) > 1 ? 's' : ''}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ──────── INTRO TEXT (SEO) ──────── */}

        {!showAllArticles && !searchQuery && (
          <p
            style={{
              fontSize: '0.9rem',
              color: '#64748b',
              lineHeight: 1.7,
              marginBottom: '2rem',
              maxWidth: '48rem',
            }}
          >
            Retrouvez des analyses pédagogiques pour mieux comprendre les SCPI, l'assurance-vie, le PER, la fiscalité
            patrimoniale, l'immobilier, la retraite et la transmission. Ces contenus sont informatifs et ne remplacent
            pas une analyse personnalisée de votre situation.
          </p>
        )}

        {/* ──────── RESULTS HEADER ──────── */}

        {(searchQuery || activeFilter !== 'all' || showAllArticles) && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.25rem',
            }}
          >
            <p style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
              {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''}
              {searchQuery ? ` pour "${searchQuery}"` : ''}
            </p>
            <button
              onClick={() => { setActiveFilter('all'); setSearchQuery(''); setShowAllArticles(false); }}
              style={{
                background: 'transparent',
                border: '1px solid #1e293b',
                color: '#94a3b8',
                fontSize: '0.8rem',
                padding: '0.35rem 0.85rem',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Réinitialiser
            </button>
          </div>
        )}

        {/* ──────── ARTICLE GRID ──────── */}

        {hasResults ? (
          <div className="hub-grid">
            {filteredArticles.map((article) => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem 1rem',
              color: '#64748b',
            }}
          >
            <p style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
              Aucun article trouvé
            </p>
            <p style={{ fontSize: '0.85rem' }}>
              Essayez un autre mot-clé ou réinitialisez les filtres.
            </p>
          </div>
        )}

        {/* ──────── DISCLAIMER ──────── */}

        <div
          style={{
            textAlign: 'center',
            padding: '2rem 0 0',
            marginTop: '3rem',
            color: '#475569',
            fontSize: '0.8rem',
            borderTop: '1px solid #1e293b',
          }}
        >
          {totalArticles} articles pédagogiques — Eric Bellaiche, CGP-CIF inscrit ORIAS n°13001580
        </div>
      </div>
    </section>
  );
}
