import { useState } from 'react';
import { useGame } from '../context/GameContext.jsx';
import { TrendingUp, TrendingDown, DollarSign, BarChart2, Users, Building2 } from 'lucide-react';

// ── Salary Helpers ─────────────────────────────────────────────

function calcPlayerOvr(player) {
  const attrs = player.attributes || {};
  const vals = Object.values(attrs);
  if (vals.length === 0) return player.overallRating || 50;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export function calcPlayerMonthlyWage(player) {
  return 1000 + calcPlayerOvr(player) * 50;
}

export function calcStaffMonthlyWage(staff) {
  const abilities = staff.abilities || {};
  const vals = Object.values(abilities);
  const avg = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 50;
  return 500 + avg * 100;
}

// ── Format helpers ─────────────────────────────────────────────

function fmt(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtSigned(n) {
  const s = fmt(Math.abs(n));
  return n >= 0 ? `+${s}` : `-${s}`;
}

// ── Row components ─────────────────────────────────────────────

function RevenueRow({ label, monthly, highlight }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: 'var(--space-2) var(--space-3)',
      background: highlight ? 'var(--color-success-light)' : 'transparent',
      borderRadius: 'var(--radius-sm)',
    }}>
      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 700, color: 'var(--color-success)', fontSize: 'var(--font-size-sm)' }}>
        {fmt(monthly)}
      </span>
    </div>
  );
}

function ExpenseRow({ label, monthly, highlight }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: 'var(--space-2) var(--space-3)',
      background: highlight ? 'var(--color-danger-light)' : 'transparent',
      borderRadius: 'var(--radius-sm)',
    }}>
      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 700, color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)' }}>
        -{fmt(monthly)}
      </span>
    </div>
  );
}

function SectionHeader({ label }) {
  return (
    <div style={{
      fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase',
      letterSpacing: 1, color: 'var(--text-muted)', padding: 'var(--space-3) var(--space-3) var(--space-1)',
      marginTop: 'var(--space-2)',
    }}>
      {label}
    </div>
  );
}

function TotalRow({ label, value, positive }) {
  const color = positive === undefined
    ? 'var(--text-primary)'
    : positive ? 'var(--color-success)' : 'var(--color-danger)';
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: 'var(--space-3)',
      borderTop: '2px solid var(--border-color)',
      marginTop: 'var(--space-1)',
    }}>
      <span style={{ fontWeight: 800, fontSize: 'var(--font-size-base)' }}>{label}</span>
      <span style={{ fontWeight: 900, fontSize: 'var(--font-size-lg)', color }}>{fmt(value)}</span>
    </div>
  );
}

function AssetRow({ label, value, sub }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: 'var(--space-2) var(--space-3)',
    }}>
      <div>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{label}</span>
        {sub && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{sub}</div>}
      </div>
      <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>{fmt(value)}</span>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────

export default function FinancialReport() {
  const { state } = useGame();
  const team = state.userTeam;
  const [period, setPeriod] = useState('monthly');

  if (!team) {
    return (
      <div className="page-content animate-fade-in">
        <div className="empty-state">
          <div className="empty-state-icon"><DollarSign size={40} /></div>
          <div className="empty-state-title">No team data</div>
          <div className="empty-state-desc">Start a game to view financial reports.</div>
        </div>
      </div>
    );
  }

  const players = team.players || [];
  const staff = Object.values(team.staff || {});
  const facilities = team.facilities || {};

  // ── Revenue ────────────────────────────────────────────────

  // Gate revenue (regular seats) — monthly estimate (4 home games/month)
  const HOME_GAMES_MONTH = 4;
  const basketballHallLevel = facilities.basketballHall?.level ?? 0;
  const arenaCapacity = 600 + basketballHallLevel * 200;
  const seasonTicketSeats = team.seasonTicketSeats ?? 0;
  const seasonTicketPrice = team.seasonTicketPrice ?? 15;
  const ticketPrice = team.ticketPrice ?? 20;
  const fanCount = team.fanCount ?? 250;
  const fanEnthusiasm = team.fanEnthusiasm ?? 20;
  const attendanceRate = 0.2 + (fanEnthusiasm / 100) * 0.6;
  const regularSeats = arenaCapacity - seasonTicketSeats;
  const monthlyGateRevenue = Math.round(regularSeats * Math.min(attendanceRate, 1) * ticketPrice * HOME_GAMES_MONTH);
  const monthlySeasonTicketRevenue = Math.round(seasonTicketSeats * seasonTicketPrice * HOME_GAMES_MONTH);

  // Merchandise — monthly
  const merchandisePrice = team.merchandisePrice ?? 30;
  const merchandiseLevel = facilities.merchandise?.level ?? 0;
  const monthlyMerchRevenue = Math.round((fanCount * merchandisePrice * 0.01) * (1 + merchandiseLevel * 0.2) * 4);

  // TV revenue by league (monthly)
  const leagueTVRevenue = { A: 50000, B: 20000, C: 5000 };
  const leagueTier = team.league ?? 'C';
  const monthlyTVRevenue = leagueTVRevenue[leagueTier] ?? 5000;

  // Sponsorship — scales with reputation
  const reputation = team.reputation ?? 10;
  const monthlySponsorship = Math.round(reputation * 200 + 500);

  const totalMonthlyRevenue = monthlyGateRevenue + monthlySeasonTicketRevenue + monthlyMerchRevenue + monthlyTVRevenue + monthlySponsorship;

  // ── Expenses ───────────────────────────────────────────────

  // Player wages
  const monthlyPlayerWages = players.reduce((sum, p) => sum + calcPlayerMonthlyWage(p), 0);

  // Staff wages
  const monthlyStaffWages = staff.reduce((sum, s) => sum + calcStaffMonthlyWage(s), 0);

  // Training costs (Training Court + Gym levels)
  const trainingLevel = (facilities.trainingCourt?.level ?? 0) + (facilities.gym?.level ?? 0);
  const monthlyTrainingCosts = trainingLevel * 500 + 200;

  // General operational costs
  const monthlyGeneralOps = 1500;

  const totalMonthlyExpenses = monthlyPlayerWages + monthlyStaffWages + monthlyTrainingCosts + monthlyGeneralOps;

  const netMonthly = totalMonthlyRevenue - totalMonthlyExpenses;

  // ── Seasonal values (x9 months) ───────────────────────────
  const SEASON_MONTHS = 9;
  const mult = period === 'season' ? SEASON_MONTHS : 1;

  // ── Balance Sheet ──────────────────────────────────────────

  const cashReserves = team.budget ?? 250;

  // Facility assets — sum of upgrade costs invested
  const facilityInvestment = Object.entries(facilities).reduce((sum, [, fac]) => {
    let cost = 0;
    for (let lvl = 0; lvl < (fac.level ?? 0); lvl++) {
      cost += Math.round(100 * Math.pow(1.5, lvl));
    }
    return sum + cost;
  }, 0);

  // Squad value — estimated market value per player
  const squadValue = players.reduce((sum, p) => {
    const ovr = calcPlayerOvr(p);
    return sum + (50 + ovr * 5);
  }, 0);

  const totalAssets = cashReserves + facilityInvestment + squadValue;
  const totalLiabilities = 0;
  const equity = totalAssets - totalLiabilities;

  // ── Salary table ───────────────────────────────────────────
  const [salaryTab, setSalaryTab] = useState('players');
  const sortedPlayers = [...players].sort((a, b) => calcPlayerMonthlyWage(b) - calcPlayerMonthlyWage(a));
  const sortedStaff = [...staff].sort((a, b) => calcStaffMonthlyWage(b) - calcStaffMonthlyWage(a));

  return (
    <div className="page-content animate-fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div>
            <h1>Financial Report</h1>
            <p>Income statement, balance sheet, and salary breakdown</p>
          </div>
          <div className="tabs">
            <button className={`tab${period === 'monthly' ? ' active' : ''}`} onClick={() => setPeriod('monthly')}>Monthly</button>
            <button className={`tab${period === 'season' ? ' active' : ''}`} onClick={() => setPeriod('season')}>Season ({SEASON_MONTHS}mo)</button>
          </div>
        </div>
      </div>

      {/* ── Net Profit Banner ── */}
      <div style={{
        padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)',
        background: netMonthly * mult >= 0
          ? 'linear-gradient(135deg, rgba(46,125,50,0.12), var(--bg-card))'
          : 'linear-gradient(135deg, rgba(198,40,40,0.12), var(--bg-card))',
        border: `1px solid ${netMonthly * mult >= 0 ? 'var(--color-success-light)' : 'var(--color-danger-light)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
        gap: 'var(--space-4)', marginBottom: 'var(--space-6)',
      }}>
        <div>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 'var(--space-1)' }}>
            {period === 'monthly' ? 'Monthly' : 'Season'} Net Profit / Loss
          </div>
          <div style={{ fontSize: 'var(--font-size-4xl)', fontWeight: 900, color: netMonthly * mult >= 0 ? 'var(--color-success)' : 'var(--color-danger)', lineHeight: 1 }}>
            {fmtSigned(netMonthly * mult)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>Revenue</div>
            <div style={{ fontWeight: 800, color: 'var(--color-success)' }}>{fmt(totalMonthlyRevenue * mult)}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>Expenses</div>
            <div style={{ fontWeight: 800, color: 'var(--color-danger)' }}>{fmt(totalMonthlyExpenses * mult)}</div>
          </div>
        </div>
      </div>

      <div className="grid-2 mb-6" style={{ alignItems: 'start' }}>
        {/* ── Income Statement ── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <TrendingUp size={16} style={{ color: 'var(--color-success)' }} />
              Income Statement
            </span>
          </div>

          <SectionHeader label="Revenue" />
          <RevenueRow label="Gate Revenue (regular seats)" monthly={monthlyGateRevenue * mult} />
          <RevenueRow label="Season Ticket Revenue" monthly={monthlySeasonTicketRevenue * mult} highlight={seasonTicketSeats > 0} />
          <RevenueRow label="Merchandise Sales" monthly={monthlyMerchRevenue * mult} />
          <RevenueRow label={`TV Revenue (Liga ${leagueTier})`} monthly={monthlyTVRevenue * mult} />
          <RevenueRow label="Sponsorship & Advertising" monthly={monthlySponsorship * mult} />
          <TotalRow label="Total Revenue" value={totalMonthlyRevenue * mult} positive={true} />

          <SectionHeader label="Expenses" />
          <ExpenseRow label={`Player Wages (${players.length} players)`} monthly={monthlyPlayerWages * mult} />
          <ExpenseRow label={`Staff Wages (${staff.length} staff)`} monthly={monthlyStaffWages * mult} />
          <ExpenseRow label="Training Facility Costs" monthly={monthlyTrainingCosts * mult} />
          <ExpenseRow label="General Operations" monthly={monthlyGeneralOps * mult} highlight />
          <TotalRow label="Total Expenses" value={totalMonthlyExpenses * mult} positive={false} />

          <div style={{
            margin: 'var(--space-3) 0 0',
            padding: 'var(--space-3)',
            background: netMonthly >= 0 ? 'var(--color-success-light)' : 'var(--color-danger-light)',
            borderRadius: 'var(--radius-md)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontWeight: 800 }}>Net Profit / Loss</span>
            <span style={{ fontWeight: 900, fontSize: 'var(--font-size-xl)', color: netMonthly >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {fmtSigned(netMonthly * mult)}
            </span>
          </div>
        </div>

        {/* ── Balance Sheet ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <BarChart2 size={16} style={{ color: 'var(--color-primary)' }} />
                Balance Sheet
              </span>
            </div>

            <SectionHeader label="Assets" />
            <AssetRow label="Cash Reserves" value={cashReserves} sub="Current available balance" />
            <AssetRow label="Facility Assets" value={facilityInvestment} sub="Total upgrade investment" />
            <AssetRow label="Squad Assets" value={squadValue} sub={`${players.length} players at market value`} />
            <TotalRow label="Total Assets" value={totalAssets} />

            <SectionHeader label="Liabilities" />
            <AssetRow label="Unpaid Liabilities" value={totalLiabilities} sub="Overdue payments" />
            <TotalRow label="Total Liabilities" value={totalLiabilities} />

            <SectionHeader label="Equity" />
            <AssetRow label="Retained Earnings" value={equity} sub="Cumulative net worth" />
            <TotalRow label="Total Equity" value={equity} positive={equity >= 0} />
          </div>

          {/* Quick stats */}
          <div className="grid-2" style={{ gap: 'var(--space-3)' }}>
            {[
              { icon: <Users size={18} />, label: 'Monthly Payroll', value: fmt(monthlyPlayerWages + monthlyStaffWages), color: 'var(--color-danger)' },
              { icon: <Building2 size={18} />, label: 'Arena Capacity', value: `${arenaCapacity.toLocaleString()} seats`, color: 'var(--color-primary)' },
              { icon: <TrendingUp size={18} />, label: 'Est. Attendance', value: `${Math.round(attendanceRate * 100)}%`, color: 'var(--color-success)' },
              { icon: <DollarSign size={18} />, label: 'Reputation', value: `${reputation}/100`, color: 'var(--color-warning)' },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                <div style={{ color: s.color, display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-1)' }}>{s.icon}</div>
                <div style={{ fontWeight: 900, fontSize: 'var(--font-size-lg)', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Salary Breakdown ── */}
      <div className="card mb-6">
        <div className="card-header">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <DollarSign size={16} style={{ color: 'var(--color-primary)' }} />
            Salary Breakdown
          </span>
          <div className="tabs" style={{ marginBottom: 0 }}>
            <button className={`tab${salaryTab === 'players' ? ' active' : ''}`} onClick={() => setSalaryTab('players')}>
              Players ({players.length})
            </button>
            <button className={`tab${salaryTab === 'staff' ? ' active' : ''}`} onClick={() => setSalaryTab('staff')}>
              Staff ({staff.length})
            </button>
          </div>
        </div>

        {salaryTab === 'players' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              <span>Player</span><span>Pos</span><span>OVR</span><span>Monthly Wage</span>
            </div>
            {sortedPlayers.map(p => {
              const ovr = calcPlayerOvr(p);
              const wage = calcPlayerMonthlyWage(p);
              return (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', borderTop: '1px solid var(--border-color)', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{p.name}</span>
                  <span className="player-position-badge">{p.position}</span>
                  <span className="badge badge-orange" style={{ fontSize: '0.7rem' }}>{ovr}</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)', textAlign: 'right' }}>{fmt(wage)}</span>
                </div>
              );
            })}
            <div style={{ padding: 'var(--space-3)', borderTop: '2px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
              <span>Total Monthly Player Wages</span>
              <span style={{ color: 'var(--color-danger)' }}>{fmt(monthlyPlayerWages)}</span>
            </div>
          </div>
        )}

        {salaryTab === 'staff' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              <span>Staff Member</span><span>Role</span><span>Monthly Wage</span>
            </div>
            {sortedStaff.map(s => {
              const wage = calcStaffMonthlyWage(s);
              return (
                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', borderTop: '1px solid var(--border-color)', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{s.name}</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textAlign: 'right' }}>{s.role}</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)', textAlign: 'right' }}>{fmt(wage)}</span>
                </div>
              );
            })}
            <div style={{ padding: 'var(--space-3)', borderTop: '2px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
              <span>Total Monthly Staff Wages</span>
              <span style={{ color: 'var(--color-danger)' }}>{fmt(monthlyStaffWages)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
