import React from 'react';
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
import { Icon, getSectionIcon, HeroCategoryIcon } from './ArticleIcons';

/* ── Layout constants ── */
const CONTENT_W = 1040;       /* largeur max globale */
const PARAGRAPH_W = 860;      /* largeur max texte */
const TABLE_W = 1040;         /* largeur max tableaux */

const sectionStyle = {
  container: {
    maxWidth: `${CONTENT_W}px`,
    margin: '0 auto',
    padding: '0 1.5rem',
  } as React.CSSProperties,
  p: {
    fontSize: '1.0625rem',
    color: '#334155',
    lineHeight: 1.75,
    marginBottom: '1rem',
    maxWidth: `${PARAGRAPH_W}px`,
  } as React.CSSProperties,
  list: {
    fontSize: '1.0625rem',
    color: '#334155',
    lineHeight: 1.75,
    paddingLeft: '1.5rem',
    maxWidth: `${PARAGRAPH_W}px`,
  } as React.CSSProperties,
  listItem: {
    marginBottom: '0.5rem',
    color: '#334155',
    fontSize: '1rem',
  } as React.CSSProperties,
};

/* ── Badge helper: split &bull; into proper dots ── */
function renderBadge(badge: string) {
  const parts = badge.split('&bull;');
  if (parts.length <= 1) return badge;
  return parts.map((part, i) => (
    <React.Fragment key={i}>
      {i > 0 && <span style={{ margin: '0 0.35rem', color: '#C5A059' }}>•</span>}
      {part.trim()}
    </React.Fragment>
  ));
}

/* ── Section renderer ── */
function renderSection(s: ArticleSection, index: number) {
  const iconComp = getSectionIcon(s.type, s.title);
  const Element = s.level === 'h3' ? 'h3' : 'h2';

  const isAlt = index % 2 === 1;

  return (
    <section
      key={s.id}
      id={s.id}
      style={{
        padding: '2rem 0',
        background: isAlt ? '#fff' : 'transparent',
      }}
    >
      <div style={sectionStyle.container}>
        {s.level === 'h3' ? (
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            color: '#0F2B46',
            marginBottom: '0.75rem',
            marginTop: '0.5rem',
            maxWidth: `${PARAGRAPH_W}px`,
          }}>
            {s.title}
          </h3>
        ) : (
          <h2 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            color: '#0F2B46',
            lineHeight: 1.25,
            marginBottom: '1.25rem',
            paddingTop: '0.15rem',
            maxWidth: `${PARAGRAPH_W}px`,
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
          }}>
            {iconComp && (
              <span style={{ display: 'inline-flex', flexShrink: 0, color: '#b8944d', lineHeight: 0 }}>
                <Icon icon={iconComp} size={22} />
              </span>
            )}
            <span>{s.title}</span>
          </h2>
        )}

        {s.content.map((text, i) => (
          <p key={i} style={sectionStyle.p}>{text}</p>
        ))}

        {s.type === 'table' && s.table && (
          <div style={{ marginTop: '0.75rem', maxWidth: `${TABLE_W}px` }}>
            <ComparisonTable table={s.table as ArticleTable} />
          </div>
        )}

        {s.type === 'list' && s.listItems && (
          <ul style={sectionStyle.list}>
            {s.listItems.map((item, i) => (
              <li key={i} style={sectionStyle.listItem}>{item}</li>
            ))}
          </ul>
        )}

        {s.type === 'risk' && s.listItems && (
          <div style={{ marginTop: '0.75rem', maxWidth: `${PARAGRAPH_W}px` }}>
            <RiskBlock items={s.listItems} />
          </div>
        )}

        {s.type === 'method-steps' && s.methodSteps && (
          <div style={{ maxWidth: `${PARAGRAPH_W}px` }}>
            <MethodBlock steps={s.methodSteps} />
          </div>
        )}

        {s.type === 'takeaway' && s.content.length > 0 && (
          <TakeawayBlock text={s.content[0]} />
        )}
      </div>
    </section>
  );
}

/* ── Main component ── */
export default function ArticleLayout({ article }: { article: ArticleContent }) {
  return (
    <>
      <JsonLdArticle article={article} faq={article.faq} />

      {/* ── Hero ── */}
      <header style={{
        background: 'linear-gradient(135deg, #0F2B46 0%, #1a3f64 100%)',
        color: '#fff',
        padding: '3.5rem 0 2.5rem',
      }}>
        <div style={sectionStyle.container}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(197, 160, 89, 0.18)',
            color: '#C5A059',
            fontSize: '0.8125rem',
            fontWeight: 600,
            padding: '0.3rem 0.9rem',
            borderRadius: '9999px',
            marginBottom: '1rem',
            letterSpacing: '0.03em',
            width: 'fit-content',
          }}>
            <HeroCategoryIcon category={article.category} />
            <span>{renderBadge(article.badge)}</span>
          </span>
          <h1 style={{
            fontSize: '2.25rem',
            fontWeight: 800,
            lineHeight: 1.15,
            marginBottom: '0.75rem',
            color: '#fff',
            maxWidth: `${PARAGRAPH_W}px`,
          }}>
            {article.title}
          </h1>
          <p style={{
            fontSize: '1.0625rem',
            color: '#cbd5e1',
            maxWidth: `${PARAGRAPH_W}px`,
            lineHeight: 1.7,
          }}>
            {article.intro}
          </p>
        </div>
      </header>

      {/* ── Quick answer ── */}
      <section style={{ padding: '1.5rem 0', background: '#fff' }}>
        <div style={sectionStyle.container}>
          <ArticleSummary article={article} />
        </div>
      </section>

      <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: 0 }} />

      {/* ── TOC ── */}
      <section style={{ padding: '1.5rem 0' }}>
        <div style={sectionStyle.container}>
          <ArticleTOC article={article} />
        </div>
      </section>

      <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: 0 }} />

      {/* ── Sections ── */}
      {article.sections.map((s, i) => renderSection(s, i))}

      {/* ── Resource / external links ── */}
      {article.externalLinks && article.externalLinks.length > 0 && (
        <>
          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: 0 }} />
          <section style={{ padding: '2rem 0', background: '#fff' }}>
            <div style={sectionStyle.container}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#0F2B46',
                lineHeight: 1.25,
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}>
                <span style={{ color: '#16a34a', display: 'inline-flex', lineHeight: 0 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1v12c-.6-.5-1.2-1-2.5-1-2.5 0-2.5 2-5 2-2.6 0-2.4-2-5-2-2.5 0-2.5 2-5 2-1.3 0-1.9-.5-2.5-1z" />
                  </svg>
                </span>
                <span>Ressource pédagogique</span>
              </h2>
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '0.75rem',
                padding: '1.25rem 1.5rem',
                maxWidth: `${PARAGRAPH_W}px`,
              }}>
                {article.externalLinks
                  .filter((link) => !link.onlyInScpi || article.category === 'scpi')
                  .map((link, i) => (
                    <p key={i} style={{ color: '#166534', fontSize: '0.9375rem', margin: 0 }}>
                      Pour approfondir la compréhension des SCPI, vous pouvez consulter{' '}
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

      {/* ── FAQ ── */}
      <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: 0 }} />
      <section style={{ padding: '2.5rem 0' }}>
        <div style={sectionStyle.container}>
          <FAQBlock items={article.faq} />
        </div>
      </section>

      {/* ── CTA ── */}
      <ArticleCTA article={article} />

      {/* ── Footer ── */}
      <footer style={{
        background: '#0F2B46',
        color: '#94a3b8',
        padding: '2rem 0',
        fontSize: '0.875rem',
      }}>
        <div style={{ ...sectionStyle.container, textAlign: 'center' }}>
          <p style={{ marginBottom: '0.75rem' }}>
            <a href="/" style={{ color: '#fff', fontWeight: 600, textDecoration: 'none' }}>
              eric-bellaiche.fr
            </a>
            <span style={{ margin: '0 0.5rem' }}>&bull;</span>
            <a href="/" style={{ color: '#94a3b8', textDecoration: 'none' }}>
              Retour au cabinet
            </a>
            <span style={{ margin: '0 0.5rem' }}>&bull;</span>
            <a href="/articles/" style={{ color: '#94a3b8', textDecoration: 'none' }}>
              Tous les articles
            </a>
          </p>
          <p>&copy; 2025 Eric Bellaiche &mdash; CGP-CIF &bull; ORIAS 13001580</p>
        </div>
      </footer>
    </>
  );
}
