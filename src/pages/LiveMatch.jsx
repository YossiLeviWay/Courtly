import { useState, useEffect, useRef, useMemo } from 'react';
import { useGame } from '../context/GameContext.jsx';
import { useNavigate } from 'react-router-dom';
import { Zap, Clock, ChevronRight, Play, Pause, SkipForward, RotateCcw } from 'lucide-react';
import { getNextMatch, isMatchCurrentlyLive, formatMatchDate } from '../engine/gameScheduler.js';
import { apiGetMatchLog } from '../api.js';

// ── Constants ─────────────────────────────────────────────────

const EVENT_ICONS = {
  three_pointer: '🎯',
  dunk:          '💥',
  layup:         '🏀',
  timeout:       '⏱️',
  foul:          '🚨',
  injury:        '🚑',
  substitution:  '🔄',
  quarter_end:   '🔔',
  half_time:     '🕐',
  comeback:      '⚡',
  technical_foul:'🚫',
  fight:         '⚠️',
  turnover:      '❌',
  steal:         '🤚',
  block:         '🛡️',
  free_throw:    '🎯',
  assist:        '🎪',
};

// Speed modes: label, real-ms per game-minute, halftime-ms
const SPEEDS = [
  { key: 'instant',  label: 'Instant',   msPerMin: 0,      halftimeMs: 0     },
  { key: 'fast',     label: 'Fast',      msPerMin: 300,    halftimeMs: 5000  },
  { key: 'normal',   label: 'Normal',    msPerMin: 3000,   halftimeMs: 30000 },
  { key: 'live',     label: 'Live (1h)', msPerMin: 90000,  halftimeMs: 900000 },
];

// ── Live Match Replay ─────────────────────────────────────────

function LiveMatchReplay({ latestMatch }) {
  // latestMatch.log is guaranteed to be populated by parent (enrichedMatch)
  const log = useMemo(() => latestMatch?.log || [], [latestMatch]);

  const [visibleCount, setVisibleCount] = useState(0);
  const [isPlaying, setIsPlaying]       = useState(false);
  const [speedIdx, setSpeedIdx]         = useState(1);   // default Fast
  const [finished, setFinished]         = useState(false);
  const [elapsed, setElapsed]           = useState(0);   // ms into "live" replay

  const logRef    = useRef(null);
  const timerRef  = useRef(null);

  // Derived from visible events
  const shownEvents = log.slice(0, visibleCount);
  const lastEvent   = shownEvents[shownEvents.length - 1];

  const scores = useMemo(() => {
    for (let i = shownEvents.length - 1; i >= 0; i--) {
      const score = shownEvents[i].score;
      if (score) {
        if (typeof score === 'string') {
          const [h, a] = score.split('-').map(Number);
          if (!isNaN(h) && !isNaN(a)) return { home: h, away: a };
        } else if (typeof score === 'object') {
          return { home: score.home ?? 0, away: score.away ?? 0 };
        }
      }
    }
    return { home: 0, away: 0 };
  }, [shownEvents]);

  const quarter = lastEvent?.quarter ?? 1;

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [visibleCount]);

  // Show all instantly
  function handleInstant() {
    clearTimeout(timerRef.current);
    setVisibleCount(log.length);
    setIsPlaying(false);
    setFinished(true);
  }

  // Reset
  function handleReset() {
    clearTimeout(timerRef.current);
    setVisibleCount(0);
    setIsPlaying(false);
    setFinished(false);
    setElapsed(0);
  }

  // Advance events one-by-one with realistic timing
  useEffect(() => {
    if (!isPlaying || visibleCount >= log.length) {
      if (visibleCount >= log.length && log.length > 0) {
        setFinished(true);
        setIsPlaying(false);
      }
      return;
    }

    const speed = SPEEDS[speedIdx];

    // Instant mode
    if (speed.msPerMin === 0) {
      handleInstant();
      return;
    }

    const currentEvent = log[visibleCount];
    const prevEvent    = visibleCount > 0 ? log[visibleCount - 1] : null;

    // Calculate delay based on game-time gap between this event and previous
    const prevTime = prevEvent?.time ?? 0;
    const currTime = currentEvent?.time ?? prevTime;
    const timeDelta = Math.max(0, currTime - prevTime); // game-minutes

    let delay = timeDelta * speed.msPerMin;

    // Halftime: extra pause after Q2 end
    if (prevEvent?.type === 'half_time') {
      delay += speed.halftimeMs;
    }
    // Quarter break: small extra pause
    else if (prevEvent?.type === 'quarter_end') {
      delay += speed.msPerMin * 2;
    }
    // Timeout: brief stoppage
    else if (currentEvent?.type === 'timeout') {
      delay += speed.msPerMin * 1;
    }

    // Minimum 200ms so events don't stack instantaneously
    const finalDelay = Math.max(200, delay);

    timerRef.current = setTimeout(() => {
      setVisibleCount(v => v + 1);
    }, finalDelay);

    return () => clearTimeout(timerRef.current);
  }, [isPlaying, visibleCount, log, speedIdx]);

  if (log.length === 0) return null;

  const homeTeamName = latestMatch.homeTeam || '—';
  const awayTeamName = latestMatch.awayTeam || '—';

  return (
    <div>
      {/* Scoreboard */}
      <div className="card card-highlight mb-4" style={{ marginBottom: '1.5rem' }}>
        <div style={{ color: 'white' }}>
          {/* Teams + Score */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem', marginBottom: 12 }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: 1, marginBottom: 4, opacity: 0.85, textTransform: 'uppercase' }}>{homeTeamName}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '3.5rem', letterSpacing: 2, fontWeight: 900 }}>{scores.home}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', marginBottom: 8 }}>Q{quarter}</div>
              <div style={{ opacity: 0.7, fontSize: 'var(--font-size-sm)', marginTop: 4 }}>VS</div>
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: 1, marginBottom: 4, opacity: 0.85, textTransform: 'uppercase' }}>{awayTeamName}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '3.5rem', letterSpacing: 2, fontWeight: 900 }}>{scores.away}</div>
            </div>
          </div>

          {/* Quarter scores */}
          {(latestMatch.quarterScores || []).length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 12, opacity: 0.8 }}>
              {latestMatch.quarterScores.map((q, i) => (
                <div key={i} style={{ textAlign: 'center', minWidth: 44 }}>
                  <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.7 }}>Q{i + 1}</div>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700 }}>{q.home}–{q.away}</div>
                </div>
              ))}
            </div>
          )}

          {finished ? (
            <div style={{ textAlign: 'center', opacity: 0.95, fontWeight: 800, fontSize: 'var(--font-size-lg)' }}>
              {latestMatch.homeScore > latestMatch.awayScore ? '🏆 ' + homeTeamName + ' Win!' : '🏀 ' + awayTeamName + ' Win!'}
              {' — FINAL'}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* Speed selector */}
              <div style={{ display: 'flex', gap: 4 }}>
                {SPEEDS.map((s, i) => (
                  <button
                    key={s.key}
                    onClick={() => setSpeedIdx(i)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 6,
                      border: '1px solid rgba(255,255,255,0.3)',
                      background: speedIdx === i ? 'rgba(255,255,255,0.25)' : 'transparent',
                      color: 'white',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >{s.label}</button>
                ))}
              </div>
              {/* Controls */}
              <button
                className="btn btn-sm"
                style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
                onClick={handleReset}
              ><RotateCcw size={12} /></button>
              <button
                className="btn btn-sm"
                style={{ background: 'white', color: 'var(--color-primary)', fontWeight: 700 }}
                onClick={() => setIsPlaying(p => !p)}
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                {isPlaying ? ' Pause' : ' Play'}
              </button>
              <button
                className="btn btn-sm"
                style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
                onClick={handleInstant}
                title="Show full match now"
              ><SkipForward size={14} /></button>
            </div>
          )}
          {finished && (
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }} onClick={handleReset}>
                <RotateCcw size={12} /> Replay
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Match Log */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Match Log — Highlights</div>
          {isPlaying && !finished && <div className="live-badge"><span className="live-dot" /> LIVE</div>}
        </div>
        <div ref={logRef} className="match-log" style={{ maxHeight: 420, overflowY: 'auto' }}>
          {visibleCount === 0 && !isPlaying ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <div className="empty-state-icon">⏸️</div>
              <div className="empty-state-title">Press Play to watch the match</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 4, textAlign: 'center' }}>
                Choose a speed: Fast (~30s) · Normal (~5 min) · Live (real-time ~1hr)
              </div>
            </div>
          ) : shownEvents.map((ev, i) => (
            <div
              key={i}
              className={`match-event ${ev.type === 'quarter_end' || ev.type === 'half_time' ? 'quarter-break' : ''}`}
              style={{ animationDelay: `${i * 20}ms` }}
            >
              <span className="match-event-time">
                {typeof ev.time === 'number' ? `${ev.time.toFixed(0)}'` : ev.time || `${i + 1}'`}
              </span>
              <span className="match-event-icon">{EVENT_ICONS[ev.type] || '🏀'}</span>
              <span className="match-event-text">{ev.description}</span>
              {ev.score && (
                <span className="match-event-score">
                  {typeof ev.score === 'string' ? ev.score : `${ev.score.home}-${ev.score.away}`}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Player Stats Table ────────────────────────────────────────

function PlayerStatsTable({ match, userTeam }) {
  if (!match) return null;

  const playerStats = match.playerStats || {};
  const players = userTeam?.players || [];

  // Merge player names with their stats
  const rows = players.map(p => {
    const s = playerStats[p.id] || {};
    const fgPct = s.fgAttempts > 0 ? ((s.fgMade / s.fgAttempts) * 100).toFixed(0) : '—';
    const tpPct = s.threePtAttempts > 0 ? ((s.threePtMade / s.threePtAttempts) * 100).toFixed(0) : '—';
    const ftPct = s.ftAttempts > 0 ? ((s.ftMade / s.ftAttempts) * 100).toFixed(0) : '—';
    return { player: p, s, fgPct, tpPct, ftPct };
  }).filter(r => r.s.minutesPlayed > 0);

  if (rows.length === 0) return null;

  return (
    <div className="card mt-4">
      <div className="card-header">
        <span className="card-title">Last Match — Player Stats</span>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
          {match.opponent} · {match.result}
          {match.homeScore != null ? ` · ${match.homeScore}–${match.awayScore}` : ''}
        </span>
      </div>
      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>MIN</th>
              <th>PTS</th>
              <th>AST</th>
              <th>REB</th>
              <th>STL</th>
              <th>BLK</th>
              <th>FG%</th>
              <th>3P%</th>
              <th>FT%</th>
            </tr>
          </thead>
          <tbody>
            {rows.sort((a, b) => (b.s.points || 0) - (a.s.points || 0)).map(({ player, s, fgPct, tpPct, ftPct }) => (
              <tr key={player.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="player-position-badge">{player.position}</span>
                    <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{player.name}</span>
                  </div>
                </td>
                <td style={{ color: 'var(--text-muted)' }}>{s.minutesPlayed ?? '—'}</td>
                <td style={{ fontWeight: 700, color: (s.points || 0) >= 20 ? 'var(--color-primary)' : 'inherit' }}>
                  {s.points ?? 0}
                </td>
                <td>{s.assists ?? 0}</td>
                <td>{s.rebounds ?? 0}</td>
                <td>{s.steals ?? 0}</td>
                <td>{s.blocks ?? 0}</td>
                <td style={{ color: 'var(--text-muted)' }}>{fgPct}{fgPct !== '—' ? '%' : ''}</td>
                <td style={{ color: 'var(--text-muted)' }}>{tpPct}{tpPct !== '—' ? '%' : ''}</td>
                <td style={{ color: 'var(--text-muted)' }}>{ftPct}{ftPct !== '—' ? '%' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function LiveMatch() {
  const { state } = useGame();
  const navigate  = useNavigate();
  const team      = state.userTeam;

  const schedule  = team?.seasonMatches || [];
  const nextMatch = getNextMatch(team?.id, schedule);
  const isLive    = nextMatch ? isMatchCurrentlyLive(nextMatch) : false;

  const latestMatch = team?.matchHistory?.[0] ?? null;

  // Load match log + stats from match_logs/{matchId} when not available in-memory
  const [remoteMatchData, setRemoteMatchData] = useState(null);

  useEffect(() => {
    const matchId = latestMatch?.matchId;
    if (!matchId) return;
    // If log is already in-memory, skip remote load
    if (latestMatch?.log?.length > 0) return;
    setRemoteMatchData(null);
    apiGetMatchLog(matchId).then(data => {
      if (data) setRemoteMatchData(data);
    });
  }, [latestMatch?.matchId, latestMatch?.log?.length]);

  // Merge in-memory log/stats with remote fallback
  const enrichedMatch = useMemo(() => {
    if (!latestMatch) return null;
    const remoteLog   = remoteMatchData?.events      || [];
    const remoteStats = remoteMatchData?.playerStats || {};
    return {
      ...latestMatch,
      log:         latestMatch.log?.length         ? latestMatch.log         : remoteLog,
      playerStats: Object.keys(latestMatch.playerStats || {}).length
        ? latestMatch.playerStats
        : remoteStats,
    };
  }, [latestMatch, remoteMatchData]);

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
              <div className="font-bold">{team?.name} vs {nextMatch.opponentName || 'Opponent'}</div>
              <div className="text-sm text-muted mt-1"><Clock size={13} style={{ display: 'inline', marginRight: 4 }} />{formatMatchDate(nextMatch.scheduledDate ?? nextMatch.date)}</div>
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/calendar')}>
              <ChevronRight size={16} /> View Calendar
            </button>
          </div>
        </div>
      )}

      {enrichedMatch ? (
        <LiveMatchReplay latestMatch={enrichedMatch} />
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">🏀</div>
          <div className="empty-state-title">No matches played yet</div>
          <div className="empty-state-desc">Matches simulate automatically on their scheduled date. Check the Calendar for upcoming fixtures.</div>
        </div>
      )}

      <PlayerStatsTable match={enrichedMatch} userTeam={team} />
    </div>
  );
}
