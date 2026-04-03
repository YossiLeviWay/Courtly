import { useState, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext.jsx';
import { Users, Target, Shield, Zap, Settings, CheckCircle, X, Save } from 'lucide-react';

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
    recommendedWhen: (stats) => (stats.avgPost || 0) >= 65,
    recommendLabel: 'Strong post players',
  },
  {
    id: 'Fast Break',
    label: 'Fast Break',
    subtitle: 'Transition Offense',
    description: 'Push in transition, exploit numbers advantages before defense sets',
    icon: '🏃',
    recommendedWhen: (stats) => (stats.avgAgility || 0) >= 65 && (stats.avgStamina || 0) >= 60,
    recommendLabel: 'High agility & stamina',
  },
  {
    id: 'Triangle Offense',
    label: 'Triangle Offense',
    subtitle: 'Spacing & IQ',
    description: 'Three-player triangles on each side; emphasizes basketball IQ and spacing',
    icon: '🔺',
    recommendedWhen: (stats) => (stats.avgIQ || 0) >= 65,
    recommendLabel: 'High basketball IQ',
  },
  {
    id: 'Isolation',
    label: 'Isolation',
    subtitle: 'Star-Driven',
    description: 'Clear out and let your best scorer operate one-on-one',
    icon: '⭐',
    recommendedWhen: (stats) => (stats.topPlayerOvr || 0) >= 80,
    recommendLabel: 'Elite star player',
  },
  {
    id: 'Motion Offense',
    label: 'Motion Offense',
    subtitle: 'Read & React',
    description: 'Continuous movement and cuts; team reads defense in real time',
    icon: '🌀',
    recommendedWhen: (stats) => (stats.avgPassing || 0) >= 62 && (stats.avgCourtVision || 0) >= 60,
    recommendLabel: 'Good passing & vision',
  },
];

const DEFENSE_TYPES = [
  'Man-to-Man',
  'Zone (2-3)',
  'Zone (3-2)',
  'Zone (Box-and-One)',
  'Press (Full)',
  'Press (Three-quarter)',
  'Trap Defense',
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
  lineup: { PG: null, SG: null, SF: null, PF: null, C: null },
  benchPlayers: [],
  timeoutTriggers: [],
  injuryManagement: 'Balanced — standard rotation, monitor closely',
};

const COURT_POSITIONS = [
  { pos: 'PG', label: 'Point Guard',    x: 200, y: 92  },
  { pos: 'SG', label: 'Shooting Guard', x: 60,  y: 186 },
  { pos: 'SF', label: 'Small Forward',  x: 350, y: 226 },
  { pos: 'PF', label: 'Power Forward',  x: 130, y: 298 },
  { pos: 'C',  label: 'Center',         x: 272, y: 264 },
];

// ── Basketball Court SVG ─────────────────────────────────────

function BasketballCourtSVG() {
  return (
    <>
      {/* Wood floor strips */}
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={i * 45} y={0} width={45} height={380}
          fill={i % 2 === 0 ? '#D4956A' : '#C8865A'} />
      ))}
      {/* Key/paint */}
      <rect x={145} y={210} width={110} height={145} fill="#B97A3D" fillOpacity={0.35} stroke="white" strokeWidth={2} />
      {/* Free throw circle top half only */}
      <path d="M 145 210 A 55 55 0 0 1 255 210" fill="none" stroke="white" strokeWidth={2} />
      <path d="M 145 210 A 55 55 0 0 0 255 210" fill="none" stroke="white" strokeWidth={2} strokeDasharray="6 5" />
      {/* Three-point line: corners + arc */}
      <line x1={42} y1={355} x2={42} y2={268} stroke="white" strokeWidth={2.5} />
      <line x1={358} y1={355} x2={358} y2={268} stroke="white" strokeWidth={2.5} />
      <path d="M 42 268 A 176 176 0 1 0 358 268" fill="none" stroke="white" strokeWidth={2.5} />
      {/* Restricted area arc */}
      <path d="M 175 355 A 25 25 0 0 1 225 355" fill="none" stroke="white" strokeWidth={1.5} strokeDasharray="5 4" />
      {/* Basket ring */}
      <circle cx={200} cy={338} r={16} fill="#D07010" stroke="white" strokeWidth={2.5} />
      <circle cx={200} cy={338} r={9} fill="none" stroke="white" strokeWidth={2} />
      {/* Backboard */}
      <rect x={168} y={356} width={64} height={7} rx={2} fill="#2D3748" />
      {/* Hoop post */}
      <rect x={197} y={363} width={6} height={12} rx={1} fill="#718096" />
    </>
  );
}

// ── Player Picker Popover ────────────────────────────────────

function PlayerPicker({ position, players, lineup, onAssign, onClose, anchorPos }) {
  const assignedIds = new Set(Object.values(lineup).filter(Boolean));
  const available = players.filter(p => !assignedIds.has(p.id) || lineup[position] === p.id);

  return (
    <div
      style={{
        position: 'absolute',
        left: Math.min(anchorPos.x, 260),
        top: anchorPos.y + 30,
        zIndex: 200,
        background: 'var(--bg-card)',
        border: '2px solid var(--color-primary)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-3)',
        minWidth: 220,
        maxHeight: 280,
        overflowY: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
        <span style={{ fontWeight: 800, fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)' }}>
          Assign {position}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
          <X size={14} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>
      {lineup[position] && (
        <button
          onClick={() => { onAssign(position, null); onClose(); }}
          style={{
            width: '100%', marginBottom: 'var(--space-2)', padding: '6px 10px',
            borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)',
            background: 'var(--bg-muted)', cursor: 'pointer', fontSize: 'var(--font-size-xs)',
            color: 'var(--color-danger)', fontWeight: 700, textAlign: 'left',
          }}
        >
          ✕ Remove player
        </button>
      )}
      {available.length === 0 ? (
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', padding: 'var(--space-2)' }}>No available players</div>
      ) : (
        available.map(p => {
          const isSelected = lineup[position] === p.id;
          const isInjured = p.injuryStatus && p.injuryStatus !== 'healthy';
          return (
            <button
              key={p.id}
              onClick={() => { onAssign(position, p.id); onClose(); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                padding: '7px 10px', borderRadius: 'var(--radius-md)',
                border: isSelected ? '2px solid var(--color-primary)' : '1px solid transparent',
                background: isSelected ? 'var(--color-primary-100)' : 'transparent',
                cursor: 'pointer', marginBottom: 3, textAlign: 'left',
                opacity: isInjured ? 0.5 : 1,
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: 'var(--color-primary)',
                color: 'white', fontWeight: 800, fontSize: '0.65rem', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {p.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.name}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  {p.position} · OVR {p.overallRating}
                  {isInjured && <span style={{ color: 'var(--color-danger)', marginLeft: 4 }}>⚠ Injured</span>}
                </div>
              </div>
              {isSelected && <CheckCircle size={13} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />}
            </button>
          );
        })
      )}
    </div>
  );
}

// ── Interactive Court Lineup ─────────────────────────────────

function CourtLineup({ players, lineup, onLineupChange, onPlayerHover, onPlayerHoverMove, onPlayerHoverLeave }) {
  const [openPos, setOpenPos] = useState(null);
  const [anchorPos, setAnchorPos] = useState({ x: 0, y: 0 });
  const courtRef = useRef(null);

  const handlePositionClick = (pos, svgX, svgY) => {
    if (openPos === pos) { setOpenPos(null); return; }
    const rect = courtRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    const scaleX = (courtRef.current?.clientWidth || 400) / 400;
    const scaleY = (courtRef.current?.clientHeight || 380) / 380;
    setAnchorPos({ x: svgX * scaleX - 110, y: svgY * scaleY });
    setOpenPos(pos);
  };

  return (
    <div ref={courtRef} style={{ position: 'relative', userSelect: 'none' }}>
      <svg
        viewBox="0 0 400 380"
        style={{ width: '100%', maxWidth: 480, display: 'block', margin: '0 auto', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}
      >
        <BasketballCourtSVG />

        {COURT_POSITIONS.map(({ pos, label, x, y }) => {
          const assignedId = lineup[pos];
          const player = assignedId ? players.find(p => p.id === assignedId) : null;
          const isOpen = openPos === pos;
          const filled = !!player;

          return (
            <g key={pos} style={{ cursor: 'pointer' }} onClick={() => handlePositionClick(pos, x, y)}
              onMouseEnter={player ? (e) => { onPlayerHover && onPlayerHover(player, e.clientX, e.clientY); } : undefined}
              onMouseMove={player ? (e) => { onPlayerHoverMove && onPlayerHoverMove(e.clientX, e.clientY); } : undefined}
              onMouseLeave={player ? () => { onPlayerHoverLeave && onPlayerHoverLeave(); } : undefined}
            >
              {/* Glow ring when open */}
              {isOpen && (
                <circle cx={x} cy={y} r={32} fill="rgba(232,98,26,0.18)" stroke="var(--color-primary)" strokeWidth={2.5} />
              )}
              {/* Player circle */}
              <circle
                cx={x} cy={y} r={24}
                fill={filled ? '#E8621A' : 'rgba(255,255,255,0.92)'}
                stroke={filled ? 'white' : '#E8621A'}
                strokeWidth={2.5}
              />
              {/* Initials or + */}
              {player ? (
                <text x={x} y={y - 2} textAnchor="middle" dominantBaseline="middle"
                  fontSize="9" fontWeight="900" fill="white" style={{ pointerEvents: 'none' }}>
                  {player.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                </text>
              ) : (
                <text x={x} y={y} textAnchor="middle" dominantBaseline="middle"
                  fontSize="18" fontWeight="700" fill="#E8621A" style={{ pointerEvents: 'none' }}>
                  +
                </text>
              )}
              {/* OVR badge */}
              {player && (
                <text x={x} y={y + 11} textAnchor="middle" dominantBaseline="middle"
                  fontSize="7.5" fontWeight="700" fill="rgba(255,255,255,0.85)" style={{ pointerEvents: 'none' }}>
                  {player.overallRating}
                </text>
              )}
              {/* Position label below circle */}
              <rect x={x - 22} y={y + 28} width={44} height={14} rx={5}
                fill={filled ? 'rgba(232,98,26,0.85)' : 'rgba(255,255,255,0.85)'} />
              <text x={x} y={y + 35} textAnchor="middle" dominantBaseline="middle"
                fontSize="8" fontWeight="800" fill={filled ? 'white' : '#E8621A'} style={{ pointerEvents: 'none' }}>
                {pos}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Player picker popover */}
      {openPos && (
        <PlayerPicker
          position={openPos}
          players={players}
          lineup={lineup}
          onAssign={onLineupChange}
          onClose={() => setOpenPos(null)}
          anchorPos={anchorPos}
        />
      )}
    </div>
  );
}

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

// ── Player Hover Card ─────────────────────────────────────────

function PlayerHoverCard({ player, x, y }) {
  if (!player) return null;
  return (
    <div style={{
      position: 'fixed', left: x + 16, top: y - 40, zIndex: 9999,
      background: 'var(--bg-card)', border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)', padding: '10px 14px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.18)', minWidth: 180,
      pointerEvents: 'none',
    }}>
      <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 4 }}>{player.name}</div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 6 }}>
        {player.position} · OVR {player.overallRating ?? player.overall ?? '?'}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>
          Fatigue {player.fatigue ?? 0}%
        </span>
        <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>
          Form {player.lastFormRating ?? 50}
        </span>
        {player.injuryStatus && player.injuryStatus !== 'healthy' && (
          <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            Injured
          </span>
        )}
      </div>
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

  // Compute team attribute averages for style recommendations
  const teamStyleStats = (() => {
    if (players.length === 0) return {};
    const avg = (keys) => {
      let sum = 0, n = 0;
      players.forEach(p => keys.forEach(k => { if (p.attributes?.[k] != null) { sum += p.attributes[k]; n++; } }));
      return n > 0 ? sum / n : 0;
    };
    const topOvr = players.reduce((max, p) => Math.max(max, p.overallRating || 0), 0);
    return {
      avgAgility:     avg(['agilityLateralSpeed']),
      avgStamina:     avg(['staminaEndurance', 'conditioningFitness']),
      avgIQ:          avg(['basketballIQ', 'courtVision']),
      avgPassing:     avg(['passingAccuracy']),
      avgCourtVision: avg(['courtVision']),
      avgPost:        avg(['postMoves', 'finishingAtTheRim']),
      topPlayerOvr:   topOvr,
    };
  })();

  const [tactics, setTactics] = useState({
    ...DEFAULT_TACTICS,
    ...savedTactics,
    selectedPlayers: savedTactics.selectedPlayers ?? [],
    startingFive: savedTactics.startingFive ?? [],
    lineup: savedTactics.lineup ?? { PG: null, SG: null, SF: null, PF: null, C: null },
    benchPlayers: savedTactics.benchPlayers ?? [],
    timeoutTriggers: savedTactics.timeoutTriggers ?? [],
  });
  const [saved, setSaved] = useState(false);
  const [hoverPlayer, setHoverPlayer] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

  // Keep tactics in sync if userTeam changes externally
  useEffect(() => {
    if (userTeam?.tactics) {
      setTactics(prev => ({ ...DEFAULT_TACTICS, ...userTeam.tactics, ...prev }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pre-game warning (15 min before kickoff) ─────────────────
  const nextMatch = (userTeam?.seasonMatches || []).find(m => !m.played);
  const minsToMatch = nextMatch
    ? Math.round((new Date(nextMatch.date || nextMatch.scheduledDate).getTime() - Date.now()) / 60000)
    : null;
  const lineupSet = Object.values(tactics.lineup || {}).filter(Boolean).length >= 5;
  const showPreGameWarning = minsToMatch !== null && minsToMatch <= 15 && minsToMatch >= -5;

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

  const handleLineupChange = (pos, playerId) => {
    setTactics(prev => {
      const newLineup = { ...prev.lineup, [pos]: playerId };
      // Derive startingFive and selectedPlayers from lineup + bench
      const starters = Object.values(newLineup).filter(Boolean);
      const selectedPlayers = [...new Set([...starters, ...prev.benchPlayers])];
      return { ...prev, lineup: newLineup, startingFive: starters, selectedPlayers };
    });
  };

  const toggleBench = (playerId) => {
    setTactics(prev => {
      const starters = Object.values(prev.lineup).filter(Boolean);
      if (starters.includes(playerId)) return prev; // can't bench a starter directly
      const inBench = prev.benchPlayers.includes(playerId);
      let benchPlayers;
      if (inBench) {
        benchPlayers = prev.benchPlayers.filter(id => id !== playerId);
      } else {
        if (prev.benchPlayers.length >= 7) return prev;
        benchPlayers = [...prev.benchPlayers, playerId];
      }
      const selectedPlayers = [...new Set([...starters, ...benchPlayers])];
      return { ...prev, benchPlayers, selectedPlayers };
    });
  };

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
    <div className="page-content animate-fade-in" style={{ paddingBottom: 80 }}>
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

      {/* ── Pre-game alert ─────────────────────────────────────── */}
      {showPreGameWarning && (
        <div style={{
          marginBottom: 'var(--space-5)',
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-lg)',
          background: lineupSet ? 'var(--color-success-light)' : '#fff3cd',
          border: `2px solid ${lineupSet ? 'var(--color-success)' : '#f59e0b'}`,
          display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
        }}>
          <span style={{ fontSize: '1.5rem' }}>{lineupSet ? '✅' : '⚠️'}</span>
          <div>
            <div style={{ fontWeight: 700, color: lineupSet ? 'var(--color-success)' : '#92400e', fontSize: 'var(--font-size-sm)' }}>
              {minsToMatch > 0
                ? `Match starts in ${minsToMatch} minute${minsToMatch !== 1 ? 's' : ''}!`
                : 'Match is starting now!'}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: lineupSet ? 'var(--color-success)' : '#b45309', marginTop: 2 }}>
              {lineupSet
                ? 'Lineup is set. Good luck!'
                : 'Lineup not fully set — the game will auto-select the best available 5 players if you don\'t save a lineup before kickoff.'}
            </div>
          </div>
        </div>
      )}

      {/* ── 1. Starting Lineup (Interactive Court) ─────────────── */}
      <div className="card mb-6">
        <SectionHeader
          icon={<Users size={18} />}
          title="Starting Lineup"
          subtitle="Click a position on the court to assign a player"
        />

        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
          <span className="badge badge-orange">
            {Object.values(tactics.lineup).filter(Boolean).length}/5 Starters set
          </span>
          <span className="badge badge-blue">
            {tactics.benchPlayers.length}/7 Bench players
          </span>
          {Object.values(tactics.lineup).filter(Boolean).length < 5 && (
            <span className="badge badge-red">Starting 5 incomplete</span>
          )}
        </div>

        {/* Court */}
        <CourtLineup
          players={players}
          lineup={tactics.lineup}
          onLineupChange={handleLineupChange}
          onPlayerHover={(player, x, y) => { setHoverPlayer(player); setHoverPos({ x, y }); }}
          onPlayerHoverMove={(x, y) => setHoverPos({ x, y })}
          onPlayerHoverLeave={() => setHoverPlayer(null)}
        />

        {/* Bench selection */}
        <div style={{ marginTop: 'var(--space-5)' }}>
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span>Bench Players</span>
            <span className="badge badge-gray">{tactics.benchPlayers.length}/7</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {players.map(player => {
              const isStarter = Object.values(tactics.lineup).includes(player.id);
              const isBench = tactics.benchPlayers.includes(player.id);
              const isInjured = player.injuryStatus && player.injuryStatus !== 'healthy';
              if (isStarter) return null;
              return (
                <button
                  key={player.id}
                  onClick={() => toggleBench(player.id)}
                  disabled={isInjured && !isBench}
                  onMouseEnter={(e) => { setHoverPlayer(player); setHoverPos({ x: e.clientX, y: e.clientY }); }}
                  onMouseMove={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoverPlayer(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                    padding: '6px 10px', borderRadius: 'var(--radius-md)',
                    border: isBench ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                    background: isBench ? 'var(--color-primary-100)' : 'var(--bg-muted)',
                    cursor: (isInjured && !isBench) ? 'not-allowed' : 'pointer',
                    opacity: isInjured ? 0.55 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: isBench ? 'var(--color-primary)' : 'var(--text-primary)' }}>
                    {player.name}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    {player.position} · {player.overallRating}
                  </span>
                  {isInjured && <span style={{ fontSize: '0.65rem', color: 'var(--color-danger)' }}>⚠</span>}
                </button>
              );
            })}
            {players.filter(p => !Object.values(tactics.lineup).includes(p.id)).length === 0 && (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>All players assigned as starters</span>
            )}
          </div>
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
            const isRecommended = style.recommendedWhen?.(teamStyleStats) ?? false;
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
                {isRecommended && !isActive && (
                  <div style={{ position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)' }}>
                    <span className="badge badge-green" style={{ fontSize: '0.6rem', fontWeight: 800 }}>★ Recommended</span>
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

      {/* Sticky save bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)',
        padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 -4px 12px rgba(0,0,0,0.08)'
      }}>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
          Lineup: {Object.values(tactics.lineup).filter(Boolean).length}/5 starters · Bench: {tactics.benchPlayers.length}/7
        </span>
        <button className={`btn ${saved ? 'btn-success' : 'btn-primary'}`} onClick={handleSave} disabled={saved}>
          {saved ? '✓ Saved!' : '💾 Save Tactics'}
        </button>
      </div>

      {/* Player hover card */}
      <PlayerHoverCard player={hoverPlayer} x={hoverPos.x} y={hoverPos.y} />
    </div>
  );
}
