import { useState, useMemo } from 'react';
import { useGame } from '../context/GameContext.jsx';
import { Calendar as CalendarIcon, Clock, MapPin, Plus, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { generateSeasonSchedule, getNextMatch, formatMatchDate, getTimeUntilMatch } from '../engine/gameScheduler.js';
import { useNavigate } from 'react-router-dom';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

export default function Calendar() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  const team = state.userTeam;
  const [activeTab, setActiveTab] = useState('all');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', date: '', description: '' });

  const schedule = useMemo(() => {
    if (!team || !state.allTeams?.length) return [];
    if (team.schedule?.length) return team.schedule;
    // Generate a schedule
    const leagueTeams = state.allTeams.filter(t =>
      t.leagueId === team.leagueId || t.leagueIndex === team.leagueIndex
    ).slice(0, 10);
    return generateSeasonSchedule(leagueTeams.length ? leagueTeams : state.allTeams.slice(0, 10), 0);
  }, [team, state.allTeams]);

  const teamMatches = useMemo(() =>
    schedule.filter(m => m.homeTeamId === team?.id || m.awayTeamId === team?.id),
    [schedule, team]
  );

  const nextMatch = useMemo(() => teamMatches.find(m => !m.played && m.scheduledDate > Date.now()), [teamMatches]);
  const pastMatches = useMemo(() => teamMatches.filter(m => m.played).sort((a,b) => b.scheduledDate - a.scheduledDate), [teamMatches]);
  const upcomingMatches = useMemo(() => teamMatches.filter(m => !m.played).sort((a,b) => a.scheduledDate - b.scheduledDate), [teamMatches]);

  const events = team?.calendarEvents || [];

  // Calendar grid
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  // Match dates in current month (as day numbers)
  const matchDays = new Set(
    teamMatches
      .filter(m => {
        const d = new Date(m.scheduledDate);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .map(m => new Date(m.scheduledDate).getDate())
  );

  const getTeamName = (id) => {
    const t = state.allTeams?.find(t => t.id === id);
    return t?.name || 'Unknown';
  };

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
              {filteredMatches.slice(0, 18).map((match, i) => {
                const isHome = match.homeTeamId === team?.id;
                const opponent = getTeamName(isHome ? match.awayTeamId : match.homeTeamId);
                const isPast = match.played;
                const result = match.result;
                const userScore = result ? (isHome ? result.homeScore : result.awayScore) : null;
                const oppScore = result ? (isHome ? result.awayScore : result.homeScore) : null;
                const won = userScore > oppScore;

                return (
                  <div key={match.id} className="card" style={{ padding: '12px 16px' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`badge ${isHome ? 'badge-orange' : 'badge-gray'}`} style={{ fontSize: '0.6rem' }}>
                            {isHome ? '🏠 HOME' : '✈️ AWAY'}
                          </span>
                          <span className="text-xs text-muted">{formatMatchDate(match.scheduledDate)}</span>
                        </div>
                        <div className="font-semibold text-sm">vs {opponent}</div>
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
            </div>
          )}
        </div>

        {/* Mini Calendar + Deadlines */}
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
                    padding: '6px 2px',
                    borderRadius: 6,
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

          {/* Key Deadlines */}
          <div className="card">
            <div className="card-title mb-3">Key Deadlines</div>
            {[
              { label: 'Youth Academy Draft', desc: '1st of every month', icon: '🌱', color: 'badge-green' },
              { label: 'Training Reset', desc: 'Every 7 days', icon: '🏋️', color: 'badge-blue' },
              { label: 'Transfer Window', desc: 'Pre-season & mid-season', icon: '🔄', color: 'badge-orange' },
              { label: 'Season End', desc: '18 matches played', icon: '🏆', color: 'badge-yellow' },
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
    </div>
  );
}
