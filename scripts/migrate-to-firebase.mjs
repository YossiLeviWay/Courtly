import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NEON_URL = process.env.NEON_URL;
if (!NEON_URL) {
  console.error('ERROR: NEON_URL is required.');
  process.exit(1);
}

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  }
  const filePath = path.join(__dirname, 'serviceAccountKey.json');
  if (existsSync(filePath)) return JSON.parse(readFileSync(filePath, 'utf8'));
  process.exit(1);
}

const log = (msg) => console.log(`[migrate] ${msg}`);
const ensureArray = (obj) => (Array.isArray(obj) ? obj : Object.values(obj || {}));

async function batchSet(db, items) {
  if (!items.length) return;
  const chunks = [];
  for (let i = 0; i < items.length; i += 400) chunks.push(items.slice(i, i + 400));
  for (const chunk of chunks) {
    const batch = db.batch();
    for (const { ref, data } of chunk) batch.set(ref, data);
    await batch.commit();
  }
}

async function main() {
  const serviceAccount = loadServiceAccount();
  const admin = (await import('firebase-admin')).default;
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'courtly-660c3' });
  const db = admin.firestore();

  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(NEON_URL);

  log('Fetching data from Neon...');
  const worldRows = await sql`SELECT data FROM world_data WHERE id = 1`;
  const worldData = worldRows[0]?.data ?? {};
  const matches = (await sql`SELECT * FROM world_matches`) || [];
  const standings = (await sql`SELECT * FROM world_standings`) || [];
  const users = (await sql`SELECT * FROM users`) || [];
  const userStates = (await sql`SELECT * FROM user_team_state`) || [];
  const transferMarket = (await sql`SELECT * FROM transfer_market`) || [];

  // Migration: Leagues, Teams, Players, Staff
  const leagues = ensureArray(worldData.leagues);
  if (leagues.length) {
    const leagueItems = [], teamItems = [], playerItems = [], staffItems = [];

    for (const league of leagues) {
      leagueItems.push({ ref: db.collection('leagues').doc(String(league.id)), data: { id: league.id, name: league.name, tier: league.tier } });
      
      for (const team of ensureArray(league.teams)) {
        teamItems.push({ 
          ref: db.collection('teams').doc(String(team.id)), 
          data: { id: team.id, name: team.name, city: team.city, leagueId: league.id, avatar: team.avatar, prestige: team.prestige } 
        });

        for (const player of ensureArray(team.players)) {
          if (player?.id) playerItems.push({ ref: db.collection('players').doc(String(player.id)), data: { ...player, teamId: team.id, leagueId: league.id } });
        }
        for (const s of ensureArray(team.staff)) {
          if (s?.id) staffItems.push({ ref: db.collection('staff').doc(String(s.id)), data: { ...s, teamId: team.id, leagueId: league.id } });
        }
      }
    }
    await batchSet(db, leagueItems);
    await batchSet(db, teamItems);
    await batchSet(db, playerItems);
    await batchSet(db, staffItems);
    log(`Migrated ${leagues.length} leagues and their sub-data.`);
  }

  // Simple tables
  await batchSet(db, matches.map(m => ({ ref: db.collection('matches').doc(String(m.id)), data: { ...m, log: m.log || [] } })));
  await batchSet(db, standings.map(s => ({ ref: db.collection('standings').doc(`${s.league_id}_${s.team_id}`), data: s })));
  await batchSet(db, users.map(u => ({ ref: db.collection('users').doc(String(u.id)), data: u })));
  await batchSet(db, userStates.map(s => ({ ref: db.collection('user_team_state').doc(String(s.user_id)), data: s })));
  await batchSet(db, transferMarket.map(t => ({ ref: db.collection('transfer_market').doc(String(t.id)), data: t })));

  log('Migration complete ✓');
  process.exit(0);
}

main().catch(err => { console.error('[migrate] FATAL:', err); process.exit(1); });
