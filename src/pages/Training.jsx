import { useState, useCallback } from 'react';
import { useGame } from '../context/GameContext.jsx';
import {
  Zap,
  Users,
  Activity,
  Heart,
  CheckCircle,
  AlertTriangle,
  Info,
  Save,
} from 'lucide-react';

// ── Floating player hover card ─────────────────────────────────
function PlayerHoverCard({ player, x, y }) {
  if (!player) return null;
  return (
    <div style={{
      position: 'fixed', left: x + 16, top: y - 40, zIndex: 9999,
      background: 'var(--bg-card)', border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)', padding: '10px 14px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.18)', minWidth: 180, pointerEvents: 'none',
    }}>
      <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 4 }}>{player.name}</div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 6 }}>
        {player.position} · OVR {player.overallRating ?? player.overall ?? '?'}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: (player.fatigue ?? 0) > 70 ? 'rgba(239,68,68,0.1)' : 'var(--bg-muted)', color: (player.fatigue ?? 0) > 70 ? '#ef4444' : 'var(--text-muted)' }}>
          Fatigue {player.fatigue ?? 0}%
        </span>
        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>
          Form {player.lastFormRating ?? 50}
        </span>
        {player.injuryStatus && player.injuryStatus !== 'healthy' && (
          <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            {player.injuryStatus}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Training area definitions ─────────────────────────────────

const TRAINING_AREAS = [
  {
    id: 'offensiveSchemes',
    label: 'Offensive Schemes',
    icon: '🏀',
    impactsLabel: 'Court Vision, Passing Accuracy, Basketball IQ',
    staffInfluenceRole: 'Head Coach',
    staffInfluenceLabel: 'Head Coach',
    staffAbilityKey: 'gamePlanning',
  },
  {
    id: 'defensiveDrills',
    label: 'Defensive Drills',
    icon: '🛡',
    impactsLabel: 'Perimeter Defense, Interior Defense, Help Defense',
    staffInfluenceRole: 'Assistant Coach',
    staffInfluenceLabel: 'Assistant Coach',
    staffAbilityKey: 'tacticalKnowledge',
  },
  {
    id: 'skillWorkShooting',
    label: 'Skill Work (Shooting)',
    icon: '🎯',
    impactsLabel: '3-Point Shooting, Mid-Range Scoring, Free Throw Shooting',
    staffInfluenceRole: 'Assistant Coach',
    staffInfluenceLabel: 'Assistant Coach',
    staffAbilityKey: 'playerDevelopment',
  },
  {
    id: 'conditioning',
    label: 'Conditioning',
    icon: '⚡',
    impactsLabel: 'Stamina/Endurance, Conditioning/Fitness, Agility/Lateral Speed',
    staffInfluenceRole: 'Strength & Conditioning Coach',
    staffInfluenceLabel: 'S&C Coach',
    staffAbilityKey: 'conditioningPrograms',
  },
  {
    id: 'teamBuilding',
    label: 'Team Building',
    icon: '🤝',
    impactsLabel: 'Team-First Attitude, Leadership/Communication, Handle Pressure',
    staffInfluenceRole: 'Psychologist',
    staffInfluenceLabel: 'Psychologist',
    staffAbilityKey: 'motivation',
  },
  {
    id: 'gymStrength',
    label: 'GYM / Strength Training',
    icon: '💪',
    impactsLabel: 'Vertical/Leaping Ability, Body Control, Agility/Lateral Speed',
    staffInfluenceRole: 'Strength & Conditioning Coach',
    staffInfluenceLabel: 'S&C Coach',
    staffAbilityKey: 'strengthTraining',
  },
];

const MAX_POINTS = 100;
const MAX_PER_AREA = 40;

const DEFAULT_TRAINING = {
  offensiveSchemes: 20,
  defensiveDrills: 20,
  skillWorkShooting: 20,
  conditioning: 15,
  teamBuilding: 10,
  gymStrength: 15,
};

// ── Chemistry factors ─────────────────────────────────────────

const CHEMISTRY_FACTORS_POSITIVE = [
  'Consistent win streak boosts morale',
  'Strong team building allocation',
  'High motivation from coaching staff',
  'Players returning from rest days',
];

const CHEMISTRY_FACTORS_NEGATIVE = [
  'Fixture congestion causing fatigue',
  'High-fatigue players in starting lineup',
  'Inconsistent rotation undermining confidence',
];

const CHEMISTRY_EVENTS = [
  { icon: '🏆', text: 'Team bonding session after last victory', time: '2 days ago' },
  { icon: '😤', text: 'Minor locker room disagreement — resolved quickly', time: '4 days ago' },
  { icon: '🙌', text: 'Player praised colleague publicly — chemistry boost', time: '5 days ago' },
  { icon: '📣', text: 'Coach delivered motivational team talk', time: '1 week ago' },
];

// ── Helpers ───────────────────────────────────────────────────

function totalPoints(training) {
  return Object.values(training).reduce((s, v) => s + v, 0);
}

function getStaffAbility(staffObj, role, abilityKey) {
  const member = staffObj?.[role];
  if (!member) return null;
  return {
    name: member.name,
    value: member.abilities?.[abilityKey] ?? 0,
  };
}

function fatigueBadgeClass(fatigue) {
  if (fatigue >= 70) return 'badge-red';
  if (fatigue >= 40) return 'badge-yellow';
  return 'badge-green';
}

function fatigueBadgeLabel(fatigue) {
  if (fatigue >= 70) return 'High Risk';
  if (fatigue >= 40) return 'Moderate';
  return 'Low Risk';
}

// ── Section header sub-component ──────────────────────────────

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
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, margin: 0 }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', margin: 0 }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Fatigue gauge row ──────────────────────────────────────────

function FatigueGauge({ value }) {
  const pct = Math.min(100, Math.max(0, value ?? 0));
  const color =
    pct >= 70
      ? 'var(--color-danger)'
      : pct >= 40
      ? 'var(--color-warning)'
      : 'var(--color-success)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1 }}>
      <div
        style={{
          flex: 1,
          height: 8,
          background: 'var(--bg-muted)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            borderRadius: 'var(--radius-full)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <span
        style={{
          fontSize: 'var(--font-size-xs)',
          fontWeight: 800,
          color,
          minWidth: 28,
          textAlign: 'right',
        }}
      >
        {pct}
      </span>
    </div>
  );
}

// ── Main Training page ────────────────────────────────────────

export default function Training() {
  const { state, dispatch, addNotification } = useGame();
  const { userTeam } = state;

  const savedTraining = userTeam?.training ?? {};
  const players = userTeam?.players ?? [];
  const staffObj = userTeam?.staff ?? {};
  const chemistry = userTeam?.chemistryGauge ?? 50;

  const [training, setTraining] = useState({
    ...DEFAULT_TRAINING,
    ...savedTraining,
  });

  const [focusPlayers, setFocusPlayers] = useState(
    savedTraining.focusPlayers ?? []
  );

  // Local fatigue state so "Rest Day" button updates immediately
  const [localFatigue, setLocalFatigue] = useState(() => {
    const map = {};
    for (const p of players) {
      map[p.id] = p.fatigue ?? 0;
    }
    return map;
  });

  const [saved, setSaved] = useState(false);

  const used = totalPoints(training);
  const remaining = MAX_POINTS - used;
  const isOver = used > MAX_POINTS;

  // ── Training slider handler ────────────────────────────────

  const handleSlider = useCallback((areaId, newVal) => {
    setTraining((prev) => {
      const clamped = Math.min(MAX_PER_AREA, Math.max(0, Number(newVal)));
      const oldVal = prev[areaId] ?? 0;
      const diff = clamped - oldVal;
      const otherUsed = Object.entries(prev)
        .filter(([k]) => k !== areaId)
        .reduce((s, [, v]) => s + v, 0);
      // Don't exceed 100 total
      if (otherUsed + clamped > MAX_POINTS) return prev;
      return { ...prev, [areaId]: clamped };
    });
  }, []);

  // ── Focus player toggle ────────────────────────────────────

  const toggleFocusPlayer = (playerId) => {
    setFocusPlayers((prev) => {
      if (prev.includes(playerId)) {
        return prev.filter((id) => id !== playerId);
      }
      if (prev.length >= 3) return prev;
      return [...prev, playerId];
    });
  };

  // ── Rest day ───────────────────────────────────────────────

  const handleRestDay = (player) => {
    setLocalFatigue((prev) => ({
      ...prev,
      [player.id]: Math.max(0, (prev[player.id] ?? 0) - 20),
    }));
    // Also persist to team
    const updated = {
      ...userTeam,
      players: players.map((p) =>
        p.id === player.id
          ? { ...p, fatigue: Math.max(0, (p.fatigue ?? 0) - 20) }
          : p
      ),
    };
    dispatch({ type: 'UPDATE_TEAM', payload: updated });
    addNotification(`${player.name} given a rest day — fatigue reduced.`, 'info');
  };

  // ── Save ───────────────────────────────────────────────────

  const handleSave = () => {
    if (!userTeam) return;
    if (isOver) {
      addNotification('Training points exceed 100 — adjust allocation before saving.', 'error');
      return;
    }
    dispatch({
      type: 'UPDATE_TEAM',
      payload: {
        ...userTeam,
        training: { ...training, focusPlayers },
      },
    });
    setSaved(true);
    addNotification('Training settings saved!', 'success');
    setTimeout(() => setSaved(false), 4000);
  };

  if (!userTeam) {
    return (
      <div className="page-content animate-fade-in">
        <div className="empty-state">
          <div className="empty-state-icon">🏀</div>
          <div className="empty-state-title">No team data found</div>
          <div className="empty-state-desc">Start a new game to manage training.</div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────

  const usedPoints = totalPoints(training);

  return (
    <div className="page-content animate-fade-in" style={{ paddingBottom: 80 }}>
      {/* Page header */}
      <div className="page-header">
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          <div>
            <h1>Training &amp; Chemistry</h1>
            <p>{userTeam.name} — Practice sessions, player development &amp; team cohesion</p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={isOver}>
            <CheckCircle size={18} />
            Save Training
          </button>
        </div>
      </div>

      {/* ── 1. Training Focus Allocation ──────────────────────── */}
      <div className="card mb-6">
        <SectionHeader
          icon={<Zap size={18} />}
          title="Training Focus Allocation"
          subtitle="Distribute 100 points across training areas (max 40 per area)"
        />

        {/* Points summary */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-5)',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            background: isOver ? 'var(--color-danger-light)' : 'var(--bg-muted)',
            border: `1px solid ${isOver ? 'var(--color-danger)' : 'var(--border-color)'}`,
          }}
        >
          {isOver ? (
            <AlertTriangle size={18} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
          ) : (
            <Info size={18} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
          )}
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: isOver ? 'var(--color-danger)' : 'var(--text-primary)' }}>
              {used} / {MAX_POINTS} points used
            </span>
            {remaining > 0 && !isOver && (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginLeft: 'var(--space-2)' }}>
                ({remaining} remaining)
              </span>
            )}
            {isOver && (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)', marginLeft: 'var(--space-2)' }}>
                Over by {used - MAX_POINTS} — reduce allocation to save.
              </span>
            )}
          </div>
          {/* Mini total bar */}
          <div style={{ width: 120, height: 8, background: 'var(--bg-card)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, used)}%`,
                height: '100%',
                background: isOver ? 'var(--color-danger)' : used >= 90 ? 'var(--color-warning)' : 'var(--color-primary)',
                borderRadius: 'var(--radius-full)',
                transition: 'width 0.2s ease',
              }}
            />
          </div>
        </div>

        {/* Sliders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {TRAINING_AREAS.map((area) => {
            const val = training[area.id] ?? 0;
            const staffInfo = getStaffAbility(staffObj, area.staffInfluenceRole, area.staffAbilityKey);
            const staffPct = staffInfo?.value ?? 0;
            const staffBonus = staffPct >= 70 ? '+5% effectiveness' : staffPct >= 50 ? 'Standard effectiveness' : '-5% effectiveness';

            return (
              <div key={area.id}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    marginBottom: 'var(--space-2)',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>{area.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', flex: 1 }}>
                    {area.label}
                  </span>
                  <span
                    style={{
                      fontWeight: 900,
                      fontSize: 'var(--font-size-lg)',
                      color: 'var(--color-primary)',
                      minWidth: 36,
                      textAlign: 'right',
                    }}
                  >
                    {val}
                  </span>
                </div>

                <input
                  type="range"
                  min={0}
                  max={MAX_PER_AREA}
                  value={val}
                  onChange={(e) => handleSlider(area.id, e.target.value)}
                  style={{ width: '100%', marginBottom: 'var(--space-2)' }}
                />

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 'var(--space-3)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>
                    <strong>Impacts:</strong> {area.impactsLabel}
                  </span>
                  {staffInfo && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        color:
                          staffPct >= 70
                            ? 'var(--color-success)'
                            : staffPct >= 50
                            ? 'var(--color-warning)'
                            : 'var(--color-danger)',
                        fontWeight: 600,
                      }}
                    >
                      {area.staffInfluenceLabel}: {staffInfo.name} ({staffPct}) — {staffBonus}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 2. Individual Player Focus ─────────────────────────── */}
      <div className="card mb-6">
        <SectionHeader
          icon={<Users size={18} />}
          title="Individual Player Focus"
          subtitle="Select up to 3 players for intensive training this week"
        />

        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-warning-light)',
            border: '1px solid var(--color-warning)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-warning)',
            fontWeight: 600,
            marginBottom: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          Intensive focus increases fatigue risk. Monitor selected players closely.
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
          <span className="badge badge-orange">{focusPlayers.length}/3 selected</span>
          {focusPlayers.length >= 3 && (
            <span className="badge badge-gray">Max players reached</span>
          )}
        </div>

        {players.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            No players on roster.
          </p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Focus</th>
                  <th>Player</th>
                  <th>Pos</th>
                  <th>Overall</th>
                  <th>Special Ability</th>
                  <th>Expected Gain</th>
                  <th>Fatigue Risk</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player) => {
                  const isFocused = focusPlayers.includes(player.id);
                  const fatigue = localFatigue[player.id] ?? player.fatigue ?? 0;
                  // Determine a special ability to highlight
                  const attrs = player.attributes ?? {};
                  const attrEntries = Object.entries(attrs);
                  const topAttr = attrEntries.sort(([, a], [, b]) => b - a)[0];
                  const topAttrLabel = topAttr
                    ? topAttr[0]
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^./, (s) => s.toUpperCase())
                        .trim()
                    : 'General';
                  const gain = isFocused
                    ? fatigue > 60
                      ? '+1 (fatigue risk)'
                      : '+2 to +4'
                    : '–';

                  return (
                    <tr
                      key={player.id}
                      style={{
                        background: isFocused ? 'rgba(232, 98, 26, 0.06)' : undefined,
                      }}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={isFocused}
                          onChange={() => toggleFocusPlayer(player.id)}
                          disabled={!isFocused && focusPlayers.length >= 3}
                          style={{ accentColor: 'var(--color-primary)', width: 16, height: 16, cursor: 'pointer' }}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <div className="avatar avatar-sm" style={{ fontWeight: 800, fontSize: 'var(--font-size-xs)' }}>
                            {player.name?.split(' ').map((n) => n[0]).join('').slice(0, 2) || '?'}
                          </div>
                          <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                            {player.name}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="player-position-badge">{player.position}</span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                        {player.overallRating ?? '–'}
                      </td>
                      <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                        {topAttrLabel} ({topAttr?.[1] ?? '–'})
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 700,
                            color: isFocused
                              ? fatigue > 60
                                ? 'var(--color-warning)'
                                : 'var(--color-success)'
                              : 'var(--text-muted)',
                          }}
                        >
                          {gain}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${isFocused && fatigue > 40 ? 'badge-red' : isFocused ? 'badge-yellow' : 'badge-green'}`}
                          style={{ fontSize: '0.65rem' }}
                        >
                          {isFocused && fatigue > 40 ? 'High' : isFocused ? 'Moderate' : 'Normal'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 3. Fatigue Management ─────────────────────────────── */}
      <div className="card mb-6">
        <SectionHeader
          icon={<Activity size={18} />}
          title="Fatigue Management"
          subtitle="Monitor player fatigue and schedule rest days to prevent injuries"
        />

        {players.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            No players on roster.
          </p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Pos</th>
                  <th>Fatigue</th>
                  <th>Injury Risk</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {[...players]
                  .sort(
                    (a, b) =>
                      (localFatigue[b.id] ?? b.fatigue ?? 0) -
                      (localFatigue[a.id] ?? a.fatigue ?? 0)
                  )
                  .map((player) => {
                    const fatigue = localFatigue[player.id] ?? player.fatigue ?? 0;
                    const isHighFatigue = fatigue > 70;
                    return (
                      <tr
                        key={player.id}
                        style={{
                          background: isHighFatigue
                            ? 'rgba(198, 40, 40, 0.05)'
                            : undefined,
                        }}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <div
                              className="avatar avatar-sm"
                              style={{ fontWeight: 800, fontSize: 'var(--font-size-xs)' }}
                            >
                              {player.name?.split(' ').map((n) => n[0]).join('').slice(0, 2) || '?'}
                            </div>
                            <span
                              style={{
                                fontWeight: 600,
                                fontSize: 'var(--font-size-sm)',
                                color: isHighFatigue ? 'var(--color-danger)' : 'var(--text-primary)',
                              }}
                            >
                              {player.name}
                              {isHighFatigue && (
                                <span style={{ marginLeft: 6, fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)' }}>
                                  ⚠
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="player-position-badge">{player.position}</span>
                        </td>
                        <td style={{ minWidth: 160 }}>
                          <FatigueGauge value={fatigue} />
                        </td>
                        <td>
                          <span className={`badge ${fatigueBadgeClass(fatigue)}`} style={{ fontSize: '0.65rem' }}>
                            {fatigueBadgeLabel(fatigue)}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleRestDay(player)}
                            style={{
                              borderColor: fatigue > 0 ? 'var(--color-success)' : 'var(--border-color)',
                              color: fatigue > 0 ? 'var(--color-success)' : 'var(--text-muted)',
                            }}
                            disabled={fatigue === 0}
                            title={fatigue === 0 ? 'Player is fully rested' : 'Give rest day (−20 fatigue)'}
                          >
                            Rest Day
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 3b. Weekly Training Review ───────────────────────── */}
      <div className="card mb-6">
        <SectionHeader
          icon={<CheckCircle size={18} />}
          title="Weekly Training Review"
          subtitle="Expected attribute improvements based on your current training allocation"
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {TRAINING_AREAS.map(area => {
            const points = training[area.id] ?? 0;
            const intensity = points >= 30 ? 'High' : points >= 15 ? 'Medium' : 'Low';
            const gain = points >= 30 ? '+2 to +3 per player' : points >= 15 ? '+1 to +2 per player' : points > 0 ? '+0 to +1 per player' : 'No development';
            const color = points >= 30 ? 'var(--color-success)' : points >= 15 ? 'var(--color-warning)' : points > 0 ? 'var(--color-primary)' : 'var(--text-muted)';
            const staffInfo = getStaffAbility(staffObj, area.staffInfluenceRole, area.staffAbilityKey);
            const staffBonus = staffInfo?.value >= 70 ? ' (+staff bonus)' : '';
            return (
              <div key={area.id} style={{
                padding: '12px 14px', borderRadius: 'var(--radius-md)',
                background: points > 0 ? 'var(--bg-muted)' : 'transparent',
                border: '1px solid var(--border-color)',
                opacity: points === 0 ? 0.5 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: '1rem' }}>{area.icon}</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color, background: `${color}20`, padding: '2px 7px', borderRadius: 20 }}>{intensity}</span>
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, marginBottom: 4 }}>{area.label}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>{area.impactsLabel}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color }}>{gain}{staffBonus}</div>
                <div style={{ marginTop: 6, height: 4, background: 'var(--bg-card)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, (points / 40) * 100)}%`, height: '100%', background: color, borderRadius: 'var(--radius-full)' }} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-muted)', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
          💡 Attribute gains apply weekly to all active (non-injured) players. Focus players receive 2× gains.
          {focusPlayers.length > 0 && <> <strong style={{ color: 'var(--color-primary)' }}>{focusPlayers.length} focus player{focusPlayers.length > 1 ? 's' : ''}</strong> will receive double development this week.</>}
        </div>
      </div>

      {/* ── 4. Team Chemistry Gauge ───────────────────────────── */}
      <div className="card mb-6">
        <SectionHeader
          icon={<Heart size={18} />}
          title="Team Chemistry"
          subtitle="Overall cohesion and trust among players and staff"
        />

        {/* Large chemistry bar */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 'var(--space-2)',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 'var(--font-size-base)', color: 'var(--text-primary)' }}>
              Chemistry Score
            </span>
            <span
              style={{
                fontWeight: 900,
                fontSize: 'var(--font-size-3xl)',
                color:
                  chemistry >= 70
                    ? 'var(--color-success)'
                    : chemistry >= 40
                    ? 'var(--color-warning)'
                    : 'var(--color-danger)',
                lineHeight: 1,
              }}
            >
              {Math.round(chemistry)}
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: 20,
              background: 'var(--bg-muted)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.min(100, chemistry)}%`,
                height: '100%',
                background:
                  chemistry >= 70
                    ? 'linear-gradient(90deg, #2E7D32, #66BB6A)'
                    : chemistry >= 40
                    ? 'linear-gradient(90deg, #F57C00, #FFB74D)'
                    : 'linear-gradient(90deg, #C62828, #EF5350)',
                borderRadius: 'var(--radius-full)',
                transition: 'width 0.5s ease',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 'var(--space-1)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-muted)',
            }}
          >
            <span>0 — Fractured</span>
            <span>50 — Stable</span>
            <span>100 — Elite</span>
          </div>
        </div>

        <div className="grid-2" style={{ gap: 'var(--space-5)' }}>
          {/* Positive factors */}
          <div>
            <p
              style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 1,
                color: 'var(--color-success)',
                marginBottom: 'var(--space-3)',
              }}
            >
              Positive Factors
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {CHEMISTRY_FACTORS_POSITIVE.map((f) => (
                <div
                  key={f}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 'var(--space-2)',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span style={{ color: 'var(--color-success)', marginTop: 2, flexShrink: 0 }}>↑</span>
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* Negative factors */}
          <div>
            <p
              style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 1,
                color: 'var(--color-danger)',
                marginBottom: 'var(--space-3)',
              }}
            >
              Negative Factors
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {CHEMISTRY_FACTORS_NEGATIVE.map((f) => (
                <div
                  key={f}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 'var(--space-2)',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span style={{ color: 'var(--color-danger)', marginTop: 2, flexShrink: 0 }}>↓</span>
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent chemistry events */}
        <div style={{ marginTop: 'var(--space-5)' }}>
          <p
            style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: 'var(--text-muted)',
              marginBottom: 'var(--space-3)',
            }}
          >
            Recent Chemistry Events
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {CHEMISTRY_EVENTS.map((event, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-muted)',
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                <span style={{ flexShrink: 0, fontSize: '1rem' }}>{event.icon}</span>
                <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{event.text}</span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', flexShrink: 0 }}>
                  {event.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky save bar */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)',
          padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 -4px 12px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 'var(--font-size-sm)', color: isOver ? 'var(--color-danger)' : 'var(--text-muted)', fontWeight: isOver ? 700 : 400 }}>
            {usedPoints}/100 points allocated
          </span>
          {isOver && <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)' }}>Over by {usedPoints - 100} — adjust sliders</span>}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setTraining({ ...DEFAULT_TRAINING, ...userTeam?.training });
              setFocusPlayers(userTeam?.training?.focusPlayers ?? []);
            }}
          >
            Reset
          </button>
          <button
            className={`btn btn-lg ${saved ? 'btn-success' : 'btn-primary'}`}
            onClick={handleSave}
            disabled={isOver || saved}
          >
            {saved ? <><CheckCircle size={16} /> Saved!</> : <><Save size={16} /> Save Training Plan</>}
          </button>
        </div>
      </div>

      {/* Inline success notification */}
      {saved && (
        <div
          className="toast success animate-slide-in"
          style={{
            position: 'fixed',
            bottom: 'var(--space-6)',
            right: 'var(--space-6)',
            zIndex: 300,
          }}
        >
          <CheckCircle size={18} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
          <span style={{ fontWeight: 600 }}>Training settings saved!</span>
          <button
            onClick={() => setSaved(false)}
            style={{
              marginLeft: 'auto',
              color: 'var(--text-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
