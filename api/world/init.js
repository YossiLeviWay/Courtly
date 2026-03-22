// POST /api/world/init
// Stores the shared game world on first call. Subsequent calls are no-ops
// (the existing world is returned). This ensures all users see the same
// team names, player names, and staff regardless of when they registered.

const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const { world } = req.body || {};
  if (!world || !world.leagues) return res.status(400).json({ error: 'world.leagues is required' });

  try {
    const sql = neon(process.env.POSTGRES_URL);

    // Atomic insert — does nothing if world already exists (id=1 conflict)
    await sql`
      INSERT INTO world_data (id, data, created_at)
      VALUES (1, ${JSON.stringify(world)}::jsonb, ${Date.now()})
      ON CONFLICT (id) DO NOTHING
    `;

    // Return whatever is actually stored (may differ from what was sent if
    // a concurrent request already seeded the world first)
    const rows = await sql`SELECT data FROM world_data WHERE id = 1`;
    if (!rows.length) return res.status(500).json({ error: 'World data not found after insert' });

    return res.status(200).json({ world: rows[0].data });
  } catch (err) {
    console.error('world/init error:', err);
    return res.status(500).json({ error: err.message });
  }
};
