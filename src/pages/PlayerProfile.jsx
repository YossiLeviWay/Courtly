import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../context/GameContext.jsx';
import AttrBar from '../components/ui/AttrBar.jsx';
import PlayerAvatar from '../components/ui/PlayerAvatar.jsx';
import { apiGetMatchLog } from '../api.js';

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

// ── Attribute categories ───────────────────────────────────────

const ATTR_CATEGORIES = [
  {
    label: 'Offense', icon: '⚔️', color: '#E8621A',
    keys: ['finishingAtTheRim', 'aggressivenessOffensive', 'postMoves', 'offBallMovement', 'settingScreens'],
  },
  {
    label: 'Shooting', icon: '🎯', color: '#1565C0',
    keys: ['threePtShooting', 'midRangeScoring', 'freeThrowShooting', 'clutchPerformance'],
  },
  {
    label: 'Playmaking', icon: '🧠', color: '#7B1FA2',
    keys: ['courtVision', 'passingAccuracy', 'ballHandlingDribbling', 'basketballIQ', 'patienceOffense'],
  },
  {
    label: 'Defense', icon: '🛡️', color: '#2E7D32',
    keys: ['perimeterDefense', 'interiorDefense', 'helpDefense', 'onBallScreenNavigation', 'rebounding'],
  },
  {
    label: 'Physical', icon: '💪', color: '#F57C00',
    keys: ['staminaEndurance', 'conditioningFitness', 'verticalLeapingAbility', 'agilityLateralSpeed', 'bodyControl'],
  },
  {
    label: 'Mental', icon: '🔮', color: '#00838F',
    keys: ['leadershipCommunication', 'handlePressureMental', 'disciplineFouling', 'consistencyPerformance', 'workEthicOutOfGame', 'teamFirstAttitude'],
  },
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

// ── Per-game Stats Tab ────────────────────────────────────────

function PerGameStatsTab({ player, stats, userTeam, leagues }) {
  const [games, setGames] = useState(null);
  const [loading, setLoading] = useState(false);

  const ss = player.seasonStats || {};
  const gp = ss.gamesPlayed || 0;

  function fmt(made, att) { return (att || made) ? `${made ?? 0}-${att ?? 0}` : '—'; }
  function pgAvg(val) { return gp > 0 ? ((val || 0) / gp).toFixed(1) : '—'; }
  function pct(m, a) { return (a || 0) > 0 ? (((m || 0) / a) * 100).toFixed(1) + '%' : '—'; }

  // Load per-game logs
  useEffect(() => {
    if (games !== null || loading) return;
    if (!userTeam || !leagues) return;
    const userLeague = leagues.find(l => l.teams?.some(t => t.id === userTeam.id));
    const played = (userLeague?.schedule || []).filter(m =>
      m.played && (m.homeTeamId === userTeam.id || m.awayTeamId === userTeam.id)
    );
    if (played.length === 0) { setGames([]); return; }
    setLoading(true);
    Promise.all(
      played.map(m => apiGetMatchLog(m.id).then(log => ({ m, log })).catch(() => ({ m, log: null })))
    ).then(results => {
      const rows = results
        .filter(r => r.log?.playerStats?.[player.id])
        .map(r => {
          const s = r.log.playerStats[player.id];
          const isHome = r.m.homeTeamId === userTeam.id;
          const opp = isHome ? r.m.awayTeamName : r.m.homeTeamName;
          const us = isHome ? (r.log.homeScore ?? 0) : (r.log.awayScore ?? 0);
          const them = isHome ? (r.log.awayScore ?? 0) : (r.log.homeScore ?? 0);
          return { ...s, opp, date: r.m.scheduledDate, won: us > them };
        })
        .sort((a, b) => b.date - a.date);
      setGames(rows);
      setLoading(false);
    }).catch(() => { setGames([]); setLoading(false); });
  }, [games, loading, player.id, userTeam, leagues]);

  const dateStr = ts => ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

  return (
    <div>
      {/* Season averages summary */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="card-header">
          <span className="card-title">Season Averages</span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{gp} GP</span>
        </div>
        {gp === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16, fontSize: 'var(--font-size-sm)' }}>No games played yet</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 8 }}>
              {[['PPG', pgAvg(ss.points)], ['RPG', pgAvg(ss.rebounds)], ['APG', pgAvg(ss.assists)], ['SPG', pgAvg(ss.steals)], ['BPG', pgAvg(ss.blocks)]].map(([l, v]) => (
                <div key={l} style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, color: 'var(--color-primary)' }}>{v}</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700 }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[['FG%', pct(ss.fgMade, ss.fgAttempts)], ['3P%', pct(ss.threePtMade, ss.threePtAttempts)], ['FT%', pct(ss.ftMade, ss.ftAttempts)], ['TPG', pgAvg(ss.turnovers)]].map(([l, v]) => (
                <div key={l} style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 900, color: 'var(--text-primary)' }}>{v}</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700 }}>{l}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Game-by-game log */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 12 }}>Game Stats</div>
        {loading && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Loading game log…</div>}
        {!loading && games !== null && games.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24, fontSize: 'var(--font-size-sm)' }}>
            {gp > 0 ? 'Detailed game logs not available' : 'No games played yet'}
          </div>
        )}
        {games && games.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  {['Date', 'Opponent', '', 'MIN', 'PTS', 'FG', '3PT', 'FT', 'REB', 'AST', 'STL', 'BLK', 'TO'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: h === 'Date' || h === 'Opponent' ? 'left' : 'center', fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {games.map((g, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', background: g.won ? 'rgba(34,197,94,0.03)' : 'rgba(239,68,68,0.03)' }}>
                    <td style={{ padding: '7px 8px', color: 'var(--text-muted)' }}>{dateStr(g.date)}</td>
                    <td style={{ padding: '7px 8px', fontWeight: 600, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.opp}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                      <span className={`badge ${g.won ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.55rem' }}>{g.won ? 'W' : 'L'}</span>
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>{g.minutesPlayed ?? '—'}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 800, color: (g.points ?? 0) >= 20 ? 'var(--color-primary)' : 'inherit' }}>{g.points ?? 0}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'center' }}>{fmt(g.fgMade, g.fgAttempts)}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'center' }}>{fmt(g.threePtMade, g.threePtAttempts)}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'center' }}>{fmt(g.ftMade, g.ftAttempts)}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: (g.rebounds ?? 0) >= 10 ? 700 : 400 }}>{g.rebounds ?? 0}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: (g.assists ?? 0) >= 10 ? 700 : 400 }}>{g.assists ?? 0}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'center' }}>{g.steals ?? 0}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'center' }}>{g.blocks ?? 0}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'center', color: (g.turnovers ?? 0) >= 5 ? 'var(--color-danger)' : 'inherit' }}>{g.turnovers ?? 0}</td>
                  </tr>
                ))}
              </tbody>
              {/* Season totals row */}
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: 800, background: 'var(--bg-muted)' }}>
                  <td colSpan={3} style={{ padding: '7px 8px', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>Regular Season</td>
                  <td style={{ padding: '7px 8px', textAlign: 'center' }}>{pgAvg(ss.minutesPlayed)}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'center', color: 'var(--color-primary)' }}>{pgAvg(ss.points)}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'center' }}>{pct(ss.fgMade, ss.fgAttempts)}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'center' }}>{pct(ss.threePtMade, ss.threePtAttempts)}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'center' }}>{pct(ss.ftMade, ss.ftAttempts)}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'center' }}>{pgAvg(ss.rebounds)}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'center' }}>{pgAvg(ss.assists)}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'center' }}>{pgAvg(ss.steals)}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'center' }}>{pgAvg(ss.blocks)}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'center' }}>{pgAvg(ss.turnovers)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Contract Negotiation Panel ─────────────────────────────────

function ContractNegotiationPanel({ player, onClose, dispatch }) {
  const demand = Math.round((player.salary * 1.15 + (player.overallRating ?? 60) * 2) / 5) * 5;
  const [offer, setOffer] = useState(player.salary ?? demand);
  const [seasons, setSeasons] = useState(2);
  const [signOnBonus, setSignOnBonus] = useState(0);
  const [result, setResult] = useState(null);

  const handleNegotiate = () => {
    if (offer >= demand * 0.9) {
      dispatch({ type: 'UPDATE_PLAYER', payload: { ...player, salary: offer, contractYears: seasons } });
      setResult('accepted');
    } else {
      setResult('declined');
    }
  };

  if (result === 'accepted') return (
    <div style={{ textAlign: 'center', padding: 24 }}>
      <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎉</div>
      <div style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', color: 'var(--color-success)', marginBottom: 8 }}>
        Contract Signed!
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 16 }}>
        {player.name} agreed to ${offer}k/year for {seasons} season{seasons > 1 ? 's' : ''}.
        {signOnBonus > 0 && ` Sign-on bonus: $${signOnBonus}k.`}
      </div>
      <button className="btn btn-primary" onClick={onClose}>Close</button>
    </div>
  );

  if (result === 'declined') return (
    <div style={{ textAlign: 'center', padding: 24 }}>
      <div style={{ fontSize: '3rem', marginBottom: 12 }}>❌</div>
      <div style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', color: 'var(--color-danger)', marginBottom: 8 }}>
        Player Declined
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 16 }}>
        {player.name} is demanding at least ${Math.round(demand * 0.9)}k/year. Consider raising your offer.
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button className="btn btn-ghost" onClick={() => setResult(null)}>Try Again</button>
        <button className="btn btn-sm" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="card mb-4" style={{ background: 'var(--bg-muted)', padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', marginBottom: 4 }}>
          <span style={{ color: 'var(--text-muted)' }}>Current salary</span>
          <span style={{ fontWeight: 700 }}>${player.salary ?? 0}k/year</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
          <span style={{ color: 'var(--text-muted)' }}>Player demand</span>
          <span style={{ fontWeight: 700, color: 'var(--color-warning)' }}>${demand}k/year</span>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Your Offer (k/year)</label>
        <input className="form-input" type="number" min={0} max={9999} value={offer}
          onChange={e => setOffer(Number(e.target.value))} />
      </div>
      <div className="form-group">
        <label className="form-label">Contract Length</label>
        <select className="form-select" value={seasons} onChange={e => setSeasons(Number(e.target.value))}>
          {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} season{n > 1 ? 's' : ''}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Sign-on Bonus (k, optional)</label>
        <input className="form-input" type="number" min={0} max={999} value={signOnBonus}
          onChange={e => setSignOnBonus(Number(e.target.value))} />
      </div>
      <button className="btn btn-primary w-full" onClick={handleNegotiate}>Submit Offer</button>
    </div>
  );
}

// ── Main PlayerProfile page ────────────────────────────────────

export default function PlayerProfile() {
  const { playerId } = useParams();
  const navigate = useNavigate();
  const { state, dispatch } = useGame();
  const { userTeam } = state;

  const [showContractModal, setShowContractModal] = useState(false);
  const [tab, setTab] = useState('overview');

  useEffect(() => { window.scrollTo(0, 0); }, [playerId]);

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

  // Derived salary fallback (same logic as Squad.jsx)
  const ovr = player.overallRating ?? 60;
  const salary = player.salary ?? (ovr >= 85 ? 24 : ovr >= 75 ? 14 : ovr >= 65 ? 7 : 4);
  const contractYears = player.contractYears ?? 2;

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

  const TABS = [
    { id: 'overview',   label: 'Overview'   },
    { id: 'stats',      label: 'Stats'      },
    { id: 'attributes', label: 'Attributes' },
    { id: 'contract',   label: 'Contract'   },
  ];

  return (
    <div className="page-content animate-fade-in">
      {/* Back button */}
      <button
        onClick={() => navigate('/squad')}
        style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer', fontSize: 'var(--font-size-sm)', padding: 0, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}
      >
        ← Back to Squad
      </button>

      {/* ── Player header card ── */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <PlayerAvatar player={player} size="xl" />

          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 6 }}>
              <h1 style={{ margin: 0, fontSize: 'var(--font-size-2xl)', lineHeight: 1 }}>{player.name}</h1>
              {player.isCaptain && <span className="badge badge-orange" style={{ fontSize: 'var(--font-size-xs)' }}>Captain 👑</span>}
              {player.isViceCaptain && <span className="badge badge-yellow" style={{ fontSize: 'var(--font-size-xs)' }}>Vice Captain 🥈</span>}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 8 }}>
              <span className={`badge ${POSITION_COLORS[player.position] || 'badge-gray'}`}>{player.position}</span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{flag} {player.nationality}</span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Age {player.age}</span>
              {player.height && <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{player.height.cm}cm</span>}
              {player.weight && <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{player.weight.kg}kg</span>}
              <span className={`badge ${injuryBadgeClass(injuryStatus)}`} style={{ textTransform: 'capitalize', fontSize: 'var(--font-size-xs)' }}>
                {injuryStatus}{injuryStatus !== 'healthy' && player.injuryDaysRemaining > 0 ? ` (${player.injuryDaysRemaining}d)` : ''}
              </span>
            </div>

            {/* Key metrics row */}
            <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
              {[
                { val: ovr, label: 'OVR', color: 'var(--color-primary)' },
                { val: player.fatigue ?? 0, label: 'Fatigue', color: (player.fatigue ?? 0) > 70 ? 'var(--color-danger)' : 'var(--text-primary)' },
                { val: player.lastFormRating ?? '–', label: 'Form', color: 'var(--text-primary)' },
                { val: `$${salary}k`, label: 'Salary', color: 'var(--color-success)' },
              ].map(({ val, label, color }) => (
                <div key={label}>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, color, lineHeight: 1 }}>{val}</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', flexShrink: 0 }}>
            <button onClick={setAsCaptain} disabled={player.isCaptain}
              style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-primary)', background: player.isCaptain ? 'var(--color-primary)' : 'transparent', color: player.isCaptain ? 'white' : 'var(--color-primary)', fontWeight: 700, fontSize: 'var(--font-size-xs)', cursor: player.isCaptain ? 'default' : 'pointer' }}>
              👑 Captain
            </button>
            <button onClick={setAsViceCaptain} disabled={player.isViceCaptain}
              style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-warning)', background: player.isViceCaptain ? 'var(--color-warning)' : 'transparent', color: player.isViceCaptain ? 'white' : 'var(--color-warning)', fontWeight: 700, fontSize: 'var(--font-size-xs)', cursor: player.isViceCaptain ? 'default' : 'pointer' }}>
              🥈 Vice Captain
            </button>
            <button onClick={listForTransfer}
              style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: player.isOnTransferMarket ? 'rgba(239,68,68,0.1)' : 'transparent', color: player.isOnTransferMarket ? 'var(--color-danger)' : 'var(--text-secondary)', fontWeight: 700, fontSize: 'var(--font-size-xs)', cursor: 'pointer' }}>
              {player.isOnTransferMarket ? '✕ Remove' : '💰 Transfer'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border-color)', marginBottom: 'var(--space-4)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer',
            fontWeight: tab === t.id ? 800 : 500, fontSize: 'var(--font-size-sm)',
            color: tab === t.id ? 'var(--color-primary)' : 'var(--text-muted)',
            borderBottom: tab === t.id ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginBottom: -2, whiteSpace: 'nowrap',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Tab: Overview ── */}
      {tab === 'overview' && (
        <div>
          {/* Season averages */}
          <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="card-header">
              <span className="card-title">Season Averages</span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{stats.gamesPlayed} GP</span>
            </div>
            <div className="stats-grid">
              {[
                { label: 'PPG', value: stats.pts },
                { label: 'RPG', value: stats.reb },
                { label: 'APG', value: stats.ast },
                { label: 'SPG', value: stats.stl },
                { label: 'BPG', value: stats.blk },
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

          {/* Radar + specials */}
          <div className="grid-2" style={{ gap: 'var(--space-4)' }}>
            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>Ability Radar</div>
              <RadarChart attrs={attrs} />
            </div>
            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>Player Info</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {player.specialAbility && (
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 4 }}>Special Ability</div>
                    <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 'var(--radius-full)', background: 'var(--color-warning-light)', color: 'var(--color-warning)', fontWeight: 800, fontSize: 'var(--font-size-sm)', border: '1px solid var(--color-warning)' }}>
                      ⚡ {specialLabel}
                    </span>
                  </div>
                )}
                {player.personality?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 4 }}>Personality</div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                      {player.personality.map(trait => <span key={trait} className="badge badge-gray">{trait}</span>)}
                    </div>
                  </div>
                )}
                {[
                  ['Height', player.height ? `${player.height.ft}'${player.height.inches}" / ${player.height.cm}cm` : '—'],
                  ['Weight', player.weight ? `${player.weight.kg}kg / ${player.weight.lbs}lbs` : '—'],
                  ['Nationality', `${flag} ${player.nationality || '—'}`],
                  ['Age', player.age ?? '—'],
                  ['Potential', player.potential ?? '—'],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 4 }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Stats (per-game log) ── */}
      {tab === 'stats' && (
        <PerGameStatsTab player={player} stats={stats} userTeam={userTeam} leagues={state.leagues} />
      )}

      {/* ── Tab: Attributes ── */}
      {tab === 'attributes' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>Attributes</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
            {ATTR_CATEGORIES.map(cat => (
              <div key={cat.label}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, borderBottom: `2px solid ${cat.color}`, paddingBottom: 4 }}>
                  <span>{cat.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: cat.color }}>{cat.label}</span>
                </div>
                {cat.keys.map(key => (
                  <AttrBar key={key} label={ATTR_LABELS[key] || key} value={attrs[key] ?? 50} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Contract ── */}
      {tab === 'contract' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Contract</span>
            <button className="btn btn-sm btn-ghost" onClick={() => setShowContractModal(true)}>Negotiate</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            {[
              {
                label: 'Seasons Remaining',
                value: contractYears,
                valueColor: contractYears <= 1 ? 'var(--color-danger)' : 'var(--text-primary)',
                sub: contractYears <= 1 ? '⚠️ Expiring soon!' : null,
              },
              {
                label: 'Annual Salary',
                value: `$${salary}k`,
                valueColor: 'var(--color-success)',
                sub: `$${Math.round(salary / 12)}k / month`,
              },
              {
                label: 'Seasons in Club',
                value: player.yearsInClub ?? 1,
                valueColor: 'var(--text-primary)',
                sub: null,
              },
              {
                label: 'Status',
                value: player.isOnTransferMarket ? 'Listed for Transfer' : 'Under Contract',
                valueColor: player.isOnTransferMarket ? 'var(--color-warning)' : 'var(--color-success)',
                sub: null,
              },
            ].map(({ label, value, valueColor, sub }) => (
              <div key={label} style={{ padding: 'var(--space-3)', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: valueColor }}>{value}</div>
                {sub && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)', fontWeight: 600, marginTop: 2 }}>{sub}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contract Negotiation Modal */}
      {showContractModal && (
        <div className="modal-overlay" onClick={() => setShowContractModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>Contract Negotiation — {player.name}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowContractModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <ContractNegotiationPanel player={{ ...player, salary }} onClose={() => setShowContractModal(false)} dispatch={dispatch} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
