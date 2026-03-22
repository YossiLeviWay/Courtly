// ── Auth ────────────────────────────────────────────────────────

export function getToken() { return localStorage.getItem('courtly_token'); }
export function setToken(t) { localStorage.setItem('courtly_token', t); }
export function clearToken() { localStorage.removeItem('courtly_token'); }

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function apiRegister(email, password, username, teamId, teamData) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, username, teamId, teamData }),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || 'Registration failed'), { status: res.status });
  return data; // { token, userId, username }
}

export async function apiLogin(email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || 'Login failed'), { status: res.status });
  return data; // { token, userId, username, gameState }
}

// ── Legacy game state (kept for compatibility) ──────────────────
export async function apiSaveGame(state) {
  const token = getToken();
  if (!token) return;
  try {
    await fetch('/api/game/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ state }),
    });
  } catch (err) {
    console.error('Auto-save error:', err);
  }
}

export async function apiLoadGame() {
  if (!getToken()) return null;
  try {
    const res = await fetch('/api/game/load', { headers: authHeaders() });
    if (!res.ok) return null;
    const { state } = await res.json();
    return state;
  } catch { return null; }
}

// ── Shared World ────────────────────────────────────────────────

export async function apiGetWorld() {
  try {
    const res = await fetch('/api/world/get');
    if (!res.ok) return null;
    const { world } = await res.json();
    return world; // { leagues: [...] } or null
  } catch { return null; }
}

export async function apiSeedWorld(leagues) {
  const res = await fetch('/api/db/seed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leagues }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Seed failed');
  return data.world; // { leagues }
}

// Kept for backward compat
export async function apiInitWorld(world) {
  return apiSeedWorld(world.leagues);
}

// Admin: generate + seed world server-side (deterministic, one-time)
export async function apiAdminSeed(secret, reset = false) {
  const res = await fetch('/api/db/admin-seed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, reset }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Admin seed failed');
  return data;
}

// ── Matches (shared, all users see same results) ────────────────

export async function apiGetMatches() {
  try {
    const res = await fetch('/api/world/matches');
    if (!res.ok) return [];
    const { matches } = await res.json();
    return matches || [];
  } catch { return []; }
}

export async function apiRecordMatchResult({ matchId, leagueId, homeTeamId, awayTeamId, homeTeamName, awayTeamName, homeScore, awayScore, log }) {
  try {
    await fetch('/api/world/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ matchId, leagueId, homeTeamId, awayTeamId, homeTeamName, awayTeamName, homeScore, awayScore, log }),
    });
  } catch (err) {
    console.error('Record match error:', err);
  }
}

// ── Standings (shared) ──────────────────────────────────────────

export async function apiGetStandings() {
  try {
    const res = await fetch('/api/world/standings');
    if (!res.ok) return [];
    const { standings } = await res.json();
    return standings || [];
  } catch { return []; }
}

// ── Transfer Market (shared) ────────────────────────────────────

export async function apiGetTransferMarket() {
  try {
    const res = await fetch('/api/world/transfer');
    if (!res.ok) return [];
    const { listings } = await res.json();
    return listings || [];
  } catch { return []; }
}

export async function apiListPlayerForTransfer(playerData) {
  try {
    const res = await fetch('/api/world/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(playerData),
    });
    const data = await res.json();
    return data.id;
  } catch (err) {
    console.error('List transfer error:', err);
  }
}

export async function apiDelistPlayer(listingId) {
  try {
    await fetch(`/api/world/transfer?id=${listingId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
  } catch (err) {
    console.error('Delist error:', err);
  }
}

// ── Per-user team state ─────────────────────────────────────────

export async function apiGetUserState() {
  if (!getToken()) return null;
  try {
    const res = await fetch('/api/user/state', { headers: authHeaders() });
    if (!res.ok) return null;
    return await res.json(); // { state, user }
  } catch { return null; }
}

export async function apiSaveUserState(payload) {
  if (!getToken()) return;
  try {
    await fetch('/api/user/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('Save user state error:', err);
  }
}
