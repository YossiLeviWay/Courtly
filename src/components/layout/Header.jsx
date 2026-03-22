import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { Sun, Moon, Bell, Search, X } from 'lucide-react';

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/squad': 'Squad',
  '/tactics': 'Tactics Center',
  '/staff': 'Staff',
  '/training': 'Training & Chemistry',
  '/facilities': 'Facilities',
  '/fans': 'Fans Dashboard',
  '/calendar': 'Calendar & Fixtures',
  '/league': 'League Table',
  '/transfer': 'Transfer Market',
  '/team': 'Team Information',
  '/settings': 'Settings',
  '/profile': 'My Profile',
  '/match/live': 'Live Match',
  '/search': 'Search',
};

// ── Inline search results preview ────────────────────────────

function SearchPreview({ query, allTeams, onClose, onNavigate }) {
  const q = query.toLowerCase().trim();
  if (!q || !allTeams?.length) return null;

  const teams = [];
  const players = [];
  const staff = [];

  for (const team of allTeams) {
    if (teams.length >= 3 && players.length >= 5 && staff.length >= 3) break;

    if (teams.length < 3 &&
      (team.name?.toLowerCase().includes(q) || team.city?.toLowerCase().includes(q))) {
      teams.push(team);
    }

    for (const p of team.players || []) {
      if (players.length >= 5) break;
      if (p.name?.toLowerCase().includes(q) || p.position?.toLowerCase().includes(q) || p.nationality?.toLowerCase().includes(q)) {
        players.push({ ...p, teamName: team.name, isUserTeam: team.isUserTeam });
      }
    }

    for (const s of Object.values(team.staff || {})) {
      if (staff.length >= 3) break;
      if (s && s.name?.toLowerCase().includes(q)) {
        staff.push({ ...s, teamName: team.name });
      }
    }
  }

  const total = teams.length + players.length + staff.length;
  if (total === 0) return (
    <div style={dropdownStyle}>
      <div style={{ padding: 'var(--space-4)', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', textAlign: 'center' }}>
        No results for "{query}"
      </div>
    </div>
  );

  return (
    <div style={dropdownStyle}>
      {teams.length > 0 && (
        <Section label="Teams">
          {teams.map(t => (
            <ResultRow
              key={t.id}
              icon="🏀"
              primary={t.name}
              secondary={`${t.city || ''} · ${t.league || ''}`}
              onClick={() => { onNavigate('/league'); onClose(); }}
            />
          ))}
        </Section>
      )}
      {players.length > 0 && (
        <Section label="Players">
          {players.map(p => (
            <ResultRow
              key={p.id}
              icon={<span style={{ fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-primary)' }}>{p.position}</span>}
              primary={p.name}
              secondary={`${p.teamName} · OVR ${p.overallRating}`}
              onClick={() => {
                if (p.isUserTeam) { onNavigate(`/squad/${p.id}`); } else { onNavigate('/search?q=' + encodeURIComponent(query)); }
                onClose();
              }}
            />
          ))}
        </Section>
      )}
      {staff.length > 0 && (
        <Section label="Staff">
          {staff.map(s => (
            <ResultRow
              key={s.id || s.name}
              icon="👔"
              primary={s.name}
              secondary={`${s.role || ''} · ${s.teamName}`}
              onClick={() => { onNavigate('/search?q=' + encodeURIComponent(query)); onClose(); }}
            />
          ))}
        </Section>
      )}
      <div
        style={{ padding: '8px var(--space-3)', borderTop: '1px solid var(--border-color)', cursor: 'pointer', fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 700, textAlign: 'center' }}
        onClick={() => { onNavigate('/search?q=' + encodeURIComponent(query)); onClose(); }}
      >
        See all results →
      </div>
    </div>
  );
}

const dropdownStyle = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  left: 0,
  right: 0,
  background: 'var(--bg-card)',
  border: '1.5px solid var(--border-color)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
  zIndex: 500,
  overflow: 'hidden',
  minWidth: 280,
};

function Section({ label, children }) {
  return (
    <div>
      <div style={{ padding: '6px var(--space-3) 2px', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)' }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function ResultRow({ icon, primary, secondary, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        padding: '7px var(--space-3)', cursor: 'pointer',
        background: hovered ? 'var(--bg-muted)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      <span style={{ fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{primary}</div>
        <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>{secondary}</div>
      </div>
    </div>
  );
}

// ── Main Header ───────────────────────────────────────────────

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useGame();
  const { theme, toggleTheme } = useTheme();

  const path = '/' + location.pathname.split('/')[1];
  const title = PAGE_TITLES[path] || 'Courtly';
  const user = state.user;
  const unread = state.notifications?.length || 0;

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function onOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    setOpen(false);
    setQuery('');
  };

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="header-title">{title}</h1>
      </div>
      <div className="header-right">
        {/* Global Search */}
        {user && (
          <div ref={wrapRef} style={{ position: 'relative' }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  value={query}
                  onChange={e => { setQuery(e.target.value); setOpen(e.target.value.length > 1); }}
                  onFocus={() => query.length > 1 && setOpen(true)}
                  placeholder="Search players, teams…"
                  style={{
                    paddingLeft: 30, paddingRight: query ? 28 : 12,
                    height: 34, borderRadius: 'var(--radius-full)',
                    border: '1.5px solid var(--border-color)',
                    background: 'var(--bg-muted)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--text-primary)',
                    outline: 'none', width: 210,
                    transition: 'border-color 0.15s, width 0.2s',
                  }}
                  onFocusCapture={e => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.width = '240px'; }}
                  onBlurCapture={e => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.width = '210px'; }}
                />
                {query && (
                  <button type="button" onClick={() => { setQuery(''); setOpen(false); }}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                    <X size={12} style={{ color: 'var(--text-muted)' }} />
                  </button>
                )}
              </div>
            </form>

            {open && (
              <SearchPreview
                query={query}
                allTeams={state.allTeams}
                onClose={() => setOpen(false)}
                onNavigate={navigate}
              />
            )}
          </div>
        )}

        {state.isMatchLive && (
          <div className="live-badge">
            <span className="live-dot" />
            LIVE
          </div>
        )}
        <div style={{ position: 'relative' }}>
          <button className="btn btn-ghost btn-sm" style={{ position: 'relative', padding: '8px' }}>
            <Bell size={18} />
            {unread > 0 && (
              <span style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, background: 'var(--color-danger)', borderRadius: '50%' }} />
            )}
          </button>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={toggleTheme} title={theme === 'light' ? 'Dark Mode' : 'Light Mode'} style={{ padding: '8px' }}>
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        {user && (
          <div className="flex items-center gap-2">
            <div className="avatar avatar-sm" style={{ background: 'var(--color-primary-100)', color: 'var(--color-primary)', fontSize: '0.7rem', fontWeight: 800 }}>
              {user.username?.charAt(0).toUpperCase() || 'G'}
            </div>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {user.username}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
