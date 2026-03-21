import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { generateLeagues } from '../engine/teamGenerator.js';
import { Sun, Moon, Eye, EyeOff } from 'lucide-react';
import { auth, db } from '../firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import ToastContainer from '../components/ui/ToastContainer.jsx';

export default function Login() {
  const { state, dispatch, addNotification } = useGame();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', teamName: '' });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (state.user) navigate('/', { replace: true });
  }, [state.user, navigate]);

  // Reset loading spinner if auth resolved but no game state found (e.g. no Firestore doc)
  useEffect(() => {
    if (state.initialized && !state.user) setLoading(false);
  }, [state.initialized, state.user]);

  const validate = () => {
    const e = {};
    if (mode === 'register' && !form.username.trim()) e.username = 'Username is required';
    if (!form.email.includes('@')) e.email = 'Valid email required';
    if (!form.password || form.password.length < 6) e.password = 'Password must be at least 6 characters';
    if (mode === 'register' && !form.teamName.trim()) e.teamName = 'Team name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, form.email, form.password);
        // onAuthStateChanged in GameContext loads game state from Firestore.
        // The useEffect above navigates to '/' once state.user is populated.
        // Keep loading=true while that happens; the component unmounts on navigate.
        return;
      }

      // Registration - generate full game world
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      const uid = cred.user.uid;

      const leagues = generateLeagues();
      const allTeams = leagues.flatMap(l => l.teams || []);
      const league0Teams = leagues[0]?.teams || allTeams.slice(0, 10);
      const userTeamIndex = Math.floor(Math.random() * league0Teams.length);
      const baseTeam = league0Teams[userTeamIndex];
      const userTeam = { ...baseTeam, isUserTeam: true, name: form.teamName || baseTeam.name, budget: 250, leagueId: leagues[0]?.id, leagueIndex: 0 };

      const updatedTeams = allTeams.map(t => t.id === baseTeam.id ? userTeam : t);
      const updatedLeagues = leagues.map(l => ({
        ...l,
        teams: (l.teams || []).map(t => t.id === baseTeam.id ? userTeam : t)
      }));

      const user = {
        id: uid,
        username: form.username,
        email: form.email,
        teamId: userTeam.id,
        bio: '',
        gender: '',
        avatar: { type: 'initials', emoji: null },
        settingsChangesToday: 0,
        lastSettingsChange: null,
        joinedAt: Date.now(),
        records: { wins: 0, losses: 0, honors: [] },
      };

      const gameState = { user, userTeam, leagues: updatedLeagues, allTeams: updatedTeams, lastUpdated: Date.now() };

      // Save lean format to Firestore (bot shells only — no player rosters, stays under 1 MB)
      const BOT_SHELL_FIELDS = ['id','name','nickname','city','country','region',
        'stadiumName','founded','colors','league','leagueIndex','leagueId'];
      const botTeamShells = updatedTeams
        .filter(t => !t.isUserTeam)
        .map(t => Object.fromEntries(BOT_SHELL_FIELDS.map(k => [k, t[k]])));
      const leaguesMeta = updatedLeagues.map(l => ({
        id: l.id,
        name: l.name,
        tier: l.tier,
        groupIndex: l.groupIndex,
        standings: l.standings || [],
        schedule: l.schedule || [],
      }));
      await setDoc(doc(db, 'gameStates', uid), { user, userTeam, botTeamShells, leaguesMeta, lastUpdated: gameState.lastUpdated });

      dispatch({ type: 'INIT_GAME', payload: gameState });
      addNotification(`Welcome to Courtly, ${form.username}! Your club is ready.`, 'success');
      navigate('/', { replace: true });
    } catch (err) {
      const msg =
        err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
          ? 'Invalid email or password.'
          : err.code === 'auth/email-already-in-use'
          ? 'Email already registered. Please sign in.'
          : err.message;
      addNotification(msg, 'error');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'var(--bg-app)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <ToastContainer notifications={state.notifications} />
      {/* Background decorative elements */}
      <div style={{
        position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none'
      }}>
        <div style={{
          position: 'absolute', top: '-10%', right: '-5%',
          width: 600, height: 600,
          background: 'radial-gradient(circle, rgba(232,98,26,0.12) 0%, transparent 70%)',
          borderRadius: '50%'
        }} />
        <div style={{
          position: 'absolute', bottom: '-15%', left: '-10%',
          width: 500, height: 500,
          background: 'radial-gradient(circle, rgba(232,98,26,0.08) 0%, transparent 70%)',
          borderRadius: '50%'
        }} />
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="btn btn-ghost btn-sm"
        style={{ position: 'absolute', top: 20, right: 20, zIndex: 10 }}
      >
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      {/* Left: Hero Section */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        position: 'relative'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 48 }}>
          <svg viewBox="0 0 64 64" width="56" height="56">
            <circle cx="32" cy="32" r="30" fill="#E8621A"/>
            <path d="M32 2 Q50 18 32 32 Q14 46 32 62" stroke="#C04E10" strokeWidth="2.5" fill="none"/>
            <path d="M2 32 Q18 14 32 32 Q46 50 62 32" stroke="#C04E10" strokeWidth="2.5" fill="none"/>
            <path d="M8 16 Q26 24 26 32 Q26 40 8 48" stroke="#C04E10" strokeWidth="1.5" fill="none"/>
            <path d="M56 16 Q38 24 38 32 Q38 40 56 48" stroke="#C04E10" strokeWidth="1.5" fill="none"/>
          </svg>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.8rem', letterSpacing: 3, color: 'var(--color-primary)', lineHeight: 1 }}>
            COURTLY
          </span>
        </div>

        {/* Hero Basketball Scene - Minimalist Cartoon */}
        <div style={{ position: 'relative', width: 360, height: 300, marginBottom: 40 }}>
          <svg viewBox="0 0 360 300" width="360" height="300" style={{ overflow: 'visible' }}>
            {/* Court floor */}
            <ellipse cx="180" cy="260" rx="160" ry="20" fill="rgba(232,98,26,0.08)" />
            <rect x="40" y="240" width="280" height="8" rx="4" fill="rgba(232,98,26,0.12)" />

            {/* Court lines */}
            <line x1="40" y1="244" x2="320" y2="244" stroke="rgba(232,98,26,0.3)" strokeWidth="1.5" strokeDasharray="8,4" />
            <circle cx="180" cy="244" r="30" fill="none" stroke="rgba(232,98,26,0.2)" strokeWidth="1.5" />

            {/* Hoop left */}
            <rect x="38" y="150" width="5" height="90" rx="2" fill="#6B5A4E" />
            <rect x="30" y="140" width="22" height="4" rx="2" fill="#6B5A4E" />
            <rect x="48" y="140" width="2" height="16" rx="1" fill="#6B5A4E" />
            <ellipse cx="59" cy="156" rx="12" ry="4" fill="none" stroke="#E8621A" strokeWidth="2.5" />
            {/* Net */}
            <path d="M47 156 L50 175 M59 160 L59 178 M71 156 L68 175 M53 160 L56 178 M65 160 L62 178" stroke="rgba(107,90,78,0.6)" strokeWidth="1" />

            {/* Hoop right */}
            <rect x="317" y="150" width="5" height="90" rx="2" fill="#6B5A4E" />
            <rect x="308" y="140" width="22" height="4" rx="2" fill="#6B5A4E" />
            <rect x="310" y="140" width="2" height="16" rx="1" fill="#6B5A4E" />
            <ellipse cx="301" cy="156" rx="12" ry="4" fill="none" stroke="#E8621A" strokeWidth="2.5" />
            <path d="M289 156 L292 175 M301 160 L301 178 M313 156 L310 175 M295 160 L298 178 M307 160 L304 178" stroke="rgba(107,90,78,0.6)" strokeWidth="1" />

            {/* Player 1 - Orange (jumping/shooting) */}
            <g transform="translate(130, 80)">
              {/* Body */}
              <rect x="-12" y="20" width="24" height="40" rx="8" fill="#E8621A" />
              {/* Head */}
              <circle cx="0" cy="10" r="16" fill="#FDBCB4" />
              {/* Hair */}
              <path d="M-14 4 Q0 -10 14 4" fill="#3D2B1F" />
              {/* Jersey number */}
              <text x="0" y="46" textAnchor="middle" fill="white" fontSize="12" fontWeight="900">23</text>
              {/* Left arm raised */}
              <rect x="-28" y="18" width="18" height="8" rx="4" fill="#E8621A" transform="rotate(-40, -19, 22)" />
              {/* Right arm extended up */}
              <rect x="10" y="10" width="20" height="8" rx="4" fill="#E8621A" transform="rotate(-60, 20, 14)" />
              {/* Shorts */}
              <rect x="-12" y="52" width="24" height="18" rx="4" fill="#C04E10" />
              {/* Legs (jumping) */}
              <rect x="-12" y="64" width="10" height="22" rx="5" fill="#FDBCB4" transform="rotate(-15, -7, 75)" />
              <rect x="2" y="64" width="10" height="22" rx="5" fill="#FDBCB4" transform="rotate(15, 7, 75)" />
              {/* Shoes */}
              <ellipse cx="-14" cy="85" rx="8" ry="4" fill="#1A1208" transform="rotate(-15, -7, 75)" />
              <ellipse cx="14" cy="85" rx="8" ry="4" fill="#1A1208" transform="rotate(15, 7, 75)" />
            </g>

            {/* Basketball (in air) */}
            <g transform="translate(200, 60)">
              <circle cx="0" cy="0" r="18" fill="#E8621A" />
              <path d="M0 -18 Q10 0 0 18" stroke="#C04E10" strokeWidth="1.8" fill="none" />
              <path d="M-18 0 Q0 8 18 0" stroke="#C04E10" strokeWidth="1.8" fill="none" />
              <path d="M-12 -14 Q-4 0 -12 14" stroke="#C04E10" strokeWidth="1.2" fill="none" />
              <path d="M12 -14 Q4 0 12 14" stroke="#C04E10" strokeWidth="1.2" fill="none" />
            </g>

            {/* Player 2 - Blue (defending) */}
            <g transform="translate(240, 100)">
              <rect x="-12" y="20" width="24" height="40" rx="8" fill="#1565C0" />
              <circle cx="0" cy="10" r="16" fill="#8D6E63" />
              <path d="M-14 4 Q0 -8 14 4" fill="#2D1208" />
              <text x="0" y="46" textAnchor="middle" fill="white" fontSize="12" fontWeight="900">7</text>
              {/* Arms reaching up */}
              <rect x="-26" y="14" width="16" height="8" rx="4" fill="#1565C0" transform="rotate(-70, -18, 18)" />
              <rect x="10" y="8" width="16" height="8" rx="4" fill="#1565C0" transform="rotate(70, 18, 12)" />
              <rect x="-12" y="52" width="24" height="18" rx="4" fill="#0D47A1" />
              <rect x="-12" y="64" width="10" height="25" rx="5" fill="#8D6E63" />
              <rect x="2" y="64" width="10" height="25" rx="5" fill="#8D6E63" />
              <ellipse cx="-8" cy="89" rx="8" ry="4" fill="#1A1208" />
              <ellipse cx="8" cy="89" rx="8" ry="4" fill="#1A1208" />
            </g>

            {/* Stars / sparkles */}
            <text x="175" y="35" fontSize="14" opacity="0.6">✨</text>
            <text x="270" y="55" fontSize="10" opacity="0.5">⭐</text>
            <text x="100" y="70" fontSize="10" opacity="0.4">✦</text>

            {/* Shadow arcs */}
            <ellipse cx="136" cy="240" rx="28" ry="6" fill="rgba(0,0,0,0.1)" />
            <ellipse cx="244" cy="242" rx="28" ry="6" fill="rgba(0,0,0,0.1)" />
          </svg>
        </div>

        {/* Hero Text */}
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '2.4rem',
            letterSpacing: 2,
            color: 'var(--text-primary)',
            marginBottom: 12,
            lineHeight: 1.1
          }}>
            BUILD YOUR DYNASTY
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-base)', lineHeight: 1.7 }}>
            Manage your basketball club, develop players, and compete in a fully simulated league — running 24/7, with or without you.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
            {['🏀 Real-time simulation', '📊 Deep stats', '🏆 5 leagues'].map(f => (
              <span key={f} className="badge badge-orange" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Auth Form */}
      <div style={{
        width: 420,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        borderLeft: '1px solid var(--border-color)',
        background: 'var(--bg-card)',
      }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, marginBottom: 8 }}>
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 32 }}>
            {mode === 'login'
              ? 'Sign in to your General Manager account'
              : 'Start building your basketball dynasty'}
          </p>

          <div className="tabs" style={{ marginBottom: 28 }}>
            <button className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setErrors({}); }}>Sign In</button>
            <button className={`tab ${mode === 'register' ? 'active' : ''}`} onClick={() => { setMode('register'); setErrors({}); }}>Register</button>
          </div>

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Your GM name"
                  value={form.username}
                  onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                  autoComplete="username"
                />
                {errors.username && <span className="form-error">{errors.username}</span>}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="your@email.com"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                autoComplete="email"
              />
              {errors.email && <span className="form-error">{errors.email}</span>}
            </div>

            {mode === 'register' && (
              <div className="form-group">
                <label className="form-label">Team Name</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. Chicago Bulls"
                  value={form.teamName}
                  onChange={e => setForm(p => ({ ...p, teamName: e.target.value }))}
                />
                {errors.teamName && <span className="form-error">{errors.teamName}</span>}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Min. 6 characters"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <span className="form-error">{errors.password}</span>}
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg w-full"
              disabled={loading}
              style={{ marginTop: 8 }}
            >
              {loading ? (
                <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" fill="none" strokeDasharray="31" strokeDashoffset="10" />
                </svg>
              ) : mode === 'login' ? 'Sign In' : 'Create Club'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErrors({}); }}
              style={{ color: 'var(--color-primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {mode === 'login' ? 'Register' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
