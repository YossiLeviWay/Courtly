// ============================================================
// Courtly – Team Generator
// ============================================================

import { generatePlayer, calculateOverallRating } from './playerGenerator.js';
import {
  TEAM_CITY_PAIRS,
  TEAM_NICKNAMES,
  STADIUM_SUFFIXES,
  FIRST_NAMES_MALE,
  LAST_NAMES,
} from '../data/names.js';
import { STAFF_ROLES, STAFF_CHARACTERIZATIONS, FACILITY_NAMES } from '../data/constants.js';

// ── Utilities ─────────────────────────────────────────────────

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomSubset(arr, min, max) {
  const count = randomInt(min, max);
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

let _teamIdCounter = 0;
let _staffIdCounter = 0;

function generateTeamId() {
  _teamIdCounter++;
  const ts = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 6);
  return `team-${ts}-${r}-${_teamIdCounter}`;
}

function generateStaffId() {
  _staffIdCounter++;
  const ts = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 6);
  return `staff-${ts}-${r}-${_staffIdCounter}`;
}

// ── Color Palettes ────────────────────────────────────────────

const BOT_COLOR_PALETTES = [
  { primary: '#1a237e', secondary: '#ffb300' }, // Deep blue / amber
  { primary: '#1b5e20', secondary: '#f9a825' }, // Forest green / gold
  { primary: '#b71c1c', secondary: '#ffffff' }, // Crimson / white
  { primary: '#4a148c', secondary: '#f57f17' }, // Purple / orange
  { primary: '#006064', secondary: '#e0f7fa' }, // Teal / ice blue
  { primary: '#37474f', secondary: '#eceff1' }, // Slate / silver
  { primary: '#e65100', secondary: '#212121' }, // Burnt orange / black
  { primary: '#0d47a1', secondary: '#e3f2fd' }, // Royal blue / light blue
  { primary: '#880e4f', secondary: '#fce4ec' }, // Maroon / blush
  { primary: '#33691e', secondary: '#ccff90' }, // Olive / lime
];

const USER_COLORS = { primary: '#e65100', secondary: '#ffffff' }; // Orange theme

// ── Staff Ability Keys per Role ───────────────────────────────

const STAFF_ABILITY_KEYS = {
  'Head Coach':                    ['tacticalKnowledge', 'playerManagement', 'gamePlanning', 'motivation', 'adaptability'],
  'Assistant Coach':               ['tacticalKnowledge', 'playerDevelopment', 'scouting', 'communication'],
  'Physio':                        ['injuryPrevention', 'rehabilitation', 'fitnessAssessment', 'recoverySpeed'],
  'Scout':                         ['playerEvaluation', 'talentIdentification', 'marketKnowledge', 'networking'],
  'Psychologist':                  ['mentalConditioning', 'conflictResolution', 'motivation', 'playerWellbeing'],
  'Nutritionist':                  ['dietPlanning', 'recoveryOptimisation', 'performanceNutrition', 'supplementKnowledge'],
  'Strength & Conditioning Coach': ['strengthTraining', 'conditioningPrograms', 'athleteDevelopment', 'injuryPrevention'],
  'Data Analyst':                  ['statisticalAnalysis', 'gameFilmReview', 'opponentScouting', 'performanceMetrics'],
  'Team Manager':                  ['logistics', 'budgetManagement', 'staffCoordination', 'communication'],
};

// ── Biography Generator ───────────────────────────────────────

const BIO_SNIPPETS = {
  'Head Coach':                    ['A tactician with years on the sideline', 'Known for innovative offensive systems', 'Built a reputation for developing young talent'],
  'Assistant Coach':               ['A loyal right-hand who handles player relations', 'Specialises in breaking down game film', 'Former point guard turned coach'],
  'Physio':                        ['Keeps players on the court and out of the treatment room', 'Respected for fast recovery protocols', 'Brings experience from elite international sports'],
  'Scout':                         ['Has an eye for raw talent across five continents', 'Known for finding hidden gems in lower leagues', 'Travels thousands of miles each season in search of the next star'],
  'Psychologist':                  ['Helps players unlock their mental edge', 'Specialises in high-performance mindset coaching', 'Known for turning around struggling careers'],
  'Nutritionist':                  ['Designs fuelling plans tailored to every player', 'Advocates evidence-based sports nutrition', 'Helped multiple athletes reach peak physical condition'],
  'Strength & Conditioning Coach': ['Pushes players to their physical limits safely', 'Developed conditioning programmes used at elite academies', 'Believes in long-term athletic development'],
  'Data Analyst':                  ['Turns match data into actionable coaching insights', 'Built the team\'s advanced scouting database', 'Former software engineer turned sports analyst'],
  'Team Manager':                  ['Keeps everything running smoothly behind the scenes', 'Experienced in managing complex travel logistics', 'Ensures the squad is always prepared and focused'],
};

// ── Staff Generator ───────────────────────────────────────────

/**
 * Generate a single staff member for the given role.
 * @param {string} role - One of STAFF_ROLES
 * @returns {Object} staff member object
 */
export function generateStaffMember(role) {
  const abilityKeys = STAFF_ABILITY_KEYS[role] ?? ['generalSkill'];
  const abilities = {};
  for (const key of abilityKeys) {
    abilities[key] = randomInt(30, 70);
  }

  const bioPool = BIO_SNIPPETS[role] ?? ['A dedicated professional with years of experience.'];
  const bio = randomFrom(bioPool) + '.';

  const avatarType = Math.random() < 0.5 ? 'animals' : 'monuments';
  const avatarOptions = avatarType === 'animals'
    ? ['bear', 'wolf', 'eagle', 'tiger', 'fox']
    : ['pyramid', 'colosseum', 'tower', 'castle', 'lighthouse'];

  return {
    id: generateStaffId(),
    name: `${randomFrom(FIRST_NAMES_MALE)} ${randomFrom(LAST_NAMES)}`,
    role,
    age: randomInt(30, 60),
    characterizations: randomSubset(STAFF_CHARACTERIZATIONS, 2, 3),
    abilities,
    motivation: randomInt(60, 90),
    salary: randomInt(3, 15),
    avatar: { type: avatarType, value: randomFrom(avatarOptions) },
    biography: bio,
  };
}

// ── Roster Composition ────────────────────────────────────────

// Generate a balanced 15-player roster: 3 per position
function generateRoster(overrideLevel) {
  const positions = ['PG', 'PG', 'PG', 'SG', 'SG', 'SG', 'SF', 'SF', 'SF', 'PF', 'PF', 'PF', 'C', 'C', 'C'];
  return positions.map((pos) =>
    generatePlayer({ position: pos, overrideLevel })
  );
}

// ── Default Tactics ───────────────────────────────────────────

function defaultTactics() {
  return {
    offensiveScheme: 'Motion Offense',
    defensiveScheme: 'Man-to-Man',
    pace: 50,           // 0=slow, 100=fast
    threePointFocus: 50,
    insideOutside: 50,  // 0=inside, 100=outside
    pressureDefense: 30,
    helpDefenseIntensity: 50,
    rotationStrategy: 'Standard',
    clutchTimeoutUsage: 'Aggressive',
  };
}

// ── Facilities ────────────────────────────────────────────────

function defaultFacilities() {
  const obj = {};
  for (const name of FACILITY_NAMES) {
    obj[name] = { level: 0, upgradeInProgress: false, upgradeCompletesAt: null };
  }
  return obj;
}

// ── Team ID uniqueness helper (tracks used city-nickname combos) ──

const _usedTeamNames = new Set();

function pickUniqueTeamName(cityPairs, nicknames) {
  let attempts = 0;
  while (attempts < 100) {
    const cityPair = randomFrom(cityPairs);
    const nickname = randomFrom(nicknames);
    const fullName = `${cityPair.city} ${nickname}`;
    if (!_usedTeamNames.has(fullName)) {
      _usedTeamNames.add(fullName);
      return { cityPair, nickname, fullName };
    }
    attempts++;
  }
  // Fallback: allow duplicate if exhausted
  const cityPair = randomFrom(cityPairs);
  const nickname = randomFrom(nicknames);
  return { cityPair, nickname, fullName: `${cityPair.city} ${nickname}` };
}

// ── Team Generator ────────────────────────────────────────────

/**
 * Generate a complete team object.
 * @param {Object} options
 * @param {boolean} [options.isUserTeam=false]
 * @param {string} [options.league='C']
 * @param {number} [options.leagueIndex=0] - Which Liga C group (0-4)
 * @param {Object} [options.cityPair] - Override city selection
 * @param {number} [options.playerLevel] - Override player attribute level
 * @returns {Object} complete team object
 */
export function generateTeam(options = {}) {
  const isUserTeam = options.isUserTeam ?? false;
  const league = options.league ?? 'C';
  const leagueIndex = options.leagueIndex ?? 0;

  const { cityPair, nickname, fullName } = pickUniqueTeamName(TEAM_CITY_PAIRS, TEAM_NICKNAMES);

  const suffix = randomFrom(STADIUM_SUFFIXES);
  // Stadium named after city or nickname
  const stadiumName = Math.random() < 0.5
    ? `${cityPair.city} ${suffix}`
    : `${nickname} ${suffix}`;

  const colors = isUserTeam
    ? { ...USER_COLORS }
    : randomFrom(BOT_COLOR_PALETTES);

  const budget = isUserTeam ? 200 : randomInt(150, 250);
  const playerLevel = options.playerLevel ?? randomInt(38, 62);

  const players = generateRoster(playerLevel);

  // Build staff object keyed by role
  const staff = {};
  for (const role of STAFF_ROLES) {
    staff[role] = generateStaffMember(role);
  }

  return {
    id: generateTeamId(),
    name: fullName,
    nickname,
    city: cityPair.city,
    country: cityPair.country,
    region: cityPair.region,
    stadiumName,
    founded: randomInt(1950, 2010),
    colors,
    budget,
    league,
    leagueIndex,
    players,
    staff,
    tactics: defaultTactics(),
    facilities: defaultFacilities(),
    seasonRecord: { wins: 0, losses: 0 },
    overallRecord: { wins: 0, losses: 0 },
    motivationBar: 65,
    momentumBar: 65,
    chemistryGauge: 50,
    fanCount: 250,
    fanEnthusiasm: 20,
    reputation: 10,
    matchHistory: [],
    nextMatchDate: null,
    seasonMatches: [],
    isUserTeam,
  };
}

// ── League Generator ──────────────────────────────────────────

// Partition city pairs by region for variety
const REGION_BUCKETS = {
  Americas: TEAM_CITY_PAIRS.filter((c) => c.region === 'Americas'),
  Europe:   TEAM_CITY_PAIRS.filter((c) => c.region === 'Europe'),
  Africa:   TEAM_CITY_PAIRS.filter((c) => c.region === 'Africa'),
  Asia:     TEAM_CITY_PAIRS.filter((c) => c.region === 'Asia' || c.region === 'Oceania'),
};

const REGION_KEYS = Object.keys(REGION_BUCKETS);

/**
 * Generate 5 Liga C leagues, each containing 10 bot teams.
 * Teams are drawn from diverse world regions for variety.
 * @returns {Array} Array of 5 league objects, each with { id, name, teams }
 */
export function generateLeagues() {
  const leagues = [];

  for (let i = 0; i < 5; i++) {
    const teams = [];
    // Assign roughly 2-3 teams per region across 10 slots
    for (let j = 0; j < 10; j++) {
      // Cycle through regions so each league has geographic variety
      const regionKey = REGION_KEYS[j % REGION_KEYS.length];
      const team = generateTeam({
        isUserTeam: false,
        league: 'C',
        leagueIndex: i,
      });
      teams.push(team);
    }

    leagues.push({
      id: `liga-c-${i}`,
      name: `Liga C – Group ${i + 1}`,
      tier: 'C',
      groupIndex: i,
      teams,
      schedule: [],
      standings: teams.map((t) => ({
        teamId: t.id,
        teamName: t.name,
        wins: 0,
        losses: 0,
        points: 0,
      })),
    });
  }

  return leagues;
}
