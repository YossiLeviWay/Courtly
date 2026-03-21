import { neon } from '@neondatabase/serverless';

// One-time migration endpoint. Protected by JWT_SECRET query param.
// Call once: GET /api/db/migrate?secret=YOUR_JWT_SECRET
export default async function handler(req, res) {
  if (req.query.secret !== process.env.JWT_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
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

    res.json({ success: true, message: 'Tables created successfully' });
  } catch (err) {
    console.error('Migration error:', err);
    res.status(500).json({ error: err.message });
  }
}
