export default function RiskBlock({ items, title = 'Information importante' }: { items: string[]; title?: string }) {
  if (!items || items.length === 0) return null;

  return (
    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.75rem', padding: '1.5rem' }}>
      <h3 style={{ color: '#92400e', marginBottom: '0.75rem', marginTop: 0, fontSize: '1.125rem', fontWeight: 600 }}>
        {title}
      </h3>
      <ul style={{ listStyle: 'disc', paddingLeft: '1.25rem', margin: 0 }}>
        {items.map((item, i) => (
          <li key={i} style={{ color: '#78350f', fontSize: '0.9375rem', marginBottom: '0.4rem' }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
