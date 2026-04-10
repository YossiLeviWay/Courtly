import { useState, useMemo, useEffect } from 'react';
import { useGame } from '../context/GameContext.jsx';
import { Calendar as CalendarIcon, Clock, MapPin, Plus, ChevronLeft, ChevronRight, Zap, X, MessageCircle, Send } from 'lucide-react';
import { getNextMatch, formatMatchDate, getTimeUntilMatch } from '../engine/gameScheduler.js';
import { useNavigate } from 'react-router-dom';
import { apiGetTeamUserMap } from '../api.js';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDayOfMonth(y, m) { return new Date(y, m, 1).getDay(); }

// ── Scout Report Component ─────────────────────────────────────

function ScoutReport({ team, matches, userTeamId }) {
  if (!team) return null;
  const players   = team.players || [];
  const tactics   = team.tactics || {};
  const teamId    = team.id;

  // Match record for this team
  const played = matches.filter(m => (m.homeTeamId === teamId || m.awayTeamId === teamId) && m.played);
  const wins   = played.filter(m => {
    const isHome = m.homeTeamId === teamId;
    const us = isHome ? m.result?.homeScore : m.result?.awayScore;
    const them = isHome ? m.result?.awayScore : m.result?.homeScore;
    return (us ?? 0) > (them ?? 0);
  }).length;
  const losses = played.length - wins;

  // Recent form (last 5)
  const recent5 = [...played].sort((a, b) => b.scheduledDate - a.scheduledDate).slice(0, 5).reverse();
  const form = recent5.map(m => {
    const isHome = m.homeTeamId === teamId;
    const us = isHome ? m.result?.homeScore : m.result?.awayScore;
    const them = isHome ? m.result?.awayScore : m.result?.homeScore;
    return (us ?? 0) > (them ?? 0) ? 'W' : 'L';
  });

  // Top players by OVR
  const topPlayers = [...players].sort((a, b) => (b.overallRating || 0) - (a.overallRating || 0)).slice(0, 5);

  // Strengths / Weaknesses from player attributes
  const attrAvg = {};
  const attrKeys = ['threePtShooting', 'perimeterDefense', 'rebounding', 'passingAccuracy', 'interiorDefense', 'agilityLateralSpeed', 'basketballIQ', 'finishingAtTheRim', 'staminaEndurance', 'courtVision'];
  const attrLabels = {
    threePtShooting: '3PT Shooting', perimeterDefense: 'Perimeter Def',
    rebounding: 'Rebounding', passingAccuracy: 'Passing',
    interiorDefense: 'Interior Def', agilityLateralSpeed: 'Agility',
    basketballIQ: 'Basketball IQ', finishingAtTheRim: 'Finishing',
    staminaEndurance: 'Stamina', courtVision: 'Court Vision',
  };
  for (const key of attrKeys) {
    const vals = players.map(p => p.attributes?.[key] ?? 50);
    attrAvg[key] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 50;
  }
  const sorted = Object.entries(attrAvg).sort((a, b) => b[1] - a[1]);
  const strengths   = sorted.slice(0, 3);
  const weaknesses  = sorted.slice(-3).reverse();

  const avgOvr = players.length > 0 ? Math.round(players.reduce((s, p) => s + (p.overallRating || 60), 0) / players.length) : 60;

  return (
    <div style={{ background: 'rgba(232,98,26,0.04)', border: '1px solid rgba(232,98,26,0.15)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', marginBottom: 16 }}>
      <div style={{ fontWeight: 800, fontSize: 'var(--font-size-sm)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        🔭 Scout Report
        <span className="badge badge-orange" style={{ fontSize: '0.55rem' }}>INTEL</span>
      </div>

      {/* Record + form */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ padding: '6px 12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
          📊 {wins}W – {losses}L
        </div>
        <div style={{ padding: '6px 12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
          ⭐ Avg OVR: {avgOvr}
        </div>
        {tactics.playingStyle && (
          <div style={{ padding: '6px 12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
            🎯 {tactics.playingStyle}
          </div>
        )}
      </div>

      {/* Recent form */}
      {form.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Recent Form</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {form.map((r, i) => (
              <div key={i} style={{ width: 22, height: 22, borderRadius: 4, background: r === 'W' ? 'var(--color-success)' : 'var(--color-danger)', color: 'white', fontWeight: 800, fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{r}</div>
            ))}
          </div>
        </div>
      )}

      {/* Top players */}
      {topPlayers.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Key Players</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {topPlayers.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-size-xs)' }}>
                <span style={{ fontWeight: 600 }}>{p.name}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{p.position}</span>
                  <span style={{ fontWeight: 800, color: 'var(--color-primary)' }}>OVR {p.overallRating || '?'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strengths & Weaknesses */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Strengths</div>
          {strengths.map(([key, val]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginBottom: 2 }}>
              <span>{attrLabels[key]}</span>
              <span style={{ fontWeight: 700, color: '#16a34a' }}>{Math.round(val)}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Weaknesses</div>
          {weaknesses.map(([key, val]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginBottom: 2 }}>
              <span>{attrLabels[key]}</span>
              <span style={{ fontWeight: 700, color: '#dc2626' }}>{Math.round(val)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Opponent Modal (enhanced) ──────────────────────────────────

function OpponentModal({ team, opponentId, userTeam, allMatches, allTeams, scouts, teamScoutTargets, teamUserMap, onClose, onMatchClick, onAssignScout, onSendMessage }) {
  const [showMessage, setShowMessage] = useState(false);
  const [msgText, setMsgText]         = useState('');

  const opponentMatches = useMemo(() =>
    allMatches.filter(m => m.homeTeamId === opponentId || m.awayTeamId === opponentId).sort((a, b) => a.scheduledDate - b.scheduledDate),
    [allMatches, opponentId]
  );

  const upcoming = opponentMatches.filter(m => !m.played);
  const past     = opponentMatches.filter(m =>  m.played);

  const opponentWins   = past.filter(m => {
    const isHome = m.homeTeamId === opponentId;
    return isHome ? (m.result?.homeScore > m.result?.awayScore) : (m.result?.awayScore > m.result?.homeScore);
  }).length;
  const opponentLosses = past.length - opponentWins;

  // Scout assignment check
  const scoutAssigned = teamScoutTargets?.[opponentId];
  const hasIdleScout  = (scouts || []).some(s => s.missionStatus === 'idle' || !s.missionStatus);
  const managerName   = teamUserMap?.[opponentId];
  const isUserTeam    = !!managerName;
  const teamType      = isUserTeam ? 'USER' : 'BOT';

  const fullTeam      = allTeams?.find(t => t.id === opponentId) || team;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <div>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {team?.name || 'Opponent'}
              <span className={`badge ${isUserTeam ? 'badge-blue' : 'badge-gray'}`} style={{ fontSize: '0.55rem', fontWeight: 800 }}>
                {teamType}
              </span>
            </h3>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              {isUserTeam ? `👤 Managed by: ${managerName}` : '🤖 Managed by AI'}
              &nbsp;·&nbsp;Season: {opponentWins}W – {opponentLosses}L
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {!scoutAssigned && hasIdleScout && (
              <button className="btn btn-ghost btn-sm" onClick={() => onAssignScout(opponentId)}>
                🔭 Assign Scout
              </button>
            )}
            {scoutAssigned && (
              <span className="badge badge-orange" style={{ padding: '6px 10px' }}>🔭 Scout Active</span>
            )}
            {isUserTeam && (
              <button className="btn btn-ghost btn-sm" onClick={() => setShowMessage(!showMessage)}>
                <MessageCircle size={13} /> Message
              </button>
            )}
          </div>

          {/* Message compose */}
          {showMessage && (
            <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
              <textarea
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                placeholder={`Send a message to ${team?.name}…`}
                style={{ width: '100%', height: 70, resize: 'none', padding: 8, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: 'var(--font-size-xs)', background: 'var(--bg-card)' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowMessage(false)}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={() => { onSendMessage?.(opponentId, msgText); setMsgText(''); setShowMessage(false); }}>
                  <Send size={12} /> Send
                </button>
              </div>
            </div>
          )}

          {/* Scout Report */}
          {scoutAssigned && (
            <ScoutReport team={fullTeam} matches={allMatches} userTeamId={userTeam?.id} />
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 8 }}>Upcoming ({upcoming.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {upcoming.slice(0, 6).map(m => {
                  const isHome = m.homeTeamId === opponentId;
                  const opp = isHome ? m.awayTeamName : m.homeTeamName;
                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)' }}>
                      <div>
                        <span className={`badge ${isHome ? 'badge-orange' : 'badge-gray'}`} style={{ fontSize: '0.55rem', marginRight: 6 }}>{isHome ? 'H' : 'A'}</span>
                        vs {opp}
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>{formatMatchDate(m.scheduledDate)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Past results */}
          {past.length > 0 && (
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 8 }}>Results ({past.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...past].reverse().slice(0, 6).map(m => {
                  const isHome = m.homeTeamId === opponentId;
                  const opp  = isHome ? m.awayTeamName : m.homeTeamName;
                  const won  = isHome ? m.result?.homeScore > m.result?.awayScore : m.result?.awayScore > m.result?.homeScore;
                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)', cursor: onMatchClick ? 'pointer' : 'default' }} onClick={() => onMatchClick?.(m)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className={`badge ${won ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.55rem' }}>{won ? 'W' : 'L'}</span>
                        vs {opp}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700 }}>{m.result?.homeScore}–{m.result?.awayScore}</span>
                        {onMatchClick && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>📊</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {opponentMatches.length === 0 && <div className="empty-state"><div className="empty-state-icon">🏀</div><div className="empty-state-title">No fixtures found</div></div>}
        </div>
      </div>
    </div>
  );
}

// ── Create Friendly Modal ──────────────────────────────────────

function CreateFriendlyModal({ teams, teamUserMap, onClose, onCreate }) {
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3 className="card-title">🤝 Create Friendly Game</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: 16 }}>
            Challenge a team to a friendly match. Results don't count toward the league table but affect form and morale.
          </p>
          <div className="form-group">
            <label className="form-label">Opponent Team</label>
            <select className="form-select" value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)}>
              <option value="">Select a team…</option>
              {(teams || []).map(t => (
                <option key={t.id} value={t.id}>{t.name} {teamUserMap?.[t.id] ? `(${teamUserMap[t.id]})` : '(BOT)'}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input type="date" className="form-input" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
          </div>
          <div style={{ padding: '10px 14px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)', color: '#b45309' }}>
            ⚠ Friendly games are simulated instantly. No league points awarded.
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!selectedTeam} onClick={() => { onCreate(selectedTeam, selectedDate); onClose(); }}>
            🏀 Schedule Friendly
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Fixtures Page ────────────────────────────────────────

export default function Fixtures() {
  const { state, dispatch, addNotification } = useGame();
  const navigate = useNavigate();
  const team = state.userTeam;

  const [activeTab, setActiveTab]           = useState('all');
  const [currentDate, setCurrentDate]       = useState(new Date());
  const [showAddEvent, setShowAddEvent]     = useState(false);
  const [showFriendly, setShowFriendly]     = useState(false);
  const [newEvent, setNewEvent]             = useState({ title: '', date: '', description: '' });
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [teamUserMap, setTeamUserMap]       = useState({});

  // Load team → username map from Firestore once
  useEffect(() => {
    apiGetTeamUserMap().then(map => setTeamUserMap(map));
  }, []);

  // Team scouting assignments: { [teamId]: { assignedAt } }
  const teamScoutTargets = team?.teamScoutTargets || {};

  const schedule = useMemo(() => {
    if (!team || !state.leagues?.length) return [];
    const userLeague = state.leagues.find(l => l.teams?.some(t => t.id === team.id));
    return userLeague?.schedule || [];
  }, [team, state.leagues]);

  const allLeagueMatches = useMemo(() => (state.leagues || []).flatMap(l => l.schedule || []), [state.leagues]);
  const teamMatches      = useMemo(() => schedule.filter(m => m.homeTeamId === team?.id || m.awayTeamId === team?.id), [schedule, team]);
  const nextMatch        = useMemo(() => teamMatches.find(m => !m.played && m.scheduledDate > Date.now()), [teamMatches]);
  const pastMatches      = useMemo(() => teamMatches.filter(m => m.played).sort((a, b) => b.scheduledDate - a.scheduledDate), [teamMatches]);
  const upcomingMatches  = useMemo(() => teamMatches.filter(m => !m.played).sort((a, b) => a.scheduledDate - b.scheduledDate), [teamMatches]);

  const userStanding = useMemo(() => {
    for (const league of (state.leagues || [])) {
      const s = (league.standings || []).find(s => s.teamId === team?.id);
      if (s) return s;
    }
    return null;
  }, [state.leagues, team?.id]);
  const seasonWins   = userStanding?.wins   ?? team?.wins   ?? 0;
  const seasonLosses = userStanding?.losses ?? team?.losses ?? 0;
  const seasonPts    = userStanding?.points ?? (seasonWins * 2 + seasonLosses);
  const seasonPlayed = seasonWins + seasonLosses;

  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const lastDraftedAt = team?.youthDraft?.lastDraftedAt ?? 0;
  const nextDraftMs   = lastDraftedAt + WEEK_MS;
  const canDraftNow   = Date.now() >= nextDraftMs;
  const nextDraftDate = new Date(nextDraftMs);
  const events        = team?.calendarEvents || [];
  const scouts        = team?.scouts || [];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const matchDayMap = useMemo(() => {
    const map = new Map();
    teamMatches.filter(m => {
      const d = new Date(m.scheduledDate);
      return d.getFullYear() === year && d.getMonth() === month;
    }).forEach(m => {
      const day = new Date(m.scheduledDate).getDate();
      if (m.played) {
        const isHome = m.homeTeamId === team?.id;
        const us   = isHome ? m.result?.homeScore : m.result?.awayScore;
        const them = isHome ? m.result?.awayScore  : m.result?.homeScore;
        map.set(day, (us ?? 0) > (them ?? 0) ? 'win' : 'loss');
      } else if (!map.has(day)) {
        map.set(day, 'upcoming');
      }
    });
    return map;
  }, [teamMatches, year, month, team?.id]);

  const getTeamById = id => (state.allTeams || []).find(t => t.id === id);
  const getTeamName = id => getTeamById(id)?.name || 'Unknown';

  function msToCountdown(ms) {
    if (ms <= 0) return 'Available now';
    const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000);
    if (d > 0) return `in ${d}d ${h}h`;
    if (h > 0) return `in ${h}h ${m}m`;
    return `in ${m}m`;
  }

  const youthResetCalDay = !canDraftNow && nextDraftDate.getFullYear() === year && nextDraftDate.getMonth() === month ? nextDraftDate.getDate() : null;

  const filteredMatches = activeTab === 'past' ? pastMatches
    : activeTab === 'upcoming' ? upcomingMatches
    : activeTab === 'events'   ? []
    : [...upcomingMatches, ...pastMatches].sort((a, b) => a.scheduledDate - b.scheduledDate);

  const addEvent = () => {
    if (!newEvent.title || !newEvent.date) return;
    const ev = { ...newEvent, id: Date.now().toString() };
    dispatch({ type: 'UPDATE_TEAM', payload: { ...team, calendarEvents: [...events, ev] } });
    setNewEvent({ title: '', date: '', description: '' });
    setShowAddEvent(false);
  };

  const handleAssignScout = (opponentId) => {
    const updated = { ...team, teamScoutTargets: { ...teamScoutTargets, [opponentId]: { assignedAt: Date.now() } } };
    dispatch({ type: 'UPDATE_TEAM', payload: updated });
    addNotification?.('Scout assigned to team!', 'success');
  };

  const handleSendMessage = (opponentId, text) => {
    if (!text.trim()) return;
    addNotification?.('Message sent!', 'success');
  };

  const handleCreateFriendly = (opponentId, date) => {
    const ev = { id: Date.now().toString(), title: `Friendly vs ${getTeamName(opponentId)}`, date, description: 'Friendly match — results don\'t count toward standings.', type: 'friendly', opponentId };
    dispatch({ type: 'UPDATE_TEAM', payload: { ...team, calendarEvents: [...events, ev] } });
    addNotification?.('Friendly game scheduled!', 'success');
  };

  function handleMatchClick(match) {
    if (match.played) {
      navigate(`/match/${match.id}`);
      return;
    } else {
      const isHome  = match.homeTeamId === team?.id;
      const oppId   = isHome ? match.awayTeamId  : match.homeTeamId;
      const oppName = isHome ? match.awayTeamName : match.homeTeamName;
      setSelectedOpponent({ id: oppId, name: oppName });
    }
  }

  // Opponent teams list (for friendly creation - exclude user team)
  const opponentTeams = useMemo(() =>
    (state.allTeams || []).filter(t => t.id !== team?.id),
    [state.allTeams, team?.id]
  );

  if (!team) return (
    <div className="page-content animate-fade-in">
      <div className="empty-state"><div className="empty-state-icon">📅</div><div className="empty-state-title">No team data</div></div>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Fixtures</h1>
          <p>{team.name} — Season schedule, results &amp; match details</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowFriendly(true)}>
          🤝 Arrange Friendly
        </button>
      </div>

      {/* Next Match Banner */}
      {nextMatch && (
        <div className="card card-highlight mb-4" style={{ marginBottom: '1.5rem' }}>
          <div style={{ color: 'white' }}>
            <div className="badge" style={{ marginBottom: 8, background: 'rgba(255,255,255,0.2)', color: 'white', fontSize: '0.6rem', fontWeight: 800 }}>NEXT MATCH</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <h3 style={{ color: 'white', fontSize: 'var(--font-size-xl)', fontWeight: 800, marginBottom: 6 }}>
                  {team.name} vs {getTeamName(nextMatch.homeTeamId === team.id ? nextMatch.awayTeamId : nextMatch.homeTeamId)}
                </h3>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 'var(--font-size-sm)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <span><Clock size={13} style={{ display: 'inline', marginRight: 4 }} />{formatMatchDate(nextMatch.scheduledDate)}</span>
                  <span><MapPin size={13} style={{ display: 'inline', marginRight: 4 }} />{nextMatch.homeTeamId === team.id ? `🏠 Home — ${team.stadiumName}` : '✈️ Away'}</span>
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>STARTS</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'white', letterSpacing: 2, fontWeight: 900 }}>
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
        </div>
      )}

      <div className="grid-2" style={{ gap: '1.5rem' }}>
        {/* Fixture List */}
        <div>
          <div className="tabs">
            {[['all','All'],['upcoming','Upcoming'],['past','Results'],['events','Events']].map(([k, l]) => (
              <button key={k} className={`tab${activeTab===k?' active':''}`} onClick={() => setActiveTab(k)}>{l}</button>
            ))}
          </div>

          {activeTab === 'events' ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>Events & Notes</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowFriendly(true)}>🤝 Friendly</button>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowAddEvent(true)}><Plus size={14} /> Event</button>
                </div>
              </div>
              {events.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><CalendarIcon size={40} /></div>
                  <div className="empty-state-title">No events yet</div>
                  <div className="empty-state-desc">Add custom events or arrange a friendly game</div>
                </div>
              ) : events.map(ev => (
                <div key={ev.id} className="card mb-2" style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                        {ev.type === 'friendly' ? '🤝 ' : '📅 '}{ev.title}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{ev.date}</div>
                      {ev.description && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 4 }}>{ev.description}</div>}
                    </div>
                    {ev.type === 'friendly' && <span className="badge badge-orange" style={{ fontSize: '0.55rem' }}>Friendly</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredMatches.slice(0, 18).map(match => {
                const isHome    = match.homeTeamId === team.id;
                const oppId     = isHome ? match.awayTeamId : match.homeTeamId;
                const opponent  = getTeamName(oppId);
                const isPast    = match.played;
                const result    = match.result;
                const userScore = result ? (isHome ? result.homeScore : result.awayScore) : null;
                const oppScore  = result ? (isHome ? result.awayScore  : result.homeScore) : null;
                const won       = userScore > oppScore;
                const hasScout  = !!teamScoutTargets?.[oppId];

                return (
                  <div key={match.id} className="card" style={{ padding: '12px 16px', cursor: 'pointer', transition: 'box-shadow 0.15s' }} onClick={() => handleMatchClick(match)}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span className={`badge ${isHome ? 'badge-orange' : 'badge-gray'}`} style={{ fontSize: '0.55rem' }}>
                            {isHome ? '🏠 HOME' : '✈️ AWAY'}
                          </span>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{formatMatchDate(match.scheduledDate)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>vs {opponent}</div>
                          {hasScout && <span className="badge badge-orange" style={{ fontSize: '0.5rem' }}>🔭</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {isPast && result ? (
                          <div>
                            <div className={`badge ${won ? 'badge-green' : 'badge-red'}`} style={{ marginBottom: 4 }}>{won ? 'W' : 'L'}</div>
                            <div style={{ fontWeight: 800, fontSize: 'var(--font-size-lg)' }}>{userScore} – {oppScore}</div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>📊 Details</div>
                          </div>
                        ) : (
                          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-primary)' }}>{getTimeUntilMatch(match)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredMatches.length === 0 && <div className="empty-state"><div className="empty-state-icon">🏀</div><div className="empty-state-title">No matches found</div></div>}
              {filteredMatches.length > 0 && (
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textAlign: 'center', marginTop: 4 }}>
                  Tap a result for full match details · Tap upcoming to scout opponent
                </div>
              )}
            </div>
          )}
        </div>

        {/* Calendar + Summary */}
        <div>
          {/* Mini Calendar */}
          <div className="card mb-4">
            <div className="card-header">
              <span className="card-title">{MONTHS[month]} {year}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-ghost btn-sm" style={{ padding: 6 }} onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth()-1))}><ChevronLeft size={16} /></button>
                <button className="btn btn-ghost btn-sm" style={{ padding: 6 }} onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth()+1))}><ChevronRight size={16} /></button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' }}>
              {DAYS.map(d => <div key={d} style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', padding: '4px 0' }}>{d}</div>)}
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;
                const dayResult = matchDayMap.get(day);
                const hasMatch  = dayResult !== undefined;
                const isYouth   = youthResetCalDay === day;
                const dotColor  = dayResult === 'win' ? '#22c55e' : dayResult === 'loss' ? '#ef4444' : 'var(--color-primary)';
                const bgColor   = dayResult === 'win' ? 'rgba(34,197,94,0.12)' : dayResult === 'loss' ? 'rgba(239,68,68,0.12)' : 'var(--color-primary-100)';
                const txtColor  = dayResult === 'win' ? '#16a34a' : dayResult === 'loss' ? '#dc2626' : 'var(--color-primary)';
                return (
                  <div key={day} style={{ padding: '6px 2px', borderRadius: 6, fontSize: 'var(--font-size-xs)', fontWeight: isToday || hasMatch ? 700 : 400, background: isToday ? 'var(--color-primary)' : hasMatch ? bgColor : 'transparent', color: isToday ? 'white' : hasMatch ? txtColor : 'var(--text-primary)', position: 'relative', outline: isYouth && !isToday ? '2px solid #16a34a' : undefined }}>
                    {day}
                    {(hasMatch || isYouth) && !isToday && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 1 }}>
                        {hasMatch && <div style={{ width: 4, height: 4, background: dotColor, borderRadius: '50%' }} />}
                        {isYouth  && <div style={{ width: 4, height: 4, background: '#16a34a', borderRadius: '50%' }} />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Season Summary */}
          <div className="card mb-4">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="card-title" style={{ margin: 0 }}>Season Record</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{seasonPts} pts</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              {[{ val: seasonWins, label: 'WINS', color: 'var(--color-success)', bg: 'rgba(46,125,50,0.08)' }, { val: seasonLosses, label: 'LOSSES', color: 'var(--color-danger)', bg: 'rgba(198,40,40,0.08)' }, { val: seasonPlayed, label: 'PLAYED', color: 'var(--text-primary)', bg: 'var(--bg-muted)' }].map(r => (
                <div key={r.label} style={{ flex: 1, textAlign: 'center', padding: '10px 8px', borderRadius: 'var(--radius-md)', background: r.bg }}>
                  <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: r.color }}>{r.val}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 700 }}>{r.label}</div>
                </div>
              ))}
            </div>
            {pastMatches.length > 0 && (
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Form (last 5)</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {pastMatches.slice(0, 5).map((m, i) => {
                    const isHome = m.homeTeamId === team.id;
                    const us = isHome ? m.result?.homeScore : m.result?.awayScore;
                    const them = isHome ? m.result?.awayScore : m.result?.homeScore;
                    const won = us > them;
                    return (
                      <div key={i} style={{ width: 28, height: 28, borderRadius: 4, background: won ? 'var(--color-success)' : 'var(--color-danger)', color: 'white', fontWeight: 800, fontSize: 'var(--font-size-xs)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{won ? 'W' : 'L'}</div>
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
              { icon: '🌱', title: 'Youth Academy Draft', desc: canDraftNow ? 'A new prospect is ready' : `Next: ${nextDraftDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${msToCountdown(nextDraftMs - Date.now())}`, badge: canDraftNow ? '✅ Ready' : '⏳ Cooldown', badgeClass: canDraftNow ? 'badge-green' : 'badge-gray' },
              { icon: '🏀', title: 'Next Match', desc: nextMatch ? `vs ${getTeamName(nextMatch.homeTeamId === team.id ? nextMatch.awayTeamId : nextMatch.homeTeamId)} · ${formatMatchDate(nextMatch.scheduledDate)}` : 'No upcoming matches', badge: nextMatch ? getTimeUntilMatch(nextMatch) : null, badgeClass: 'badge-orange' },
              { icon: '🏆', title: 'Season Progress', desc: `${seasonPlayed} of 18 matches played · ${18 - seasonPlayed} remaining`, badge: `${Math.round((seasonPlayed / 18) * 100)}%`, badgeClass: 'badge-yellow', showBar: true },
              { icon: '🔄', title: 'Transfer Window', desc: 'Pre-season & mid-season', badge: 'Active', badgeClass: 'badge-orange' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: i < 3 ? 12 : 0 }}>
                <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{item.title}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{item.desc}</div>
                  {item.showBar && (
                    <div style={{ marginTop: 4, height: 4, background: 'var(--bg-muted)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(seasonPlayed / 18) * 100}%`, background: 'var(--color-primary)', borderRadius: 2 }} />
                    </div>
                  )}
                </div>
                {item.badge && <span className={`badge ml-auto ${item.badgeClass}`}>{item.badge}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
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
                <label className="form-label">Notes (optional)</label>
                <textarea className="form-textarea" value={newEvent.description} onChange={e => setNewEvent(p => ({...p, description: e.target.value}))} placeholder="Add notes…" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowAddEvent(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addEvent}>Add Event</button>
            </div>
          </div>
        </div>
      )}

      {showFriendly && (
        <CreateFriendlyModal teams={opponentTeams} teamUserMap={teamUserMap} onClose={() => setShowFriendly(false)} onCreate={handleCreateFriendly} />
      )}

      {selectedOpponent && (
        <OpponentModal
          team={getTeamById(selectedOpponent.id)}
          opponentId={selectedOpponent.id}
          userTeam={team}
          allMatches={allLeagueMatches}
          allTeams={state.allTeams}
          scouts={scouts}
          teamScoutTargets={teamScoutTargets}
          teamUserMap={teamUserMap}
          onClose={() => setSelectedOpponent(null)}
          onMatchClick={m => { setSelectedOpponent(null); navigate(`/match/${m.id}`); }}
          onAssignScout={handleAssignScout}
          onSendMessage={handleSendMessage}
        />
      )}

    </div>
  );
}
