// POST /api/db/admin-seed
// One-time admin endpoint — generates the shared world server-side with deterministic
// (seeded) data so every installation produces the same teams, players, and schedule.
//
// Usage:
//   curl -X POST https://<your-domain>/api/db/admin-seed \
//        -H "Content-Type: application/json" \
//        -d '{"secret":"<ADMIN_SECRET>"}'
//
// Set ADMIN_SECRET in Netlify environment variables.

import { neon } from '@netlify/neon';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

// ── Seeded PRNG (mulberry32) ────────────────────────────────────
let _rngState = 42;
function resetRng() { _rngState = 42; }
function rng() {
  _rngState = (_rngState + 0x6D2B79F5) >>> 0;
  let t = Math.imul(_rngState ^ (_rngState >>> 15), 1 | _rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
}
function ri(min, max) { return Math.floor(rng() * (max - min + 1)) + min; }
function rf(arr) { return arr[Math.floor(rng() * arr.length)]; }
function shuffle(arr) { return [...arr].sort(() => rng() - 0.5); }

// ── Static Data ─────────────────────────────────────────────────

const FIRST_NAMES = [
  'James', 'Michael', 'Chris', 'Kevin', 'Marcus', 'DeShawn', 'Tyrone', 'Andre', 'Malik', 'Darius',
  'Jordan', 'Tyler', 'Brandon', 'Jaylen', 'Isaiah', 'Trevon', 'Dwayne', 'Kareem', 'LaMarcus', 'Kobe',
  'Carlos', 'Alejandro', 'Diego', 'Miguel', 'Pablo', 'Javier', 'Rodrigo', 'Mateo', 'Emilio', 'Leandro',
  'Luca', 'Marco', 'Nikola', 'Goran', 'Stefan', 'Filip', 'Jan', 'Lukas', 'Erik', 'Lars',
  'Pierre', 'François', 'Baptiste', 'Hugo', 'Theo', 'Nikos', 'Alexis', 'Kostas', 'Giorgos', 'Petros',
  'Kwame', 'Kofi', 'Seydou', 'Moussa', 'Cheikh', 'Didier', 'Yao', 'Kelechi', 'Obinna', 'Emeka',
  'Yousef', 'Khalid', 'Tariq', 'Hassan', 'Rami', 'Wei', 'Jian', 'Ryo', 'Kenji', 'Takashi',
  'Min-jun', 'Seung', 'Hyun', 'Ji-ho', 'Sung', 'Ivan', 'Boris', 'Vladimir', 'Sergei', 'Mehmet',
  'Emre', 'Burak', 'Zlatan', 'Dejan', 'Nemanja', 'Giannis', 'Thanasis', 'Vassilis', 'Rudy', 'Tony',
  'Lachlan', 'Hamish', 'Angus', 'Reuben', 'Amara', 'Aleksandar', 'Milos', 'Miroslav', 'Bogdan', 'Marko',
];

const LAST_NAMES = [
  'Johnson', 'Williams', 'Davis', 'Brown', 'Jones', 'Washington', 'Jackson', 'Thompson', 'Robinson', 'Harris',
  'Walker', 'Coleman', 'Mitchell', 'Parker', 'Carter', 'Turner', 'Howard', 'Griffin', 'Murray', 'Bailey',
  'Rodriguez', 'Martinez', 'Garcia', 'Hernandez', 'Lopez', 'Gonzalez', 'Perez', 'Ramirez', 'Torres', 'Flores',
  'Mueller', 'Schmidt', 'Fischer', 'Weber', 'Wagner', 'Rossi', 'Ferrari', 'Conti', 'Russo', 'Ricci',
  'Dupont', 'Leroy', 'Martin', 'Bernard', 'Moreau', 'Kovac', 'Petrovic', 'Nikolic', 'Markovic', 'Jovanovic',
  'Diallo', 'Traore', 'Kone', 'Okafor', 'Eze', 'Mensah', 'Asante', 'Boateng', 'Antwi', 'Owusu',
  'Al-Hassan', 'Nakamura', 'Tanaka', 'Watanabe', 'Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Sharma',
  'Patel', 'Singh', 'Kumar', 'Anderson', 'Eriksson', 'Lindqvist', 'Bergstrom', 'Johansson', 'Murphy', 'Quinn',
  'Dragic', 'Horvath', 'Nowak', 'Kowalski', 'Ivanov', 'Petrov', 'Sokolov', 'Volkov', 'Popovic', 'Lazic',
  'Obi', 'Adenike', 'Nwachukwu', 'Papadopoulos', 'Dimitriou', 'Stavros', 'Sullivan', 'Byrne', 'Fedorov', 'Nagy',
];

const NATIONALITIES = [
  'American', 'Brazilian', 'Spanish', 'French', 'Serbian', 'Nigerian', 'Japanese', 'Australian',
  'Turkish', 'Greek', 'German', 'Italian', 'Croatian', 'Lithuanian', 'Argentine', 'Canadian',
  'Slovenian', 'South Korean', 'Chinese', 'Senegalese', 'Angolan', 'Latvian',
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

const STAFF_ROLES = [
  'Head Coach', 'Assistant Coach', 'Physio', 'Scout', 'Psychologist',
  'Nutritionist', 'Strength & Conditioning Coach', 'Data Analyst', 'Team Manager',
];

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

const FACILITY_NAMES = [
  'Training Gym', 'Medical Center', 'Scouting Department',
  'Youth Academy', 'Fan Experience Zone', 'Analytics Lab',
];

const COLORS = [
  { primary: '#1a237e', secondary: '#ffb300' },
  { primary: '#1b5e20', secondary: '#f9a825' },
  { primary: '#b71c1c', secondary: '#ffffff' },
  { primary: '#4a148c', secondary: '#f57f17' },
  { primary: '#006064', secondary: '#e0f7fa' },
  { primary: '#37474f', secondary: '#eceff1' },
  { primary: '#e65100', secondary: '#212121' },
  { primary: '#0d47a1', secondary: '#e3f2fd' },
  { primary: '#880e4f', secondary: '#fce4ec' },
  { primary: '#33691e', secondary: '#ccff90' },
];

const TEAM_DEFINITIONS = [
  { name: 'New Cartagena Storm',  city: 'New Cartagena',  country: 'Colombia' },
  { name: 'Porto Alegre Thunder', city: 'Porto Alegre',   country: 'Brazil' },
  { name: 'Monterrey Flames',     city: 'Monterrey',      country: 'Mexico' },
  { name: 'Bogota Eagles',        city: 'Bogota',         country: 'Colombia' },
  { name: 'Lima Lions',           city: 'Lima',           country: 'Peru' },
  { name: 'Santiago Wolves',      city: 'Santiago',       country: 'Chile' },
  { name: 'Buenos Aires Bulls',   city: 'Buenos Aires',   country: 'Argentina' },
  { name: 'Caracas Cobras',       city: 'Caracas',        country: 'Venezuela' },
  { name: 'Havana Hawks',         city: 'Havana',         country: 'Cuba' },
  { name: 'Kingston Kings',       city: 'Kingston',       country: 'Jamaica' },
  { name: 'Madrid Monarchs',      city: 'Madrid',         country: 'Spain' },
  { name: 'Berlin Blaze',         city: 'Berlin',         country: 'Germany' },
  { name: 'Paris Panthers',       city: 'Paris',          country: 'France' },
  { name: 'Rome Raptors',         city: 'Rome',           country: 'Italy' },
  { name: 'Athens Aces',          city: 'Athens',         country: 'Greece' },
  { name: 'Amsterdam Arsenal',    city: 'Amsterdam',      country: 'Netherlands' },
  { name: 'Warsaw Warriors',      city: 'Warsaw',         country: 'Poland' },
  { name: 'Prague Phoenix',       city: 'Prague',         country: 'Czech Republic' },
  { name: 'Vienna Vipers',        city: 'Vienna',         country: 'Austria' },
  { name: 'Lisbon Lightning',     city: 'Lisbon',         country: 'Portugal' },
  { name: 'Cairo Cobras',         city: 'Cairo',          country: 'Egypt' },
  { name: 'Lagos Lions',          city: 'Lagos',          country: 'Nigeria' },
  { name: 'Accra Arrows',         city: 'Accra',          country: 'Ghana' },
  { name: 'Nairobi Knights',      city: 'Nairobi',        country: 'Kenya' },
  { name: 'Casablanca Condors',   city: 'Casablanca',     country: 'Morocco' },
  { name: 'Dakar Dragons',        city: 'Dakar',          country: 'Senegal' },
  { name: 'Luanda Leopards',      city: 'Luanda',         country: 'Angola' },
  { name: 'Tunis Tigers',         city: 'Tunis',          country: 'Tunisia' },
  { name: 'Addis Ababa Aces',     city: 'Addis Ababa',    country: 'Ethiopia' },
  { name: 'Harare Hawks',         city: 'Harare',         country: 'Zimbabwe' },
  { name: 'Tokyo Titans',         city: 'Tokyo',          country: 'Japan' },
  { name: 'Beijing Blaze',        city: 'Beijing',        country: 'China' },
  { name: 'Seoul Storm',          city: 'Seoul',          country: 'South Korea' },
  { name: 'Manila Mavericks',     city: 'Manila',         country: 'Philippines' },
  { name: 'Bangkok Bulls',        city: 'Bangkok',        country: 'Thailand' },
  { name: 'Mumbai Magic',         city: 'Mumbai',         country: 'India' },
  { name: 'Kuala Lumpur Kings',   city: 'Kuala Lumpur',   country: 'Malaysia' },
  { name: 'Jakarta Jets',         city: 'Jakarta',        country: 'Indonesia' },
  { name: 'Singapore Sharks',     city: 'Singapore',      country: 'Singapore' },
  { name: 'Taipei Thunder',       city: 'Taipei',         country: 'Taiwan' },
  { name: 'Sydney Surge',         city: 'Sydney',         country: 'Australia' },
  { name: 'Auckland Aces',        city: 'Auckland',       country: 'New Zealand' },
  { name: 'Dubai Dynamos',        city: 'Dubai',          country: 'UAE' },
  { name: 'Istanbul Icons',       city: 'Istanbul',       country: 'Turkey' },
  { name: 'Moscow Monarchs',      city: 'Moscow',         country: 'Russia' },
  { name: 'Toronto Titans',       city: 'Toronto',        country: 'Canada' },
  { name: 'Chicago Chargers',     city: 'Chicago',        country: 'USA' },
  { name: 'Cape Town Condors',    city: 'Cape Town',      country: 'South Africa' },
  { name: 'Bucharest Bears',      city: 'Bucharest',      country: 'Romania' },
  { name: 'Belgrade Blazers',     city: 'Belgrade',       country: 'Serbia' },
];

// ── Generators ──────────────────────────────────────────────────

function generateAttributes(baseLevel) {
  const attrs = {};
  for (const key of ATTRIBUTE_KEYS) {
    attrs[key] = Math.min(99, Math.max(30, ri(baseLevel - 15, baseLevel + 15)));
  }
  return attrs;
}

function generatePlayer(pos, teamIdx, playerIdx) {
  const baseLevel = 42 + (teamIdx % 10) * 2;
  const attributes = generateAttributes(baseLevel);
  const overall = Math.round(Object.values(attributes).reduce((s, v) => s + v, 0) / ATTRIBUTE_KEYS.length);
  const posIdx = ['PG', 'SG', 'SF', 'PF', 'C'].indexOf(pos);
  return {
    id: `player-t${teamIdx}-p${playerIdx}`,
    name: `${rf(FIRST_NAMES)} ${rf(LAST_NAMES)}`,
    position: pos,
    age: ri(19, 35),
    nationality: rf(NATIONALITIES),
    height: { cm: ri(175 + posIdx * 7, 192 + posIdx * 7), ft: 6, inches: posIdx },
    weight: { kg: ri(76 + posIdx * 9, 92 + posIdx * 9), lbs: 185 + posIdx * 15 },
    contractValue: ri(3, 25),
    overall,
    attributes,
    characterizations: [],
    morale: ri(60, 95),
    energy: 100,
    experience: ri(0, 10),
    isInjured: false,
    jerseyNumber: playerIdx + 1,
  };
}

function generateStaff(teamIdx) {
  const staff = {};
  for (const role of STAFF_ROLES) {
    const abilityKeys = STAFF_ABILITY_KEYS[role] || ['generalSkill'];
    const abilities = {};
    for (const key of abilityKeys) abilities[key] = ri(30, 75);
    staff[role] = {
      id: `staff-t${teamIdx}-${role.replace(/\s/g, '')}`,
      name: `${rf(FIRST_NAMES)} ${rf(LAST_NAMES)}`,
      role,
      age: ri(30, 60),
      characterizations: [],
      abilities,
      motivation: ri(60, 95),
      salary: ri(3, 15),
      avatar: { type: 'animals', value: rf(['bear', 'wolf', 'eagle', 'tiger', 'fox']) },
      biography: `A dedicated ${role.toLowerCase()} with years of experience.`,
    };
  }
  return staff;
}

function generateFacilities() {
  const obj = {};
  for (const name of FACILITY_NAMES) {
    obj[name] = { level: 0, upgradeInProgress: false, upgradeCompletesAt: null };
  }
  return obj;
}

function generateTeam(def, idx) {
  const positions = ['PG', 'PG', 'PG', 'SG', 'SG', 'SG', 'SF', 'SF', 'SF', 'PF', 'PF', 'PF', 'C', 'C', 'C'];
  return {
    id: `team-${idx}`,
    name: def.name,
    nickname: def.name.split(' ').pop(),
    city: def.city,
    country: def.country,
    region: '',
    stadiumName: `${def.city} Arena`,
    founded: ri(1950, 2010),
    colors: COLORS[idx % COLORS.length],
    budget: ri(150, 280),
    league: 'C',
    leagueIndex: Math.floor(idx / 10),
    players: positions.map((pos, pIdx) => generatePlayer(pos, idx, pIdx)),
    staff: generateStaff(idx),
    tactics: { offensiveScheme: 'Motion Offense', defensiveScheme: 'Man-to-Man', pace: 50, threePointFocus: 50, insideOutside: 50, pressureDefense: 30, helpDefenseIntensity: 50, rotationStrategy: 'Standard', clutchTimeoutUsage: 'Aggressive' },
    facilities: generateFacilities(),
    seasonRecord: { wins: 0, losses: 0 },
    overallRecord: { wins: 0, losses: 0 },
    motivationBar: 65, momentumBar: 65, chemistryGauge: 50,
    fanCount: ri(200, 800), fanEnthusiasm: ri(15, 40), reputation: ri(5, 25),
    matchHistory: [], isUserTeam: false,
  };
}

function generateSchedule(teams, leagueIndex) {
  const ids = teams.map(t => t.id);
  const pairs = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      pairs.push([ids[i], ids[j]]);
      pairs.push([ids[j], ids[i]]);
    }
  }
  const selected = shuffle(pairs).slice(0, 90);
  const start = Date.now() + 3 * 24 * 60 * 60 * 1000;
  return selected.map(([homeId, awayId], idx) => ({
    id: `match-${leagueIndex}-${idx}`,
    homeTeamId: homeId, awayTeamId: awayId,
    scheduledDate: start + idx * 3 * 24 * 60 * 60 * 1000,
    played: false, result: null, log: [],
  }));
}

function buildWorld() {
  resetRng();
  return Array.from({ length: 5 }, (_, i) => {
    const teams = TEAM_DEFINITIONS.slice(i * 10, i * 10 + 10).map((def, j) => generateTeam(def, i * 10 + j));
    const schedule = generateSchedule(teams, i);
    return {
      id: `liga-c-${i}`,
      name: `Liga C – Group ${i + 1}`,
      tier: 'C', groupIndex: i,
      teams, schedule,
      standings: teams.map(t => ({ teamId: t.id, teamName: t.name, wins: 0, losses: 0, points: 0 })),
    };
  });
}

// ── Handler ─────────────────────────────────────────────────────

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  const { secret, reset = false } = await req.json();
  const adminSecret = process.env.ADMIN_SECRET || 'courtly-admin-2024';
  if (secret !== adminSecret) return json({ error: 'Invalid admin secret' }, 401);

  try {
    const sql = neon();

    if (!reset) {
      const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM world_data`;
      if (count > 0) return json({ message: 'World already seeded. Pass reset:true to re-seed.', seeded: false });
    } else {
      await sql`DELETE FROM transfer_market`;
      await sql`DELETE FROM world_standings`;
      await sql`DELETE FROM world_matches`;
      await sql`DELETE FROM world_data`;
    }

    const leagues = buildWorld();
    const allTeams = leagues.flatMap(l => l.teams);
    const allMatches = leagues.flatMap(l => l.schedule);

    await sql`
      INSERT INTO world_data (id, data, created_at)
      VALUES (1, ${JSON.stringify({ leagues })}::jsonb, ${Date.now()})
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, created_at = EXCLUDED.created_at
    `;

    for (const league of leagues) {
      for (const match of league.schedule) {
        const homeTeam = league.teams.find(t => t.id === match.homeTeamId);
        const awayTeam = league.teams.find(t => t.id === match.awayTeamId);
        await sql`
          INSERT INTO world_matches
            (id, league_id, home_team_id, away_team_id, home_team_name, away_team_name,
             scheduled_date, played, home_score, away_score, log)
          VALUES (
            ${match.id}, ${league.id}, ${match.homeTeamId}, ${match.awayTeamId},
            ${homeTeam?.name || ''}, ${awayTeam?.name || ''},
            ${match.scheduledDate}, false, null, null, '[]'::jsonb
          )
          ON CONFLICT (id) DO NOTHING
        `;
      }
      for (const team of league.teams) {
        await sql`
          INSERT INTO world_standings (league_id, team_id, team_name, wins, losses, points)
          VALUES (${league.id}, ${team.id}, ${team.name}, 0, 0, 0)
          ON CONFLICT (league_id, team_id) DO NOTHING
        `;
      }
    }

    return json({
      message: `World seeded: ${allTeams.length} teams, ${allMatches.length} matches.`,
      seeded: true,
      summary: leagues.map(l => ({ id: l.id, name: l.name, teams: l.teams.length, matches: l.schedule.length })),
    });
  } catch (err) {
    console.error('Admin seed error:', err);
    return json({ error: err.message }, 500);
  }
};

export const config = { path: '/api/db/admin-seed' };
