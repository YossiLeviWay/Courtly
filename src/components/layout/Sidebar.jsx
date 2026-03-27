import { NavLink, useNavigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext.jsx';
import {
  LayoutDashboard, Users, Target, UserCheck, Dumbbell,
  Building2, Heart, Calendar, Trophy, ArrowLeftRight,
  BarChart2, Settings, User, LogOut, Zap, TrendingUp, X
} from 'lucide-react';

function YouthAcademyIcon({ size = 18 }) {
  return <span style={{ fontSize: size, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}>🌱</span>;
}

function ScoutsIcon({ size = 18 }) {
  return <span style={{ fontSize: size, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}>🔭</span>;
}

const NAV_GROUPS = [
  {
    label: 'Club',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/team', icon: BarChart2, label: 'Team Info' },
      { to: '/squad', icon: Users, label: 'Squad' },
      { to: '/tactics', icon: Target, label: 'Tactics' },
    ]
  },
  {
    label: 'Management',
    items: [
      { to: '/staff', icon: UserCheck, label: 'Staff' },
      { to: '/youth-academy', icon: YouthAcademyIcon, label: 'Youth Academy' },
      { to: '/scouts', icon: ScoutsIcon, label: 'Scouts' },
      { to: '/training', icon: Dumbbell, label: 'Training' },
      { to: '/facilities', icon: Building2, label: 'Facilities' },
      { to: '/fans', icon: Heart, label: 'Fans' },
      { to: '/finances', icon: TrendingUp, label: 'Finances' },
    ]
  },
  {
    label: 'Competition',
    items: [
      { to: '/calendar', icon: Calendar, label: 'Calendar' },
      { to: '/league', icon: Trophy, label: 'League' },
      { to: '/transfer', icon: ArrowLeftRight, label: 'Transfer' },
    ]
  },
  {
    label: 'Account',
    items: [
      { to: '/profile', icon: User, label: 'Profile' },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ]
  }
];

export default function Sidebar({ isOpen, onClose }) {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  const team = state.userTeam;

  const handleLogout = () => {
    dispatch({ type: 'SET_USER', payload: null });
    navigate('/login');
  };

  return (
    <aside className={`sidebar${isOpen ? ' open' : ''}`}>
      <div className="sidebar-logo">
        {/* Close button – visible only on mobile */}
        <button
          className="sidebar-close-btn"
          onClick={onClose}
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
        <svg className="sidebar-logo-icon" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="30" fill="#E8621A"/>
          <path d="M32 2 Q50 18 32 32 Q14 46 32 62" stroke="#C04E10" strokeWidth="2.5" fill="none"/>
          <path d="M2 32 Q18 14 32 32 Q46 50 62 32" stroke="#C04E10" strokeWidth="2.5" fill="none"/>
          <path d="M8 16 Q26 24 26 32 Q26 40 8 48" stroke="#C04E10" strokeWidth="1.5" fill="none"/>
          <path d="M56 16 Q38 24 38 32 Q38 40 56 48" stroke="#C04E10" strokeWidth="1.5" fill="none"/>
        </svg>
        <span className="sidebar-logo-text">COURTLY</span>
      </div>

      {team && (
        <div className="sidebar-team">
          <div className="sidebar-team-label">Your Club</div>
          <div className="sidebar-team-name">{team.name}</div>
          <div className="sidebar-balance">${state.userTeam?.budget ?? 250}</div>
        </div>
      )}

      <nav className="sidebar-nav">
        {NAV_GROUPS.map(group => (
          <div key={group.label} className="sidebar-nav-group">
            <div className="sidebar-nav-group-label">{group.label}</div>
            {group.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        {state.isMatchLive && (
          <NavLink to="/match/live" className="sidebar-nav-item" style={{marginBottom: '8px', background: 'rgba(198,40,40,0.1)', borderLeftColor: '#C62828'}}>
            <Zap size={18} color="#C62828" />
            <span style={{color:'#C62828', fontWeight:700}}>Live Match!</span>
          </NavLink>
        )}
        <button className="sidebar-nav-item w-full" onClick={handleLogout} style={{width:'100%'}}>
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
