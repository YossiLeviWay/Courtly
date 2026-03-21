import { useLocation } from 'react-router-dom';
import { useGame } from '../../context/GameContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { Sun, Moon, Bell } from 'lucide-react';

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
};

export default function Header() {
  const location = useLocation();
  const { state } = useGame();
  const { theme, toggleTheme } = useTheme();

  const path = '/' + location.pathname.split('/')[1];
  const title = PAGE_TITLES[path] || 'Courtly';
  const user = state.user;

  const unread = state.notifications?.length || 0;

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="header-title">{title}</h1>
        {state.userTeam && (
          <span className="text-sm text-muted" style={{display:'none'}}>
            {state.userTeam.name}
          </span>
        )}
      </div>
      <div className="header-right">
        {state.isMatchLive && (
          <div className="live-badge">
            <span className="live-dot" />
            LIVE
          </div>
        )}
        <div style={{position:'relative'}}>
          <button className="btn btn-ghost btn-sm" style={{position:'relative', padding:'8px'}}>
            <Bell size={18} />
            {unread > 0 && (
              <span style={{
                position:'absolute', top:2, right:2, width:8, height:8,
                background:'var(--color-danger)', borderRadius:'50%'
              }} />
            )}
          </button>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          style={{padding:'8px'}}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        {user && (
          <div className="flex items-center gap-2">
            <div className="avatar avatar-sm" style={{
              background: 'var(--color-primary-100)',
              color: 'var(--color-primary)',
              fontSize: '0.7rem',
              fontWeight: 800
            }}>
              {user.username?.charAt(0).toUpperCase() || 'G'}
            </div>
            <span className="text-sm font-semibold" style={{color:'var(--text-secondary)'}}>
              {user.username}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
