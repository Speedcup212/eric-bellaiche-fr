import { FAQItem } from '../../content/articles/articleTypes';

export default function FAQBlock({ items }: { items: FAQItem[] }) {
  if (!items || items.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {items.map((item, i) => (
        <div key={i} style={{ borderBottom: i < items.length - 1 ? '1px solid #e2e8f0' : 'none', padding: '1rem 0' }}>
          <p style={{ fontWeight: 600, color: '#0F2B46', fontSize: '0.95rem', marginBottom: '0.4rem', margin: 0 }}>
            {item.question}
          </p>
          <p style={{ fontSize: '0.9375rem', color: '#475569', margin: 0, marginTop: '0.4rem' }}>
            {item.answer}
          </p>
        </div>
      ))}
    </div>
  );
}
