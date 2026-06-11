import { FAQItem } from '../../content/articles/articleTypes';
import { Icon, ICONS } from './ArticleIcons';

export default function FAQBlock({ items }: { items: FAQItem[] }) {
  if (!items || items.length === 0) return null;

  return (
    <div>
      <h2 style={{
        fontSize: '1.75rem',
        fontWeight: 700,
        color: '#0F2B46',
        lineHeight: 1.25,
        marginBottom: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.45rem',
      }}>
        <span style={{ display: 'inline-flex', color: '#b8944d', lineHeight: 0 }}>
          <Icon icon={ICONS.faq} size={24} />
        </span>
        Questions fréquentes
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {items.map((item, i) => (
          <div key={i} style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '0.75rem',
            padding: '1.25rem 1.5rem',
            transition: 'box-shadow 0.15s',
          }}>
            <p style={{
              fontWeight: 700,
              color: '#0F2B46',
              fontSize: '1rem',
              margin: 0,
              marginBottom: '0.5rem',
              lineHeight: 1.4,
            }}>
              {item.question}
            </p>
            <p style={{
              fontSize: '0.9375rem',
              color: '#475569',
              lineHeight: 1.65,
              margin: 0,
            }}>
              {item.answer}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
