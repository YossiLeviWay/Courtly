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
  '{player} rises up and THROWS IT DOWN! +2',
  '{player} with a thunderous two-handed slam! +2',
  '{player} posterises the defender for a massive dunk! +2',
  '{player} catches the lob and hammers it home! +2',
  'BOOM! {player} with an emphatic finish at the rim! +2',
  '{player} goes coast-to-coast and DUNKS on the break! +2',
];

const LAYUP_DESCRIPTIONS = [
  '{player} glides in for the finger roll! +2',
  '{player} splits the defense and lays it in softly. +2',
  '{player} with a quick drive and a smooth layup. +2',
  '{player} converts the reverse layup! +2',
  'Clever footwork from {player} — easy two off the glass. +2',
  '{player} draws the defense and kisses it off the board. +2',
];

const THREE_DESCRIPTIONS = [
  '{player} steps back and drains the triple! +3',
  'SPLASH! {player} from well beyond the arc! +3',
  '{player} fires from the corner — BANG, three! +3',
  'Ice in the veins from {player}! Triple! +3',
  '{player} pulls up from deep — it\'s good! +3',
  '{player} catches and fires — THREE! +3',
  'Nothing but net for {player} from downtown! +3',
];

const MIDRANGE_DESCRIPTIONS = [
  '{player} hits the mid-range jumper! +2',
  '{player} with the pull-up from 18 feet. +2',
  'Textbook form from {player} — mid-range money. +2',
  '{player} fades away and hits the jumper! +2',
  '{player} stops on a dime and knocks it down. +2',
];

const FREE_THROW_DESCRIPTIONS = [
  '{player} steps to the line and converts. +1',
  'Cool and calm — {player} makes the free throw. +1',
  '{player} sinks the charity stripe shot. +1',
  'No sweat — {player} nails the free throw. +1',
];

const STEAL_DESCRIPTIONS = [
  '{player} reads the pass and picks the pocket!',
  'Quick hands from {player} — steal and push!',
  '{player} strips the ball clean on the drive!',
  '{player} deflects the pass and pounces on it!',
];

const BLOCK_DESCRIPTIONS = [
  '{player} rejects the shot at the rim! No good!',
  'DENIED! {player} with the emphatic block!',
  '{player} swats it away — sent into the crowd!',
  '{player} comes from behind with the chase-down block!',
];

const FOUL_DESCRIPTIONS = [
  '{player} picks up a foul. Referee calls it quickly.',
  'Whistled on {player} — that\'s a personal foul.',
  '{player} reaches in and the referee blows the whistle.',
  'Foul on {player} — too aggressive on the drive.',
];

const TURNOVER_DESCRIPTIONS = [
  '{player} turns it over — sloppy possession.',
  'Bad pass from {player}. Turnover.',
  '{player} dribbles off their own foot. Turnover.',
  'Ball knocked away — {player} coughs it up.',
  '{player} telegraphs the pass and it\'s intercepted.',
];

const TIMEOUT_DESCRIPTIONS = [
  '{team} calls a timeout to regroup.',
  'Timeout on the floor — {team} needs a breather.',
  '{team}\'s bench calls for a stoppage.',
  'TV timeout — {team} huddles up to discuss strategy.',
];

const INJURY_DESCRIPTIONS = [
  '{player} goes down clutching their ankle — looks painful.',
  '{player} takes a hard foul and stays on the floor. Medical staff attending.',
  '{player} is helped off the court — possible injury.',
];

const FIGHT_DESCRIPTIONS = [
  'Tempers flare! {player} and an opponent jaw at each other — officials step in.',
  'A scuffle breaks out near the paint! {player} is restrained by teammates.',
  'Pushing and shoving after the whistle — {player} is involved.',
];

const TECHNICAL_DESCRIPTIONS = [
  '{player} argues the call and receives a technical foul!',
  'Technical foul on {player} — too much jawing at the referee.',
  'The referee has seen enough — technical on {player}.',
];

const COMEBACK_DESCRIPTIONS = [
  '{team} storms back! They\'re cutting into the lead!',
  'Incredible run from {team} — this game is not over!',
  '{team} with a quick burst to get back in it!',
];

function fillTemplate(template, player, team) {
  return template
    .replace('{player}', player?.name ?? 'Unknown')
    .replace('{team}', team?.name ?? 'The team');
}

/**
 * Build scoring plays for a team that sum EXACTLY to targetPts.
 * Returns array of raw play objects (no time assigned yet).
 */
function buildScoringPlays(team, targetPts) {
  const plays = [];
  let pts = 0;
  while (pts < targetPts) {
    const remaining = targetPts - pts;
    let type, playPts;
    if (remaining === 1) {
      type = 'free_throw'; playPts = 1;
    } else if (remaining === 2) {
      const r = _rng();
      type = r < 0.45 ? 'dunk' : r < 0.80 ? 'layup' : 'midrange';
      playPts = 2;
    } else {
      const r = _rng();
      if (r < 0.25) { type = 'three_pointer'; playPts = 3; }
      else {
        const r2 = _rng();
        type = r2 < 0.40 ? 'dunk' : r2 < 0.72 ? 'layup' : r2 < 0.88 ? 'midrange' : 'free_throw';
        playPts = type === 'free_throw' ? 1 : 2;
      }
    }
    const player = pickPlayer(team);
    const templates = {
      three_pointer: THREE_DESCRIPTIONS,
      dunk: DUNK_DESCRIPTIONS,
      layup: LAYUP_DESCRIPTIONS,
      midrange: MIDRANGE_DESCRIPTIONS,
      free_throw: FREE_THROW_DESCRIPTIONS,
    };
    plays.push({
      type,
      pts: playPts,
      player: player.name,
      playerId: player.id,
      team: team.name,
      teamId: team.id,
      description: fillTemplate(randomFrom(templates[type]), player, team),
    });
    pts += playPts;
  }
  return plays;
}

/**
 * Build non-scoring event objects (fouls, steals, blocks, turnovers, subs, etc.)
 * for a single quarter. No time or score assigned yet.
 */
function buildNonScoringEvents(homeTeam, awayTeam) {
  const evts = [];
  const mk = (type, team, player, desc) => ({
    type, pts: 0,
    player: player?.name ?? null,
    playerId: player?.id ?? null,
    team: team?.name ?? null,
    teamId: team?.id ?? null,
    description: desc,
  });

  // Fouls: 2-4
  const fouls = 2 + Math.floor(_rng() * 3);
  for (let i = 0; i < fouls; i++) {
    const t = _rng() < 0.5 ? homeTeam : awayTeam;
    const p = pickPlayer(t);
    evts.push(mk('foul', t, p, fillTemplate(randomFrom(FOUL_DESCRIPTIONS), p, t)));
  }
  // Steals: 1-3
  const steals = 1 + Math.floor(_rng() * 3);
  for (let i = 0; i < steals; i++) {
    const t = _rng() < 0.5 ? homeTeam : awayTeam;
    const p = pickPlayer(t);
    evts.push(mk('steal', t, p, fillTemplate(randomFrom(STEAL_DESCRIPTIONS), p, t)));
  }
  // Blocks: 1-2
  const blocks = 1 + Math.floor(_rng() * 2);
  for (let i = 0; i < blocks; i++) {
    const t = _rng() < 0.5 ? homeTeam : awayTeam;
    const p = pickPlayer(t);
    evts.push(mk('block', t, p, fillTemplate(randomFrom(BLOCK_DESCRIPTIONS), p, t)));
  }
  // Turnovers: 1-3
  const tovs = 1 + Math.floor(_rng() * 3);
  for (let i = 0; i < tovs; i++) {
    const t = _rng() < 0.5 ? homeTeam : awayTeam;
    const p = pickPlayer(t);
    evts.push(mk('turnover', t, p, fillTemplate(randomFrom(TURNOVER_DESCRIPTIONS), p, t)));
  }
  // Substitutions: 1-2 per team
  for (const t of [homeTeam, awayTeam]) {
    const subs = 1 + Math.floor(_rng() * 2);
    for (let i = 0; i < subs; i++) {
      const outP = pickPlayer(t);
      const inP  = pickPlayer(t);
      evts.push(mk('substitution', t, inP,
        `${t.name} makes a change: ${inP.name} comes on for ${outP.name}.`));
    }
  }
  // Timeout: 0-1 per side
  if (_rng() < 0.40) {
    const t = _rng() < 0.5 ? homeTeam : awayTeam;
    evts.push(mk('timeout', t, null, fillTemplate(randomFrom(TIMEOUT_DESCRIPTIONS), null, t)));
  }
  // Rare: injury (~10%), technical (~8%), fight (~4%)
  if (_rng() < 0.10) {
    const t = _rng() < 0.5 ? homeTeam : awayTeam;
    const p = pickPlayer(t);
    evts.push(mk('injury', t, p, fillTemplate(randomFrom(INJURY_DESCRIPTIONS), p, t)));
  }
  if (_rng() < 0.08) {
    const t = _rng() < 0.5 ? homeTeam : awayTeam;
    const p = pickPlayer(t);
    evts.push(mk('technical_foul', t, p, fillTemplate(randomFrom(TECHNICAL_DESCRIPTIONS), p, t)));
  }
  if (_rng() < 0.04) {
    const t = _rng() < 0.5 ? homeTeam : awayTeam;
    const p = pickPlayer(t);
    evts.push(mk('fight', t, p, fillTemplate(randomFrom(FIGHT_DESCRIPTIONS), p, t)));
  }
  return evts;
}

/**
 * generateHighlightEvents — fully synced to quarter scores.
 *
 * For each quarter:
 *  1. Build scoring plays for home + away that sum EXACTLY to qScore.home / qScore.away
 *  2. Build non-scoring events (fouls, steals, subs, etc.)
 *  3. Merge, shuffle, assign evenly-spaced unique times within the 10-min window
 *  4. Walk in time order, increment running score as each scoring event fires
 *  5. Every event carries the LIVE score AFTER it was processed
 */
function generateHighlightEvents(homeTeam, awayTeam, quarterScores) {
  const events = [];
  let homeTotal = 0;
  let awayTotal = 0;
  let eventId = 0;

  // Tip-off
  events.push({
    id: eventId++, time: 0, quarter: 1,
    type: 'game_start',
    description: `🏀 Tip-off! ${homeTeam.name} host ${awayTeam.name}. The crowd is ready — let's play!`,
    player: null, playerId: null,
    team: homeTeam.name, teamId: homeTeam.id,
    score: '0-0', relativeTime: 0,
  });

  for (let q = 0; q < 4; q++) {
    const qStart = q * 10;
    const { home: targetHome, away: targetAway } = quarterScores[q];

    // 1. Scoring plays (exact totals)
    const homePlays = buildScoringPlays(homeTeam, targetHome);
    const awayPlays = buildScoringPlays(awayTeam, targetAway);
    // 2. Non-scoring events
    const nonScoring = buildNonScoringEvents(homeTeam, awayTeam);

    // 3. Merge and shuffle (Fisher-Yates)
    const pool = [...homePlays, ...awayPlays, ...nonScoring];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(_rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // 4. Assign evenly-spread times within [qStart+0.2, qStart+9.7]
    //    Each slot is separated by at least 0.3 min, with light jitter.
    const n = pool.length;
    const span = 9.5;
    pool.forEach((ev, i) => {
      const frac = n <= 1 ? 0.5 : i / (n - 1);
      const base = qStart + 0.2 + frac * span;
      const jitter = (_rng() - 0.5) * Math.min(0.4, span / (n + 1));
      ev.time = parseFloat(Math.max(qStart + 0.1, Math.min(qStart + 9.8, base + jitter)).toFixed(1));
      ev.quarter = q + 1;
    });
    // Sort by assigned time
    pool.sort((a, b) => a.time - b.time);

    // 5. Walk in order — update running score after each scoring play
    let homeQ = 0, awayQ = 0;
    for (const ev of pool) {
      if (ev.pts) {
        if (ev.teamId === homeTeam.id) homeQ += ev.pts;
        else awayQ += ev.pts;
      }
      ev.score = `${homeTotal + homeQ}-${awayTotal + awayQ}`;
      ev.id = eventId++;
      events.push(ev);
    }

    homeTotal += targetHome;
    awayTotal += targetAway;

    // Quarter / halftime break marker
    const isHalf = q === 1;
    events.push({
      id: eventId++,
      time: qStart + 10,
      quarter: q + 1,
      type: isHalf ? 'half_time' : 'quarter_end',
      description: isHalf
        ? `HALF TIME: ${homeTeam.name} ${homeTotal} – ${awayTotal} ${awayTeam.name}`
        : `End of Q${q + 1}: ${homeTeam.name} ${homeTotal} – ${awayTotal} ${awayTeam.name}`,
      player: null, playerId: null, team: null, teamId: null,
      score: `${homeTotal}-${awayTotal}`,
    });

    // Momentum commentary mid-game (halves only, when big gap)
    if (q === 1 || q === 3) {
      const diff = homeTotal - awayTotal;
      if (Math.abs(diff) >= 10) {
        const trailingTeam = diff > 0 ? awayTeam : homeTeam;
        events.push({
          id: eventId++,
          time: qStart + 10.05,
          quarter: q + 1,
          type: 'comeback',
          description: fillTemplate(randomFrom(COMEBACK_DESCRIPTIONS), null, trailingTeam),
          player: null, playerId: null,
          team: trailingTeam.name, teamId: trailingTeam.id,
          score: `${homeTotal}-${awayTotal}`,
        });
      }
    }
  }

  // Stamp real-time offsets for live-mode sync
  events.forEach(ev => {
    ev.relativeTime = gameMinToRelSec(ev.time ?? 0, ev.quarter ?? 1);
  });

  return events;
}

// ── Player Stat Distribution ──────────────────────────────────

/**
 * Distribute team totals across players realistically.
 * Starting 5 get more minutes/stats than bench.
 */
// Return a player's attribute value (0-99) with fallback
function attr(player, key, fallback = 55) {
  return player.attributes?.[key] ?? fallback;
}

// Build a per-player "affinity" weight for each distributable stat bucket
function buildStatWeights(player) {
  const a = (key, fb) => attr(player, key, fb);
  // Scoring ability: blend of finishing, mid-range, 3PT
  const scoringAbility = (a('finishingAtTheRim') + a('midRangeScoring') + a('threePtShooting')) / 3;
  // Playmaking: court vision + passing + IQ
  const playmaking = (a('courtVision') * 2 + a('passingAccuracy') + a('basketballIQ')) / 4;
  // Rebounding: reb + vertical
  const reboundingAbility = (a('rebounding') * 2 + a('verticalLeapingAbility')) / 3;
  // Steals: perimeter D + agility
  const stealAbility = (a('perimeterDefense') + a('agilityLateralSpeed')) / 2;
  // Blocks: interior D + vertical
  const blockAbility = (a('interiorDefense') + a('verticalLeapingAbility')) / 2;
  // Turnovers: inversely related to IQ + ball handling + patience
  const ballSecurity = (a('basketballIQ') + a('ballHandlingDribbling') + a('patienceOffense')) / 3;
  // Fouling: inversely related to discipline
  const foulProne = 100 - a('disciplineFouling');
  // 3PT tendency: driven primarily by 3PT shooting
  const threePtTendency = a('threePtShooting') * 1.4;
  // FT tendency: aggressiveness + finishing
  const ftTendency = (a('aggressivenessOffensive') + a('finishingAtTheRim')) / 2;

  return {
    points:          scoringAbility,
    assists:         playmaking,
    rebounds:        reboundingAbility,
    steals:          stealAbility,
    blocks:          blockAbility,
    turnovers:       100 - ballSecurity, // high security = fewer TOs
    fouls:           foulProne,
    fgAttempts:      scoringAbility,
    threePtAttempts: threePtTendency,
    ftAttempts:      ftTendency,
    // made = proportional to attempts (efficiency handled separately)
    fgMade:          scoringAbility,
    threePtMade:     threePtTendency,
    ftMade:          ftTendency,
  };
}

function distributePlayerStats(team, teamTotals) {
  const statMap = buildStatMap(team);
  const players = team.players;
  if (players.length === 0) return statMap;

  const starterCount = Math.min(5, players.length);

  // Minutes: starters ~28-36, bench 4-14
  const minuteShare = players.map((_, i) =>
    i < starterCount ? randomInt(26, 36) : randomInt(4, 14)
  );
  const rawMinTotal = minuteShare.reduce((a, b) => a + b, 0);
  const minutes = minuteShare.map(m => Math.round((m / rawMinTotal) * 200));

  // Pre-compute attribute weights for all stat categories
  const weights = players.map(p => buildStatWeights(p));

  const statsToDistribute = [
    'points', 'assists', 'rebounds', 'steals', 'blocks', 'turnovers', 'fouls',
    'fgAttempts', 'fgMade', 'ftAttempts', 'ftMade', 'threePtAttempts', 'threePtMade',
  ];

  for (const stat of statsToDistribute) {
    if (teamTotals[stat] == null) continue;

    // Each player's effective weight = minutes * attribute-affinity, normalised 0-1
    const rawWeights = players.map((_, i) => {
      const minShare = minutes[i] / 200;
      const attrAffinity = weights[i][stat] / 100; // 0-1
      // Blend: 50% minutes, 50% attribute affinity, then add small noise
      return (minShare * 0.5 + attrAffinity * 0.5) * (0.8 + _rng() * 0.4);
    });
    const totalWeight = rawWeights.reduce((a, b) => a + b, 0);

    for (let i = 0; i < players.length; i++) {
      const s = statMap[players[i].id];
      const share = totalWeight > 0 ? rawWeights[i] / totalWeight : 1 / players.length;
      s[stat] = Math.round(teamTotals[stat] * share);
    }
  }

  // Set minutes
  for (let i = 0; i < players.length; i++) {
    statMap[players[i].id].minutesPlayed = minutes[i];
  }

  // Consistency: enforce shooting bounds
  for (const p of players) {
    const s = statMap[p.id];
    s.fouls       = clamp(s.fouls, 0, 6);
    s.fgMade      = Math.min(s.fgMade, s.fgAttempts);
    s.ftMade      = Math.min(s.ftMade, s.ftAttempts);
    s.threePtMade = Math.min(s.threePtMade, s.threePtAttempts);
    // threePtAttempts can't exceed fgAttempts
    s.threePtAttempts = Math.min(s.threePtAttempts, s.fgAttempts);
    s.threePtMade     = Math.min(s.threePtMade, s.threePtAttempts);
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

  // Motivation — boost or dip based on performance
  const pts = playerMatchStats.points ?? 0;
  const motivationDelta = pts >= 20 ? randomInt(3, 7) : pts >= 10 ? randomInt(1, 3) : randomInt(-3, 1);
  player.motivation = clamp((player.motivation ?? 70) + motivationDelta, 20, 100);

  // Form rating — multi-factor: performance, clutch, consistency, fatigue, motivation
  const ast  = playerMatchStats.assists  ?? 0;
  const reb  = playerMatchStats.rebounds ?? 0;
  const stl  = playerMatchStats.steals   ?? 0;
  const blk  = playerMatchStats.blocks   ?? 0;
  const to   = playerMatchStats.turnovers ?? 0;
  const mins = playerMatchStats.minutesPlayed ?? 20;

  // Per-36-minute production score
  const productionPer36 = mins > 0
    ? ((pts * 1.5 + ast * 2.5 + reb * 1.0 + stl * 2.0 + blk * 2.0 - to * 1.5) / mins) * 36
    : 0;

  // Attribute factors
  const clutch       = player.attributes?.clutchPerformance    ?? 55;
  const consistency  = player.attributes?.consistencyPerformance ?? 55;
  const stamina      = player.attributes?.staminaEndurance      ?? 55;

  // Fatigue penalty: high fatigue reduces form
  const fatiguePenalty = clamp((player.fatigue ?? 20) - 40, 0, 50) * 0.2;

  // Motivation bonus: high motivation lifts performance ceiling
  const motivationBonus = ((player.motivation ?? 70) - 50) * 0.15;

  // Clutch floors: high clutch players never drop too low, low clutch collapses under pressure
  const clutchFloor = clamp(clutch * 0.3, 20, 40);

  // Consistency: dampens variance — high consistency → result closer to career average
  const consistencyDamp = clamp(consistency / 100, 0.4, 0.85);

  // Raw form from this game (0–99 scale)
  const newFormRaw = clamp(
    40 + productionPer36 * 0.7 + motivationBonus - fatiguePenalty + randomInt(-8, 8),
    clutchFloor,
    99
  );

  // Blend with prior form: consistent players change less, inconsistent ones swing more
  const priorWeight = consistencyDamp * 0.55;
  const newWeight   = 1 - priorWeight;
  player.lastFormRating = Math.round(
    clamp((player.lastFormRating ?? 65) * priorWeight + newFormRaw * newWeight, 25, 99)
  );

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
