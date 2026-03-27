// ============================================================
// Courtly – Game Scheduler
// Manages automatic match simulation on real-life timeline
// ============================================================

import { simulateMatch, updateTeamAfterMatch, updatePlayerAfterMatch } from './matchEngine.js';

const GAME_INTERVAL_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Generate the season schedule for a league.
 * 18 matches, every 3 days. Each team plays every other team home+away.
 */
export function generateSeasonSchedule(teams, leagueIndex = 0) {
  // Start first match TODAY at 19:00 UTC
  const today = new Date();
  today.setUTCHours(19, 0, 0, 0);
  const firstMatchDate = today.getTime();

  const matches = [];
  let matchIndex = 0;

  // Round-robin schedule: each team plays each other team twice
  const teamIds = teams.map(t => t.id);
  const n = teamIds.length;

  // Generate all home/away pairs
  const pairs = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      pairs.push({ homeId: teamIds[i], awayId: teamIds[j] });
      pairs.push({ homeId: teamIds[j], awayId: teamIds[i] });
    }
  }

  // Shuffle pairs
  const shuffled = pairs.sort(() => Math.random() - 0.5);

  // Take first 18 matches per team perspective (simplified: just first 90 unique pairs for 10 teams)
  // For a 10-team league: each team plays 18 games = 90 total games
  // We'll generate matches spaced 3 days apart
  const allMatches = shuffled.slice(0, 90); // 10 teams * 18 games / 2 (since each game involves 2 teams) = 90

  allMatches.forEach((pair, idx) => {
    matches.push({
      id: `match-${leagueIndex}-${idx}-${Date.now()}`,
      homeTeamId: pair.homeId,
      awayTeamId: pair.awayId,
      scheduledDate: firstMatchDate + idx * GAME_INTERVAL_DAYS * MS_PER_DAY,
      played: false,
      result: null,
      log: [],
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
  const matchEnd = matchStart + 2 * 60 * 60 * 1000; // 2 hours
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
      const result = simulateMatch(homeTeam, awayTeam, match.scheduledDate);
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
