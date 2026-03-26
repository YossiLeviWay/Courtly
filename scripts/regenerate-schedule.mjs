/**
 * Courtly – Regenerate Season Schedule
 *
 * Deletes all existing match documents from Firestore and creates a fresh
 * round-robin schedule starting TOMORROW at 19:00 UTC, every 3 days.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT_KEY='<json>' node scripts/regenerate-schedule.mjs
 *
 * Or via GitHub Actions workflow (see .github/workflows/regenerate-schedule.yml).
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore }        from 'firebase-admin/firestore';

// ── Firebase init ──────────────────────────────────────────────

let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
} else {
  const fs = await import('fs');
  serviceAccount = JSON.parse(fs.readFileSync('./scripts/serviceAccountKey.json', 'utf8'));
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── Helpers ───────────────────────────────────────────────────

const GAME_INTERVAL_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function batchDelete(db, refs) {
  const CHUNK = 400;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = db.batch();
    refs.slice(i, i + CHUNK).forEach(r => batch.delete(r));
    await batch.commit();
  }
}

async function batchWrite(db, items) {
  const CHUNK = 400;
  for (let i = 0; i < items.length; i += CHUNK) {
    const batch = db.batch();
    items.slice(i, i + CHUNK).forEach(({ ref, data }) => batch.set(ref, data));
    await batch.commit();
  }
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  console.log('Fetching teams…');
  const teamsSnap = await db.collection('teams').get();
  const teams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (teams.length === 0) {
    console.error('No teams found in Firestore. Aborting.');
    process.exit(1);
  }

  // Group teams by league
  const byLeague = {};
  teams.forEach(t => {
    const lid = t.leagueId || 'default';
    if (!byLeague[lid]) byLeague[lid] = [];
    byLeague[lid].push(t);
  });

  console.log(`Found ${teams.length} teams across ${Object.keys(byLeague).length} league(s).`);

  // Delete existing match docs
  console.log('Deleting existing matches…');
  const existingSnap = await db.collection('matches').get();
  await batchDelete(db, existingSnap.docs.map(d => d.ref));
  console.log(`Deleted ${existingSnap.size} match(es).`);

  // Also reset standings
  console.log('Resetting standings…');
  const standingsSnap = await db.collection('standings').get();
  const standingItems = [];
  standingsSnap.docs.forEach(d => {
    const data = d.data();
    standingItems.push({
      ref: d.ref,
      data: { ...data, wins: 0, losses: 0, points: 0 },
    });
  });
  if (standingItems.length > 0) await batchWrite(db, standingItems);
  console.log(`Reset ${standingItems.length} standing(s).`);

  // Generate new schedule starting tomorrow at 19:00 UTC
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(19, 0, 0, 0);
  const firstMatch = tomorrow.getTime();

  const newMatches = [];
  let globalIdx = 0;

  for (const [leagueId, leagueTeams] of Object.entries(byLeague)) {
    const teamIds = leagueTeams.map(t => t.id);
    const n = teamIds.length;

    // Build home/away pairs (round-robin)
    const pairs = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        pairs.push({ homeId: teamIds[i], awayId: teamIds[j] });
        pairs.push({ homeId: teamIds[j], awayId: teamIds[i] });
      }
    }
    const shuffled = shuffle(pairs).slice(0, Math.min(pairs.length, n * 18));

    shuffled.forEach((pair, idx) => {
      const scheduledDate = firstMatch + (globalIdx + idx) * GAME_INTERVAL_DAYS * MS_PER_DAY;

      const homeTeam = leagueTeams.find(t => t.id === pair.homeId);
      const awayTeam = leagueTeams.find(t => t.id === pair.awayId);

      newMatches.push({
        ref: db.collection('matches').doc(),
        data: {
          leagueId,
          homeTeamId:   pair.homeId,
          awayTeamId:   pair.awayId,
          homeTeamName: homeTeam?.name || pair.homeId,
          awayTeamName: awayTeam?.name || pair.awayId,
          scheduledDate,
          played:       false,
          homeScore:    null,
          awayScore:    null,
          log:          [],
        },
      });
    });

    globalIdx += shuffled.length;
  }

  console.log(`Writing ${newMatches.length} new match(es)…`);
  await batchWrite(db, newMatches);

  const firstDate = new Date(firstMatch).toUTCString();
  console.log(`Done! Schedule starts: ${firstDate}`);
  console.log(`First match: ${newMatches[0]?.data.homeTeamName} vs ${newMatches[0]?.data.awayTeamName}`);
}

main().catch(err => { console.error(err); process.exit(1); });
