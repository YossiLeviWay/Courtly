import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { apiGetMatchLog, apiSaveMatchLog } from '../api.js';
import { formatMatchDate } from '../engine/gameScheduler.js';
import { simulateMatch } from '../engine/matchEngine.js';

const GAME_DURATION_MS = 6900 * 1000;
// Internal simulation uses 10-min quarters; display as 12-min NBA quarters
const SIM_Q_MINS = 10;
const NBA_Q_MINS = 12;

export const EVENT_ICONS = {
  three_pointer: '🎯', dunk: '💥', layup: '🏀', timeout: '⏱️',
  foul: '🚨', injury: '🚑', substitution: '🔄', quarter_end: '🔔',
  half_time: '🕐', comeback: '⚡', technical_foul: '🚫', fight: '⚠️',
  turnover: '❌', steal: '🤚', block: '🛡️', free_throw: '🎯', assist: '🎪',
  game_start: '🏀', midrange: '🏀',
};

/** Format event time as NBA quarter-minutes: "Q2 4'" */
function fmtEventTime(ev) {
  if (!ev || ev.type === 'game_start') return 'TIP';
  if (!ev.quarter) return '';
  const qStart = (ev.quarter - 1) * SIM_Q_MINS;
  const minInQ = Math.max(0, (ev.time ?? 0) - qStart);
  // Scale 0–10 sim minutes → 0–12 NBA minutes
  const nbaMins = Math.min(NBA_Q_MINS, Math.round(minInQ * (NBA_Q_MINS / SIM_Q_MINS)));
  return `Q${ev.quarter} ${nbaMins}'`;
}

function fmt(made, att) {
  if (!att && !made) return '—';
  return `${made ?? 0}-${att ?? 0}`;
}
function pct(made, att) {
  if (!att) return '—';
  return ((made / att) * 100).toFixed(1) + '%';
}

function computeTeamStats(playerStats, playerIds) {
  const players = Object.values(playerStats).filter(s => playerIds.has(s.playerId));
  const sum = k => players.reduce((acc, s) => acc + (s[k] || 0), 0);
  const fgMade = sum('fgMade'), fgAtt = sum('fgAttempts');
  const tpMade = sum('threePtMade'), tpAtt = sum('threePtAttempts');
  const ftMade = sum('ftMade'), ftAtt = sum('ftAttempts');
  const reb = sum('rebounds'), ast = sum('assists'), stl = sum('steals');
  const blk = sum('blocks'), tov = sum('turnovers'), pf = sum('fouls');
  const pts = sum('points');
  const offReb = Math.round(reb * 0.28);
  const defReb = reb - offReb;
  const ppp = (fgAtt + 0.44 * ftAtt + tov) > 0
    ? (pts / (fgAtt + 0.44 * ftAtt + tov)).toFixed(2) : '—';
  const paintPts = Math.round((fgMade - tpMade) * 2 * 0.62);
  const fastBreak = Math.round(pts * 0.13);
  const offTovPts = Math.round(tov * 1.2);
  return { fgMade, fgAtt, tpMade, tpAtt, ftMade, ftAtt, reb, offReb, defReb, ast, stl, blk, tov, pf, pts, ppp, paintPts, fastBreak, offTovPts };
}

function TeamStatsRow({ label, home, away, higherIsBetter = true }) {
  const hNum = parseFloat(home);
  const aNum = parseFloat(away);
  const homeWins = !isNaN(hNum) && !isNaN(aNum) && (higherIsBetter ? hNum > aNum : hNum < aNum);
  const awayWins = !isNaN(hNum) && !isNaN(aNum) && (higherIsBetter ? aNum > hNum : aNum < hNum);
  return (
    <tr style={{ borderTop: '1px solid var(--border-color)' }}>
      <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: homeWins ? 800 : 400, color: homeWins ? 'var(--color-primary)' : 'inherit', fontSize: '0.75rem' }}>{home}</td>
      <td style={{ padding: '5px 8px', textAlign: 'center', fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</td>
      <td style={{ padding: '5px 8px', textAlign: 'left', fontWeight: awayWins ? 800 : 400, color: awayWins ? 'var(--color-primary)' : 'inherit', fontSize: '0.75rem' }}>{away}</td>
    </tr>
  );
}

function simResultToLog(result, match) {
  return {
    matchId: match.id, leagueId: match.leagueId || '',
    homeTeamName: match.homeTeamName || result.homeTeamName || '',
    awayTeamName: match.awayTeamName || result.awayTeamName || '',
    homeScore: result.homeScore, awayScore: result.awayScore,
    events: result.log || result.events || [],
    playerStats: result.playerStats || {},
    quarterScores: result.quarterScores || [],
    reconstructed: true,
  };
}

export default function MatchDetailModal({ match, allTeams, userTeamId, onClose, asPage = false }) {
  const [log, setLog]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('highlights');

  const isLive = !match.played &&
    match.scheduledDate &&
    Date.now() >= match.scheduledDate &&
    Date.now() - match.scheduledDate < GAME_DURATION_MS;

  const homeTeam = allTeams?.find(t => t.id === match.homeTeamId);
  const awayTeam = allTeams?.find(t => t.id === match.awayTeamId);

  useEffect(() => {
    setLoading(true); setLog(null);
    apiGetMatchLog(match.id).then(firestoreLog => {
      if (firestoreLog) { setLog(firestoreLog); setLoading(false); return; }
      if (match.played && homeTeam && awayTeam) {
        try {
          const result = simulateMatch(homeTeam, awayTeam, match.scheduledDate, match.id);
          const rec = simResultToLog(result, match);
          setLog(rec);
          apiSaveMatchLog(match.id, {
            events: rec.events, playerStats: rec.playerStats,
            quarterScores: rec.quarterScores, homeScore: rec.homeScore,
            awayScore: rec.awayScore, homeTeamName: rec.homeTeamName,
            awayTeamName: rec.awayTeamName, leagueId: rec.leagueId,
          }).catch(() => {});
        } catch (e) { console.warn('Could not reconstruct match log:', e); }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id]);

  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => {
      apiGetMatchLog(match.id).then(d => { if (d) setLog(d); }).catch(() => {});
    }, 10_000);
    return () => clearInterval(id);
  }, [isLive, match.id]);

  const rawHomeScore = match.result?.homeScore ?? match.homeScore ?? log?.homeScore;
  const rawAwayScore = match.result?.awayScore ?? match.awayScore ?? log?.awayScore;
  const isUserHome   = match.homeTeamId === userTeamId;
  const userScore    = isUserHome ? rawHomeScore : rawAwayScore;
  const oppScore     = isUserHome ? rawAwayScore : rawHomeScore;
  const userTeamName = isUserHome ? match.homeTeamName : match.awayTeamName;
  const oppTeamName  = isUserHome ? match.awayTeamName : match.homeTeamName;
  const userWon      = (userScore ?? -1) > (oppScore ?? -1);

  const rawQS  = log?.quarterScores || [];
  const homeQS = rawQS.map(q => (typeof q === 'object' ? q.home : q));
  const awayQS = rawQS.map(q => (typeof q === 'object' ? q.away : q));
  const userQS = isUserHome ? homeQS : awayQS;
  const oppQS  = isUserHome ? awayQS : homeQS;

  const events      = log?.events      || [];
  const playerStats = log?.playerStats || {};

  const homePids = new Set((homeTeam?.players || []).map(p => p.id));
  const awayPids = new Set((awayTeam?.players || []).map(p => p.id));
  const userTeamObj = isUserHome ? homeTeam : awayTeam;
  const oppTeamObj  = isUserHome ? awayTeam : homeTeam;
  const userPids    = isUserHome ? homePids : awayPids;
  const oppPids     = isUserHome ? awayPids : homePids;
  const hasStats    = Object.keys(playerStats).length > 0;
  const userTeamStats = hasStats ? computeTeamStats(playerStats, userPids) : null;
  const oppTeamStats  = hasStats ? computeTeamStats(playerStats, oppPids)  : null;

  const resultKnown = rawHomeScore != null;

  function BoxScoreTable({ teamObj, pids, label, isUser }) {
    const rows = Object.values(playerStats)
      .filter(s => pids.size > 0 ? pids.has(s.playerId) : !!(s.minutesPlayed))
      .filter(s => s.minutesPlayed > 0)
      .sort((a, b) => (b.points || 0) - (a.points || 0));
    const player = (s) => teamObj?.players?.find(p => p.id === s.playerId);
    if (rows.length === 0) return null;
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontWeight: 700, fontSize: 'var(--font-size-xs)', marginBottom: 6,
          borderBottom: `2px solid ${isUser ? 'var(--color-primary)' : 'var(--border-color)'}`,
          paddingBottom: 4, display: 'flex', alignItems: 'center', gap: 6,
          color: isUser ? 'var(--color-primary)' : 'var(--text-secondary)',
          textTransform: 'uppercase', letterSpacing: 0.5,
        }}>
          {label}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.68rem', whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                {['Player', 'MIN', 'PTS', 'FG', '3PT', 'FT', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PF'].map(h => (
                  <th key={h} style={{ padding: '3px 5px', textAlign: h === 'Player' ? 'left' : 'center', fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(s => {
                const p = player(s);
                const pos = s.position || p?.position || '';
                const hot = (s.points || 0) >= 20;
                return (
                  <tr key={s.playerId} style={{ borderTop: '1px solid var(--border-color)', background: hot ? 'rgba(232,98,26,0.05)' : undefined }}>
                    <td style={{ padding: '4px 5px', fontWeight: 600, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', marginRight: 3 }}>{pos}</span>
                      {s.playerName || p?.name || '—'}
                    </td>
                    <td style={{ padding: '4px 5px', textAlign: 'center', color: 'var(--text-muted)' }}>{s.minutesPlayed ?? '—'}</td>
                    <td style={{ padding: '4px 5px', textAlign: 'center', fontWeight: 800, color: hot ? 'var(--color-primary)' : 'inherit' }}>{s.points ?? 0}</td>
                    <td style={{ padding: '4px 5px', textAlign: 'center' }}>{fmt(s.fgMade, s.fgAttempts)}</td>
                    <td style={{ padding: '4px 5px', textAlign: 'center' }}>{fmt(s.threePtMade, s.threePtAttempts)}</td>
                    <td style={{ padding: '4px 5px', textAlign: 'center' }}>{fmt(s.ftMade, s.ftAttempts)}</td>
                    <td style={{ padding: '4px 5px', textAlign: 'center', fontWeight: (s.rebounds || 0) >= 10 ? 700 : 400 }}>{s.rebounds ?? 0}</td>
                    <td style={{ padding: '4px 5px', textAlign: 'center', fontWeight: (s.assists || 0) >= 10 ? 700 : 400 }}>{s.assists ?? 0}</td>
                    <td style={{ padding: '4px 5px', textAlign: 'center' }}>{s.steals ?? 0}</td>
                    <td style={{ padding: '4px 5px', textAlign: 'center' }}>{s.blocks ?? 0}</td>
                    <td style={{ padding: '4px 5px', textAlign: 'center', color: (s.turnovers || 0) >= 5 ? 'var(--color-danger)' : 'inherit' }}>{s.turnovers ?? 0}</td>
                    <td style={{ padding: '4px 5px', textAlign: 'center', color: (s.fouls || 0) >= 5 ? 'var(--color-danger)' : 'inherit' }}>{s.fouls ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const inner = (
    <div style={asPage ? { display: 'flex', flexDirection: 'column' } : {
      maxWidth: 700, width: '96vw',
      maxHeight: '92vh',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      padding: 0,
    }}
      className={asPage ? undefined : 'modal'}
      onClick={asPage ? undefined : e => e.stopPropagation()}
    >
      {/* ── Fixed header ─────────────────────────────── */}
      <div style={{ padding: asPage ? '0 0 12px' : '12px 16px 0', flexShrink: 0 }}>
          {/* Title row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: 'var(--font-size-base)' }}>
                  {isUserHome ? match.homeTeamName : match.awayTeamName}
                </span>
                {isLive ? (
                  <span className="badge" style={{ fontSize: '0.55rem', background: 'var(--color-danger)', color: 'white' }}>🔴 LIVE</span>
                ) : resultKnown ? (
                  <span className={`badge ${userWon ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.55rem' }}>{userWon ? 'WIN' : 'LOSS'}</span>
                ) : null}
                <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 'var(--font-size-sm)' }}>
                  vs {isUserHome ? match.awayTeamName : match.homeTeamName}
                </span>
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {formatMatchDate(match.scheduledDate)} · {isUserHome ? '🏠 Home' : '✈️ Away'}
              </div>
            </div>
            {asPage ? (
              <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ flexShrink: 0, fontWeight: 700, color: 'var(--color-primary)' }}>
                ← Back
              </button>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ flexShrink: 0, marginTop: -2 }}>
                <X size={16} />
              </button>
            )}
          </div>

          {/* Score + quarter breakdown */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: 8,
            background: resultKnown
              ? (userWon ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.07)')
              : 'var(--bg-muted)',
            borderRadius: 'var(--radius)',
            padding: '10px 14px',
            marginBottom: 0,
          }}>
            {/* User team */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.55rem', fontWeight: 700, letterSpacing: 1, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 2 }}>
                {isUserHome ? 'HOME' : 'AWAY'}
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.7rem', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {userTeamName}
              </div>
              <div style={{
                fontSize: '2.4rem', fontWeight: 900, lineHeight: 1,
                color: resultKnown ? (userWon ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--text-muted)',
              }}>
                {userScore ?? '–'}
              </div>
              {/* User quarter scores */}
              {userQS.length > 0 && (
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 6 }}>
                  {userQS.map((s, i) => (
                    <div key={i} style={{ textAlign: 'center', minWidth: 24 }}>
                      <div style={{ fontSize: '0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Q{i + 1}</div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700 }}>{s}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Center */}
            <div style={{ textAlign: 'center', padding: '0 4px' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                {resultKnown ? 'FINAL' : isLive ? '🔴 LIVE' : 'UPCOMING'}
              </div>
              {userWon && resultKnown && <div style={{ fontSize: '1.2rem', marginTop: 2 }}>🏆</div>}
            </div>

            {/* Opponent */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.55rem', fontWeight: 700, letterSpacing: 1, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>
                {isUserHome ? 'AWAY' : 'HOME'}
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.7rem', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {oppTeamName}
              </div>
              <div style={{ fontSize: '2.4rem', fontWeight: 900, lineHeight: 1, color: 'var(--text-primary)' }}>
                {oppScore ?? '–'}
              </div>
              {oppQS.length > 0 && (
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 6 }}>
                  {oppQS.map((s, i) => (
                    <div key={i} style={{ textAlign: 'center', minWidth: 24 }}>
                      <div style={{ fontSize: '0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Q{i + 1}</div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700 }}>{s}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          {log && (
            <div style={{ display: 'flex', gap: 0, marginTop: 10, borderBottom: '2px solid var(--border-color)' }}>
              {[
                { id: 'highlights', label: '📋 Highlights' },
                { id: 'boxscore',   label: '📊 Box Score'  },
                { id: 'teamstats', label: '📈 Team Stats'  },
              ].map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer',
                  fontWeight: tab === t.id ? 800 : 500, fontSize: '0.75rem',
                  color: tab === t.id ? 'var(--color-primary)' : 'var(--text-muted)',
                  borderBottom: tab === t.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                  marginBottom: -2, whiteSpace: 'nowrap',
                }}>{t.label}</button>
              ))}
            </div>
          )}
        </div>

        {/* ── Scrollable content ───────────────────────── */}
        <div style={asPage ? { padding: '12px 0' } : { flex: 1, overflowY: 'auto', padding: '12px 16px', minHeight: 0 }}>
          {loading && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
              Loading match data…
            </div>
          )}

          {!loading && !log && (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">No detailed log available</div>
              <div className="empty-state-desc">Match data could not be loaded for this game.</div>
            </div>
          )}

          {!loading && log && tab === 'highlights' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {events.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>No highlights recorded.</div>
              )}
              {events.map((ev, i) => {
                const isBreak = ev.type === 'quarter_end' || ev.type === 'half_time' || ev.type === 'game_start';
                const isScoring = ['three_pointer','dunk','layup','midrange','free_throw'].includes(ev.type);
                const isHomeEvent = ev.teamId === match.homeTeamId;
                const isUserEvent = isUserHome ? isHomeEvent : !isHomeEvent;
                return (
                  <div key={i} style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                    padding: isBreak ? '6px 10px' : '5px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: isBreak
                      ? 'var(--bg-muted)'
                      : isScoring && isUserEvent
                        ? 'rgba(232,98,26,0.04)'
                        : 'transparent',
                    borderLeft: isBreak
                      ? '3px solid var(--color-primary)'
                      : isScoring && isUserEvent
                        ? '3px solid var(--color-primary)'
                        : '3px solid transparent',
                  }}>
                    {/* Time badge */}
                    <span style={{
                      fontSize: '0.6rem', color: 'var(--text-muted)',
                      minWidth: 42, paddingTop: 2, fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums', letterSpacing: 0,
                    }}>
                      {fmtEventTime(ev)}
                    </span>
                    <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>{EVENT_ICONS[ev.type] || '🏀'}</span>
                    <span style={{ flex: 1, fontSize: '0.75rem', lineHeight: 1.4, color: isBreak ? 'var(--text-secondary)' : 'var(--text-primary)', fontWeight: isBreak ? 700 : 400 }}>
                      {ev.description}
                    </span>
                    {ev.score && (
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 800,
                        color: isScoring ? 'var(--color-primary)' : 'var(--text-muted)',
                        whiteSpace: 'nowrap', minWidth: 36, textAlign: 'right',
                      }}>
                        {typeof ev.score === 'string' ? ev.score : `${ev.score.home}-${ev.score.away}`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!loading && log && tab === 'boxscore' && (
            <div>
              <BoxScoreTable teamObj={userTeamObj} pids={userPids} label={userTeamName} isUser={true} />
              <BoxScoreTable teamObj={oppTeamObj}  pids={oppPids}  label={oppTeamName}  isUser={false} />
            </div>
          )}

          {!loading && log && tab === 'teamstats' && userTeamStats && oppTeamStats && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, padding: '0 4px' }}>
                <div style={{ fontWeight: 800, fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)' }}>{userTeamName}</div>
                <div style={{ fontWeight: 700, fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, alignSelf: 'center' }}>TEAM STATS</div>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{oppTeamName}</div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <TeamStatsRow label="Field Goals"          home={fmt(userTeamStats.fgMade,  userTeamStats.fgAtt)}   away={fmt(oppTeamStats.fgMade,  oppTeamStats.fgAtt)}   />
                  <TeamStatsRow label="FG %"                 home={pct(userTeamStats.fgMade,  userTeamStats.fgAtt)}   away={pct(oppTeamStats.fgMade,  oppTeamStats.fgAtt)}   />
                  <TeamStatsRow label="3-Pointers"           home={fmt(userTeamStats.tpMade,  userTeamStats.tpAtt)}   away={fmt(oppTeamStats.tpMade,  oppTeamStats.tpAtt)}   />
                  <TeamStatsRow label="3-Point %"            home={pct(userTeamStats.tpMade,  userTeamStats.tpAtt)}   away={pct(oppTeamStats.tpMade,  oppTeamStats.tpAtt)}   />
                  <TeamStatsRow label="Free Throws"          home={fmt(userTeamStats.ftMade,  userTeamStats.ftAtt)}   away={fmt(oppTeamStats.ftMade,  oppTeamStats.ftAtt)}   />
                  <TeamStatsRow label="FT %"                 home={pct(userTeamStats.ftMade,  userTeamStats.ftAtt)}   away={pct(oppTeamStats.ftMade,  oppTeamStats.ftAtt)}   />
                  <TeamStatsRow label="Total Rebounds"       home={userTeamStats.reb}         away={oppTeamStats.reb}         />
                  <TeamStatsRow label="Off. Rebounds"        home={userTeamStats.offReb}      away={oppTeamStats.offReb}      />
                  <TeamStatsRow label="Def. Rebounds"        home={userTeamStats.defReb}      away={oppTeamStats.defReb}      />
                  <TeamStatsRow label="Assists"              home={userTeamStats.ast}         away={oppTeamStats.ast}         />
                  <TeamStatsRow label="Blocks"               home={userTeamStats.blk}         away={oppTeamStats.blk}         />
                  <TeamStatsRow label="Steals"               home={userTeamStats.stl}         away={oppTeamStats.stl}         />
                  <TeamStatsRow label="Turnovers"            home={userTeamStats.tov}         away={oppTeamStats.tov}         higherIsBetter={false} />
                  <TeamStatsRow label="Pts off Turnovers"    home={userTeamStats.offTovPts}   away={oppTeamStats.offTovPts}   />
                  <TeamStatsRow label="Fast Break Pts"       home={userTeamStats.fastBreak}   away={oppTeamStats.fastBreak}   />
                  <TeamStatsRow label="Paint Points"         home={userTeamStats.paintPts}    away={oppTeamStats.paintPts}    />
                  <TeamStatsRow label="Pts per Possession"   home={userTeamStats.ppp}         away={oppTeamStats.ppp}         />
                  <TeamStatsRow label="Personal Fouls"       home={userTeamStats.pf}          away={oppTeamStats.pf}          higherIsBetter={false} />
                </tbody>
              </table>
            </div>
          )}
        </div>
    </div>
  );

  if (asPage) return inner;
  return (
    <div className="modal-overlay" onClick={onClose}>
      {inner}
    </div>
  );
}
