const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password, username, teamId, teamData } = req.body || {};
  if (!email || !password || !username) {
    return res.status(400).json({ error: 'email, password and username are required' });
  }

  try {
    const sql = neon(process.env.POSTGRES_URL);
    const hash = await bcrypt.hash(password, 10);

    const [user] = await sql`
      INSERT INTO users (email, password_hash, username, created_at)
      VALUES (${email.toLowerCase()}, ${hash}, ${username}, ${Date.now()})
      RETURNING id, username, email
    `;

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    // Create initial user_team_state if a teamId was provided
    if (teamId) {
      await sql`
        INSERT INTO user_team_state
          (user_id, team_id, budget, facilities, tactics, players_state,
           fan_count, fan_enthusiasm, ticket_price, team_exposure,
           chemistry_gauge, momentum_bar, reputation,
           match_history, season_record, profile_data, updated_at)
        VALUES (
          ${user.id}, ${teamId}, 250,
          '{}'::jsonb, '{}'::jsonb,
          ${JSON.stringify(teamData?.players ?? [])}::jsonb,
          250, 20, 20, 0, 50, 65, 10,
          '[]'::jsonb, '{"wins":0,"losses":0}'::jsonb,
          ${JSON.stringify({ bio: '', avatar: { type: 'initials', emoji: null }, gender: '' })}::jsonb,
          ${Date.now()}
        )
        ON CONFLICT (user_id) DO NOTHING
      `;
    }

    return res.status(201).json({ token, userId: user.id, username: user.username });
  } catch (err) {
    if (err.message?.includes('duplicate key') || err.message?.includes('unique')) {
      return res.status(409).json({ error: 'Email already registered. Please sign in.' });
    }
    console.error('Register error:', err);
    return res.status(500).json({ error: err.message || 'Registration failed' });
  }
};
