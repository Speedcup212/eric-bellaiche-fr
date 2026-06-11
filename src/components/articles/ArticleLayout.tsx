import { ArticleContent, ArticleTable } from '../../content/articles/articleTypes';
import { ArticleSection } from '../../content/articles/articleTypes';
import ArticleTOC from './ArticleTOC';
import ArticleSummary from './ArticleSummary';
import FAQBlock from './FAQBlock';
import RiskBlock from './RiskBlock';
import TakeawayBlock from './TakeawayBlock';
import ComparisonTable from './ComparisonTable';
import MethodBlock from './MethodBlock';
import ArticleCTA from './ArticleCTA';
import JsonLdArticle from './JsonLdArticle';

const sectionStyle = {
  section: { padding: '3.5rem 0' } as React.CSSProperties,
  sectionAlt: { padding: '3.5rem 0', background: '#fff' } as React.CSSProperties,
  container: { maxWidth: '80rem', margin: '0 auto', padding: '0 1rem' } as React.CSSProperties,
  h2: { fontSize: '1.5rem', fontWeight: 700, color: '#0F2B46', marginBottom: '1.5rem', lineHeight: 1.3 } as React.CSSProperties,
  h3: { fontSize: '1.125rem', fontWeight: 600, color: '#0F2B46', marginBottom: '0.75rem', marginTop: '1.5rem' } as React.CSSProperties,
  p: { fontSize: '1rem', color: '#475569', lineHeight: 1.7, marginBottom: '0.75rem' } as React.CSSProperties,
  list: { fontSize: '1rem', color: '#475569', lineHeight: 1.7, paddingLeft: '1.25rem' } as React.CSSProperties,
  listItem: { marginBottom: '0.4rem', color: '#475569', fontSize: '0.9375rem' } as React.CSSProperties,
};

function renderSection(s: ArticleSection, index: number) {
  const isAlt = index % 2 === 1;
  const Element = s.level === 'h3' ? 'h3' : 'h2';
  const headingStyle = s.level === 'h3' ? sectionStyle.h3 : sectionStyle.h2;

  return (
    <section key={s.id} id={s.id} style={isAlt ? sectionStyle.sectionAlt : sectionStyle.section}>
      <div style={sectionStyle.container}>
        <Element style={headingStyle}>{s.title}</Element>

        {s.content.map((text, i) => (
          <p key={i} style={sectionStyle.p}>{text}</p>
        ))}

        {s.type === 'table' && s.table && (
          <ComparisonTable table={s.table as ArticleTable} />
        )}

        {s.type === 'list' && s.listItems && (
          <ul style={sectionStyle.list}>
            {s.listItems.map((item, i) => (
              <li key={i} style={sectionStyle.listItem}>{item}</li>
            ))}
          </ul>
        )}

        {s.type === 'risk' && s.listItems && (
          <RiskBlock items={s.listItems} />
        )}

        {s.type === 'method-steps' && s.methodSteps && (
          <MethodBlock steps={s.methodSteps} />
        )}

        {s.type === 'takeaway' && s.content.length > 0 && (
          <TakeawayBlock text={s.content[0]} />
        )}
      </div>
    </section>
  );
}

export default function ArticleLayout({ article }: { article: ArticleContent }) {
  return (
    <>
      <JsonLdArticle article={article} faq={article.faq} />

      {/* Hero */}
      <header style={{
        background: 'linear-gradient(135deg, #0F2B46 0%, #1a3f64 100%)',
        color: '#fff',
        padding: '5rem 0 4rem',
      }}>
        <div style={sectionStyle.container}>
          <span style={{
            display: 'inline-block',
            background: 'rgba(197, 160, 89, 0.18)',
            color: '#C5A059',
            fontSize: '0.8rem',
            fontWeight: 600,
            padding: '0.4rem 1rem',
            borderRadius: '9999px',
            marginBottom: '1.5rem',
            letterSpacing: '0.02em',
          }}>
            {article.badge}
          </span>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 800,
            lineHeight: 1.2,
            marginBottom: '1.25rem',
            color: '#fff',
          }}>
            {article.title}
          </h1>
          <p style={{ fontSize: '1.0625rem', color: '#cbd5e1', maxWidth: '48rem', lineHeight: 1.7 }}>
            {article.intro}
          </p>
        </div>
      </header>

      {/* Quick answer */}
      <section style={{ padding: '2rem 0', background: '#fff' }}>
        <div style={sectionStyle.container}>
          <ArticleSummary article={article} />
        </div>
      </section>

      <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: 0 }} />

      {/* TOC */}
      <section style={{ padding: '2rem 0' }}>
        <div style={sectionStyle.container}>
          <ArticleTOC article={article} />
        </div>
      </section>

      <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: 0 }} />

      {/* Sections */}
      {article.sections.map((s, i) => renderSection(s, i))}

      {/* Resource / external links */}
      {article.externalLinks && article.externalLinks.length > 0 && (
        <>
          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: 0 }} />
          <section style={sectionStyle.sectionAlt}>
            <div style={sectionStyle.container}>
              <h2 style={sectionStyle.h2}>Ressource pédagogique</h2>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', padding: '1.5rem' }}>
                {article.externalLinks
                  .filter((link) => !link.onlyInScpi || article.category === 'scpi')
                  .map((link, i) => (
                    <p key={i} style={{ color: '#166534', fontSize: '0.9375rem', margin: 0 }}>
                      Consultez les ressources de{' '}
                      <a href={link.href} target="_blank" rel="noopener noreferrer" style={{ color: '#166534', fontWeight: 600, textDecoration: 'underline' }}>
                        {link.label}
                      </a>.
                    </p>
                  ))}
              </div>
            </div>
          </section>
        </>
      )}

      {/* FAQ */}
      <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: 0 }} />
      <section style={{ padding: '3.5rem 0' }}>
        <div style={sectionStyle.container}>
          <h2 style={sectionStyle.h2}>Questions fréquentes</h2>
          <FAQBlock items={article.faq} />
        </div>
      </section>

      {/* CTA */}
      <ArticleCTA article={article} />

      {/* Footer */}
      <footer style={{ background: '#0F2B46', color: '#94a3b8', padding: '2rem 0', fontSize: '0.875rem' }}>
        <div style={{ ...sectionStyle.container, textAlign: 'center' }}>
          <p style={{ marginBottom: '0.75rem' }}>
            <a href="/" style={{ color: '#fff', fontWeight: 600, textDecoration: 'none' }}>eric-bellaiche.fr</a>
            <span style={{ margin: '0 0.5rem' }}>&bull;</span>
            <a href="/" style={{ color: '#94a3b8', textDecoration: 'none' }}>Retour au cabinet</a>
            <span style={{ margin: '0 0.5rem' }}>&bull;</span>
            <a href="/articles/" style={{ color: '#94a3b8', textDecoration: 'none' }}>Tous les articles</a>
          </p>
          <p>&copy; 2025 Eric Bellaiche &mdash; CGP-CIF &bull; ORIAS 13001580</p>
        </div>
      </footer>
    </>
  );
}
