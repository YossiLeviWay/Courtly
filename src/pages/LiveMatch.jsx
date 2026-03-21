import { useState, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext.jsx';
import { useNavigate } from 'react-router-dom';
import { Zap, Clock, Activity, ChevronRight } from 'lucide-react';
import { getNextMatch, isMatchCurrentlyLive, formatMatchDate } from '../engine/gameScheduler.js';

const EVENT_ICONS = {
  three_pointer: '🎯',
  dunk: '💥',
  layup: '🏀',
  timeout: '⏱️',
  foul: '🚨',
  injury: '🚑',
  substitution: '🔄',
  quarter_end: '🔔',
  half_time: '🕐',
  comeback: '⚡',
  technical_foul: '🚫',
  fight: '⚠️',
  turnover: '❌',
  steal: '🤚',
  block: '🛡️',
  free_throw: '🎯',
  assist: '🎪',
};

function MockMatchReplay({ team, schedule }) {
  const [events, setEvents] = useState([]);
  const [matchIdx, setMatchIdx] = useState(0);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [quarter, setQuarter] = useState(1);
  const [timeLeft, setTimeLeft] = useState('10:00');
  const [isPlaying, setIsPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const logRef = useRef(null);

  const latestMatch = team?.matchHistory?.slice(-1)[0];
  const log = latestMatch?.log || [];

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  useEffect(() => {
    if (!isPlaying || matchIdx >= log.length) {
      if (matchIdx >= log.length && log.length > 0) setFinished(true);
      return;
    }
    const timer = setTimeout(() => {
      const ev = log[matchIdx];
      setEvents(prev => [...prev, ev]);
      if (ev.score) {
        const [hs, as_] = ev.score.split('-').map(Number);
        if (!isNaN(hs)) setHomeScore(hs);
        if (!isNaN(as_)) setAwayScore(as_);
      }
      if (ev.quarter) setQuarter(ev.quarter);
      if (ev.time) setTimeLeft(ev.time);
      setMatchIdx(i => i + 1);
    }, 600);
    return () => clearTimeout(timer);
  }, [isPlaying, matchIdx, log]);

  if (!latestMatch && !schedule?.length) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🏀</div>
        <div className="empty-state-title">No matches yet</div>
        <div className="empty-state-desc">Matches will simulate automatically every 3 days. Check the Calendar for upcoming fixtures.</div>
      </div>
    );
  }

  const homeTeamName = latestMatch?.homeTeam || team?.name;
  const awayTeamName = latestMatch?.awayTeam || 'Opponent';
  const isHome = latestMatch?.isHome !== false;

  return (
    <div>
      {/* Scoreboard */}
      <div className="card card-highlight mb-4" style={{ marginBottom: '1.5rem' }}>
        <div className="text-center" style={{ color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem', marginBottom: 16 }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', letterSpacing: 1, marginBottom: 4, opacity: 0.9 }}>{homeTeamName}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '4rem', letterSpacing: 2 }}>{homeScore}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', marginBottom: 8 }}>Q{quarter}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', opacity: 0.8 }}>{timeLeft}</div>
              <div style={{ opacity: 0.7, fontSize: 'var(--font-size-sm)', marginTop: 4 }}>VS</div>
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', letterSpacing: 1, marginBottom: 4, opacity: 0.9 }}>{awayTeamName}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '4rem', letterSpacing: 2 }}>{awayScore}</div>
            </div>
          </div>

          {finished ? (
            <div style={{ opacity: 0.9, fontWeight: 700, fontSize: 'var(--font-size-lg)' }}>
              {homeScore > awayScore ? '🏆 Home Win!' : '🏀 Away Win!'}
              {' — FINAL'}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3">
              <button
                className="btn btn-sm"
                style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
                onClick={() => { setIsPlaying(false); setEvents([]); setMatchIdx(0); setHomeScore(0); setAwayScore(0); setQuarter(1); setTimeLeft('10:00'); setFinished(false); }}
              >
                Reset
              </button>
              <button
                className="btn btn-sm"
                style={{ background: 'white', color: 'var(--color-primary)', fontWeight: 700 }}
                onClick={() => setIsPlaying(p => !p)}
              >
                <Zap size={14} /> {isPlaying ? 'Pause Replay' : 'Start Replay'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Match Log */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Match Log — Highlights</div>
          {isPlaying && <div className="live-badge"><span className="live-dot" /> LIVE</div>}
        </div>
        <div ref={logRef} className="match-log" style={{ maxHeight: 420 }}>
          {events.length === 0 && !isPlaying ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <div className="empty-state-icon">⏸️</div>
              <div className="empty-state-title">Press Start Replay to view match</div>
            </div>
          ) : events.map((ev, i) => (
            <div key={i} className={`match-event ${ev.type === 'quarter_end' || ev.type === 'half_time' ? 'quarter-break' : ''} ${ev.isHighlight ? 'highlight' : ''}`}>
              <span className="match-event-time">{ev.time || `${i+1}'`}</span>
              <span className="match-event-icon">{EVENT_ICONS[ev.type] || '🏀'}</span>
              <span className="match-event-text">{ev.description}</span>
              {ev.score && <span className="match-event-score">{ev.score}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LiveMatch() {
  const { state } = useGame();
  const navigate = useNavigate();
  const team = state.userTeam;

  const schedule = team?.schedule || [];
  const nextMatch = getNextMatch(team?.id, schedule);
  const isLive = nextMatch ? isMatchCurrentlyLive(nextMatch) : false;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>Live Match</h1>
            <p>Watch your team in action and review match highlights</p>
          </div>
          {isLive && <div className="live-badge" style={{ fontSize: '1rem', padding: '8px 20px' }}><span className="live-dot" /> LIVE NOW</div>}
        </div>
      </div>

      {nextMatch && !isLive && (
        <div className="card mb-4" style={{ marginBottom: '1.5rem', background: 'var(--color-info-light)', border: '1px solid rgba(21,101,192,0.2)' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="badge badge-blue mb-2">NEXT MATCH</div>
              <div className="font-bold">{team?.name} vs Opponent</div>
              <div className="text-sm text-muted mt-1"><Clock size={13} style={{display:'inline',marginRight:4}} />{formatMatchDate(nextMatch.scheduledDate)}</div>
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/calendar')}>
              <ChevronRight size={16} /> View Calendar
            </button>
          </div>
        </div>
      )}

      <MockMatchReplay team={team} schedule={schedule} />

      {/* Quick Stats */}
      {team?.matchHistory?.length > 0 && (
        <div className="card mt-4">
          <div className="card-title mb-4">Last Match — Player Performance</div>
          <div className="table-container">
            <table>
              <thead><tr><th>Player</th><th>PTS</th><th>AST</th><th>REB</th><th>MIN</th></tr></thead>
              <tbody>
                {(team.players || []).slice(0, 8).map(p => (
                  <tr key={p.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="player-position-badge">{p.position}</span>
                        {p.name}
                      </div>
                    </td>
                    <td>{Math.floor(Math.random() * 25)}</td>
                    <td>{Math.floor(Math.random() * 10)}</td>
                    <td>{Math.floor(Math.random() * 12)}</td>
                    <td>{Math.floor(20 + Math.random() * 20)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
