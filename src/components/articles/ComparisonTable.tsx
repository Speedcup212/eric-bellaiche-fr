import { ArticleTable } from '../../content/articles/articleTypes';

export default function ComparisonTable({ table }: { table: ArticleTable }) {
  if (!table || !table.headers || table.headers.length === 0) return null;

  const cellPad: React.CSSProperties = {
    padding: '0.875rem 1.125rem',
    borderBottom: '1px solid #e2e8f0',
    color: '#334155',
    fontSize: '0.9375rem',
    lineHeight: 1.55,
    verticalAlign: 'top',
  };

  return (
    <div style={{ overflowX: 'auto', marginBottom: '1.5rem', WebkitOverflowScrolling: 'touch' }}>
      {table.caption && (
        <p style={{
          fontSize: '0.875rem',
          color: '#64748b',
          marginBottom: '0.75rem',
          fontStyle: 'italic',
          lineHeight: 1.5,
        }}>
          {table.caption}
        </p>
      )}
      <table style={{
        width: '100%',
        minWidth: '720px',
        borderCollapse: 'separate',
        borderSpacing: 0,
        borderRadius: '0.5rem',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <thead>
          <tr style={{ background: '#0F2B46', color: '#fff' }}>
            {table.headers.map((h, i) => (
              <th key={i} style={{
                padding: '0.875rem 1.125rem',
                textAlign: 'left',
                fontWeight: 600,
                fontSize: '0.8125rem',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                lineHeight: 1.35,
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri} style={{
              background: ri % 2 === 0 ? '#fafafa' : '#fff',
            }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{
                  ...cellPad,
                  fontWeight: ci === 0 ? 600 : 400,
                  color: ci === 0 ? '#0F2B46' : '#334155',
                }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
