import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    const sql = neon(process.env.POSTGRES_URL);

    const rows = await sql`
      SELECT state FROM game_states WHERE user_id = ${userId}
    `;

    res.json({ state: rows[0]?.state || null });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.error('Load error:', err);
    res.status(500).json({ error: 'Load failed' });
  }
}
