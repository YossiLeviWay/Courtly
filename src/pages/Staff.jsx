import { useState } from 'react';
import { useGame } from '../context/GameContext.jsx';
import { Users, X, Star, TrendingUp, AlertTriangle } from 'lucide-react';

// ── Staff role display metadata ──────────────────────────────

const ROLE_META = {
  'Head Coach': {
    displayName: 'Head Coach',
    key: 'Head Coach',
    primaryAbilityKey: 'tacticalKnowledge',
    primaryAbilityLabel: 'Tactical Knowledge',
    icon: '🏀',
  },
  'Assistant Coach': {
    displayName: 'Assistant Coach',
    key: 'Assistant Coach',
    primaryAbilityKey: 'playerDevelopment',
    primaryAbilityLabel: 'Player Development',
    icon: '📋',
  },
  'Physio': {
    displayName: 'Athletic Trainer',
    key: 'Physio',
    primaryAbilityKey: 'injuryPrevention',
    primaryAbilityLabel: 'Injury Prevention',
    icon: '🩺',
  },
  'Scout': {
    displayName: 'Scout',
    key: 'Scout',
    primaryAbilityKey: 'playerEvaluation',
    primaryAbilityLabel: 'Player Evaluation',
    icon: '🔭',
  },
  'Psychologist': {
    displayName: 'Team Psychologist',
    key: 'Psychologist',
    primaryAbilityKey: 'mentalConditioning',
    primaryAbilityLabel: 'Mental Conditioning',
    icon: '🧠',
  },
  'Nutritionist': {
    displayName: 'Nutritionist',
    key: 'Nutritionist',
    primaryAbilityKey: 'dietPlanning',
    primaryAbilityLabel: 'Diet Planning',
    icon: '🥗',
  },
  'Strength & Conditioning Coach': {
    displayName: 'S&C Coach',
    key: 'Strength & Conditioning Coach',
    primaryAbilityKey: 'strengthTraining',
    primaryAbilityLabel: 'Strength Training',
    icon: '💪',
  },
  'Data Analyst': {
    displayName: 'Data Analyst',
    key: 'Data Analyst',
    primaryAbilityKey: 'statisticalAnalysis',
    primaryAbilityLabel: 'Statistical Analysis',
    icon: '📊',
  },
  'Team Manager': {
    displayName: 'Team Manager',
    key: 'Team Manager',
    primaryAbilityKey: 'logistics',
    primaryAbilityLabel: 'Logistics',
    icon: '🗂',
  },
};

const STAFF_ROLE_ORDER = [
  'Head Coach',
  'Assistant Coach',
  'Physio',
  'Scout',
  'Psychologist',
  'Nutritionist',
  'Strength & Conditioning Coach',
  'Data Analyst',
  'Team Manager',
];

// ── Ability label formatter ───────────────────────────────────

function formatAbilityLabel(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

// ── Badge color cycling ───────────────────────────────────────

const BADGE_CYCLE = ['badge-orange', 'badge-blue', 'badge-gray'];

function charBadgeClass(index) {
  return BADGE_CYCLE[index % BADGE_CYCLE.length];
}

// ── Progress bar sub-component ───────────────────────────────

function AbilityBar({ label, value }) {
  const pct = Math.min(100, Math.max(0, value ?? 0));
  const colorClass =
    pct >= 75 ? 'success' : pct >= 50 ? 'warning' : 'danger';
  return (
    <div style={{ marginBottom: 'var(--space-3)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 4,
          fontSize: 'var(--font-size-xs)',
          fontWeight: 600,
          color: 'var(--text-secondary)',
        }}
      >
        <span>{label}</span>
        <span
          style={{
            color:
              pct >= 75
                ? 'var(--color-success)'
                : pct >= 50
                ? 'var(--color-warning)'
                : 'var(--color-danger)',
            fontWeight: 800,
          }}
        >
          {pct}
        </span>
      </div>
      <div className="progress-bar-track">
        <div
          className={`progress-bar-fill ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Staff detail modal ────────────────────────────────────────

function StaffModal({ member, meta, onClose, releaseConfirm, onReleaseConfirm, onReleaseClear, onReleaseStaff }) {
  if (!member) return null;

  const abilities = member.abilities ?? {};
  const abilityEntries = Object.entries(abilities);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560 }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              className="avatar avatar-lg"
              style={{ fontSize: 'var(--font-size-xl)', background: 'var(--color-primary-100)' }}
            >
              {member.name
                ?.split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2) || '??'}
            </div>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, marginBottom: 2 }}>
                {member.name}
              </h2>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                {meta?.displayName ?? member.role} · Age {member.age}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {/* Characterizations */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <p
              style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 1,
                color: 'var(--text-muted)',
                marginBottom: 'var(--space-2)',
              }}
            >
              Characterizations
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {(member.characterizations ?? []).map((c, i) => (
                <span key={c} className={`badge ${charBadgeClass(i)}`}>
                  {c}
                </span>
              ))}
            </div>
          </div>

          {/* Bio */}
          {member.biography && (
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                background: 'var(--bg-muted)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-4)',
                fontStyle: 'italic',
              }}
            >
              "{member.biography}"
            </div>
          )}

          {/* Motivation */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <AbilityBar label="Motivation" value={member.motivation} />
          </div>

          {/* All abilities */}
          <p
            style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: 'var(--text-muted)',
              marginBottom: 'var(--space-3)',
            }}
          >
            Abilities
          </p>
          {abilityEntries.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
              No ability data available.
            </p>
          ) : (
            abilityEntries.map(([key, val]) => (
              <AbilityBar key={key} label={formatAbilityLabel(key)} value={val} />
            ))
          )}

          {/* Salary */}
          {member.salary !== undefined && (
            <div
              style={{
                marginTop: 'var(--space-4)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-muted)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Annual Salary
              </span>
              <span style={{ fontWeight: 800, color: 'var(--color-primary)' }}>
                ${member.salary}k
              </span>
            </div>
          )}

          {/* Release section */}
          <div style={{ borderTop: '1px solid var(--border-color)', marginTop: 16, paddingTop: 16 }}>
            {releaseConfirm === member?.role ? (
              <div style={{ background: 'var(--color-danger-light, rgba(239,68,68,0.1))', borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 8 }}>
                <p style={{ fontWeight: 600, color: 'var(--color-danger)', marginBottom: 8, fontSize: 'var(--font-size-sm)' }}>
                  Release {member.name} from the club?
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm btn-danger" onClick={onReleaseStaff}>Confirm Release</button>
                  <button className="btn btn-sm btn-ghost" onClick={onReleaseClear}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--color-danger)', width: '100%' }}
                onClick={() => onReleaseConfirm(member?.role)}>
                Release from Club
              </button>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Staff card ────────────────────────────────────────────────

function StaffCard({ member, meta, onViewDetails }) {
  if (!member) {
    return (
      <div
        className="card"
        style={{
          opacity: 0.5,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 200,
          gap: 'var(--space-2)',
        }}
      >
        <span style={{ fontSize: '2rem' }}>{meta?.icon ?? '👤'}</span>
        <p style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{meta?.displayName ?? 'Staff'}</p>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Position vacant</p>
      </div>
    );
  }

  const abilities = member.abilities ?? {};
  const primaryKey = meta?.primaryAbilityKey;
  const primaryLabel = meta?.primaryAbilityLabel ?? 'Primary Ability';
  const primaryVal = primaryKey ? (abilities[primaryKey] ?? 0) : 0;
  const pct = Math.min(100, Math.max(0, primaryVal));
  const ratingColor =
    pct >= 75
      ? 'var(--color-success)'
      : pct >= 50
      ? 'var(--color-warning)'
      : 'var(--color-danger)';

  const initials = member.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2) || '??';

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div className="avatar avatar-md" style={{ fontWeight: 800 }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: 'var(--font-size-sm)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {member.name}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {meta?.displayName ?? member.role}
          </div>
        </div>
        <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{meta?.icon ?? '👤'}</span>
      </div>

      {/* Characterization badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
        {(member.characterizations ?? []).slice(0, 3).map((c, i) => (
          <span key={c} className={`badge ${charBadgeClass(i)}`} style={{ fontSize: '0.65rem' }}>
            {c}
          </span>
        ))}
      </div>

      {/* Primary ability */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: 4,
          }}
        >
          <span>{primaryLabel}</span>
          <span style={{ color: ratingColor, fontWeight: 800 }}>{pct}</span>
        </div>
        <div className="progress-bar-track">
          <div
            className={`progress-bar-fill ${pct >= 75 ? 'success' : pct >= 50 ? 'warning' : 'danger'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Motivation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
          Motivation
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              size={10}
              fill={star <= Math.round((member.motivation ?? 50) / 20) ? 'var(--color-warning)' : 'none'}
              stroke="var(--color-warning)"
            />
          ))}
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginLeft: 4 }}>
            {member.motivation ?? '–'}
          </span>
        </div>
      </div>

      {/* Bio snippet */}
      {member.biography && (
        <p
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--text-muted)',
            fontStyle: 'italic',
            lineHeight: 1.5,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {member.biography}
        </p>
      )}

      {/* View details button */}
      <button
        className="btn btn-secondary btn-sm"
        style={{ marginTop: 'auto' }}
        onClick={() => onViewDetails(member)}
      >
        View Details
      </button>
    </div>
  );
}

// ── Chemistry overview helpers ────────────────────────────────

function analyzeChemistry(staffObj) {
  const allChars = [];
  for (const role of STAFF_ROLE_ORDER) {
    const member = staffObj[role];
    if (member?.characterizations) {
      allChars.push(...member.characterizations);
    }
  }

  const charCount = {};
  for (const c of allChars) {
    charCount[c] = (charCount[c] ?? 0) + 1;
  }

  const overrepresented = Object.entries(charCount)
    .filter(([, count]) => count >= 3)
    .map(([char]) => char);

  const hasConflict =
    charCount['Old School'] > 0 && charCount['Data-Driven'] > 0;

  const hasDiverseProblem = overrepresented.length > 0;

  return { overrepresented, hasConflict, hasDiverseProblem, charCount };
}

function buildImpactSummary(staffObj) {
  const lines = [];
  const hc = staffObj['Head Coach'];
  const sc = staffObj['Strength & Conditioning Coach'];
  const physio = staffObj['Physio'];
  const scout = staffObj['Scout'];
  const analyst = staffObj['Data Analyst'];

  if (hc) {
    const tac = hc.abilities?.tacticalKnowledge ?? 0;
    lines.push(
      tac >= 70
        ? `Head Coach ${hc.name} brings elite tactical knowledge — expect well-executed game plans.`
        : `Head Coach ${hc.name}'s tactical ability is developing — focus training to compensate.`
    );
  }
  if (sc) {
    const str = sc.abilities?.strengthTraining ?? 0;
    lines.push(
      str >= 65
        ? `The S&C program is strong — players will peak physically over the season.`
        : `Conditioning programs need improvement — watch for fitness issues late in games.`
    );
  }
  if (physio) {
    const inj = physio.abilities?.injuryPrevention ?? 0;
    lines.push(
      inj >= 65
        ? `Athletic training staff provides solid injury coverage — lower risk of long-term absences.`
        : `Injury prevention is below average — consider conservative player management.`
    );
  }
  if (scout) {
    const eval_ = scout.abilities?.playerEvaluation ?? 0;
    lines.push(
      eval_ >= 65
        ? `Scout has a sharp eye for talent — player acquisition quality is high.`
        : `Scouting coverage is limited — you may miss emerging talents in lower leagues.`
    );
  }
  if (analyst) {
    const stat = analyst.abilities?.statisticalAnalysis ?? 0;
    lines.push(
      stat >= 65
        ? `Data Analyst provides strong analytical insights — opponents will be well-scouted.`
        : `Analytics coverage is thin — opponent preparation may be less thorough.`
    );
  }

  return lines;
}

// ── Main Staff page ───────────────────────────────────────────

export default function Staff() {
  const { state, dispatch, addNotification } = useGame();
  const { userTeam } = state;

  const [selectedMember, setSelectedMember] = useState(null);
  const [releaseConfirm, setReleaseConfirm] = useState(null); // role of staff member to release

  const handleReleaseStaff = () => {
    if (!selectedMember) return;
    const currentStaff = userTeam.staff ?? {};
    const updatedStaff = Object.fromEntries(
      Object.entries(currentStaff).filter(([role]) => role !== selectedMember.role)
    );
    dispatch({ type: 'UPDATE_TEAM', payload: { ...userTeam, staff: updatedStaff } });
    addNotification(`${selectedMember.name} has been released from the club.`, 'info');
    setSelectedMember(null);
    setReleaseConfirm(null);
  };

  if (!userTeam) {
    return (
      <div className="page-content animate-fade-in">
        <div className="empty-state">
          <div className="empty-state-icon">🏀</div>
          <div className="empty-state-title">No team data found</div>
          <div className="empty-state-desc">Start a new game to manage your staff.</div>
        </div>
      </div>
    );
  }

  const staffObj = userTeam.staff ?? {};
  const { overrepresented, hasConflict, hasDiverseProblem } = analyzeChemistry(staffObj);
  const impactLines = buildImpactSummary(staffObj);

  const staffMembersForModal = selectedMember
    ? Object.values(staffObj).find((m) => m?.id === selectedMember?.id) ?? selectedMember
    : null;

  const modalMeta = selectedMember
    ? ROLE_META[selectedMember.role] ?? null
    : null;

  return (
    <div className="page-content animate-fade-in">
      {/* Page header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div>
            <h1>Staff</h1>
            <p>{userTeam.name} — Coaching &amp; support team</p>
          </div>
          <span className="badge badge-orange" style={{ fontSize: 'var(--font-size-sm)', padding: '4px 12px' }}>
            <Users size={14} style={{ marginRight: 4 }} />
            {STAFF_ROLE_ORDER.filter((r) => staffObj[r]).length} / {STAFF_ROLE_ORDER.length} Filled
          </span>
        </div>
      </div>

      {/* Staff chemistry overview */}
      {(hasDiverseProblem || hasConflict) && (
        <div
          className="card mb-6"
          style={{
            borderColor: 'var(--color-warning)',
            background: 'var(--color-warning-light)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-3)',
            }}
          >
            <AlertTriangle
              size={20}
              style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 2 }}
            />
            <div>
              <p
                style={{
                  fontWeight: 700,
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-warning)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                Staff Chemistry Warning
              </p>
              {hasDiverseProblem && (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                  Overrepresented traits detected:{' '}
                  <strong>{overrepresented.join(', ')}</strong>. A lack of
                  diversity in staff characterizations can create group-think and
                  reduce adaptability.
                </p>
              )}
              {hasConflict && (
                <p
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--text-secondary)',
                    marginTop: 'var(--space-1)',
                  }}
                >
                  Ideological conflict: <strong>Old School</strong> and{' '}
                  <strong>Data-Driven</strong> staff members may clash over
                  methodology.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Staff impact summary */}
      <div className="card mb-6">
        <div className="card-header">
          <span
            className="card-title"
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
          >
            <TrendingUp size={16} style={{ color: 'var(--color-primary)' }} />
            Staff Impact Summary
          </span>
        </div>
        {impactLines.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Add staff members to see their impact on the team.
          </p>
        ) : (
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', paddingLeft: 'var(--space-4)' }}>
            {impactLines.map((line, i) => (
              <li
                key={i}
                style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                }}
              >
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Staff grid */}
      <div className="grid-3" style={{ marginBottom: 'var(--space-6)' }}>
        {STAFF_ROLE_ORDER.map((role) => {
          const meta = ROLE_META[role];
          const member = staffObj[role] ?? null;
          return (
            <StaffCard
              key={role}
              member={member}
              meta={meta}
              onViewDetails={(m) => setSelectedMember(m)}
            />
          );
        })}
      </div>

      {/* Detail modal */}
      {selectedMember && (
        <StaffModal
          member={staffMembersForModal}
          meta={modalMeta}
          onClose={() => { setSelectedMember(null); setReleaseConfirm(null); }}
          releaseConfirm={releaseConfirm}
          onReleaseConfirm={(role) => setReleaseConfirm(role)}
          onReleaseClear={() => setReleaseConfirm(null)}
          onReleaseStaff={handleReleaseStaff}
        />
      )}
    </div>
  );
}
