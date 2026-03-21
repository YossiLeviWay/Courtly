import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext.jsx';
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

function PlayerCard({ player, onClick }) {
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
    </div>
  );
}

// ── Squad summary card ─────────────────────────────────────────

function SquadSummary({ players }) {
  const total = players.length;
  const avgRating = total > 0 ? Math.round(players.reduce((s, p) => s + (p.overallRating || 0), 0) / total) : 0;
  const avgFatigue = total > 0 ? Math.round(players.reduce((s, p) => s + (p.fatigue || 0), 0) / total) : 0;
  const injuredCount = players.filter(p => p.injuryStatus !== 'healthy').length;

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

  return (
    <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
      <div className="card-header">
        <span className="card-title">Leadership</span>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Click a player card to set roles</span>
      </div>
      <div className="grid-2">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
          <span style={{ fontSize: '1.25rem' }}>👑</span>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Captain</div>
            <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: captain ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {captain ? captain.name : 'Not assigned'}
            </div>
            {captain && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{captain.position} · OVR {captain.overallRating}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
          <span style={{ fontSize: '1.25rem' }}>🥈</span>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Vice Captain</div>
            <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: vc ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {vc ? vc.name : 'Not assigned'}
            </div>
            {vc && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{vc.position} · OVR {vc.overallRating}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Squad page ────────────────────────────────────────────

export default function Squad() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  const { userTeam } = state;

  const [filterPosition, setFilterPosition] = useState('ALL');
  const [sortBy, setSortBy] = useState('rating');

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
            />
          ))}
        </div>
      )}
    </div>
  );
}
