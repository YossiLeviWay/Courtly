const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  if (!process.env.POSTGRES_URL) {
    return res.status(500).json({ error: 'POSTGRES_URL env var is not set' });
  }

  try {
    const sql = neon(process.env.POSTGRES_URL);

    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        username TEXT NOT NULL,
        created_at BIGINT DEFAULT 0
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS game_states (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        state JSONB NOT NULL,
        updated_at BIGINT DEFAULT 0
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS world_data (
        id INTEGER PRIMARY KEY DEFAULT 1,
        data JSONB NOT NULL,
        created_at BIGINT DEFAULT 0
      )
    `;

    res.json({ success: true, message: 'Tables created successfully' });
  } catch (err) {
    console.error('Migration error:', err);
    res.status(500).json({ error: err.message });
  }
};
