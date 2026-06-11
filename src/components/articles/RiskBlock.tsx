import { Icon, getSectionIcon } from './ArticleIcons';

export default function RiskBlock({ items, title = 'Points de vigilance' }: { items: string[]; title?: string }) {
  if (!items || items.length === 0) return null;

  const icon = getSectionIcon('risk', title);

  return (
    <div style={{
      background: '#fffbeb',
      border: '1px solid #fde68a',
      borderRadius: '0.75rem',
      padding: '1.5rem 1.75rem',
    }}>
      <span style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontWeight: 700,
        color: '#92400e',
        fontSize: '0.8125rem',
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        marginBottom: '0.75rem',
      }}>
        {icon && <Icon icon={icon} size={18} color="#d97706" />}
        {title}
      </span>
      <ul style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
      }}>
        {items.map((item, i) => (
          <li key={i} style={{
            color: '#78350f',
            fontSize: '0.9375rem',
            lineHeight: 1.65,
            marginBottom: '0.5rem',
            paddingLeft: '1.25rem',
            position: 'relative',
          }}>
            <span style={{
              position: 'absolute',
              left: 0,
              top: '0.35rem',
              width: '0.5rem',
              height: '0.5rem',
              borderRadius: '50%',
              background: '#f59e0b',
              display: 'inline-block',
            }} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
