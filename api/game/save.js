import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    const { state } = req.body || {};
    if (!state) return res.status(400).json({ error: 'No state provided' });

    const sql = neon(process.env.POSTGRES_URL);
    await sql`
      INSERT INTO game_states (user_id, state, updated_at)
      VALUES (${userId}, ${JSON.stringify(state)}, ${Date.now()})
      ON CONFLICT (user_id) DO UPDATE
        SET state = ${JSON.stringify(state)}, updated_at = ${Date.now()}
    `;

    res.json({ success: true });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.error('Save error:', err);
    res.status(500).json({ error: 'Save failed' });
  }
}
