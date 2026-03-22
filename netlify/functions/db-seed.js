import { neon } from '@netlify/neon';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  const { leagues, reset = false } = await req.json();
  if (!Array.isArray(leagues) || leagues.length === 0) {
    return json({ error: 'Body must contain a non-empty leagues array' }, 400);
  }

  try {
    const sql = neon();

    if (reset) {
      await sql`DELETE FROM transfer_market`;
      await sql`DELETE FROM world_standings`;
      await sql`DELETE FROM world_matches`;
      await sql`DELETE FROM world_data`;
    } else {
      const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM world_data`;
      if (count > 0) {
        const [row] = await sql`SELECT data FROM world_data WHERE id = 1`;
        return json({ world: row.data, seeded: false, message: 'World already exists' });
      }
    }

    await sql`
      INSERT INTO world_data (id, data, created_at)
      VALUES (1, ${JSON.stringify({ leagues })}::jsonb, ${Date.now()})
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, created_at = EXCLUDED.created_at
    `;

    for (const league of leagues) {
      for (const match of (league.schedule || [])) {
        const homeTeam = (league.teams || []).find(t => t.id === match.homeTeamId);
        const awayTeam = (league.teams || []).find(t => t.id === match.awayTeamId);
        await sql`
          INSERT INTO world_matches
            (id, league_id, home_team_id, away_team_id, home_team_name, away_team_name,
             scheduled_date, played, home_score, away_score, log)
          VALUES (
            ${match.id}, ${league.id},
            ${match.homeTeamId}, ${match.awayTeamId},
            ${homeTeam?.name || ''}, ${awayTeam?.name || ''},
            ${match.scheduledDate}, ${match.played || false},
            ${match.played && match.result ? match.result.homeScore : null},
            ${match.played && match.result ? match.result.awayScore : null},
            ${JSON.stringify(match.log || [])}::jsonb
          )
          ON CONFLICT (id) DO NOTHING
        `;
      }
      for (const team of (league.teams || [])) {
        await sql`
          INSERT INTO world_standings (league_id, team_id, team_name, wins, losses, points)
          VALUES (${league.id}, ${team.id}, ${team.name}, 0, 0, 0)
          ON CONFLICT (league_id, team_id) DO NOTHING
        `;
      }
    }

    return json({ world: { leagues }, seeded: true, message: 'World seeded successfully' });
  } catch (err) {
    console.error('Seed error:', err);
    return json({ error: err.message }, 500);
  }
};

export const config = { path: '/api/db/seed' };
