import { ArticleTable } from '../../content/articles/articleTypes';

export default function ComparisonTable({ table }: { table: ArticleTable }) {
  if (!table || !table.headers || table.headers.length === 0) return null;

  return (
    <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
      {table.caption && (
        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem', fontStyle: 'italic' }}>
          {table.caption}
        </p>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ background: '#0F2B46', color: '#fff' }}>
            {table.headers.map((h, i) => (
              <th key={i} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? '#f8fafc' : '#fff' }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: '0.65rem 1rem', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
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
