export default function MethodBlock({ steps }: { steps: { title: string; description: string }[] }) {
  if (!steps || steps.length === 0) return null;

  return (
    <ol style={{ listStyle: 'none', counterReset: 'step', padding: 0, margin: 0 }}>
      {steps.map((step, i) => (
        <li key={i} style={{ counterIncrement: 'step', display: 'flex', gap: '1rem', alignItems: 'flex-start', padding: '1rem 0', borderBottom: i < steps.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
          <span style={{
            flexShrink: 0,
            width: '2.25rem',
            height: '2.25rem',
            borderRadius: '9999px',
            background: '#0F2B46',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.875rem',
            fontWeight: 700,
          }}>
            {i + 1}
          </span>
          <div style={{ flex: 1 }}>
            <strong style={{ color: '#0F2B46', display: 'block', fontSize: '1rem', marginBottom: '0.2rem' }}>
              {step.title}
            </strong>
            <p style={{ margin: 0, fontSize: '0.9375rem', color: '#475569' }}>
              {step.description}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
