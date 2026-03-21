// Client-side API helpers — replaces Firebase SDK calls

export function getToken() {
  return localStorage.getItem('courtly_token');
}

export function setToken(token) {
  localStorage.setItem('courtly_token', token);
}

export function clearToken() {
  localStorage.removeItem('courtly_token');
}

export async function apiRegister(email, password, username) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, username }),
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

export async function apiSaveGame(state) {
  const token = getToken();
  if (!token) return;
  try {
    await fetch('/api/game/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ state }),
    });
  } catch (err) {
    console.error('Auto-save error:', err);
  }
}

export async function apiLoadGame() {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/game/load', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const { state } = await res.json();
    return state;
  } catch {
    return null;
  }
}
