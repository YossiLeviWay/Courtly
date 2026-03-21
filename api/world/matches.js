// GET  /api/world/matches  — returns every match row (played + unplayed)
// POST /api/world/matches  — records a match result and updates standings (JWT required)

const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
  const sql = neon(process.env.POSTGRES_URL);

  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM world_matches ORDER BY scheduled_date ASC`;
    return res.json({ matches: rows });
  }

  if (req.method === 'POST') {
    const token = (req.headers.authorization || '').split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorised' });
    try { jwt.verify(token, process.env.JWT_SECRET); } catch { return res.status(401).json({ error: 'Invalid token' }); }

    const {
      matchId, leagueId,
      homeTeamId, awayTeamId,
      homeTeamName, awayTeamName,
      homeScore, awayScore,
      log = [],
    } = req.body || {};

    if (!matchId || !leagueId) return res.status(400).json({ error: 'matchId and leagueId required' });

    // Mark match as played
    await sql`
      UPDATE world_matches
      SET played = true, home_score = ${homeScore}, away_score = ${awayScore}, log = ${JSON.stringify(log)}::jsonb
      WHERE id = ${matchId}
    `;

    const homeWon = homeScore > awayScore;
    const awayWon = awayScore > homeScore;

    // Upsert standings for home team
    await sql`
      INSERT INTO world_standings (league_id, team_id, team_name, wins, losses, points)
      VALUES (${leagueId}, ${homeTeamId}, ${homeTeamName || ''}, ${homeWon ? 1 : 0}, ${homeWon ? 0 : 1}, ${homeWon ? 3 : 0})
      ON CONFLICT (league_id, team_id) DO UPDATE
        SET wins    = world_standings.wins    + ${homeWon ? 1 : 0},
            losses  = world_standings.losses  + ${homeWon ? 0 : 1},
            points  = world_standings.points  + ${homeWon ? 3 : 0},
            team_name = COALESCE(NULLIF(${homeTeamName || ''}, ''), world_standings.team_name)
    `;

    // Upsert standings for away team
    await sql`
      INSERT INTO world_standings (league_id, team_id, team_name, wins, losses, points)
      VALUES (${leagueId}, ${awayTeamId}, ${awayTeamName || ''}, ${awayWon ? 1 : 0}, ${awayWon ? 0 : 1}, ${awayWon ? 3 : 0})
      ON CONFLICT (league_id, team_id) DO UPDATE
        SET wins    = world_standings.wins    + ${awayWon ? 1 : 0},
            losses  = world_standings.losses  + ${awayWon ? 0 : 1},
            points  = world_standings.points  + ${awayWon ? 3 : 0},
            team_name = COALESCE(NULLIF(${awayTeamName || ''}, ''), world_standings.team_name)
    `;

    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
