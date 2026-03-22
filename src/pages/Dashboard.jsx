import { useGame } from '../context/GameContext.jsx';
import GaugeBar from '../components/ui/GaugeBar.jsx';
import {
  Trophy,
  TrendingUp,
  Users,
  DollarSign,
  Heart,
  Activity,
  Calendar,
  Star,
  ArrowRight,
  Zap,
  AlertCircle,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────

const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function getPlayerStats(player) {
  const s = player.seasonStats || {};
  const gp = s.gamesPlayed || 1;
  return {
    pts: (s.points / gp).toFixed(1),
    ast: (s.assists / gp).toFixed(1),
    reb: (s.rebounds / gp).toFixed(1),
    stl: (s.steals / gp).toFixed(1),
    blk: (s.blocks / gp).toFixed(1),
    fgPct:
      s.fgAttempts > 0 ? ((s.fgMade / s.fgAttempts) * 100).toFixed(1) : '0.0',
    gamesPlayed: s.gamesPlayed,
  };
}

// ── Sub-components ────────────────────────────────────────────

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="stat-card">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 'var(--space-2)',
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-primary-100)',
            color: 'var(--color-primary)',
          }}
        >
          {icon}
        </span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && (
        <div className="stat-change" style={{ color: 'var(--text-muted)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function WLBadge({ won }) {
  return (
    <span
      className={`badge ${won ? 'badge-green' : 'badge-red'}`}
      style={{ fontWeight: 800, fontSize: '0.7rem' }}
    >
      {won ? 'W' : 'L'}
    </span>
  );
}

function NewsItem({ icon, title, body, time }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-3)',
        paddingBottom: 'var(--space-3)',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      <span style={{ fontSize: '1.25rem', lineHeight: 1, marginTop: 2 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 2 }}>
          {title}
        </p>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>
          {body}
        </p>
        {time && (
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {time}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────

export default function Dashboard() {
  const { state } = useGame();
  const { userTeam, lastUpdated } = state;

  if (!userTeam) {
    return (
      <div className="page-content animate-fade-in">
        <div className="empty-state">
          <div className="empty-state-icon">🏀</div>
          <div className="empty-state-title">No team data found</div>
          <div className="empty-state-desc">
            Start a new game to see your dashboard.
          </div>
        </div>
      </div>
    );
  }

  const { seasonRecord, motivationBar, momentumBar, chemistryGauge, budget, fanCount, matchHistory, seasonMatches, players } = userTeam;

  // ── Next match ────────────────────────────────────────────
  const now = Date.now();
  const upcomingMatch = seasonMatches
    ? seasonMatches.find((m) => !m.played && new Date(m.date).getTime() > now)
    : null;

  // ── Recent results (last 3) ───────────────────────────────
  const recentMatches = matchHistory ? [...matchHistory].reverse().slice(0, 3) : [];

  // ── Top players ───────────────────────────────────────────
  const activePlayers = players || [];
  const statPlayers = activePlayers.filter(p => p?.seasonStats);
  const topScorer = [...statPlayers].sort(
    (a, b) => (b.seasonStats.points ?? 0) / (b.seasonStats.gamesPlayed || 1) - (a.seasonStats.points ?? 0) / (a.seasonStats.gamesPlayed || 1)
  )[0];
  const topRebounder = [...statPlayers].sort(
    (a, b) => (b.seasonStats.rebounds ?? 0) / (b.seasonStats.gamesPlayed || 1) - (a.seasonStats.rebounds ?? 0) / (a.seasonStats.gamesPlayed || 1)
  )[0];
  const topAssister = [...statPlayers].sort(
    (a, b) => (b.seasonStats.assists ?? 0) / (b.seasonStats.gamesPlayed || 1) - (a.seasonStats.assists ?? 0) / (a.seasonStats.gamesPlayed || 1)
  )[0];

  // ── Expiring contracts ────────────────────────────────────
  const expiringContracts = activePlayers.filter(p => (p.contractYears ?? 99) <= 1);

  // ── Injuries / squad news ─────────────────────────────────
  const injured = activePlayers.filter((p) => p.injuryStatus !== 'healthy');
  const highForm = activePlayers.filter((p) => p.lastFormRating >= 75);
  const lowFatigue = activePlayers.filter((p) => p.fatigue < 20);

  // ── League position ───────────────────────────────────────
  let leaguePosition = '–';
  if (state.leagues) {
    const userLeague = state.leagues.find((lg) =>
      lg.teams ? lg.teams.some((t) => t.id === userTeam.id) : false
    );
    if (userLeague && userLeague.standings) {
      const sorted = [...userLeague.standings].sort(
        (a, b) => b.wins - a.wins || a.losses - b.losses
      );
      const idx = sorted.findIndex((s) => s.teamId === userTeam.id);
      leaguePosition = idx >= 0 ? `#${idx + 1}` : '–';
    }
  }

  return (
    <div className="page-content animate-fade-in">
      {/* Page header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div>
            <h1>Dashboard</h1>
            <p>{userTeam.name}</p>
          </div>
          {lastUpdated && (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              Last updated: {new Date(lastUpdated).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Expiring contracts alert */}
      {expiringContracts.length > 0 && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: 'var(--space-5)',
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <AlertCircle size={18} color="#ef4444" />
          <div>
            <span style={{ fontWeight: 700, color: '#ef4444', fontSize: 'var(--font-size-sm)' }}>
              {expiringContracts.length} contract{expiringContracts.length > 1 ? 's' : ''} expiring this season!
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginLeft: 8 }}>
              {expiringContracts.map(p => p.name).join(', ')}
            </span>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="stats-grid mb-6">
        <StatCard
          icon={<Trophy size={18} />}
          label="Season Record"
          value={`${seasonRecord.wins}–${seasonRecord.losses}`}
          sub={`${seasonRecord.wins + seasonRecord.losses} games played`}
        />
        <StatCard
          icon={<TrendingUp size={18} />}
          label="League Position"
          value={leaguePosition}
          sub="Current standings"
        />
        <StatCard
          icon={<DollarSign size={18} />}
          label="Balance"
          value={`$${budget?.toLocaleString?.() ?? budget}`}
          sub="Available funds"
        />
        <StatCard
          icon={<Users size={18} />}
          label="Fan Count"
          value={fanCount?.toLocaleString() ?? '–'}
          sub="Season followers"
        />
      </div>

      {/* Debt alert */}
      {budget < 0 && (() => {
        const debtAmount = Math.abs(budget);
        const monthlyInterest = Math.round(debtAmount * 0.04);
        return (
          <div style={{
            background: 'rgba(239,68,68,0.10)',
            border: '1.5px solid rgba(239,68,68,0.45)',
            borderRadius: 'var(--radius-lg)',
            padding: '18px 20px',
            marginBottom: 'var(--space-5)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <AlertCircle size={20} color="#ef4444" />
              <span style={{ fontWeight: 800, color: '#ef4444', fontSize: 'var(--font-size-base)' }}>
                ⚠️ Team in Debt
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-5)', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
                  Current Debt
                </div>
                <div style={{ fontWeight: 900, fontSize: 'var(--font-size-xl)', color: '#ef4444' }}>
                  ${debtAmount.toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
                  Monthly Interest (4%)
                </div>
                <div style={{ fontWeight: 900, fontSize: 'var(--font-size-xl)', color: '#ef4444' }}>
                  ${monthlyInterest.toLocaleString()}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: '#b91c1c', fontWeight: 600 }}>
              Debt grows 4% monthly until resolved. Reduce expenses or increase revenue to clear the deficit.
            </div>
          </div>
        );
      })()}

      {/* Team gauges + Next match */}
      <div className="grid-2 mb-6">
        {/* Gauges */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Activity size={16} style={{ color: 'var(--color-primary)' }} />
              Team Morale
            </span>
          </div>
          <GaugeBar label="Motivation" value={motivationBar} type="motivation" />
          <GaugeBar label="Momentum" value={momentumBar} type="momentum" />
          <GaugeBar label="Chemistry" value={chemistryGauge} type="chemistry" />
          {fanCount !== undefined && (
            <GaugeBar label="Fan Enthusiasm" value={userTeam.fanEnthusiasm ?? 20} type="fan" />
          )}
        </div>

        {/* Next match */}
        {upcomingMatch ? (
          <div className="card card-highlight">
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Calendar size={16} />
                Next Match
              </span>
            </div>
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, marginBottom: 'var(--space-1)' }}>
                {upcomingMatch.opponentName || 'Opponent TBD'}
              </div>
              <div style={{ opacity: 0.85, fontSize: 'var(--font-size-sm)' }}>
                {formatDate(upcomingMatch.date)}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
              <span
                style={{
                  padding: '3px 12px',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(255,255,255,0.25)',
                  fontWeight: 700,
                  fontSize: 'var(--font-size-xs)',
                  color: 'white',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                {upcomingMatch.isHome ? 'Home' : 'Away'}
              </span>
              <ArrowRight size={16} style={{ opacity: 0.7, marginLeft: 'auto' }} />
            </div>
          </div>
        ) : (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)', minHeight: 140 }}>
            <Calendar size={32} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>No upcoming matches scheduled</p>
          </div>
        )}
      </div>

      {/* Recent results + Top players */}
      <div className="grid-2 mb-6">
        {/* Recent results */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Trophy size={16} style={{ color: 'var(--color-primary)' }} />
              Recent Results
            </span>
          </div>
          {recentMatches.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', textAlign: 'center', padding: 'var(--space-4) 0' }}>
              No matches played yet
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {recentMatches.map((m, i) => {
                const won = m.userScore > m.opponentScore;
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-muted)',
                    }}
                  >
                    <WLBadge won={won} />
                    <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {m.opponentName || 'Unknown'}
                    </span>
                    <span style={{ fontWeight: 800, color: won ? 'var(--color-success)' : 'var(--color-danger)', fontSize: 'var(--font-size-sm)' }}>
                      {m.userScore}–{m.opponentScore}
                    </span>
                    {m.date && (
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {formatDate(m.date)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top players */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Star size={16} style={{ color: 'var(--color-primary)' }} />
              Top Performers
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {[
              { label: 'Top Scorer', player: topScorer, stat: topScorer ? `${getPlayerStats(topScorer).pts} PPG` : '–' },
              { label: 'Top Rebounder', player: topRebounder, stat: topRebounder ? `${getPlayerStats(topRebounder).reb} RPG` : '–' },
              { label: 'Assist Leader', player: topAssister, stat: topAssister ? `${getPlayerStats(topAssister).ast} APG` : '–' },
            ].map(({ label, player, stat }) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-muted)',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--color-primary-100)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-primary)',
                    flexShrink: 0,
                  }}
                >
                  {player?.avatar?.emoji || player?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2) || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {player?.name || 'N/A'}
                  </p>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{label}</p>
                </div>
                <span style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: 'var(--font-size-sm)', whiteSpace: 'nowrap' }}>
                  {stat}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Community news + Squad news */}
      <div className="grid-2 mb-6">
        {/* Community / league news */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Zap size={16} style={{ color: 'var(--color-primary)' }} />
              League News
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <NewsItem
              icon="📰"
              title="Season standings tighten at the top"
              body="Several teams are within two wins of first place as the midpoint of the season approaches."
              time="2h ago"
            />
            <NewsItem
              icon="🏆"
              title="Liga C promotions race heats up"
              body="Five clubs are still in contention for the two promotion spots with six matchdays remaining."
              time="5h ago"
            />
            <NewsItem
              icon="⚡"
              title="Record-breaking scoring night in Liga C"
              body="A stunning triple-overtime thriller saw 235 combined points across the two teams last weekend."
              time="1d ago"
            />
            <NewsItem
              icon="👁"
              title="Scouts spotted at recent fixtures"
              body="A Liga B club has been sending scouts to monitor performances in the Group 3 fixtures."
              time="2d ago"
            />
          </div>
        </div>

        {/* Squad news */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Heart size={16} style={{ color: 'var(--color-primary)' }} />
              Squad News
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {injured.length > 0 ? (
              injured.slice(0, 2).map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 'var(--space-3)',
                    paddingBottom: 'var(--space-3)',
                    borderBottom: '1px solid var(--border-color)',
                  }}
                >
                  <AlertCircle size={16} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                      {p.name} – <span style={{ textTransform: 'capitalize' }}>{p.injuryStatus}</span> injury
                    </p>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                      {p.injuryDaysRemaining > 0
                        ? `Expected return in ${p.injuryDaysRemaining} day${p.injuryDaysRemaining !== 1 ? 's' : ''}`
                        : 'Recovery in progress'}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  paddingBottom: 'var(--space-3)',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <span style={{ color: 'var(--color-success)', fontSize: '1rem' }}>✔</span>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  No injuries — full squad available
                </p>
              </div>
            )}

            {highForm.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-3)',
                  paddingBottom: 'var(--space-3)',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <Star size={16} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                    {highForm[0].name} in great form
                  </p>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    Form rating: {highForm[0].lastFormRating}/100 — on fire this week
                  </p>
                </div>
              </div>
            )}

            {lowFatigue.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-3)',
                }}
              >
                <Activity size={16} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                    {lowFatigue.length} player{lowFatigue.length !== 1 ? 's' : ''} fully rested
                  </p>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    Low fatigue — ready for the next fixture
                  </p>
                </div>
              </div>
            )}

            {highForm.length === 0 && lowFatigue.length === 0 && injured.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', textAlign: 'center', padding: 'var(--space-4) 0' }}>
                Nothing to report right now
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
