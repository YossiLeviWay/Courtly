import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../context/GameContext.jsx';
import {
  Award,
  BarChart3,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  History,
  Lock,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  UserMinus,
  Users,
  XCircle,
} from 'lucide-react';

// ── Seeded random ──────────────────────────────────────────────

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hashString(value) {
  return String(value).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function randomBetween(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randomFrom(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function getWeekKey(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.floor((d - yearStart) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return `${d.getFullYear()}-${String(week).padStart(2, '0')}`;
}

function getNextSunday(date = new Date(), alreadyGenerated = false) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const daysUntilSunday = (7 - d.getDay()) % 7;
  d.setDate(d.getDate() + daysUntilSunday + (alreadyGenerated ? 7 : 0));
  return d;
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

// ── Youth data pools ───────────────────────────────────────────

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

const NATIONALITY_POOLS = {
  Israeli: ['Noam Cohen', 'Amit Levi', 'Eitan Mizrahi', 'Ori Ben David', 'Yair Katz', 'Ido Malka'],
  American: ['Jayden Brooks', 'Marcus Reed', 'Tyler Johnson', 'Caleb Parker', 'Darius Hill', 'Isaiah Carter'],
  Serbian: ['Luka Petrovic', 'Nikola Jovanovic', 'Milan Ilic', 'Stefan Markovic', 'Bogdan Simic'],
  Croatian: ['Mateo Kovac', 'Ivan Horvat', 'Luka Babic', 'Dario Marin', 'Toni Vukovic'],
  Greek: ['Nikos Papadopoulos', 'Giorgos Antetis', 'Alexis Stavros', 'Dimitris Karras'],
  Spanish: ['Pablo Garcia', 'Sergio Navarro', 'Diego Martinez', 'Hugo Fernandez', 'Iker Romero'],
  French: ['Theo Laurent', 'Lucas Moreau', 'Mathis Dubois', 'Enzo Bernard', 'Noah Lefevre'],
  Lithuanian: ['Matas Kazlauskas', 'Tomas Petrauskas', 'Jonas Butkus', 'Rokas Jankauskas'],
  Turkish: ['Emir Yilmaz', 'Kerem Demir', 'Mert Kaya', 'Can Arslan', 'Efe Aydin'],
  Nigerian: ['Chidi Okafor', 'Tunde Adeyemi', 'Ike Nwosu', 'Kelechi Obi', 'Femi Balogun'],
  Brazilian: ['Rafael Silva', 'Lucas Santos', 'Mateus Costa', 'Joao Almeida', 'Bruno Rocha'],
  Argentinian: ['Mateo Fernandez', 'Nicolas Alvarez', 'Tomas Romero', 'Santiago Molina'],
  German: ['Lukas Schneider', 'Jonas Weber', 'Felix Wagner', 'Leon Becker', 'Noah Hoffmann'],
  Italian: ['Marco Ricci', 'Luca Romano', 'Andrea Conti', 'Matteo Greco', 'Davide Ferrari'],
};

const PERSONALITIES = [
  { name: 'Hard Worker', developmentSpeed: 8, moraleChange: 1, contractDemand: 0, bigGamePerformance: 0, injuryRisk: 0, potential: 2 },
  { name: 'Natural Talent', developmentSpeed: 2, moraleChange: 0, contractDemand: 1, bigGamePerformance: 1, injuryRisk: 0, potential: 6 },
  { name: 'Leader', developmentSpeed: 3, moraleChange: 4, contractDemand: 1, bigGamePerformance: 2, injuryRisk: 0, potential: 2 },
  { name: 'Quiet Professional', developmentSpeed: 4, moraleChange: 1, contractDemand: -1, bigGamePerformance: 0, injuryRisk: -1, potential: 1 },
  { name: 'Ambitious', developmentSpeed: 3, moraleChange: -1, contractDemand: 5, bigGamePerformance: 1, injuryRisk: 0, potential: 3 },
  { name: 'Loyal', developmentSpeed: 2, moraleChange: 2, contractDemand: -4, bigGamePerformance: 0, injuryRisk: 0, potential: 1 },
  { name: 'Lazy', developmentSpeed: -7, moraleChange: -2, contractDemand: -1, bigGamePerformance: -1, injuryRisk: 1, potential: -3 },
  { name: 'Injury Prone', developmentSpeed: -2, moraleChange: 0, contractDemand: -1, bigGamePerformance: 0, injuryRisk: 6, potential: 0 },
  { name: 'Big Game Player', developmentSpeed: 2, moraleChange: 1, contractDemand: 2, bigGamePerformance: 7, injuryRisk: 0, potential: 2 },
  { name: 'Nervous', developmentSpeed: 0, moraleChange: -3, contractDemand: -2, bigGamePerformance: -6, injuryRisk: 0, potential: 1 },
];

const ATTRIBUTE_KEYS = [
  'courtVision', 'perimeterDefense', 'interiorDefense', 'offBallMovement', 'rebounding',
  'freeThrowShooting', 'clutchPerformance', 'staminaEndurance', 'leadershipCommunication',
  'postMoves', 'threePtShooting', 'midRangeScoring', 'ballHandlingDribbling', 'passingAccuracy',
  'basketballIQ', 'aggressivenessOffensive', 'helpDefense', 'onBallScreenNavigation',
  'conditioningFitness', 'patienceOffense', 'disciplineFouling', 'handlePressureMental',
  'verticalLeapingAbility', 'agilityLateralSpeed', 'settingScreens', 'finishingAtTheRim',
  'consistencyPerformance', 'workEthicOutOfGame', 'teamFirstAttitude', 'bodyControl',
];

const POSITION_WEIGHTS = {
  PG: { courtVision: 1.25, passingAccuracy: 1.22, ballHandlingDribbling: 1.24, basketballIQ: 1.16, agilityLateralSpeed: 1.12, rebounding: 0.78, interiorDefense: 0.74, postMoves: 0.72 },
  SG: { threePtShooting: 1.25, midRangeScoring: 1.18, freeThrowShooting: 1.12, offBallMovement: 1.14, agilityLateralSpeed: 1.1, rebounding: 0.86, postMoves: 0.78 },
  SF: { midRangeScoring: 1.1, threePtShooting: 1.08, perimeterDefense: 1.1, rebounding: 1.08, finishingAtTheRim: 1.12, bodyControl: 1.12 },
  PF: { rebounding: 1.24, interiorDefense: 1.18, postMoves: 1.16, settingScreens: 1.14, finishingAtTheRim: 1.12, threePtShooting: 0.84, ballHandlingDribbling: 0.82 },
  C: { rebounding: 1.32, blocks: 1.22, interiorDefense: 1.28, postMoves: 1.2, settingScreens: 1.18, finishingAtTheRim: 1.16, threePtShooting: 0.62, ballHandlingDribbling: 0.68, agilityLateralSpeed: 0.78 },
};

const POSITION_PRIMARY_STATS = {
  PG: ['courtVision', 'passingAccuracy', 'ballHandlingDribbling', 'basketballIQ', 'agilityLateralSpeed'],
  SG: ['threePtShooting', 'midRangeScoring', 'freeThrowShooting', 'offBallMovement', 'finishingAtTheRim'],
  SF: ['midRangeScoring', 'perimeterDefense', 'rebounding', 'finishingAtTheRim', 'bodyControl'],
  PF: ['rebounding', 'interiorDefense', 'postMoves', 'settingScreens', 'helpDefense'],
  C: ['rebounding', 'interiorDefense', 'postMoves', 'settingScreens', 'finishingAtTheRim'],
};

function getFacilityLevel(facilityData) {
  if (typeof facilityData === 'number') return facilityData;
  return facilityData?.level ?? 0;
}

function getAcademyDescription(level) {
  if (level <= 0) return 'Very weak, mostly emergency prospects';
  if (level <= 2) return 'Low level prospects';
  if (level <= 4) return 'Below average, but sometimes useful';
  if (level <= 6) return 'Solid youth prospects';
  if (level <= 8) return 'Strong prospects with good potential';
  if (level === 9) return 'Very strong prospects';
  return 'Elite academy, rare future stars possible';
}

function getTeamAverageOverall(players = []) {
  if (!players.length) return 50;
  return Math.round(players.reduce((sum, p) => sum + (p.overallRating ?? p.overall ?? 50), 0) / players.length);
}

function getTeamForm(team) {
  const history = team?.matchHistory ?? [];
  const recent = history.slice(0, 5);
  if (recent.length > 0) {
    const wins = recent.filter(m =>
      m.result === 'W' || (m.teamScore ?? m.userScore ?? 0) > (m.oppScore ?? m.opponentScore ?? 0)
    ).length;
    return clamp(35 + (wins / recent.length) * 65, 0, 100);
  }
  return team?.momentumBar ?? 50;
}

function getSuccessMultiplier(form) {
  if (form >= 80) return 1.08;
  if (form >= 60) return 1.03;
  if (form >= 40) return 1;
  return 0.95;
}

function getTalentTier(adjustedTalentRoll) {
  if (adjustedTalentRoll >= 99) return { label: 'Rare gem', bonus: [17, 22], potentialBoost: 14, message: 'Rare talent discovered. Consider promoting him carefully.' };
  if (adjustedTalentRoll >= 94) return { label: 'Wonderkid', bonus: [11, 16], potentialBoost: 10, message: 'Wonderkid found. His ceiling is far above normal academy level.' };
  if (adjustedTalentRoll >= 81) return { label: 'Very good prospect', bonus: [7, 10], potentialBoost: 6, message: 'This prospect is above the normal academy expectation.' };
  if (adjustedTalentRoll >= 56) return { label: 'Good prospect', bonus: [3, 6], potentialBoost: 3, message: 'This prospect is close to your squad level and could be useful soon.' };
  return { label: 'Normal prospect', bonus: [0, 0], potentialBoost: 0, message: 'This is a normal academy prospect for your current club level.' };
}

function choosePosition(rng, players = [], history = []) {
  const counts = POSITIONS.reduce((acc, pos) => ({ ...acc, [pos]: 0 }), {});
  players.forEach(p => {
    if (counts[p.position] !== undefined) counts[p.position] += 1;
  });

  const total = Math.max(1, players.length);
  let weighted = POSITIONS.map(pos => {
    const idealShare = 1 / POSITIONS.length;
    const currentShare = counts[pos] / total;
    const needBonus = currentShare < idealShare ? 12 : -4;
    return { pos, weight: Math.max(4, 20 + needBonus - counts[pos] * 2) };
  });

  const recentPositions = history.slice(0, 2).map(p => p.position);
  if (recentPositions.length === 2 && recentPositions[0] === recentPositions[1]) {
    weighted = weighted.map(item => item.pos === recentPositions[0] ? { ...item, weight: 1 } : item);
  }

  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  let roll = rng() * totalWeight;
  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.pos;
  }
  return randomFrom(rng, POSITIONS);
}

function generateAttributes(rng, position, overall) {
  const weights = POSITION_WEIGHTS[position] ?? {};
  return ATTRIBUTE_KEYS.reduce((attrs, key) => {
    const weightedCentre = overall * (weights[key] ?? 1);
    attrs[key] = clamp(weightedCentre + randomBetween(rng, -10, 10), 25, 99);
    return attrs;
  }, {});
}

function generateName(rng, history = []) {
  const nationalities = Object.keys(NATIONALITY_POOLS);
  let nationality = randomFrom(rng, nationalities);
  let name = randomFrom(rng, NATIONALITY_POOLS[nationality]);
  const usedNames = new Set(history.map(p => p.name));

  for (let attempt = 0; attempt < 20 && usedNames.has(name); attempt += 1) {
    nationality = randomFrom(rng, nationalities);
    name = randomFrom(rng, NATIONALITY_POOLS[nationality]);
  }

  return { name, nationality };
}

function getHeightAndWeight(rng, position) {
  const ranges = {
    PG: { cm: [175, 195], kg: [75, 90] },
    SG: { cm: [185, 200], kg: [85, 100] },
    SF: { cm: [195, 208], kg: [95, 110] },
    PF: { cm: [203, 213], kg: [105, 120] },
    C: { cm: [208, 220], kg: [110, 130] },
  };
  const range = ranges[position] ?? ranges.SF;
  const cm = randomBetween(rng, range.cm[0], range.cm[1]);
  const totalInches = Math.round(cm / 2.54);
  const kg = randomBetween(rng, range.kg[0], range.kg[1]);
  return {
    height: { cm, ft: Math.floor(totalInches / 12), inches: totalInches % 12 },
    weight: { kg, lbs: Math.round(kg * 2.2046) },
  };
}

function calculateMarketValue({ overallRating, potential, age, position, personalityImpact, academyLevel, reputation, talentTier }) {
  const positionBonus = position === 'C' || position === 'PG' ? 350 : 200;
  const ageBonus = Math.max(0, (20 - age) * 450);
  const personalityBonus = Math.max(-500, (personalityImpact.developmentSpeed + personalityImpact.bigGamePerformance - personalityImpact.injuryRisk) * 90);
  const rareMultiplier = talentTier === 'Rare gem' ? 2.2 : talentTier === 'Wonderkid' ? 1.7 : talentTier === 'Very good prospect' ? 1.3 : 1;
  return Math.round((overallRating * 100 + potential * 150 + academyLevel * 200 + reputation * 25 + ageBonus + positionBonus + personalityBonus) * rareMultiplier);
}

function buildStats(position, attributes) {
  const keys = POSITION_PRIMARY_STATS[position] ?? POSITION_PRIMARY_STATS.SF;
  return keys.reduce((stats, key) => ({ ...stats, [key]: attributes[key] }), {});
}

function generateYouthProspect({ team, academyLevel, weekKey }) {
  const players = team?.players ?? [];
  const youthDraft = team?.youthDraft ?? {};
  const history = youthDraft.generatedProspectHistory ?? [];
  const teamHash = hashString(team?.id ?? team?.name ?? 'team');
  const seed = hashString(`${weekKey}-${teamHash}-${history.length}`);
  const rng = mulberry32(seed);

  const teamAverageOverall = getTeamAverageOverall(players);
  const teamReputation = team?.reputation ?? 10;
  const teamForm = getTeamForm(team);
  const academyQualityBonus = academyLevel * 1.5;
  const reputationBonus = teamReputation / 20;
  const formBonus = teamForm / 25;
  const successMultiplier = getSuccessMultiplier(teamForm);
  const randomVariance = randomBetween(rng, -6, 6);
  const rawTalentRoll = randomBetween(rng, 0, 100);
  const adjustedTalentRoll = clamp(rawTalentRoll + academyLevel * 2, 0, 100);
  const talentTier = getTalentTier(adjustedTalentRoll);
  const talentBonus = randomBetween(rng, talentTier.bonus[0], talentTier.bonus[1]);

  const baseYouthOverall = (
    teamAverageOverall
    - 5
    + academyQualityBonus
    + reputationBonus
    + formBonus
    + randomVariance
    + talentBonus
  ) * successMultiplier;

  const overallRating = clamp(baseYouthOverall, 25, 85);
  const personality = randomFrom(rng, PERSONALITIES);
  const potential = clamp(overallRating + randomBetween(rng, 5, 25) + academyLevel * 2 + talentTier.potentialBoost + personality.potential, overallRating, 99);
  const position = choosePosition(rng, players, history);
  const attributes = generateAttributes(rng, position, overallRating);
  const { name, nationality } = generateName(rng, history);
  const age = randomBetween(rng, 16, 19);
  const { height, weight } = getHeightAndWeight(rng, position);
  const monthlyWage = Math.round(20 + overallRating * 1.5 + potential * 0.5 + Math.max(0, personality.contractDemand * 3));
  const marketValue = calculateMarketValue({
    overallRating,
    potential,
    age,
    position,
    personalityImpact: personality,
    academyLevel,
    reputation: teamReputation,
    talentTier: talentTier.label,
  });

  const summaryMessage = potential - overallRating >= 20
    ? 'This player has low current ability but high potential. Keep him in the academy.'
    : talentTier.message;

  return {
    id: `youth-${weekKey}-${teamHash}-${Date.now()}`,
    name,
    age,
    nationality,
    position,
    overallRating,
    overall: overallRating,
    potential,
    form: randomBetween(rng, 45, 75),
    morale: randomBetween(rng, 50, 85),
    personality: personality.name,
    personalityImpact: {
      developmentSpeed: personality.developmentSpeed,
      moraleChange: personality.moraleChange,
      contractDemand: personality.contractDemand,
      bigGamePerformance: personality.bigGamePerformance,
      injuryRisk: personality.injuryRisk,
    },
    height,
    weight,
    dominantHand: rng() > 0.82 ? 'Left' : 'Right',
    attributes,
    stats: buildStats(position, attributes),
    contract: {
      monthlyWage,
      monthsRemaining: randomBetween(rng, 18, 36),
      contractType: 'Youth Contract',
      demandLevel: 'Low',
    },
    salary: Math.max(1, Math.round(monthlyWage * 12 / 1000)),
    contractYears: 2,
    marketValue,
    academyStatus: 'Pending',
    createdAt: Date.now(),
    generatedWeek: weekKey,
    fatigue: 10,
    motivation: randomBetween(rng, 58, 82),
    injuryStatus: 'healthy',
    injuryDaysRemaining: 0,
    lastFormRating: randomBetween(rng, 50, 75),
    seasonStats: { gamesPlayed: 0, points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, fgMade: 0, fgAttempts: 0 },
    careerStats: { gamesPlayed: 0, points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, fgMade: 0, fgAttempts: 0 },
    isYouthAcademy: true,
    report: {
      teamAverageOverall,
      academyLevel,
      teamReputation,
      teamForm,
      randomVariance,
      rawTalentRoll,
      adjustedTalentRoll,
      talentResult: talentTier.label,
      successMultiplier,
      summaryMessage,
      finalResult: overallRating >= teamAverageOverall + 8
        ? 'Well above team level'
        : overallRating >= teamAverageOverall - 2
        ? 'Close to team level'
        : 'Development project',
    },
  };
}

function compactHistory(player, status) {
  return {
    id: player.id,
    name: player.name,
    nationality: player.nationality,
    position: player.position,
    generatedWeek: player.generatedWeek,
    overall: player.overallRating,
    potential: player.potential,
    personality: player.personality,
    status,
    marketValue: player.marketValue,
    timestamp: Date.now(),
  };
}

function getPlayerAdvice(player, academyLevel) {
  if (!player) return `Upgrade the Youth Academy facility to improve future prospects.`;
  if (academyLevel <= 2) return 'Your academy level is low, so most prospects will be limited.';
  if (player.report?.talentResult === 'Rare gem' || player.report?.talentResult === 'Wonderkid') return 'Rare talent discovered. Consider promoting him carefully.';
  if (player.potential - player.overallRating >= 18) return 'This player has low overall but high potential. Keep him in the academy.';
  if (player.overallRating >= player.report?.teamAverageOverall - 2) return 'This prospect is close to your squad level and could be useful soon.';
  return 'Upgrade the Youth Academy facility to improve future prospects.';
}

function EmptyState({ icon: Icon, title, body }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '36px 24px' }}>
      <Icon size={36} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
      <div style={{ fontWeight: 800, fontSize: 'var(--font-size-lg)', marginBottom: 6 }}>{title}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>{body}</div>
    </div>
  );
}

function Metric({ label, value, icon: Icon, accent = 'var(--color-primary)' }) {
  return (
    <div className="stat-card" style={{ textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        <Icon size={15} /> {label}
      </div>
      <div style={{ marginTop: 8, fontSize: 'var(--font-size-xl)', fontWeight: 900, color: accent }}>{value}</div>
    </div>
  );
}

function ProspectCard({ player, compact = false, actions }) {
  const starCount = player.potential >= 90 ? 5 : player.potential >= 82 ? 4 : player.potential >= 72 ? 3 : player.potential >= 62 ? 2 : 1;
  const ovrColor = player.overallRating >= 72 ? 'var(--color-success)' : player.overallRating >= 58 ? 'var(--color-primary)' : 'var(--text-secondary)';

  return (
    <div className="card" style={{ padding: compact ? 16 : 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
        <div style={{
          width: compact ? 46 : 58,
          height: compact ? 46 : 58,
          borderRadius: '50%',
          background: 'var(--bg-muted)',
          border: '1px solid var(--border-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 900,
          color: 'var(--color-primary)',
        }}>
          {player.position}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: compact ? 'var(--font-size-base)' : 'var(--font-size-lg)' }}>{player.name}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
            {player.age} · {player.nationality} · {player.height?.cm}cm · {player.dominantHand} hand
          </div>
          <div style={{ marginTop: 4, color: player.potential >= 85 ? '#f59e0b' : 'var(--color-primary)', letterSpacing: 1 }}>
            {'★'.repeat(starCount)}{'☆'.repeat(5 - starCount)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: compact ? 'var(--font-size-xl)' : '2.4rem', fontWeight: 900, lineHeight: 1, color: ovrColor }}>{player.overallRating}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800 }}>OVR</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
        <div style={{ background: 'var(--bg-muted)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
          <div style={{ fontWeight: 900 }}>{player.potential}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Potential</div>
        </div>
        <div style={{ background: 'var(--bg-muted)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
          <div style={{ fontWeight: 900 }}>${player.marketValue?.toLocaleString()}k</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Value</div>
        </div>
        <div style={{ background: 'var(--bg-muted)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
          <div style={{ fontWeight: 900 }}>${player.contract?.monthlyWage}k</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Monthly</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: compact ? 0 : 14 }}>
        <span className="badge badge-orange">{player.personality}</span>
        <span className="badge badge-gray">{player.contract?.contractType ?? 'Youth Contract'}</span>
        <span className={player.academyStatus === 'Academy' ? 'badge badge-blue' : 'badge badge-gray'}>{player.academyStatus}</span>
      </div>

      {!compact && (
        <>
          <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', lineHeight: 1.5, marginBottom: 14 }}>
            {player.report?.summaryMessage ?? getPlayerAdvice(player, 0)}
          </div>
          {actions}
        </>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────

export default function YouthAcademy() {
  const { state, dispatch, addNotification } = useGame();
  const userTeam = state.userTeam;
  const [activeTab, setActiveTab] = useState('overview');

  const now = new Date();
  const currentWeek = getWeekKey(now);
  const isSunday = now.getDay() === 0;
  const youthDraft = userTeam?.youthDraft ?? {};
  const academyLevel = getFacilityLevel(userTeam?.facilities?.youthAcademy);
  const academyPlayers = youthDraft.academyPlayers ?? [];
  const generatedHistory = youthDraft.generatedProspectHistory ?? [];
  const currentProspect = youthDraft.currentProspect ?? null;
  const lastGeneratedWeek = youthDraft.lastGeneratedWeek ?? null;
  const weeklyDraftAvailable = isSunday && lastGeneratedWeek !== currentWeek && !currentProspect;
  const nextDraftDate = getNextSunday(now, isSunday && lastGeneratedWeek === currentWeek);
  const teamAverageOverall = getTeamAverageOverall(userTeam?.players ?? []);
  const teamForm = getTeamForm(userTeam);
  const prospectsDrafted = youthDraft.prospectsDrafted ?? generatedHistory.length ?? 0;
  const developmentChance = clamp(academyLevel * 3 + 10, 5, 65);

  const smartMessage = useMemo(() => {
    if (currentProspect) return getPlayerAdvice(currentProspect, academyLevel);
    if (isSunday && lastGeneratedWeek === currentWeek) return 'You have already drafted a youth prospect this week. Come back next Sunday.';
    if (weeklyDraftAvailable) return 'Sunday draft is available. Generate one youth prospect for this week.';
    return 'New prospects arrive every Sunday. Upgrade the Youth Academy facility to improve future prospects.';
  }, [academyLevel, currentProspect, isSunday, lastGeneratedWeek, currentWeek, weeklyDraftAvailable]);

  useEffect(() => {
    if (!userTeam || !isSunday) return;
    if (youthDraft.lastDevelopmentWeek === currentWeek) return;
    if (!academyPlayers.length) return;

    const trainingLevel = getFacilityLevel(userTeam.facilities?.trainingCourt);
    const updatedAcademyPlayers = academyPlayers.map((player, index) => {
      const rng = mulberry32(hashString(`${currentWeek}-${player.id}-${index}`));
      const chance = academyLevel * 3 + trainingLevel * 2 + (player.personalityImpact?.developmentSpeed ?? 0) + 8;
      if (rng() * 100 > chance) return player;
      const overallGain = rng() > 0.72 ? 1 : 0;
      const potentialGain = rng() > 0.96 ? 1 : 0;
      return {
        ...player,
        overallRating: clamp((player.overallRating ?? 45) + overallGain, 25, 99),
        overall: clamp((player.overallRating ?? 45) + overallGain, 25, 99),
        potential: clamp((player.potential ?? 60) + potentialGain, player.overallRating ?? 45, 99),
        form: clamp((player.form ?? 60) + randomBetween(rng, 0, 2), 25, 99),
        developmentLog: [
          {
            week: currentWeek,
            text: overallGain ? '+1 overall from academy training' : '+2 form from weekly academy work',
            timestamp: Date.now(),
          },
          ...(player.developmentLog ?? []),
        ].slice(0, 10),
      };
    });

    dispatch({
      type: 'UPDATE_TEAM',
      payload: {
        ...userTeam,
        youthDraft: {
          ...youthDraft,
          academyPlayers: updatedAcademyPlayers,
          lastDevelopmentWeek: currentWeek,
          developmentNotes: [
            { week: currentWeek, text: `Weekly academy development processed for ${academyPlayers.length} prospect${academyPlayers.length === 1 ? '' : 's'}.`, timestamp: Date.now() },
            ...(youthDraft.developmentNotes ?? []),
          ].slice(0, 20),
        },
      },
    });
  }, [academyLevel, academyPlayers, currentWeek, dispatch, isSunday, userTeam, youthDraft]);

  function updateYouthDraft(nextDraft, teamPatch = {}) {
    dispatch({
      type: 'UPDATE_TEAM',
      payload: {
        ...userTeam,
        ...teamPatch,
        youthDraft: nextDraft,
      },
    });
  }

  function handleGenerateProspect() {
    if (!weeklyDraftAvailable) {
      addNotification('You have already drafted a youth prospect this week. Come back next Sunday.', 'warning');
      return;
    }

    const prospect = generateYouthProspect({ team: userTeam, academyLevel, weekKey: currentWeek });
    updateYouthDraft({
      ...youthDraft,
      academyLevel,
      lastGeneratedWeek: currentWeek,
      nextDraftDate: getNextSunday(now, true).getTime(),
      prospectsDrafted: prospectsDrafted + 1,
      weeklyDraftAvailable: false,
      currentProspect: prospect,
      lastDraftedAt: Date.now(),
      lastDraftedPlayer: prospect.name,
      generatedProspectHistory: [
        compactHistory(prospect, 'Generated'),
        ...generatedHistory,
      ].slice(0, 80),
    });
    setActiveTab('draft');
    addNotification(`${prospect.name} generated from the Youth Academy. Choose his next step.`, 'success');
  }

  function handleProspectAction(action, player) {
    const active = player ?? currentProspect;
    if (!active) return;

    let players = userTeam.players ?? [];
    let budget = userTeam.budget ?? 0;
    let fanEnthusiasm = userTeam.fanEnthusiasm ?? 20;
    let academyList = academyPlayers.filter(p => p.id !== active.id);
    let status = 'Academy';
    let message = `${active.name} will continue developing in the academy.`;
    const financeLog = [...(userTeam.financeLog ?? [])];

    if (action === 'promote') {
      const promoted = { ...active, academyStatus: 'Promoted', isYouthAcademy: false };
      players = [...players, promoted];
      status = 'Promoted';
      fanEnthusiasm = Math.min(100, fanEnthusiasm + (promoted.potential >= 85 ? 5 : 2));
      message = `${active.name} promoted to the senior squad.`;
    } else if (action === 'keep') {
      academyList = [{ ...active, academyStatus: 'Academy' }, ...academyList];
      status = 'Academy';
    } else if (action === 'sell') {
      const fee = active.marketValue ?? 0;
      budget += fee;
      status = 'Sold';
      message = `${active.name} sold for $${fee.toLocaleString()}k.`;
      financeLog.unshift({ timestamp: Date.now(), type: 'academy_sale', description: `Youth academy sale: ${active.name}`, amount: fee, balanceAfter: budget });
    } else if (action === 'release') {
      const terminationFee = active.contract?.monthlyWage ?? 0;
      budget -= terminationFee;
      status = 'Released';
      message = `${active.name}'s youth contract was terminated for $${terminationFee}k.`;
      financeLog.unshift({ timestamp: Date.now(), type: 'academy_release', description: `Youth contract termination: ${active.name}`, amount: -terminationFee, balanceAfter: budget });
    }

    updateYouthDraft({
      ...youthDraft,
      currentProspect: currentProspect?.id === active.id ? null : currentProspect,
      academyPlayers: academyList,
      generatedProspectHistory: [
        compactHistory(active, status),
        ...generatedHistory,
      ].slice(0, 80),
    }, {
      players,
      budget,
      fanEnthusiasm,
      financeLog: financeLog.slice(0, 50),
    });

    addNotification(message, action === 'release' ? 'warning' : 'success');
  }

  const tabs = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'draft', label: 'Draft', icon: Sparkles },
    { key: 'prospects', label: 'Prospects', icon: Users },
    { key: 'development', label: 'Development', icon: TrendingUp },
    { key: 'history', label: 'History', icon: History },
  ];

  if (!userTeam) {
    return <EmptyState icon={Lock} title="No team loaded" body="Choose a club before using the Youth Academy." />;
  }

  return (
    <div className="animate-fade-in">
      <div style={{
        background: 'linear-gradient(135deg, #18223a 0%, #1f3f56 54%, #24523f 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: '30px 24px',
        marginBottom: 22,
        color: 'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ width: 58, height: 58, borderRadius: 12, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={32} />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h1 style={{ margin: 0, fontSize: 'var(--font-size-2xl)', fontWeight: 900 }}>Youth Academy</h1>
            <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.72)', fontSize: 'var(--font-size-sm)' }}>
              Level {academyLevel}/10 · One random young player every Sunday · {getAcademyDescription(academyLevel)}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'rgba(255,255,255,0.62)', textTransform: 'uppercase', fontWeight: 800 }}>Prospects Drafted</div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: '#fbbf24' }}>{prospectsDrafted}</div>
          </div>
        </div>

        <div style={{ marginTop: 18, background: weeklyDraftAvailable ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.08)', border: weeklyDraftAvailable ? '1px solid rgba(251,191,36,0.6)' : '1px solid rgba(255,255,255,0.14)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          {weeklyDraftAvailable ? <CheckCircle size={20} color="#fbbf24" /> : <Calendar size={20} color="rgba(255,255,255,0.72)" />}
          <div>
            <div style={{ fontWeight: 900 }}>{weeklyDraftAvailable ? 'Weekly draft available' : `Next draft: ${formatDate(nextDraftDate)}`}</div>
            <div style={{ color: 'rgba(255,255,255,0.66)', fontSize: 'var(--font-size-xs)' }}>{smartMessage}</div>
          </div>
        </div>
      </div>

      <div className="tabs" style={{ overflowX: 'auto' }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} className={`tab ${activeTab === tab.key ? 'active' : ''}`} onClick={() => setActiveTab(tab.key)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              <Icon size={15} /> {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 18 }}>
            <Metric icon={Award} label="Academy Level" value={`${academyLevel}/10`} />
            <Metric icon={Users} label="Team Average" value={teamAverageOverall} accent="var(--text-primary)" />
            <Metric icon={Star} label="Reputation" value={`${userTeam.reputation ?? 10}/100`} accent="#f59e0b" />
            <Metric icon={TrendingUp} label="Recent Form" value={`${teamForm}/100`} accent="var(--color-success)" />
          </div>

          <div className="card" style={{ padding: 22, marginBottom: 18 }}>
            <div className="card-title" style={{ marginBottom: 8 }}>Academy Quality</div>
            <div style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 14 }}>
              {getAcademyDescription(academyLevel)}. Each academy level adds current ability and gives a larger boost to potential, while team reputation and recent form influence the quality of players who want to join.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <div className="badge badge-gray">Quality bonus: +{(academyLevel * 1.5).toFixed(1)} OVR</div>
              <div className="badge badge-gray">Potential bonus: +{academyLevel * 2}</div>
              <div className="badge badge-gray">Development chance: {developmentChance}%</div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'draft' && (
        <div style={{ display: 'grid', gridTemplateColumns: currentProspect ? 'repeat(auto-fit, minmax(280px, 1fr))' : '1fr', gap: 18 }}>
          {!currentProspect ? (
            <div className="card" style={{ textAlign: 'center', padding: '46px 28px' }}>
              {weeklyDraftAvailable ? <Sparkles size={44} style={{ color: 'var(--color-primary)', marginBottom: 14 }} /> : <Lock size={44} style={{ color: 'var(--text-muted)', marginBottom: 14 }} />}
              <div style={{ fontWeight: 900, fontSize: 'var(--font-size-xl)', marginBottom: 8 }}>
                {weeklyDraftAvailable ? 'Generate This Week\'s Prospect' : 'Draft Locked'}
              </div>
              <div style={{ color: 'var(--text-muted)', maxWidth: 520, margin: '0 auto 20px', lineHeight: 1.6 }}>
                {weeklyDraftAvailable
                  ? 'Your academy can generate one young player this Sunday. The prospect will be shaped by academy level, squad level, reputation, form, talent probability, position need, nationality, personality, and potential.'
                  : smartMessage}
              </div>
              <button className="btn btn-primary btn-lg" disabled={!weeklyDraftAvailable} onClick={handleGenerateProspect} style={{ margin: '0 auto' }}>
                <Sparkles size={18} /> Generate Youth Prospect
              </button>
            </div>
          ) : (
            <>
              <ProspectCard
                player={currentProspect}
                actions={(
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                    <button className="btn btn-primary" onClick={() => handleProspectAction('promote', currentProspect)}><Send size={16} /> Promote</button>
                    <button className="btn btn-secondary" onClick={() => handleProspectAction('keep', currentProspect)}><ShieldCheck size={16} /> Keep</button>
                    <button className="btn btn-secondary" onClick={() => handleProspectAction('sell', currentProspect)}><DollarSign size={16} /> Sell</button>
                    <button className="btn btn-danger" onClick={() => handleProspectAction('release', currentProspect)}><UserMinus size={16} /> Terminate</button>
                  </div>
                )}
              />

              <div className="card" style={{ padding: 20 }}>
                <div className="card-title" style={{ marginBottom: 12 }}>Why This Level?</div>
                {[
                  ['Team average overall', currentProspect.report.teamAverageOverall],
                  ['Youth Academy level', `${currentProspect.report.academyLevel}/10`],
                  ['Team reputation', `${currentProspect.report.teamReputation}/100`],
                  ['Recent form', `${currentProspect.report.teamForm}/100`],
                  ['Talent roll', `${currentProspect.report.talentResult} (${currentProspect.report.adjustedTalentRoll}/100)`],
                  ['Final result', currentProspect.report.finalResult],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--border-card)' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>{label}</span>
                    <strong style={{ textAlign: 'right' }}>{value}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'prospects' && (
        academyPlayers.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {academyPlayers.map(player => (
              <ProspectCard
                key={player.id}
                player={player}
                actions={(
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={() => handleProspectAction('promote', player)}><Send size={14} /> Promote</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleProspectAction('sell', player)}><DollarSign size={14} /> Sell</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleProspectAction('release', player)}><XCircle size={14} /> Release</button>
                  </div>
                )}
              />
            ))}
          </div>
        ) : (
          <EmptyState icon={Users} title="No Academy Prospects" body="Keep a generated player in the academy to develop him over time." />
        )
      )}

      {activeTab === 'development' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
          <div className="card" style={{ padding: 22 }}>
            <div className="card-title" style={{ marginBottom: 8 }}>Weekly Development</div>
            <div style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 16 }}>
              Academy prospects improve once per Sunday. Their chance is based on Youth Academy level, Training Court level, and personality. Outcomes can include form gains, overall gains, rare potential gains, or no visible progress.
            </div>
            <div style={{ height: 10, background: 'var(--bg-muted)', borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: `${developmentChance}%`, height: '100%', background: 'var(--color-primary)' }} />
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Estimated base improvement chance: {developmentChance}%</div>
          </div>

          <div className="card" style={{ padding: 22 }}>
            <div className="card-title" style={{ marginBottom: 12 }}>Training Notes</div>
            {(youthDraft.developmentNotes ?? []).length ? (
              (youthDraft.developmentNotes ?? []).slice(0, 6).map(note => (
                <div key={`${note.week}-${note.timestamp}`} style={{ padding: '9px 0', borderBottom: '1px solid var(--border-card)', fontSize: 'var(--font-size-sm)' }}>
                  <strong>{note.week}</strong>
                  <div style={{ color: 'var(--text-muted)' }}>{note.text}</div>
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>No weekly development notes yet.</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        generatedHistory.length ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Nation</th>
                  <th>Pos</th>
                  <th>OVR</th>
                  <th>POT</th>
                  <th>Status</th>
                  <th>Week</th>
                </tr>
              </thead>
              <tbody>
                {generatedHistory.map((item, idx) => (
                  <tr key={`${item.id}-${item.status}-${idx}`}>
                    <td style={{ fontWeight: 800 }}>{item.name}</td>
                    <td>{item.nationality}</td>
                    <td>{item.position}</td>
                    <td>{item.overall}</td>
                    <td>{item.potential}</td>
                    <td><span className="badge badge-gray">{item.status}</span></td>
                    <td>{item.generatedWeek}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Clock} title="No History Yet" body="Generated, promoted, sold, and released academy players will appear here." />
        )
      )}
    </div>
  );
}
