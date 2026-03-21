import { useState, useMemo } from 'react';
import { useGame } from '../context/GameContext.jsx';
import { useNavigate } from 'react-router-dom';
import { Save, Lock, User, AlertCircle, CheckCircle } from 'lucide-react';

const AVATARS = {
  'Animals': ['🦁','🐯','🦅','🐺','🦊','🐻','🦋','🦈','🐬','🦏','🐘','🦒','🦓','🦌','🐆'],
  'Monuments': ['🗽','🗼','🏰','🕌','🛕','⛩️','🏯','🗿','🕍','🏛️','🏟️','🗺️','🌍','🌐','🏔️'],
  'Sports': ['🏀','⚡','🔥','💎','👑','🏆','🎯','💪','🌟','🚀','⚡','🥇','🎖️','🏅','🎪'],
};

export default function Settings() {
  const { state, dispatch, addNotification } = useGame();
  const [tab, setTab] = useState('profile');

  const user = state.user;
  const team = state.userTeam;

  // Profile form
  const [profile, setProfile] = useState({
    username: user?.username || '',
    teamName: team?.name || '',
    stadiumName: team?.stadiumName || '',
    email: user?.email || '',
    bio: user?.bio || '',
    gender: user?.gender || '',
  });

  // Password form
  const [passwords, setPasswords] = useState({ current: '', newPass: '', confirm: '' });
  const [passError, setPassError] = useState('');

  // Avatar
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar?.emoji || '🏀');

  // Changes limit: 2 per day
  const today = new Date().toDateString();
  const changesUsed = user?.lastSettingsChange === today ? (user?.settingsChangesToday || 0) : 0;
  const changesLeft = 2 - changesUsed;

  const handleSaveProfile = () => {
    if (changesLeft <= 0) {
      addNotification('You have reached the maximum 2 settings changes for today.', 'error');
      return;
    }
    const updatedUser = {
      ...user,
      username: profile.username,
      email: profile.email,
      bio: profile.bio,
      gender: profile.gender,
      settingsChangesToday: changesUsed + 1,
      lastSettingsChange: today,
    };
    const updatedTeam = { ...team, name: profile.teamName, stadiumName: profile.stadiumName };
    dispatch({ type: 'SET_USER', payload: updatedUser });
    dispatch({ type: 'UPDATE_TEAM', payload: updatedTeam });
    addNotification('Profile updated successfully!', 'success');
  };

  const handleSaveAvatar = () => {
    const updatedUser = { ...user, avatar: { type: 'emoji', emoji: selectedAvatar } };
    dispatch({ type: 'SET_USER', payload: updatedUser });
    addNotification('Avatar updated!', 'success');
  };

  const handleChangePassword = () => {
    if (!passwords.newPass || passwords.newPass.length < 6) {
      setPassError('Password must be at least 6 characters');
      return;
    }
    if (passwords.newPass !== passwords.confirm) {
      setPassError('Passwords do not match');
      return;
    }
    setPassError('');
    setPasswords({ current: '', newPass: '', confirm: '' });
    addNotification('Password changed successfully!', 'success');
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Manage your account, team details, and preferences</p>
      </div>

      <div className="tabs mb-5">
        {[['profile','Profile'],['avatar','Avatar'],['password','Password'],['notifications','Notifications']].map(([k,l]) => (
          <button key={k} className={`tab${tab===k?' active':''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="card" style={{ maxWidth: 540 }}>
          <div className="card-header">
            <div className="card-title">Profile Information</div>
            <div className="flex items-center gap-2">
              {changesLeft > 0
                ? <span className="badge badge-green">{changesLeft} change{changesLeft !== 1 ? 's' : ''} left today</span>
                : <span className="badge badge-red"><AlertCircle size={12} /> No changes left today</span>
              }
            </div>
          </div>

          <div className="grid-2" style={{ gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input className="form-input" value={profile.username} onChange={e => setProfile(p => ({...p, username: e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={profile.email} onChange={e => setProfile(p => ({...p, email: e.target.value}))} />
            </div>
          </div>
          <div className="grid-2" style={{ gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Team Name</label>
              <input className="form-input" value={profile.teamName} onChange={e => setProfile(p => ({...p, teamName: e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Stadium Name</label>
              <input className="form-input" value={profile.stadiumName} onChange={e => setProfile(p => ({...p, stadiumName: e.target.value}))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Bio</label>
            <textarea className="form-textarea" value={profile.bio} onChange={e => setProfile(p => ({...p, bio: e.target.value}))} placeholder="Tell the community about your management style..." />
          </div>
          <div className="form-group">
            <label className="form-label">Gender</label>
            <select className="form-select" value={profile.gender} onChange={e => setProfile(p => ({...p, gender: e.target.value}))}>
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={handleSaveProfile} disabled={changesLeft <= 0}>
            <Save size={16} /> Save Profile
          </button>
          <p className="text-xs text-muted mt-3">
            ⚠️ Profile and team details can only be changed twice per day.
          </p>
        </div>
      )}

      {tab === 'avatar' && (
        <div>
          <div className="card mb-4" style={{ maxWidth: 600 }}>
            <div className="card-title mb-2">Current Avatar</div>
            <div className="flex items-center gap-4 mb-4">
              <div className="avatar avatar-xl" style={{ fontSize: '2.5rem' }}>
                {selectedAvatar}
              </div>
              <div>
                <div className="font-semibold">{user?.username}</div>
                <div className="text-sm text-muted">General Manager · {team?.name}</div>
              </div>
            </div>
          </div>
          {Object.entries(AVATARS).map(([category, emojis]) => (
            <div key={category} className="card mb-3" style={{ maxWidth: 600 }}>
              <div className="card-title mb-3">{category}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {emojis.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => setSelectedAvatar(emoji)}
                    style={{
                      width: 52, height: 52, borderRadius: 'var(--radius-md)',
                      fontSize: '1.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: selectedAvatar === emoji ? '2px solid var(--color-primary)' : '2px solid var(--border-color)',
                      background: selectedAvatar === emoji ? 'var(--color-primary-100)' : 'var(--bg-muted)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button className="btn btn-primary" onClick={handleSaveAvatar}>
            <CheckCircle size={16} /> Save Avatar
          </button>
        </div>
      )}

      {tab === 'password' && (
        <div className="card" style={{ maxWidth: 400 }}>
          <div className="card-title mb-4">Change Password</div>
          <div className="form-group">
            <label className="form-label">Current Password</label>
            <input className="form-input" type="password" value={passwords.current} onChange={e => setPasswords(p => ({...p, current: e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input className="form-input" type="password" value={passwords.newPass} onChange={e => setPasswords(p => ({...p, newPass: e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <input className="form-input" type="password" value={passwords.confirm} onChange={e => setPasswords(p => ({...p, confirm: e.target.value}))} />
          </div>
          {passError && <div className="form-error mb-3">{passError}</div>}
          <button className="btn btn-primary" onClick={handleChangePassword}>
            <Lock size={16} /> Change Password
          </button>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="card" style={{ maxWidth: 400 }}>
          <div className="card-title mb-4">Notification Preferences</div>
          {[
            { label: 'Match Results', desc: 'Get notified when a match finishes' },
            { label: 'Injury Alerts', desc: 'Alerts when players get injured' },
            { label: 'Transfer Activity', desc: 'Notifications for market activity' },
            { label: 'League Updates', desc: 'League table changes and promotions' },
            { label: 'Weekly Fan News', desc: 'Weekly fan report updates' },
          ].map(({ label, desc }) => (
            <div key={label} className="flex items-center justify-between" style={{ padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <div className="font-semibold text-sm">{label}</div>
                <div className="text-xs text-muted">{desc}</div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked style={{ accentColor: 'var(--color-primary)', width: 16, height: 16 }} />
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
