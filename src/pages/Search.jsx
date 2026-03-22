import { useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext.jsx';
import { Search, Users, Briefcase, ChevronRight } from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────

function highlight(text, query) {
  if (!query || !text) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(232,98,26,0.22)', color: 'inherit', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

const POSITION_COLORS = { PG: '#3B82F6', SG: '#F59E0B', SF: '#10B981', PF: '#EF4444', C: '#8B5CF6' };

// ── Result cards ───────────────────────────────────────────────

function TeamCard({ team, query, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-card)', background: 'var(--bg-card)',
        cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = 'var(--color-primary-100)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-card)'; e.currentTarget.style.background = 'var(--bg-card)'; }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 'var(--radius-md)',
        background: team.colors?.primary || 'var(--color-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.3rem', flexShrink: 0,
      }}>
        🏀
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 'var(--font-size-base)', color: 'var(--text-primary)' }}>
          {highlight(team.name, query)}
        </div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
          {[team.city, team.country, team.league].filter(Boolean).join(' · ')}
        </div>
      </div>
      {team.isUserTeam && <span className="badge badge-orange">My Team</span>}
      <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    </div>
  );
}

function PlayerCard({ player, query, onClick }) {
  const posColor = POSITION_COLORS[player.position] || 'var(--color-primary)';
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-card)', background: 'var(--bg-card)',
        cursor: onClick ? 'pointer' : 'default', transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = 'var(--color-primary-100)'; } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-card)'; e.currentTarget.style.background = 'var(--bg-card)'; }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: posColor + '22', border: `2px solid ${posColor}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 900, fontSize: '0.75rem', color: posColor, flexShrink: 0,
      }}>
        {player.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
          {highlight(player.name, query)}
        </div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
          {highlight(player.teamName, query)} · {highlight(player.nationality, query)}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
        <span style={{
          padding: '2px 8px', borderRadius: 'var(--radius-full)',
          background: posColor + '22', color: posColor, fontWeight: 800, fontSize: '0.7rem',
        }}>
          {player.position}
        </span>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-primary)' }}>OVR {player.overallRating}</span>
      </div>
      {onClick && <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
    </div>
  );
}

function StaffCard({ member, query }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-card)', background: 'var(--bg-card)',
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 'var(--radius-md)',
        background: 'var(--bg-muted)', border: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.3rem', flexShrink: 0,
      }}>
        👔
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
          {highlight(member.name, query)}
        </div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
          {highlight(member.role || '', query)} · {highlight(member.teamName, query)}
        </div>
      </div>
      {member.ability != null && (
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>
          Ability {member.primaryAbility ?? member.ability}
        </span>
      )}
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────

function ResultSection({ icon, title, count, children }) {
  return (
    <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
      <div className="card-header" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {icon}
          <span className="card-title">{title}</span>
        </div>
        <span className="badge badge-gray">{count} result{count !== 1 ? 's' : ''}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {children}
      </div>
    </div>
  );
}

// ── Main Search Page ───────────────────────────────────────────

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { state } = useGame();

  const query = searchParams.get('q') || '';
  const [inputVal, setInputVal] = useState(query);

  const q = query.toLowerCase().trim();

  const results = useMemo(() => {
    if (!q || !state.allTeams?.length) return { teams: [], players: [], staff: [] };

    const teams = [];
    const players = [];
    const staff = [];

    for (const team of state.allTeams) {
      if (
        team.name?.toLowerCase().includes(q) ||
        team.city?.toLowerCase().includes(q) ||
        team.country?.toLowerCase().includes(q) ||
        team.nickname?.toLowerCase().includes(q) ||
        team.league?.toLowerCase().includes(q)
      ) {
        teams.push(team);
      }

      for (const p of team.players || []) {
        if (
          p.name?.toLowerCase().includes(q) ||
          p.position?.toLowerCase().includes(q) ||
          p.nationality?.toLowerCase().includes(q) ||
          p.specialAbility?.toLowerCase().includes(q)
        ) {
          players.push({ ...p, teamName: team.name, isUserTeam: !!team.isUserTeam });
        }
      }

      for (const s of Object.values(team.staff || {})) {
        if (!s || typeof s !== 'object' || !s.name) continue;
        if (
          s.name.toLowerCase().includes(q) ||
          (s.role || '').toLowerCase().includes(q) ||
          (s.nationality || '').toLowerCase().includes(q)
        ) {
          staff.push({ ...s, teamName: team.name });
        }
      }
    }

    return { teams, players, staff };
  }, [q, state.allTeams]);

  const total = results.teams.length + results.players.length + results.staff.length;

  const handleSearch = (e) => {
    e.preventDefault();
    if (inputVal.trim()) setSearchParams({ q: inputVal.trim() });
  };

  return (
    <div className="page-content animate-fade-in">
      {/* Search bar */}
      <div className="page-header">
        <div style={{ maxWidth: 560 }}>
          <h1>Search</h1>
          <form onSubmit={handleSearch} style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                autoFocus
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                placeholder="Search players, teams, staff…"
                style={{
                  width: '100%', paddingLeft: 38, paddingRight: 14, height: 42,
                  borderRadius: 'var(--radius-full)', border: '2px solid var(--border-color)',
                  background: 'var(--bg-card)', fontSize: 'var(--font-size-sm)',
                  color: 'var(--text-primary)', outline: 'none',
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ borderRadius: 'var(--radius-full)', paddingLeft: 20, paddingRight: 20 }}>
              Search
            </button>
          </form>
        </div>
      </div>

      {/* No query */}
      {!q && (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-title">Search the world</div>
          <div className="empty-state-desc">Find players, teams and staff across all leagues.</div>
        </div>
      )}

      {/* No results */}
      {q && total === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">😕</div>
          <div className="empty-state-title">No results for "{query}"</div>
          <div className="empty-state-desc">Try a different name, position, or nationality.</div>
        </div>
      )}

      {/* Summary */}
      {q && total > 0 && (
        <div style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
          Found <strong style={{ color: 'var(--text-primary)' }}>{total}</strong> result{total !== 1 ? 's' : ''} for "{query}"
        </div>
      )}

      {/* Teams */}
      {results.teams.length > 0 && (
        <ResultSection icon={<span style={{ fontSize: '1.1rem' }}>🏀</span>} title="Teams" count={results.teams.length}>
          {results.teams.map(t => (
            <TeamCard
              key={t.id}
              team={t}
              query={query}
              onClick={() => t.isUserTeam ? navigate('/team') : navigate('/league')}
            />
          ))}
        </ResultSection>
      )}

      {/* Players */}
      {results.players.length > 0 && (
        <ResultSection icon={<Users size={16} style={{ color: 'var(--color-primary)' }} />} title="Players" count={results.players.length}>
          {results.players.map(p => (
            <PlayerCard
              key={p.id}
              player={p}
              query={query}
              onClick={p.isUserTeam ? () => navigate(`/squad/${p.id}`) : null}
            />
          ))}
        </ResultSection>
      )}

      {/* Staff */}
      {results.staff.length > 0 && (
        <ResultSection icon={<Briefcase size={16} style={{ color: 'var(--color-primary)' }} />} title="Staff" count={results.staff.length}>
          {results.staff.map((s, i) => (
            <StaffCard key={s.id || `${s.name}-${i}`} member={s} query={query} />
          ))}
        </ResultSection>
      )}
    </div>
  );
}
