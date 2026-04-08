import { useState, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext.jsx';
import { Users, Target, Shield, Zap, Settings, CheckCircle, X, Save } from 'lucide-react';
import { calculateOverallRating } from '../engine/playerGenerator.js';

// ── Constants ─────────────────────────────────────────────────

const TABS = [
  { id: 'lineup',   label: 'Lineup',   icon: '🏀' },
  { id: 'offense',  label: 'Offense',  icon: '⚡' },
  { id: 'defense',  label: 'Defense',  icon: '🛡️' },
  { id: 'advanced', label: 'Advanced', icon: '⚙️' },
];

// Position-specific key stats for hover card
const POS_STATS = {
  PG: [
    { key: 'courtVision',           label: 'Court Vision' },
    { key: 'ballHandlingDribbling', label: 'Ball Handling' },
    { key: 'passingAccuracy',       label: 'Passing' },
    { key: 'basketballIQ',          label: 'Basketball IQ' },
  ],
  SG: [
    { key: 'threePtShooting',  label: '3PT Shooting' },
    { key: 'midRangeScoring',  label: 'Mid-Range' },
    { key: 'offBallMovement',  label: 'Off-Ball Move' },
    { key: 'perimeterDefense', label: 'Perimeter Def' },
  ],
  SF: [
    { key: 'midRangeScoring',   label: 'Mid-Range' },
    { key: 'finishingAtTheRim', label: 'Finishing' },
    { key: 'perimeterDefense',  label: 'Perimeter Def' },
    { key: 'rebounding',        label: 'Rebounding' },
  ],
  PF: [
    { key: 'rebounding',        label: 'Rebounding' },
    { key: 'postMoves',         label: 'Post Moves' },
    { key: 'interiorDefense',   label: 'Interior Def' },
    { key: 'finishingAtTheRim', label: 'Finishing' },
  ],
  C: [
    { key: 'rebounding',        label: 'Rebounding' },
    { key: 'interiorDefense',   label: 'Interior Def' },
    { key: 'finishingAtTheRim', label: 'Finishing' },
    { key: 'settingScreens',    label: 'Screens' },
  ],
};

const PLAYING_STYLES = [
  { id: 'Pace & Space',       label: 'Pace & Space',       subtitle: 'High Tempo',        description: 'Maximizes possessions, 3-pointers, fast breaks',                                      icon: '⚡' },
  { id: 'Half-Court Sets',    label: 'Half-Court Sets',    subtitle: 'Low Tempo',         description: 'Methodical, structured plays, high-percentage shots',                                  icon: '🎯' },
  { id: 'Pick-and-Roll Focus',label: 'Pick-and-Roll Focus',subtitle: 'Two-Man Action',    description: 'Heavy reliance on two-man action',                                                     icon: '🔄' },
  { id: 'Post-Up Oriented',   label: 'Post-Up Oriented',   subtitle: 'Low Post Offense',  description: 'Offense through big men in the low post',                                              icon: '💪', recommendedWhen: s => (s.avgPost || 0) >= 65,    recommendLabel: 'Strong post players' },
  { id: 'Fast Break',         label: 'Fast Break',         subtitle: 'Transition Offense',description: 'Push in transition, exploit numbers advantages before defense sets',                   icon: '🏃', recommendedWhen: s => (s.avgAgility || 0) >= 65 && (s.avgStamina || 0) >= 60, recommendLabel: 'High agility & stamina' },
  { id: 'Triangle Offense',   label: 'Triangle Offense',   subtitle: 'Spacing & IQ',      description: 'Three-player triangles; emphasizes basketball IQ and spacing',                         icon: '🔺', recommendedWhen: s => (s.avgIQ || 0) >= 65,       recommendLabel: 'High basketball IQ' },
  { id: 'Isolation',          label: 'Isolation',          subtitle: 'Star-Driven',       description: 'Clear out and let your best scorer operate one-on-one',                               icon: '⭐', recommendedWhen: s => (s.topPlayerOvr || 0) >= 80, recommendLabel: 'Elite star player' },
  { id: 'Motion Offense',     label: 'Motion Offense',     subtitle: 'Read & React',      description: 'Continuous movement and cuts; team reads defense in real time',                        icon: '🌀', recommendedWhen: s => (s.avgPassing || 0) >= 62 && (s.avgCourtVision || 0) >= 60, recommendLabel: 'Good passing & vision' },
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

const PACE_CONTROLS   = ['Slow', 'Normal', 'Up-tempo'];
const ROTATION_DEPTHS = ['8-man', '10-man', '12-man'];
const CLOSEOUT_STRATS = ['Normal', 'Aggressive', 'Protect Lead'];

const DEFAULT_TACTICS = {
  playingStyle:     'Half-Court Sets',
  defenseType:      'Man-to-Man',
  pressFrequency:   'Medium',
  subStrategy:      'Flow Rotation',
  selectedPlayers:  [],
  startingFive:     [],
  lineup:           { PG: null, SG: null, SF: null, PF: null, C: null },
  benchPlayers:     [],
  timeoutTriggers:  [],
  injuryManagement: 'Balanced — standard rotation, monitor closely',
  paceControl:      'Normal',
  rotationDepth:    '10-man',
  closeoutStrategy: 'Normal',
  // New advanced tactics
  sevenSeconds:   false,
  shortSevenMan:  false,
  protectPaint:   false,
  crashGlass:     false,
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
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={i * 45} y={0} width={45} height={380} fill={i % 2 === 0 ? '#D4956A' : '#C8865A'} />
      ))}
      <rect x={145} y={210} width={110} height={145} fill="#B97A3D" fillOpacity={0.35} stroke="white" strokeWidth={2} />
      <path d="M 145 210 A 55 55 0 0 1 255 210" fill="none" stroke="white" strokeWidth={2} />
      <path d="M 145 210 A 55 55 0 0 0 255 210" fill="none" stroke="white" strokeWidth={2} strokeDasharray="6 5" />
      <line x1={42} y1={355} x2={42} y2={268} stroke="white" strokeWidth={2.5} />
      <line x1={358} y1={355} x2={358} y2={268} stroke="white" strokeWidth={2.5} />
      <path d="M 42 268 A 176 176 0 1 0 358 268" fill="none" stroke="white" strokeWidth={2.5} />
      <path d="M 175 355 A 25 25 0 0 1 225 355" fill="none" stroke="white" strokeWidth={1.5} strokeDasharray="5 4" />
      <circle cx={200} cy={338} r={16} fill="#D07010" stroke="white" strokeWidth={2.5} />
      <circle cx={200} cy={338} r={9} fill="none" stroke="white" strokeWidth={2} />
      <rect x={168} y={356} width={64} height={7} rx={2} fill="#2D3748" />
      <rect x={197} y={363} width={6} height={12} rx={1} fill="#718096" />
    </>
  );
}

// ── Player Picker Popover ────────────────────────────────────

function PlayerPicker({ position, players, lineup, onAssign, onClose, anchorPos, calcOvr }) {
  const assignedIds = new Set(Object.values(lineup).filter(Boolean));
  const available = players.filter(p => !assignedIds.has(p.id) || lineup[position] === p.id);

  return (
    <div style={{
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
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
        <span style={{ fontWeight: 800, fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)' }}>Assign {position}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
          <X size={14} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>
      {lineup[position] && (
        <button onClick={() => { onAssign(position, null); onClose(); }} style={{
          width: '100%', marginBottom: 'var(--space-2)', padding: '6px 10px',
          borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)',
          background: 'var(--bg-muted)', cursor: 'pointer', fontSize: 'var(--font-size-xs)',
          color: 'var(--color-danger)', fontWeight: 700, textAlign: 'left',
        }}>✕ Remove player</button>
      )}
      {available.length === 0 ? (
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', padding: 'var(--space-2)' }}>No available players</div>
      ) : available.map(p => {
        const isSelected = lineup[position] === p.id;
        const isInjured = p.injuryStatus && p.injuryStatus !== 'healthy';
        return (
          <button key={p.id} onClick={() => { onAssign(position, p.id); onClose(); }} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            padding: '7px 10px', borderRadius: 'var(--radius-md)',
            border: isSelected ? '2px solid var(--color-primary)' : '1px solid transparent',
            background: isSelected ? 'var(--color-primary-100)' : 'transparent',
            cursor: 'pointer', marginBottom: 3, textAlign: 'left', opacity: isInjured ? 0.5 : 1,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: 'var(--color-primary)',
              color: 'white', fontWeight: 800, fontSize: '0.65rem', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {p.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                {p.position} · OVR {calcOvr(p)}
                {isInjured && <span style={{ color: 'var(--color-danger)', marginLeft: 4 }}>⚠ Injured</span>}
              </div>
            </div>
            {isSelected && <CheckCircle size={13} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />}
          </button>
        );
      })}
    </div>
  );
}

// ── Interactive Court Lineup ─────────────────────────────────

function CourtLineup({ players, lineup, onLineupChange, onPlayerHover, onPlayerHoverMove, onPlayerHoverLeave, calcOvr }) {
  const [openPos, setOpenPos] = useState(null);
  const [anchorPos, setAnchorPos] = useState({ x: 0, y: 0 });
  const courtRef = useRef(null);

  const handlePositionClick = (pos, svgX, svgY) => {
    if (openPos === pos) { setOpenPos(null); return; }
    const scaleX = (courtRef.current?.clientWidth || 400) / 400;
    const scaleY = (courtRef.current?.clientHeight || 380) / 380;
    setAnchorPos({ x: svgX * scaleX - 110, y: svgY * scaleY });
    setOpenPos(pos);
  };

  return (
    <div ref={courtRef} style={{ position: 'relative', userSelect: 'none' }}>
      <svg viewBox="0 0 400 380" style={{ width: '100%', maxWidth: 480, display: 'block', margin: '0 auto', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <BasketballCourtSVG />
        {COURT_POSITIONS.map(({ pos, label, x, y }) => {
          const assignedId = lineup[pos];
          const player = assignedId ? players.find(p => p.id === assignedId) : null;
          const isOpen = openPos === pos;
          const filled = !!player;
          return (
            <g key={pos} style={{ cursor: 'pointer' }}
              onClick={() => handlePositionClick(pos, x, y)}
              onMouseEnter={player ? (e) => { onPlayerHover && onPlayerHover(player, e.clientX, e.clientY); } : undefined}
              onMouseMove={player ? (e) => { onPlayerHoverMove && onPlayerHoverMove(e.clientX, e.clientY); } : undefined}
              onMouseLeave={player ? () => { onPlayerHoverLeave && onPlayerHoverLeave(); } : undefined}
            >
              {isOpen && <circle cx={x} cy={y} r={32} fill="rgba(232,98,26,0.18)" stroke="var(--color-primary)" strokeWidth={2.5} />}
              <circle cx={x} cy={y} r={24} fill={filled ? '#E8621A' : 'rgba(255,255,255,0.92)'} stroke={filled ? 'white' : '#E8621A'} strokeWidth={2.5} />
              {player ? (
                <text x={x} y={y - 2} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="900" fill="white" style={{ pointerEvents: 'none' }}>
                  {player.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                </text>
              ) : (
                <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="18" fontWeight="700" fill="#E8621A" style={{ pointerEvents: 'none' }}>+</text>
              )}
              {player && (
                <text x={x} y={y + 11} textAnchor="middle" dominantBaseline="middle" fontSize="7.5" fontWeight="700" fill="rgba(255,255,255,0.85)" style={{ pointerEvents: 'none' }}>
                  {calcOvr(player)}
                </text>
              )}
              <rect x={x - 22} y={y + 28} width={44} height={14} rx={5} fill={filled ? 'rgba(232,98,26,0.85)' : 'rgba(255,255,255,0.85)'} />
              <text x={x} y={y + 35} textAnchor="middle" dominantBaseline="middle" fontSize="8" fontWeight="800" fill={filled ? 'white' : '#E8621A'} style={{ pointerEvents: 'none' }}>
                {pos}
              </text>
            </g>
          );
        })}
      </svg>
      {openPos && (
        <PlayerPicker
          position={openPos} players={players} lineup={lineup}
          onAssign={onLineupChange} onClose={() => setOpenPos(null)}
          anchorPos={anchorPos} calcOvr={calcOvr}
        />
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────

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
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--border-color)' }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 'var(--radius-full)', background: 'var(--color-primary-100)', color: 'var(--color-primary)', flexShrink: 0 }}>
        {icon}
      </span>
      <div>
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, margin: 0 }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', margin: 0 }}>{subtitle}</p>}
      </div>
    </div>
  );
}

function SuccessToast({ message, onClose }) {
  return (
    <div className="toast success animate-slide-in" style={{ position: 'fixed', bottom: 'var(--space-6)', right: 'var(--space-6)', zIndex: 300 }}>
      <CheckCircle size={18} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
      <span style={{ fontWeight: 600 }}>{message}</span>
      <button onClick={onClose} style={{ marginLeft: 'auto', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>✕</button>
    </div>
  );
}

// ── Enhanced Player Hover Card ────────────────────────────────

function PlayerHoverCard({ player, x, y, calcOvr }) {
  if (!player) return null;
  const pos = player.position;
  const posStats = POS_STATS[pos] || POS_STATS['SF'];
  const ovr = calcOvr(player);

  return (
    <div style={{
      position: 'fixed', left: x + 16, top: Math.max(10, y - 80), zIndex: 9999,
      background: 'var(--bg-card)', border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)', padding: '12px 14px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.18)', minWidth: 210,
      pointerEvents: 'none',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%', background: 'var(--color-primary)',
          color: 'white', fontWeight: 800, fontSize: '0.7rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {player.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>{player.name}</div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {pos} · OVR <strong style={{ color: 'var(--color-primary)' }}>{ovr}</strong>
          </div>
        </div>
      </div>
      {/* Status badges */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: 'var(--radius-full)', background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>
          Fatigue {player.fatigue ?? 0}%
        </span>
        <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: 'var(--radius-full)', background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>
          Form {player.lastFormRating ?? 50}
        </span>
        {player.injuryStatus && player.injuryStatus !== 'healthy' && (
          <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: 'var(--radius-full)', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 700 }}>
            ⚠ {player.injuryStatus}
          </span>
        )}
      </div>
      {/* Position-specific key stats */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 8 }}>
        <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          Key Stats · {pos}
        </div>
        {posStats.map(({ key, label }) => {
          const val = player.attributes?.[key] ?? 50;
          const color = val >= 75 ? '#22c55e' : val >= 55 ? 'var(--color-primary)' : '#ef4444';
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', width: 72, flexShrink: 0 }}>{label}</span>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--bg-muted)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${val}%`, background: color, borderRadius: 2, transition: 'width 0.2s' }} />
              </div>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color, width: 22, textAlign: 'right' }}>{val}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Advanced Tactic Toggle ────────────────────────────────────

function AdvancedTacticToggle({ value, onChange, title, icon, tagline, benefit, secondary, requirementMet, requirementNote, disabled }) {
  return (
    <div style={{
      border: `2px solid ${value ? 'var(--color-primary)' : 'var(--border-card)'}`,
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-4)',
      background: value ? 'var(--color-primary-100)' : 'var(--bg-card)',
      transition: 'all 0.15s',
      opacity: disabled ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.4rem' }}>{icon}</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 'var(--font-size-sm)' }}>{title}</div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 600 }}>{tagline}</div>
          </div>
        </div>
        <button
          onClick={() => !disabled && onChange(!value)}
          style={{
            flexShrink: 0,
            width: 44, height: 24, borderRadius: 12,
            background: value ? 'var(--color-primary)' : 'var(--border-color)',
            border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
            position: 'relative', transition: 'background 0.2s',
          }}
        >
          <div style={{
            position: 'absolute', top: 2, left: value ? 22 : 2,
            width: 20, height: 20, borderRadius: '50%', background: 'white',
            transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }} />
        </button>
      </div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: 6 }}>{benefit}</div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: '#b45309', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 'var(--radius-md)', padding: '4px 8px', marginBottom: requirementNote ? 6 : 0 }}>
        ⚠ {secondary}
      </div>
      {requirementNote && (
        <div style={{ fontSize: 'var(--font-size-xs)', color: requirementMet ? '#22c55e' : 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>
          {requirementMet ? '✓' : '○'} Requires: {requirementNote}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export default function Tactics() {
  const { state, dispatch, addNotification } = useGame();
  const { userTeam } = state;

  const savedTactics  = userTeam?.tactics ?? {};
  const players       = userTeam?.players ?? [];
  const headCoach     = userTeam?.staff?.headCoach ?? null;

  function calcOvr(player) {
    if (player?.overallRating) return player.overallRating;
    try { return calculateOverallRating(player); } catch { return 50; }
  }

  // Team attribute averages for style recommendations
  const teamStyleStats = (() => {
    if (players.length === 0) return {};
    const avg = (keys) => {
      let sum = 0, n = 0;
      players.forEach(p => keys.forEach(k => { if (p.attributes?.[k] != null) { sum += p.attributes[k]; n++; } }));
      return n > 0 ? sum / n : 0;
    };
    return {
      avgAgility:     avg(['agilityLateralSpeed']),
      avgStamina:     avg(['staminaEndurance', 'conditioningFitness']),
      avgIQ:          avg(['basketballIQ', 'courtVision']),
      avgPassing:     avg(['passingAccuracy']),
      avgCourtVision: avg(['courtVision']),
      avgPost:        avg(['postMoves', 'finishingAtTheRim']),
      avgRebounding:  avg(['rebounding']),
      topPlayerOvr:   players.reduce((max, p) => Math.max(max, calcOvr(p) || 0), 0),
    };
  })();

  const [tactics, setTactics] = useState({
    ...DEFAULT_TACTICS,
    ...savedTactics,
    selectedPlayers: savedTactics.selectedPlayers ?? [],
    startingFive:    savedTactics.startingFive ?? [],
    lineup:          savedTactics.lineup ?? { PG: null, SG: null, SF: null, PF: null, C: null },
    benchPlayers:    savedTactics.benchPlayers ?? [],
    timeoutTriggers: savedTactics.timeoutTriggers ?? [],
  });

  const [saved, setSaved]             = useState(false);
  const [activeTab, setActiveTab]     = useState('lineup');
  const [hoverPlayer, setHoverPlayer] = useState(null);
  const [hoverPos, setHoverPos]       = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (userTeam?.tactics) {
      setTactics(prev => ({ ...DEFAULT_TACTICS, ...userTeam.tactics, ...prev }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-game warning
  const nextMatch      = (userTeam?.seasonMatches || []).find(m => !m.played);
  const minsToMatch    = nextMatch ? Math.round((new Date(nextMatch.date || nextMatch.scheduledDate).getTime() - Date.now()) / 60000) : null;
  const lineupSet      = Object.values(tactics.lineup || {}).filter(Boolean).length >= 5;
  const showPreGame    = minsToMatch !== null && minsToMatch <= 15 && minsToMatch >= -5;

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

  const setTactic = (key, val) => setTactics(prev => ({ ...prev, [key]: val }));

  const handleLineupChange = (pos, playerId) => {
    setTactics(prev => {
      const newLineup = { ...prev.lineup, [pos]: playerId };
      const starters  = Object.values(newLineup).filter(Boolean);
      return { ...prev, lineup: newLineup, startingFive: starters, selectedPlayers: [...new Set([...starters, ...prev.benchPlayers])] };
    });
  };

  const toggleBench = (playerId) => {
    setTactics(prev => {
      const starters = Object.values(prev.lineup).filter(Boolean);
      if (starters.includes(playerId)) return prev;
      const inBench  = prev.benchPlayers.includes(playerId);
      const benchPlayers = inBench ? prev.benchPlayers.filter(id => id !== playerId) : prev.benchPlayers.length >= 7 ? prev.benchPlayers : [...prev.benchPlayers, playerId];
      return { ...prev, benchPlayers, selectedPlayers: [...new Set([...starters, ...benchPlayers])] };
    });
  };

  const toggleTimeoutTrigger = (trigger) => {
    setTactics(prev => ({
      ...prev,
      timeoutTriggers: prev.timeoutTriggers.includes(trigger)
        ? prev.timeoutTriggers.filter(t => t !== trigger)
        : [...prev.timeoutTriggers, trigger],
    }));
  };

  const handleAutoLineup = () => {
    const positions  = ['PG', 'SG', 'SF', 'PF', 'C'];
    const newLineup  = { PG: null, SG: null, SF: null, PF: null, C: null };
    const usedIds    = new Set();

    // First pass: exact position match
    for (const pos of positions) {
      const candidates = players
        .filter(p => p.position === pos && (!p.injuryStatus || p.injuryStatus === 'healthy' || p.injuryStatus === 'minor') && !usedIds.has(p.id))
        .sort((a, b) => calcOvr(b) - calcOvr(a));
      if (candidates.length > 0) {
        newLineup[pos] = candidates[0].id;
        usedIds.add(candidates[0].id);
      }
    }

    // Second pass: fill remaining from any available player
    for (const pos of positions) {
      if (!newLineup[pos]) {
        const candidates = players
          .filter(p => !usedIds.has(p.id) && (!p.injuryStatus || p.injuryStatus === 'healthy' || p.injuryStatus === 'minor'))
          .sort((a, b) => calcOvr(b) - calcOvr(a));
        if (candidates.length > 0) {
          newLineup[pos] = candidates[0].id;
          usedIds.add(candidates[0].id);
        }
      }
    }

    const starters = Object.values(newLineup).filter(Boolean);
    setTactics(prev => ({ ...prev, lineup: newLineup, startingFive: starters, selectedPlayers: [...new Set([...starters, ...prev.benchPlayers])] }));
    addNotification('Auto-lineup set to best available players!', 'success');
  };

  const handleSave = () => {
    dispatch({ type: 'UPDATE_TEAM', payload: { ...userTeam, tactics } });
    setSaved(true);
    addNotification('Tactics saved successfully!', 'success');
    setTimeout(() => setSaved(false), 4000);
  };

  // ── Team requirement checks ──────────────────────────────────

  const avgStamina    = teamStyleStats.avgStamina ?? 50;
  const avgRebounding = teamStyleStats.avgRebounding ?? 50;
  const hasPaintDef   = players.some(p =>
    (p.position === 'C' || p.position === 'PF') &&
    ((p.attributes?.interiorDefense ?? 0) >= 65 || (p.attributes?.rebounding ?? 0) >= 65)
  );

  // ── Tab content renderers ────────────────────────────────────

  const renderLineup = () => (
    <div className="card">
      <SectionHeader icon={<Users size={18} />} title="Starting Lineup" subtitle="Click a position on the court to assign a player" />

      {/* Pre-game warning */}
      {showPreGame && (
        <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-lg)', background: lineupSet ? 'var(--color-success-light)' : '#fff3cd', border: `2px solid ${lineupSet ? 'var(--color-success)' : '#f59e0b'}`, display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span style={{ fontSize: '1.3rem' }}>{lineupSet ? '✅' : '⚠️'}</span>
          <div>
            <div style={{ fontWeight: 700, color: lineupSet ? 'var(--color-success)' : '#92400e', fontSize: 'var(--font-size-sm)' }}>
              {minsToMatch > 0 ? `Match starts in ${minsToMatch} minute${minsToMatch !== 1 ? 's' : ''}!` : 'Match is starting now!'}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: lineupSet ? 'var(--color-success)' : '#b45309', marginTop: 2 }}>
              {lineupSet ? 'Lineup is set. Good luck!' : "Lineup incomplete — the game will auto-select the best available 5 if you don't save before kickoff."}
            </div>
          </div>
        </div>
      )}

      {/* Status + Auto-lineup */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="badge badge-orange">{Object.values(tactics.lineup).filter(Boolean).length}/5 Starters set</span>
        <span className="badge badge-blue">{tactics.benchPlayers.length}/7 Bench players</span>
        {Object.values(tactics.lineup).filter(Boolean).length < 5 && <span className="badge badge-red">Starting 5 incomplete</span>}
        <button className="btn btn-ghost btn-sm" onClick={handleAutoLineup} style={{ marginLeft: 'auto' }}>
          🤖 Auto Lineup
        </button>
      </div>

      {/* Court */}
      <CourtLineup
        players={players} lineup={tactics.lineup}
        onLineupChange={handleLineupChange}
        onPlayerHover={(p, x, y) => { setHoverPlayer(p); setHoverPos({ x, y }); }}
        onPlayerHoverMove={(x, y) => setHoverPos({ x, y })}
        onPlayerHoverLeave={() => setHoverPlayer(null)}
        calcOvr={calcOvr}
      />

      {/* Bench */}
      <div style={{ marginTop: 'var(--space-5)' }}>
        <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span>Bench Players</span>
          <span className="badge badge-gray">{tactics.benchPlayers.length}/7</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {players.map(player => {
            const isStarter = Object.values(tactics.lineup).includes(player.id);
            const isBench   = tactics.benchPlayers.includes(player.id);
            const isInjured = player.injuryStatus && player.injuryStatus !== 'healthy';
            if (isStarter) return null;
            return (
              <button key={player.id} onClick={() => toggleBench(player.id)}
                disabled={isInjured && !isBench}
                onMouseEnter={e => { setHoverPlayer(player); setHoverPos({ x: e.clientX, y: e.clientY }); }}
                onMouseMove={e => setHoverPos({ x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHoverPlayer(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                  padding: '6px 10px', borderRadius: 'var(--radius-md)',
                  border: isBench ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                  background: isBench ? 'var(--color-primary-100)' : 'var(--bg-muted)',
                  cursor: (isInjured && !isBench) ? 'not-allowed' : 'pointer',
                  opacity: isInjured ? 0.55 : 1, transition: 'all 0.15s',
                }}>
                <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: isBench ? 'var(--color-primary)' : 'var(--text-primary)' }}>{player.name}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{player.position} · {calcOvr(player)}</span>
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
  );

  const renderOffense = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Playing Style */}
      <div className="card">
        <SectionHeader icon={<Zap size={18} />} title="Core Playing Style" subtitle="Choose your offensive philosophy" />
        <div className="grid-2" style={{ gap: 'var(--space-3)' }}>
          {PLAYING_STYLES.map((style, idx) => {
            const score         = getTacticalScore(headCoach, idx);
            const isActive      = tactics.playingStyle === style.id;
            const isRecommended = style.recommendedWhen?.(teamStyleStats) ?? false;
            return (
              <div key={style.id} onClick={() => setTactic('playingStyle', style.id)} style={{
                border: `2px solid ${isActive ? 'var(--color-primary)' : 'var(--border-card)'}`,
                borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', cursor: 'pointer',
                background: isActive ? 'var(--color-primary-100)' : 'var(--bg-card)',
                transition: 'all var(--transition-fast)', position: 'relative',
              }}>
                {isActive      && <div style={{ position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)' }}><CheckCircle size={18} style={{ color: 'var(--color-primary)' }} /></div>}
                {isRecommended && !isActive && <div style={{ position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)' }}><span className="badge badge-green" style={{ fontSize: '0.6rem', fontWeight: 800 }}>★ Recommended</span></div>}
                <div style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>{style.icon}</div>
                <div style={{ fontWeight: 800, fontSize: 'var(--font-size-base)', marginBottom: 2 }}>{style.label}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>{style.subtitle}</div>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>{style.description}</p>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                    <span>Tactical Effectiveness</span>
                    <span style={{ color: score >= 75 ? 'var(--color-success)' : score >= 55 ? 'var(--color-warning)' : 'var(--color-danger)', fontWeight: 800 }}>{score}%</span>
                  </div>
                  <div className="progress-bar-track">
                    <div className={`progress-bar-fill ${score >= 75 ? 'success' : score >= 55 ? 'warning' : 'danger'}`} style={{ width: `${score}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {headCoach && (
          <p style={{ marginTop: 'var(--space-3)', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Effectiveness based on Head Coach <strong>{headCoach.name}</strong>'s ability rating.
          </p>
        )}
        {(() => {
          const activeStyle  = PLAYING_STYLES.find(s => s.id === tactics.playingStyle);
          const isRecommended = activeStyle?.recommendedWhen?.(teamStyleStats) ?? null;
          if (isRecommended === false) {
            return (
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.4)', fontSize: 'var(--font-size-sm)', color: '#b45309', fontWeight: 600 }}>
                ⚠️ This style doesn't fit your squad — requires: {activeStyle?.recommendLabel}. Match effectiveness may be reduced.
              </div>
            );
          }
          return null;
        })()}
      </div>

      {/* Pace Control + Seven Seconds */}
      <div className="card">
        <SectionHeader icon={<Zap size={18} />} title="Pace Control" subtitle="Set how fast your team plays" />
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          {PACE_CONTROLS.map(p => (
            <button key={p} onClick={() => setTactic('paceControl', p)} className={`btn btn-sm ${tactics.paceControl === p ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }}>{p}</button>
          ))}
        </div>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
          {tactics.paceControl === 'Up-tempo' && '⚡ More possessions — attack ×1.05, slightly tiring'}
          {tactics.paceControl === 'Slow' && '🐢 Fewer possessions — attack ×0.95, saves stamina'}
          {tactics.paceControl === 'Normal' && 'Standard possession rate'}
        </p>
        <AdvancedTacticToggle
          value={tactics.sevenSeconds}
          onChange={v => setTactic('sevenSeconds', v)}
          title="Seven Seconds or Less"
          icon="⚡"
          tagline="Extreme Up-Tempo"
          benefit="Maximum possessions every trip down the court. Attack factor ×1.12 and fast-break frequency spikes. Best suited for athletic, high-stamina rosters."
          secondary="Defense rating −12%. 4th-quarter fade risk if avg stamina < 65 — starters gas out in crunch time."
          requirementMet={avgStamina >= 65}
          requirementNote={`Avg Stamina ≥ 65 (yours: ${Math.round(avgStamina)})`}
        />
      </div>
    </div>
  );

  const renderDefense = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Defensive Scheme + Press */}
      <div className="card">
        <SectionHeader icon={<Shield size={18} />} title="Defensive Style" subtitle="Configure your defensive scheme and press frequency" />
        <div className="grid-2" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="form-group">
            <label className="form-label">Defensive Scheme</label>
            <select className="form-select" value={tactics.defenseType} onChange={e => setTactic('defenseType', e.target.value)}>
              {DEFENSE_TYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
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
                <button key={freq} onClick={() => setTactic('pressFrequency', freq)} className={`btn btn-sm ${tactics.pressFrequency === freq ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }}>{freq}</button>
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

      {/* Closeout Strategy + Protect the Paint */}
      <div className="card">
        <SectionHeader icon={<Shield size={18} />} title="Closeout Strategy" subtitle="How aggressively your defenders close out on shooters" />
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          {CLOSEOUT_STRATS.map(s => (
            <button key={s} onClick={() => setTactic('closeoutStrategy', s)} className={`btn btn-sm ${tactics.closeoutStrategy === s ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }}>{s}</button>
          ))}
        </div>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
          {tactics.closeoutStrategy === 'Aggressive' && '🛡️ Defense ×1.06 — risks more fouls'}
          {tactics.closeoutStrategy === 'Protect Lead' && '🔒 Defense ×1.03 — conservative when ahead'}
          {tactics.closeoutStrategy === 'Normal' && 'Standard closeout discipline'}
        </p>
        <AdvancedTacticToggle
          value={tactics.protectPaint}
          onChange={v => setTactic('protectPaint', v)}
          title="Protect the Paint"
          icon="🏛️"
          tagline="Interior Defense Boost"
          benefit="Pack the paint with your big men. Interior defense factor ×1.10, forces opponents to shoot from the perimeter."
          secondary="Concedes open 3-point looks — opponent 3PT% increases by ~15%. Works best against poor outside shooting teams."
          requirementMet={hasPaintDef}
          requirementNote="C or PF with Interior Defense or Rebounding ≥ 65"
        />
      </div>

      {/* Substitution & Timeouts */}
      <div className="card">
        <SectionHeader icon={<Target size={18} />} title="Substitution & Timeouts" subtitle="Control rotation and timeout calling" />
        <div className="grid-2">
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-3)' }}>Rotation Type</label>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {['Fixed Rotation', 'Flow Rotation'].map(opt => (
                <button key={opt} onClick={() => setTactic('subStrategy', opt)} className={`btn ${tactics.subStrategy === opt ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }}>{opt}</button>
              ))}
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>
              {tactics.subStrategy === 'Fixed Rotation' ? 'Players substituted on a pre-set schedule regardless of form or foul trouble.' : 'Substitutions adapt to game flow, fatigue levels, and foul situations.'}
            </p>
          </div>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>Timeout Triggers</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {TIMEOUT_TRIGGERS.map(trigger => (
                <label key={trigger} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={tactics.timeoutTriggers.includes(trigger)} onChange={() => toggleTimeoutTrigger(trigger)} style={{ accentColor: 'var(--color-primary)', width: 15, height: 15 }} />
                  {trigger}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAdvanced = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Rotation Depth + Short 7-Man */}
      <div className="card">
        <SectionHeader icon={<Settings size={18} />} title="Rotation Depth" subtitle="How many players see meaningful minutes" />
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          {ROTATION_DEPTHS.map(r => (
            <button key={r} onClick={() => setTactic('rotationDepth', r)} className={`btn btn-sm ${tactics.rotationDepth === r ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }}>{r}</button>
          ))}
        </div>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
          {tactics.rotationDepth === '8-man' && 'Shorter bench — starters play more, higher fatigue'}
          {tactics.rotationDepth === '10-man' && 'Balanced rotation'}
          {tactics.rotationDepth === '12-man' && 'Deep bench — fresher legs, less concentrated talent'}
        </p>
        <AdvancedTacticToggle
          value={tactics.shortSevenMan}
          onChange={v => setTactic('shortSevenMan', v)}
          title="Short 7-Man Rotation"
          icon="7️⃣"
          tagline="Max Starter Minutes"
          benefit="Your top 7 players absorb nearly all minutes. Starters play 36+ min, maximizing the talent gap over opponents."
          secondary="Injury risk rises significantly over long stretches. Bench morale drops — reserves feel undervalued."
        />
      </div>

      {/* Crash the Glass */}
      <div className="card">
        <SectionHeader icon={<Settings size={18} />} title="Rebound Strategy" subtitle="Control how aggressively your team pursues boards" />
        <AdvancedTacticToggle
          value={tactics.crashGlass}
          onChange={v => setTactic('crashGlass', v)}
          title="Crash the Glass"
          icon="💥"
          tagline="Offensive Rebounding Blitz"
          benefit="Commit extra players to the offensive glass every possession. Second-chance points increase and opponents are put under constant pressure."
          secondary="Transition defense weakens — opponents get easy fast-break points when the shot goes in."
          requirementMet={avgRebounding >= 65}
          requirementNote={`Avg Rebounding ≥ 65 (yours: ${Math.round(avgRebounding)})`}
        />
      </div>

      {/* Injury Management */}
      <div className="card">
        <SectionHeader icon={<Settings size={18} />} title="Injury Management" subtitle="How aggressively you push players through fatigue and minor injuries" />
        <div className="form-group" style={{ maxWidth: 480 }}>
          <label className="form-label">Management Approach</label>
          <select className="form-select" value={tactics.injuryManagement ?? INJURY_MANAGEMENT_OPTIONS[1]} onChange={e => setTactic('injuryManagement', e.target.value)}>
            {INJURY_MANAGEMENT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--color-warning-light)', border: '1px solid var(--color-warning)', fontSize: 'var(--font-size-sm)', color: 'var(--color-warning)', fontWeight: 600 }}>
          ⚠ Aggressive management increases injury risk. Conservative management may reduce player minutes.
        </div>
      </div>
    </div>
  );

  // ── Main Render ──────────────────────────────────────────────

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

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 'var(--space-5)', borderBottom: '2px solid var(--border-color)', paddingBottom: 0 }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 18px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 800 : 500,
              fontSize: 'var(--font-size-sm)',
              color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--text-muted)',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: -2,
              transition: 'all 0.15s',
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'lineup'   && renderLineup()}
      {activeTab === 'offense'  && renderOffense()}
      {activeTab === 'defense'  && renderDefense()}
      {activeTab === 'advanced' && renderAdvanced()}

      {saved && <SuccessToast message="Tactics saved successfully!" onClose={() => setSaved(false)} />}

      {/* Sticky save bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)',
        padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 -4px 12px rgba(0,0,0,0.08)',
      }}>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
          Lineup: {Object.values(tactics.lineup).filter(Boolean).length}/5 starters · Bench: {tactics.benchPlayers.length}/7
        </span>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button className="btn btn-ghost" onClick={() => setTactics({ ...DEFAULT_TACTICS, ...userTeam?.tactics })}>Reset</button>
          <button className={`btn ${saved ? 'btn-success' : 'btn-primary'}`} onClick={handleSave} disabled={saved}>
            {saved ? '✓ Saved!' : '💾 Save Tactics'}
          </button>
        </div>
      </div>

      {/* Player hover card */}
      <PlayerHoverCard player={hoverPlayer} x={hoverPos.x} y={hoverPos.y} calcOvr={calcOvr} />
    </div>
  );
}
