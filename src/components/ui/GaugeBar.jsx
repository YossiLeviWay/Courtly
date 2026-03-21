export default function GaugeBar({ label, value, type = 'motivation', showValue = true }) {
  const color = {
    motivation: 'gauge-motivation',
    momentum: 'gauge-momentum',
    chemistry: 'gauge-chemistry',
    fan: 'gauge-fan',
    fatigue: 'gauge-fatigue',
  }[type] || 'gauge-motivation';

  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="gauge-row">
      <span className="gauge-label">{label}</span>
      <div className="gauge-track">
        <div className={`gauge-fill ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {showValue && <span className="gauge-value">{Math.round(pct)}</span>}
    </div>
  );
}
