export const CONTRACT_TIERS = [
  { id: 'rookie',    label: 'Rookie',    minOvr: 0,  maxOvr: 60,  baseMid: 3,  maxYears: 2, color: '#94a3b8', badgeClass: 'badge-gray'   },
  { id: 'standard',  label: 'Standard',  minOvr: 60, maxOvr: 70,  baseMid: 7,  maxYears: 3, color: '#10b981', badgeClass: 'badge-green'  },
  { id: 'good',      label: 'Good',      minOvr: 70, maxOvr: 78,  baseMid: 12, maxYears: 4, color: '#3b82f6', badgeClass: 'badge-blue'   },
  { id: 'star',      label: 'Star',      minOvr: 78, maxOvr: 85,  baseMid: 20, maxYears: 5, color: '#f59e0b', badgeClass: 'badge-yellow' },
  { id: 'franchise', label: 'Franchise', minOvr: 85, maxOvr: 100, baseMid: 30, maxYears: 5, color: '#ef4444', badgeClass: 'badge-red'    },
];

export function getContractTier(ovr) {
  for (let i = CONTRACT_TIERS.length - 1; i >= 0; i--) {
    if (ovr >= CONTRACT_TIERS[i].minOvr) return CONTRACT_TIERS[i];
  }
  return CONTRACT_TIERS[0];
}

function roundHalf(val) {
  return Math.round(val * 2) / 2;
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

export function calculateWageDemand(player, options = {}) {
  const renewal = options.renewal ?? false;
  const ovr = player.overallRating ?? 60;
  const tier = getContractTier(ovr);

  const tierRange = tier.maxOvr - tier.minOvr;
  const ovrPos = tierRange > 0 ? (ovr - tier.minOvr) / tierRange : 0.5;
  const prevTier = CONTRACT_TIERS[CONTRACT_TIERS.indexOf(tier) - 1];
  const nextTier = CONTRACT_TIERS[CONTRACT_TIERS.indexOf(tier) + 1];
  const baseMin = prevTier ? prevTier.baseMid : tier.baseMid * 0.6;
  const baseMax = nextTier ? nextTier.baseMid : tier.baseMid * 1.4;
  let base = baseMin + (baseMax - baseMin) * ovrPos;

  const currentSalary = player.salary ?? 0;
  const floorMult = renewal ? 1.08 : 1.0;
  base = Math.max(base, currentSalary * floorMult);

  const form = player.lastFormRating ?? 65;
  const formMult = 1 + clamp((form - 65) / 100, -0.15, 0.20);

  const age = player.age ?? 26;
  let ageMult;
  if (age < 22) ageMult = 0.88;
  else if (age < 30) ageMult = 1.0;
  else if (age < 34) ageMult = 0.90;
  else ageMult = 0.75;

  const gamesPlayed = player.seasonStats?.gamesPlayed ?? 0;
  let statsMult = 1.0;
  if (gamesPlayed > 0) {
    const ppg = (player.seasonStats?.points ?? 0) / gamesPlayed;
    const apg = (player.seasonStats?.assists ?? 0) / gamesPlayed;
    const rpg = (player.seasonStats?.rebounds ?? 0) / gamesPlayed;
    statsMult = 1 + Math.min(0.15, (ppg * 0.8 + apg * 0.5 + rpg * 0.4) / 20);
  }

  const potential = player.potential ?? 70;
  let potentialMult = 1.0;
  if (age <= 23 && potential >= 85) potentialMult = 1.12;
  else if (age <= 26 && potential >= 80) potentialMult = 1.06;

  let roleMult = 1.0;
  if (player.isCaptain) roleMult = 1.15;
  else if (player.isViceCaptain) roleMult = 1.08;

  const demand = roundHalf(base * formMult * ageMult * statsMult * potentialMult * roleMult);

  let demandYears;
  if (age < 26) demandYears = Math.min(tier.maxYears, 3);
  else if (age < 32) demandYears = Math.min(tier.maxYears, 2);
  else demandYears = 1;

  return {
    demand,
    demandYears,
    tier,
    breakdown: {
      base: roundHalf(base),
      formMult,
      ageMult,
      statsMult,
      potentialMult,
      roleMult,
    },
  };
}

export function evaluateOffer(offer, offerYears, { demand, demandYears }) {
  const ratio = offer / demand;
  const yearsOk = offerYears >= demandYears - 1;
  const yearsMatch = offerYears >= demandYears;
  const yearsBonus = offerYears >= demandYears + 1;

  if ((ratio >= 0.92 && yearsOk) || (ratio >= 0.80 && yearsMatch)) return 'accepted';
  if (ratio >= 0.72 || (ratio >= 0.60 && yearsBonus)) return 'counter';
  return 'declined';
}

export function counterOffer({ demand, demandYears }) {
  return {
    salary: roundHalf(demand * 0.93),
    years: demandYears,
  };
}

export function getContractInsights(player, teamPlayers = []) {
  const insights = [];
  const ovr = player.overallRating ?? 60;
  const age = player.age ?? 26;
  const salary = player.salary ?? 0;
  const years = player.contractYears ?? 2;
  const potential = player.potential ?? 70;

  const demandInfo = calculateWageDemand(player, { renewal: years <= 1 });
  const demand = demandInfo.demand;

  if (years <= 1) {
    insights.push({ type: 'warning', icon: '⚠️', text: years <= 0 ? 'Contract has expired — player may leave for free.' : 'Contract expiring this season — negotiate soon.' });
  }

  if (salary > 0 && salary < demand * 0.70) {
    insights.push({ type: 'info', icon: '💰', text: `Underpaid — earning $${salary}k vs market value $${demand}k. Low flight risk but deserves a raise.` });
  }

  if (salary > demand * 1.35) {
    insights.push({ type: 'danger', icon: '📉', text: `Overpaid — earning $${salary}k vs market value $${demand}k. Budget strain.` });
  }

  if (age >= 27 && age <= 31 && ovr >= 75) {
    insights.push({ type: 'success', icon: '⭐', text: 'Prime years — peak performance window. Key player to retain.' });
  }

  if (age <= 22 && potential >= 80) {
    insights.push({ type: 'info', icon: '🚀', text: `High-potential youngster (pot. ${potential}). Long-term investment opportunity.` });
  }

  if (age >= 34) {
    insights.push({ type: 'neutral', icon: '🎖️', text: `Veteran (age ${age}). Consider succession planning.` });
  }

  if (teamPlayers.length > 0) {
    const teamAvg = teamPlayers.reduce((s, p) => s + (p.salary ?? 0), 0) / teamPlayers.length;
    if (teamAvg > 0 && salary > teamAvg * 1.9) {
      insights.push({ type: 'warning', icon: '💸', text: `Highest-paid player — salary is ${Math.round((salary / teamAvg - 1) * 100)}% above team average.` });
    }
  }

  return insights;
}
