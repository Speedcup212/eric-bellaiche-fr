export default function TakeawayBlock({ text }: { text: string }) {
  return (
    <div style={{ background: '#f0fdf4', borderLeft: '4px solid #16a34a', borderRadius: '0 0.75rem 0.75rem 0', padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
      <div style={{ fontWeight: 700, color: '#166534', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.4rem' }}>
        À retenir
      </div>
      <p style={{ color: '#166534', fontSize: '0.9375rem', margin: 0 }}>
        {text}
      </p>
    </div>
  );
}
