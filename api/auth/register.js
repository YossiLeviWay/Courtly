const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password, username } = req.body || {};
  if (!email || !password || !username) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const sql = neon(process.env.POSTGRES_URL);
    const hash = await bcrypt.hash(password, 10);

    const rows = await sql`
      INSERT INTO users (email, password_hash, username, created_at)
      VALUES (${email.toLowerCase()}, ${hash}, ${username}, ${Date.now()})
      RETURNING id, username, email
    `;

    const token = jwt.sign(
      { userId: rows[0].id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({ token, userId: rows[0].id, username: rows[0].username });
  } catch (err) {
    if (err.message?.includes('duplicate key') || err.message?.includes('unique')) {
      return res.status(409).json({ error: 'Email already registered. Please sign in.' });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: err.message || 'Registration failed' });
  }
};
