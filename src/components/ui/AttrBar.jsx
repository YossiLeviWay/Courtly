export default function AttrBar({ value, max = 100, showVal = true }) {
  const pct = (value / max) * 100;
  const color = pct >= 70 ? 'var(--color-success)' : pct >= 40 ? 'var(--color-primary)' : 'var(--color-danger)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: 6, background: 'var(--bg-muted)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 'var(--radius-full)', transition: 'width 0.4s ease' }} />
      </div>
      {showVal && <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-secondary)', minWidth: 24, textAlign: 'right' }}>{value}</span>}
    </div>
  );
}
