import { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext.jsx';
import { Users, Target, Shield, Zap, Settings, CheckCircle } from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────

const PLAYING_STYLES = [
  {
    id: 'Pace & Space',
    label: 'Pace & Space',
    subtitle: 'High Tempo',
    description: 'Maximizes possessions, 3-pointers, fast breaks',
    icon: '⚡',
  },
  {
    id: 'Half-Court Sets',
    label: 'Half-Court Sets',
    subtitle: 'Low Tempo',
    description: 'Methodical, structured plays, high-percentage shots',
    icon: '🎯',
  },
  {
    id: 'Pick-and-Roll Focus',
    label: 'Pick-and-Roll Focus',
    subtitle: 'Two-Man Action',
    description: 'Heavy reliance on two-man action',
    icon: '🔄',
  },
  {
    id: 'Post-Up Oriented',
    label: 'Post-Up Oriented',
    subtitle: 'Low Post Offense',
    description: 'Offense through big men in the low post',
    icon: '💪',
  },
];

const DEFENSE_TYPES = [
  'Man-to-Man',
  'Zone (2-3)',
  'Zone (3-2)',
  'Zone (Box-and-One)',
  'Press (Full)',
  'Press (Three-quarter)',
];

const PRESS_FREQUENCIES = ['High', 'Medium', 'Low'];

const TIMEOUT_TRIGGERS = [
  'Opponent scores 6+ straight',
  'End of close quarter',
  'After opponent lead change',
  'Poor shooting stretch',
  'Player in foul trouble',
];

const INJURY_MANAGEMENT_OPTIONS = [
  'Conservative — prioritize player health, rest early',
  'Balanced — standard rotation, monitor closely',
  'Aggressive — push players unless severely injured',
  'Star-focused — protect key players, use depth elsewhere',
];

const DEFAULT_TACTICS = {
  playingStyle: 'Half-Court Sets',
  defenseType: 'Man-to-Man',
  pressFrequency: 'Medium',
  subStrategy: 'Flow Rotation',
  selectedPlayers: [],
  startingFive: [],
  timeoutTriggers: [],
  injuryManagement: 'Balanced — standard rotation, monitor closely',
};

// ── Helpers ───────────────────────────────────────────────────

function getInjuryBadge(player) {
  if (!player) return null;
  const status = player.injuryStatus;
  if (!status || status === 'healthy') return null;
  return (
    <span className="badge badge-red" style={{ marginLeft: 6 }}>
      {status}
    </span>
  );
}

function getFatigueBadge(player) {
  if (!player) return null;
  const fatigue = player.fatigue ?? 0;
  if (fatigue >= 70) return <span className="badge badge-yellow" style={{ marginLeft: 4 }}>Tired ({fatigue})</span>;
  if (fatigue >= 40) return <span className="badge badge-gray" style={{ marginLeft: 4 }}>Moderate ({fatigue})</span>;
  return null;
}

function getTacticalScore(coach, styleIndex) {
  if (!coach) return 55 + styleIndex * 5;
  const ability = coach.primaryAbility ?? coach.ability ?? 60;
  const base = 40 + Math.round((ability / 100) * 45);
  const variation = [-5, 0, 3, -3][styleIndex % 4];
  return Math.min(95, Math.max(40, base + variation));
}

// ── Sub-components ────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-4)',
        paddingBottom: 'var(--space-3)',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: 'var(--radius-full)',
          background: 'var(--color-primary-100)',
          color: 'var(--color-primary)',
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div>
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, margin: 0 }}>{title}</h2>
        {subtitle && (
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', margin: 0 }}>{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function SuccessToast({ message, onClose }) {
  return (
    <div
      className="toast success animate-slide-in"
      style={{ position: 'fixed', bottom: 'var(--space-6)', right: 'var(--space-6)', zIndex: 300 }}
    >
      <CheckCircle size={18} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
      <span style={{ fontWeight: 600 }}>{message}</span>
      <button
        onClick={onClose}
        style={{ marginLeft: 'auto', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        ✕
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export default function Tactics() {
  const { state, dispatch, addNotification } = useGame();
  const { userTeam } = state;

  const savedTactics = userTeam?.tactics ?? {};
  const players = userTeam?.players ?? [];
  const headCoach = userTeam?.staff?.headCoach ?? null;

  const [tactics, setTactics] = useState({
    ...DEFAULT_TACTICS,
    ...savedTactics,
    selectedPlayers: savedTactics.selectedPlayers ?? [],
    startingFive: savedTactics.startingFive ?? [],
    timeoutTriggers: savedTactics.timeoutTriggers ?? [],
  });
  const [saved, setSaved] = useState(false);

  // Keep tactics in sync if userTeam changes externally
  useEffect(() => {
    if (userTeam?.tactics) {
      setTactics(prev => ({ ...DEFAULT_TACTICS, ...userTeam.tactics, ...prev }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!userTeam) {
    return (
      <div className="page-content animate-fade-in">
        <div className="empty-state">
          <div className="empty-state-icon">🏀</div>
          <div className="empty-state-title">No team data found</div>
          <div className="empty-state-desc">Start a new game to manage tactics.</div>
        </div>
      </div>
    );
  }

  // ── Handlers ────────────────────────────────────────────────

  const toggleSelected = (playerId) => {
    setTactics(prev => {
      const isSelected = prev.selectedPlayers.includes(playerId);
      if (isSelected) {
        return {
          ...prev,
          selectedPlayers: prev.selectedPlayers.filter(id => id !== playerId),
          startingFive: prev.startingFive.filter(id => id !== playerId),
        };
      }
      if (prev.selectedPlayers.length >= 12) return prev;
      return { ...prev, selectedPlayers: [...prev.selectedPlayers, playerId] };
    });
  };

  const toggleStarting = (playerId) => {
    setTactics(prev => {
      if (!prev.selectedPlayers.includes(playerId)) return prev;
      const isStarter = prev.startingFive.includes(playerId);
      if (isStarter) {
        return { ...prev, startingFive: prev.startingFive.filter(id => id !== playerId) };
      }
      if (prev.startingFive.length >= 5) return prev;
      return { ...prev, startingFive: [...prev.startingFive, playerId] };
    });
  };

  const toggleTimeoutTrigger = (trigger) => {
    setTactics(prev => {
      const has = prev.timeoutTriggers.includes(trigger);
      return {
        ...prev,
        timeoutTriggers: has
          ? prev.timeoutTriggers.filter(t => t !== trigger)
          : [...prev.timeoutTriggers, trigger],
      };
    });
  };

  const handleSave = () => {
    if (!userTeam) return;
    dispatch({
      type: 'UPDATE_TEAM',
      payload: { ...userTeam, tactics },
    });
    setSaved(true);
    addNotification('Tactics saved successfully!', 'success');
    setTimeout(() => setSaved(false), 4000);
  };

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="page-content animate-fade-in">
      {/* Page header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div>
            <h1>Tactics</h1>
            <p>{userTeam.name} — Game plan &amp; lineup configuration</p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={handleSave}>
            <Settings size={18} />
            Save Tactics
          </button>
        </div>
      </div>

      {/* ── 1. Match Roster & Depth Chart ──────────────────────── */}
      <div className="card mb-6">
        <SectionHeader
          icon={<Users size={18} />}
          title="Match Roster & Depth Chart"
          subtitle={`Select up to 12 players for the match, then designate your Starting 5`}
        />

        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
          <span className="badge badge-orange">
            {tactics.selectedPlayers.length}/12 Selected
          </span>
          <span className="badge badge-blue">
            {tactics.startingFive.length}/5 Starters
          </span>
          {tactics.selectedPlayers.length < 5 && (
            <span className="badge badge-red">Need at least 5 players selected</span>
          )}
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>In Match</th>
                <th>Starter</th>
                <th>Name</th>
                <th>Pos</th>
                <th>Overall</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {players.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--space-6)' }}>
                    No players on roster
                  </td>
                </tr>
              ) : (
                players.map(player => {
                  const isSelected = tactics.selectedPlayers.includes(player.id);
                  const isStarter = tactics.startingFive.includes(player.id);
                  const isInjured = player.injuryStatus && player.injuryStatus !== 'healthy';
                  return (
                    <tr
                      key={player.id}
                      style={{
                        opacity: isInjured ? 0.6 : 1,
                        background: isStarter
                          ? 'rgba(232, 98, 26, 0.06)'
                          : isSelected
                          ? 'var(--bg-muted)'
                          : undefined,
                      }}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelected(player.id)}
                          disabled={isInjured && !isSelected}
                          style={{ accentColor: 'var(--color-primary)', width: 16, height: 16, cursor: 'pointer' }}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={isStarter}
                          onChange={() => toggleStarting(player.id)}
                          disabled={!isSelected}
                          title={!isSelected ? 'Select player for match first' : isStarter ? 'Remove from starting 5' : tactics.startingFive.length >= 5 ? 'Starting 5 full' : 'Add to starting 5'}
                          style={{ accentColor: 'var(--color-primary-dark)', width: 16, height: 16, cursor: isSelected ? 'pointer' : 'not-allowed' }}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <div
                            className="avatar avatar-sm"
                            style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800 }}
                          >
                            {player.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                          </div>
                          <span style={{ fontWeight: 600 }}>{player.name}</span>
                          {isStarter && (
                            <span className="badge badge-orange" style={{ fontSize: '0.65rem' }}>Starter</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="player-position-badge">{player.position}</span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                        {player.overallRating ?? '–'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                          {isInjured ? (
                            getInjuryBadge(player)
                          ) : (
                            <span className="badge badge-green">Healthy</span>
                          )}
                          {getFatigueBadge(player)}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 2. Core Playing Style ───────────────────────────────── */}
      <div className="card mb-6">
        <SectionHeader
          icon={<Zap size={18} />}
          title="Core Playing Style"
          subtitle="Choose your offensive philosophy for the season"
        />

        <div className="grid-2" style={{ gap: 'var(--space-3)' }}>
          {PLAYING_STYLES.map((style, idx) => {
            const score = getTacticalScore(headCoach, idx);
            const isActive = tactics.playingStyle === style.id;
            return (
              <div
                key={style.id}
                onClick={() => setTactics(prev => ({ ...prev, playingStyle: style.id }))}
                style={{
                  border: `2px solid ${isActive ? 'var(--color-primary)' : 'var(--border-card)'}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-4)',
                  cursor: 'pointer',
                  background: isActive ? 'var(--color-primary-100)' : 'var(--bg-card)',
                  transition: 'all var(--transition-fast)',
                  position: 'relative',
                }}
              >
                {isActive && (
                  <div style={{ position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)' }}>
                    <CheckCircle size={18} style={{ color: 'var(--color-primary)' }} />
                  </div>
                )}
                <div style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>{style.icon}</div>
                <div style={{ fontWeight: 800, fontSize: 'var(--font-size-base)', marginBottom: 2 }}>
                  {style.label}
                </div>
                <div
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-primary)',
                    fontWeight: 600,
                    marginBottom: 'var(--space-2)',
                  }}
                >
                  {style.subtitle}
                </div>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                  {style.description}
                </p>

                {/* Tactical Effectiveness Score */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: 4,
                    }}
                  >
                    <span>Tactical Effectiveness</span>
                    <span style={{ color: score >= 75 ? 'var(--color-success)' : score >= 55 ? 'var(--color-warning)' : 'var(--color-danger)', fontWeight: 800 }}>
                      {score}%
                    </span>
                  </div>
                  <div className="progress-bar-track">
                    <div
                      className={`progress-bar-fill ${score >= 75 ? 'success' : score >= 55 ? 'warning' : 'danger'}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {headCoach && (
          <p style={{ marginTop: 'var(--space-3)', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Effectiveness scores based on Head Coach <strong>{headCoach.name}</strong>'s ability rating.
          </p>
        )}
      </div>

      {/* ── 3. Defensive Style ─────────────────────────────────── */}
      <div className="card mb-6">
        <SectionHeader
          icon={<Shield size={18} />}
          title="Defensive Style"
          subtitle="Configure your defensive scheme and press frequency"
        />

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Defensive Scheme</label>
            <select
              className="form-select"
              value={tactics.defenseType}
              onChange={e => setTactics(prev => ({ ...prev, defenseType: e.target.value }))}
            >
              {DEFENSE_TYPES.map(dt => (
                <option key={dt} value={dt}>{dt}</option>
              ))}
            </select>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
              {tactics.defenseType === 'Man-to-Man' && 'Each defender assigned to a specific offensive player.'}
              {tactics.defenseType.startsWith('Zone') && 'Defenders cover zones rather than specific players.'}
              {tactics.defenseType.startsWith('Press') && 'Aggressive full- or three-quarter court pressure defense.'}
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Press Frequency</label>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
              {PRESS_FREQUENCIES.map(freq => (
                <button
                  key={freq}
                  onClick={() => setTactics(prev => ({ ...prev, pressFrequency: freq }))}
                  className={`btn btn-sm ${tactics.pressFrequency === freq ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1 }}
                >
                  {freq}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 6, display: 'block' }}>
              {tactics.pressFrequency === 'High' && 'High energy — risks fatigue but disrupts opponents.'}
              {tactics.pressFrequency === 'Medium' && 'Balanced approach — use press situationally.'}
              {tactics.pressFrequency === 'Low' && 'Conserve energy — press only in critical moments.'}
            </span>
          </div>
        </div>
      </div>

      {/* ── 4. Substitution Strategy ───────────────────────────── */}
      <div className="card mb-6">
        <SectionHeader
          icon={<Target size={18} />}
          title="Substitution Strategy"
          subtitle="Control how and when players are rotated"
        />

        <div className="grid-2">
          {/* Sub toggle */}
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-3)' }}>
              Rotation Type
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {['Fixed Rotation', 'Flow Rotation'].map(opt => (
                <button
                  key={opt}
                  onClick={() => setTactics(prev => ({ ...prev, subStrategy: opt }))}
                  className={`btn ${tactics.subStrategy === opt ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1 }}
                >
                  {opt}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>
              {tactics.subStrategy === 'Fixed Rotation'
                ? 'Players substituted on a pre-set schedule regardless of form or foul trouble.'
                : 'Substitutions adapt to game flow, fatigue levels, and foul situations.'}
            </p>
          </div>

          {/* Timeout triggers */}
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
              Timeout Triggers
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {TIMEOUT_TRIGGERS.map(trigger => (
                <label
                  key={trigger}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={tactics.timeoutTriggers.includes(trigger)}
                    onChange={() => toggleTimeoutTrigger(trigger)}
                    style={{ accentColor: 'var(--color-primary)', width: 15, height: 15 }}
                  />
                  {trigger}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. Injury Management ───────────────────────────────── */}
      <div className="card mb-6">
        <SectionHeader
          icon={<Settings size={18} />}
          title="Injury Management"
          subtitle="How aggressively you push players through fatigue and minor injuries"
        />

        <div className="form-group" style={{ maxWidth: 480 }}>
          <label className="form-label">Management Approach</label>
          <select
            className="form-select"
            value={tactics.injuryManagement ?? INJURY_MANAGEMENT_OPTIONS[1]}
            onChange={e => setTactics(prev => ({ ...prev, injuryManagement: e.target.value }))}
          >
            {INJURY_MANAGEMENT_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-warning-light)',
            border: '1px solid var(--color-warning)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-warning)',
            fontWeight: 600,
          }}
        >
          ⚠ Aggressive management increases injury risk. Conservative management may reduce player minutes.
        </div>
      </div>

      {/* Save row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
        <button
          className="btn btn-ghost"
          onClick={() => {
            setTactics({ ...DEFAULT_TACTICS, ...userTeam?.tactics });
          }}
        >
          Reset Changes
        </button>
        <button className="btn btn-primary btn-lg" onClick={handleSave}>
          <Settings size={18} />
          Save Tactics
        </button>
      </div>

      {saved && (
        <SuccessToast message="Tactics saved successfully!" onClose={() => setSaved(false)} />
      )}
    </div>
  );
}
