import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { apiGetMatchLog } from '../api.js';
import { formatMatchDate } from '../engine/gameScheduler.js';

const GAME_DURATION_MS = 6900 * 1000;

export const EVENT_ICONS = {
  three_pointer: '🎯', dunk: '💥', layup: '🏀', timeout: '⏱️',
  foul: '🚨', injury: '🚑', substitution: '🔄', quarter_end: '🔔',
  half_time: '🕐', comeback: '⚡', technical_foul: '🚫', fight: '⚠️',
  turnover: '❌', steal: '🤚', block: '🛡️', free_throw: '🎯', assist: '🎪',
  game_start: '🏀', midrange: '🏀',
};

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
      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: homeWins ? 800 : 400, color: homeWins ? 'var(--color-primary)' : 'inherit' }}>{home}</td>
      <td style={{ padding: '6px 10px', textAlign: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</td>
      <td style={{ padding: '6px 10px', textAlign: 'left', fontWeight: awayWins ? 800 : 400, color: awayWins ? 'var(--color-primary)' : 'inherit' }}>{away}</td>
    </tr>
  );
}

export default function MatchDetailModal({ match, allTeams, userTeamId, onClose }) {
  const [log, setLog]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('highlights');

  const isLive = !match.played &&
    match.scheduledDate &&
    Date.now() >= match.scheduledDate &&
    Date.now() - match.scheduledDate < GAME_DURATION_MS;

  useEffect(() => {
    setLoading(true); setLog(null);
    apiGetMatchLog(match.id).then(d => { setLog(d); setLoading(false); }).catch(() => setLoading(false));
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
  const homeQS = rawQS[0] || [];
  const awayQS = rawQS[1] || [];
  const userQS = isUserHome ? homeQS : awayQS;
  const oppQS  = isUserHome ? awayQS : homeQS;

  const events      = log?.events      || [];
  const playerStats = log?.playerStats || {};

  const homeTeam    = allTeams?.find(t => t.id === match.homeTeamId);
  const awayTeam    = allTeams?.find(t => t.id === match.awayTeamId);
  const homePids    = new Set((homeTeam?.players || []).map(p => p.id));
  const awayPids    = new Set((awayTeam?.players || []).map(p => p.id));

  // Fallback: if teams aren't in allTeams, partition by log playerStats teamId
  const homeStatsPlayers = Object.values(playerStats).filter(s =>
    homePids.size > 0 ? homePids.has(s.playerId) : true
  );

  const userTeamObj = isUserHome ? homeTeam : awayTeam;
  const oppTeamObj  = isUserHome ? awayTeam : homeTeam;
  const userPids    = isUserHome ? homePids : awayPids;
  const oppPids     = isUserHome ? awayPids : homePids;

  const hasStats = Object.keys(playerStats).length > 0;

  const userTeamStats = hasStats ? computeTeamStats(playerStats, userPids) : null;
  const oppTeamStats  = hasStats ? computeTeamStats(playerStats, oppPids)  : null;

  // Box score rows for one side
  function BoxScoreTable({ teamObj, pids, label, isUser }) {
    const rows = Object.values(playerStats)
      .filter(s => pids.size > 0 ? pids.has(s.playerId) : !!(s.minutesPlayed))
      .filter(s => s.minutesPlayed > 0)
      .sort((a, b) => (b.points || 0) - (a.points || 0));

    const player = (s) => teamObj?.players?.find(p => p.id === s.playerId);

    if (rows.length === 0) return null;
    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 8, borderBottom: `2px solid ${isUser ? 'var(--color-primary)' : 'var(--border-color)'}`, paddingBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          {label} {isUser && <span style={{ fontSize: '0.6rem', color: 'var(--color-primary)', fontWeight: 800 }}>YOUR TEAM</span>}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                {['Player', 'MIN', 'PTS', 'FG', '3PT', 'FT', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PF'].map(h => (
                  <th key={h} style={{ padding: '4px 6px', textAlign: h === 'Player' ? 'left' : 'center', fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(s => {
                const p = player(s);
                const pos = s.position || p?.position || '';
                return (
                  <tr key={s.playerId} style={{ borderTop: '1px solid var(--border-color)', background: (s.points || 0) >= 20 ? 'rgba(232,98,26,0.04)' : undefined }}>
                    <td style={{ padding: '5px 6px', fontWeight: 600, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginRight: 4 }}>{pos}</span>
                      {s.playerName || p?.name || '—'}
                    </td>
                    <td style={{ padding: '5px 6px', textAlign: 'center', color: 'var(--text-muted)' }}>{s.minutesPlayed ?? '—'}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 800, color: (s.points || 0) >= 20 ? 'var(--color-primary)' : 'inherit' }}>{s.points ?? 0}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'center' }}>{fmt(s.fgMade, s.fgAttempts)}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'center' }}>{fmt(s.threePtMade, s.threePtAttempts)}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'center' }}>{fmt(s.ftMade, s.ftAttempts)}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: (s.rebounds || 0) >= 10 ? 700 : 400 }}>{s.rebounds ?? 0}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: (s.assists || 0) >= 10 ? 700 : 400 }}>{s.assists ?? 0}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'center' }}>{s.steals ?? 0}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'center' }}>{s.blocks ?? 0}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'center', color: (s.turnovers || 0) >= 5 ? 'var(--color-danger)' : 'inherit' }}>{s.turnovers ?? 0}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'center', color: (s.fouls || 0) >= 5 ? 'var(--color-danger)' : 'inherit' }}>{s.fouls ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720, width: '96vw' }}>
        <div className="modal-header">
          <div>
            <h3 className="card-title" style={{ marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {isUserHome ? match.homeTeamName : match.awayTeamName}
              {isLive ? (
                <span className="badge" style={{ fontSize: '0.6rem', background: 'var(--color-danger)', color: 'white' }}>🔴 LIVE</span>
              ) : rawHomeScore != null ? (
                <span className={`badge ${userWon ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.6rem' }}>{userWon ? 'WIN' : 'LOSS'}</span>
              ) : null}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>vs {isUserHome ? match.awayTeamName : match.homeTeamName}</span>
            </h3>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              {formatMatchDate(match.scheduledDate)} · {isUserHome ? '🏠 Home' : '✈️ Away'}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
          {/* Score banner */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24, padding: '16px 20px 12px', marginBottom: 16, background: rawHomeScore != null ? (userWon ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)') : 'var(--bg-muted)', borderRadius: 'var(--radius)' }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: 1, color: 'var(--color-primary)', marginBottom: 4 }}>
                {isUserHome ? 'HOME' : 'AWAY'}
              </div>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 4 }}>{userTeamName}</div>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: userWon ? 'var(--color-success)' : rawHomeScore != null ? 'var(--color-danger)' : 'var(--text-muted)', lineHeight: 1 }}>{userScore ?? '–'}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 700 }}>{rawHomeScore != null ? 'FINAL' : 'UPCOMING'}</div>
              {rawHomeScore != null && <div style={{ fontSize: '1.1rem', fontWeight: 800, color: userWon ? 'var(--color-success)' : 'var(--color-danger)', marginTop: 2 }}>{userWon ? '🏆' : ''}</div>}
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 4 }}>
                {isUserHome ? 'AWAY' : 'HOME'}
              </div>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 4 }}>{oppTeamName}</div>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>{oppScore ?? '–'}</div>
            </div>
          </div>

          {/* Quarter scores */}
          {userQS.length > 0 && (
            <div style={{ overflowX: 'auto', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                    <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 700 }}>Team</th>
                    {userQS.map((_, qi) => <th key={qi} style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 700 }}>Q{qi + 1}</th>)}
                    <th style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 700 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: userTeamName, scores: userQS, total: userScore, isUser: true },
                    { name: oppTeamName,  scores: oppQS,  total: oppScore,  isUser: false },
                  ].map(row => (
                    <tr key={row.name} style={{ borderTop: '1px solid var(--border-color)', background: row.isUser ? 'rgba(232,98,26,0.04)' : undefined }}>
                      <td style={{ padding: '6px 8px', fontWeight: 600 }}>
                        {row.name}{row.isUser && <span style={{ fontSize: '0.6rem', color: 'var(--color-primary)', marginLeft: 4 }}>★</span>}
                      </td>
                      {row.scores.map((s, qi) => <td key={qi} style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>{s}</td>)}
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 800 }}>{row.total ?? '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {loading && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Loading match data…</div>}

          {!loading && !log && (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">No detailed log available</div>
              <div className="empty-state-desc">This match was played before detailed logs were recorded.</div>
            </div>
          )}

          {!loading && log && (
            <>
              {/* Tabs */}
              <div style={{ display: 'flex', gap: 2, marginBottom: 12, borderBottom: '2px solid var(--border-color)' }}>
                {[
                  { id: 'highlights', label: '📋 Highlights' },
                  { id: 'boxscore',   label: '📊 Box Score' },
                  { id: 'teamstats', label: '📈 Team Stats' },
                ].map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)} style={{
                    padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer',
                    fontWeight: tab === t.id ? 800 : 400, fontSize: 'var(--font-size-sm)',
                    color: tab === t.id ? 'var(--color-primary)' : 'var(--text-muted)',
                    borderBottom: tab === t.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                    marginBottom: -2,
                  }}>{t.label}</button>
                ))}
              </div>

              {/* Highlights tab */}
              {tab === 'highlights' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {events.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>No highlights recorded.</div>}
                  {events.map((ev, i) => {
                    const isBreak = ev.type === 'quarter_end' || ev.type === 'half_time' || ev.type === 'game_start';
                    return (
                      <div key={i} style={{
                        display: 'flex', gap: 8, alignItems: 'flex-start', padding: '7px 10px',
                        borderRadius: 'var(--radius-sm)',
                        background: isBreak ? 'var(--bg-muted)' : 'transparent',
                        borderLeft: isBreak ? '3px solid var(--color-primary)' : '3px solid transparent',
                      }}>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', minWidth: 28, paddingTop: 1 }}>
                          {ev.type === 'game_start' ? 'TIP' : typeof ev.time === 'number' ? `${ev.time.toFixed(0)}'` : ev.time || ''}
                        </span>
                        <span>{EVENT_ICONS[ev.type] || '🏀'}</span>
                        <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', lineHeight: 1.4 }}>{ev.description}</span>
                        {ev.score && (
                          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {typeof ev.score === 'string' ? ev.score : `${ev.score.home}-${ev.score.away}`}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Box Score tab */}
              {tab === 'boxscore' && (
                <div>
                  <BoxScoreTable teamObj={userTeamObj} pids={userPids} label={userTeamName} isUser={true} />
                  <BoxScoreTable teamObj={oppTeamObj}  pids={oppPids}  label={oppTeamName}  isUser={false} />
                </div>
              )}

              {/* Team Stats tab */}
              {tab === 'teamstats' && userTeamStats && oppTeamStats && (
                <div>
                  {/* Header row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 10px' }}>
                    <div style={{ fontWeight: 800, fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)' }}>{userTeamName}</div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>TEAM STATS</div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{oppTeamName}</div>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                    <tbody>
                      <TeamStatsRow label="Field Goals" home={`${fmt(userTeamStats.fgMade, userTeamStats.fgAtt)}`} away={`${fmt(oppTeamStats.fgMade, oppTeamStats.fgAtt)}`} />
                      <TeamStatsRow label="FG %" home={pct(userTeamStats.fgMade, userTeamStats.fgAtt)} away={pct(oppTeamStats.fgMade, oppTeamStats.fgAtt)} />
                      <TeamStatsRow label="3-Pointers" home={fmt(userTeamStats.tpMade, userTeamStats.tpAtt)} away={fmt(oppTeamStats.tpMade, oppTeamStats.tpAtt)} />
                      <TeamStatsRow label="3-Point %" home={pct(userTeamStats.tpMade, userTeamStats.tpAtt)} away={pct(oppTeamStats.tpMade, oppTeamStats.tpAtt)} />
                      <TeamStatsRow label="Free Throws" home={fmt(userTeamStats.ftMade, userTeamStats.ftAtt)} away={fmt(oppTeamStats.ftMade, oppTeamStats.ftAtt)} />
                      <TeamStatsRow label="FT %" home={pct(userTeamStats.ftMade, userTeamStats.ftAtt)} away={pct(oppTeamStats.ftMade, oppTeamStats.ftAtt)} />
                      <TeamStatsRow label="Total Rebounds" home={userTeamStats.reb} away={oppTeamStats.reb} />
                      <TeamStatsRow label="Offensive Rebounds" home={userTeamStats.offReb} away={oppTeamStats.offReb} />
                      <TeamStatsRow label="Defensive Rebounds" home={userTeamStats.defReb} away={oppTeamStats.defReb} />
                      <TeamStatsRow label="Assists" home={userTeamStats.ast} away={oppTeamStats.ast} />
                      <TeamStatsRow label="Blocks" home={userTeamStats.blk} away={oppTeamStats.blk} />
                      <TeamStatsRow label="Steals" home={userTeamStats.stl} away={oppTeamStats.stl} />
                      <TeamStatsRow label="Turnovers" home={userTeamStats.tov} away={oppTeamStats.tov} higherIsBetter={false} />
                      <TeamStatsRow label="Points off Turnovers" home={userTeamStats.offTovPts} away={oppTeamStats.offTovPts} />
                      <TeamStatsRow label="Fast Break Points" home={userTeamStats.fastBreak} away={oppTeamStats.fastBreak} />
                      <TeamStatsRow label="Points in the Paint" home={userTeamStats.paintPts} away={oppTeamStats.paintPts} />
                      <TeamStatsRow label="Points per Possession" home={userTeamStats.ppp} away={oppTeamStats.ppp} />
                      <TeamStatsRow label="Personal Fouls" home={userTeamStats.pf} away={oppTeamStats.pf} higherIsBetter={false} />
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
