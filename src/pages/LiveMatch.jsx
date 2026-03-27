import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useGame } from '../context/GameContext.jsx';
import { useNavigate } from 'react-router-dom';
import { Zap, Clock, ChevronRight, Play, Pause, SkipForward, RotateCcw } from 'lucide-react';
import { getNextMatch, isMatchCurrentlyLive, formatMatchDate } from '../engine/gameScheduler.js';
import { GAME_DURATION_SEC } from '../engine/matchEngine.js';
import { apiGetMatchLog, apiRecordMatchResult } from '../api.js';

// ── Constants ─────────────────────────────────────────────────

const EVENT_ICONS = {
  three_pointer:  '🎯',
  dunk:           '💥',
  layup:          '🏀',
  timeout:        '⏱️',
  foul:           '🚨',
  injury:         '🚑',
  substitution:   '🔄',
  quarter_end:    '🔔',
  half_time:      '🕐',
  comeback:       '⚡',
  technical_foul: '🚫',
  fight:          '⚠️',
  turnover:       '❌',
  steal:          '🤚',
  block:          '🛡️',
  free_throw:     '🎯',
  assist:         '🎪',
};

// Speed modes for the replay viewer
const SPEEDS = [
  { key: 'instant', label: 'Instant',   msPerMin: 0,      halftimeMs: 0      },
  { key: 'fast',    label: 'Fast',      msPerMin: 300,    halftimeMs: 5000   },
  { key: 'normal',  label: 'Normal',    msPerMin: 3000,   halftimeMs: 30000  },
  { key: 'live',    label: 'Live (1h)', msPerMin: 90000,  halftimeMs: 900000 },
];

// ── Shared Scoreboard ─────────────────────────────────────────

function Scoreboard({ homeTeamName, awayTeamName, homeScore, awayScore, quarter, quarterScores, badge, controls }) {
  return (
    <div className="card card-highlight mb-4" style={{ marginBottom: '1.5rem' }}>
      <div style={{ color: 'white' }}>
        {/* Teams + Score */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem', marginBottom: 12 }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: 1, marginBottom: 4, opacity: 0.85, textTransform: 'uppercase' }}>{homeTeamName}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '3.5rem', letterSpacing: 2, fontWeight: 900 }}>{homeScore}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', marginBottom: 8 }}>
              {badge || `Q${quarter}`}
            </div>
            <div style={{ opacity: 0.7, fontSize: 'var(--font-size-sm)', marginTop: 4 }}>VS</div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: 1, marginBottom: 4, opacity: 0.85, textTransform: 'uppercase' }}>{awayTeamName}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '3.5rem', letterSpacing: 2, fontWeight: 900 }}>{awayScore}</div>
          </div>
        </div>

        {/* Quarter scores */}
        {(quarterScores || []).length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 12, opacity: 0.8 }}>
            {quarterScores.map((q, i) => (
              <div key={i} style={{ textAlign: 'center', minWidth: 44 }}>
                <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.7 }}>Q{i + 1}</div>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700 }}>{q.home}–{q.away}</div>
              </div>
            ))}
          </div>
        )}

        {controls}
      </div>
    </div>
  );
}

// ── Event Feed ────────────────────────────────────────────────

function EventFeed({ events, isLive, title }) {
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events.length]);

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">{title || 'Match Log — Highlights'}</div>
        {isLive && <div className="live-badge"><span className="live-dot" /> LIVE</div>}
      </div>
      <div ref={logRef} className="match-log" style={{ maxHeight: 420, overflowY: 'auto' }}>
        {events.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <div className="empty-state-icon">⏳</div>
            <div className="empty-state-title">Waiting for tip-off…</div>
          </div>
        ) : events.map((ev, i) => (
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
  );
}

// ── Live Game Viewer (real-time sync) ─────────────────────────
// Reveals pre-generated events based on elapsed real time so
// every user sees the same play at the same second.

function LiveGameViewer({ fixture, matchLog, onGameEnd }) {
  const [now, setNow] = useState(Date.now());
  const gameEndedRef = useRef(false);

  const elapsedSec    = (now - fixture.scheduledDate) / 1000;
  const isGameOver    = elapsedSec >= GAME_DURATION_SEC;
  const events        = matchLog?.events || [];
  const visibleEvents = events.filter(ev => (ev.relativeTime ?? Infinity) <= elapsedSec);

  // Derive live score from visible events
  const scores = useMemo(() => {
    for (let i = visibleEvents.length - 1; i >= 0; i--) {
      const score = visibleEvents[i].score;
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
  }, [visibleEvents]);

  const quarter = visibleEvents[visibleEvents.length - 1]?.quarter ?? 1;

  // Tick every 2 s while game is in progress
  useEffect(() => {
    if (isGameOver) return;
    const id = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(id);
  }, [isGameOver]);

  // Notify parent once when game ends
  useEffect(() => {
    if (isGameOver && !gameEndedRef.current && matchLog) {
      gameEndedRef.current = true;
      onGameEnd(matchLog);
    }
  }, [isGameOver, matchLog, onGameEnd]);

  const finalScore = isGameOver
    ? { home: matchLog?.homeScore ?? scores.home, away: matchLog?.awayScore ?? scores.away }
    : scores;

  const homeTeamName = fixture.homeTeamName || fixture.homeTeam || '—';
  const awayTeamName = fixture.awayTeamName || fixture.awayTeam || '—';

  const badge = isGameOver ? 'FINAL' : `Q${quarter}`;

  const finishedControls = isGameOver && (
    <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 'var(--font-size-lg)', opacity: 0.95 }}>
      {finalScore.home > finalScore.away ? `🏆 ${homeTeamName} Win!` : `🏀 ${awayTeamName} Win!`}
      {' — FINAL'}
    </div>
  );

  const liveIndicator = !isGameOver && (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
      <div className="live-badge" style={{ fontSize: '0.8rem' }}><span className="live-dot" /> LIVE</div>
      <span style={{ opacity: 0.7, fontSize: 'var(--font-size-xs)' }}>
        {visibleEvents.length}/{events.length} plays
      </span>
    </div>
  );

  return (
    <div>
      <Scoreboard
        homeTeamName={homeTeamName}
        awayTeamName={awayTeamName}
        homeScore={finalScore.home}
        awayScore={finalScore.away}
        quarter={quarter}
        quarterScores={isGameOver ? matchLog?.quarterScores : []}
        badge={badge}
        controls={isGameOver ? finishedControls : liveIndicator}
      />
      <EventFeed
        events={visibleEvents}
        isLive={!isGameOver}
        title={isGameOver ? 'Match Log — Full Game' : 'Match Log — Live'}
      />
    </div>
  );
}

// ── Match Replay (past matches) ───────────────────────────────

function LiveMatchReplay({ latestMatch }) {
  const log = useMemo(() => latestMatch?.log || [], [latestMatch]);

  const [visibleCount, setVisibleCount] = useState(0);
  const [isPlaying, setIsPlaying]       = useState(false);
  const [speedIdx, setSpeedIdx]         = useState(1);
  const [finished, setFinished]         = useState(false);

  const timerRef = useRef(null);

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

  function handleInstant() {
    clearTimeout(timerRef.current);
    setVisibleCount(log.length);
    setIsPlaying(false);
    setFinished(true);
  }

  function handleReset() {
    clearTimeout(timerRef.current);
    setVisibleCount(0);
    setIsPlaying(false);
    setFinished(false);
  }

  useEffect(() => {
    if (!isPlaying || visibleCount >= log.length) {
      if (visibleCount >= log.length && log.length > 0) {
        setFinished(true);
        setIsPlaying(false);
      }
      return;
    }

    const speed = SPEEDS[speedIdx];
    if (speed.msPerMin === 0) { handleInstant(); return; }

    const curr = log[visibleCount];
    const prev = visibleCount > 0 ? log[visibleCount - 1] : null;
    const timeDelta = Math.max(0, (curr?.time ?? 0) - (prev?.time ?? 0));
    let delay = timeDelta * speed.msPerMin;
    if (prev?.type === 'half_time')    delay += speed.halftimeMs;
    else if (prev?.type === 'quarter_end') delay += speed.msPerMin * 2;
    else if (curr?.type === 'timeout')     delay += speed.msPerMin * 1;

    timerRef.current = setTimeout(() => setVisibleCount(v => v + 1), Math.max(200, delay));
    return () => clearTimeout(timerRef.current);
  }, [isPlaying, visibleCount, log, speedIdx]);

  if (log.length === 0) return null;

  const homeTeamName = latestMatch.homeTeam || latestMatch.homeTeamName || '—';
  const awayTeamName = latestMatch.awayTeam || latestMatch.awayTeamName || '—';

  const finishedBanner = finished && (
    <div style={{ textAlign: 'center', opacity: 0.95, fontWeight: 800, fontSize: 'var(--font-size-lg)' }}>
      {latestMatch.homeScore > latestMatch.awayScore ? '🏆 ' + homeTeamName + ' Win!' : '🏀 ' + awayTeamName + ' Win!'}
      {' — FINAL'}
    </div>
  );

  const replayControls = !finished && (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {SPEEDS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setSpeedIdx(i)}
            style={{
              padding: '3px 8px', borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.3)',
              background: speedIdx === i ? 'rgba(255,255,255,0.25)' : 'transparent',
              color: 'white', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer',
            }}
          >{s.label}</button>
        ))}
      </div>
      <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }} onClick={handleReset}><RotateCcw size={12} /></button>
      <button className="btn btn-sm" style={{ background: 'white', color: 'var(--color-primary)', fontWeight: 700 }} onClick={() => setIsPlaying(p => !p)}>
        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        {isPlaying ? ' Pause' : ' Play'}
      </button>
      <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }} onClick={handleInstant} title="Show full match now"><SkipForward size={14} /></button>
    </div>
  );

  const replayFooter = finished && (
    <div style={{ textAlign: 'center', marginTop: 8 }}>
      <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }} onClick={handleReset}>
        <RotateCcw size={12} /> Replay
      </button>
    </div>
  );

  return (
    <div>
      <Scoreboard
        homeTeamName={homeTeamName}
        awayTeamName={awayTeamName}
        homeScore={scores.home}
        awayScore={scores.away}
        quarter={quarter}
        quarterScores={finished ? (latestMatch.quarterScores || []) : []}
        controls={<>{finishedBanner}{replayControls}{replayFooter}</>}
      />
      <div className="card">
        <div className="card-header">
          <div className="card-title">Match Log — Highlights</div>
          {isPlaying && !finished && <div className="live-badge"><span className="live-dot" /> REPLAY</div>}
        </div>
        <div className="match-log" style={{ maxHeight: 420, overflowY: 'auto' }}>
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
              <th>Player</th><th>MIN</th><th>PTS</th><th>AST</th>
              <th>REB</th><th>STL</th><th>BLK</th><th>FG%</th><th>3P%</th><th>FT%</th>
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
                <td style={{ fontWeight: 700, color: (s.points || 0) >= 20 ? 'var(--color-primary)' : 'inherit' }}>{s.points ?? 0}</td>
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

// ── Countdown Banner ──────────────────────────────────────────

function CountdownBanner({ nextMatch, team, navigate }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    function update() {
      const diff = nextMatch.scheduledDate - Date.now();
      if (diff <= 0) { setRemaining('Starting now…'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000)  / 60000);
      const s = Math.floor((diff % 60000)    / 1000);
      if (d > 0)  setRemaining(`${d}d ${h}h ${m}m`);
      else if (h > 0) setRemaining(`${h}h ${m}m ${s}s`);
      else        setRemaining(`${m}m ${s}s`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [nextMatch.scheduledDate]);

  return (
    <div className="card mb-4" style={{ marginBottom: '1.5rem', background: 'var(--color-info-light)', border: '1px solid rgba(21,101,192,0.2)' }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="badge badge-blue mb-2">NEXT MATCH</div>
          <div className="font-bold">{team?.name} vs {nextMatch.opponentName || nextMatch.awayTeamName || 'Opponent'}</div>
          <div className="text-sm text-muted mt-1">
            <Clock size={13} style={{ display: 'inline', marginRight: 4 }} />
            {formatMatchDate(nextMatch.scheduledDate)} · <strong>{remaining}</strong>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/calendar')}>
          <ChevronRight size={16} /> View Calendar
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function LiveMatch() {
  const { state, dispatch, addNotification } = useGame();
  const navigate = useNavigate();
  const team     = state.userTeam;

  const schedule  = team?.seasonMatches || [];
  const nextMatch = getNextMatch(team?.id, schedule);
  const isLive    = nextMatch ? isMatchCurrentlyLive(nextMatch) : false;

  // The most recent played match for the replay viewer
  const latestMatch = team?.matchHistory?.[0] ?? null;

  // Pre-generated log for the live viewer
  const [liveMatchLog, setLiveMatchLog]     = useState(null);
  const [liveLogLoading, setLiveLogLoading] = useState(false);
  const resultRecordedRef = useRef(false);

  // Load the pre-generated log when a match is live
  useEffect(() => {
    if (!isLive || !nextMatch?.id) return;
    setLiveLogLoading(true);
    apiGetMatchLog(nextMatch.id).then(data => {
      setLiveMatchLog(data);
      setLiveLogLoading(false);
    });
    resultRecordedRef.current = false;
  }, [isLive, nextMatch?.id]);

  // Load remote log for the replay viewer when not in-memory
  const [remoteMatchData, setRemoteMatchData] = useState(null);
  useEffect(() => {
    const matchId = latestMatch?.matchId;
    if (!matchId) return;
    if (latestMatch?.log?.length > 0) return;
    setRemoteMatchData(null);
    apiGetMatchLog(matchId).then(data => { if (data) setRemoteMatchData(data); });
  }, [latestMatch?.matchId, latestMatch?.log?.length]);

  const enrichedMatch = useMemo(() => {
    if (!latestMatch) return null;
    const remoteLog   = remoteMatchData?.events      || [];
    const remoteStats = remoteMatchData?.playerStats || {};
    return {
      ...latestMatch,
      log:         latestMatch.log?.length                          ? latestMatch.log         : remoteLog,
      playerStats: Object.keys(latestMatch.playerStats || {}).length ? latestMatch.playerStats : remoteStats,
    };
  }, [latestMatch, remoteMatchData]);

  // Called by LiveGameViewer when the game clock reaches GAME_DURATION_SEC
  const handleGameEnd = useCallback((matchLog) => {
    if (resultRecordedRef.current) return;
    resultRecordedRef.current = true;

    if (!nextMatch || !matchLog) return;
    const { homeScore, awayScore } = matchLog;

    // Persist result to Firestore (non-blocking, errors are non-fatal)
    apiRecordMatchResult({
      matchId:      nextMatch.id,
      leagueId:     nextMatch.leagueId,
      homeTeamId:   nextMatch.homeTeamId,
      awayTeamId:   nextMatch.awayTeamId,
      homeTeamName: nextMatch.homeTeamName,
      awayTeamName: nextMatch.awayTeamName,
      homeScore,
      awayScore,
      log:          matchLog.events        || [],
      playerStats:  matchLog.playerStats   || {},
      quarterScores: matchLog.quarterScores || [],
    }).catch(err => console.warn('Record match result error (non-fatal):', err));

    // Update in-memory state: mark match as played + add to matchHistory
    if (!team) return;
    const isHome  = nextMatch.homeTeamId === team.id;
    const won     = isHome ? homeScore > awayScore : awayScore > homeScore;
    const myScore = isHome ? homeScore : awayScore;
    const oppScore = isHome ? awayScore : homeScore;

    const historyEntry = {
      matchId:    nextMatch.id,
      date:       nextMatch.scheduledDate,
      opponent:   isHome ? nextMatch.awayTeamName : nextMatch.homeTeamName,
      result:     won ? 'Win' : 'Loss',
      homeScore,
      awayScore,
      homeTeam:   nextMatch.homeTeamName,
      awayTeam:   nextMatch.awayTeamName,
    };

    const updatedSeasonRecord = {
      wins:   (team.wins   || 0) + (won ? 1 : 0),
      losses: (team.losses || 0) + (won ? 0 : 1),
    };

    const updatedSeasonMatches = (team.seasonMatches || []).map(m =>
      m.id === nextMatch.id
        ? { ...m, played: true, result: { homeScore, awayScore } }
        : m
    );

    const updatedTeam = {
      ...team,
      seasonMatches: updatedSeasonMatches,
      matchHistory:  [historyEntry, ...(team.matchHistory || [])],
      wins:          updatedSeasonRecord.wins,
      losses:        updatedSeasonRecord.losses,
      seasonRecord:  updatedSeasonRecord,
    };

    dispatch({ type: 'UPDATE_TEAM', payload: updatedTeam });
    addNotification(
      `Game over! ${won ? '🏆 Victory' : '💔 Defeat'} — ${myScore}–${oppScore} vs ${historyEntry.opponent}`,
      won ? 'success' : 'info',
    );
  }, [nextMatch, team, dispatch, addNotification]);

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

      {/* Upcoming match countdown (only when not live) */}
      {nextMatch && !isLive && (
        <CountdownBanner nextMatch={nextMatch} team={team} navigate={navigate} />
      )}

      {/* Live viewer — shown during the game window */}
      {isLive && (
        liveLogLoading ? (
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ opacity: 0.6 }}>Loading live game data…</div>
          </div>
        ) : liveMatchLog ? (
          <LiveGameViewer
            key={nextMatch.id}
            fixture={nextMatch}
            matchLog={liveMatchLog}
            onGameEnd={handleGameEnd}
          />
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ opacity: 0.6 }}>Live game data unavailable. The schedule may need to be regenerated.</div>
          </div>
        )
      )}

      {/* Past match replay — shown when not live */}
      {!isLive && enrichedMatch && (
        <LiveMatchReplay latestMatch={enrichedMatch} />
      )}

      {/* Empty state — no matches at all */}
      {!isLive && !enrichedMatch && (
        <div className="empty-state">
          <div className="empty-state-icon">🏀</div>
          <div className="empty-state-title">No matches played yet</div>
          <div className="empty-state-desc">Matches simulate automatically on their scheduled date. Check the Calendar for upcoming fixtures.</div>
        </div>
      )}

      {/* Player stats for last played match */}
      {!isLive && <PlayerStatsTable match={enrichedMatch} userTeam={team} />}
    </div>
  );
}
