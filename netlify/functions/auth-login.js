import { neon } from '@netlify/neon';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  const { email, password } = await req.json();
  if (!email || !password) return json({ error: 'Missing required fields' }, 400);

  try {
    const sql = neon();
    const rows = await sql`
      SELECT u.id, u.username, u.email, u.password_hash
      FROM users u
      WHERE u.email = ${email.toLowerCase()}
    `;

    if (!rows[0]) return json({ error: 'Invalid email or password.' }, 401);

    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) return json({ error: 'Invalid email or password.' }, 401);

    const token = jwt.sign({ userId: rows[0].id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    return json({ token, userId: rows[0].id, username: rows[0].username });
  } catch (err) {
    console.error('Login error:', err);
    return json({ error: 'Login failed' }, 500);
  }
};

export const config = { path: '/api/auth/login' };
