// ============================================================
// Courtly – Match Brain
// Post-match intelligence: applies performance deltas to players
// and team morale based on match results and individual stats.
// ============================================================

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

/**
 * Analyze a completed match and return delta objects.
 *
 * @param {Object} matchResult - result from simulateMatch()
 * @param {string} userTeamId  - which team is the user's team
 * @returns {Object} { playerDeltas, teamDeltas, highlights }
 *   playerDeltas: { [playerId]: { recentFormDelta, attributeKey, attributeDelta } }
 *   teamDeltas:   { motivationDelta, chemistryDelta }
 *   highlights:   string[] - news-worthy events
 */
export function applyMatchBrain(matchResult, userTeamId) {
  if (!matchResult) return { playerDeltas: {}, teamDeltas: {}, highlights: [] };

  const isHome = matchResult.homeTeamId === userTeamId;
  const userScore = isHome ? matchResult.homeScore : matchResult.awayScore;
  const oppScore  = isHome ? matchResult.awayScore : matchResult.homeScore;
  const won       = userScore > oppScore;
  const margin    = Math.abs(userScore - oppScore);

  const playerStats  = matchResult.playerStats ?? {};
  const playerDeltas = {};
  const highlights   = [];

  // ── Per-player deltas ────────────────────────────────────────
  for (const [playerId, stats] of Object.entries(playerStats)) {
    const pts = stats.points ?? 0;
    const tos = stats.turnovers ?? 0;
    const ast = stats.assists ?? 0;
    const reb = stats.rebounds ?? 0;
    const blk = stats.blocks ?? 0;

    let formDelta = 0;
    let attrKey   = null;
    let attrDelta = 0;

    // Standout scoring
    if (pts >= 30) {
      formDelta += 2;
      attrKey    = 'clutchPerformance';
      attrDelta  = 0.5;
      highlights.push(`${stats.playerName} dropped ${pts} points in a massive performance!`);
    } else if (pts >= 25) {
      formDelta += 1;
      attrKey    = 'clutchPerformance';
      attrDelta  = 0.3;
    } else if (pts >= 20) {
      formDelta += 1;
    }

    // Double-double
    const doubleDouble = (pts >= 10 ? 1 : 0) + (reb >= 10 ? 1 : 0) + (ast >= 10 ? 1 : 0) >= 2;
    if (doubleDouble) {
      formDelta += 1;
      if (!attrKey) { attrKey = 'basketballIQ'; attrDelta = 0.2; }
      highlights.push(`${stats.playerName} recorded a double-double tonight.`);
    }

    // Poor performance: 0 points + multiple turnovers
    if (pts === 0 && tos >= 3) {
      formDelta -= 1;
      attrKey    = 'consistencyPerformance';
      attrDelta  = -0.2;
    } else if (pts === 0 && tos >= 2) {
      formDelta -= 1;
    }

    // Assists leader
    if (ast >= 10) {
      formDelta += 1;
      if (!attrKey) { attrKey = 'passingAccuracy'; attrDelta = 0.2; }
    }

    // Defensive standout
    if (blk >= 4) {
      formDelta += 1;
      if (!attrKey) { attrKey = 'interiorDefense'; attrDelta = 0.3; }
    }

    if (formDelta !== 0 || attrDelta !== 0) {
      playerDeltas[playerId] = {
        recentFormDelta: clamp(formDelta, -3, 3),
        attributeKey:    attrKey,
        attributeDelta:  clamp(attrDelta, -1, 1),
        playerName:      stats.playerName,
      };
    }
  }

  // ── Team-level deltas ────────────────────────────────────────
  let motivationDelta = 0;
  let chemistryDelta  = 0;

  if (won && margin >= 20) {
    motivationDelta = 4;
    chemistryDelta  = 3;
    highlights.push(`Dominant ${margin}-point win fired up the whole squad!`);
  } else if (won && margin >= 10) {
    motivationDelta = 3;
    chemistryDelta  = 2;
  } else if (won) {
    motivationDelta = 2;
    chemistryDelta  = 1;
  } else if (!won && margin >= 20) {
    motivationDelta = -6;
    chemistryDelta  = -2;
    highlights.push(`A crushing ${margin}-point loss has knocked team confidence.`);
  } else if (!won && margin >= 10) {
    motivationDelta = -4;
    chemistryDelta  = -1;
  } else {
    motivationDelta = -2;
  }

  return {
    playerDeltas,
    teamDeltas: {
      motivationDelta: clamp(motivationDelta, -8, 6),
      chemistryDelta:  clamp(chemistryDelta, -4, 4),
    },
    highlights,
  };
}

/**
 * Apply matchBrain deltas to a set of players in-place.
 * Returns the updated players array + team morale updates.
 *
 * @param {Object[]} players
 * @param {Object}   playerDeltas  - from applyMatchBrain()
 * @param {Object}   teamDeltas    - from applyMatchBrain()
 * @param {Object}   teamState     - { motivationBar, chemistryGauge }
 * @returns {{ players: Object[], motivationBar: number, chemistryGauge: number }}
 */
export function mergeBrainDeltas(players, playerDeltas, teamDeltas, teamState) {
  const updatedPlayers = players.map(p => {
    const delta = playerDeltas[p.id];
    if (!delta) return p;

    const currentForm = p.recentForm ?? 0;
    const newForm     = clamp(currentForm + (delta.recentFormDelta ?? 0), -5, 5);

    let newAttrs = { ...(p.attributes ?? {}) };
    if (delta.attributeKey && delta.attributeDelta && newAttrs[delta.attributeKey] != null) {
      newAttrs[delta.attributeKey] = clamp(
        newAttrs[delta.attributeKey] + delta.attributeDelta,
        1, 99
      );
    }

    return { ...p, recentForm: newForm, attributes: newAttrs };
  });

  const motivationBar  = clamp((teamState.motivationBar  ?? 60) + (teamDeltas.motivationDelta ?? 0), 10, 100);
  const chemistryGauge = clamp((teamState.chemistryGauge ?? 50) + (teamDeltas.chemistryDelta  ?? 0), 0, 100);

  return { players: updatedPlayers, motivationBar, chemistryGauge };
}
