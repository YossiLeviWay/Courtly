import { useState, useMemo } from 'react';
import { X, ChevronUp, ChevronDown } from 'lucide-react';

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

// Core columns shown by default
const CORE_COLS = [
  { key: 'courtVision',           label: 'CV' },
  { key: 'threePtShooting',       label: '3PT' },
  { key: 'finishingAtTheRim',     label: 'FIN' },
  { key: 'perimeterDefense',      label: 'PD' },
  { key: 'interiorDefense',       label: 'ID' },
  { key: 'rebounding',            label: 'REB' },
  { key: 'ballHandlingDribbling', label: 'BH' },
  { key: 'passingAccuracy',       label: 'PASS' },
  { key: 'staminaEndurance',      label: 'STA' },
  { key: 'basketballIQ',          label: 'IQ' },
];

const EXTRA_COLS = [
  { key: 'midRangeScoring',          label: 'MID' },
  { key: 'offBallMovement',          label: 'OBM' },
  { key: 'helpDefense',              label: 'HD' },
  { key: 'clutchPerformance',        label: 'CLU' },
  { key: 'leadershipCommunication',  label: 'LDR' },
  { key: 'postMoves',                label: 'POST' },
  { key: 'agilityLateralSpeed',      label: 'AGI' },
  { key: 'verticalLeapingAbility',   label: 'VER' },
  { key: 'settingScreens',           label: 'SCR' },
  { key: 'freeThrowShooting',        label: 'FT' },
  { key: 'consistencyPerformance',   label: 'CON' },
  { key: 'handlePressureMental',     label: 'MNT' },
];

function cellColor(value, colValues) {
  if (!value) return 'inherit';
  const sorted = [...colValues].sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length / 3)];
  const hi = sorted[Math.floor((sorted.length * 2) / 3)];
  if (value >= hi) return 'rgba(34,197,94,0.15)';
  if (value <= lo) return 'rgba(239,68,68,0.13)';
  return 'rgba(234,179,8,0.12)';
}

export default function SquadCompare({ players, initialPosition, onClose }) {
  const [position, setPosition] = useState(initialPosition || 'PG');
  const [sortKey, setSortKey]   = useState('overallRating');
  const [sortAsc, setSortAsc]   = useState(false);
  const [showAll, setShowAll]   = useState(false);

  const cols = showAll ? [...CORE_COLS, ...EXTRA_COLS] : CORE_COLS;

  const filtered = useMemo(
    () => players.filter(p => p.position === position),
    [players, position],
  );

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = sortKey === 'overallRating'
        ? (a.overallRating ?? 0)
        : (a.attributes?.[sortKey] ?? 0);
      const vb = sortKey === 'overallRating'
        ? (b.overallRating ?? 0)
        : (b.attributes?.[sortKey] ?? 0);
      return sortAsc ? va - vb : vb - va;
    });
  }, [filtered, sortKey, sortAsc]);

  // Per-column value arrays for color-coding
  const colValues = useMemo(() => {
    const map = {};
    cols.forEach(c => {
      map[c.key] = filtered.map(p => p.attributes?.[c.key] ?? 0);
    });
    map.overallRating = filtered.map(p => p.overallRating ?? 0);
    return map;
  }, [filtered, cols]);

  function handleSort(key) {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(false); }
  }

  const SortIcon = ({ colKey }) =>
    sortKey === colKey
      ? (sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />)
      : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-header">
          <h3 className="card-title">Position Comparison</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Position tabs */}
            <div style={{ display: 'flex', gap: 4 }}>
              {POSITIONS.map(pos => (
                <button
                  key={pos}
                  className={`btn btn-sm ${position === pos ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: '0.7rem', padding: '3px 8px' }}
                  onClick={() => setPosition(pos)}
                >
                  {pos}
                </button>
              ))}
            </div>
            <button
              className={`btn btn-sm ${showAll ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '0.7rem' }}
              onClick={() => setShowAll(v => !v)}
            >
              {showAll ? 'Core' : 'All attrs'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        <div className="modal-body" style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
          {sorted.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🏀</div>
              <div className="empty-state-title">No {position}s in your squad</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 1 }}>Player</th>
                  <th
                    style={{ padding: '6px 8px', cursor: 'pointer', textAlign: 'center', fontWeight: sortKey === 'overallRating' ? 900 : 600 }}
                    onClick={() => handleSort('overallRating')}
                  >
                    OVR <SortIcon colKey="overallRating" />
                  </th>
                  {cols.map(c => (
                    <th
                      key={c.key}
                      style={{ padding: '6px 8px', cursor: 'pointer', textAlign: 'center', fontWeight: sortKey === c.key ? 900 : 600 }}
                      onClick={() => handleSort(c.key)}
                      title={c.key}
                    >
                      {c.label} <SortIcon colKey={c.key} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(player => {
                  const form = player.recentForm ?? 0;
                  const formArrow = form > 0 ? '↑' : form < 0 ? '↓' : '→';
                  const formColor = form > 0 ? '#22c55e' : form < 0 ? '#ef4444' : 'var(--text-muted)';
                  return (
                    <tr key={player.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '6px 8px', position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 1, minWidth: 130 }}>
                        <div style={{ fontWeight: 700 }}>{player.name}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>
                          Age {player.age} · {player.nationality}
                          <span style={{ marginLeft: 4, color: formColor, fontWeight: 700 }}>{formArrow}</span>
                        </div>
                      </td>
                      <td style={{
                        padding: '6px 8px', textAlign: 'center', fontWeight: 800,
                        background: cellColor(player.overallRating ?? 0, colValues.overallRating),
                        color: 'var(--color-primary)',
                      }}>
                        {player.overallRating ?? '—'}
                      </td>
                      {cols.map(c => {
                        const val = player.attributes?.[c.key] ?? 0;
                        return (
                          <td
                            key={c.key}
                            style={{
                              padding: '6px 8px', textAlign: 'center',
                              background: cellColor(val, colValues[c.key]),
                              fontWeight: sortKey === c.key ? 800 : 400,
                            }}
                          >
                            {val || '—'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Color legend */}
          <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            <span><span style={{ display: 'inline-block', width: 12, height: 12, background: 'rgba(34,197,94,0.3)', borderRadius: 2, marginRight: 4 }} />Top 33%</span>
            <span><span style={{ display: 'inline-block', width: 12, height: 12, background: 'rgba(234,179,8,0.3)', borderRadius: 2, marginRight: 4 }} />Middle</span>
            <span><span style={{ display: 'inline-block', width: 12, height: 12, background: 'rgba(239,68,68,0.25)', borderRadius: 2, marginRight: 4 }} />Bottom 33%</span>
            <span style={{ marginLeft: 'auto' }}>Click column headers to sort</span>
          </div>
        </div>
      </div>
    </div>
  );
}
