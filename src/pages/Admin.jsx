import { useState, useMemo, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Shield, Save, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { useGame } from '../context/GameContext.jsx';
import { apiUpdateRoundDates, apiGetAllUserStates } from '../api.js';

// ── Helpers ───────────────────────────────────────────────────

function tsToInputVal(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function groupMatchesByRound(allMatches) {
  const roundMap = new Map();
  for (const match of allMatches) {
    const key = match.scheduledDate;
    if (!roundMap.has(key)) roundMap.set(key, []);
    roundMap.get(key).push(match);
  }
  return Array.from(roundMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([ts, matches]) => ({ ts, matches }));
}

// ── Schedule Manager ──────────────────────────────────────────

function ScheduleManager({ allMatches }) {
  const rounds = useMemo(() => groupMatchesByRound(allMatches), [allMatches]);
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [expandedRound, setExpandedRound] = useState(null);

  const hasEdits = Object.keys(edits).length > 0;
  const now = Date.now();

  async function handleSave() {
    setSaving(true);
    try {
      for (const [origTs, newTs] of Object.entries(edits)) {
        const round = rounds.find(r => String(r.ts) === origTs);
        if (!round || !newTs) continue;
        await apiUpdateRoundDates(round.matches.map(m => m.id), newTs);
      }
      setEdits({});
      setSavedMsg(`Saved ${Object.keys(edits).length} round(s). Refresh the page to see updated schedule.`);
      setTimeout(() => setSavedMsg(''), 6000);
    } catch (err) {
      alert('Error saving schedule: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)' }}>
            {rounds.length} Rounds · {allMatches.length} Total Fixtures
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 2 }}>
            Edit the datetime to reschedule all games in a round simultaneously.
          </div>
        </div>
        <button
          className="btn btn-primary"
          disabled={!hasEdits || saving}
          onClick={handleSave}
        >
          <Save size={16} /> {saving ? 'Saving…' : `Save ${Object.keys(edits).length} Change${Object.keys(edits).length !== 1 ? 's' : ''}`}
        </button>
      </div>

      {savedMsg && (
        <div style={{ padding: '10px 16px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 'var(--font-size-sm)', color: '#16a34a', fontWeight: 600 }}>
          ✓ {savedMsg}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rounds.map((round, i) => {
          const isPast = round.ts < now;
          const isExpanded = expandedRound === i;
          const editedTs = edits[String(round.ts)];
          const displayTs = editedTs ?? round.ts;
          const isEdited = String(round.ts) in edits;

          return (
            <div key={round.ts} className="card" style={{ padding: 0 }}>
              {/* Round header */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  cursor: 'pointer',
                  borderLeft: `3px solid ${isEdited ? 'var(--color-primary)' : 'transparent'}`,
                  background: isEdited ? 'rgba(232,98,26,0.03)' : undefined,
                  flexWrap: 'wrap',
                }}
                onClick={() => setExpandedRound(isExpanded ? null : i)}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: isPast ? 'var(--bg-muted)' : 'var(--color-primary-100)',
                  color: isPast ? 'var(--text-muted)' : 'var(--color-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 'var(--font-size-xs)',
                }}>{i + 1}</div>

                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    Round {i + 1} · {round.matches.length} games
                    {isPast && <span className="badge badge-gray" style={{ fontSize: '0.6rem' }}>PAST</span>}
                    {isEdited && <span className="badge badge-orange" style={{ fontSize: '0.6rem' }}>EDITED</span>}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                    {new Date(displayTs).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {/* Datetime picker */}
                <div onClick={e => e.stopPropagation()}>
                  <input
                    type="datetime-local"
                    className="form-input"
                    style={{ fontSize: 'var(--font-size-xs)', padding: '4px 8px', width: 'auto' }}
                    value={tsToInputVal(displayTs)}
                    onChange={e => {
                      const newTs = e.target.value ? new Date(e.target.value).getTime() : null;
                      setEdits(prev => {
                        const next = { ...prev };
                        if (newTs && newTs !== round.ts) {
                          next[String(round.ts)] = newTs;
                        } else {
                          delete next[String(round.ts)];
                        }
                        return next;
                      });
                    }}
                  />
                </div>

                {isExpanded ? <ChevronDown size={16} style={{ flexShrink: 0 }} /> : <ChevronRight size={16} style={{ flexShrink: 0 }} />}
              </div>

              {/* Match list */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--border-color)', padding: '12px 16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {round.matches.map(m => (
                      <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-size-sm)', padding: '4px 0', borderBottom: '1px solid var(--border-color)' }}>
                        <span style={{ fontWeight: 600, flex: 1 }}>{m.homeTeamName}</span>
                        <span style={{ color: 'var(--text-muted)', padding: '0 8px' }}>vs</span>
                        <span style={{ fontWeight: 600, flex: 1, textAlign: 'right' }}>{m.awayTeamName}</span>
                        {m.played && (
                          <span className="badge badge-gray" style={{ marginLeft: 8, fontSize: '0.6rem' }}>
                            {m.result?.homeScore}–{m.result?.awayScore}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Teams Overview ────────────────────────────────────────────

function TeamsView({ leagues }) {
  const [expanded, setExpanded] = useState(null);

  return (
    <div>
      {leagues.map(league => {
        const standings = league.standings?.length ? league.standings : (league.teams || []).map(t => ({ teamId: t.id, teamName: t.name, wins: 0, losses: 0, points: 0 }));
        const sorted = [...standings].sort((a, b) => (b.points || 0) - (a.points || 0));

        return (
          <div key={league.id} style={{ marginBottom: 32 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>{league.name}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sorted.map((standing, si) => {
                const teamId = standing.teamId || standing.id;
                const teamName = standing.teamName || standing.name;
                const isExpanded = expanded === teamId;
                const team = league.teams?.find(t => t.id === teamId);

                return (
                  <div key={teamId} className="card" style={{ padding: 0 }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer' }}
                      onClick={() => setExpanded(isExpanded ? null : teamId)}
                    >
                      <div style={{ width: 24, textAlign: 'center', fontWeight: 800, color: si < 3 ? 'var(--color-primary)' : 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                        {si + 1}
                      </div>
                      <div style={{ flex: 1, fontWeight: 600 }}>{teamName}</div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        <span>{standing.wins || 0}W–{standing.losses || 0}L</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{standing.points || 0} pts</span>
                      </div>
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>

                    {isExpanded && team && (
                      <div style={{ borderTop: '1px solid var(--border-color)', padding: '12px 16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
                          {(team.players || [])
                            .sort((a, b) => (b.overallRating || 0) - (a.overallRating || 0))
                            .slice(0, 10)
                            .map(p => (
                              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', padding: '3px 0', borderBottom: '1px solid var(--border-color)' }}>
                                <span>{p.name} <span style={{ color: 'var(--text-muted)' }}>{p.position}</span></span>
                                <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{p.overallRating}</span>
                              </div>
                            ))}
                        </div>
                        {team.stadiumName && (
                          <div style={{ marginTop: 8, fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                            🏟 {team.stadiumName}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Users View ────────────────────────────────────────────────

function UsersView() {
  const { state } = useGame();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGetAllUserStates().then(data => {
      setUsers(data.filter(u => u.user));
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
      <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
      <div>Loading users…</div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 16, fontWeight: 700 }}>{users.length} registered users</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {users.map(({ user, state: uState }) => {
          const teamName = state.allTeams?.find(t => t.id === uState?.teamId)?.name || uState?.teamId || '—';
          const matchesPlayed = (uState?.seasonRecord?.wins || 0) + (uState?.seasonRecord?.losses || 0);

          return (
            <div key={user.id} className="card" style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {user.username || user.email}
                    {user.isAdmin && <span className="badge badge-orange" style={{ fontSize: '0.6rem' }}>ADMIN</span>}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                    {user.email} · {teamName}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                  {uState?.budget != null && (
                    <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>${uState.budget}k</span>
                  )}
                  <span>{uState?.seasonRecord?.wins || 0}W – {uState?.seasonRecord?.losses || 0}L</span>
                  <span>{matchesPlayed} played</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Admin Page ───────────────────────────────────────────

export default function Admin() {
  const { state } = useGame();
  const [tab, setTab] = useState('schedule');

  if (!state.initialized) return null;
  if (!state.user?.isAdmin) return <Navigate to="/" replace />;

  const allMatches = (state.leagues || []).flatMap(l => l.schedule || []);
  const leagues = state.leagues || [];

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Shield size={28} color="var(--color-primary)" />
          <div>
            <h1 style={{ margin: 0 }}>Admin Panel</h1>
            <p style={{ margin: 0 }}>Manage schedule, teams, and world settings</p>
          </div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 24 }}>
        {[['schedule', '📅 Schedule'], ['teams', '🏀 Teams'], ['users', '👤 Users']].map(([k, l]) => (
          <button key={k} className={`tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'schedule' && <ScheduleManager allMatches={allMatches} />}
      {tab === 'teams'    && <TeamsView leagues={leagues} />}
      {tab === 'users'    && <UsersView />}
    </div>
  );
}
