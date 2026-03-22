import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  const { email, password, username, teamId, teamData, teamName } = await req.json();
  if (!email || !password || !username) {
    return json({ error: 'email, password and username are required' }, 400);
  }

  try {
    const sql = neon(process.env.NETLIFY_DATABASE_URL);
    const hash = await bcrypt.hash(password, 10);

    const [user] = await sql`
      INSERT INTO users (email, password_hash, username, created_at)
      VALUES (${email.toLowerCase()}, ${hash}, ${username}, ${Date.now()})
      RETURNING id, username, email
    `;

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    if (teamId) {
      const customName = teamName?.trim() || '';
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
          ${JSON.stringify({ bio: '', avatar: { type: 'initials', emoji: null }, gender: '', teamName: customName, stadiumName: '' })}::jsonb,
          ${Date.now()}
        )
        ON CONFLICT (user_id) DO NOTHING
      `;

      // Propagate custom team name to shared world tables immediately
      if (customName) {
        await sql`UPDATE world_standings SET team_name = ${customName} WHERE team_id = ${teamId}`;
        await sql`UPDATE world_matches SET home_team_name = ${customName} WHERE home_team_id = ${teamId}`;
        await sql`UPDATE world_matches SET away_team_name = ${customName} WHERE away_team_id = ${teamId}`;
      }
    }

    return json({ token, userId: user.id, username: user.username }, 201);
  } catch (err) {
    if (err.message?.includes('duplicate key') || err.message?.includes('unique')) {
      return json({ error: 'Email already registered. Please sign in.' }, 409);
    }
    console.error('Register error:', err);
    return json({ error: err.message || 'Registration failed' }, 500);
  }
};

export const config = { path: '/api/auth/register' };
