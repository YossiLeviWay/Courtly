// GET    /api/world/transfer          — list all active transfer market entries
// POST   /api/world/transfer          — list a player for sale (JWT required)
// DELETE /api/world/transfer?id=<id>  — delist a player (JWT required)

const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

function verifyToken(req) {
  const token = (req.headers.authorization || '').split(' ')[1];
  if (!token) throw new Error('Unauthorised');
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = async function handler(req, res) {
  const sql = neon(process.env.POSTGRES_URL);

  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM transfer_market ORDER BY listed_at DESC`;
    return res.json({ listings: rows });
  }

  try {
    verifyToken(req);
  } catch {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  if (req.method === 'POST') {
    const {
      playerId, playerName, position, overallRating, age,
      nationality, askingPrice, sellingTeamId, sellingTeamName, playerData,
    } = req.body || {};

    if (!playerId || !askingPrice || !sellingTeamId) {
      return res.status(400).json({ error: 'playerId, askingPrice, sellingTeamId required' });
    }

    // Prevent duplicate listings for same player
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
    return res.json({ id: row.id });
  }

  if (req.method === 'DELETE') {
    const id = req.query?.id;
    if (!id) return res.status(400).json({ error: 'id query param required' });
    await sql`DELETE FROM transfer_market WHERE id = ${id}`;
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
