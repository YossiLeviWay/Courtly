import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

function getUserId(req) {
  const token = (req.headers.get('authorization') || '').split(' ')[1];
  if (!token) throw new Error('Unauthorised');
  return jwt.verify(token, process.env.JWT_SECRET).userId;
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  let userId;
  try { userId = getUserId(req); } catch { return json({ error: 'Unauthorised' }, 401); }

  const sql = neon(process.env.NETLIFY_DATABASE_URL);

  const { username, email, teamName, stadiumName, bio, gender, avatar, settingsChangesToday, lastSettingsChange } = await req.json();

  // Get current state to find team_id and existing profile_data
  const [stateRow] = await sql`SELECT team_id, profile_data FROM user_team_state WHERE user_id = ${userId}`;
  if (!stateRow) return json({ error: 'User state not found' }, 404);

  const currentProfile = stateRow.profile_data || {};
  const updatedProfile = {
    ...currentProfile,
    ...(bio !== undefined && { bio }),
    ...(gender !== undefined && { gender }),
    ...(avatar !== undefined && { avatar }),
    ...(teamName !== undefined && { teamName }),
    ...(stadiumName !== undefined && { stadiumName }),
    ...(settingsChangesToday !== undefined && { settingsChangesToday }),
    ...(lastSettingsChange !== undefined && { lastSettingsChange }),
  };

  // Update users table (username and/or email)
  if (username !== undefined && email !== undefined) {
    await sql`UPDATE users SET username = ${username}, email = ${email.toLowerCase()} WHERE id = ${userId}`;
  } else if (username !== undefined) {
    await sql`UPDATE users SET username = ${username} WHERE id = ${userId}`;
  } else if (email !== undefined) {
    await sql`UPDATE users SET email = ${email.toLowerCase()} WHERE id = ${userId}`;
  }

  // Update profile_data in user_team_state
  await sql`
    UPDATE user_team_state
    SET profile_data = ${JSON.stringify(updatedProfile)}::jsonb,
        updated_at   = ${Date.now()}
    WHERE user_id = ${userId}
  `;

  // Propagate custom team name to shared world tables so all users see it
  if (teamName !== undefined && teamName.trim()) {
    const tid = stateRow.team_id;
    await sql`UPDATE world_standings SET team_name = ${teamName} WHERE team_id = ${tid}`;
    await sql`UPDATE world_matches SET home_team_name = ${teamName} WHERE home_team_id = ${tid}`;
    await sql`UPDATE world_matches SET away_team_name = ${teamName} WHERE away_team_id = ${tid}`;
  }

  return json({ success: true });
};

export const config = { path: '/api/user/profile' };
