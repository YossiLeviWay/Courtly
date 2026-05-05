import { useState } from 'react';
import { useGame } from '../context/GameContext.jsx';
import MatchDetailModal from '../components/MatchDetailModal.jsx';
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
  Newspaper,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────

const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function timeAgo(ts) {
  if (!ts) return null;
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

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

  const [selectedMatch, setSelectedMatch] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showFanHistory, setShowFanHistory] = useState(false);

  const { seasonRecord, motivationBar, momentumBar, chemistryGauge, budget, fanCount, matchHistory, seasonMatches, players, financeLog, fanWeeklyHistory, lastGameTopPerformers } = userTeam;

  // ── Next match (earliest unplayed, sorted by date) ───────
  const upcomingMatch = seasonMatches
    ? [...seasonMatches]
        .sort((a, b) => (a.date || a.scheduledDate || 0) - (b.date || b.scheduledDate || 0))
        .find((m) => !m.played)
    : null;

  // ── Recent results (last 5) ───────────────────────────────
  // matchHistory[0] is the newest entry (unshifted on each match), so no reverse needed
  const recentMatches = matchHistory ? [...matchHistory].slice(0, 5) : [];

  // ── Top players (deduplicated — each player can only win one category) ─────
  const activePlayers = players || [];
  const statPlayers = activePlayers.filter(p => p?.seasonStats);
  const _usedPerformerIds = new Set();
  function _topUnique(arr, key) {
    const eligible = arr.filter(p => !_usedPerformerIds.has(p.id));
    const sorted = [...eligible].sort(
      (a, b) => (b.seasonStats[key] ?? 0) / (b.seasonStats.gamesPlayed || 1) - (a.seasonStats[key] ?? 0) / (a.seasonStats.gamesPlayed || 1)
    );
    const winner = sorted[0] || null;
    if (winner) _usedPerformerIds.add(winner.id);
    return winner;
  }
  const topScorer    = _topUnique(statPlayers, 'points');
  const topRebounder = _topUnique(statPlayers, 'rebounds');
  const topAssister  = _topUnique(statPlayers, 'assists');

  // ── Expiring contracts ────────────────────────────────────
  const expiringContracts = activePlayers.filter(p => (p.contractYears ?? 99) <= 1);

  // ── Injuries / squad news ─────────────────────────────────
  const injured = activePlayers.filter((p) => p.injuryStatus && p.injuryStatus !== 'healthy');
  const highForm = activePlayers.filter((p) => p.lastFormRating >= 75);
  const lowFatigue = activePlayers.filter((p) => p.fatigue < 20);

  // ── League position + schedule-derived record (same source as League page) ──
  // Derive W/L by walking the schedule so Dashboard always matches League page.
  let leaguePosition = '–';
  let scheduleWins = seasonRecord?.wins ?? 0;
  let scheduleLosses = seasonRecord?.losses ?? 0;
  const userLeague = state.leagues?.find(lg => lg.teams?.some(t => t.id === userTeam.id));
  if (userLeague?.schedule) {
    const winsMap = {}, lossesMap = {};
    userLeague.schedule
      .filter(m => m.played && m.result?.homeScore != null)
      .forEach(m => {
        const homeWon = m.result.homeScore > m.result.awayScore;
        winsMap[m.homeTeamId]   = (winsMap[m.homeTeamId]   ?? 0) + (homeWon ? 1 : 0);
        lossesMap[m.homeTeamId] = (lossesMap[m.homeTeamId] ?? 0) + (homeWon ? 0 : 1);
        winsMap[m.awayTeamId]   = (winsMap[m.awayTeamId]   ?? 0) + (homeWon ? 0 : 1);
        lossesMap[m.awayTeamId] = (lossesMap[m.awayTeamId] ?? 0) + (homeWon ? 1 : 0);
      });

    scheduleWins   = winsMap[userTeam.id]   ?? scheduleWins;
    scheduleLosses = lossesMap[userTeam.id] ?? scheduleLosses;

    // Position: sort all teams by the same schedule-derived W/L
    const allTeamIds = (userLeague.teams || []).map(t => t.id);
    const sorted = allTeamIds
      .map(id => ({ id, wins: winsMap[id] ?? 0, losses: lossesMap[id] ?? 0 }))
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses);
    const idx = sorted.findIndex(t => t.id === userTeam.id);
    leaguePosition = idx >= 0 ? `#${idx + 1}` : '–';
  } else if (userLeague?.standings) {
    // Fallback to standings if schedule not available
    const sorted = [...userLeague.standings].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
    const idx = sorted.findIndex(s => s.teamId === userTeam.id);
    leaguePosition = idx >= 0 ? `#${idx + 1}` : '–';
  }
  const gamesPlayed = scheduleWins + scheduleLosses;

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
          value={`${scheduleWins}–${scheduleLosses}`}
          sub={`${gamesPlayed} game${gamesPlayed !== 1 ? 's' : ''} played`}
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
        <div
          className="stat-card"
          onClick={() => setShowFanHistory(true)}
          style={{ cursor: 'pointer', transition: 'box-shadow 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
          title="Click to see weekly fan growth history"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-2)' }}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 'var(--radius-full)', background: 'var(--color-primary-100)', color: 'var(--color-primary)' }}>
              <Users size={18} />
            </span>
          </div>
          <div className="stat-value">{fanCount?.toLocaleString() ?? '–'}</div>
          <div className="stat-label">Fan Count</div>
          <div className="stat-change" style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
            {fanWeeklyHistory?.length > 0
              ? `+${fanWeeklyHistory[0].growth} last week · tap for history`
              : 'Tap to see history'}
          </div>
        </div>
      </div>

      {/* Debt alert */}
      {budget < 0 && (() => {
        const debtAmount = Math.abs(budget);
        const weeklyInterest = Math.round(debtAmount * 0.05);
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
                ⚠️ Team in Deficit — Upgrades & Signings Locked
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-5)', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
                  Current Debt
                </div>
                <div style={{ fontWeight: 900, fontSize: 'var(--font-size-xl)', color: '#ef4444' }}>
                  ${debtAmount.toLocaleString()}k
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
                  Weekly Interest (5%)
                </div>
                <div style={{ fontWeight: 900, fontSize: 'var(--font-size-xl)', color: '#ef4444' }}>
                  ${weeklyInterest.toLocaleString()}k / week
                </div>
              </div>
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: '#b91c1c', fontWeight: 600 }}>
              Debt compounds 5% every Sunday. Win home games, grow fans, and upgrade your Merchandise Store to clear it.
            </div>
          </div>
        );
      })()}

      {/* Team gauges + Next match */}
      <div className="grid-2 mb-6">
        {/* Team Pulse panel — Investment Pardon System */}
        {(() => {
          const now = Date.now();
          const mot  = motivationBar  ?? 60;
          const mom  = momentumBar    ?? 65;
          const chem = chemistryGauge ?? 50;
          const enth = userTeam.fanEnthusiasm ?? 20;

          // ── Investment Pardon System ──────────────────────────────
          const lastInvest = userTeam.lastInvestmentTimestamp ?? 0;
          const daysSinceInvest = lastInvest > 0 ? (now - lastInvest) / 86400000 : 999;
          const weeksPlayed = userTeam.weeksPlayed ?? 0;

          // Determine investment state
          const isInvesting   = daysSinceInvest < 7;   // active construction / recent upgrade
          const isRecent      = daysSinceInvest >= 7  && daysSinceInvest < 14; // pardon window
          const isStagnating  = daysSinceInvest >= 14 && daysSinceInvest < 30;
          const isNeglecting  = daysSinceInvest >= 30;

          // Expected minimum facility investment based on team age
          const getFacLevel = (key) => {
            const f = userTeam.facilities?.[key];
            return typeof f === 'number' ? f : (f?.level ?? 0);
          };
          const totalFacLevel = ['trainingCourt', 'gym', 'youthAcademy', 'media', 'merchandise',
            'basketballHall', 'medicalCenter', 'scoutingOffice'].reduce(
              (sum, k) => sum + getFacLevel(k), 0
            );
          const expectedMinTotal = Math.floor(weeksPlayed / 3); // ~1 level per 3 weeks
          const isBelowExpected  = weeksPlayed >= 4 && totalFacLevel < expectedMinTotal;

          // Calculate gauge penalty modifiers
          let motPenalty  = 0;
          let chemPenalty = 0;
          let enthPenalty = 0;
          let penaltyReason = '';

          if (!isInvesting && !isRecent) {
            if (isNeglecting && isBelowExpected) {
              // Severe neglect (30+ days + below expected)
              motPenalty  = 15;
              chemPenalty = 15;
              enthPenalty = 15;
              penaltyReason = 'severe_neglect';
            } else if (isStagnating && isBelowExpected) {
              // Stagnation (14-30 days + below expected)
              motPenalty  = 5;
              chemPenalty = 5;
              penaltyReason = 'stagnating';
            }
          }

          // Effective values (penalties are visual only here; real values come from match engine)
          const motEff  = Math.max(10, mot  - motPenalty);
          const momEff  = mom; // momentum not penalised by neglect
          const chemEff = Math.max(10, chem - chemPenalty);
          const enthEff = Math.max(5,  enth - enthPenalty);

          const overallPulse = Math.round((motEff + momEff + chemEff + enthEff) / 4);
          const pulseLabel = overallPulse >= 75 ? 'Excellent' : overallPulse >= 55 ? 'Good' : overallPulse >= 35 ? 'Average' : 'Low';
          const pulseColor = overallPulse >= 75 ? '#22c55e' : overallPulse >= 55 ? '#f97316' : overallPulse >= 35 ? '#eab308' : '#ef4444';

          // Investment state badge config
          const investBadge = isInvesting
            ? { label: '🏗️ Investing', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', desc: 'Players see progress — all penalties waived' }
            : isRecent
            ? { label: '✅ Pardon', color: '#22c55e', bg: 'rgba(34,197,94,0.08)', desc: 'Recent upgrade keeps morale protected' }
            : isStagnating && isBelowExpected
            ? { label: '⚠️ Stagnating', color: '#eab308', bg: 'rgba(234,179,8,0.10)', desc: '14+ days without investment — minor penalty active' }
            : isNeglecting && isBelowExpected
            ? { label: '🔴 Neglect', color: '#ef4444', bg: 'rgba(239,68,68,0.10)', desc: '30+ days — severe morale & fan penalty active' }
            : null;

          function getStatus(v) {
            if (v >= 70) return { label: 'High', color: '#22c55e' };
            if (v >= 45) return { label: 'OK', color: '#eab308' };
            return { label: 'Low', color: '#ef4444' };
          }

          const gauges = [
            {
              label: 'Motivation',
              icon: '🔥',
              value: motEff,
              rawValue: mot,
              penalty: motPenalty,
              type: 'motivation',
              impacts: [
                { area: '⚔️ Attack', detail: motEff >= 70 ? `+${Math.round((motEff-50)*0.08)}% scoring` : motEff < 45 ? '−shot quality' : 'neutral' },
                { area: '🏀 Clutch', detail: motEff >= 70 ? 'clutch shots ↑' : motEff < 45 ? 'chokes ↑' : 'average' },
                { area: '👥 Fans', detail: motEff >= 60 ? 'growing faster' : 'slow growth' },
              ],
            },
            {
              label: 'Momentum',
              icon: '⚡',
              value: momEff,
              rawValue: mom,
              penalty: 0,
              type: 'momentum',
              impacts: [
                { area: '📊 All Stats', detail: momEff >= 70 ? `+${Math.round((momEff-50)*0.06)}% boost` : momEff < 45 ? 'stats dip' : 'baseline' },
                { area: '🛡️ Defence', detail: momEff >= 65 ? 'solid rotations' : 'breakdowns' },
                { area: '🏟️ Crowd', detail: momEff >= 60 ? 'home roar ↑' : 'quiet crowd' },
              ],
            },
            {
              label: 'Chemistry',
              icon: '🤝',
              value: chemEff,
              rawValue: chem,
              penalty: chemPenalty,
              type: 'chemistry',
              impacts: [
                { area: '🎯 Passing', detail: chemEff >= 70 ? 'fluid assists ↑' : chemEff < 40 ? 'turnovers ↑' : 'average' },
                { area: '🧠 IQ', detail: chemEff >= 65 ? 'smart cuts ↑' : 'isolation ball' },
                { area: '🤜 Unity', detail: chemEff >= 60 ? 'team-first' : 'selfish plays' },
              ],
            },
            {
              label: 'Fan Enthusiasm',
              icon: '💜',
              value: enthEff,
              rawValue: enth,
              penalty: enthPenalty,
              type: 'fan',
              impacts: [
                { area: '📈 Weekly', detail: `+${Math.round((enthEff/100)*50 + (enthEff>50?20:0))} new fans` },
                { area: '🎟️ Tickets', detail: enthEff >= 60 ? 'high attendance' : enthEff < 30 ? 'empty seats' : 'half capacity' },
                { area: '💰 Revenue', detail: enthEff >= 55 ? 'gate income ↑' : 'low gate $' },
              ],
            },
          ];

          return (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{
                background: `linear-gradient(135deg, ${pulseColor}18 0%, ${pulseColor}08 100%)`,
                borderBottom: `1px solid ${pulseColor}30`,
                padding: '14px 18px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
                  <Activity size={16} style={{ color: pulseColor }} />
                  Team Pulse
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 48, height: 8, borderRadius: 4, background: 'var(--bg-muted)', overflow: 'hidden' }}>
                    <div style={{ width: `${overallPulse}%`, height: '100%', background: pulseColor, borderRadius: 4, transition: 'width 0.4s ease' }} />
                  </div>
                  <span style={{ fontWeight: 900, fontSize: 'var(--font-size-sm)', color: pulseColor }}>{pulseLabel}</span>
                </div>
              </div>

              {/* Investment Pardon banner */}
              {investBadge && (
                <div style={{
                  padding: '8px 18px',
                  background: investBadge.bg,
                  borderBottom: `1px solid ${investBadge.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                }}>
                  <span style={{ fontWeight: 800, fontSize: '0.72rem', color: investBadge.color }}>
                    {investBadge.label}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', flex: 1 }}>
                    {investBadge.desc}
                  </span>
                  {lastInvest > 0 && (
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {daysSinceInvest < 1 ? 'Today' : `${Math.floor(daysSinceInvest)}d ago`}
                    </span>
                  )}
                </div>
              )}

              {/* Gauge rows */}
              <div style={{ padding: '8px 0' }}>
                {gauges.map(g => {
                  const st = getStatus(g.value);
                  const hasPenalty = g.penalty > 0;
                  return (
                    <div key={g.label} style={{ padding: '9px 18px 7px', borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {g.icon} {g.label}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {hasPenalty && (
                            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '1px 6px', borderRadius: 99 }}>
                              −{g.penalty} neglect
                            </span>
                          )}
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: st.color, background: `${st.color}18`, padding: '2px 7px', borderRadius: 99 }}>
                            {st.label}
                          </span>
                          <span style={{ fontWeight: 900, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', minWidth: 26, textAlign: 'right' }}>
                            {Math.round(g.value)}
                          </span>
                        </div>
                      </div>
                      <div style={{ height: 7, background: 'var(--bg-muted)', borderRadius: 4, marginBottom: 7, overflow: 'hidden' }}>
                        <div className={`gauge-fill gauge-${g.type}`} style={{ width: `${g.value}%`, height: '100%', borderRadius: 4 }} />
                      </div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {g.impacts.map((imp, i) => (
                          <span key={i} style={{
                            fontSize: '0.63rem', fontWeight: 600, color: 'var(--text-muted)',
                            background: 'var(--bg-muted)', padding: '2px 7px', borderRadius: 99, whiteSpace: 'nowrap',
                          }}>
                            {imp.area}: <strong style={{ color: 'var(--text-secondary)' }}>{imp.detail}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Next match */}
        {upcomingMatch ? (() => {
          // Find rival team data from the league schedule
          const rivalId   = upcomingMatch.isHome ? upcomingMatch.opponentId : upcomingMatch.opponentId;
          const rivalName = upcomingMatch.opponentName || 'Opponent TBD';
          const rivalTeam = userLeague?.teams?.find(t => t.id === rivalId || t.name === rivalName);

          // Rival's recent form from schedule (last 5 played matches involving rival)
          const rivalMatches = (userLeague?.schedule || [])
            .filter(m => m.played && (m.homeTeamId === rivalId || m.awayTeamId === rivalId))
            .sort((a, b) => (b.scheduledDate || 0) - (a.scheduledDate || 0))
            .slice(0, 5);
          const rivalForm = rivalMatches.map(m => {
            if (!m.result) return null;
            const rivalWon = m.homeTeamId === rivalId
              ? m.result.homeScore > m.result.awayScore
              : m.result.awayScore > m.result.homeScore;
            return rivalWon ? 'W' : 'L';
          }).filter(Boolean);
          const rivalWins   = rivalForm.filter(r => r === 'W').length;
          const rivalLosses = rivalForm.filter(r => r === 'L').length;

          // Rival's top 2 players by overall rating
          const rivalTopPlayers = [...(rivalTeam?.players || [])]
            .sort((a, b) => (b.overallRating || 0) - (a.overallRating || 0))
            .slice(0, 2);

          return (
            <div className="card card-highlight">
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Calendar size={16} />
                  Next Match
                </span>
                <span style={{ fontSize: 'var(--font-size-xs)', opacity: 0.8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {upcomingMatch.isHome ? 'Home' : 'Away'}
                </span>
              </div>

              {/* Opponent name + date */}
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, marginBottom: 'var(--space-1)' }}>
                  {rivalName}
                </div>
                <div style={{ opacity: 0.85, fontSize: 'var(--font-size-sm)' }}>
                  {formatDate(upcomingMatch.date)}
                </div>
              </div>

              {/* Rival form badges */}
              {rivalForm.length > 0 && (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                    Rival Form — {rivalWins}W {rivalLosses}L
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {rivalForm.map((r, i) => (
                      <span key={i} style={{
                        width: 22, height: 22, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.65rem', fontWeight: 800,
                        background: r === 'W' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)',
                        color: r === 'W' ? '#4ade80' : '#f87171',
                        border: `1px solid ${r === 'W' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
                      }}>{r}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Rival key players */}
              {rivalTopPlayers.length > 0 && (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                    Watch out for
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {rivalTopPlayers.map(p => (
                      <div key={p.id} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'rgba(255,255,255,0.12)', borderRadius: 'var(--radius-md)',
                        padding: '4px 8px',
                      }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.9)' }}>
                          {p.name?.split(' ').slice(-1)[0] || p.name}
                        </span>
                        <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.55)' }}>
                          {p.position} · {p.overallRating}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                <ArrowRight size={16} style={{ opacity: 0.7, marginLeft: 'auto' }} />
              </div>
            </div>
          );
        })() : (
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
                const won = m.result === 'W' || (m.teamScore ?? m.userScore ?? 0) > (m.oppScore ?? m.opponentScore ?? 0);
                const displayScore = `${m.teamScore ?? m.userScore ?? '?'}–${m.oppScore ?? m.opponentScore ?? '?'}`;
                const hasMatchId = !!m.matchId;
                return (
                  <div
                    key={i}
                    onClick={hasMatchId ? () => setSelectedMatch({
                      id: m.matchId,
                      homeTeamId: m.isHome ? userTeam.id : m.opponentId,
                      awayTeamId: m.isHome ? m.opponentId : userTeam.id,
                      homeTeamName: m.homeTeam || (m.isHome ? userTeam.name : m.opponent),
                      awayTeamName: m.awayTeam || (m.isHome ? m.opponent : userTeam.name),
                      scheduledDate: m.date || m.matchDate,
                      homeScore: m.homeScore,
                      awayScore: m.awayScore,
                    }) : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-muted)',
                      cursor: hasMatchId ? 'pointer' : 'default',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (hasMatchId) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-muted)'; }}
                  >
                    <WLBadge won={won} />
                    <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {m.opponent || m.opponentName || m.awayTeam || m.homeTeam || 'Unknown'}
                    </span>
                    <span style={{ fontWeight: 800, color: won ? 'var(--color-success)' : 'var(--color-danger)', fontSize: 'var(--font-size-sm)' }}>
                      {displayScore}
                    </span>
                    {m.date && (
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {formatDate(m.date)}
                      </span>
                    )}
                    {hasMatchId && <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)' }}>›</span>}
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
            {lastGameTopPerformers ? (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 700 }}>
                vs {lastGameTopPerformers.opponent}
              </span>
            ) : (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Season avg</span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {(lastGameTopPerformers ? [
              { label: 'Top Scorer',    player: activePlayers.find(p => p.id === lastGameTopPerformers.topScorer?.playerId)    || { name: lastGameTopPerformers.topScorer?.name,    id: lastGameTopPerformers.topScorer?.playerId },    stat: `${lastGameTopPerformers.topScorer?.pts ?? 0} PTS` },
              { label: 'Top Rebounder', player: activePlayers.find(p => p.id === lastGameTopPerformers.topRebounder?.playerId) || { name: lastGameTopPerformers.topRebounder?.name, id: lastGameTopPerformers.topRebounder?.playerId }, stat: `${lastGameTopPerformers.topRebounder?.reb ?? 0} REB` },
              { label: 'Assist Leader', player: activePlayers.find(p => p.id === lastGameTopPerformers.topAssister?.playerId)  || { name: lastGameTopPerformers.topAssister?.name,  id: lastGameTopPerformers.topAssister?.playerId },  stat: `${lastGameTopPerformers.topAssister?.ast ?? 0} AST` },
            ] : [
              { label: 'Top Scorer',    player: topScorer,    stat: topScorer    ? `${getPlayerStats(topScorer).pts} PPG`    : '–' },
              { label: 'Top Rebounder', player: topRebounder, stat: topRebounder ? `${getPlayerStats(topRebounder).reb} RPG` : '–' },
              { label: 'Assist Leader', player: topAssister,  stat: topAssister  ? `${getPlayerStats(topAssister).ast} APG`  : '–' },
            ]).map(({ label, player, stat }) => (
              <div
                key={label}
                onClick={player ? () => setSelectedPlayer(player) : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-muted)',
                  cursor: player ? 'pointer' : 'default',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (player) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-muted)'; }}
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
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    {label}
                    {player?.recentForm != null && (
                      <span style={{ marginLeft: 6, color: player.recentForm > 0 ? 'var(--color-success)' : player.recentForm < 0 ? 'var(--color-danger)' : 'var(--text-muted)', fontWeight: 700 }}>
                        {player.recentForm > 0 ? `↑ +${player.recentForm}` : player.recentForm < 0 ? `↓ ${player.recentForm}` : '→ 0'} form
                      </span>
                    )}
                  </p>
                </div>
                <span style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: 'var(--font-size-sm)', whiteSpace: 'nowrap' }}>
                  {stat}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Finance Log */}
      {financeLog && financeLog.length > 0 && (
        <div className="card mb-6">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <DollarSign size={16} style={{ color: 'var(--color-primary)' }} />
              Recent Transactions
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Last {Math.min(financeLog.length, 6)} entries</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {financeLog.slice(0, 6).map((entry, i) => {
              const isPositive = entry.amount >= 0;
              const typeIcon = {
                match_day_revenue: '🎟️',
                passive_income: '🛍️',
                facility_upgrade: '🏗️',
                player_signed: '✍️',
                interest_penalty: '📉',
              }[entry.type] || '💰';
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-muted)',
                }}>
                  <span style={{ fontSize: '1rem', lineHeight: 1 }}>{typeIcon}</span>
                  <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {entry.description}
                  </span>
                  <span style={{ fontWeight: 800, fontSize: 'var(--font-size-sm)', color: isPositive ? 'var(--color-success)' : 'var(--color-danger)', whiteSpace: 'nowrap' }}>
                    {isPositive ? '+' : ''}${entry.amount}k
                  </span>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: 44, textAlign: 'right' }}>
                    ${entry.balanceAfter}k
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* League News + Squad News */}
      <div className="grid-2 mb-6">
        {/* League news */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Zap size={16} style={{ color: 'var(--color-primary)' }} />
              League News
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {(() => {
              const leagues = state.leagues || [];
              const news = [];
              for (const lg of leagues.slice(0, 3)) {
                const standings = (lg.standings || []).slice().sort((a, b) => b.wins - a.wins || a.losses - b.losses);
                const leader = standings[0];
                // Latest played match date for this league
                const lastPlayedTs = (lg.schedule || [])
                  .filter(m => m.played && m.scheduledDate)
                  .sort((a, b) => b.scheduledDate - a.scheduledDate)[0]?.scheduledDate ?? null;
                if (leader && (leader.wins + leader.losses) > 0) {
                  const gp = leader.wins + leader.losses;
                  const pct = ((leader.wins / gp) * 100).toFixed(0);
                  news.push({ icon: '🏆', title: `${leader.teamName} lead ${lg.name || lg.id}`, body: `${leader.wins}W-${leader.losses}L (${pct}%) through ${gp} game${gp !== 1 ? 's' : ''}.`, time: timeAgo(lastPlayedTs) });
                }
                if (standings.length >= 2 && leader) {
                  const second = standings[1];
                  const gb = ((leader.wins - second.wins + second.losses - leader.losses) / 2).toFixed(1);
                  if (Number(gb) <= 3 && Number(gb) > 0) {
                    news.push({ icon: '📊', title: `Tight race in ${lg.name || lg.id}`, body: `${second.teamName} trails by just ${gb} game${gb !== '1.0' ? 's' : ''}.`, time: timeAgo(lastPlayedTs) });
                  }
                }
                const playedMatches = (lg.schedule || []).filter(m => m.played);
                if (playedMatches.length > 0) {
                  news.push({ icon: '⚡', title: `${playedMatches.length} match${playedMatches.length !== 1 ? 'es' : ''} played in ${lg.name || lg.id}`, body: `${standings.length} teams competing this season.`, time: timeAgo(lastPlayedTs) });
                }
              }
              if (news.length === 0) {
                news.push({ icon: '📅', title: 'Season about to begin', body: 'No results yet. First matchday will reveal the opening standings.' });
                news.push({ icon: '🏀', title: 'Prepare your squad', body: 'Review tactics, training, and lineup before the season opener.' });
              }
              return news.slice(0, 4).map((item, i) => <NewsItem key={i} icon={item.icon} title={item.title} body={item.body} time={item.time} />);
            })()}
          </div>
        </div>

        {/* Squad News — training, fans, media, squad health */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Newspaper size={16} style={{ color: 'var(--color-primary)' }} />
              Squad News
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {/* Media: last match */}
            {recentMatches[0] && (() => {
              const m = recentMatches[0];
              const won = m.result === 'W' || (m.teamScore ?? m.userScore ?? 0) > (m.oppScore ?? m.opponentScore ?? 0);
              const oppName = m.opponent || m.opponentName || 'opponent';
              const score = `${m.teamScore ?? m.userScore ?? '?'}–${m.oppScore ?? m.opponentScore ?? '?'}`;
              const matchAgo = timeAgo(m.matchDate || m.date);
              const perfName = lastGameTopPerformers?.topScorer?.name || topScorer?.name;
              const perfPts  = lastGameTopPerformers?.topScorer?.pts != null
                ? `${lastGameTopPerformers.topScorer.pts} PTS`
                : (topScorer ? `${getPlayerStats(topScorer).pts} PPG` : null);
              return <NewsItem icon={won ? '📣' : '📰'} title={`Media: ${won ? 'Win' : 'Loss'} vs ${oppName} (${score})`} body={perfName && perfPts ? `${perfName} led with ${perfPts}.` : `The team ${won ? 'picked up an important victory' : 'suffered a setback'}.`} time={matchAgo} />;
            })()}

            {/* Training highlights */}
            {(userTeam.trainingHighlights ?? []).slice(0, 1).map((h, i) => (
              <NewsItem key={`tr-${i}`} icon="🏋️" title="Training News" body={h} time={timeAgo(userTeam.lastTrainingApplied)} />
            ))}
            {(userTeam.trainingHighlights ?? []).length === 0 && (
              <NewsItem icon="🏋️" title="Training News" body="Regular training sessions underway. Set a training plan to see highlights here." />
            )}

            {/* Fan news */}
            {(() => {
              const lastGrowth = userTeam.lastWeekFanGrowth;
              const fc = userTeam.fanCount ?? 0;
              const fanDate = timeAgo(userTeam.lastFanGrowthDate || 0);
              const milestones = [500, 1000, 2500, 5000, 10000, 25000];
              const hit = milestones.find(m => fc >= m && fc < m * 1.05);
              if (hit) return <NewsItem icon="🎉" title={`Fans: ${hit.toLocaleString()} supporters milestone!`} body="The city is buzzing — your fanbase keeps growing!" time={fanDate} />;
              if (lastGrowth?.growth > 0) return <NewsItem icon="📈" title={`Fans: +${lastGrowth.growth} new supporters this week`} body={`${lastGrowth.recentWins}W-${lastGrowth.recentLosses}L form brings new fans to the club.`} time={fanDate} />;
              return <NewsItem icon="👥" title="Fans: Building the fanbase" body={`${fc.toLocaleString()} supporters follow the club. Win games to attract more.`} />;
            })()}

            {/* Squad health */}
            {injured.length > 0
              ? <NewsItem icon="🚑" title={`Injuries: ${injured.map(p => p.name).join(', ')}`} body={`${injured.length} player${injured.length !== 1 ? 's' : ''} sidelined. Check Tactics to adjust your lineup.`} time="Today" />
              : highForm.length > 0
                ? <NewsItem icon="⭐" title={`Form: ${highForm[0].name} on fire`} body={`Form rating ${highForm[0].lastFormRating}/100 — keep giving him minutes.`} time="Today" />
                : <NewsItem icon="✅" title="Squad: Full squad available" body="No injuries. Everyone is ready for the next fixture." time="Today" />
            }
          </div>
        </div>
      </div>

      {/* Fan history modal */}
      {showFanHistory && (
        <div className="modal-overlay" onClick={() => setShowFanHistory(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={16} style={{ color: 'var(--color-primary)' }} />
                  Fan Growth History
                </h3>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                  Weekly fan count since registration · Current: {(fanCount ?? 0).toLocaleString()} fans
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowFanHistory(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              {(!fanWeeklyHistory || fanWeeklyHistory.length === 0) ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>📅</div>
                  <div style={{ fontWeight: 600 }}>No weekly data yet</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', marginTop: 4 }}>Fan growth is recorded every Sunday. Check back after the first week!</div>
                </div>
              ) : (
                <>
                  {/* Mini chart: bar graph of last 10 weeks */}
                  {fanWeeklyHistory.length >= 2 && (() => {
                    const recent = [...fanWeeklyHistory].slice(0, 10).reverse();
                    const maxGrowth = Math.max(...recent.map(w => w.growth), 1);
                    return (
                      <div style={{ marginBottom: 20, padding: '12px 16px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-lg)' }}>
                        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                          Growth trend (last {recent.length} weeks)
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 52 }}>
                          {recent.map((w, i) => (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                              <div style={{
                                width: '100%', borderRadius: 3,
                                background: w.growth > 0 ? 'var(--color-primary)' : 'var(--color-danger)',
                                height: `${Math.max(4, (w.growth / maxGrowth) * 44)}px`,
                                opacity: i === recent.length - 1 ? 1 : 0.6 + (i / recent.length) * 0.4,
                              }} />
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Week {recent[0]?.week}</span>
                          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Week {recent[recent.length - 1]?.week}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Week-by-week table */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {fanWeeklyHistory.map((entry, i) => {
                      const date = new Date(entry.date);
                      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      const isPositive = entry.growth > 0;
                      return (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                          padding: 'var(--space-2) var(--space-3)',
                          borderRadius: 'var(--radius-md)',
                          background: i === 0 ? 'var(--color-primary-100)' : 'var(--bg-muted)',
                          border: i === 0 ? '1px solid var(--color-primary)' : 'none',
                        }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 'var(--radius-full)',
                            background: isPositive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                            fontWeight: 800, fontSize: 'var(--font-size-xs)',
                            color: isPositive ? 'var(--color-success)' : 'var(--color-danger)',
                          }}>
                            W{entry.week}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                              {isPositive ? `+${entry.growth}` : entry.growth} new fans
                            </div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                              {dateStr} · {entry.recentWins}W-{entry.recentLosses}L form
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontWeight: 900, fontSize: 'var(--font-size-base)', color: 'var(--color-primary)' }}>
                              {(entry.total ?? 0).toLocaleString()}
                            </div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>total</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Match detail modal (triggered by clicking recent results) */}
      {selectedMatch && (
        <MatchDetailModal
          match={selectedMatch}
          allTeams={state.allTeams}
          userTeamId={userTeam.id}
          onClose={() => setSelectedMatch(null)}
        />
      )}

      {/* Player detail drawer (triggered by clicking top performers) */}
      {selectedPlayer && (
        <div className="modal-overlay" onClick={() => setSelectedPlayer(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div>
                <h3 className="card-title">{selectedPlayer.name}</h3>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  {selectedPlayer.position} · Age {selectedPlayer.age ?? '?'} · {selectedPlayer.nationality ?? ''}
                  {selectedPlayer.recentForm != null && (
                    <span style={{ marginLeft: 8, fontWeight: 700, color: selectedPlayer.recentForm > 0 ? 'var(--color-success)' : selectedPlayer.recentForm < 0 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                      Form: {selectedPlayer.recentForm > 0 ? `+${selectedPlayer.recentForm}` : selectedPlayer.recentForm}
                    </span>
                  )}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedPlayer(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              {/* Season averages */}
              {selectedPlayer.seasonStats && (() => {
                const ss = selectedPlayer.seasonStats;
                const gp = ss.gamesPlayed || 1;
                const stats = [
                  { key: 'points', label: 'PTS', val: (ss.points / gp).toFixed(1) },
                  { key: 'rebounds', label: 'REB', val: (ss.rebounds / gp).toFixed(1) },
                  { key: 'assists', label: 'AST', val: (ss.assists / gp).toFixed(1) },
                  { key: 'steals', label: 'STL', val: (ss.steals / gp).toFixed(1) },
                  { key: 'blocks', label: 'BLK', val: (ss.blocks / gp).toFixed(1) },
                  { key: 'turnovers', label: 'TO', val: (ss.turnovers / gp).toFixed(1) },
                ];
                const fgPct = ss.fgAttempts > 0 ? ((ss.fgMade / ss.fgAttempts) * 100).toFixed(1) + '%' : '—';
                return (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)' }}>Season Averages</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{gp} game{gp !== 1 ? 's' : ''} · FG {fgPct}</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {stats.map(({ key, label, val }) => (
                        <div key={key} style={{ textAlign: 'center', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)', padding: '10px 4px' }}>
                          <div style={{ fontWeight: 800, fontSize: 'var(--font-size-lg)', color: 'var(--color-primary)' }}>{val}</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    {/* Last game highlight if available */}
                    {selectedPlayer.lastGameStats && (() => {
                      const lg = selectedPlayer.lastGameStats;
                      return (
                        <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--color-primary-100)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-primary)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)' }}>Last Game</span>
                          {Object.entries(lg).map(([k, v]) => (
                            <span key={k} style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                              <strong style={{ color: 'var(--text-primary)' }}>{v}</strong> {k.toUpperCase()}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                    {/* Status row */}
                    <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'var(--bg-muted)', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
                        Fatigue {selectedPlayer.fatigue ?? 0}%
                      </span>
                      {selectedPlayer.injuryStatus && selectedPlayer.injuryStatus !== 'healthy' && (
                        <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'rgba(239,68,68,0.1)', fontSize: 'var(--font-size-xs)', color: '#ef4444', fontWeight: 700 }}>
                          ⚠ {selectedPlayer.injuryStatus}
                        </span>
                      )}
                      {selectedPlayer.isCaptain && (
                        <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'rgba(249,115,22,0.1)', fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 700 }}>C Captain</span>
                      )}
                    </div>
                  </div>
                );
              })()}
              {!selectedPlayer.seasonStats && (
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', textAlign: 'center', padding: 'var(--space-4)' }}>No season stats available yet</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
