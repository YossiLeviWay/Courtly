// GET /api/world/get
// Returns the shared game world (teams, players, staff, leagues).
// Returns { world: null } if the world has not been seeded yet.

const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET' });

  try {
    const sql = neon(process.env.POSTGRES_URL);
    const rows = await sql`SELECT data FROM world_data WHERE id = 1`;

    if (!rows.length) return res.status(200).json({ world: null });
    return res.status(200).json({ world: rows[0].data });
  } catch (err) {
    console.error('world/get error:', err);
    return res.status(500).json({ error: err.message });
  }
};
