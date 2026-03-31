import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext.jsx';
import { apiFreeAgentRelease } from '../api.js';
import GaugeBar from '../components/ui/GaugeBar.jsx';
import AttrBar from '../components/ui/AttrBar.jsx';
import PlayerAvatar from '../components/ui/PlayerAvatar.jsx';

// ── Nationality flag emoji map ─────────────────────────────────

const NATIONALITY_FLAGS = {
  American: '🇺🇸',
  Canadian: '🇨🇦',
  Brazilian: '🇧🇷',
  Argentinian: '🇦🇷',
  Spanish: '🇪🇸',
  French: '🇫🇷',
  German: '🇩🇪',
  Italian: '🇮🇹',
  Greek: '🇬🇷',
  Turkish: '🇹🇷',
  Serbian: '🇷🇸',
  Croatian: '🇭🇷',
  Slovenian: '🇸🇮',
  Lithuanian: '🇱🇹',
  Latvian: '🇱🇻',
  Australian: '🇦🇺',
  Nigerian: '🇳🇬',
  Senegalese: '🇸🇳',
  Cameroonian: '🇨🇲',
  Congolese: '🇨🇩',
  Angolan: '🇦🇴',
  'South African': '🇿🇦',
  Chinese: '🇨🇳',
  Japanese: '🇯🇵',
  'South Korean': '🇰🇷',
  Filipino: '🇵🇭',
  Lebanese: '🇱🇧',
  Israeli: '🇮🇱',
  Iranian: '🇮🇷',
  Sudanese: '🇸🇩',
  British: '🇬🇧',
  Dutch: '🇳🇱',
  Polish: '🇵🇱',
  Czech: '🇨🇿',
  Montenegrin: '🇲🇪',
  Venezuelan: '🇻🇪',
  Dominican: '🇩🇴',
  'Puerto Rican': '🇵🇷',
  'New Zealander': '🇳🇿',
  Icelandic: '🇮🇸',
};

// ── Comparison stat keys ───────────────────────────────────────

const COMPARE_STATS = [
  { key: 'courtVision', label: 'Court Vision' },
  { key: 'threePtShooting', label: '3PT Shooting' },
  { key: 'finishingAtTheRim', label: 'Finishing' },
  { key: 'perimeterDefense', label: 'Perimeter Def' },
  { key: 'interiorDefense', label: 'Interior Def' },
  { key: 'rebounding', label: 'Rebounding' },
  { key: 'ballHandlingDribbling', label: 'Ball Handling' },
  { key: 'passingAccuracy', label: 'Passing' },
  { key: 'staminaEndurance', label: 'Stamina' },
  { key: 'agilityLateralSpeed', label: 'Agility' },
];

// ── Comparison Modal ───────────────────────────────────────────

function CompareModal({ primaryPlayer, allPlayers, onClose }) {
  const [secondId, setSecondId] = useState('');
  const secondPlayer = allPlayers.find(p => p.id === secondId) || null;

  const candidates = allPlayers.filter(p => p.id !== primaryPlayer.id);

  function StatRow({ stat, p1, p2 }) {
    const v1 = p1?.attributes?.[stat.key] ?? 0;
    const v2 = p2?.attributes?.[stat.key] ?? 0;
    const max = 100;
    const p1Better = v1 >= v2;
    const p2Better = v2 > v1;

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 'var(--space-2)', alignItems: 'center', marginBottom: 8 }}>
        {/* Left bar (primary / orange) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: 'row-reverse' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: p1Better ? 'var(--color-primary)' : 'var(--text-muted)', minWidth: 24, textAlign: 'right' }}>{v1}</span>
          <div style={{ flex: 1, height: 8, background: 'var(--bg-muted)', borderRadius: 'var(--radius-full)', overflow: 'hidden', direction: 'rtl' }}>
            <div style={{ width: `${(v1 / max) * 100}%`, height: '100%', background: p1Better ? 'var(--color-primary)' : 'rgba(249,115,22,0.4)', borderRadius: 'var(--radius-full)', transition: 'width 0.4s ease' }} />
          </div>
        </div>

        {/* Stat label */}
        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap', textAlign: 'center', minWidth: 90 }}>
          {stat.label}
        </span>

        {/* Right bar (secondary / blue) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1, height: 8, background: 'var(--bg-muted)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
            <div style={{ width: `${(v2 / max) * 100}%`, height: '100%', background: p2 ? (p2Better ? '#3b82f6' : 'rgba(59,130,246,0.4)') : 'var(--bg-muted)', borderRadius: 'var(--radius-full)', transition: 'width 0.4s ease' }} />
          </div>
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: p2Better ? '#3b82f6' : 'var(--text-muted)', minWidth: 24 }}>{p2 ? v2 : '—'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h3 className="card-title">Player Comparison</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
          {/* Player headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', alignItems: 'start' }}>
            {/* Primary player */}
            <div style={{ textAlign: 'center', padding: 'var(--space-3)', background: 'rgba(249,115,22,0.08)', borderRadius: 'var(--radius-md)', border: '2px solid var(--color-primary)' }}>
              <div style={{ fontWeight: 800, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', marginBottom: 2 }}>{primaryPlayer.name}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>{primaryPlayer.position}</div>
              <div style={{ fontWeight: 900, fontSize: 'var(--font-size-xl)', color: 'var(--color-primary)', lineHeight: 1 }}>{primaryPlayer.overallRating}</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>OVR</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 'var(--font-size-lg)', color: 'var(--text-muted)' }}>VS</div>

            {/* Second player selector + info */}
            <div style={{ textAlign: 'center', padding: 'var(--space-3)', background: secondPlayer ? 'rgba(59,130,246,0.08)' : 'var(--bg-muted)', borderRadius: 'var(--radius-md)', border: `2px solid ${secondPlayer ? '#3b82f6' : 'var(--border-color)'}` }}>
              {secondPlayer ? (
                <>
                  <div style={{ fontWeight: 800, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', marginBottom: 2 }}>{secondPlayer.name}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>{secondPlayer.position}</div>
                  <div style={{ fontWeight: 900, fontSize: 'var(--font-size-xl)', color: '#3b82f6', lineHeight: 1 }}>{secondPlayer.overallRating}</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>OVR</div>
                </>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', fontWeight: 600, padding: 'var(--space-2) 0' }}>Select a player</div>
              )}
            </div>
          </div>

          {/* Dropdown */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 'var(--space-1)' }}>
              Compare against
            </label>
            <select
              className="form-select"
              value={secondId}
              onChange={e => setSecondId(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">Choose a player...</option>
              {candidates.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.position}) — OVR {p.overallRating}</option>
              ))}
            </select>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--color-primary)' }} />
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-secondary)' }}>{primaryPlayer.name}</span>
            </div>
            {secondPlayer && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-secondary)' }}>{secondPlayer.name}</span>
                <div style={{ width: 12, height: 12, borderRadius: 2, background: '#3b82f6' }} />
              </div>
            )}
          </div>

          {/* Stat bars */}
          {COMPARE_STATS.map(stat => (
            <StatRow key={stat.key} stat={stat} p1={primaryPlayer} p2={secondPlayer} />
          ))}

          {/* OVR diff summary */}
          {secondPlayer && (
            <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              {(() => {
                const diff = primaryPlayer.overallRating - secondPlayer.overallRating;
                const absDiff = Math.abs(diff);
                const color = diff > 0 ? 'var(--color-primary)' : diff < 0 ? '#3b82f6' : 'var(--text-muted)';
                const label = diff > 0
                  ? `${primaryPlayer.name} is ${absDiff} OVR point${absDiff !== 1 ? 's' : ''} better`
                  : diff < 0
                  ? `${secondPlayer.name} is ${absDiff} OVR point${absDiff !== 1 ? 's' : ''} better`
                  : 'Both players have the same overall rating';
                return <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color }}>{label}</span>;
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Attribute group averages ───────────────────────────────────

const ATTRIBUTE_GROUPS = {
  Offense: ['courtVision', 'threePtShooting', 'finishingAtTheRim'],
  Defense: ['perimeterDefense', 'interiorDefense', 'helpDefense'],
  Physical: ['staminaEndurance', 'conditioningFitness', 'agilityLateralSpeed'],
};

function teamAvg(players, keys) {
  if (!players || players.length === 0) return 0;
  let total = 0;
  let count = 0;
  for (const p of players) {
    for (const key of keys) {
      const val = p.attributes?.[key];
      if (val !== undefined) { total += val; count++; }
    }
  }
  return count > 0 ? Math.round(total / count) : 0;
}

// ── Injury badge color ─────────────────────────────────────────

function injuryBadgeClass(status) {
  if (status === 'healthy') return 'badge-green';
  if (status === 'minor') return 'badge-yellow';
  return 'badge-red';
}

// ── Position badge color ───────────────────────────────────────

const POSITION_COLORS = {
  PG: 'badge-blue',
  SG: 'badge-orange',
  SF: 'badge-green',
  PF: 'badge-yellow',
  C: 'badge-red',
};

// ── Player card ────────────────────────────────────────────────

function PlayerCard({ player, onClick, releaseConfirm, onReleaseConfirm, onReleaseClear, onReleasePlayer, onCompare }) {
  const fatiguePct = Math.min(100, Math.max(0, player.fatigue || 0));
  const fatigueColor = fatiguePct > 70 ? 'var(--color-danger)' : fatiguePct > 40 ? 'var(--color-warning)' : 'var(--color-success)';
  const injuryStatus = player.injuryStatus || 'healthy';
  const flag = NATIONALITY_FLAGS[player.nationality] || '🌐';

  return (
    <div className="player-card" onClick={onClick}>
      {/* Header: avatar + name/position */}
      <div className="player-card-header">
        <PlayerAvatar player={player} size="md" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {player.name}
            </span>
            {player.isCaptain && (
              <span className="badge badge-orange" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>C</span>
            )}
            {player.isViceCaptain && (
              <span className="badge badge-yellow" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>VC</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', marginTop: 2 }}>
            <span className={`badge ${POSITION_COLORS[player.position] || 'badge-gray'}`} style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
              {player.position}
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{flag}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 'var(--font-size-lg)', color: 'var(--color-primary)', lineHeight: 1 }}>
            {player.overallRating}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>OVR</div>
        </div>
      </div>

      {/* Fatigue */}
      <div style={{ marginBottom: 'var(--space-2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Fatigue</span>
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: fatigueColor }}>{fatiguePct}</span>
        </div>
        <div style={{ height: 5, background: 'var(--bg-muted)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
          <div style={{ width: `${fatiguePct}%`, height: '100%', background: fatigueColor, borderRadius: 'var(--radius-full)', transition: 'width 0.3s ease' }} />
        </div>
      </div>

      {/* Form + Injury */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Form</span>
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {player.lastFormRating ?? '–'}
          </span>
        </div>
        <span className={`badge ${injuryBadgeClass(injuryStatus)}`} style={{ fontSize: '0.65rem', padding: '1px 6px', textTransform: 'capitalize' }}>
          {injuryStatus}
        </span>
      </div>

      {/* Compare */}
      <button
        className="btn btn-ghost btn-sm"
        style={{ marginTop: 6, fontSize: 11, color: 'var(--color-primary)', opacity: 0.85, width: '100%' }}
        onClick={(e) => { e.stopPropagation(); onCompare(player); }}
      >
        Compare
      </button>

      {/* Release */}
      {releaseConfirm === player.id ? (
        <div style={{ marginTop: 8, padding: '8px', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-sm)' }}>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)', marginBottom: 4 }}>Release {player.name}?</p>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-sm" style={{ fontSize: 11, padding: '2px 8px', background: 'var(--color-danger)', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); onReleasePlayer(player); }}>
              Confirm
            </button>
            <button className="btn btn-sm btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }}
              onClick={(e) => { e.stopPropagation(); onReleaseClear(); }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 6, fontSize: 11, color: 'var(--color-danger)', opacity: 0.7, width: '100%' }}
          onClick={(e) => { e.stopPropagation(); onReleaseConfirm(player.id); }}>
          Release
        </button>
      )}
    </div>
  );
}

// ── Squad summary card ─────────────────────────────────────────

function SquadSummary({ players }) {
  const total = players.length;
  const avgRating = total > 0 ? Math.round(players.reduce((s, p) => s + (p.overallRating || 0), 0) / total) : 0;
  const avgFatigue = total > 0 ? Math.round(players.reduce((s, p) => s + (p.fatigue || 0), 0) / total) : 0;
  const injuredCount = players.filter(p => p.injuryStatus && p.injuryStatus !== 'healthy').length;

  return (
    <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
      <div className="card-header">
        <span className="card-title">Squad Summary</span>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{total} players</span>
      </div>
      <div className="stats-grid" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="stat-card">
          <div className="stat-value">{avgRating}</div>
          <div className="stat-label">Avg Rating</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: avgFatigue > 70 ? 'var(--color-danger)' : 'var(--color-success)' }}>{avgFatigue}</div>
          <div className="stat-label">Avg Fatigue</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: injuredCount > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{injuredCount}</div>
          <div className="stat-label">Injured</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{total - injuredCount}</div>
          <div className="stat-label">Available</div>
        </div>
      </div>

      {/* Attribute group averages */}
      <div className="grid-3">
        {Object.entries(ATTRIBUTE_GROUPS).map(([group, keys]) => {
          const avg = teamAvg(players, keys);
          return (
            <div key={group}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{group}</span>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>{avg}</span>
              </div>
              <AttrBar value={avg} showVal={false} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Captain display ────────────────────────────────────────────

function CaptainDisplay({ players, onSetCaptain, onSetViceCaptain }) {
  const captain = players.find(p => p.isCaptain);
  const vc = players.find(p => p.isViceCaptain);
  const sortedByRating = [...players].sort((a, b) => (b.overallRating || 0) - (a.overallRating || 0));

  const selectStyle = {
    padding: '6px 10px', borderRadius: 'var(--radius-md)',
    border: '1.5px solid var(--border-color)',
    background: 'var(--bg-card)', color: 'var(--text-primary)',
    fontSize: 'var(--font-size-xs)', fontWeight: 600,
    cursor: 'pointer', width: '100%', marginTop: 4,
  };

  return (
    <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
      <div className="card-header">
        <span className="card-title">Leadership</span>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Select captain &amp; vice captain below</span>
      </div>
      <div className="grid-2">
        <div style={{ padding: 'var(--space-3)', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 4 }}>
            <span style={{ fontSize: '1.1rem' }}>👑</span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Captain</span>
          </div>
          {captain && (
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
              {captain.position} · OVR {captain.overallRating}
            </div>
          )}
          <select
            value={captain?.id || ''}
            onChange={e => {
              const p = players.find(pl => pl.id === e.target.value);
              if (p) onSetCaptain(p);
            }}
            style={selectStyle}
          >
            <option value="">— Not assigned —</option>
            {sortedByRating.map(p => (
              <option key={p.id} value={p.id} disabled={p.isViceCaptain}>
                {p.name} ({p.position}, OVR {p.overallRating}){p.isViceCaptain ? ' [VC]' : ''}
              </option>
            ))}
          </select>
        </div>
        <div style={{ padding: 'var(--space-3)', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 4 }}>
            <span style={{ fontSize: '1.1rem' }}>🥈</span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Vice Captain</span>
          </div>
          {vc && (
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
              {vc.position} · OVR {vc.overallRating}
            </div>
          )}
          <select
            value={vc?.id || ''}
            onChange={e => {
              const p = players.find(pl => pl.id === e.target.value);
              if (p) onSetViceCaptain(p);
            }}
            style={selectStyle}
          >
            <option value="">— Not assigned —</option>
            {sortedByRating.map(p => (
              <option key={p.id} value={p.id} disabled={p.isCaptain}>
                {p.name} ({p.position}, OVR {p.overallRating}){p.isCaptain ? ' [C]' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// ── Main Squad page ────────────────────────────────────────────

export default function Squad() {
  const { state, dispatch, addNotification } = useGame();
  const navigate = useNavigate();
  const { userTeam } = state;

  const [filterPosition, setFilterPosition] = useState('ALL');
  const [sortBy, setSortBy] = useState('rating');
  const [releaseConfirm, setReleaseConfirm] = useState(null); // playerId
  const [comparePlayer, setComparePlayer] = useState(null);

  if (!userTeam) {
    return (
      <div className="page-content animate-fade-in">
        <div className="empty-state">
          <div className="empty-state-icon">🏀</div>
          <div className="empty-state-title">No team data found</div>
          <div className="empty-state-desc">Start a new game to manage your squad.</div>
        </div>
      </div>
    );
  }

  const { players = [], motivationBar, momentumBar, chemistryGauge } = userTeam;

  // Filter
  const filtered = players.filter(p => filterPosition === 'ALL' || p.position === filterPosition);

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'rating') return (b.overallRating || 0) - (a.overallRating || 0);
    if (sortBy === 'fatigue') return (b.fatigue || 0) - (a.fatigue || 0);
    if (sortBy === 'form') return (b.lastFormRating || 0) - (a.lastFormRating || 0);
    return 0;
  });

  function handleSetCaptain(player) {
    const updated = players.map(p => ({
      ...p,
      isCaptain: p.id === player.id,
      isViceCaptain: p.isViceCaptain && p.id !== player.id,
    }));
    dispatch({ type: 'UPDATE_TEAM', payload: { ...userTeam, players: updated } });
  }

  function handleSetViceCaptain(player) {
    const updated = players.map(p => ({
      ...p,
      isViceCaptain: p.id === player.id,
      isCaptain: p.isCaptain && p.id !== player.id,
    }));
    dispatch({ type: 'UPDATE_TEAM', payload: { ...userTeam, players: updated } });
  }

  async function handleReleasePlayer(player) {
    const updatedPlayers = (userTeam.players || []).filter(p => p.id !== player.id);
    dispatch({ type: 'UPDATE_TEAM', payload: { ...userTeam, players: updatedPlayers } });
    await apiFreeAgentRelease(player);
    addNotification(`${player.name} released — now available as a free agent.`, 'info');
    setReleaseConfirm(null);
  }

  return (
    <div className="page-content animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <h1>Squad</h1>
        <p>{userTeam.name} · {players.length} players</p>
      </div>

      {/* Team morale gauges */}
      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="card-header">
          <span className="card-title">Team Morale</span>
        </div>
        <GaugeBar label="Motivation" value={motivationBar} type="motivation" />
        <GaugeBar label="Momentum" value={momentumBar} type="momentum" />
        <GaugeBar label="Chemistry" value={chemistryGauge} type="chemistry" />
      </div>

      {/* Squad summary */}
      <SquadSummary players={players} />

      {/* Captain display */}
      <CaptainDisplay
        players={players}
        onSetCaptain={handleSetCaptain}
        onSetViceCaptain={handleSetViceCaptain}
      />

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Position</span>
          {['ALL', 'PG', 'SG', 'SF', 'PF', 'C'].map(pos => (
            <button
              key={pos}
              onClick={() => setFilterPosition(pos)}
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid',
                borderColor: filterPosition === pos ? 'var(--color-primary)' : 'var(--border-color)',
                background: filterPosition === pos ? 'var(--color-primary)' : 'transparent',
                color: filterPosition === pos ? 'white' : 'var(--text-secondary)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              {pos}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginLeft: 'auto' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Sort by</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <option value="rating">Rating</option>
            <option value="fatigue">Fatigue</option>
            <option value="form">Form</option>
          </select>
        </div>
      </div>

      {/* Player grid */}
      {sorted.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏀</div>
          <div className="empty-state-title">No players found</div>
          <div className="empty-state-desc">Try adjusting your filters.</div>
        </div>
      ) : (
        <div className="grid-3" style={{ marginBottom: 'var(--space-6)' }}>
          {sorted.map(player => (
            <PlayerCard
              key={player.id}
              player={player}
              onClick={() => navigate(`/squad/${player.id}`)}
              releaseConfirm={releaseConfirm}
              onReleaseConfirm={(id) => setReleaseConfirm(id)}
              onReleaseClear={() => setReleaseConfirm(null)}
              onReleasePlayer={handleReleasePlayer}
              onCompare={(p) => setComparePlayer(p)}
            />
          ))}
        </div>
      )}

      {/* Comparison Modal */}
      {comparePlayer && (
        <CompareModal
          primaryPlayer={comparePlayer}
          allPlayers={players}
          onClose={() => setComparePlayer(null)}
        />
      )}
    </div>
  );
}
