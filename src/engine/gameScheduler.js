// ============================================================
// Courtly – Game Scheduler
// Manages automatic match simulation on real-life timeline
// ============================================================

import { simulateMatch, updateTeamAfterMatch, updatePlayerAfterMatch, GAME_DURATION_SEC } from './matchEngine.js';

export const GAME_INTERVAL_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Standard Berger round-robin.
 * Returns rounds[][{ homeTeam, awayTeam }].
 * Guarantees no team plays twice in the same round.
 * Full season = first-half rounds + return-leg rounds (home↔away).
 */
export function buildRoundRobinRounds(teams) {
  const arr = [...teams];
  if (arr.length % 2 !== 0) arr.push(null); // bye for odd count

  const numRounds = arr.length - 1;
  const half = arr.length / 2;
  const firstHalf = [];
  const rot = [...arr];

  for (let r = 0; r < numRounds; r++) {
    const round = [];
    for (let i = 0; i < half; i++) {
      const t1 = rot[i];
      const t2 = rot[rot.length - 1 - i];
      if (t1 && t2) round.push({ homeTeam: t1, awayTeam: t2 });
    }
    firstHalf.push(round);
    rot.splice(1, 0, rot.pop()); // keep rot[0] fixed, rotate rest
  }

  // Return leg: same matchups, home/away swapped
  const secondHalf = firstHalf.map(round =>
    round.map(({ homeTeam, awayTeam }) => ({ homeTeam: awayTeam, awayTeam: homeTeam }))
  );

  return [...firstHalf, ...secondHalf];
}

/**
 * Generate the full season schedule (client-side, for new users / display).
 * For the authoritative Firestore schedule use regenerate-schedule.mjs.
 */
export function generateSeasonSchedule(teams, leagueIndex = 0) {
  const today = new Date();
  today.setUTCHours(19, 0, 0, 0);
  const firstRoundTs = today.getTime();

  const rounds = buildRoundRobinRounds(teams);
  const matches = [];

  rounds.forEach((round, roundIdx) => {
    const roundTs = firstRoundTs + roundIdx * GAME_INTERVAL_DAYS * MS_PER_DAY;
    round.forEach(({ homeTeam, awayTeam }) => {
      matches.push({
        id: `m-${leagueIndex}-r${roundIdx}-${homeTeam.id}-${awayTeam.id}`,
        homeTeamId:    homeTeam.id,
        awayTeamId:    awayTeam.id,
        homeTeamName:  homeTeam.name || homeTeam.id,
        awayTeamName:  awayTeam.name || awayTeam.id,
        scheduledDate: roundTs,
        round:         roundIdx + 1,
        played:        false,
        result:        null,
      });
    });
  });

  return matches;
}

/**
 * Get the next match involving a team
 */
export function getNextMatch(teamId, schedule) {
  if (!schedule) return null;
  const now = Date.now();
  return schedule
    .filter(m => !m.played && (m.homeTeamId === teamId || m.awayTeamId === teamId))
    .sort((a, b) => a.scheduledDate - b.scheduledDate)[0] || null;
}

/**
 * Get matches that should have been played by now but haven't been
 */
export function getPendingMatches(schedule) {
  const now = Date.now();
  return schedule
    .filter(m => !m.played && m.scheduledDate <= now)
    .sort((a, b) => a.scheduledDate - b.scheduledDate);
}

/**
 * Check if a match is currently live (within the 40-minute window + breaks)
 * Real match duration: ~2 hours (40 min game + timeouts + breaks)
 */
export function isMatchCurrentlyLive(match) {
  if (!match || match.played) return false;
  const now = Date.now();
  const matchStart = match.scheduledDate;
  const matchEnd = matchStart + GAME_DURATION_SEC * 1000;
  return now >= matchStart && now < matchEnd;
}

/**
 * Process all pending matches (called when app loads or user logs in)
 * Simulates all matches that should have occurred
 */
export function processPendingMatches(allTeams, schedule) {
  if (!schedule || !allTeams.length) return { updatedTeams: allTeams, updatedSchedule: schedule, processedMatchData: [] };

  const pending = getPendingMatches(schedule);
  let updatedTeams = [...allTeams];
  let updatedSchedule = [...schedule];
  const processedMatchData = [];

  for (const match of pending) {
    const homeTeam = updatedTeams.find(t => t.id === match.homeTeamId);
    const awayTeam = updatedTeams.find(t => t.id === match.awayTeamId);

    if (!homeTeam || !awayTeam) continue;

    try {
      const result = simulateMatch(homeTeam, awayTeam, match.scheduledDate, match.id);
      // Attach the schedule match ID so historyEntry and log storage are linked
      result.matchId = match.id;

      // Update teams
      const updatedHome = updateTeamAfterMatch(homeTeam, result, true);
      const updatedAway = updateTeamAfterMatch(awayTeam, result, false);

      // Update player stats
      if (result.playerStats) {
        updatedHome.players = updatedHome.players.map(p => {
          const stats = result.playerStats[p.id];
          if (stats) return updatePlayerAfterMatch(p, stats);
          return p;
        });
        updatedAway.players = updatedAway.players.map(p => {
          const stats = result.playerStats[p.id];
          if (stats) return updatePlayerAfterMatch(p, stats);
          return p;
        });
      }

      updatedTeams = updatedTeams.map(t => {
        if (t.id === homeTeam.id) return updatedHome;
        if (t.id === awayTeam.id) return updatedAway;
        return t;
      });

      // Mark match as played
      updatedSchedule = updatedSchedule.map(m =>
        m.id === match.id
          ? { ...m, played: true, result: { homeScore: result.homeScore, awayScore: result.awayScore } }
          : m
      );

      // Collect log data to save to match_logs collection (separate from user_team_state)
      processedMatchData.push({
        matchId:      match.id,
        leagueId:     match.leagueId,
        homeTeamId:   match.homeTeamId,
        awayTeamId:   match.awayTeamId,
        homeTeamName: match.homeTeamName,
        awayTeamName: match.awayTeamName,
        homeScore:    result.homeScore,
        awayScore:    result.awayScore,
        events:       result.log          || [],
        playerStats:  result.playerStats  || {},
        quarterScores: result.quarterScores || [],
      });
    } catch (e) {
      console.warn('Match simulation error:', e);
    }
  }

  return { updatedTeams, updatedSchedule, processedMatchData };
}

/**
 * Format match date for display
 */
export function formatMatchDate(timestamp) {
  return new Date(timestamp).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get time until next match
 */
export function getTimeUntilMatch(match) {
  if (!match) return null;
  const diff = match.scheduledDate - Date.now();
  if (diff <= 0) return 'Now';

  const days = Math.floor(diff / MS_PER_DAY);
  const hours = Math.floor((diff % MS_PER_DAY) / (60 * 60 * 1000));
  const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
