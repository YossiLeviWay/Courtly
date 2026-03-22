import { neon } from '@neondatabase/serverless';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Use GET' }, 405);

  try {
    const sql = neon(process.env.NETLIFY_DATABASE_URL);
    const rows = await sql`SELECT data FROM world_data WHERE id = 1`;
    if (!rows.length) return json({ world: null });
    return json({ world: rows[0].data });
  } catch (err) {
    console.error('world/get error:', err);
    return json({ error: err.message }, 500);
  }
};

export const config = { path: '/api/world/get' };
