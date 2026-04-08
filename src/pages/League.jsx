import { useState, useMemo } from 'react';
import { useGame } from '../context/GameContext.jsx';
import { Trophy, TrendingUp, TrendingDown, ChevronUp, ChevronDown, Info, X } from 'lucide-react';
import { formatMatchDate } from '../engine/gameScheduler.js';

const REPUTATION_LEVELS = [
  [0,20,'Local Hopeful'],
  [21,40,'Regional Contender'],
  [41,60,'National Contender'],
  [61,80,'National Powerhouse'],
  [81,100,'Basketball Dynasty'],
];
function getRepLevel(rep) {
  return REPUTATION_LEVELS.find(([min,max]) => rep >= min && rep <= max)?.[2] || 'Local Hopeful';
}

export default function League() {
  const { state } = useGame();
  const [activeLeague, setActiveLeague] = useState('C-0');
  const [sortCol, setSortCol] = useState('wins');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showTeamSchedule, setShowTeamSchedule] = useState(false);

  const leagues = state.leagues || [];
  const allTeams = state.allTeams || [];
  const userTeam = state.userTeam;

  const allLeagueMatches = useMemo(() =>
    leagues.flatMap(l => l.schedule || []),
    [leagues]
  );

  // Get the active league object
  const currentLeague = useMemo(() => {
    if (activeLeague.startsWith('C-')) {
      const idx = parseInt(activeLeague.split('-')[1]);
      return leagues[idx] || null;
    }
    return null;
  }, [activeLeague, leagues]);

  // Get teams for the selected league
  const leagueTeams = useMemo(() => {
    if (!currentLeague) return [];
    return currentLeague.teams || allTeams.slice(0, 10);
  }, [currentLeague, allTeams]);

  // Add basketball stats to teams using Firestore standings + schedule-derived L10/Strk
  const teamsWithStats = useMemo(() => {
    const standings = currentLeague?.standings || [];
    const schedule  = currentLeague?.schedule  || [];
    const playedMatches = schedule.filter(m => m.played);

    // Build W/L from schedule directly (always fresh, even for auto-simulated matches).
    // Scores live in m.result.homeScore / m.result.awayScore (never at the top level).
    const winsMap = {}, lossesMap = {};
    schedule.filter(m => m.played && m.result?.homeScore != null).forEach(m => {
      const homeWon = m.result.homeScore > m.result.awayScore;
      winsMap[m.homeTeamId]   = (winsMap[m.homeTeamId]   ?? 0) + (homeWon ? 1 : 0);
      lossesMap[m.homeTeamId] = (lossesMap[m.homeTeamId] ?? 0) + (homeWon ? 0 : 1);
      winsMap[m.awayTeamId]   = (winsMap[m.awayTeamId]   ?? 0) + (homeWon ? 0 : 1);
      lossesMap[m.awayTeamId] = (lossesMap[m.awayTeamId] ?? 0) + (homeWon ? 1 : 0);
    });

    const rows = leagueTeams.filter(Boolean).map(t => {
      const full   = allTeams.find(a => a?.id === t.id) || t;
      const wins   = winsMap[t.id]   ?? 0;
      const losses = lossesMap[t.id] ?? 0;
      const played = wins + losses;
      const pct    = played > 0 ? wins / played : 0;

      // L10 and Strk: derive from league schedule
      const teamMatches = playedMatches
        .filter(m => m.homeTeamId === t.id || m.awayTeamId === t.id)
        .sort((a, b) => (a.scheduledDate || 0) - (b.scheduledDate || 0));

      const last10 = teamMatches.slice(-10);
      const l10Wins = last10.filter(m => {
        const us   = m.homeTeamId === t.id ? m.result?.homeScore : m.result?.awayScore;
        const them = m.homeTeamId === t.id ? m.result?.awayScore : m.result?.homeScore;
        return (us ?? 0) > (them ?? 0);
      }).length;
      const l10Losses = last10.length - l10Wins;
      const l10 = last10.length > 0 ? `${l10Wins}-${l10Losses}` : '—';

      // Streak: count from most-recent match backwards
      let streak = 0, streakType = '';
      for (let i = teamMatches.length - 1; i >= 0; i--) {
        const m = teamMatches[i];
        const teamScore = m.homeTeamId === t.id ? m.result?.homeScore : m.result?.awayScore;
        const oppScore  = m.homeTeamId === t.id ? m.result?.awayScore : m.result?.homeScore;
        const won = (teamScore ?? 0) > (oppScore ?? 0);
        if (streak === 0) { streakType = won ? 'W' : 'L'; streak = 1; }
        else if ((won && streakType === 'W') || (!won && streakType === 'L')) streak++;
        else break;
      }
      const strk = streak > 0 ? `${streakType}${streak}` : '—';

      return { ...full, wins, losses, played, pct, l10, strk };
    });

    // GB relative to leader
    const leader = [...rows].sort((a, b) => b.wins - a.wins || a.losses - b.losses)[0];
    return rows.map(t => ({
      ...t,
      gb: leader && t.id !== leader.id
        ? ((leader.wins - t.wins + t.losses - leader.losses) / 2)
        : null,
    }));
  }, [leagueTeams, currentLeague, allTeams]);

  const sorted = useMemo(() => {
    return [...teamsWithStats].filter(Boolean).sort((a, b) => {
      if (sortCol === 'name') {
        return sortDir === 'asc'
          ? String(a.name).localeCompare(String(b.name))
          : String(b.name).localeCompare(String(a.name));
      }
      // Default: wins desc, then losses asc (basketball standard)
      if (sortCol === 'wins') {
        return sortDir === 'asc'
          ? a.wins - b.wins || b.losses - a.losses
          : b.wins - a.wins || a.losses - b.losses;
      }
      const av = a[sortCol] ?? 0;
      const bv = b[sortCol] ?? 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [teamsWithStats, sortCol, sortDir]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return null;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const leagueTabs = [
    { id: 'A', label: 'Liga A', empty: true },
    { id: 'B', label: 'Liga B', empty: true },
    ...leagues.map((_, i) => ({ id: `C-${i}`, label: `Liga C-${i+1}`, empty: false })),
  ];

  if (!leagueTabs.find(t => t.id === 'C-0')) {
    leagueTabs.push({ id: 'C-0', label: 'Liga C-1', empty: false });
  }

  if (leagues.length === 0) {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <h1>League Table</h1>
          <p>Season standings, stats, and promotion/relegation zones</p>
        </div>
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"><Trophy size={48} /></div>
            <div className="empty-state-title">World Not Initialized</div>
            <div className="empty-state-desc">
              The game world hasn't been seeded yet. Ask your admin to run the world seed.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>League Table</h1>
        <p>Season standings, stats, and promotion/relegation zones</p>
      </div>

      {/* League tier selector */}
      <div className="flex gap-2 mb-5" style={{ flexWrap: 'wrap' }}>
        {leagueTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveLeague(tab.id)}
            className={`btn ${activeLeague === tab.id ? 'btn-primary' : 'btn-ghost'} btn-sm`}
          >
            <Trophy size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Rules */}
      <div className="card mb-4" style={{ background: 'var(--color-info-light)', border: '1px solid rgba(21,101,192,0.2)', padding: '12px 16px' }}>
        <div className="flex items-center gap-2 text-sm">
          <Info size={16} color="var(--color-info)" />
          <span style={{ color: 'var(--color-info)' }}>
            <strong>Scoring:</strong> Win = 2pts, Loss = 1pt &nbsp;|&nbsp;
            <strong>Promotion:</strong> Top 2 → next tier &nbsp;|&nbsp;
            <strong>Relegation:</strong> Bottom 2 replaced by new BOT teams &nbsp;|&nbsp;
            <strong>Tiebreaker:</strong> Goal Differential → Points Scored
          </span>
        </div>
      </div>

      {activeLeague === 'A' || activeLeague === 'B' ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"><Trophy size={48} /></div>
            <div className="empty-state-title">{activeLeague === 'A' ? 'Liga A' : 'Liga B'} - Coming Soon</div>
            <div className="empty-state-desc">
              These tiers are populated by teams promoted from lower leagues. Win Liga C to compete here!
            </div>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36, textAlign: 'center' }}>#</th>
                <th style={{ cursor: 'pointer', minWidth: 160 }} onClick={() => handleSort('name')}>
                  Team <SortIcon col="name" />
                </th>
                <th style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('wins')}>W <SortIcon col="wins" /></th>
                <th style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('losses')}>L <SortIcon col="losses" /></th>
                <th style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('pct')}>PCT <SortIcon col="pct" /></th>
                <th style={{ textAlign: 'center' }}>GB</th>
                <th style={{ textAlign: 'center' }}>L10</th>
                <th style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => handleSort('played')}>GP <SortIcon col="played" /></th>
                <th style={{ textAlign: 'center' }}>STRK</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No standings data available yet.</td></tr>
              )}
              {sorted.map((team, idx) => {
                const rank = idx + 1;
                const isPromo = rank <= 2;
                const isRel = rank >= sorted.length - 1 && sorted.length >= 4;
                const isUser = team.id === userTeam?.id;

                return (
                  <tr
                    key={team.id}
                    onClick={() => setSelectedTeam(team)}
                    style={{
                      cursor: 'pointer',
                      background: isUser ? 'rgba(232,98,26,0.08)' : undefined,
                    }}
                  >
                    <td>
                      <div className="flex items-center gap-1">
                        {isPromo && <TrendingUp size={12} color="var(--color-success)" />}
                        {isRel && <TrendingDown size={12} color="var(--color-danger)" />}
                        <span style={{
                          fontWeight: 700,
                          color: isPromo ? 'var(--color-success)' : isRel ? 'var(--color-danger)' : 'var(--text-muted)'
                        }}>{rank}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="avatar avatar-sm" style={{ background: isUser ? 'var(--color-primary-100)' : 'var(--bg-muted)' }}>
                          {team.name?.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold" style={{ color: isUser ? 'var(--color-primary)' : 'var(--text-primary)' }}>
                            {team.name} {isUser && '⭐'}
                          </div>
                          <div className="text-xs text-muted">{team.city || team.country}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{team.wins}</td>
                    <td style={{ textAlign: 'center' }}>{team.losses}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--color-primary)' }}>
                      {team.played > 0 ? (team.wins / team.played).toFixed(3).replace(/^0/, '') : '.000'}
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      {team.gb === null ? <strong>—</strong> : team.gb % 1 === 0 ? team.gb : team.gb.toFixed(1)}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{team.l10}</td>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{team.played}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: team.strk?.startsWith('W') ? 'var(--color-success)' : team.strk?.startsWith('L') ? 'var(--color-danger)' : 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                      {team.strk}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 mt-4" style={{ fontSize: 'var(--font-size-xs)' }}>
        <div className="flex items-center gap-1"><TrendingUp size={12} color="var(--color-success)" /><span className="text-muted">Promotion Zone (Top 2)</span></div>
        <div className="flex items-center gap-1"><TrendingDown size={12} color="var(--color-danger)" /><span className="text-muted">Relegation Zone (Bottom 2)</span></div>
        <div className="flex items-center gap-1"><span>⭐</span><span className="text-muted">Your Team</span></div>
      </div>

      {/* Team Detail Modal */}
      {selectedTeam && (() => {
        const teamMatches = allLeagueMatches
          .filter(m => m.homeTeamId === selectedTeam.id || m.awayTeamId === selectedTeam.id)
          .sort((a, b) => a.scheduledDate - b.scheduledDate);
        const upcoming = teamMatches.filter(m => !m.played);
        const past     = teamMatches.filter(m =>  m.played);

        return (
          <div className="modal-overlay" onClick={() => { setSelectedTeam(null); setShowTeamSchedule(false); }}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: showTeamSchedule ? 560 : 420 }}>
              <div className="modal-header">
                <h3>{selectedTeam.name}</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className={`btn btn-sm ${showTeamSchedule ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setShowTeamSchedule(s => !s)}
                    title="Toggle fixture list"
                  >
                    📅 {showTeamSchedule ? 'Hide Schedule' : 'View Schedule'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedTeam(null); setShowTeamSchedule(false); }}><X size={16} /></button>
                </div>
              </div>
              <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                {/* Stats */}
                <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 16 }}>
                  <div className="stat-card"><div className="stat-value">{selectedTeam.wins}</div><div className="stat-label">Wins</div></div>
                  <div className="stat-card"><div className="stat-value">{selectedTeam.losses}</div><div className="stat-label">Losses</div></div>
                  <div className="stat-card"><div className="stat-value">{selectedTeam.points}</div><div className="stat-label">Points</div></div>
                </div>
                <div className="text-sm text-muted">{selectedTeam.city || selectedTeam.country} · Stadium: {selectedTeam.stadiumName}</div>
                <div className="text-sm mt-2">
                  <span className="badge badge-orange">Reputation: {selectedTeam.rep}/100</span>
                  {' '}
                  <span className="text-muted">{getRepLevel(selectedTeam.rep)}</span>
                </div>
                <div className="text-sm mt-3 font-semibold">Players: {selectedTeam.players?.length || 0}</div>

                {/* Fixture list (toggled) */}
                {showTeamSchedule && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', borderBottom: '1px solid var(--border-color)', paddingBottom: 8, marginBottom: 12 }}>
                      Season Schedule · {teamMatches.length} fixtures
                    </div>

                    {upcoming.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 6 }}>
                          Upcoming ({upcoming.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {upcoming.slice(0, 8).map(m => {
                            const isHome = m.homeTeamId === selectedTeam.id;
                            const opp = isHome ? m.awayTeamName : m.homeTeamName;
                            return (
                              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)' }}>
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

                    {past.length > 0 && (
                      <div>
                        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 6 }}>
                          Results ({past.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {[...past].reverse().slice(0, 8).map(m => {
                            const isHome = m.homeTeamId === selectedTeam.id;
                            const opp = isHome ? m.awayTeamName : m.homeTeamName;
                            const won = isHome
                              ? (m.result?.homeScore ?? m.homeScore) > (m.result?.awayScore ?? m.awayScore)
                              : (m.result?.awayScore ?? m.awayScore) > (m.result?.homeScore ?? m.homeScore);
                            const hs = m.result?.homeScore ?? m.homeScore;
                            const as_ = m.result?.awayScore ?? m.awayScore;
                            return (
                              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span className={`badge ${won ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.55rem' }}>{won ? 'W' : 'L'}</span>
                                  vs {opp}
                                </div>
                                <span style={{ fontWeight: 700 }}>{hs}–{as_}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {teamMatches.length === 0 && (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16, fontSize: 'var(--font-size-sm)' }}>
                        No fixtures found for this team.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
