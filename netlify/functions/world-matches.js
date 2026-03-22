import { neon } from '@netlify/neon';
import jwt from 'jsonwebtoken';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  const sql = neon();

  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM world_matches ORDER BY scheduled_date ASC`;
    return json({ matches: rows });
  }

  if (req.method === 'POST') {
    const token = (req.headers.get('authorization') || '').split(' ')[1];
    if (!token) return json({ error: 'Unauthorised' }, 401);
    try { jwt.verify(token, process.env.JWT_SECRET); } catch { return json({ error: 'Invalid token' }, 401); }

    const {
      matchId, leagueId,
      homeTeamId, awayTeamId,
      homeTeamName, awayTeamName,
      homeScore, awayScore,
      log = [],
    } = await req.json();

    if (!matchId || !leagueId) return json({ error: 'matchId and leagueId required' }, 400);

    await sql`
      UPDATE world_matches
      SET played = true, home_score = ${homeScore}, away_score = ${awayScore},
          log = ${JSON.stringify(log)}::jsonb
      WHERE id = ${matchId}
    `;

    const homeWon = homeScore > awayScore;
    const awayWon = awayScore > homeScore;

    await sql`
      INSERT INTO world_standings (league_id, team_id, team_name, wins, losses, points)
      VALUES (${leagueId}, ${homeTeamId}, ${homeTeamName || ''}, ${homeWon ? 1 : 0}, ${homeWon ? 0 : 1}, ${homeWon ? 3 : 0})
      ON CONFLICT (league_id, team_id) DO UPDATE
        SET wins    = world_standings.wins    + ${homeWon ? 1 : 0},
            losses  = world_standings.losses  + ${homeWon ? 0 : 1},
            points  = world_standings.points  + ${homeWon ? 3 : 0},
            team_name = COALESCE(NULLIF(${homeTeamName || ''}, ''), world_standings.team_name)
    `;

    await sql`
      INSERT INTO world_standings (league_id, team_id, team_name, wins, losses, points)
      VALUES (${leagueId}, ${awayTeamId}, ${awayTeamName || ''}, ${awayWon ? 1 : 0}, ${awayWon ? 0 : 1}, ${awayWon ? 3 : 0})
      ON CONFLICT (league_id, team_id) DO UPDATE
        SET wins    = world_standings.wins    + ${awayWon ? 1 : 0},
            losses  = world_standings.losses  + ${awayWon ? 0 : 1},
            points  = world_standings.points  + ${awayWon ? 3 : 0},
            team_name = COALESCE(NULLIF(${awayTeamName || ''}, ''), world_standings.team_name)
    `;

    return json({ success: true });
  }

  return json({ error: 'Method not allowed' }, 405);
};

export const config = { path: '/api/world/matches' };
