/**
 * Courtly – Regenerate Season Schedule
 *
 * • Deletes all existing matches and match_logs from Firestore
 * • Resets all standings to 0-0
 * • Generates a proper round-robin schedule (every team plays each other twice)
 *   with a strict 3-day (72 h) interval between rounds, all UTC
 * • Pre-simulates every fixture and saves the full game log to
 *   match_logs/{matchId} so the Live viewer can reveal events in real-time
 *   and every user sees the same play at the same second
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT_KEY='<json>' node scripts/regenerate-schedule.mjs
 *
 * Or via GitHub Actions workflow (.github/workflows/regenerate-schedule.yml).
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore }        from 'firebase-admin/firestore';
import { simulateMatch, GAME_DURATION_SEC } from '../src/engine/matchEngine.js';

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

// ── Constants ─────────────────────────────────────────────────

const GAME_INTERVAL_DAYS = 3;
const MS_PER_DAY         = 24 * 60 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────────

async function batchDelete(refs) {
  const CHUNK = 400;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = db.batch();
    refs.slice(i, i + CHUNK).forEach(r => batch.delete(r));
    await batch.commit();
  }
}

async function batchWrite(items) {
  const CHUNK = 400;
  for (let i = 0; i < items.length; i += CHUNK) {
    const batch = db.batch();
    items.slice(i, i + CHUNK).forEach(({ ref, data }) => batch.set(ref, data));
    await batch.commit();
  }
}

/**
 * Standard Berger round-robin algorithm.
 * Returns rounds[][{ homeTeam, awayTeam }].
 * Guarantees no team plays twice per round.
 * Full season = first-half + return-leg (home↔away swapped).
 */
function buildRoundRobinRounds(teams) {
  const arr = [...teams];
  if (arr.length % 2 !== 0) arr.push(null); // bye slot for odd count

  const numRounds = arr.length - 1;
  const half      = arr.length / 2;
  const firstHalf = [];
  const rot       = [...arr];

  for (let r = 0; r < numRounds; r++) {
    const round = [];
    for (let i = 0; i < half; i++) {
      const t1 = rot[i];
      const t2 = rot[rot.length - 1 - i];
      if (t1 && t2) round.push({ homeTeam: t1, awayTeam: t2 });
    }
    firstHalf.push(round);
    rot.splice(1, 0, rot.pop()); // keep rot[0] fixed, rotate the rest
  }

  const secondHalf = firstHalf.map(round =>
    round.map(({ homeTeam, awayTeam }) => ({ homeTeam: awayTeam, awayTeam: homeTeam }))
  );

  return [...firstHalf, ...secondHalf];
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  // ── 1. Load teams + players ───────────────────────────────
  console.log('Fetching teams and players…');
  const [teamsSnap, playersSnap] = await Promise.all([
    db.collection('teams').get(),
    db.collection('players').get(),
  ]);

  if (teamsSnap.empty) {
    console.error('No teams found in Firestore. Aborting.');
    process.exit(1);
  }

  const playersByTeam = {};
  playersSnap.docs.forEach(d => {
    const p = { id: d.id, ...d.data() };
    if (!playersByTeam[p.teamId]) playersByTeam[p.teamId] = [];
    playersByTeam[p.teamId].push(p);
  });

  const teams = teamsSnap.docs.map(d => {
    const t = { id: d.id, ...d.data() };
    // Attach players so simulateMatch works correctly
    t.players = (playersByTeam[t.id] || []).map(p => ({
      ...p,
      injuryStatus: p.injuryStatus || 'healthy',
      fatigue:      p.fatigue      ?? 10,
      motivation:   p.motivation   ?? 70,
    }));
    return t;
  });

  const byLeague = {};
  teams.forEach(t => {
    const lid = t.leagueId || 'default';
    if (!byLeague[lid]) byLeague[lid] = [];
    byLeague[lid].push(t);
  });

  console.log(`${teams.length} teams across ${Object.keys(byLeague).length} league(s).`);

  // ── 2. Clear existing matches and match_logs ──────────────
  console.log('Deleting existing matches…');
  const [existingMatches, existingLogs] = await Promise.all([
    db.collection('matches').get(),
    db.collection('match_logs').get(),
  ]);
  await Promise.all([
    batchDelete(existingMatches.docs.map(d => d.ref)),
    batchDelete(existingLogs.docs.map(d => d.ref)),
  ]);
  console.log(`Deleted ${existingMatches.size} match(es) and ${existingLogs.size} log(s).`);

  // ── 3. Reset standings ────────────────────────────────────
  console.log('Resetting standings…');
  const standingsSnap = await db.collection('standings').get();
  if (!standingsSnap.empty) {
    await batchWrite(standingsSnap.docs.map(d => ({
      ref:  d.ref,
      data: { ...d.data(), wins: 0, losses: 0, points: 0 },
    })));
  }
  console.log(`Reset ${standingsSnap.size} standing(s).`);

  // ── 4. Generate schedule + pre-simulate logs ──────────────
  const today = new Date();
  today.setUTCHours(19, 0, 0, 0);
  const firstRoundTs = today.getTime();

  const newMatches = [];
  const newLogs    = [];
  let totalFixtures = 0;

  for (const [leagueId, leagueTeams] of Object.entries(byLeague)) {
    const rounds = buildRoundRobinRounds(leagueTeams);

    rounds.forEach((round, roundIdx) => {
      const roundTs = firstRoundTs + roundIdx * GAME_INTERVAL_DAYS * MS_PER_DAY;

      round.forEach(({ homeTeam, awayTeam }) => {
        const matchRef = db.collection('matches').doc();
        const matchId  = matchRef.id;

        // ── Match document (metadata only, no log) ──────────
        newMatches.push({
          ref:  matchRef,
          data: {
            id:           matchId,
            leagueId,
            homeTeamId:   homeTeam.id,
            awayTeamId:   awayTeam.id,
            homeTeamName: homeTeam.name || homeTeam.id,
            awayTeamName: awayTeam.name || awayTeam.id,
            scheduledDate: roundTs,
            round:         roundIdx + 1,
            played:        false,
            homeScore:     null,
            awayScore:     null,
          },
        });

        // ── Pre-simulate the game and store in match_logs ───
        try {
          const result = simulateMatch(homeTeam, awayTeam, new Date(roundTs));
          newLogs.push({
            ref:  db.collection('match_logs').doc(matchId),
            data: {
              matchId,
              leagueId,
              homeTeamId:    homeTeam.id,
              awayTeamId:    awayTeam.id,
              homeTeamName:  homeTeam.name || homeTeam.id,
              awayTeamName:  awayTeam.name || awayTeam.id,
              homeScore:     result.homeScore,
              awayScore:     result.awayScore,
              events:        result.log         || [],
              playerStats:   result.playerStats || {},
              quarterScores: result.quarterScores || [],
              gameDurationSec: GAME_DURATION_SEC,
              scheduledDate:  roundTs,
              savedAt:        Date.now(),
            },
          });
        } catch (simErr) {
          console.warn(`  ⚠ Simulation failed for ${homeTeam.name} vs ${awayTeam.name}:`, simErr.message);
        }

        totalFixtures++;
      });
    });

    const teamCount = leagueTeams.length;
    const roundCount = rounds.length;
    console.log(`League ${leagueId}: ${teamCount} teams → ${roundCount} rounds, ${totalFixtures} fixtures so far.`);
  }

  // ── 5. Write to Firestore ─────────────────────────────────
  console.log(`Writing ${newMatches.length} match document(s)…`);
  await batchWrite(newMatches);

  console.log(`Writing ${newLogs.length} pre-generated game log(s)…`);
  await batchWrite(newLogs);

  const firstDate = new Date(firstRoundTs).toUTCString();
  console.log(`\n✅ Done! Season starts: ${firstDate}`);
  console.log(`   ${newMatches.length} fixtures scheduled across ${Object.keys(byLeague).length} league(s).`);
  console.log(`   ${newLogs.length} game logs pre-generated (live sync ready).`);
}

main().catch(err => { console.error(err); process.exit(1); });
