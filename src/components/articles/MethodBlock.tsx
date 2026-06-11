import { Icon, getSectionIcon } from './ArticleIcons';

export default function MethodBlock({ steps }: { steps: { title: string; description: string }[] }) {
  if (!steps || steps.length === 0) return null;

  const icon = getSectionIcon('method-steps', 'méthode');

  return (
    <div style={{ marginTop: '0.5rem' }}>
      {steps.map((step, i) => (
        <div key={i} style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'flex-start',
          padding: '1.25rem 0',
          borderBottom: i < steps.length - 1 ? '1px solid #e2e8f0' : 'none',
        }}>
          <div style={{
            flexShrink: 0,
            width: '2.5rem',
            height: '2.5rem',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #0F2B46 0%, #1a3f64 100%)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.9375rem',
            fontWeight: 700,
            boxShadow: '0 2px 4px rgba(15, 43, 70, 0.15)',
          }}>
            {i + 1}
          </div>
          <div style={{ flex: 1, paddingTop: '0.2rem' }}>
            <strong style={{
              color: '#0F2B46',
              display: 'block',
              fontSize: '1.0625rem',
              fontWeight: 700,
              marginBottom: '0.3rem',
            }}>
              {step.title}
            </strong>
            <p style={{
              margin: 0,
              fontSize: '0.9375rem',
              color: '#475569',
              lineHeight: 1.65,
            }}>
              {step.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
