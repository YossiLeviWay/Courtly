import { neon } from '@netlify/neon';
import jwt from 'jsonwebtoken';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

function verifyToken(req) {
  const token = (req.headers.get('authorization') || '').split(' ')[1];
  if (!token) throw new Error('Unauthorised');
  return jwt.verify(token, process.env.JWT_SECRET);
}

export default async (req) => {
  const sql = neon();

  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM transfer_market ORDER BY listed_at DESC`;
    return json({ listings: rows });
  }

  try { verifyToken(req); } catch { return json({ error: 'Unauthorised' }, 401); }

  if (req.method === 'POST') {
    const {
      playerId, playerName, position, overallRating, age,
      nationality, askingPrice, sellingTeamId, sellingTeamName, playerData,
    } = await req.json();

    if (!playerId || !askingPrice || !sellingTeamId) {
      return json({ error: 'playerId, askingPrice, sellingTeamId required' }, 400);
    }

    await sql`DELETE FROM transfer_market WHERE player_id = ${playerId}`;

    const [row] = await sql`
      INSERT INTO transfer_market
        (player_id, player_name, position, overall_rating, age, nationality,
         asking_price, selling_team_id, selling_team_name, listed_at, player_data)
      VALUES (
        ${playerId}, ${playerName || ''}, ${position || ''}, ${overallRating || 0},
        ${age || 0}, ${nationality || ''}, ${askingPrice},
        ${sellingTeamId}, ${sellingTeamName || ''}, ${Date.now()},
        ${JSON.stringify(playerData || {})}::jsonb
      )
      RETURNING id
    `;
    return json({ id: row.id });
  }

  if (req.method === 'DELETE') {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return json({ error: 'id query param required' }, 400);
    await sql`DELETE FROM transfer_market WHERE id = ${id}`;
    return json({ success: true });
  }

  return json({ error: 'Method not allowed' }, 405);
};

export const config = { path: '/api/world/transfer' };
