import { useState } from 'react';
import { useGame } from '../context/GameContext.jsx';
import { Trophy, Medal, MessageSquare, Search, Lock, Star } from 'lucide-react';

const AWARD_GALLERY = [
  { id: 'first_win', label: 'First Victory', icon: '🏆', desc: 'Win your first match', condition: (r) => r.wins >= 1 },
  { id: 'five_wins', label: 'On a Roll', icon: '🔥', desc: 'Win 5 matches', condition: (r) => r.wins >= 5 },
  { id: 'ten_wins', label: 'Veteran Manager', icon: '🎖️', desc: 'Win 10 matches', condition: (r) => r.wins >= 10 },
  { id: 'unbeaten', label: 'Unbeaten Month', icon: '⭐', desc: 'Go 3 games without a loss', condition: (r) => r.wins >= 3 },
  { id: 'dynasty', label: 'Dynasty Builder', icon: '👑', desc: 'Win 25 total matches', condition: (r) => r.wins >= 25 },
];

const MOCK_MESSAGES = [
  { id: 1, from: 'Coach Mike', team: 'Miami Waves', preview: 'Want to discuss a potential trade...', time: '2h ago' },
  { id: 2, from: 'GM Rodriguez', team: 'Barcelona Eagles', preview: 'Congratulations on your last result!', time: '1d ago' },
];

export default function Profile() {
  const { state } = useGame();
  const [tab, setTab] = useState('records');
  const [chatOpen, setChatOpen] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState({ 1: ['Want to discuss a potential trade...'], 2: ['Congratulations on your last result!'] });
  const [searchQuery, setSearchQuery] = useState('');

  const user = state.user;
  const team = state.userTeam;

  const wins = user?.records?.wins || team?.overallRecord?.wins || 0;
  const losses = user?.records?.losses || team?.overallRecord?.losses || 0;
  const honors = user?.records?.honors || [];

  const earnedAwards = AWARD_GALLERY.filter(a => a.condition({ wins, losses }));

  const sendMessage = () => {
    if (!message.trim() || !chatOpen) return;
    setMessages(m => ({ ...m, [chatOpen]: [...(m[chatOpen] || []), message] }));
    setMessage('');
  };

  const joinedDate = user?.joinedAt ? new Date(user.joinedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'Unknown';
  const avatarEmoji = user?.avatar?.emoji || '🏀';

  return (
    <div className="animate-fade-in">
      {/* Profile Header */}
      <div className="card mb-5" style={{ marginBottom: '1.5rem' }}>
        <div className="flex items-center gap-5">
          <div className="avatar avatar-xl" style={{ fontSize: '2.5rem', width: 88, height: 88 }}>
            {avatarEmoji}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900 }}>{user?.username || 'General Manager'}</h2>
              <span className="badge badge-orange">GM</span>
              <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>● Online</span>
            </div>
            <div className="text-sm text-muted mb-2">🏀 {team?.name} · 🏟️ {team?.stadiumName}</div>
            {user?.bio && <p className="text-sm" style={{ color: 'var(--text-secondary)', maxWidth: 400 }}>{user.bio}</p>}
            <div className="text-xs text-muted mt-2">Member since {joinedDate}</div>
          </div>
          <div className="text-center">
            <div className="stat-value" style={{ fontSize: 'var(--font-size-3xl)' }}>{wins}</div>
            <div className="stat-label">Career Wins</div>
            <div className="text-xs text-muted mt-1">{losses} losses</div>
          </div>
        </div>
      </div>

      <div className="tabs mb-5">
        {[['records','Records & Awards'],['messages','Messages'],['history','Match History']].map(([k,l]) => (
          <button key={k} className={`tab${tab===k?' active':''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'records' && (
        <div>
          {/* Overall record */}
          <div className="card mb-4">
            <div className="card-title mb-4">Career Record</div>
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
              <div className="stat-card"><div className="stat-value">{wins}</div><div className="stat-label">Total Wins</div></div>
              <div className="stat-card"><div className="stat-value">{losses}</div><div className="stat-label">Total Losses</div></div>
              <div className="stat-card"><div className="stat-value" style={{ color: wins + losses > 0 ? undefined : 'var(--text-muted)' }}>{wins + losses > 0 ? Math.round(wins / (wins + losses) * 100) + '%' : '—'}</div><div className="stat-label">Win Rate</div></div>
              <div className="stat-card"><div className="stat-value">{honors.length}</div><div className="stat-label">Honors</div></div>
            </div>
          </div>

          {/* Award Gallery */}
          <div className="card">
            <div className="card-title mb-4">Award Gallery</div>
            <div className="grid-auto">
              {AWARD_GALLERY.map(award => {
                const earned = earnedAwards.some(a => a.id === award.id);
                return (
                  <div key={award.id} className="stat-card" style={{
                    opacity: earned ? 1 : 0.4,
                    filter: earned ? 'none' : 'grayscale(1)',
                    transition: 'all 0.3s ease',
                  }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>{earned ? award.icon : '🔒'}</div>
                    <div className="font-semibold text-sm">{award.label}</div>
                    <div className="text-xs text-muted mt-1">{award.desc}</div>
                    {earned && <div className="badge badge-green mt-2">Earned</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'messages' && (
        <div className="grid-2" style={{ gap: '1.5rem' }}>
          {/* Chat List */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Messages</div>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="form-input" style={{ paddingLeft: 28, fontSize: 'var(--font-size-xs)' }} placeholder="Search GMs..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
            </div>
            {MOCK_MESSAGES.filter(m => !searchQuery || m.from.toLowerCase().includes(searchQuery.toLowerCase())).map(conv => (
              <div
                key={conv.id}
                className="flex items-center gap-3"
                style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', background: chatOpen === conv.id ? 'var(--bg-card-hover)' : 'transparent', borderRadius: 8, paddingLeft: 8, paddingRight: 8 }}
                onClick={() => setChatOpen(chatOpen === conv.id ? null : conv.id)}
              >
                <div className="avatar avatar-sm">{conv.from.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{conv.from}</div>
                  <div className="text-xs text-muted truncate">{conv.team}</div>
                  <div className="text-xs text-muted truncate">{conv.preview}</div>
                </div>
                <div className="text-xs text-muted">{conv.time}</div>
              </div>
            ))}
            {MOCK_MESSAGES.length === 0 && (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div className="empty-state-icon"><MessageSquare size={32} /></div>
                <div className="empty-state-title">No messages</div>
              </div>
            )}
          </div>

          {/* Chat Window */}
          {chatOpen ? (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 400 }}>
              <div className="card-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
                <div>
                  <div className="font-semibold">{MOCK_MESSAGES.find(m => m.id === chatOpen)?.from}</div>
                  <div className="text-xs text-muted">{MOCK_MESSAGES.find(m => m.id === chatOpen)?.team}</div>
                </div>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }}>Block</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(messages[chatOpen] || []).map((msg, i) => (
                  <div key={i} style={{ background: 'var(--bg-muted)', borderRadius: 8, padding: '8px 12px', maxWidth: '80%', fontSize: 'var(--font-size-sm)' }}>
                    {msg}
                  </div>
                ))}
              </div>
              <div className="flex gap-2" style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                <input className="form-input" style={{ flex: 1 }} placeholder="Type a message..." value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
                <button className="btn btn-primary btn-sm" onClick={sendMessage}>Send</button>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon"><MessageSquare size={36} /></div>
                <div className="empty-state-title">Select a conversation</div>
                <div className="empty-state-desc">Click a message thread to start chatting</div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="card">
          <div className="card-title mb-4">Recent Match History</div>
          {(team?.matchHistory || []).length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-title">No matches played yet</div>
              <div className="empty-state-desc">Matches will appear here as the season progresses</div>
            </div>
          ) : (
            <table>
              <thead><tr><th>Date</th><th>Opponent</th><th>Score</th><th>Result</th></tr></thead>
              <tbody>
                {(team.matchHistory || []).slice(-10).reverse().map((m, i) => {
                  const won = m.userScore > m.oppScore;
                  return (
                    <tr key={i}>
                      <td className="text-muted text-sm">{new Date(m.date).toLocaleDateString()}</td>
                      <td className="font-semibold">{m.opponent || 'Unknown'}</td>
                      <td className="font-bold" style={{ color: 'var(--color-primary)' }}>{m.userScore} - {m.oppScore}</td>
                      <td><span className={`badge ${won ? 'badge-green' : 'badge-red'}`}>{won ? 'W' : 'L'}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
