// ============================================================
// Courtly – Player Generator
// ============================================================

import {
  POSITIONS,
  PLAYER_PERSONALITIES,
  NATIONALITIES,
  ATTRIBUTE_NAMES,
  AVATAR_TYPES,
} from '../data/constants.js';
import { FIRST_NAMES_MALE, LAST_NAMES } from '../data/names.js';

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

let _idCounter = 0;
function generateId() {
  _idCounter++;
  const timestamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `player-${timestamp}-${rand}-${_idCounter}`;
}

function weightedAge() {
  // Weighted toward 22-28
  const roll = Math.random();
  if (roll < 0.1) return randomInt(19, 21);
  if (roll < 0.7) return randomInt(22, 28);
  if (roll < 0.9) return randomInt(29, 32);
  return randomInt(33, 35);
}

function dateOfBirthFromAge(age) {
  const today = new Date();
  const birthYear = today.getFullYear() - age;
  const birthMonth = randomInt(1, 12);
  const birthDay = randomInt(1, 28);
  return `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;
}

// ── Height & Weight by Position ───────────────────────────────

const HEIGHT_RANGES_CM = {
  PG: [175, 195],
  SG: [185, 200],
  SF: [195, 208],
  PF: [203, 213],
  C:  [208, 220],
};

const WEIGHT_RANGES_KG = {
  PG: [75, 90],
  SG: [85, 100],
  SF: [95, 110],
  PF: [105, 120],
  C:  [110, 130],
};

function generateHeight(position) {
  const [min, max] = HEIGHT_RANGES_CM[position];
  const cm = randomInt(min, max);
  const totalInches = Math.round(cm / 2.54);
  const ft = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return { cm, ft, inches };
}

function generateWeight(position) {
  const [min, max] = WEIGHT_RANGES_KG[position];
  const kg = randomInt(min, max);
  const lbs = Math.round(kg * 2.2046);
  return { kg, lbs };
}

// ── Attribute Generation ──────────────────────────────────────

// Positional weighting: attributes that matter most per position get higher base values
const POSITION_ATTRIBUTE_WEIGHTS = {
  PG: {
    courtVision:           1.4,
    ballHandlingDribbling: 1.4,
    passingAccuracy:       1.4,
    basketballIQ:          1.3,
    agilityLateralSpeed:   1.2,
    threePtShooting:       1.1,
    onBallScreenNavigation:1.1,
    perimeterDefense:      1.0,
    leadershipCommunication:1.2,
    patienceOffense:       1.1,
    handlePressureMental:  1.1,
    offBallMovement:       0.9,
    interiorDefense:       0.6,
    postMoves:             0.5,
    rebounding:            0.7,
    settingScreens:        0.7,
    finishingAtTheRim:     0.9,
  },
  SG: {
    threePtShooting:       1.4,
    midRangeScoring:       1.3,
    offBallMovement:       1.2,
    perimeterDefense:      1.2,
    agilityLateralSpeed:   1.2,
    ballHandlingDribbling: 1.1,
    finishingAtTheRim:     1.1,
    aggressivenessOffensive:1.1,
    clutchPerformance:     1.1,
    freeThrowShooting:     1.0,
    interiorDefense:       0.7,
    postMoves:             0.6,
    rebounding:            0.8,
    settingScreens:        0.7,
  },
  SF: {
    midRangeScoring:       1.2,
    threePtShooting:       1.1,
    finishingAtTheRim:     1.2,
    rebounding:            1.1,
    perimeterDefense:      1.1,
    helpDefense:           1.1,
    offBallMovement:       1.1,
    aggressivenessOffensive:1.1,
    verticalLeapingAbility:1.1,
    bodyControl:           1.1,
    postMoves:             0.9,
    interiorDefense:       0.9,
    settingScreens:        0.9,
  },
  PF: {
    rebounding:            1.4,
    interiorDefense:       1.3,
    postMoves:             1.2,
    settingScreens:        1.2,
    finishingAtTheRim:     1.2,
    helpDefense:           1.2,
    verticalLeapingAbility:1.1,
    staminaEndurance:      1.1,
    aggressivenessOffensive:1.1,
    threePtShooting:       0.8,
    ballHandlingDribbling: 0.7,
    agilityLateralSpeed:   0.9,
    passingAccuracy:       0.8,
  },
  C:  {
    rebounding:            1.5,
    interiorDefense:       1.5,
    postMoves:             1.3,
    settingScreens:        1.3,
    finishingAtTheRim:     1.3,
    helpDefense:           1.3,
    verticalLeapingAbility:1.2,
    staminaEndurance:      1.1,
    aggressivenessOffensive:1.1,
    threePtShooting:       0.5,
    ballHandlingDribbling: 0.5,
    agilityLateralSpeed:   0.7,
    passingAccuracy:       0.7,
    courtVision:           0.8,
  },
};

/**
 * Generate all 30 attributes weighted for the given position.
 * @param {string} position - One of POSITIONS
 * @param {number} baseLevel - Centre value for attribute range (default 52)
 * @returns {Object} attribute map
 */
export function generatePositionalAttributes(position, baseLevel = 52) {
  const weights = POSITION_ATTRIBUTE_WEIGHTS[position] || {};
  const attrKeys = Object.keys(ATTRIBUTE_NAMES);
  const attrs = {};

  for (const key of attrKeys) {
    const weight = weights[key] ?? 1.0;
    // Spread: baseLevel ± 15, shifted by weight
    const centre = Math.min(99, Math.max(30, Math.round(baseLevel * weight)));
    const spread = 12;
    const raw = randomInt(Math.max(30, centre - spread), Math.min(99, centre + spread));
    attrs[key] = raw;
  }

  return attrs;
}

// ── Salary by Overall Rating ──────────────────────────────────

function salaryFromRating(overall) {
  // Returns annual salary in $k
  if (overall >= 85) return randomInt(18, 30);
  if (overall >= 75) return randomInt(10, 18);
  if (overall >= 65) return randomInt(5, 10);
  if (overall >= 55) return randomInt(2, 5);
  return randomInt(1, 2);
}

// ── Overall Rating Calculation ────────────────────────────────

// Key attributes per position for overall rating calculation
const OVERALL_KEYS = {
  PG: [
    'courtVision', 'ballHandlingDribbling', 'passingAccuracy', 'basketballIQ',
    'threePtShooting', 'perimeterDefense', 'agilityLateralSpeed',
    'clutchPerformance', 'leadershipCommunication', 'handlePressureMental',
  ],
  SG: [
    'threePtShooting', 'midRangeScoring', 'offBallMovement', 'perimeterDefense',
    'ballHandlingDribbling', 'finishingAtTheRim', 'aggressivenessOffensive',
    'clutchPerformance', 'freeThrowShooting', 'agilityLateralSpeed',
  ],
  SF: [
    'midRangeScoring', 'threePtShooting', 'finishingAtTheRim', 'rebounding',
    'perimeterDefense', 'helpDefense', 'offBallMovement', 'aggressivenessOffensive',
    'verticalLeapingAbility', 'bodyControl',
  ],
  PF: [
    'rebounding', 'interiorDefense', 'postMoves', 'settingScreens',
    'finishingAtTheRim', 'helpDefense', 'verticalLeapingAbility',
    'staminaEndurance', 'aggressivenessOffensive', 'disciplineFouling',
  ],
  C: [
    'rebounding', 'interiorDefense', 'postMoves', 'settingScreens',
    'finishingAtTheRim', 'helpDefense', 'verticalLeapingAbility',
    'staminaEndurance', 'aggressivenessOffensive', 'conditioningFitness',
  ],
};

/**
 * Calculate a player's overall rating based on their position and attributes.
 * @param {Object} player - Player object with .position and .attributes
 * @returns {number} overall rating 1-99
 */
export function calculateOverallRating(player) {
  const keys = OVERALL_KEYS[player.position] ?? Object.keys(ATTRIBUTE_NAMES);
  const attrs = player.attributes;
  if (!attrs) return 50;

  let total = 0;
  let count = 0;
  for (const key of keys) {
    if (attrs[key] !== undefined) {
      total += attrs[key];
      count++;
    }
  }

  const avg = count > 0 ? total / count : 50;
  return Math.min(99, Math.max(1, Math.round(avg)));
}

// ── Random Avatar ─────────────────────────────────────────────

function randomAvatar() {
  const type = Math.random() < 0.5 ? 'animals' : 'monuments';
  const options = AVATAR_TYPES[type];
  return { type, value: randomFrom(options) };
}

// ── Main Generator ────────────────────────────────────────────

/**
 * Generate a complete player object.
 * @param {Object} options
 * @param {string} [options.position] - Force a specific position
 * @param {number} [options.overrideLevel] - Override base attribute level (30-90)
 * @param {boolean} [options.forUserTeam] - Slightly higher stats if true
 * @returns {Object} complete player object
 */
export function generatePlayer(options = {}) {
  const position = options.position ?? randomFrom(POSITIONS);
  const baseLevel = options.overrideLevel ?? randomInt(38, 62);

  const attributes = generatePositionalAttributes(position, baseLevel);

  // Build a minimal player shell to pass into calculateOverallRating
  const shell = { position, attributes };
  const overallRating = calculateOverallRating(shell);

  const age = weightedAge();
  const personality = randomSubset(PLAYER_PERSONALITIES, 1, 2);
  const attrKeys = Object.keys(ATTRIBUTE_NAMES);
  const specialAbility = randomFrom(attrKeys);

  return {
    id: generateId(),
    name: `${randomFrom(FIRST_NAMES_MALE)} ${randomFrom(LAST_NAMES)}`,
    age,
    dateOfBirth: dateOfBirthFromAge(age),
    nationality: randomFrom(NATIONALITIES),
    position,
    height: generateHeight(position),
    weight: generateWeight(position),
    personality,
    specialAbility,
    attributes,
    overallRating,
    fatigue: randomInt(0, 20),
    motivation: randomInt(60, 90),
    injuryStatus: 'healthy',
    injuryDaysRemaining: 0,
    minutesThisSeason: 0,
    gamesPlayed: 0,
    seasonStats: {
      points: 0,
      assists: 0,
      rebounds: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      fouls: 0,
      minutesPlayed: 0,
      gamesPlayed: 0,
      fgAttempts: 0,
      fgMade: 0,
      ftAttempts: 0,
      ftMade: 0,
      threePtAttempts: 0,
      threePtMade: 0,
    },
    careerStats: {
      points: 0,
      assists: 0,
      rebounds: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      fouls: 0,
      minutesPlayed: 0,
      gamesPlayed: 0,
      fgAttempts: 0,
      fgMade: 0,
      ftAttempts: 0,
      ftMade: 0,
      threePtAttempts: 0,
      threePtMade: 0,
    },
    avatar: randomAvatar(),
    contractYears: randomInt(1, 4),
    salary: salaryFromRating(overallRating),
    isCaptain: false,
    isViceCaptain: false,
    isOnTransferMarket: false,
    lastFormRating: randomInt(50, 80),
    eventPoints: 0,
  };
}
