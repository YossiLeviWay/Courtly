/**
 * Courtly — One-time migration script: Neon PostgreSQL → Firebase Firestore
 *
 * Credentials (pick one):
 *   A) Environment variable (CI / GitHub Actions):
 *        FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
 *
 *   B) Local file (for running on your machine):
 *        Save scripts/serviceAccountKey.json  (already in .gitignore)
 *
 * Run locally:
 *   node scripts/migrate-to-firebase.mjs
 *
 * Run via GitHub Actions:
 *   Trigger the "Migrate to Firebase" workflow manually from the Actions tab.
 *   (Requires FIREBASE_SERVICE_ACCOUNT_KEY and NEON_URL secrets.)
 *
 * What this script does:
 *   - Reads world_data, world_matches, world_standings, users,
 *     user_team_state, and transfer_market from Neon PostgreSQL
 *   - Flattens and restructures data into Firestore collections:
 *       leagues / teams / players / staff / matches / standings
 *       users / user_team_state / transfer_market
 *   - Uses batched writes (≤ 500 ops/batch) to stay within Firestore limits
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────

const NEON_URL = process.env.NEON_URL;
if (!NEON_URL) {
  console.error('ERROR: NEON_URL environment variable is required.');
  process.exit(1);
}

/**
 * Load the Firebase service account object.
 * Priority: FIREBASE_SERVICE_ACCOUNT_KEY env var → local serviceAccountKey.json file.
 */
function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } catch {
      console.error('ERROR: FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON.');
      process.exit(1);
    }
  }

  const filePath = path.join(__dirname, 'serviceAccountKey.json');
  if (existsSync(filePath)) {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  }

  console.error(`
ERROR: No Firebase credentials found.

Provide one of:
  A) Set the FIREBASE_SERVICE_ACCOUNT_KEY environment variable with the JSON content.
  B) Save the key file as: scripts/serviceAccountKey.json

To get the key:
  Firebase Console → Project Settings → Service Accounts → Generate new private key
`);
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(msg) { console.log(`[migrate] ${msg}`); }
function warn(msg) { console.warn(`[migrate] ⚠  ${msg}`); }

/** Split an array into chunks of size n (Firestore batch limit = 500) */
function chunks(arr, n = 400) {
  const result = [];
  for (let i = 0; i < arr.length; i += n) result.push(arr.slice(i, i + n));
  return result;
}

/**
 * Commit an array of { ref, data } objects in batched writes.
 * Each entry is a SET (merge: false) operation.
 */
async function batchSet(db, items) {
  if (!items.length) return;
  for (const chunk of chunks(items)) {
    const batch = db.batch();
    for (const { ref, data } of chunk) batch.set(ref, data);
    await batch.commit();
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Load credentials and init Firebase Admin
  const serviceAccount = loadServiceAccount();
  const admin = (await import('firebase-admin')).default;
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'courtly-660c3',
  });
  const db = admin.firestore();
  log('Firebase Admin initialised ✓');

  // 3. Connect to Neon PostgreSQL
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(NEON_URL);
  log('Neon connection established ✓');

  // ── Read all tables ─────────────────────────────────────────────────────────

  log('Reading world_data …');
  const worldRows = await sql`SELECT data FROM world_data WHERE id = 1`;
  const worldData = worldRows[0]?.data ?? null;
  if (!worldData) { warn('world_data is empty — skipping leagues/teams/players/staff'); }

  log('Reading world_matches …');
  const matches = await sql`SELECT * FROM world_matches`;

  log('Reading world_standings …');
  const standings = await sql`SELECT * FROM world_standings`;

  log('Reading users …');
  const users = await sql`SELECT * FROM users`;

  log('Reading user_team_state …');
  const userStates = await sql`SELECT * FROM user_team_state`;

  log('Reading transfer_market …');
  const transferMarket = await sql`SELECT * FROM transfer_market`;

  // ── Migrate: leagues / teams / players / staff ──────────────────────────────

  if (worldData?.leagues) {
    const leagueItems = [];
    const teamItems   = [];
    const playerItems = [];
    const staffItems  = [];

    for (const league of worldData.leagues) {
      // League document — only metadata
      leagueItems.push({
        ref: db.collection('leagues').doc(String(league.id)),
        data: {
          id:   league.id,
          name: league.name ?? '',
          tier: league.tier ?? null,
        },
      });

      for (const team of league.teams ?? []) {
        // Team document — no nested players/staff
        teamItems.push({
          ref: db.collection('teams').doc(String(team.id)),
          data: {
            id:       team.id,
            name:     team.name     ?? '',
            city:     team.city     ?? '',
            leagueId: league.id,
            // lightweight extras that live on the team
            avatar:      team.avatar      ?? null,
            avatarColor: team.avatarColor ?? null,
            prestige:    team.prestige    ?? null,
          },
        });

        // Players — each in their own document
        for (const player of team.players ?? []) {
          if (!player?.id) continue;
          playerItems.push({
            ref: db.collection('players').doc(String(player.id)),
            data: { ...player, teamId: team.id, leagueId: league.id },
          });
        }

        // Staff — each in their own document
        for (const member of team.staff ?? []) {
          if (!member?.id) continue;
          staffItems.push({
            ref: db.collection('staff').doc(String(member.id)),
            data: { ...member, teamId: team.id, leagueId: league.id },
          });
        }
      }
    }

    log(`Writing ${leagueItems.length} leagues …`);
    await batchSet(db, leagueItems);

    log(`Writing ${teamItems.length} teams …`);
    await batchSet(db, teamItems);

    log(`Writing ${playerItems.length} players …`);
    await batchSet(db, playerItems);

    log(`Writing ${staffItems.length} staff members …`);
    await batchSet(db, staffItems);
  }

  // ── Migrate: matches ────────────────────────────────────────────────────────

  log(`Writing ${matches.length} matches …`);
  const matchItems = matches.map((m) => {
    // Keep log inside the document (array of strings/events).
    // If your logs become very large in future, move them to a sub-collection.
    return {
      ref: db.collection('matches').doc(String(m.id)),
      data: {
        id:           m.id,
        leagueId:     m.league_id,
        homeTeamId:   m.home_team_id,
        awayTeamId:   m.away_team_id,
        homeTeamName: m.home_team_name,
        awayTeamName: m.away_team_name,
        scheduledDate: m.scheduled_date,
        played:        m.played ?? false,
        homeScore:     m.home_score ?? null,
        awayScore:     m.away_score ?? null,
        log:           m.log ?? [],
      },
    };
  });
  await batchSet(db, matchItems);

  // ── Migrate: standings ──────────────────────────────────────────────────────

  log(`Writing ${standings.length} standing records …`);
  const standingItems = standings.map((s) => ({
    ref: db.collection('standings').doc(`${s.league_id}_${s.team_id}`),
    data: {
      leagueId: s.league_id,
      teamId:   s.team_id,
      teamName: s.team_name,
      wins:     s.wins     ?? 0,
      losses:   s.losses   ?? 0,
      points:   s.points   ?? 0,
    },
  }));
  await batchSet(db, standingItems);

  // ── Migrate: users ──────────────────────────────────────────────────────────

  log(`Writing ${users.length} users …`);
  const userItems = users.map((u) => ({
    ref: db.collection('users').doc(String(u.id)),
    data: {
      id:           u.id,
      email:        u.email,
      username:     u.username ?? '',
      passwordHash: u.password_hash,   // keep hashed — never store plain text
      createdAt:    u.created_at,
    },
  }));
  await batchSet(db, userItems);

  // ── Migrate: user_team_state ────────────────────────────────────────────────

  log(`Writing ${userStates.length} user team states …`);
  const stateItems = userStates.map((s) => ({
    ref: db.collection('user_team_state').doc(String(s.user_id)),
    data: {
      userId:          s.user_id,
      teamId:          s.team_id,
      budget:          s.budget,
      facilities:      s.facilities      ?? {},
      tactics:         s.tactics         ?? {},
      playersState:    s.players_state   ?? [],
      fanCount:        s.fan_count,
      fanEnthusiasm:   s.fan_enthusiasm,
      ticketPrice:     s.ticket_price,
      teamExposure:    s.team_exposure,
      chemistryGauge:  s.chemistry_gauge,
      momentumBar:     s.momentum_bar,
      reputation:      s.reputation,
      matchHistory:    s.match_history   ?? [],
      seasonRecord:    s.season_record   ?? { wins: 0, losses: 0 },
      profileData:     s.profile_data    ?? {},
      updatedAt:       s.updated_at,
    },
  }));
  await batchSet(db, stateItems);

  // ── Migrate: transfer_market ────────────────────────────────────────────────

  log(`Writing ${transferMarket.length} transfer market listings …`);
  const transferItems = transferMarket.map((t) => ({
    ref: db.collection('transfer_market').doc(String(t.id)),
    data: {
      id:              t.id,
      playerId:        t.player_id,
      playerName:      t.player_name,
      position:        t.position,
      overallRating:   t.overall_rating,
      age:             t.age,
      nationality:     t.nationality,
      askingPrice:     t.asking_price,
      sellingTeamId:   t.selling_team_id,
      sellingTeamName: t.selling_team_name,
      listedAt:        t.listed_at,
      playerData:      t.player_data ?? {},
    },
  }));
  await batchSet(db, transferItems);

  // ── Done ────────────────────────────────────────────────────────────────────

  log('');
  log('Migration complete! Summary:');
  log(`  leagues         ${worldData?.leagues?.length ?? 0}`);
  const totalTeams   = worldData?.leagues?.reduce((n, l) => n + (l.teams?.length ?? 0), 0) ?? 0;
  const totalPlayers = worldData?.leagues?.reduce((n, l) => n + l.teams.reduce((m, t) => m + (t.players?.length ?? 0), 0), 0) ?? 0;
  const totalStaff   = worldData?.leagues?.reduce((n, l) => n + l.teams.reduce((m, t) => m + (t.staff?.length ?? 0), 0), 0) ?? 0;
  log(`  teams           ${totalTeams}`);
  log(`  players         ${totalPlayers}`);
  log(`  staff           ${totalStaff}`);
  log(`  matches         ${matches.length}`);
  log(`  standings       ${standings.length}`);
  log(`  users           ${users.length}`);
  log(`  user states     ${userStates.length}`);
  log(`  transfer market ${transferMarket.length}`);
  log('');
  log('Your data is now in Firestore. Next step: update the app to read from Firebase.');

  process.exit(0);
}

main().catch((err) => {
  console.error('[migrate] FATAL:', err);
  process.exit(1);
});
