// ============================================================
// Courtly – Match Simulation Engine
// ============================================================

// ── Constants ─────────────────────────────────────────────────

/**
 * Total real-time duration of a simulated game in seconds (~115 min).
 * Q1 0-1500s | Q2 1500-3000s | Halftime 3000-3900s | Q3 3900-5400s | Q4 5400-6900s
 */
export const GAME_DURATION_SEC = 6900;

/**
 * Convert a game-minute + quarter to real elapsed seconds from tip-off.
 * Used to stamp every event so the Live viewer can reveal them in real-time.
 */
export function gameMinToRelSec(gameMin, quarter) {
  const q = Math.min(Math.max((quarter || 1) - 1, 0), 3);
  const qRealStart = [0, 1500, 3900, 5400]; // real-second start of each quarter
  const minInQ = Math.max(0, Math.min(gameMin - q * 10, 10));
  return Math.round(qRealStart[q] + (minInQ / 10) * 1500);
}

// ── Seeded RNG (deterministic per-match) ─────────────────────
// A module-level rng function is set at the start of each simulateMatch call.
// This makes every match's outcome permanently deterministic for the same matchId,
// regardless of how many times the simulation runs.

let _rng = Math.random; // default; overridden inside simulateMatch

function _hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return Math.abs(h) || 1;
}

function _mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function randomInt(min, max) {
  return Math.floor(_rng() * (max - min + 1)) + min;
}

function randomFrom(arr) {
  return arr[Math.floor(_rng() * arr.length)];
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

/** Pick a random active (non-injured, on roster) player from a team. */
function pickPlayer(team) {
  const active = team.players.filter((p) => p.injuryStatus === 'healthy' || p.injuryStatus === 'minor');
  if (active.length === 0) return team.players[0];
  return randomFrom(active);
}

/** Get a team's "attack strength" factor (0.5–1.5) */
function teamAttackFactor(team) {
  const players = team.players ?? [];
  if (players.length === 0) return 1.0;

  // Average key offensive attributes
  const offKeys = ['threePtShooting', 'midRangeScoring', 'finishingAtTheRim', 'passingAccuracy', 'basketballIQ'];
  let total = 0;
  let count = 0;
  for (const p of players) {
    for (const key of offKeys) {
      if (p.attributes?.[key] != null) {
        total += p.attributes[key];
        count++;
      }
    }
  }
  const avg = count > 0 ? total / count : 55;
  let factor = 0.7 + ((avg - 30) / 60) * 0.6;

  // recentForm bonus: each player's form (-5..+5) adds a small modifier
  const avgForm = players.reduce((s, p) => s + (p.recentForm ?? 0), 0) / Math.max(players.length, 1);
  factor += clamp(avgForm * 0.01, -0.05, 0.05);

  // Tactics modifier
  const style = team.tactics?.playingStyle;
  if (style === 'Fast Break') {
    factor *= 1.08;
  } else if (style === 'Isolation') {
    const topOVR = players.reduce((best, p) => Math.max(best, p.overall ?? p.attributes?.basketballIQ ?? 70), 0);
    factor *= topOVR >= 80 ? 1.12 : 0.95;
  } else if (style === 'Triangle Offense') {
    const avgIQ = players.reduce((s, p) => s + (p.attributes?.basketballIQ ?? 60), 0) / Math.max(players.length, 1);
    if (avgIQ >= 65) factor *= 1.07;
  } else if (style === 'Post-Up') {
    // Post-Up rewards interior scorers
    const avgFinish = players.reduce((s, p) => s + (p.attributes?.finishingAtTheRim ?? 60), 0) / Math.max(players.length, 1);
    if (avgFinish >= 65) factor *= 1.06;
  }

  // Pace modifier
  const pace = team.tactics?.paceControl;
  if (pace === 'Up-tempo') factor *= 1.05;
  else if (pace === 'Slow') factor *= 0.95;

  // Seven Seconds or Less: extreme up-tempo attack boost
  if (team.tactics?.sevenSeconds) {
    factor *= 1.12;
  }

  // Crash the Glass: second-chance points boost offense slightly
  if (team.tactics?.crashGlass) {
    factor *= 1.04;
  }

  return clamp(factor, 0.5, 1.6);
}

/** Get a team's "defense strength" factor (0.5–1.5) */
function teamDefenseFactor(team) {
  const players = team.players ?? [];
  if (players.length === 0) return 1.0;

  const defKeys = ['perimeterDefense', 'interiorDefense', 'helpDefense', 'disciplineFouling', 'rebounding'];
  let total = 0;
  let count = 0;
  for (const p of players) {
    for (const key of defKeys) {
      if (p.attributes?.[key] != null) {
        total += p.attributes[key];
        count++;
      }
    }
  }
  const avg = count > 0 ? total / count : 55;
  let factor = 0.7 + ((avg - 30) / 60) * 0.6;

  // Tactics modifier
  const style = team.tactics?.playingStyle;
  if (style === 'Fast Break') {
    factor *= 0.95; // aggressive offense sacrifices some D
  } else if (style === 'Motion Offense') {
    factor *= 0.97; // slight D sacrifice for motion
  }

  // Closeout strategy
  const closeout = team.tactics?.closeoutStrategy;
  if (closeout === 'Aggressive') factor *= 1.06;
  else if (closeout === 'Protect Lead') factor *= 1.03;

  // Protect the Paint: interior defense boost
  if (team.tactics?.protectPaint) {
    factor *= 1.10;
  }

  // Seven Seconds or Less: defense penalty for all-out attack
  if (team.tactics?.sevenSeconds) {
    factor *= 0.88;
  }

  // Crash the Glass: weaker transition defense
  if (team.tactics?.crashGlass) {
    factor *= 0.93;
  }

  return clamp(factor, 0.5, 1.6);
}

/** Motivation / chemistry modifier (0.85–1.15) */
function teamMoodModifier(team) {
  const motivation = team.motivationBar ?? 65;
  const chemistry = team.chemistryGauge ?? 50;
  const combined = (motivation + chemistry) / 2; // 0-100
  return 0.85 + (combined / 100) * 0.30;
}

// ── Stat Accumulators ─────────────────────────────────────────

function emptyPlayerMatchStats(player) {
  return {
    playerId: player.id,
    playerName: player.name,
    position: player.position,
    points: 0,
    assists: 0,
    rebounds: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
    minutesPlayed: 0,
    fgAttempts: 0,
    fgMade: 0,
    ftAttempts: 0,
    ftMade: 0,
    threePtAttempts: 0,
    threePtMade: 0,
  };
}

function buildStatMap(team) {
  const map = {};
  for (const p of team.players) {
    map[p.id] = emptyPlayerMatchStats(p);
  }
  return map;
}

// ── Score Simulation ──────────────────────────────────────────

/**
 * Simulate the raw score for a quarter or half.
 * Returns { home, away } points scored in that segment.
 */
function simulateSegmentScore(homeTeam, awayTeam, minutes) {
  const homeAtk = teamAttackFactor(homeTeam) * teamMoodModifier(homeTeam);
  const awayAtk = teamAttackFactor(awayTeam) * teamMoodModifier(awayTeam);
  const homeDef = teamDefenseFactor(homeTeam) * teamMoodModifier(homeTeam);
  const awayDef = teamDefenseFactor(awayTeam) * teamMoodModifier(awayTeam);

  // Home advantage
  const homeAdvantage = 1.05;

  // Possessions per minute ≈ 2.2 (each team)
  const possessions = Math.round(minutes * 2.2);

  let homePoints = 0;
  let awayPoints = 0;

  for (let i = 0; i < possessions; i++) {
    // Home possession
    const homeShotQuality = (homeAtk * homeAdvantage) / awayDef;
    homePoints += simulatePossession(homeShotQuality);

    // Away possession
    const awayShotQuality = awayAtk / homeDef;
    awayPoints += simulatePossession(awayShotQuality);
  }

  return { home: homePoints, away: awayPoints };
}

/**
 * Simulate a single possession. Returns points scored (0, 1, 2, or 3).
 * shotQuality: ~0.7-1.4 range
 */
function simulatePossession(shotQuality) {
  const turnoverChance = clamp(0.15 - (shotQuality - 1) * 0.05, 0.05, 0.25);
  if (_rng() < turnoverChance) return 0;

  const roll = _rng();
  // Distributes: ~20% three-point attempts, ~55% two-point, ~25% FT trips
  if (roll < 0.20) {
    // Three-point attempt
    const made = _rng() < clamp(0.30 * shotQuality, 0.15, 0.55);
    return made ? 3 : 0;
  } else if (roll < 0.75) {
    // Two-point attempt (includes layups/dunks/mid-range)
    const made = _rng() < clamp(0.48 * shotQuality, 0.25, 0.72);
    if (made) {
      // And-one?
      if (_rng() < 0.08) {
        return 2 + (_rng() < 0.75 ? 1 : 0);
      }
      return 2;
    }
    return 0;
  } else {
    // Free throw trip
    const ft1 = _rng() < clamp(0.72 * shotQuality, 0.50, 0.92);
    const ft2 = _rng() < clamp(0.72 * shotQuality, 0.50, 0.92);
    return (ft1 ? 1 : 0) + (ft2 ? 1 : 0);
  }
}

// ── Event Generation ──────────────────────────────────────────

const DUNK_DESCRIPTIONS = [
  '{player} rises up and THROWS IT DOWN!',
  '{player} with a thunderous two-handed slam!',
  '{player} posterises the defender for a massive dunk!',
  '{player} catches the lob and hammers it home!',
  'BOOM! {player} with an emphatic finish at the rim!',
];

const LAYUP_DESCRIPTIONS = [
  '{player} glides in for the finger roll!',
  '{player} splits the defense and lays it in softly.',
  '{player} with a quick drive and a smooth layup.',
  '{player} converts the reverse layup!',
  'Clever footwork from {player} for the easy two.',
];

const THREE_DESCRIPTIONS = [
  '{player} steps back and drains the triple!',
  'SPLASH! {player} from well beyond the arc!',
  '{player} fires from the corner — BANG, three!',
  'Ice in the veins from {player}! Triple!',
  '{player} pulls up from deep — it\'s good!',
];

const MIDRANGE_DESCRIPTIONS = [
  '{player} hits the mid-range jumper!',
  '{player} with the pull-up from 18 feet.',
  'Textbook form from {player} — mid-range money.',
  '{player} fades away and hits the jumper!',
];

const STEAL_DESCRIPTIONS = [
  '{player} reads the pass and picks the pocket!',
  'Quickhands from {player} — steal and push!',
  '{player} strips the ball and the crowd erupts!',
];

const BLOCK_DESCRIPTIONS = [
  '{player} rejects the shot at the rim!',
  'DENIED! {player} with the emphatic block!',
  '{player} sends it into the third row!',
];

const FOUL_DESCRIPTIONS = [
  '{player} picks up a foul. Referee calls it quickly.',
  'Whistled on {player} — that\'s a personal foul.',
  '{player} reaches in and the referee blows the whistle.',
];

const TURNOVER_DESCRIPTIONS = [
  '{player} turns it over — sloppy possession.',
  'Bad pass from {player}. Turnover.',
  '{player} dribbles off their own foot. Turnover.',
  'Ball knocked away — {player} coughs it up.',
];

const TIMEOUT_DESCRIPTIONS = [
  '{team} calls a timeout to regroup.',
  'Timeout on the floor — {team} needs a breather.',
  '{team}\'s bench calls for a stoppage.',
];

const INJURY_DESCRIPTIONS = [
  '{player} goes down clutching their ankle — looks painful.',
  '{player} takes a hard foul and stays on the floor. Medical staff attending.',
  '{player} is helped off the court — possible injury.',
];

const FIGHT_DESCRIPTIONS = [
  'Tempers flare! {player} and an opponent jaw at each other — officials step in.',
  'A scuffle breaks out near the paint! {player} is restrained by teammates.',
  'Pushing and shoving after the whistle — {player} is involved in the altercation.',
];

const TECHNICAL_DESCRIPTIONS = [
  '{player} argues the call and receives a technical foul!',
  'Technical foul on {player} — too much jawing at the referee.',
  'The referee has seen enough — technical on {player}.',
];

const COMEBACK_DESCRIPTIONS = [
  '{team} storms back! They\'re cutting into the lead!',
  'Incredible run from {team} — this game is not over!',
  '{team} with a 7-0 burst to get back in it!',
];

function fillTemplate(template, player, team) {
  return template
    .replace('{player}', player?.name ?? 'Unknown')
    .replace('{team}', team?.name ?? 'The team');
}

function generateHighlightEvents(homeTeam, awayTeam, quarterScores) {
  const events = [];
  const totalMinutes = 40;
  const quarterLength = 10;

  // Track running score for context
  let homeRunning = 0;
  let awayRunning = 0;
  let homeTOsLeft = [2, 2]; // timeouts per half [0]=first half, [1]=second half
  let awayTOsLeft = [2, 2];
  let homeFoulsThisQuarter = 0;
  let awayFoulsThisQuarter = 0;
  let eventId = 0;

  // Game start event
  events.push({
    id: eventId++,
    time: 0,
    type: 'game_start',
    description: `🏀 Tip-off! ${homeTeam.name} host ${awayTeam.name}. The crowd is ready — let's play!`,
    player: null, playerId: null,
    team: homeTeam.name, teamId: homeTeam.id,
    score: '0-0', quarter: 1, relativeTime: 0,
  });

  const quarterStarts = [0, 10, 20, 30];
  const scoringEvents = 35; // target total highlight events
  const eventsPerQuarter = Math.ceil(scoringEvents / 4);

  for (let q = 0; q < 4; q++) {
    const qStart = quarterStarts[q];
    const qScore = quarterScores[q];
    homeRunning += qScore.home;
    awayRunning += qScore.away;

    homeFoulsThisQuarter = 0;
    awayFoulsThisQuarter = 0;

    // Spread events within the quarter
    const minuteSlots = [];
    for (let i = 0; i < eventsPerQuarter; i++) {
      minuteSlots.push(parseFloat((qStart + _rng() * quarterLength).toFixed(1)));
    }
    minuteSlots.sort((a, b) => a - b);

    for (const minute of minuteSlots) {
      eventId++;
      const roll = _rng();
      let event;

      if (roll < 0.22) {
        // Three pointer
        const team = _rng() < 0.5 ? homeTeam : awayTeam;
        const player = pickPlayer(team);
        event = {
          id: eventId,
          time: minute,
          type: 'three_pointer',
          description: fillTemplate(randomFrom(THREE_DESCRIPTIONS), player, team),
          player: player.name,
          playerId: player.id,
          team: team.name,
          teamId: team.id,
          score: `${homeRunning}-${awayRunning}`,
          quarter: q + 1,
        };
      } else if (roll < 0.42) {
        // Dunk
        const team = _rng() < 0.5 ? homeTeam : awayTeam;
        const player = pickPlayer(team);
        event = {
          id: eventId,
          time: minute,
          type: 'dunk',
          description: fillTemplate(randomFrom(DUNK_DESCRIPTIONS), player, team),
          player: player.name,
          playerId: player.id,
          team: team.name,
          teamId: team.id,
          score: `${homeRunning}-${awayRunning}`,
          quarter: q + 1,
        };
      } else if (roll < 0.55) {
        // Layup
        const team = _rng() < 0.5 ? homeTeam : awayTeam;
        const player = pickPlayer(team);
        event = {
          id: eventId,
          time: minute,
          type: 'layup',
          description: fillTemplate(randomFrom(LAYUP_DESCRIPTIONS), player, team),
          player: player.name,
          playerId: player.id,
          team: team.name,
          teamId: team.id,
          score: `${homeRunning}-${awayRunning}`,
          quarter: q + 1,
        };
      } else if (roll < 0.63) {
        // Foul
        const team = _rng() < 0.5 ? homeTeam : awayTeam;
        const player = pickPlayer(team);
        if (team === homeTeam) homeFoulsThisQuarter++;
        else awayFoulsThisQuarter++;
        event = {
          id: eventId,
          time: minute,
          type: 'foul',
          description: fillTemplate(randomFrom(FOUL_DESCRIPTIONS), player, team),
          player: player.name,
          playerId: player.id,
          team: team.name,
          teamId: team.id,
          score: `${homeRunning}-${awayRunning}`,
          quarter: q + 1,
        };
      } else if (roll < 0.70) {
        // Turnover
        const team = _rng() < 0.5 ? homeTeam : awayTeam;
        const player = pickPlayer(team);
        event = {
          id: eventId,
          time: minute,
          type: 'turnover',
          description: fillTemplate(randomFrom(TURNOVER_DESCRIPTIONS), player, team),
          player: player.name,
          playerId: player.id,
          team: team.name,
          teamId: team.id,
          score: `${homeRunning}-${awayRunning}`,
          quarter: q + 1,
        };
      } else if (roll < 0.75) {
        // Steal
        const team = _rng() < 0.5 ? homeTeam : awayTeam;
        const player = pickPlayer(team);
        event = {
          id: eventId,
          time: minute,
          type: 'steal',
          description: fillTemplate(randomFrom(STEAL_DESCRIPTIONS), player, team),
          player: player.name,
          playerId: player.id,
          team: team.name,
          teamId: team.id,
          score: `${homeRunning}-${awayRunning}`,
          quarter: q + 1,
        };
      } else if (roll < 0.79) {
        // Block
        const team = _rng() < 0.5 ? homeTeam : awayTeam;
        const player = pickPlayer(team);
        event = {
          id: eventId,
          time: minute,
          type: 'block',
          description: fillTemplate(randomFrom(BLOCK_DESCRIPTIONS), player, team),
          player: player.name,
          playerId: player.id,
          team: team.name,
          teamId: team.id,
          score: `${homeRunning}-${awayRunning}`,
          quarter: q + 1,
        };
      } else if (roll < 0.84) {
        // Timeout
        const halfIdx = q < 2 ? 0 : 1;
        let team, teamTOs;
        if (_rng() < 0.5 && homeTOsLeft[halfIdx] > 0) {
          team = homeTeam; homeTOsLeft[halfIdx]--;
        } else if (awayTOsLeft[halfIdx] > 0) {
          team = awayTeam; awayTOsLeft[halfIdx]--;
        } else {
          team = homeTeam;
        }
        event = {
          id: eventId,
          time: minute,
          type: 'timeout',
          description: fillTemplate(randomFrom(TIMEOUT_DESCRIPTIONS), null, team),
          player: null,
          playerId: null,
          team: team.name,
          teamId: team.id,
          score: `${homeRunning}-${awayRunning}`,
          quarter: q + 1,
        };
      } else if (roll < 0.87) {
        // Substitution
        const team = _rng() < 0.5 ? homeTeam : awayTeam;
        const outPlayer = pickPlayer(team);
        const inPlayer = pickPlayer(team);
        event = {
          id: eventId,
          time: minute,
          type: 'substitution',
          description: `${team.name} makes a change: ${inPlayer.name} comes on for ${outPlayer.name}.`,
          player: inPlayer.name,
          playerId: inPlayer.id,
          team: team.name,
          teamId: team.id,
          score: `${homeRunning}-${awayRunning}`,
          quarter: q + 1,
        };
      } else if (roll < 0.90) {
        // Technical foul (rare)
        const team = _rng() < 0.5 ? homeTeam : awayTeam;
        const player = pickPlayer(team);
        event = {
          id: eventId,
          time: minute,
          type: 'technical_foul',
          description: fillTemplate(randomFrom(TECHNICAL_DESCRIPTIONS), player, team),
          player: player.name,
          playerId: player.id,
          team: team.name,
          teamId: team.id,
          score: `${homeRunning}-${awayRunning}`,
          quarter: q + 1,
        };
      } else if (roll < 0.93) {
        // Comeback moment
        const leadDiff = homeRunning - awayRunning;
        let trailingTeam = leadDiff < 0 ? homeTeam : awayTeam;
        event = {
          id: eventId,
          time: minute,
          type: 'comeback',
          description: fillTemplate(randomFrom(COMEBACK_DESCRIPTIONS), null, trailingTeam),
          player: null,
          playerId: null,
          team: trailingTeam.name,
          teamId: trailingTeam.id,
          score: `${homeRunning}-${awayRunning}`,
          quarter: q + 1,
        };
      } else if (roll < 0.96) {
        // Injury (rare)
        const team = _rng() < 0.5 ? homeTeam : awayTeam;
        const player = pickPlayer(team);
        event = {
          id: eventId,
          time: minute,
          type: 'injury',
          description: fillTemplate(randomFrom(INJURY_DESCRIPTIONS), player, team),
          player: player.name,
          playerId: player.id,
          team: team.name,
          teamId: team.id,
          score: `${homeRunning}-${awayRunning}`,
          quarter: q + 1,
        };
      } else {
        // Fight (very rare)
        const team = _rng() < 0.5 ? homeTeam : awayTeam;
        const player = pickPlayer(team);
        event = {
          id: eventId,
          time: minute,
          type: 'fight',
          description: fillTemplate(randomFrom(FIGHT_DESCRIPTIONS), player, team),
          player: player.name,
          playerId: player.id,
          team: team.name,
          teamId: team.id,
          score: `${homeRunning}-${awayRunning}`,
          quarter: q + 1,
        };
      }

      events.push(event);
    }

    // Quarter / half-time marker
    const isHalfTime = q === 1;
    eventId++;
    events.push({
      id: eventId,
      time: qStart + quarterLength,
      quarter: q + 1,
      type: isHalfTime ? 'half_time' : 'quarter_end',
      description: isHalfTime
        ? `HALF TIME: ${homeTeam.name} ${homeRunning} – ${awayRunning} ${awayTeam.name}`
        : `End of Q${q + 1}: ${homeTeam.name} ${homeRunning} – ${awayRunning} ${awayTeam.name}`,
      player: null,
      playerId: null,
      team: null,
      teamId: null,
      score: `${homeRunning}-${awayRunning}`,
    });
  }

  // Stamp every event with its real-time offset from tip-off so the
  // Live viewer can reveal events in sync across all users.
  events.forEach(ev => {
    ev.relativeTime = gameMinToRelSec(ev.time, ev.quarter);
  });

  return events;
}

// ── Player Stat Distribution ──────────────────────────────────

/**
 * Distribute team totals across players realistically.
 * Starting 5 get more minutes/stats than bench.
 */
function distributePlayerStats(team, teamTotals) {
  const statMap = buildStatMap(team);
  const players = team.players;
  if (players.length === 0) return statMap;

  // Minutes: starters get ~28-36, bench 5-15
  const starterCount = Math.min(5, players.length);

  // Assign minutes
  let remainingMinutes = 200; // 5 players × 40 min
  const minuteShare = [];
  for (let i = 0; i < players.length; i++) {
    if (i < starterCount) {
      minuteShare.push(randomInt(26, 36));
    } else {
      minuteShare.push(randomInt(4, 14));
    }
  }
  // Normalise to 200 total
  const rawTotal = minuteShare.reduce((a, b) => a + b, 0);
  const normalised = minuteShare.map((m) => Math.round((m / rawTotal) * 200));

  // Distribute each stat proportionally by minutes
  const statsToDistribute = ['points', 'assists', 'rebounds', 'steals', 'blocks', 'turnovers', 'fouls',
    'fgAttempts', 'fgMade', 'ftAttempts', 'ftMade', 'threePtAttempts', 'threePtMade'];

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const share = normalised[i] / 200;
    const s = statMap[p.id];
    s.minutesPlayed = normalised[i];

    for (const stat of statsToDistribute) {
      if (teamTotals[stat] != null) {
        // Add some noise
        const raw = teamTotals[stat] * share * (0.7 + _rng() * 0.6);
        s[stat] = Math.round(raw);
      }
    }

    // Clamp fouls to 6 max (foul-out rule)
    s.fouls = clamp(s.fouls, 0, 6);
    // fgMade <= fgAttempts
    s.fgMade = Math.min(s.fgMade, s.fgAttempts);
    s.ftMade = Math.min(s.ftMade, s.ftAttempts);
    s.threePtMade = Math.min(s.threePtMade, s.threePtAttempts);
  }

  return statMap;
}

/**
 * Derive raw team stat totals from the final score.
 */
function deriveTeamTotals(score, oppScore) {
  // Rough breakdown from final score
  const fgMade = Math.round(score / 2.3);
  const fgAttempts = Math.round(fgMade / 0.44);
  const threePtMade = Math.round(fgMade * 0.33);
  const threePtAttempts = Math.round(threePtMade / 0.36);
  const ftMade = Math.max(0, score - fgMade * 2 - threePtMade);
  const ftAttempts = Math.round(ftMade / 0.75);

  return {
    points: score,
    assists: Math.round(fgMade * 0.6),
    rebounds: randomInt(28, 46),
    steals: randomInt(4, 10),
    blocks: randomInt(2, 7),
    turnovers: randomInt(8, 18),
    fouls: randomInt(14, 26),
    fgMade,
    fgAttempts,
    ftMade,
    ftAttempts,
    threePtMade,
    threePtAttempts,
  };
}

// ── Main Simulate Function ────────────────────────────────────

/**
 * Simulate a basketball match between two teams.
 * @param {Object} homeTeam
 * @param {Object} awayTeam
 * @param {string|Date} matchDate
 * @returns {Object} match result
 */
export function simulateMatch(homeTeam, awayTeam, matchDate, matchId = null) {
  // Seed the RNG from the matchId so the result is always identical for the same match.
  // This prevents different scores on each page refresh.
  const seed = matchId ? _hashStr(String(matchId)) : (Number(matchDate) || Date.now());
  _rng = _mulberry32(seed);

  // Simulate each quarter score
  const quarterScores = [];
  let homeTotal = 0;
  let awayTotal = 0;

  for (let q = 0; q < 4; q++) {
    const qScore = simulateSegmentScore(homeTeam, awayTeam, 10);
    // Ensure each quarter has at least 10 points per team
    qScore.home = Math.max(10, qScore.home);
    qScore.away = Math.max(10, qScore.away);
    quarterScores.push(qScore);
    homeTotal += qScore.home;
    awayTotal += qScore.away;
  }

  // Prevent ties: give 1 extra point to the leader or flip a coin
  if (homeTotal === awayTotal) {
    if (_rng() < 0.5) homeTotal++;
    else awayTotal++;
  }

  // Generate highlight events log
  const events = generateHighlightEvents(homeTeam, awayTeam, quarterScores);

  // Compute player stats
  const homeTotals = deriveTeamTotals(homeTotal, awayTotal);
  const awayTotals = deriveTeamTotals(awayTotal, homeTotal);

  const homePlayerStats = distributePlayerStats(homeTeam, homeTotals);
  const awayPlayerStats = distributePlayerStats(awayTeam, awayTotals);

  const playerStats = { ...homePlayerStats, ...awayPlayerStats };

  return {
    homeScore: homeTotal,
    awayScore: awayTotal,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    homeTeamName: homeTeam.name,
    awayTeamName: awayTeam.name,
    quarterScores,
    log: events,
    playerStats,
    events,
    duration: 40,
    matchDate: matchDate instanceof Date ? matchDate.toISOString() : matchDate,
    winner: homeTotal > awayTotal ? homeTeam.id : awayTeam.id,
  };
}

// ── Post-Match Team Update ────────────────────────────────────

/**
 * Update a team's records, motivation, momentum and fan stats after a match.
 * @param {Object} team - team object (mutated)
 * @param {Object} matchResult - result from simulateMatch
 * @param {boolean} isHome - whether this team was the home team
 * @returns {Object} updated team
 */
export function updateTeamAfterMatch(team, matchResult, isHome) {
  const teamScore = isHome ? matchResult.homeScore : matchResult.awayScore;
  const oppScore = isHome ? matchResult.awayScore : matchResult.homeScore;
  const won = teamScore > oppScore;
  const scoreDiff = teamScore - oppScore;

  // Ensure record objects exist (NPC teams from Firestore may not have them)
  if (!team.seasonRecord)  team.seasonRecord  = { wins: 0, losses: 0 };
  if (!team.overallRecord) team.overallRecord = { wins: 0, losses: 0 };

  // Season and overall record
  if (won) {
    team.seasonRecord.wins  = (team.seasonRecord.wins  ?? 0) + 1;
    team.overallRecord.wins = (team.overallRecord.wins ?? 0) + 1;
  } else {
    team.seasonRecord.losses  = (team.seasonRecord.losses  ?? 0) + 1;
    team.overallRecord.losses = (team.overallRecord.losses ?? 0) + 1;
  }

  // Motivation
  const motivationDelta = won ? randomInt(3, 8) : randomInt(-8, -2);
  team.motivationBar = clamp((team.motivationBar ?? 65) + motivationDelta, 10, 100);

  // Momentum
  const momentumDelta = won
    ? clamp(5 + Math.round(scoreDiff / 5), 3, 20)
    : clamp(-5 + Math.round(scoreDiff / 5), -20, -3);
  team.momentumBar = clamp((team.momentumBar ?? 65) + momentumDelta, 0, 100);

  // Chemistry (small change each game)
  const chemDelta = won ? randomInt(1, 4) : randomInt(-3, 0);
  team.chemistryGauge = clamp((team.chemistryGauge ?? 50) + chemDelta, 0, 100);

  // Fan enthusiasm
  const fanDelta = won ? randomInt(2, 6) : randomInt(-4, -1);
  team.fanEnthusiasm = clamp((team.fanEnthusiasm ?? 20) + fanDelta, 0, 100);

  // Fan count grows on wins; Media Center teamExposure multiplies the growth
  if (won) {
    const exposure = team.teamExposure ?? 0; // 0-10 based on media center level
    const exposureMultiplier = 1 + exposure * 0.1; // +10% per media level
    const baseGrowth = randomInt(5, 20);
    team.fanCount = (team.fanCount ?? 250) + Math.round(baseGrowth * exposureMultiplier);
  }

  // Reputation change
  if (won && scoreDiff >= 15) team.reputation = clamp((team.reputation ?? 10) + 2, 0, 100);
  else if (won) team.reputation = clamp((team.reputation ?? 10) + 1, 0, 100);
  else if (!won && scoreDiff <= -15) team.reputation = clamp((team.reputation ?? 10) - 2, 0, 100);

  // Add to match history (keep last 20).
  // log and playerStats are NOT stored here – they are saved to match_logs/{matchId}
  // in Firebase and loaded on-demand. This prevents the user_team_state doc from
  // exceeding Firestore's 1 MB document limit.
  const historyEntry = {
    matchId:      matchResult.matchId || `m_${matchResult.matchDate}_${matchResult.homeTeamId}`,
    matchDate:    matchResult.matchDate,
    opponent:     isHome ? matchResult.awayTeamName : matchResult.homeTeamName,
    opponentId:   isHome ? matchResult.awayTeamId   : matchResult.homeTeamId,
    teamScore,
    oppScore,
    result:       won ? 'W' : 'L',
    isHome,
    homeTeam:     matchResult.homeTeamName,
    awayTeam:     matchResult.awayTeamName,
    homeScore:    matchResult.homeScore,
    awayScore:    matchResult.awayScore,
    quarterScores: matchResult.quarterScores || [],
    // Keep log + playerStats in memory only (stripped before Firestore save)
    log:          matchResult.log         || [],
    playerStats:  matchResult.playerStats || {},
  };
  team.matchHistory = [historyEntry, ...(team.matchHistory ?? [])].slice(0, 20);

  return team;
}

// ── Post-Match Player Update ──────────────────────────────────

/**
 * Update a player's season stats, fatigue, and motivation after a match.
 * @param {Object} player - player object (mutated)
 * @param {Object} playerMatchStats - stats from the match for this player
 * @returns {Object} updated player
 */
export function updatePlayerAfterMatch(player, playerMatchStats) {
  if (!playerMatchStats) return player;

  const statKeys = [
    'points', 'assists', 'rebounds', 'steals', 'blocks',
    'turnovers', 'fouls', 'minutesPlayed',
    'fgAttempts', 'fgMade', 'ftAttempts', 'ftMade',
    'threePtAttempts', 'threePtMade',
  ];

  // Season stats
  if (!player.seasonStats) {
    player.seasonStats = {};
  }
  for (const key of statKeys) {
    player.seasonStats[key] = (player.seasonStats[key] ?? 0) + (playerMatchStats[key] ?? 0);
  }
  player.seasonStats.gamesPlayed = (player.seasonStats.gamesPlayed ?? 0) + 1;

  // Career stats
  if (!player.careerStats) {
    player.careerStats = {};
  }
  for (const key of statKeys) {
    player.careerStats[key] = (player.careerStats[key] ?? 0) + (playerMatchStats[key] ?? 0);
  }
  player.careerStats.gamesPlayed = (player.careerStats.gamesPlayed ?? 0) + 1;

  // Accumulated minutes
  player.minutesThisSeason = (player.minutesThisSeason ?? 0) + (playerMatchStats.minutesPlayed ?? 0);
  player.gamesPlayed = (player.gamesPlayed ?? 0) + 1;

  // Fatigue — increases based on minutes played, reduced by conditioning
  const conditioning = player.attributes?.conditioningFitness ?? 55;
  const condFactor = 1 - (conditioning - 30) / 120; // 0.58-1.0
  const fatigueDelta = Math.round((playerMatchStats.minutesPlayed ?? 20) * 0.3 * condFactor);
  player.fatigue = clamp((player.fatigue ?? 10) + fatigueDelta, 0, 100);

  // Motivation — slight boost for big games, small drop for poor performance
  const pts = playerMatchStats.points ?? 0;
  const motivationDelta = pts >= 20 ? randomInt(3, 7) : pts >= 10 ? randomInt(1, 3) : randomInt(-3, 1);
  player.motivation = clamp((player.motivation ?? 70) + motivationDelta, 20, 100);

  // Form rating — blend of points, efficiency, and randomness
  const effortScore = (pts * 2 + (playerMatchStats.assists ?? 0) * 3 + (playerMatchStats.rebounds ?? 0));
  const newFormRaw = clamp(40 + effortScore * 0.4 + randomInt(-10, 10), 30, 99);
  player.lastFormRating = Math.round((player.lastFormRating ?? 65) * 0.6 + newFormRaw * 0.4);

  // Injury check (very low probability, especially if fatigued)
  const injuryRoll = _rng();
  const injuryThreshold = player.fatigue > 70 ? 0.06 : 0.02;
  if (player.injuryStatus === 'healthy' && injuryRoll < injuryThreshold) {
    const severity = _rng();
    if (severity < 0.6) {
      player.injuryStatus = 'minor';
      player.injuryDaysRemaining = randomInt(2, 5);
    } else if (severity < 0.9) {
      player.injuryStatus = 'moderate';
      player.injuryDaysRemaining = randomInt(6, 14);
    } else {
      player.injuryStatus = 'severe';
      player.injuryDaysRemaining = randomInt(15, 40);
    }
  }

  return player;
}
