import { neon } from '@netlify/neon';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  try {
    const sql = neon();

    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        username TEXT NOT NULL,
        created_at BIGINT DEFAULT 0
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS game_states (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        state JSONB NOT NULL,
        updated_at BIGINT DEFAULT 0
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS world_data (
        id INTEGER PRIMARY KEY DEFAULT 1,
        data JSONB NOT NULL,
        created_at BIGINT DEFAULT 0
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS world_matches (
        id TEXT PRIMARY KEY,
        league_id TEXT NOT NULL,
        home_team_id TEXT NOT NULL,
        away_team_id TEXT NOT NULL,
        home_team_name TEXT NOT NULL DEFAULT '',
        away_team_name TEXT NOT NULL DEFAULT '',
        scheduled_date BIGINT NOT NULL,
        played BOOLEAN NOT NULL DEFAULT false,
        home_score INTEGER,
        away_score INTEGER,
        log JSONB NOT NULL DEFAULT '[]'
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS world_standings (
        league_id TEXT NOT NULL,
        team_id TEXT NOT NULL,
        team_name TEXT NOT NULL DEFAULT '',
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        points INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (league_id, team_id)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS transfer_market (
        id SERIAL PRIMARY KEY,
        player_id TEXT NOT NULL,
        player_name TEXT NOT NULL,
        position TEXT,
        overall_rating INTEGER,
        age INTEGER,
        nationality TEXT,
        asking_price INTEGER NOT NULL,
        selling_team_id TEXT NOT NULL,
        selling_team_name TEXT NOT NULL DEFAULT '',
        listed_at BIGINT NOT NULL,
        player_data JSONB NOT NULL DEFAULT '{}'
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS user_team_state (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        team_id TEXT NOT NULL,
        budget INTEGER NOT NULL DEFAULT 250,
        facilities JSONB NOT NULL DEFAULT '{}',
        tactics JSONB NOT NULL DEFAULT '{}',
        players_state JSONB NOT NULL DEFAULT '[]',
        fan_count INTEGER NOT NULL DEFAULT 250,
        fan_enthusiasm INTEGER NOT NULL DEFAULT 20,
        ticket_price INTEGER NOT NULL DEFAULT 20,
        team_exposure INTEGER NOT NULL DEFAULT 0,
        chemistry_gauge INTEGER NOT NULL DEFAULT 50,
        momentum_bar INTEGER NOT NULL DEFAULT 65,
        reputation INTEGER NOT NULL DEFAULT 10,
        match_history JSONB NOT NULL DEFAULT '[]',
        season_record JSONB NOT NULL DEFAULT '{"wins":0,"losses":0}',
        profile_data JSONB NOT NULL DEFAULT '{}',
        updated_at BIGINT NOT NULL DEFAULT 0
      )
    `;

    return json({ success: true, message: 'All tables created successfully' });
  } catch (err) {
    console.error('Migration error:', err);
    return json({ error: err.message }, 500);
  }
};

export const config = { path: '/api/db/migrate' };
