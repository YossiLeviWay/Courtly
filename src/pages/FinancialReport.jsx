import { useState } from 'react';
import { useGame } from '../context/GameContext.jsx';
import { TrendingUp, TrendingDown, DollarSign, BarChart2, Users, Building2 } from 'lucide-react';
import {
  HOME_GAMES_MONTH,
  SEASON_MONTHS,
  THIRTY_DAYS,
  calcPlayerMonthlyWage,
  calcPlayerOvr,
  calcStaffMonthlyWage,
  calculateFinanceProjection,
  getFacilityLevel,
  summarizeFinanceLog,
} from '../engine/financeEngine.js';

export { calcPlayerMonthlyWage, calcStaffMonthlyWage };

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

  const userLeague = state.leagues?.find(lg => lg.teams?.some(t => t.id === team.id));
  const finance = calculateFinanceProjection(team, { leagueTier: userLeague?.tier ?? userLeague?.id?.slice(-1) ?? team.league ?? 'C' });
  const actualLast30 = summarizeFinanceLog(team.financeLog ?? []);
  const {
    mediaCenterLevel,
    merchandiseLevel,
    arenaCapacity,
    ticketPrice,
    seasonTicketSeats,
    awayFanPct,
    fanEnthusiasm,
    leagueTier,
    reputation,
    homeSeatsAvailable,
    actualRegularAttend,
    seasonTicketAttendees,
    awayFanAttendees,
    totalAttendancePerGame,
    seatUtilisation,
    monthlyGateRevenue,
    monthlySeasonTicketRevenue,
    monthlyMerchRevenue,
    monthlyTVRevenue,
    monthlySponsorship,
    totalMonthlyRevenue,
    recurringMonthlyRevenue,
    monthlyPlayerWages,
    monthlyStaffWages,
    monthlyFacMaintenance,
    monthlyGeneralOps,
    totalMonthlyExpenses,
    projectedNetMonthly,
    recurringNetMonthly,
  } = finance;

  const netMonthly = projectedNetMonthly;

  // ── Seasonal values ───────────────────────────────────────
  const mult = period === 'season' ? SEASON_MONTHS : 1;

  // ── Balance Sheet ──────────────────────────────────────────

  const cashReserves = team.budget ?? 250;

  // Facility assets — sum of upgrade costs invested
  const facilityInvestment = Object.entries(facilities).reduce((sum, [, fac]) => {
    let cost = 0;
    for (let lvl = 0; lvl < getFacilityLevel(fac); lvl++) {
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

  // ── Debt season status ─────────────────────────────────────
  const consecutiveDebtSeasons = team.consecutiveDebtSeasons ?? 0;
  const lastMonthlyFinanceTick = team.lastMonthlyFinanceTick ?? 0;
  const nextMonthlyTick = lastMonthlyFinanceTick + THIRTY_DAYS;
  const msUntilTick = nextMonthlyTick - Date.now();
  const daysUntilTick = Math.max(0, Math.ceil(msUntilTick / (24 * 60 * 60 * 1000)));

  // ── Salary table ───────────────────────────────────────────
  const [salaryTab, setSalaryTab] = useState('players');
  const sortedPlayers = [...players].sort((a, b) => (b.salary ?? 5) * 8 - (a.salary ?? 5) * 8);
  const sortedStaff = [...staff].sort((a, b) => (b.salary ?? 100) - (a.salary ?? 100));

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

      <div className="mb-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 'var(--space-4)' }}>
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Actual Last 30 Days
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: actualLast30.net >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {fmtSigned(actualLast30.net)}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {actualLast30.entries.length} posted transaction{actualLast30.entries.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Monthly Tick Net
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: recurringNetMonthly >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {fmtSigned(recurringNetMonthly)}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Recurring income minus monthly expenses
          </div>
        </div>
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Projected Matchday
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-primary)' }}>
            {fmt(monthlyGateRevenue)}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Added when home games are actually played
          </div>
        </div>
      </div>

      {/* ── Consecutive Debt Season Warning ── */}
      {consecutiveDebtSeasons > 0 && (
        <div style={{
          background: consecutiveDebtSeasons >= 2 ? 'rgba(127,0,0,0.12)' : 'rgba(239,68,68,0.08)',
          border: `1.5px solid ${consecutiveDebtSeasons >= 2 ? '#7f0000' : 'rgba(239,68,68,0.40)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-5)',
          marginBottom: 'var(--space-6)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-3)' }}>
            <TrendingDown size={20} color="#ef4444" />
            <span style={{ fontWeight: 800, fontSize: 'var(--font-size-lg)', color: '#ef4444' }}>
              Debt Season Warning — {consecutiveDebtSeasons}/2 Season{consecutiveDebtSeasons > 1 ? 's' : ''} in Debt
            </span>
          </div>
          <div style={{
            display: 'flex', gap: 6, marginBottom: 'var(--space-3)',
          }}>
            {[1, 2].map(n => (
              <div key={n} style={{
                flex: 1, height: 8, borderRadius: 4,
                background: n <= consecutiveDebtSeasons ? '#ef4444' : 'var(--bg-muted)',
                border: '1px solid var(--border-color)',
              }} />
            ))}
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: '#b91c1c', fontWeight: 600, lineHeight: 1.5 }}>
            {consecutiveDebtSeasons === 1
              ? 'You ended last season in debt. If you end this season in debt as well, your team will be fully reset — all players, facilities, and progress lost. Get your finances back in the green before the season ends.'
              : 'DANGER: Two consecutive debt seasons detected. Your team is being reset to its starting state.'}
          </div>
        </div>
      )}

      {/* ── Debt Overview (only shown when budget is negative) ── */}
      {cashReserves < 0 && (() => {
        const debtAmount = Math.abs(cashReserves);
        const weeklyInterest = Math.round(debtAmount * 0.05);
        const projected3Months = Math.round(debtAmount * Math.pow(1.05, 12));
        return (
          <div style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1.5px solid rgba(239,68,68,0.40)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            marginBottom: 'var(--space-6)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-4)' }}>
              <TrendingDown size={20} color="#ef4444" />
              <span style={{ fontWeight: 800, fontSize: 'var(--font-size-lg)', color: '#ef4444' }}>
                ⚠️ Debt Overview
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)', marginBottom: 'var(--space-4)' }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
                  Current Debt
                </div>
                <div style={{ fontWeight: 900, fontSize: 'var(--font-size-2xl)', color: '#ef4444' }}>
                  ${debtAmount.toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
                  Weekly Interest (5%)
                </div>
                <div style={{ fontWeight: 900, fontSize: 'var(--font-size-2xl)', color: '#ef4444' }}>
                  ${weeklyInterest.toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
                  Projected Debt in 3 Months
                </div>
                <div style={{ fontWeight: 900, fontSize: 'var(--font-size-2xl)', color: '#b91c1c' }}>
                  ${projected3Months.toLocaleString()}
                </div>
              </div>
            </div>
            <div style={{
              background: 'rgba(239,68,68,0.10)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-4)',
              fontSize: 'var(--font-size-sm)',
              color: '#b91c1c',
              fontWeight: 600,
              lineHeight: 1.5,
            }}>
              Your team is operating with a negative budget. A 5% weekly interest charge compounds on the outstanding debt. To recover, win more home games for ticket revenue, sell players, and cut staff costs.
            </div>
          </div>
        );
      })()}

      <div className="grid-2 mb-6" style={{ alignItems: 'start' }}>
        {/* ── Income Statement ── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <TrendingUp size={16} style={{ color: 'var(--color-success)' }} />
              Income Statement
            </span>
          </div>

          <SectionHeader label="Matchday Revenue" />
          <RevenueRow label={`Gate Revenue — regular tickets (${HOME_GAMES_MONTH} home games)`} monthly={monthlyGateRevenue * mult} />
          <RevenueRow label={`Season Ticket Revenue (${seasonTicketSeats} holders)`} monthly={monthlySeasonTicketRevenue * mult} highlight={seasonTicketSeats > 0} />
          <SectionHeader label="Passive Revenue" />
          <RevenueRow label={`Merchandise Sales (Store Lv ${merchandiseLevel})`} monthly={monthlyMerchRevenue * mult} />
          <RevenueRow label={`TV Revenue (Liga ${leagueTier}, Media Lv ${mediaCenterLevel})`} monthly={monthlyTVRevenue * mult} />
          <RevenueRow label="Sponsorship & Advertising" monthly={monthlySponsorship * mult} />
          <TotalRow label="Total Revenue" value={totalMonthlyRevenue * mult} positive={true} />
          <div style={{ padding: '0 var(--space-3) var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Monthly tick applies {fmt(recurringMonthlyRevenue * mult)} recurring revenue. Gate revenue is posted when home games are played.
          </div>

          <SectionHeader label="Expenses" />
          <ExpenseRow label={`Player Wages (${players.length} players)`} monthly={monthlyPlayerWages * mult} />
          <ExpenseRow label={`Staff Wages (${staff.length} staff)`} monthly={monthlyStaffWages * mult} />
          <ExpenseRow label="Facility Maintenance" monthly={monthlyFacMaintenance * mult} />
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
              { icon: <TrendingUp size={18} />, label: 'Est. Attendance / Game', value: `${totalAttendancePerGame.toLocaleString()} (${seatUtilisation}%)`, color: 'var(--color-success)' },
              { icon: <DollarSign size={18} />, label: 'Reputation', value: `${reputation}/100`, color: 'var(--color-warning)' },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                <div style={{ color: s.color, display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-1)' }}>{s.icon}</div>
                <div style={{ fontWeight: 900, fontSize: 'var(--font-size-lg)', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Attendance breakdown card */}
          <div className="card" style={{ padding: 'var(--space-4)' }}>
            <div style={{ fontWeight: 800, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
              🏟️ Attendance Breakdown <span style={{ fontWeight: 400, fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>per home game</span>
            </div>
            {[
              { label: 'Regular home fans', value: actualRegularAttend, color: 'var(--color-primary)', note: `of ${homeSeatsAvailable} available seats` },
              { label: 'Season ticket holders', value: seasonTicketAttendees, color: 'var(--color-success)', note: `${seasonTicketSeats} holders × 85%` },
              { label: 'Away fans', value: awayFanAttendees, color: 'var(--color-warning)', note: `${awayFanPct}% away allocation × 70%` },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: row.color }}>{row.label}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{row.note}</div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 'var(--font-size-sm)', color: row.color }}>{row.value.toLocaleString()}</div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, fontWeight: 800 }}>
              <span style={{ fontSize: 'var(--font-size-sm)' }}>Total Attendance</span>
              <span style={{ color: 'var(--color-primary)', fontSize: 'var(--font-size-base)' }}>{totalAttendancePerGame.toLocaleString()} / {arenaCapacity.toLocaleString()}</span>
            </div>
            <div style={{ marginTop: 8, background: 'var(--bg-muted)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${seatUtilisation}%`, background: seatUtilisation >= 80 ? 'var(--color-success)' : seatUtilisation >= 50 ? 'var(--color-primary)' : 'var(--color-warning)', borderRadius: 4 }} />
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
              Season ticket holders attend but do not generate regular gate revenue.
            </div>
          </div>

          {/* Monthly finance tick countdown */}
          <div className="card" style={{ padding: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700 }}>Next Monthly Deduction</span>
              <span style={{
                fontWeight: 900,
                color: daysUntilTick <= 3 ? 'var(--color-danger)' : 'var(--color-primary)',
              }}>
                {lastMonthlyFinanceTick === 0 ? 'Soon' : daysUntilTick === 0 ? 'Today' : `${daysUntilTick}d`}
              </span>
            </div>
            <div style={{ background: 'var(--bg-muted)', borderRadius: 6, height: 6, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.max(0, Math.min(100, 100 - (daysUntilTick / 30) * 100))}%`,
                background: daysUntilTick <= 3 ? 'var(--color-danger)' : 'var(--color-primary)',
                borderRadius: 6,
                transition: 'width 0.3s',
              }} />
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 6 }}>
              Recurring income and operating costs are posted every 30 days
            </div>
          </div>
        </div>
      </div>

      {/* ── Smart Insights ── */}
      {(() => {
        const insights = [];
        if (ticketPrice > 60 && seatUtilisation < 60) {
          insights.push({ icon: '🎟️', color: 'var(--color-warning)', text: 'Ticket price is high. Revenue per fan is strong, but attendance is below 60% — consider lowering prices to fill the arena.' });
        }
        if (seasonTicketSeats > 0) {
          insights.push({ icon: '🎫', color: 'var(--color-success)', text: `Season tickets improved guaranteed cash flow, but reduced match-day gate revenue by ${fmt(seasonTicketSeats * ticketPrice * HOME_GAMES_MONTH)} vs. selling those seats individually.` });
        }
        if (awayFanPct > 20) {
          insights.push({ icon: '✈️', color: 'var(--color-warning)', text: `Away allocation is ${awayFanPct}% — you\'re giving up ${awaySeatsAllocated} home seats which reduces home court advantage and home fan revenue.` });
        }
        if (mediaCenterLevel >= 2) {
          insights.push({ icon: '📺', color: 'var(--color-success)', text: `Media Center Lv ${mediaCenterLevel} is boosting TV revenue by $${mediaCenterLevel * 100}/month and sponsorship by $${mediaCenterLevel * 150}/month.` });
        }
        if (actualRegularAttend >= homeSeatsAvailable * 0.95 && homeSeatsAvailable > 0) {
          insights.push({ icon: '🏟️', color: 'var(--color-info)', text: 'Arena is nearly full! Upgrade the Basketball Hall to increase capacity and earn more gate revenue.' });
        }
        if (merchandiseLevel === 0) {
          insights.push({ icon: '🛍️', color: 'var(--color-warning)', text: 'Merchandise Store is not built. High enthusiasm is not converting into passive income.' });
        }
        if (merchandiseLevel > 0 && fanEnthusiasm > 60) {
          insights.push({ icon: '🛍️', color: 'var(--color-success)', text: `High fan enthusiasm (${fanEnthusiasm}) is boosting merchandise income — fans are buying more items per game.` });
        }
        if (cashReserves < 0) {
          insights.push({ icon: '⚠️', color: 'var(--color-danger)', text: 'Debt is blocking facility upgrades. Improve cash flow through wins, reduce player wages, or sell underperforming players.' });
        }
        if (insights.length === 0) return null;
        return (
          <div className="card mb-6">
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <TrendingUp size={16} style={{ color: 'var(--color-primary)' }} />
                Financial Insights
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {insights.map((ins, i) => (
                <div key={i} style={{ display: 'flex', gap: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)', borderLeft: `3px solid ${ins.color}` }}>
                  <span style={{ fontSize: '1.1rem', flexShrink: 0, lineHeight: 1.4 }}>{ins.icon}</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', lineHeight: 1.6, fontWeight: 500 }}>{ins.text}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

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
              const wage = (p.salary ?? 5) * 8;
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
              const wage = s.salary ?? 100;
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
