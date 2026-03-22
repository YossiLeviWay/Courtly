import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../context/GameContext.jsx';
import AttrBar from '../components/ui/AttrBar.jsx';
import PlayerAvatar from '../components/ui/PlayerAvatar.jsx';

// ── Nationality flag map ───────────────────────────────────────

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

// ── Attribute display name map (camelCase key → display label) ─

const ATTR_LABELS = {
  courtVision: 'Court Vision',
  perimeterDefense: 'Perimeter Defense',
  interiorDefense: 'Interior Defense',
  offBallMovement: 'Off-Ball Movement',
  rebounding: 'Rebounding',
  freeThrowShooting: 'Free Throw Shooting',
  clutchPerformance: 'Clutch Performance',
  staminaEndurance: 'Stamina/Endurance',
  leadershipCommunication: 'Leadership/Communication',
  postMoves: 'Post Moves',
  threePtShooting: '3-Point Shooting',
  midRangeScoring: 'Mid-Range Scoring',
  ballHandlingDribbling: 'Ball Handling/Dribbling',
  passingAccuracy: 'Passing Accuracy',
  basketballIQ: 'Basketball IQ',
  aggressivenessOffensive: 'Aggressiveness (Offensive)',
  helpDefense: 'Help Defense',
  onBallScreenNavigation: 'On-Ball Screen Navigation',
  conditioningFitness: 'Conditioning/Fitness',
  patienceOffense: 'Patience (Offense)',
  disciplineFouling: 'Discipline (Fouling)',
  handlePressureMental: 'Handle Pressure (Mental)',
  verticalLeapingAbility: 'Vertical/Leaping Ability',
  agilityLateralSpeed: 'Agility/Lateral Speed',
  settingScreens: 'Setting Screens',
  finishingAtTheRim: 'Finishing at the Rim',
  consistencyPerformance: 'Consistency (Performance)',
  workEthicOutOfGame: 'Work Ethic (Out of Game)',
  teamFirstAttitude: 'Team-First Attitude',
  bodyControl: 'Body Control',
};

// ── Attribute columns ──────────────────────────────────────────

const ATTR_COLUMNS = [
  [
    'courtVision',
    'perimeterDefense',
    'interiorDefense',
    'offBallMovement',
    'rebounding',
    'freeThrowShooting',
    'clutchPerformance',
    'staminaEndurance',
    'leadershipCommunication',
    'postMoves',
  ],
  [
    'threePtShooting',
    'midRangeScoring',
    'ballHandlingDribbling',
    'passingAccuracy',
    'basketballIQ',
    'aggressivenessOffensive',
    'helpDefense',
    'onBallScreenNavigation',
    'conditioningFitness',
    'patienceOffense',
  ],
  [
    'disciplineFouling',
    'handlePressureMental',
    'verticalLeapingAbility',
    'agilityLateralSpeed',
    'settingScreens',
    'finishingAtTheRim',
    'consistencyPerformance',
    'workEthicOutOfGame',
    'teamFirstAttitude',
    'bodyControl',
  ],
];

// ── Per-game stats helper ──────────────────────────────────────

function getPlayerStats(player) {
  const s = player.seasonStats || {};
  const gp = s.gamesPlayed || 1;
  return {
    pts: (s.points / gp).toFixed(1),
    ast: (s.assists / gp).toFixed(1),
    reb: (s.rebounds / gp).toFixed(1),
    stl: (s.steals / gp).toFixed(1),
    blk: (s.blocks / gp).toFixed(1),
    fgPct: s.fgAttempts > 0 ? ((s.fgMade / s.fgAttempts) * 100).toFixed(1) : '0.0',
    threePct: s.threePtAttempts > 0 ? ((s.threePtMade / s.threePtAttempts) * 100).toFixed(1) : '0.0',
    ftPct: s.ftAttempts > 0 ? ((s.ftMade / s.ftAttempts) * 100).toFixed(1) : '0.0',
    gamesPlayed: s.gamesPlayed || 0,
  };
}

// ── Radar Chart ────────────────────────────────────────────────

const RADAR_AXES = [
  {
    key: 'offense',
    label: 'Offense',
    keys: ['finishingAtTheRim', 'midRangeScoring', 'postMoves', 'aggressivenessOffensive', 'offBallMovement'],
    color: '#E8621A',
  },
  {
    key: 'shooting',
    label: 'Shooting',
    keys: ['threePtShooting', 'freeThrowShooting', 'consistencyPerformance', 'midRangeScoring'],
    color: '#3B82F6',
  },
  {
    key: 'playmaking',
    label: 'Playmaking',
    keys: ['courtVision', 'passingAccuracy', 'ballHandlingDribbling', 'basketballIQ', 'patienceOffense'],
    color: '#10B981',
  },
  {
    key: 'defense',
    label: 'Defense',
    keys: ['perimeterDefense', 'interiorDefense', 'helpDefense', 'onBallScreenNavigation', 'disciplineFouling'],
    color: '#EF4444',
  },
  {
    key: 'physical',
    label: 'Physical',
    keys: ['verticalLeapingAbility', 'agilityLateralSpeed', 'staminaEndurance', 'conditioningFitness', 'rebounding', 'bodyControl'],
    color: '#8B5CF6',
  },
  {
    key: 'mental',
    label: 'Mental',
    keys: ['clutchPerformance', 'handlePressureMental', 'leadershipCommunication', 'teamFirstAttitude', 'workEthicOutOfGame'],
    color: '#F59E0B',
  },
];

function RadarChart({ attrs }) {
  const SIZE = 240;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = 82;
  const n = RADAR_AXES.length;

  const values = RADAR_AXES.map(axis => {
    const vals = axis.keys.map(k => attrs[k] ?? 50);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  });

  const toXY = (index, value) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    const rv = (value / 100) * R;
    return { x: CX + rv * Math.cos(angle), y: CY + rv * Math.sin(angle) };
  };

  const axisEnd = (index) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    return { x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) };
  };

  const labelPos = (index) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    const lr = R + 24;
    return { x: CX + lr * Math.cos(angle), y: CY + lr * Math.sin(angle) };
  };

  const dataPoints = values.map((v, i) => toXY(i, v));
  const polygon = dataPoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const rings = [25, 50, 75, 100];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ overflow: 'visible' }}>
        {/* Grid rings */}
        {rings.map(ring => (
          <polygon
            key={ring}
            points={Array.from({ length: n }, (_, i) => toXY(i, ring)).map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
            fill="none"
            stroke={ring === 100 ? 'var(--border-color)' : 'var(--border-color)'}
            strokeWidth={ring === 100 ? 1.5 : 0.6}
            strokeDasharray={ring === 50 ? '3,3' : undefined}
          />
        ))}
        {/* Axis spokes */}
        {RADAR_AXES.map((_, i) => {
          const end = axisEnd(i);
          return <line key={i} x1={CX} y1={CY} x2={end.x.toFixed(1)} y2={end.y.toFixed(1)} stroke="var(--border-color)" strokeWidth={0.8} />;
        })}
        {/* Data fill */}
        <polygon points={polygon} fill="rgba(232,98,26,0.18)" stroke="var(--color-primary)" strokeWidth={2} strokeLinejoin="round" />
        {/* Data dots */}
        {dataPoints.map((p, i) => (
          <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={4} fill="var(--color-primary)" stroke="white" strokeWidth={1.5} />
        ))}
        {/* Labels */}
        {RADAR_AXES.map((axis, i) => {
          const pos = labelPos(i);
          return (
            <text
              key={i}
              x={pos.x.toFixed(1)}
              y={pos.y.toFixed(1)}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="9"
              fontWeight="700"
              fill="var(--text-secondary)"
              style={{ userSelect: 'none' }}
            >
              {axis.label}
            </text>
          );
        })}
        {/* Value labels on ring */}
        {[25, 50, 75].map(ring => {
          const p = toXY(2, ring); // along 3rd axis
          return (
            <text key={ring} x={(p.x + 4).toFixed(1)} y={p.y.toFixed(1)} fontSize="7" fill="var(--text-muted)" dominantBaseline="middle">
              {ring}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', justifyContent: 'center' }}>
        {RADAR_AXES.map((axis, i) => (
          <div key={axis.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: axis.color, flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {axis.label}: <strong style={{ color: 'var(--text-primary)' }}>{values[i].toFixed(0)}</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Attribute row ──────────────────────────────────────────────

function AttrRow({ attrKey, value }) {
  const label = ATTR_LABELS[attrKey] || attrKey;
  return (
    <div style={{ marginBottom: 'var(--space-2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
      </div>
      <AttrBar value={value ?? 0} />
    </div>
  );
}

// ── Position badge colors ──────────────────────────────────────

const POSITION_COLORS = {
  PG: 'badge-blue',
  SG: 'badge-orange',
  SF: 'badge-green',
  PF: 'badge-yellow',
  C: 'badge-red',
};

// ── Injury badge class ─────────────────────────────────────────

function injuryBadgeClass(status) {
  if (status === 'healthy') return 'badge-green';
  if (status === 'minor') return 'badge-yellow';
  return 'badge-red';
}

// ── Main PlayerProfile page ────────────────────────────────────

export default function PlayerProfile() {
  const { playerId } = useParams();
  const navigate = useNavigate();
  const { state, dispatch } = useGame();
  const { userTeam } = state;

  if (!userTeam) {
    return (
      <div className="page-content animate-fade-in">
        <div className="empty-state">
          <div className="empty-state-icon">🏀</div>
          <div className="empty-state-title">No team data found</div>
          <div className="empty-state-desc">Start a new game first.</div>
        </div>
      </div>
    );
  }

  const player = userTeam.players?.find(p => p.id === playerId);

  if (!player) {
    return (
      <div className="page-content animate-fade-in">
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <button
            onClick={() => navigate('/squad')}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}
          >
            ← Back to Squad
          </button>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">❓</div>
          <div className="empty-state-title">Player not found</div>
          <div className="empty-state-desc">This player is not on your roster.</div>
        </div>
      </div>
    );
  }

  const stats = getPlayerStats(player);
  const flag = NATIONALITY_FLAGS[player.nationality] || '🌐';
  const injuryStatus = player.injuryStatus || 'healthy';
  const attrs = player.attributes || {};
  const specialLabel = ATTR_LABELS[player.specialAbility] || player.specialAbility;

  function setAsCaptain() {
    const updated = userTeam.players.map(p => ({
      ...p,
      isCaptain: p.id === player.id,
      isViceCaptain: p.isViceCaptain && p.id !== player.id,
    }));
    dispatch({ type: 'UPDATE_TEAM', payload: { ...userTeam, players: updated } });
  }

  function setAsViceCaptain() {
    const updated = userTeam.players.map(p => ({
      ...p,
      isViceCaptain: p.id === player.id,
      isCaptain: p.isCaptain && p.id !== player.id,
    }));
    dispatch({ type: 'UPDATE_TEAM', payload: { ...userTeam, players: updated } });
  }

  function listForTransfer() {
    const updatedPlayer = { ...player, isOnTransferMarket: !player.isOnTransferMarket };
    dispatch({ type: 'UPDATE_PLAYER', payload: updatedPlayer });
  }

  return (
    <div className="page-content animate-fade-in">
      {/* Back button */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <button
          onClick={() => navigate('/squad')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            background: 'none',
            border: 'none',
            color: 'var(--color-primary)',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: 'var(--font-size-sm)',
            padding: 0,
          }}
        >
          ← Back to Squad
        </button>
      </div>

      {/* Player header card */}
      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-5)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Avatar */}
          <PlayerAvatar player={player} size="xl" />

          {/* Name / meta */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}>
              <h1 style={{ margin: 0, fontSize: 'var(--font-size-3xl)', lineHeight: 1 }}>{player.name}</h1>
              {player.isCaptain && (
                <span className="badge badge-orange" style={{ fontSize: 'var(--font-size-xs)' }}>Captain 👑</span>
              )}
              {player.isViceCaptain && (
                <span className="badge badge-yellow" style={{ fontSize: 'var(--font-size-xs)' }}>Vice Captain 🥈</span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
              <span className={`badge ${POSITION_COLORS[player.position] || 'badge-gray'}`}>{player.position}</span>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                {flag} {player.nationality}
              </span>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>Age {player.age}</span>
              {player.height && (
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                  {player.height.ft}'{player.height.inches}" / {player.height.cm}cm
                </span>
              )}
              {player.weight && (
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                  {player.weight.kg}kg / {player.weight.lbs}lbs
                </span>
              )}
              <span className={`badge ${injuryBadgeClass(injuryStatus)}`} style={{ textTransform: 'capitalize' }}>
                {injuryStatus}
                {injuryStatus !== 'healthy' && player.injuryDaysRemaining > 0 ? ` (${player.injuryDaysRemaining}d)` : ''}
              </span>
            </div>

            {/* Overall rating */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-4xl)', fontWeight: 900, color: 'var(--color-primary)', lineHeight: 1 }}>
                  {player.overallRating}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Overall</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: player.fatigue > 70 ? 'var(--color-danger)' : 'var(--text-primary)', lineHeight: 1 }}>
                  {player.fatigue ?? 0}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Fatigue</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, lineHeight: 1 }}>{player.lastFormRating ?? '–'}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Form</div>
              </div>
            </div>

            {/* Special ability */}
            {player.specialAbility && (
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Special Ability</span>
                <div style={{ marginTop: 4 }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--color-warning-light)',
                    color: 'var(--color-warning)',
                    fontWeight: 800,
                    fontSize: 'var(--font-size-sm)',
                    border: '1px solid var(--color-warning)',
                  }}>
                    ⚡ {specialLabel}
                  </span>
                </div>
              </div>
            )}

            {/* Personality */}
            {player.personality && player.personality.length > 0 && (
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Personality</span>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 4 }}>
                  {player.personality.map(trait => (
                    <span key={trait} className="badge badge-gray">{trait}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', flexShrink: 0 }}>
            <button
              onClick={setAsCaptain}
              disabled={player.isCaptain}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-primary)',
                background: player.isCaptain ? 'var(--color-primary)' : 'transparent',
                color: player.isCaptain ? 'white' : 'var(--color-primary)',
                fontWeight: 700,
                fontSize: 'var(--font-size-sm)',
                cursor: player.isCaptain ? 'default' : 'pointer',
                transition: 'all var(--transition-fast)',
                whiteSpace: 'nowrap',
              }}
            >
              👑 Set as Captain
            </button>
            <button
              onClick={setAsViceCaptain}
              disabled={player.isViceCaptain}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-warning)',
                background: player.isViceCaptain ? 'var(--color-warning)' : 'transparent',
                color: player.isViceCaptain ? 'white' : 'var(--color-warning)',
                fontWeight: 700,
                fontSize: 'var(--font-size-sm)',
                cursor: player.isViceCaptain ? 'default' : 'pointer',
                transition: 'all var(--transition-fast)',
                whiteSpace: 'nowrap',
              }}
            >
              🥈 Set as Vice Captain
            </button>
            <button
              onClick={listForTransfer}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                background: player.isOnTransferMarket ? 'var(--color-danger-light)' : 'transparent',
                color: player.isOnTransferMarket ? 'var(--color-danger)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: 'var(--font-size-sm)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                whiteSpace: 'nowrap',
              }}
            >
              {player.isOnTransferMarket ? '✕ Remove from Market' : '💰 List for Transfer'}
            </button>
          </div>
        </div>
      </div>

      {/* Season stats */}
      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="card-header">
          <span className="card-title">Season Statistics</span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{stats.gamesPlayed} games played</span>
        </div>
        <div className="stats-grid">
          {[
            { label: 'PTS', value: stats.pts },
            { label: 'AST', value: stats.ast },
            { label: 'REB', value: stats.reb },
            { label: 'STL', value: stats.stl },
            { label: 'BLK', value: stats.blk },
            { label: 'FG%', value: `${stats.fgPct}%` },
            { label: '3P%', value: `${stats.threePct}%` },
            { label: 'FT%', value: `${stats.ftPct}%` },
          ].map(({ label, value }) => (
            <div className="stat-card" key={label}>
              <div className="stat-value">{value}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Radar Chart */}
      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="card-header">
          <span className="card-title">Ability Radar</span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>6 key categories</span>
        </div>
        <RadarChart attrs={attrs} />
      </div>

      {/* Attributes */}
      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="card-header">
          <span className="card-title">Attributes</span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>30 attributes across all areas</span>
        </div>
        <div className="grid-3">
          {ATTR_COLUMNS.map((col, colIdx) => (
            <div key={colIdx}>
              {col.map(key => (
                <AttrRow key={key} attrKey={key} value={attrs[key]} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Contract info */}
      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="card-header">
          <span className="card-title">Contract</span>
        </div>
        <div className="grid-2">
          <div style={{ padding: 'var(--space-3)', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 4 }}>
              Years Remaining
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: player.contractYears <= 1 ? 'var(--color-danger)' : 'var(--text-primary)' }}>
              {player.contractYears ?? '–'}
            </div>
            {player.contractYears <= 1 && (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)', fontWeight: 600, marginTop: 2 }}>
                Expiring soon
              </div>
            )}
          </div>
          <div style={{ padding: 'var(--space-3)', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 4 }}>
              Annual Salary
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-success)' }}>
              ${player.salary ?? '–'}k
            </div>
          </div>
        </div>
        {player.isOnTransferMarket && (
          <div style={{
            marginTop: 'var(--space-3)',
            padding: 'var(--space-3)',
            background: 'var(--color-warning-light)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-warning)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}>
            <span style={{ fontSize: '1rem' }}>💰</span>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-warning)' }}>
              This player is listed on the transfer market.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
