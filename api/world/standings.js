// GET /api/world/standings — returns all standings rows ordered by points desc

const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET' });

  try {
    const sql = neon(process.env.POSTGRES_URL);
    const rows = await sql`
      SELECT league_id, team_id, team_name, wins, losses, points
      FROM world_standings
      ORDER BY league_id, points DESC, wins DESC
    `;
    return res.json({ standings: rows });
  } catch (err) {
    console.error('standings error:', err);
    return res.status(500).json({ error: err.message });
  }
};
