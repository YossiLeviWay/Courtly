// POST /api/db/seed
// Called by the client once (first user to register) with the full generated world.
// Inserts leagues, teams, players, staff into world_data;
// extracts the match schedule into world_matches;
// initialises world_standings.
// Pass { reset: true } in the body to wipe and re-seed (admin use).

const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const { leagues, reset = false } = req.body || {};
  if (!Array.isArray(leagues) || leagues.length === 0) {
    return res.status(400).json({ error: 'Body must contain a non-empty leagues array' });
  }

  try {
    const sql = neon(process.env.POSTGRES_URL);

    // If reset requested, wipe all shared data (keeps users + user_team_state)
    if (reset) {
      await sql`DELETE FROM transfer_market`;
      await sql`DELETE FROM world_standings`;
      await sql`DELETE FROM world_matches`;
      await sql`DELETE FROM world_data`;
    } else {
      // Check if already seeded — return existing world without overwriting
      const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM world_data`;
      if (count > 0) {
        const [row] = await sql`SELECT data FROM world_data WHERE id = 1`;
        return res.json({ world: row.data, seeded: false, message: 'World already exists' });
      }
    }

    // 1. Store full world (teams + players + staff) in world_data JSON blob
    await sql`
      INSERT INTO world_data (id, data, created_at)
      VALUES (1, ${JSON.stringify({ leagues })}::jsonb, ${Date.now()})
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, created_at = EXCLUDED.created_at
    `;

    // 2. Insert match schedule rows
    for (const league of leagues) {
      const schedule = league.schedule || [];
      for (const match of schedule) {
        const homeTeam = (league.teams || []).find(t => t.id === match.homeTeamId);
        const awayTeam = (league.teams || []).find(t => t.id === match.awayTeamId);
        await sql`
          INSERT INTO world_matches
            (id, league_id, home_team_id, away_team_id, home_team_name, away_team_name,
             scheduled_date, played, home_score, away_score, log)
          VALUES (
            ${match.id}, ${league.id},
            ${match.homeTeamId}, ${match.awayTeamId},
            ${homeTeam?.name || match.homeTeamName || ''},
            ${awayTeam?.name || match.awayTeamName || ''},
            ${match.scheduledDate}, ${match.played || false},
            ${match.played && match.result ? match.result.homeScore : null},
            ${match.played && match.result ? match.result.awayScore : null},
            ${JSON.stringify(match.log || [])}::jsonb
          )
          ON CONFLICT (id) DO NOTHING
        `;
      }

      // 3. Initialise standings for every team in this league
      for (const team of (league.teams || [])) {
        await sql`
          INSERT INTO world_standings (league_id, team_id, team_name, wins, losses, points)
          VALUES (${league.id}, ${team.id}, ${team.name}, 0, 0, 0)
          ON CONFLICT (league_id, team_id) DO NOTHING
        `;
      }
    }

    return res.json({ world: { leagues }, seeded: true, message: 'World seeded successfully' });
  } catch (err) {
    console.error('Seed error:', err);
    return res.status(500).json({ error: err.message });
  }
};
