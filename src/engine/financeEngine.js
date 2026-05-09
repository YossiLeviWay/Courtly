// ============================================================
// Courtly - Finance Engine
// Shared formulas for Dashboard, Financial Report, and monthly ticks.
// All returned money values use the same game budget unit used by team.budget.
// ============================================================

export const HOME_GAMES_MONTH = 4;
export const SEASON_MONTHS = 9;
export const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export function getFacilityLevel(facilityData) {
  if (typeof facilityData === 'number') return facilityData;
  return facilityData?.level ?? 0;
}

export function calcPlayerOvr(player) {
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
  return 200 + avg * 30;
}

function getRecentWins(matchHistory = []) {
  return matchHistory.slice(0, 5).filter(m =>
    m.result === 'W' || (m.teamScore ?? m.userScore ?? 0) > (m.oppScore ?? m.opponentScore ?? 0)
  ).length;
}

export function getLeagueTier(team, fallback = 'C') {
  return team?.league ?? team?.tier ?? fallback ?? 'C';
}

export function calculateFinanceProjection(team = {}, options = {}) {
  const facilities = team.facilities ?? {};
  const players = team.players ?? team.playersState ?? [];
  const staff = Object.values(team.staff ?? {});
  const leagueTier = options.leagueTier ?? getLeagueTier(team);

  const basketballHallLevel = getFacilityLevel(facilities.basketballHall);
  const mediaCenterLevel = getFacilityLevel(facilities.media);
  const merchandiseLevel = getFacilityLevel(facilities.merchandise);

  const arenaCapacity = 600 + basketballHallLevel * 200;
  const ticketPrice = team.ticketPrice ?? 20;
  const seasonTicketSeats = team.seasonTicketSeats ?? 0;
  const seasonTicketPrice = team.seasonTicketPrice ?? 15;
  const awayFanPct = team.awayFanPct ?? 10;
  const fanCount = team.fanCount ?? 250;
  const fanEnthusiasm = team.fanEnthusiasm ?? 20;
  const reputation = team.reputation ?? 10;

  const enthusiasmMultiplier = 0.5 + fanEnthusiasm / 100;
  const recentWins = getRecentWins(team.matchHistory ?? []);
  const performanceMultiplier = Math.max(0.6, Math.min(1.4, 1 + (recentWins - 2) * 0.05));
  const priceSensitivity = ticketPrice <= 25 ? 1.15 : ticketPrice <= 40 ? 1.00 : ticketPrice <= 60 ? 0.85 : 0.65;
  const reputationMultiplier = 0.8 + reputation / 100;

  const awaySeatsAllocated = Math.round(arenaCapacity * (awayFanPct / 100));
  const homeSeatsAvailable = Math.max(0, arenaCapacity - awaySeatsAllocated - seasonTicketSeats);
  const potentialRegularAttend = Math.round(fanCount * enthusiasmMultiplier * performanceMultiplier * priceSensitivity * reputationMultiplier);
  const actualRegularAttend = Math.min(potentialRegularAttend, homeSeatsAvailable);
  const seasonTicketAttendees = Math.round(seasonTicketSeats * 0.85);
  const awayFanAttendees = Math.round(awaySeatsAllocated * 0.7);
  const totalAttendancePerGame = actualRegularAttend + seasonTicketAttendees + awayFanAttendees;
  const seatUtilisation = arenaCapacity > 0 ? Math.round((totalAttendancePerGame / arenaCapacity) * 100) : 0;

  const regularGatePerGame = Math.round(actualRegularAttend * ticketPrice);
  const awayGatePerGame = Math.round(awayFanAttendees * ticketPrice * 0.8);
  const monthlyGateRevenue = (regularGatePerGame + awayGatePerGame) * HOME_GAMES_MONTH;
  const monthlySeasonTicketRevenue = seasonTicketSeats * seasonTicketPrice * HOME_GAMES_MONTH;

  const fanSpendingRate = 0.5 + fanEnthusiasm / 200;
  const baseMerchMonthly = merchandiseLevel > 0 ? (50 + merchandiseLevel * 30) * 4 : 0;
  const attendMerch = merchandiseLevel > 0
    ? Math.round(totalAttendancePerGame * fanSpendingRate * HOME_GAMES_MONTH)
    : 0;
  const monthlyMerchRevenue = baseMerchMonthly + attendMerch;

  const baseTVByLeague = { A: 500, B: 250, C: 100 }[leagueTier] ?? 100;
  const monthlyTVRevenue = baseTVByLeague + reputation * 5 + mediaCenterLevel * 100;
  const monthlySponsorship = Math.round(100 + fanCount * 0.2 + reputation * 10 + mediaCenterLevel * 150);

  const totalMonthlyRevenue = monthlyGateRevenue + monthlySeasonTicketRevenue + monthlyMerchRevenue + monthlyTVRevenue + monthlySponsorship;
  const recurringMonthlyRevenue = monthlySeasonTicketRevenue + monthlyMerchRevenue + monthlyTVRevenue + monthlySponsorship;

  const monthlyPlayerWages = players.reduce((sum, p) => sum + (p.salary ?? 5) * 8, 0);
  const monthlyStaffWages = staff.reduce((sum, s) => sum + (s.salary ?? 100), 0);
  const monthlyFacMaintenance =
    getFacilityLevel(facilities.basketballHall) * 50 +
    getFacilityLevel(facilities.media) * 30 +
    getFacilityLevel(facilities.merchandise) * 25 +
    getFacilityLevel(facilities.trainingCourt) * 40 +
    getFacilityLevel(facilities.gym) * 35 +
    getFacilityLevel(facilities.youthAcademy) * 45 +
    getFacilityLevel(facilities.medicalCenter) * 30 +
    getFacilityLevel(facilities.scoutingOffice) * 25;
  const monthlyGeneralOps = Math.round(200 + arenaCapacity * 0.05 + fanCount * 0.02);
  const totalMonthlyExpenses = monthlyPlayerWages + monthlyStaffWages + monthlyFacMaintenance + monthlyGeneralOps;

  return {
    leagueTier,
    basketballHallLevel,
    mediaCenterLevel,
    merchandiseLevel,
    arenaCapacity,
    ticketPrice,
    seasonTicketSeats,
    seasonTicketPrice,
    awayFanPct,
    fanCount,
    fanEnthusiasm,
    reputation,
    enthusiasmMultiplier,
    recentWins,
    performanceMultiplier,
    priceSensitivity,
    reputationMultiplier,
    awaySeatsAllocated,
    homeSeatsAvailable,
    potentialRegularAttend,
    actualRegularAttend,
    seasonTicketAttendees,
    awayFanAttendees,
    totalAttendancePerGame,
    seatUtilisation,
    regularGatePerGame,
    awayGatePerGame,
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
    projectedNetMonthly: totalMonthlyRevenue - totalMonthlyExpenses,
    recurringNetMonthly: recurringMonthlyRevenue - totalMonthlyExpenses,
    payroll: monthlyPlayerWages + monthlyStaffWages,
  };
}

export function summarizeFinanceLog(financeLog = [], now = Date.now()) {
  const monthStart = now - THIRTY_DAYS;
  const entries = financeLog.filter(entry => (entry.timestamp ?? 0) >= monthStart);
  const income = entries.filter(entry => (entry.amount ?? 0) > 0).reduce((sum, entry) => sum + entry.amount, 0);
  const expenses = entries.filter(entry => (entry.amount ?? 0) < 0).reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
  return {
    entries,
    income,
    expenses,
    net: income - expenses,
  };
}

export function applyMonthlyFinanceTick(team = {}, options = {}) {
  const now = options.now ?? Date.now();
  const projection = calculateFinanceProjection(team, options);
  let budget = team.budget ?? 50;
  const financeLog = [...(team.financeLog ?? [])];

  budget -= projection.totalMonthlyExpenses;
  financeLog.unshift({
    timestamp: now,
    type: 'monthly_expenses',
    description: `Monthly Expenses - wages $${projection.payroll}, facility $${projection.monthlyFacMaintenance}, ops $${projection.monthlyGeneralOps}`,
    amount: -projection.totalMonthlyExpenses,
    balanceAfter: budget,
  });

  budget += projection.recurringMonthlyRevenue;
  financeLog.unshift({
    timestamp: now,
    type: 'monthly_revenue',
    description: `Monthly Revenue - TV $${projection.monthlyTVRevenue}, sponsorship $${projection.monthlySponsorship}, merchandise $${projection.monthlyMerchRevenue}${projection.monthlySeasonTicketRevenue > 0 ? `, season tickets $${projection.monthlySeasonTicketRevenue}` : ''}`,
    amount: projection.recurringMonthlyRevenue,
    balanceAfter: budget,
  });

  const snapshot = {
    timestamp: now,
    ...projection,
    appliedRevenue: projection.recurringMonthlyRevenue,
    appliedExpenses: projection.totalMonthlyExpenses,
    appliedNet: projection.recurringNetMonthly,
    projectedMatchdayRevenue: projection.monthlyGateRevenue,
  };

  return {
    budget,
    financeLog: financeLog.slice(0, 80),
    snapshot,
  };
}
