// GET  /api/user/state — load the authenticated user's team management state
// POST /api/user/state — save (upsert) the user's team management state

const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

function getUserId(req) {
  const token = (req.headers.authorization || '').split(' ')[1];
  if (!token) throw new Error('Unauthorised');
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  return payload.userId;
}

module.exports = async function handler(req, res) {
  let userId;
  try {
    userId = getUserId(req);
  } catch {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  const sql = neon(process.env.POSTGRES_URL);

  // ── GET ─────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const [userRow] = await sql`SELECT username, email, created_at FROM users WHERE id = ${userId}`;
    const [stateRow] = await sql`SELECT * FROM user_team_state WHERE user_id = ${userId}`;

    if (!stateRow) return res.json({ state: null, user: userRow || null });

    return res.json({ state: stateRow, user: userRow || null });
  }

  // ── POST (upsert) ───────────────────────────────────────────
  if (req.method === 'POST') {
    const {
      teamId, budget, facilities, tactics, playersState,
      fanCount, fanEnthusiasm, ticketPrice, teamExposure,
      chemistryGauge, momentumBar, reputation,
      matchHistory, seasonRecord, profileData,
    } = req.body || {};

    if (!teamId) return res.status(400).json({ error: 'teamId required' });

    await sql`
      INSERT INTO user_team_state
        (user_id, team_id, budget, facilities, tactics, players_state,
         fan_count, fan_enthusiasm, ticket_price, team_exposure,
         chemistry_gauge, momentum_bar, reputation,
         match_history, season_record, profile_data, updated_at)
      VALUES (
        ${userId}, ${teamId}, ${budget ?? 250},
        ${JSON.stringify(facilities ?? {})}::jsonb,
        ${JSON.stringify(tactics ?? {})}::jsonb,
        ${JSON.stringify(playersState ?? [])}::jsonb,
        ${fanCount ?? 250}, ${fanEnthusiasm ?? 20}, ${ticketPrice ?? 20},
        ${teamExposure ?? 0}, ${chemistryGauge ?? 50}, ${momentumBar ?? 65},
        ${reputation ?? 10},
        ${JSON.stringify(matchHistory ?? [])}::jsonb,
        ${JSON.stringify(seasonRecord ?? { wins: 0, losses: 0 })}::jsonb,
        ${JSON.stringify(profileData ?? {})}::jsonb,
        ${Date.now()}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        team_id         = EXCLUDED.team_id,
        budget          = EXCLUDED.budget,
        facilities      = EXCLUDED.facilities,
        tactics         = EXCLUDED.tactics,
        players_state   = EXCLUDED.players_state,
        fan_count       = EXCLUDED.fan_count,
        fan_enthusiasm  = EXCLUDED.fan_enthusiasm,
        ticket_price    = EXCLUDED.ticket_price,
        team_exposure   = EXCLUDED.team_exposure,
        chemistry_gauge = EXCLUDED.chemistry_gauge,
        momentum_bar    = EXCLUDED.momentum_bar,
        reputation      = EXCLUDED.reputation,
        match_history   = EXCLUDED.match_history,
        season_record   = EXCLUDED.season_record,
        profile_data    = EXCLUDED.profile_data,
        updated_at      = EXCLUDED.updated_at
    `;

    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
