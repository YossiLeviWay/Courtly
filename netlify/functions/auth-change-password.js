import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  let userId;
  try {
    const token = (req.headers.get('authorization') || '').split(' ')[1];
    userId = jwt.verify(token, process.env.JWT_SECRET).userId;
  } catch {
    return json({ error: 'Unauthorised' }, 401);
  }

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword) return json({ error: 'currentPassword and newPassword are required' }, 400);
  if (newPassword.length < 6) return json({ error: 'New password must be at least 6 characters' }, 400);

  const sql = neon(process.env.NETLIFY_DATABASE_URL);

  const [user] = await sql`SELECT password_hash FROM users WHERE id = ${userId}`;
  if (!user) return json({ error: 'User not found' }, 404);

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) return json({ error: 'Current password is incorrect' }, 400);

  const newHash = await bcrypt.hash(newPassword, 10);
  await sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${userId}`;

  return json({ success: true });
};

export const config = { path: '/api/auth/change-password' };
