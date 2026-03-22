import { neon } from '@netlify/neon';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Use GET' }, 405);

  try {
    const sql = neon();
    const rows = await sql`
      SELECT * FROM world_standings
      ORDER BY league_id, points DESC, wins DESC
    `;
    return json({ standings: rows });
  } catch (err) {
    console.error('standings error:', err);
    return json({ error: err.message }, 500);
  }
};

export const config = { path: '/api/world/standings' };
