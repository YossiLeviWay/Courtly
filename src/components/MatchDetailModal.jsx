import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { apiGetMatchLog } from '../api.js';
import { formatMatchDate } from '../engine/gameScheduler.js';

// ~1h55m — same as GAME_DURATION_SEC in matchEngine.js
const GAME_DURATION_MS = 6900 * 1000;

export const EVENT_ICONS = {
  three_pointer: '🎯', dunk: '💥', layup: '🏀', timeout: '⏱️',
  foul: '🚨', injury: '🚑', substitution: '🔄', quarter_end: '🔔',
  half_time: '🕐', comeback: '⚡', technical_foul: '🚫', fight: '⚠️',
  turnover: '❌', steal: '🤚', block: '🛡️', free_throw: '🎯', assist: '🎪',
};

/**
 * Shared Match Detail Modal.
 * Props:
 *   match        - match object (must have id, homeTeamId, awayTeamId, homeTeamName, awayTeamName, scheduledDate)
 *   allTeams     - array of all team objects (used to find player lists for box score)
 *   userTeamId   - string ID of the user's team
 *   onClose      - function called to close the modal
 */
export default function MatchDetailModal({ match, allTeams, userTeamId, onClose }) {
  const [log, setLog]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('highlights');

  // Match is "live" if it started within the last GAME_DURATION_MS and isn't marked played
  const isLive = !match.played &&
    match.scheduledDate &&
    Date.now() >= match.scheduledDate &&
    Date.now() - match.scheduledDate < GAME_DURATION_MS;

  useEffect(() => {
    setLoading(true);
    setLog(null);
    apiGetMatchLog(match.id).then(data => { setLog(data); setLoading(false); }).catch(() => setLoading(false));
  }, [match.id]);

  // Poll every 10s when match is live
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      apiGetMatchLog(match.id).then(data => { if (data) setLog(data); }).catch(() => {});
    }, 10_000);
    return () => clearInterval(interval);
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
  const userQS = isUserHome ? (rawQS[0] || []) : (rawQS[1] || []);
  const oppQS  = isUserHome ? (rawQS[1] || []) : (rawQS[0] || []);

  const events      = log?.events      || [];
  const playerStats = log?.playerStats || {};

  const homeTeam = allTeams?.find(t => t.id === match.homeTeamId);
  const awayTeam = allTeams?.find(t => t.id === match.awayTeamId);
  const allPlayers = [
    ...((isUserHome ? homeTeam : awayTeam)?.players || []).map(p => ({ ...p, side: 'user' })),
    ...((isUserHome ? awayTeam : homeTeam)?.players || []).map(p => ({ ...p, side: 'opponent' })),
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <div>
            <h3 className="card-title" style={{ marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
              {userTeamName}
              {isLive ? (
                <span className="badge" style={{ fontSize: '0.6rem', background: 'var(--color-danger)', color: 'white', animation: 'pulse 1.5s ease-in-out infinite' }}>
                  🔴 LIVE
                </span>
              ) : rawHomeScore != null ? (
                <span className={`badge ${userWon ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.6rem' }}>
                  {userWon ? 'WIN' : 'LOSS'}
                </span>
              ) : null}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>vs {oppTeamName}</span>
            </h3>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              {formatMatchDate(match.scheduledDate)} · {isUserHome ? '🏠 Home' : '✈️ Away'}
              {isLive && <span style={{ color: 'var(--color-danger)', fontWeight: 700, marginLeft: 8 }}>· Updating live…</span>}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          {/* Score banner */}
          <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24,
            padding: '16px 20px 12px', marginBottom: 16,
            background: userWon ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
            borderRadius: 'var(--radius)',
          }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: 1, color: 'var(--color-primary)', marginBottom: 4 }}>YOUR TEAM</div>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 4 }}>{userTeamName}</div>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: userWon ? 'var(--color-success)' : 'var(--color-danger)', lineHeight: 1 }}>{userScore ?? '–'}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 700 }}>FINAL</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: userWon ? 'var(--color-success)' : 'var(--color-danger)', marginTop: 2 }}>{userWon ? '🏆' : ''}</div>
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 4 }}>OPPONENT</div>
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
                  ].map((row) => (
                    <tr key={row.name} style={{ borderTop: '1px solid var(--border-color)', background: row.isUser ? 'rgba(232,98,26,0.04)' : undefined }}>
                      <td style={{ padding: '6px 8px', fontWeight: 600 }}>
                        {row.name}
                        {row.isUser && <span style={{ fontSize: '0.6rem', color: 'var(--color-primary)', marginLeft: 4 }}>★</span>}
                      </td>
                      {row.scores.map((s, qi) => <td key={qi} style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>{s}</td>)}
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 800 }}>{row.total ?? '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {loading && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>Loading match data…</div>}

          {!loading && !log && (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">No detailed log available</div>
              <div className="empty-state-desc">This match was played before detailed logs were recorded.</div>
            </div>
          )}

          {!loading && log && (
            <>
              <div className="tabs" style={{ marginBottom: 12 }}>
                <button className={`tab${tab === 'highlights' ? ' active' : ''}`} onClick={() => setTab('highlights')}>Highlights</button>
                <button className={`tab${tab === 'boxscore' ? ' active' : ''}`} onClick={() => setTab('boxscore')}>Box Score</button>
              </div>

              {tab === 'highlights' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {events.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>No highlights recorded.</div>}
                  {events.map((ev, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: ev.type === 'quarter_end' || ev.type === 'half_time' ? 'var(--bg-muted)' : 'transparent',
                      borderLeft: ev.type === 'quarter_end' || ev.type === 'half_time' ? '2px solid var(--color-primary)' : undefined,
                    }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', minWidth: 28 }}>
                        {typeof ev.time === 'number' ? `${ev.time.toFixed(0)}'` : ev.time || ''}
                      </span>
                      <span>{EVENT_ICONS[ev.type] || '🏀'}</span>
                      <span style={{ flex: 1, fontSize: 'var(--font-size-sm)' }}>{ev.description}</span>
                      {ev.score && (
                        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {typeof ev.score === 'string' ? ev.score : `${ev.score.home}-${ev.score.away}`}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {tab === 'boxscore' && (
                <div>
                  {[
                    { label: userTeamName, side: 'user',     isUser: true  },
                    { label: oppTeamName,  side: 'opponent', isUser: false },
                  ].map(({ label, side, isUser }) => {
                    const teamPlayers = allPlayers.filter(p => p.side === side);
                    const rows = teamPlayers.map(p => {
                      const s = playerStats[p.id] || {};
                      if (!s.minutesPlayed) return null;
                      const fgPct = s.fgAttempts > 0 ? ((s.fgMade / s.fgAttempts) * 100).toFixed(0) + '%' : '—';
                      return { player: p, s, fgPct };
                    }).filter(Boolean).sort((a, b) => (b.s.points || 0) - (a.s.points || 0));

                    if (rows.length === 0) return null;
                    return (
                      <div key={side} style={{ marginBottom: 20 }}>
                        <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 8, padding: '4px 0', borderBottom: `2px solid ${isUser ? 'var(--color-primary)' : 'var(--border-color)'}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {label}
                          {isUser && <span style={{ fontSize: '0.6rem', color: 'var(--color-primary)' }}>YOUR TEAM</span>}
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                            <thead>
                              <tr style={{ color: 'var(--text-muted)' }}>
                                <th style={{ textAlign: 'left', padding: '4px 6px' }}>Player</th>
                                <th style={{ padding: '4px 6px', textAlign: 'center' }}>MIN</th>
                                <th style={{ padding: '4px 6px', textAlign: 'center' }}>PTS</th>
                                <th style={{ padding: '4px 6px', textAlign: 'center' }}>REB</th>
                                <th style={{ padding: '4px 6px', textAlign: 'center' }}>AST</th>
                                <th style={{ padding: '4px 6px', textAlign: 'center' }}>STL</th>
                                <th style={{ padding: '4px 6px', textAlign: 'center' }}>BLK</th>
                                <th style={{ padding: '4px 6px', textAlign: 'center' }}>FG%</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map(({ player, s, fgPct }) => (
                                <tr key={player.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                                  <td style={{ padding: '5px 6px', fontWeight: 600 }}>
                                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginRight: 4 }}>{player.position}</span>
                                    {player.name}
                                  </td>
                                  <td style={{ padding: '5px 6px', textAlign: 'center', color: 'var(--text-muted)' }}>{s.minutesPlayed}</td>
                                  <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 700, color: (s.points || 0) >= 20 ? 'var(--color-primary)' : 'inherit' }}>{s.points ?? 0}</td>
                                  <td style={{ padding: '5px 6px', textAlign: 'center' }}>{s.rebounds ?? 0}</td>
                                  <td style={{ padding: '5px 6px', textAlign: 'center' }}>{s.assists ?? 0}</td>
                                  <td style={{ padding: '5px 6px', textAlign: 'center' }}>{s.steals ?? 0}</td>
                                  <td style={{ padding: '5px 6px', textAlign: 'center' }}>{s.blocks ?? 0}</td>
                                  <td style={{ padding: '5px 6px', textAlign: 'center', color: 'var(--text-muted)' }}>{fgPct}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
