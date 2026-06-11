import { Icon, getSectionIcon } from './ArticleIcons';

export default function TakeawayBlock({ text }: { text: string }) {
  if (!text) return null;

  const icon = getSectionIcon('takeaway', 'À retenir');

  return (
    <div style={{
      background: '#f0fdf4',
      borderLeft: '4px solid #16a34a',
      borderRadius: '0 0.75rem 0.75rem 0',
      padding: '1.25rem 1.75rem',
      marginTop: '1rem',
    }}>
      <span style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontWeight: 700,
        color: '#166534',
        fontSize: '0.8125rem',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        marginBottom: '0.4rem',
      }}>
        {icon && <Icon icon={icon} size={16} color="#16a34a" />}
        À retenir
      </span>
      <p style={{ color: '#166534', fontSize: '1rem', lineHeight: 1.65, margin: 0 }}>
        {text}
      </p>
    </div>
  );
}
