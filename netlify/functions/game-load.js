import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Use GET' }, 405);

  const token = (req.headers.get('authorization') || '').split(' ')[1];
  if (!token) return json({ error: 'Unauthorized' }, 401);

  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    const sql = neon(process.env.NETLIFY_DATABASE_URL);
    const rows = await sql`SELECT state FROM game_states WHERE user_id = ${userId}`;
    return json({ state: rows[0]?.state || null });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return json({ error: 'Unauthorized' }, 401);
    }
    console.error('Load error:', err);
    return json({ error: 'Load failed' }, 500);
  }
};

export const config = { path: '/api/game/load' };
