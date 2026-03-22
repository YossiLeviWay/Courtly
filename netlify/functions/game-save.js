import { neon } from '@netlify/neon';
import jwt from 'jsonwebtoken';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  const token = (req.headers.get('authorization') || '').split(' ')[1];
  if (!token) return json({ error: 'Unauthorized' }, 401);

  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    const { state } = await req.json();
    if (!state) return json({ error: 'No state provided' }, 400);

    const sql = neon();
    await sql`
      INSERT INTO game_states (user_id, state, updated_at)
      VALUES (${userId}, ${JSON.stringify(state)}, ${Date.now()})
      ON CONFLICT (user_id) DO UPDATE
        SET state = ${JSON.stringify(state)}, updated_at = ${Date.now()}
    `;

    return json({ success: true });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return json({ error: 'Unauthorized' }, 401);
    }
    console.error('Save error:', err);
    return json({ error: 'Save failed' }, 500);
  }
};

export const config = { path: '/api/game/save' };
