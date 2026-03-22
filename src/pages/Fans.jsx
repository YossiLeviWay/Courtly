import { useState } from 'react';
import { useGame } from '../context/GameContext.jsx';
import GaugeBar from '../components/ui/GaugeBar.jsx';
import {
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Heart,
  AlertCircle,
  Star,
  Zap,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────

function formatMoney(n) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n}`;
}

function EnthusiasmGauge({ value }) {
  const pct = Math.min(100, Math.max(0, value));
  const color =
    pct >= 70
      ? 'var(--color-success)'
      : pct >= 40
      ? 'var(--color-warning)'
      : 'var(--color-danger)';
  const label =
    pct >= 80
      ? 'Fanatic'
      : pct >= 60
      ? 'Enthusiastic'
      : pct >= 40
      ? 'Engaged'
      : pct >= 20
      ? 'Passive'
      : 'Disengaged';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-6)',
        background: 'var(--bg-muted)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      {/* Big circular gauge */}
      <div style={{ position: 'relative', width: 140, height: 140 }}>
        <svg width="140" height="140" viewBox="0 0 140 140">
          {/* Background arc */}
          <circle
            cx="70"
            cy="70"
            r="56"
            fill="none"
            stroke="var(--border-color)"
            strokeWidth="12"
            strokeDasharray="264 88"
            strokeDashoffset="-44"
            strokeLinecap="round"
            transform="rotate(-90 70 70)"
            style={{ transform: 'rotate(125deg)', transformOrigin: '70px 70px' }}
          />
          {/* Fill arc */}
          <circle
            cx="70"
            cy="70"
            r="56"
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeDasharray={`${(pct / 100) * 264} ${264 - (pct / 100) * 264 + 88}`}
            strokeLinecap="round"
            style={{
              transform: 'rotate(125deg)',
              transformOrigin: '70px 70px',
              transition: 'stroke-dasharray 0.6s ease',
            }}
          />
          {/* Center text */}
          <text
            x="70"
            y="66"
            textAnchor="middle"
            fontSize="28"
            fontWeight="900"
            fill={color}
            fontFamily="var(--font-family)"
          >
            {Math.round(pct)}
          </text>
          <text
            x="70"
            y="84"
            textAnchor="middle"
            fontSize="11"
            fill="var(--text-muted)"
            fontFamily="var(--font-family)"
          >
            / 100
          </text>
        </svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: 'var(--font-size-lg)', color }}>
          {label}
        </div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
          Fan Enthusiasm Level
        </div>
      </div>
    </div>
  );
}

function FactorCard({ icon, title, items, positive }) {
  return (
    <div
      className="card"
      style={{
        borderLeft: `3px solid ${positive ? 'var(--color-success)' : 'var(--color-danger)'}`,
      }}
    >
      <div className="card-header">
        <span
          className="card-title"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            color: positive ? 'var(--color-success)' : 'var(--color-danger)',
          }}
        >
          {icon}
          {title}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-3)',
              background: positive ? 'var(--color-success-light)' : 'var(--color-danger-light)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            {positive ? (
              <ArrowUp size={12} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
            ) : (
              <ArrowDown size={12} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
            )}
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {item}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewsItem({ icon, headline, body }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) 0',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      <span style={{ fontSize: '1.2rem', lineHeight: 1, marginTop: 2, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 2 }}>
          {headline}
        </p>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{body}</p>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────

export default function Fans() {
  const { state, dispatch, addNotification } = useGame();
  const { userTeam } = state;

  const fanCount = userTeam?.fanCount ?? 250;
  const fanEnthusiasm = userTeam?.fanEnthusiasm ?? 20;
  const matchHistory = userTeam?.matchHistory ?? [];

  const [ticketPrice, setTicketPrice] = useState(userTeam?.ticketPrice ?? 20);
  const [seasonTicketSeats, setSeasonTicketSeats] = useState(userTeam?.seasonTicketSeats ?? 0);
  const [seasonTicketPrice, setSeasonTicketPrice] = useState(userTeam?.seasonTicketPrice ?? 15);

  if (!userTeam) {
    return (
      <div className="page-content animate-fade-in">
        <div className="empty-state">
          <div className="empty-state-icon">👥</div>
          <div className="empty-state-title">No team data found</div>
          <div className="empty-state-desc">Start a new game to manage your fans.</div>
        </div>
      </div>
    );
  }

  // Arena capacity from Basketball Hall level
  const basketballHallLevel = userTeam?.facilities?.basketballHall?.level ?? 0;
  const arenaCapacity = 600 + basketballHallLevel * 200;
  const HOME_GAMES_PER_SEASON = 9;
  const seasonTicketRevenue = seasonTicketSeats * seasonTicketPrice * HOME_GAMES_PER_SEASON;
  const regularSeats = arenaCapacity - seasonTicketSeats;

  // Computed values
  const estimatedRevenuePerGame = Math.round(Math.min(regularSeats, fanCount) * ticketPrice * 0.3);
  const enthusiasmPct = Math.min(100, Math.max(0, fanEnthusiasm));
  const weeklyNewFans = Math.round((enthusiasmPct / 100) * 50 + (enthusiasmPct > 50 ? 20 : 0));

  // Fan growth trend (based on recent match results)
  const recentMatches = [...matchHistory].reverse().slice(0, 5);
  const recentWins = recentMatches.filter(m => m.userScore > m.opponentScore).length;
  const trendUp = recentWins >= 3;
  const trendNeutral = recentWins === 2 || recentWins === 1;

  // Generate news items based on team state
  const players = userTeam.players ?? [];
  const statPlayers = players.filter(p => p?.seasonStats);
  const topScorer = [...statPlayers].sort(
    (a, b) =>
      (b.seasonStats.points ?? 0) / (b.seasonStats.gamesPlayed || 1) -
      (a.seasonStats.points ?? 0) / (a.seasonStats.gamesPlayed || 1)
  )[0];
  const mostFatigued = [...players].sort((a, b) => (b.fatigue || 0) - (a.fatigue || 0))[0];
  const injured = players.filter(p => p.injuryStatus !== 'healthy');

  const newsItems = [];

  if (topScorer) {
    newsItems.push({
      icon: '⭐',
      headline: `Fans adore ${topScorer.name}`,
      body: `${topScorer.name} leads the team in scoring and is the crowd favourite at every home game.`,
    });
  }

  if (recentWins >= 3) {
    newsItems.push({
      icon: '🔥',
      headline: 'Winning streak ignites the fanbase',
      body: `${recentWins} wins in the last 5 matches have sent fan enthusiasm soaring this week.`,
    });
  } else if (recentWins <= 1 && recentMatches.length >= 3) {
    newsItems.push({
      icon: '😔',
      headline: 'Fans frustrated after poor run of results',
      body: 'Only ' + recentWins + ' win in the last ' + recentMatches.length + ' matches has left supporters disappointed.',
    });
  }

  if (ticketPrice > 100) {
    newsItems.push({
      icon: '💸',
      headline: 'High ticket prices drawing criticism',
      body: 'Fan forums are buzzing about the cost of attending home games — some supporters are choosing to stay home.',
    });
  } else if (ticketPrice <= 20) {
    newsItems.push({
      icon: '🎟️',
      headline: 'Affordable tickets boosting attendance',
      body: 'Budget-friendly pricing is drawing new fans through the turnstiles each matchday.',
    });
  }

  if (injured.length > 0) {
    newsItems.push({
      icon: '🩹',
      headline: `Fans concerned about ${injured[0].name}'s injury`,
      body: `The ${injured[0].injuryStatus} injury to ${injured[0].name} has supporters hoping for a swift recovery.`,
    });
  }

  if (newsItems.length < 3) {
    newsItems.push({
      icon: '📣',
      headline: 'Supporters planning away day trip',
      body: 'A dedicated group of fans is organising travel to the next away fixture. Community spirit is building.',
    });
  }

  function handleSavePrices() {
    if (!userTeam) return;
    dispatch({
      type: 'UPDATE_TEAM',
      payload: { ...userTeam, ticketPrice, seasonTicketSeats, seasonTicketPrice },
    });
    addNotification('Prices updated successfully!', 'success');
  }

  return (
    <div className="page-content animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
          }}
        >
          <div>
            <h1>Fans</h1>
            <p>Manage fan relations, pricing, and supporter growth</p>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-4)',
              background: 'var(--color-primary-100)',
              borderRadius: 'var(--radius-full)',
            }}
          >
            <Heart size={15} style={{ color: 'var(--color-primary)' }} />
            <span
              style={{
                fontWeight: 700,
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-primary)',
              }}
            >
              {fanCount.toLocaleString()} supporters
            </span>
          </div>
        </div>
      </div>

      {/* ── Section 1: Fan Metrics ── */}
      <div className="grid-2 mb-6">
        {/* Enthusiasm Gauge */}
        <div className="card">
          <div className="card-header">
            <span
              className="card-title"
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
            >
              <Heart size={16} style={{ color: 'var(--color-primary)' }} />
              Fan Enthusiasm
            </span>
          </div>
          <EnthusiasmGauge value={fanEnthusiasm} />
        </div>

        {/* Fan Stats */}
        <div className="card">
          <div className="card-header">
            <span
              className="card-title"
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
            >
              <Users size={16} style={{ color: 'var(--color-primary)' }} />
              Fan Metrics
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Total fans */}
            <div
              style={{
                padding: 'var(--space-4)',
                background: 'var(--bg-muted)',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 'var(--font-size-4xl)',
                  fontWeight: 900,
                  color: 'var(--color-primary)',
                  lineHeight: 1,
                }}
              >
                {fanCount.toLocaleString()}
              </div>
              <div
                style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--text-muted)',
                  marginTop: 'var(--space-1)',
                }}
              >
                Total Fan Count
              </div>
            </div>

            {/* Weekly new fans */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-3)',
                background: 'var(--color-success-light)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Est. New Fans / Week
                </div>
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: 'var(--font-size-2xl)',
                    color: 'var(--color-success)',
                  }}
                >
                  +{weeklyNewFans}
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'var(--color-success)',
                  borderRadius: 'var(--radius-full)',
                  color: 'white',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 700,
                }}
              >
                {trendUp ? (
                  <>
                    <TrendingUp size={12} />
                    Growing
                  </>
                ) : trendNeutral ? (
                  <>
                    <Zap size={12} />
                    Steady
                  </>
                ) : (
                  <>
                    <TrendingDown size={12} />
                    Declining
                  </>
                )}
              </div>
            </div>

            {/* Enthusiasm gauge bar */}
            <div>
              <GaugeBar label="Fan Enthusiasm" value={fanEnthusiasm} type="fan" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Financial Controls ── */}
      <div className="card mb-6">
        <div className="card-header">
          <span
            className="card-title"
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
          >
            <DollarSign size={16} style={{ color: 'var(--color-primary)' }} />
            Financial Controls
          </span>
          <button className="btn btn-sm btn-primary" onClick={handleSavePrices}>
            Save Prices
          </button>
        </div>

        <div className="grid-2" style={{ gap: 'var(--space-6)' }}>
          {/* Ticket price */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-3)',
              }}
            >
              <label
                style={{
                  fontWeight: 700,
                  fontSize: 'var(--font-size-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                🎟️ Ticket Price
              </label>
              <span
                style={{
                  fontWeight: 900,
                  fontSize: 'var(--font-size-xl)',
                  color: 'var(--color-primary)',
                }}
              >
                ${ticketPrice}
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={200}
              step={5}
              value={ticketPrice}
              onChange={e => setTicketPrice(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--color-primary)' }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 'var(--space-1)',
              }}
            >
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                $5 (budget)
              </span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                $200 (premium)
              </span>
            </div>
            <div
              style={{
                marginTop: 'var(--space-3)',
                padding: 'var(--space-2) var(--space-3)',
                background:
                  ticketPrice > 100
                    ? 'var(--color-warning-light)'
                    : 'var(--color-success-light)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-xs)',
                color:
                  ticketPrice > 100 ? 'var(--color-warning)' : 'var(--color-success)',
                fontWeight: 600,
              }}
            >
              {ticketPrice > 100
                ? 'High prices may reduce fan enthusiasm'
                : ticketPrice <= 20
                ? 'Budget pricing attracts new fans'
                : 'Balanced pricing maintains fan satisfaction'}
            </div>
          </div>

        </div>

        {/* Revenue estimate */}
        <div
          style={{
            marginTop: 'var(--space-5)',
            padding: 'var(--space-4)',
            background: 'linear-gradient(135deg, var(--color-primary-100), var(--bg-card))',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-primary-200)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--text-muted)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 'var(--space-1)',
              }}
            >
              Estimated Gate Revenue per Game
            </div>
            <div
              style={{
                fontSize: 'var(--font-size-3xl)',
                fontWeight: 900,
                color: 'var(--color-primary)',
              }}
            >
              {formatMoney(estimatedRevenuePerGame)}
            </div>
          </div>
          <div
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              maxWidth: 220,
            }}
          >
            {fanCount.toLocaleString()} fans × ${ticketPrice} ticket × 30% gate share
          </div>
        </div>
      </div>

      {/* ── Section 2b: Season Tickets ── */}
      <div className="card mb-6">
        <div className="card-header">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            🎫 Season Tickets
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              Arena: {arenaCapacity.toLocaleString()} seats
            </span>
          </div>
        </div>

        <div className="grid-2" style={{ gap: 'var(--space-6)' }}>
          {/* Season ticket allocation */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <label style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                Seats Allocated
              </label>
              <span style={{ fontWeight: 900, fontSize: 'var(--font-size-xl)', color: 'var(--color-primary)' }}>
                {seasonTicketSeats.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.floor(arenaCapacity * 0.8)}
              step={10}
              value={seasonTicketSeats}
              onChange={e => setSeasonTicketSeats(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--color-primary)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-1)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>0 seats</span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                {Math.floor(arenaCapacity * 0.8).toLocaleString()} max (80%)
              </span>
            </div>
            <div style={{
              marginTop: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)',
              background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', fontWeight: 600,
            }}>
              {regularSeats.toLocaleString()} regular seats remaining for game-day sales
            </div>
          </div>

          {/* Season ticket price */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <label style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                Price per Game
              </label>
              <span style={{ fontWeight: 900, fontSize: 'var(--font-size-xl)', color: 'var(--color-primary)' }}>
                ${seasonTicketPrice}
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={150}
              step={5}
              value={seasonTicketPrice}
              onChange={e => setSeasonTicketPrice(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--color-primary)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-1)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>$5</span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>$150</span>
            </div>
            <div style={{
              marginTop: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)',
              background: 'var(--color-success-light)', borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-xs)', color: 'var(--color-success)', fontWeight: 600,
            }}>
              Season revenue: {formatMoney(seasonTicketRevenue)} ({HOME_GAMES_PER_SEASON} home games)
            </div>
          </div>
        </div>

        {/* Season ticket summary */}
        <div style={{
          marginTop: 'var(--space-5)', padding: 'var(--space-4)',
          background: 'linear-gradient(135deg, rgba(46,125,50,0.08), var(--bg-card))',
          borderRadius: 'var(--radius-md)', border: '1px solid var(--color-success-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)',
        }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 'var(--space-1)' }}>
              Guaranteed Season Revenue
            </div>
            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 900, color: 'var(--color-success)' }}>
              {formatMoney(seasonTicketRevenue)}
            </div>
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 240 }}>
            {seasonTicketSeats.toLocaleString()} seats × ${seasonTicketPrice}/game × {HOME_GAMES_PER_SEASON} home games. Collected at season start — guaranteed income regardless of attendance.
          </div>
        </div>
      </div>

      {/* ── Section 3: Enthusiasm Factors ── */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <h2
          style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 800,
            marginBottom: 'var(--space-5)',
          }}
        >
          Enthusiasm Factors
        </h2>
      </div>
      <div className="grid-2 mb-6">
        <FactorCard
          positive
          icon={<TrendingUp size={15} />}
          title="Boosts Enthusiasm"
          items={[
            'Winning matches (+5 per win)',
            'Upgraded Media Center facility',
            'High-rated star players',
            'Affordable ticket prices',
            'Large home crowd attendance',
          ]}
        />
        <FactorCard
          positive={false}
          icon={<TrendingDown size={15} />}
          title="Reduces Enthusiasm"
          items={[
            'Losing matches (-4 per loss)',
            'High ticket or merch prices',
            'Player injuries (key stars)',
            'Negative press events',
            'Poor home attendance',
          ]}
        />
      </div>

      {/* ── Section 4: Weekly Fan News ── */}
      <div className="card mb-6">
        <div className="card-header">
          <span
            className="card-title"
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
          >
            <Star size={16} style={{ color: 'var(--color-primary)' }} />
            Weekly Fan News
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {newsItems.slice(0, 4).map((item, i) => (
            <NewsItem key={i} icon={item.icon} headline={item.headline} body={item.body} />
          ))}
          {newsItems.length === 0 && (
            <p
              style={{
                textAlign: 'center',
                padding: 'var(--space-6) 0',
                color: 'var(--text-muted)',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              Play some matches to generate fan news.
            </p>
          )}
        </div>
      </div>

      {/* ── Fan growth info panel ── */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, var(--color-primary-100) 0%, var(--bg-card) 100%)',
          border: '1px solid var(--color-primary-200)',
        }}
      >
        <div className="card-header">
          <span
            className="card-title"
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
          >
            <AlertCircle size={16} style={{ color: 'var(--color-primary)' }} />
            Fan Growth Guide
          </span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 'var(--space-3)',
          }}
        >
          {[
            { icon: '🏀', tip: 'Win consistently to boost enthusiasm above 60 for rapid fan growth' },
            { icon: '📺', tip: 'Upgrade the Media Center to passively increase weekly fan additions' },
            { icon: '🏟️', tip: 'Upgrade Basketball Hall to hold larger crowds and earn more gate revenue' },
            { icon: '🎟️', tip: 'Keep ticket prices below $50 for the best balance of revenue and growth' },
          ].map(({ icon, tip }) => (
            <div
              key={tip}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-2)',
                padding: 'var(--space-3)',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-card)',
              }}
            >
              <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{icon}</span>
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                {tip}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
