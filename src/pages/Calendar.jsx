import { useState, useMemo, useEffect } from 'react';
import { useGame } from '../context/GameContext.jsx';
import { Calendar as CalendarIcon, Clock, MapPin, Plus, ChevronLeft, ChevronRight, Zap, X } from 'lucide-react';
import { getNextMatch, formatMatchDate, getTimeUntilMatch } from '../engine/gameScheduler.js';
import { useNavigate } from 'react-router-dom';
import { apiGetMatchLog } from '../api.js';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

// ── Match Detail Modal ────────────────────────────────────────

const EVENT_ICONS = {
  three_pointer: '🎯', dunk: '💥', layup: '🏀', timeout: '⏱️',
  foul: '🚨', injury: '🚑', substitution: '🔄', quarter_end: '🔔',
  half_time: '🕐', comeback: '⚡', technical_foul: '🚫', fight: '⚠️',
  turnover: '❌', steal: '🤚', block: '🛡️', free_throw: '🎯', assist: '🎪',
};

function MatchDetailModal({ match, allTeams, onClose }) {
  const [log, setLog]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('highlights');

  useEffect(() => {
    apiGetMatchLog(match.id).then(data => { setLog(data); setLoading(false); });
  }, [match.id]);

  const homeScore     = match.result?.homeScore ?? match.homeScore ?? log?.homeScore;
  const awayScore     = match.result?.awayScore ?? match.awayScore ?? log?.awayScore;
  const quarterScores = log?.quarterScores || [];
  const events        = log?.events        || [];
  const playerStats   = log?.playerStats   || {};

  const homeTeam = allTeams?.find(t => t.id === match.homeTeamId);
  const awayTeam = allTeams?.find(t => t.id === match.awayTeamId);
  const allPlayers = [
    ...(homeTeam?.players || []).map(p => ({ ...p, teamId: match.homeTeamId })),
    ...(awayTeam?.players || []).map(p => ({ ...p, teamId: match.awayTeamId })),
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <div>
            <h3 className="card-title" style={{ marginBottom: 2 }}>
              {match.homeTeamName} vs {match.awayTeamName}
            </h3>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              {formatMatchDate(match.scheduledDate)}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          {/* Score banner */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24, padding: '16px 0 12px', marginBottom: 16 }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 4 }}>{match.homeTeamName}</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: homeScore > awayScore ? 'var(--color-success)' : 'var(--text-primary)', lineHeight: 1 }}>{homeScore ?? '–'}</div>
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', fontWeight: 700 }}>FINAL</div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 4 }}>{match.awayTeamName}</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: awayScore > homeScore ? 'var(--color-success)' : 'var(--text-primary)', lineHeight: 1 }}>{awayScore ?? '–'}</div>
            </div>
          </div>

          {/* Quarter scores */}
          {quarterScores.length > 0 && (
            <div style={{ overflowX: 'auto', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                    <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 700 }}>Team</th>
                    {quarterScores[0]?.map((_, qi) => (
                      <th key={qi} style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 700 }}>Q{qi + 1}</th>
                    ))}
                    <th style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 700 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: match.homeTeamName, scores: quarterScores[0] || [], total: homeScore },
                    { name: match.awayTeamName, scores: quarterScores[1] || [], total: awayScore },
                  ].map((row, ri) => (
                    <tr key={ri} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 600 }}>{row.name}</td>
                      {row.scores.map((s, qi) => (
                        <td key={qi} style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>{s}</td>
                      ))}
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 800 }}>{row.total ?? '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>Loading match data…</div>
          )}

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
              <div className="tabs" style={{ marginBottom: 12 }}>
                <button className={`tab${tab === 'highlights' ? ' active' : ''}`} onClick={() => setTab('highlights')}>Highlights</button>
                <button className={`tab${tab === 'boxscore' ? ' active' : ''}`} onClick={() => setTab('boxscore')}>Box Score</button>
              </div>

              {tab === 'highlights' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {events.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>No highlights recorded.</div>}
                  {events.map((ev, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: ev.type === 'quarter_end' || ev.type === 'half_time' ? 'var(--bg-muted)' : 'transparent',
                        borderLeft: ev.type === 'quarter_end' || ev.type === 'half_time' ? '2px solid var(--color-primary)' : undefined,
                      }}
                    >
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
                    { teamName: match.homeTeamName, teamId: match.homeTeamId },
                    { teamName: match.awayTeamName, teamId: match.awayTeamId },
                  ].map(({ teamName, teamId }) => {
                    const teamPlayers = allPlayers.filter(p => p.teamId === teamId);
                    const rows = teamPlayers.map(p => {
                      const s = playerStats[p.id] || {};
                      if (!s.minutesPlayed) return null;
                      const fgPct = s.fgAttempts > 0 ? ((s.fgMade / s.fgAttempts) * 100).toFixed(0) + '%' : '—';
                      return { player: p, s, fgPct };
                    }).filter(Boolean).sort((a, b) => (b.s.points || 0) - (a.s.points || 0));

                    if (rows.length === 0) return null;
                    return (
                      <div key={teamId} style={{ marginBottom: 20 }}>
                        <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 8, padding: '4px 0', borderBottom: '2px solid var(--color-primary)' }}>{teamName}</div>
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

// ── Opponent Fixture Modal ─────────────────────────────────────

function OpponentModal({ team, opponentId, userTeam, allMatches, scouts, onClose, onMatchClick }) {
  const opponentMatches = useMemo(() =>
    allMatches
      .filter(m => m.homeTeamId === opponentId || m.awayTeamId === opponentId)
      .sort((a, b) => a.scheduledDate - b.scheduledDate),
    [allMatches, opponentId]
  );

  const nextUserMatch = useMemo(() =>
    allMatches
      .filter(m => !m.played && (m.homeTeamId === userTeam?.id || m.awayTeamId === userTeam?.id))
      .sort((a, b) => a.scheduledDate - b.scheduledDate)[0] || null,
    [allMatches, userTeam]
  );

  const isNextOpponent =
    nextUserMatch &&
    (nextUserMatch.homeTeamId === opponentId || nextUserMatch.awayTeamId === opponentId);

  // Scout intel: show if user has any active scout and this is the next opponent
  const activeScout = scouts?.find(s => s.missionStatus === 'scouting');
  const showScoutIntel = isNextOpponent && activeScout;

  // Build opponent intel from match history
  const opponentWins   = opponentMatches.filter(m => m.played && ((m.homeTeamId === opponentId && m.result?.homeScore > m.result?.awayScore) || (m.awayTeamId === opponentId && m.result?.awayScore > m.result?.homeScore))).length;
  const opponentLosses = opponentMatches.filter(m => m.played).length - opponentWins;

  const upcoming = opponentMatches.filter(m => !m.played);
  const past     = opponentMatches.filter(m =>  m.played);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3 className="card-title">{team?.name || 'Opponent'} — Fixtures</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Scout Intel Banner */}
          {showScoutIntel && (
            <div style={{
              marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius)',
              background: 'rgba(232,98,26,0.06)', border: '1px solid rgba(232,98,26,0.2)',
            }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                🔭 Scout Intel — {activeScout.name} reporting from {activeScout.missionTarget}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Your scout is active and has flagged this as your next opponent. Based on available data:
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ padding: '6px 10px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                  📊 Season: {opponentWins}W–{opponentLosses}L
                </div>
                <div style={{ padding: '6px 10px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                  🏀 {upcoming.length} games remaining
                </div>
                {past.length > 0 && (
                  <div style={{ padding: '6px 10px', background: past[past.length-1]?.result ? 'rgba(34,197,94,0.1)' : 'var(--bg-muted)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                    Last result: {(() => {
                      const m = past[past.length-1];
                      if (!m?.result) return '—';
                      const won = m.homeTeamId === opponentId ? m.result.homeScore > m.result.awayScore : m.result.awayScore > m.result.homeScore;
                      return (won ? '✓ Win' : '✗ Loss') + ` ${m.result.homeScore}–${m.result.awayScore}`;
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upcoming matches */}
          {upcoming.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 8 }}>
                Upcoming ({upcoming.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {upcoming.slice(0, 6).map(m => {
                  const isHome = m.homeTeamId === opponentId;
                  const opp = isHome ? m.awayTeamName : m.homeTeamName;
                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)' }}>
                      <div>
                        <span className={`badge ${isHome ? 'badge-orange' : 'badge-gray'}`} style={{ fontSize: '0.55rem', marginRight: 6 }}>
                          {isHome ? 'H' : 'A'}
                        </span>
                        vs {opp}
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                        {formatMatchDate(m.scheduledDate)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Past results */}
          {past.length > 0 && (
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 8 }}>
                Results ({past.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...past].reverse().slice(0, 6).map(m => {
                  const isHome = m.homeTeamId === opponentId;
                  const opp = isHome ? m.awayTeamName : m.homeTeamName;
                  const won = isHome
                    ? m.result?.homeScore > m.result?.awayScore
                    : m.result?.awayScore > m.result?.homeScore;
                  return (
                    <div
                      key={m.id}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)', cursor: onMatchClick ? 'pointer' : 'default' }}
                      onClick={() => onMatchClick?.(m)}
                      title={onMatchClick ? 'Click to view match details' : undefined}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className={`badge ${won ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.55rem' }}>{won ? 'W' : 'L'}</span>
                        vs {opp}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700 }}>{m.result?.homeScore}–{m.result?.awayScore}</span>
                        {onMatchClick && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>📊</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {opponentMatches.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">🏀</div>
              <div className="empty-state-title">No fixtures found</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Calendar Page ────────────────────────────────────────

export default function Calendar() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  const team = state.userTeam;
  const [activeTab, setActiveTab]     = useState('all');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent]       = useState({ title: '', date: '', description: '' });
  const [selectedOpponent, setSelectedOpponent] = useState(null); // { id, name }
  const [selectedMatch, setSelectedMatch]       = useState(null); // played match for detail view

  // Firestore-backed schedule from state (stable across refreshes)
  const schedule = useMemo(() => {
    if (!team || !state.leagues?.length) return [];
    const userLeague = state.leagues.find(l => l.teams?.some(t => t.id === team.id));
    return userLeague?.schedule || [];
  }, [team, state.leagues]);

  // All league matches (for opponent modal)
  const allLeagueMatches = useMemo(() =>
    (state.leagues || []).flatMap(l => l.schedule || []),
    [state.leagues]
  );

  const teamMatches = useMemo(() =>
    schedule.filter(m => m.homeTeamId === team?.id || m.awayTeamId === team?.id),
    [schedule, team]
  );

  const nextMatch   = useMemo(() => teamMatches.find(m => !m.played && m.scheduledDate > Date.now()), [teamMatches]);
  const pastMatches = useMemo(() => teamMatches.filter(m =>  m.played).sort((a,b) => b.scheduledDate - a.scheduledDate), [teamMatches]);
  const upcomingMatches = useMemo(() => teamMatches.filter(m => !m.played).sort((a,b) => a.scheduledDate - b.scheduledDate), [teamMatches]);

  const events = team?.calendarEvents || [];
  const scouts = team?.scouts || [];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const matchDays = new Set(
    teamMatches
      .filter(m => {
        const d = new Date(m.scheduledDate);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .map(m => new Date(m.scheduledDate).getDate())
  );

  const getTeamById = id => state.allTeams?.find(t => t.id === id);
  const getTeamName = id => getTeamById(id)?.name || 'Unknown';

  const filteredMatches = activeTab === 'past' ? pastMatches
    : activeTab === 'upcoming' ? upcomingMatches
    : activeTab === 'events' ? []
    : [...upcomingMatches, ...pastMatches].sort((a,b) => a.scheduledDate - b.scheduledDate);

  const addEvent = () => {
    if (!newEvent.title || !newEvent.date) return;
    const ev = { ...newEvent, id: Date.now().toString() };
    const updated = { ...team, calendarEvents: [...events, ev] };
    dispatch({ type: 'UPDATE_TEAM', payload: updated });
    setNewEvent({ title: '', date: '', description: '' });
    setShowAddEvent(false);
  };

  function handleMatchClick(match) {
    if (match.played) {
      setSelectedMatch(match);
    } else {
      const isHome = match.homeTeamId === team?.id;
      const oppId   = isHome ? match.awayTeamId : match.homeTeamId;
      const oppName = isHome ? match.awayTeamName : match.homeTeamName;
      setSelectedOpponent({ id: oppId, name: oppName });
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>Calendar & Fixtures</h1>
        <p>Your season schedule, key deadlines, and personal events</p>
      </div>

      {/* Next Match Banner */}
      {nextMatch && (
        <div className="card card-highlight mb-4" style={{ marginBottom: '1.5rem' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="badge badge-orange" style={{ marginBottom: 8, background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                NEXT MATCH
              </div>
              <h3 style={{ color: 'white', fontSize: 'var(--font-size-xl)', fontWeight: 800 }}>
                {team?.name} vs {getTeamName(nextMatch.homeTeamId === team?.id ? nextMatch.awayTeamId : nextMatch.homeTeamId)}
              </h3>
              <div className="flex items-center gap-3" style={{ marginTop: 6, color: 'rgba(255,255,255,0.8)', fontSize: 'var(--font-size-sm)' }}>
                <span><Clock size={14} style={{ display: 'inline', marginRight: 4 }} />{formatMatchDate(nextMatch.scheduledDate)}</span>
                <span><MapPin size={14} style={{ display: 'inline', marginRight: 4 }} />
                  {nextMatch.homeTeamId === team?.id ? `🏠 Home - ${team?.stadiumName}` : '✈️ Away'}
                </span>
              </div>
            </div>
            <div className="text-center">
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>IN</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'white', letterSpacing: 2 }}>
                {getTimeUntilMatch(nextMatch)}
              </div>
              <button
                className="btn btn-sm"
                style={{ marginTop: 8, background: 'white', color: 'var(--color-primary)', fontWeight: 700 }}
                onClick={() => navigate('/match/live')}
              >
                <Zap size={14} /> Go Live
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid-2" style={{ gap: '1.5rem' }}>
        {/* Fixture List */}
        <div>
          <div className="tabs">
            {[['all','All'],['upcoming','Upcoming'],['past','Results'],['events','Events']].map(([k,l]) => (
              <button key={k} className={`tab${activeTab===k?' active':''}`} onClick={() => setActiveTab(k)}>{l}</button>
            ))}
          </div>

          {activeTab === 'events' ? (
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="font-semibold text-sm">Personal Events</span>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddEvent(true)}>
                  <Plus size={14} /> Add Event
                </button>
              </div>
              {events.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><CalendarIcon size={40} /></div>
                  <div className="empty-state-title">No events yet</div>
                  <div className="empty-state-desc">Add custom events like training camps or scouting trips</div>
                </div>
              ) : events.map(ev => (
                <div key={ev.id} className="card mb-2">
                  <div className="font-semibold">{ev.title}</div>
                  <div className="text-sm text-muted">{ev.date}</div>
                  {ev.description && <div className="text-xs text-muted mt-1">{ev.description}</div>}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredMatches.slice(0, 18).map((match) => {
                const isHome = match.homeTeamId === team?.id;
                const oppId  = isHome ? match.awayTeamId : match.homeTeamId;
                const opponent = getTeamName(oppId);
                const isPast = match.played;
                const result = match.result;
                const userScore = result ? (isHome ? result.homeScore : result.awayScore) : null;
                const oppScore  = result ? (isHome ? result.awayScore  : result.homeScore) : null;
                const won = userScore > oppScore;
                const isNextOpponent = nextMatch && (nextMatch.homeTeamId === oppId || nextMatch.awayTeamId === oppId) && !isPast;
                const hasScout = scouts.some(s => s.missionStatus === 'scouting');

                return (
                  <div
                    key={match.id}
                    className="card"
                    style={{ padding: '12px 16px', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                    onClick={() => handleMatchClick(match)}
                    title={match.played ? 'Click to view match details' : "Click to see this team's fixtures"}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`badge ${isHome ? 'badge-orange' : 'badge-gray'}`} style={{ fontSize: '0.6rem' }}>
                            {isHome ? '🏠 HOME' : '✈️ AWAY'}
                          </span>
                          <span className="text-xs text-muted">{formatMatchDate(match.scheduledDate)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-sm">vs {opponent}</div>
                          {isNextOpponent && hasScout && (
                            <span className="badge badge-orange" style={{ fontSize: '0.55rem' }}>🔭 Scout</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {isPast && result ? (
                          <div>
                            <div className={`badge ${won ? 'badge-green' : 'badge-red'}`} style={{ marginBottom: 4 }}>
                              {won ? 'W' : 'L'}
                            </div>
                            <div className="font-bold" style={{ fontSize: 'var(--font-size-lg)' }}>
                              {userScore} - {oppScore}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
                            {getTimeUntilMatch(match)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredMatches.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-icon">🏀</div>
                  <div className="empty-state-title">No matches found</div>
                </div>
              )}
              {filteredMatches.length > 0 && (
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textAlign: 'center', marginTop: 4 }}>
                  Past matches: click to view details · Upcoming: click to see opponent schedule
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mini Calendar + Season Summary + Deadlines */}
        <div>
          <div className="card mb-4">
            <div className="card-header">
              <span className="card-title">{MONTHS[month]} {year}</span>
              <div className="flex gap-2">
                <button className="btn btn-ghost btn-sm" style={{ padding: 6 }} onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth()-1))}>
                  <ChevronLeft size={16} />
                </button>
                <button className="btn btn-ghost btn-sm" style={{ padding: 6 }} onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth()+1))}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' }}>
              {DAYS.map(d => <div key={d} style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', padding: '4px 0' }}>{d}</div>)}
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;
                const hasMatch = matchDays.has(day);
                return (
                  <div key={day} style={{
                    padding: '6px 2px', borderRadius: 6,
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: isToday || hasMatch ? 700 : 400,
                    background: isToday ? 'var(--color-primary)' : hasMatch ? 'var(--color-primary-100)' : 'transparent',
                    color: isToday ? 'white' : hasMatch ? 'var(--color-primary)' : 'var(--text-primary)',
                    position: 'relative',
                  }}>
                    {day}
                    {hasMatch && !isToday && <div style={{ width: 4, height: 4, background: 'var(--color-primary)', borderRadius: '50%', margin: '0 auto' }} />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Season Summary */}
          <div className="card mb-4">
            <div className="card-title mb-3">Season Record</div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1, textAlign: 'center', padding: '10px 8px', borderRadius: 'var(--radius-md)', background: 'rgba(46,125,50,0.08)' }}>
                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-success)' }}>{team?.wins ?? 0}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 700 }}>WINS</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '10px 8px', borderRadius: 'var(--radius-md)', background: 'rgba(198,40,40,0.08)' }}>
                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-danger)' }}>{team?.losses ?? 0}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 700 }}>LOSSES</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '10px 8px', borderRadius: 'var(--radius-md)', background: 'var(--bg-muted)' }}>
                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--text-primary)' }}>
                  {(team?.wins ?? 0) + (team?.losses ?? 0)}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 700 }}>PLAYED</div>
              </div>
            </div>
            {pastMatches.length > 0 && (
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Form (last 5)</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {pastMatches.slice(0, 5).map((m, i) => {
                    const isHome = m.homeTeamId === team?.id;
                    const us = isHome ? m.result?.homeScore : m.result?.awayScore;
                    const them = isHome ? m.result?.awayScore : m.result?.homeScore;
                    const won = us > them;
                    return (
                      <div key={i} style={{
                        width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                        background: won ? 'var(--color-success)' : 'var(--color-danger)',
                        color: 'white', fontWeight: 800, fontSize: 'var(--font-size-xs)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{won ? 'W' : 'L'}</div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Key Deadlines */}
          <div className="card">
            <div className="card-title mb-3">Key Deadlines</div>
            {[
              { label: 'Youth Academy Draft', desc: '1st of every month', icon: '🌱', color: 'badge-green' },
              { label: 'Training Reset',      desc: 'Every 7 days',       icon: '🏋️', color: 'badge-blue'  },
              { label: 'Transfer Window',     desc: 'Pre-season & mid-season', icon: '🔄', color: 'badge-orange' },
              { label: 'Season End',          desc: '18 matches played',  icon: '🏆', color: 'badge-yellow' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3" style={{ marginBottom: 12 }}>
                <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                <div>
                  <div className="text-sm font-semibold">{item.label}</div>
                  <div className="text-xs text-muted">{item.desc}</div>
                </div>
                <span className={`badge ${item.color} ml-auto`}>Active</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
      {showAddEvent && (
        <div className="modal-overlay" onClick={() => setShowAddEvent(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="card-title">Add Custom Event</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddEvent(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Event Title</label>
                <input className="form-input" value={newEvent.title} onChange={e => setNewEvent(p => ({...p, title: e.target.value}))} placeholder="e.g., Scouting Trip" />
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={newEvent.date} onChange={e => setNewEvent(p => ({...p, date: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <textarea className="form-textarea" value={newEvent.description} onChange={e => setNewEvent(p => ({...p, description: e.target.value}))} placeholder="Notes about this event..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowAddEvent(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addEvent}>Add Event</button>
            </div>
          </div>
        </div>
      )}

      {/* Opponent Fixture Modal */}
      {selectedOpponent && (
        <OpponentModal
          team={getTeamById(selectedOpponent.id)}
          opponentId={selectedOpponent.id}
          userTeam={team}
          allMatches={allLeagueMatches}
          scouts={scouts}
          onClose={() => setSelectedOpponent(null)}
          onMatchClick={m => { setSelectedOpponent(null); setSelectedMatch(m); }}
        />
      )}

      {/* Match Detail Modal */}
      {selectedMatch && (
        <MatchDetailModal
          match={selectedMatch}
          allTeams={state.allTeams}
          onClose={() => setSelectedMatch(null)}
        />
      )}
    </div>
  );
}
