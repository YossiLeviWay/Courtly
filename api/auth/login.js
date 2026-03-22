const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const sql = neon(process.env.POSTGRES_URL);

    const rows = await sql`
      SELECT u.id, u.username, u.email, u.password_hash, gs.state
      FROM users u
      LEFT JOIN game_states gs ON gs.user_id = u.id
      WHERE u.email = ${email.toLowerCase()}
    `;

    if (!rows[0]) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { userId: rows[0].id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      userId: rows[0].id,
      username: rows[0].username,
      gameState: rows[0].state || null,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
};
