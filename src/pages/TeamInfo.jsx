import { useGame } from '../context/GameContext.jsx';
import GaugeBar from '../components/ui/GaugeBar.jsx';
import { Trophy, TrendingUp, Star, Shield, BarChart2, Zap } from 'lucide-react';

const REPUTATION_LEVELS = [
  [0,20,'Local Hopeful','🏘️'],
  [21,40,'Regional Contender','🌆'],
  [41,60,'National Contender','🏙️'],
  [61,80,'National Powerhouse','🌟'],
  [81,100,'Basketball Dynasty','👑'],
];
function getRepLevel(rep) {
  return REPUTATION_LEVELS.find(([min,max]) => rep >= min && rep <= max) || REPUTATION_LEVELS[0];
}

function getTopPlayer(players, stat) {
  if (!players?.length) return null;
  const withStats = players.filter(p => p.seasonStats && (p.seasonStats[stat] || 0) > 0);
  if (!withStats.length) return null;
  return withStats.sort((a, b) => {
    const agp = a.seasonStats.gamesPlayed || 1;
    const bgp = b.seasonStats.gamesPlayed || 1;
    return (b.seasonStats[stat] / bgp) - (a.seasonStats[stat] / agp);
  })[0];
}

function perGame(player, stat) {
  const games = player.seasonStats?.gamesPlayed || 1;
  const val = player.seasonStats?.[stat] || 0;
  return (val / games).toFixed(1);
}

export default function TeamInfo() {
  const { state } = useGame();
  const team = state.userTeam;

  if (!team) return <div className="empty-state"><div className="empty-state-title">No team data</div></div>;

  const wins = team.seasonRecord?.wins || 0;
  const losses = team.seasonRecord?.losses || 0;
  // Use real played count from calendar (seasonMatches), fall back to wins+losses
  const calendarPlayed = (team.seasonMatches || []).filter(m => m.played).length;
  const played = calendarPlayed || (wins + losses);
  const totalWins = team.overallRecord?.wins || wins;
  const totalLosses = team.overallRecord?.losses || losses;

  // Calculate streak using result field (W/L) or score comparison
  const history = team.matchHistory || [];
  let streak = 0, streakType = '';
  for (let i = 0; i < history.length; i++) {
    const m = history[i];
    const won = m.result === 'W' || (m.teamScore ?? m.userScore ?? 0) > (m.oppScore ?? m.opponentScore ?? 0);
    if (i === 0) { streakType = won ? 'W' : 'L'; streak = 1; }
    else if ((won && streakType === 'W') || (!won && streakType === 'L')) streak++;
    else break;
  }
  const streakText = streak > 0 ? `${streak}-Game ${streakType === 'W' ? 'Winning' : 'Losing'} Streak` : 'No streak';

  // Find league position
  const leagueTeams = state.allTeams?.slice(0, 10) || [];
  const sorted = [...leagueTeams].sort((a, b) =>
    ((b.seasonRecord?.wins || 0) * 2 + (b.seasonRecord?.losses || 0)) -
    ((a.seasonRecord?.wins || 0) * 2 + (a.seasonRecord?.losses || 0))
  );
  const position = sorted.findIndex(t => t.id === team.id) + 1 || '-';

  const topScorer = getTopPlayer(team.players, 'points');
  const topRebounder = getTopPlayer(team.players, 'rebounds');
  const topPlaymaker = getTopPlayer(team.players, 'assists');
  const topDefender = getTopPlayer(team.players, 'blocks');

  const repInfo = getRepLevel(team.reputation || 10);
  const repPct = team.reputation || 10;

  // Avg stats from real match history (no fallback hardcoded values)
  const historyWithScores = history.filter(m => (m.teamScore ?? m.userScore) != null);
  const avgPts = historyWithScores.length
    ? (historyWithScores.reduce((s, m) => s + (m.teamScore ?? m.userScore ?? 0), 0) / historyWithScores.length).toFixed(1)
    : '—';
  const avgOpp = historyWithScores.length
    ? (historyWithScores.reduce((s, m) => s + (m.oppScore ?? m.opponentScore ?? 0), 0) / historyWithScores.length).toFixed(1)
    : '—';
  // Per-game rebounds, assists, turnovers from aggregated player seasonStats
  const allPlayerStats = (team.players || []).reduce((acc, p) => {
    const ss = p.seasonStats || {};
    acc.rebounds  += ss.rebounds  || 0;
    acc.assists   += ss.assists   || 0;
    acc.turnovers += ss.turnovers || 0;
    return acc;
  }, { rebounds: 0, assists: 0, turnovers: 0 });
  const gp = Math.max(played, 1);
  const avgReb = played ? (allPlayerStats.rebounds  / gp).toFixed(1) : '—';
  const avgAst = played ? (allPlayerStats.assists   / gp).toFixed(1) : '—';
  const avgTo  = played ? (allPlayerStats.turnovers / gp).toFixed(1) : '—';

  return (
    <div className="animate-fade-in">
      {/* Team header */}
      <div className="card card-highlight mb-5" style={{ marginBottom: '1.5rem' }}>
        <div className="flex items-center gap-4">
          <div className="avatar avatar-xl" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', fontSize: '2rem', fontWeight: 900 }}>
            {team.name?.charAt(0)}
          </div>
          <div className="flex-1">
            <h2 style={{ color: 'white', fontSize: 'var(--font-size-2xl)', fontWeight: 900 }}>{team.name}</h2>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 'var(--font-size-sm)' }}>
              {team.city || team.country} · 🏟️ {team.stadiumName} · Est. {team.founded}
            </div>
            <div className="flex gap-2 mt-2">
              <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                Liga C · #{position}
              </span>
              <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                {repInfo[3]} {repInfo[2]}
              </span>
            </div>
          </div>
          <div className="text-right" style={{ color: 'white' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', letterSpacing: 2, lineHeight: 1 }}>
              {wins}-{losses}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 'var(--font-size-xs)', letterSpacing: 1 }}>SEASON RECORD</div>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Season Stats */}
        <div className="card">
          <div className="card-title mb-4">Season Overview</div>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)', marginBottom: 16 }}>
            <div className="stat-card"><div className="stat-value">{wins}</div><div className="stat-label">Wins</div></div>
            <div className="stat-card"><div className="stat-value">{losses}</div><div className="stat-label">Losses</div></div>
            <div className="stat-card"><div className="stat-value">{played}</div><div className="stat-label">Played</div></div>
            <div className="stat-card"><div className="stat-value">{position}</div><div className="stat-label">League Rank</div></div>
          </div>
          <div style={{ marginBottom: 8, fontSize: 'var(--font-size-sm)', fontWeight: 600, color: streak > 0 ? (streakType === 'W' ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--text-muted)' }}>
            {streak > 0 ? streakText : 'No current streak'}
          </div>
          <div className="text-xs text-muted">Career: {totalWins}W - {totalLosses}L</div>
        </div>

        {/* Per-Game Stats */}
        <div className="card">
          <div className="card-title mb-4">Per Game Averages</div>
          {[
            { label: 'Points Scored (PTS/G)', val: avgPts },
            { label: 'Points Allowed (OPP/G)', val: avgOpp },
            { label: 'Rebounds (REB/G)', val: avgReb },
            { label: 'Assists (AST/G)', val: avgAst },
            { label: 'Turnovers (TO/G)', val: avgTo },
          ].map(({ label, val }) => (
            <div key={label} className="flex justify-between items-center" style={{ marginBottom: 8, padding: '4px 0', borderBottom: '1px solid var(--border-color)' }}>
              <span className="text-sm text-muted">{label}</span>
              <span className="font-bold" style={{ color: 'var(--color-primary)' }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Players */}
      <div className="card mb-4">
        <div className="card-title mb-4">Statistical Leaders</div>
        <div className="grid-4" style={{ gap: 12 }}>
          {[
            { label: 'Top Scorer', player: topScorer, stat: 'points', icon: '🏀' },
            { label: 'Top Rebounder', player: topRebounder, stat: 'rebounds', icon: '💪' },
            { label: 'Top Playmaker', player: topPlaymaker, stat: 'assists', icon: '🎯' },
            { label: 'Top Defender', player: topDefender, stat: 'blocks', icon: '🛡️' },
          ].map(({ label, player, stat, icon }) => (
            <div key={label} className="stat-card">
              <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>{icon}</div>
              <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
              {player ? (
                <>
                  <div className="font-bold text-sm">{player.name?.split(' ')[1] || player.name}</div>
                  <div className="stat-value" style={{ fontSize: 'var(--font-size-xl)', marginTop: 4 }}>
                    {perGame(player, stat)}
                  </div>
                  <div className="text-xs text-muted">{stat}/game</div>
                </>
              ) : (
                <div className="text-sm text-muted">—</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Team Gauges + Reputation */}
      <div className="grid-2" style={{ gap: '1.5rem' }}>
        <div className="card">
          <div className="card-title mb-4">Team Status</div>
          <GaugeBar label="Motivation" value={team.motivationBar || 65} type="motivation" />
          <GaugeBar label="Momentum" value={team.momentumBar || 65} type="momentum" />
          <GaugeBar label="Chemistry" value={team.chemistryGauge || 50} type="chemistry" />
          <GaugeBar label="Fan Enthusiasm" value={team.fanEnthusiasm || 20} type="fan" />
        </div>
        <div className="card">
          <div className="card-title mb-4">Club Reputation</div>
          <div className="text-center" style={{ padding: '16px 0' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: 8 }}>{repInfo[3]}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', letterSpacing: 2, color: 'var(--color-primary)' }}>
              {repInfo[2].toUpperCase()}
            </div>
            <div className="text-sm text-muted mt-2">{repPct}/100 Reputation</div>
          </div>
          <div style={{ margin: '16px 0', height: 10, background: 'var(--bg-muted)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
            <div style={{ width: `${repPct}%`, height: '100%', background: 'linear-gradient(90deg, var(--color-primary), var(--color-warning))', borderRadius: 'var(--radius-full)' }} />
          </div>
          <div className="text-xs text-muted text-center">
            Higher reputation attracts better free agents & staff
          </div>
          <div className="text-center mt-3">
            <span className="badge badge-orange">Fans: {team.fanCount || 250}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
