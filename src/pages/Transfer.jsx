import { useState, useMemo } from 'react';
import { useGame } from '../context/GameContext.jsx';
import { ArrowLeftRight, Search, Filter, Clock, X, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import PlayerAvatar from '../components/ui/PlayerAvatar.jsx';
import { calcPlayerMonthlyWage, calcStaffMonthlyWage } from './FinancialReport.jsx';
import { ATTRIBUTE_NAMES, STAFF_ROLES, STAFF_CHARACTERIZATIONS } from '../data/constants.js';

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

function formatPrice(n) { return `$${Number(n).toLocaleString()}`; }
function fmtWage(n) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k/mo`;
  return `$${n}/mo`;
}

function calcOvr(player) {
  const attrs = player.attributes || {};
  const vals = Object.values(attrs);
  if (vals.length === 0) return player.overallRating || 50;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

// ── Attribute groups for filter ────────────────────────────────

const ATTR_GROUPS = [
  {
    name: 'Shooting / Offense',
    keys: ['threePtShooting', 'midRangeScoring', 'freeThrowShooting', 'finishingAtTheRim', 'postMoves', 'aggressivenessOffensive'],
  },
  {
    name: 'Defense / Rebounding',
    keys: ['perimeterDefense', 'interiorDefense', 'rebounding', 'helpDefense', 'onBallScreenNavigation', 'disciplineFouling'],
  },
  {
    name: 'Playmaking / IQ',
    keys: ['courtVision', 'ballHandlingDribbling', 'passingAccuracy', 'basketballIQ'],
  },
  {
    name: 'Physical / Mental',
    keys: ['staminaEndurance', 'conditioningFitness', 'agilityLateralSpeed', 'clutchPerformance', 'handlePressureMental', 'consistencyPerformance', 'leadershipCommunication', 'teamFirstAttitude', 'workEthicOutOfGame', 'patienceOffense', 'settingScreens', 'bodyControl', 'verticalLeapingAbility'],
  },
];

const DEFAULT_PLAYER_FILTERS = {
  minPrice: 0, maxPrice: 10000,
  minWage: 0, maxWage: 15000,
  positions: [],
  nationality: '',
  minOvr: 0, maxOvr: 100,
  attributes: {},
};

const DEFAULT_STAFF_FILTERS = {
  minPrice: 0, maxPrice: 10000,
  minWage: 0, maxWage: 15000,
  roles: [],
  minAbility: 0, maxAbility: 100,
  characterizations: [],
};

// ── Filter Modal ───────────────────────────────────────────────

function FilterModal({ onClose, playerFilters, setPlayerFilters, staffFilters, setStaffFilters }) {
  const [tab, setTab] = useState('players');
  const [pf, setPf] = useState({ ...playerFilters });
  const [sf, setSf] = useState({ ...staffFilters });
  const [expandedGroup, setExpandedGroup] = useState(null);

  function togglePos(pos) {
    setPf(f => ({
      ...f,
      positions: f.positions.includes(pos) ? f.positions.filter(p => p !== pos) : [...f.positions, pos],
    }));
  }

  function toggleRole(role) {
    setSf(f => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter(r => r !== role) : [...f.roles, role],
    }));
  }

  function toggleChar(char) {
    setSf(f => ({
      ...f,
      characterizations: f.characterizations.includes(char)
        ? f.characterizations.filter(c => c !== char)
        : [...f.characterizations, char],
    }));
  }

  function setAttrMin(key, val) {
    setPf(f => ({
      ...f,
      attributes: val === '' || val === 0 ? (() => { const a = { ...f.attributes }; delete a[key]; return a; })() : { ...f.attributes, [key]: Number(val) },
    }));
  }

  function applyAndClose() {
    setPlayerFilters(pf);
    setStaffFilters(sf);
    onClose();
  }

  function resetAll() {
    setPf({ ...DEFAULT_PLAYER_FILTERS });
    setSf({ ...DEFAULT_STAFF_FILTERS });
  }

  const activePlayerCount = [
    pf.minPrice > 0 || pf.maxPrice < 10000,
    pf.minWage > 0 || pf.maxWage < 15000,
    pf.positions.length > 0,
    pf.nationality !== '',
    pf.minOvr > 0 || pf.maxOvr < 100,
    Object.keys(pf.attributes).length > 0,
  ].filter(Boolean).length;

  const activeStaffCount = [
    sf.minPrice > 0 || sf.maxPrice < 10000,
    sf.minWage > 0 || sf.maxWage < 15000,
    sf.roles.length > 0,
    sf.minAbility > 0 || sf.maxAbility < 100,
    sf.characterizations.length > 0,
  ].filter(Boolean).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h3 className="card-title">Advanced Filters</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="tabs" style={{ padding: '0 var(--space-4)', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
          <button className={`tab${tab === 'players' ? ' active' : ''}`} onClick={() => setTab('players')}>
            Players {activePlayerCount > 0 && <span className="badge badge-orange" style={{ marginLeft: 4, padding: '1px 5px', fontSize: '0.6rem' }}>{activePlayerCount}</span>}
          </button>
          <button className={`tab${tab === 'staff' ? ' active' : ''}`} onClick={() => setTab('staff')}>
            Staff {activeStaffCount > 0 && <span className="badge badge-orange" style={{ marginLeft: 4, padding: '1px 5px', fontSize: '0.6rem' }}>{activeStaffCount}</span>}
          </button>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {tab === 'players' && (
            <>
              {/* Market */}
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)', color: 'var(--text-primary)' }}>Market</div>
                <div className="grid-2" style={{ gap: 'var(--space-4)' }}>
                  <div>
                    <label className="form-label">Asking Price: ${pf.minPrice.toLocaleString()} – ${pf.maxPrice.toLocaleString()}</label>
                    <div className="flex gap-2">
                      <input type="range" min={0} max={10000} step={100} value={pf.minPrice} onChange={e => setPf(f => ({ ...f, minPrice: +e.target.value }))} style={{ flex: 1, accentColor: 'var(--color-primary)' }} />
                      <input type="range" min={0} max={10000} step={100} value={pf.maxPrice} onChange={e => setPf(f => ({ ...f, maxPrice: +e.target.value }))} style={{ flex: 1, accentColor: 'var(--color-primary)' }} />
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Monthly Wage: {fmtWage(pf.minWage)} – {fmtWage(pf.maxWage)}</label>
                    <div className="flex gap-2">
                      <input type="range" min={0} max={15000} step={250} value={pf.minWage} onChange={e => setPf(f => ({ ...f, minWage: +e.target.value }))} style={{ flex: 1, accentColor: 'var(--color-primary)' }} />
                      <input type="range" min={0} max={15000} step={250} value={pf.maxWage} onChange={e => setPf(f => ({ ...f, maxWage: +e.target.value }))} style={{ flex: 1, accentColor: 'var(--color-primary)' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Core */}
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)', color: 'var(--text-primary)' }}>Core</div>
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <label className="form-label">Position</label>
                  <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                    {POSITIONS.map(pos => (
                      <button key={pos}
                        onClick={() => togglePos(pos)}
                        className={`btn btn-sm ${pf.positions.includes(pos) ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ minWidth: 44 }}
                      >{pos}</button>
                    ))}
                  </div>
                </div>
                <div className="grid-2" style={{ gap: 'var(--space-4)' }}>
                  <div>
                    <label className="form-label">Nationality (search)</label>
                    <input className="form-input" placeholder="e.g. American" value={pf.nationality} onChange={e => setPf(f => ({ ...f, nationality: e.target.value }))} />
                  </div>
                  <div>
                    <label className="form-label">Overall Rating: {pf.minOvr} – {pf.maxOvr}</label>
                    <div className="flex gap-2">
                      <input type="range" min={0} max={100} value={pf.minOvr} onChange={e => setPf(f => ({ ...f, minOvr: +e.target.value }))} style={{ flex: 1, accentColor: 'var(--color-primary)' }} />
                      <input type="range" min={0} max={100} value={pf.maxOvr} onChange={e => setPf(f => ({ ...f, maxOvr: +e.target.value }))} style={{ flex: 1, accentColor: 'var(--color-primary)' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Attribute filters */}
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)', color: 'var(--text-primary)' }}>
                  Player Attributes <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(set minimum value)</span>
                </div>
                {ATTR_GROUPS.map(group => (
                  <div key={group.name} style={{ marginBottom: 'var(--space-2)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <button
                      onClick={() => setExpandedGroup(expandedGroup === group.name ? null : group.name)}
                      style={{ width: '100%', padding: 'var(--space-2) var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: 'var(--font-size-sm)', background: 'var(--bg-muted)', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}
                    >
                      <span>{group.name}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        {group.keys.filter(k => pf.attributes[k]).length > 0 && (
                          <span className="badge badge-orange" style={{ padding: '1px 6px', fontSize: '0.65rem' }}>
                            {group.keys.filter(k => pf.attributes[k]).length} active
                          </span>
                        )}
                        {expandedGroup === group.name ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </span>
                    </button>
                    {expandedGroup === group.name && (
                      <div style={{ padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        {group.keys.map(key => {
                          const label = ATTRIBUTE_NAMES[key]?.label ?? key;
                          const val = pf.attributes[key] ?? 0;
                          return (
                            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', flex: 1, minWidth: 150 }}>{label}</span>
                              <input
                                type="range" min={0} max={100} value={val}
                                onChange={e => setAttrMin(key, +e.target.value)}
                                style={{ flex: 1, accentColor: 'var(--color-primary)' }}
                              />
                              <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: val > 0 ? 'var(--color-primary)' : 'var(--text-muted)', minWidth: 24, textAlign: 'right' }}>
                                {val > 0 ? `≥${val}` : 'Any'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'staff' && (
            <>
              {/* Market */}
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)', color: 'var(--text-primary)' }}>Market</div>
                <div className="grid-2" style={{ gap: 'var(--space-4)' }}>
                  <div>
                    <label className="form-label">Asking Price: ${sf.minPrice.toLocaleString()} – ${sf.maxPrice.toLocaleString()}</label>
                    <div className="flex gap-2">
                      <input type="range" min={0} max={10000} step={100} value={sf.minPrice} onChange={e => setSf(f => ({ ...f, minPrice: +e.target.value }))} style={{ flex: 1, accentColor: 'var(--color-primary)' }} />
                      <input type="range" min={0} max={10000} step={100} value={sf.maxPrice} onChange={e => setSf(f => ({ ...f, maxPrice: +e.target.value }))} style={{ flex: 1, accentColor: 'var(--color-primary)' }} />
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Monthly Wage: {fmtWage(sf.minWage)} – {fmtWage(sf.maxWage)}</label>
                    <div className="flex gap-2">
                      <input type="range" min={0} max={15000} step={250} value={sf.minWage} onChange={e => setSf(f => ({ ...f, minWage: +e.target.value }))} style={{ flex: 1, accentColor: 'var(--color-primary)' }} />
                      <input type="range" min={0} max={15000} step={250} value={sf.maxWage} onChange={e => setSf(f => ({ ...f, maxWage: +e.target.value }))} style={{ flex: 1, accentColor: 'var(--color-primary)' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Role */}
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)', color: 'var(--text-primary)' }}>Staff Role</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  {STAFF_ROLES.map(role => (
                    <button key={role}
                      onClick={() => toggleRole(role)}
                      className={`btn btn-sm ${sf.roles.includes(role) ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ fontSize: 'var(--font-size-xs)' }}
                    >{role}</button>
                  ))}
                </div>
              </div>

              {/* Ability */}
              <div>
                <label className="form-label">Specialized Ability Score: {sf.minAbility} – {sf.maxAbility}</label>
                <div className="flex gap-2">
                  <input type="range" min={0} max={100} value={sf.minAbility} onChange={e => setSf(f => ({ ...f, minAbility: +e.target.value }))} style={{ flex: 1, accentColor: 'var(--color-primary)' }} />
                  <input type="range" min={0} max={100} value={sf.maxAbility} onChange={e => setSf(f => ({ ...f, maxAbility: +e.target.value }))} style={{ flex: 1, accentColor: 'var(--color-primary)' }} />
                </div>
              </div>

              {/* Characterizations */}
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)', color: 'var(--text-primary)' }}>Characterizations</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  {STAFF_CHARACTERIZATIONS.map(c => (
                    <button key={c}
                      onClick={() => toggleChar(c)}
                      className={`btn btn-sm ${sf.characterizations.includes(c) ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ fontSize: 'var(--font-size-xs)' }}
                    >{c}</button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={resetAll}>Reset All</button>
          <button className="btn btn-primary" onClick={applyAndClose}>Apply Filters</button>
        </div>
      </div>
    </div>
  );
}

// ── Transfer Compare Modal ─────────────────────────────────────

const TRANSFER_COMPARE_STATS = [
  { key: 'courtVision', label: 'Court Vision' },
  { key: 'threePtShooting', label: '3PT Shooting' },
  { key: 'finishingAtTheRim', label: 'Finishing' },
  { key: 'perimeterDefense', label: 'Perimeter Def' },
  { key: 'interiorDefense', label: 'Interior Def' },
  { key: 'rebounding', label: 'Rebounding' },
  { key: 'ballHandlingDribbling', label: 'Ball Handling' },
  { key: 'passingAccuracy', label: 'Passing' },
  { key: 'staminaEndurance', label: 'Stamina' },
  { key: 'agilityLateralSpeed', label: 'Agility' },
];

function TransferCompareModal({ target, mySquad, onClose }) {
  const samePos = mySquad.filter(p => p.position === target.position);
  const defaultComp = samePos.length > 0
    ? samePos.reduce((best, p) => (p.overallRating || 0) > (best.overallRating || 0) ? p : best, samePos[0])
    : mySquad[0] || null;

  const [compId, setCompId] = useState(defaultComp?.id || '');
  const compPlayer = mySquad.find(p => p.id === compId) || null;

  const targetOvr = calcOvr(target);
  const compOvr = compPlayer ? (compPlayer.overallRating || calcOvr(compPlayer)) : 0;
  const ovrDiff = targetOvr - compOvr;

  function StatRow({ stat }) {
    const v1 = target?.attributes?.[stat.key] ?? 0;
    const v2 = compPlayer?.attributes?.[stat.key] ?? 0;
    const targetBetter = v1 >= v2;
    const compBetter = v2 > v1;

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 'var(--space-2)', alignItems: 'center', marginBottom: 8 }}>
        {/* Left: target (orange) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: 'row-reverse' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: targetBetter ? 'var(--color-primary)' : 'var(--text-muted)', minWidth: 24, textAlign: 'right' }}>{v1}</span>
          <div style={{ flex: 1, height: 8, background: 'var(--bg-muted)', borderRadius: 'var(--radius-full)', overflow: 'hidden', direction: 'rtl' }}>
            <div style={{ width: `${(v1 / 100) * 100}%`, height: '100%', background: targetBetter ? 'var(--color-primary)' : 'rgba(249,115,22,0.4)', borderRadius: 'var(--radius-full)', transition: 'width 0.4s ease' }} />
          </div>
        </div>

        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap', textAlign: 'center', minWidth: 90 }}>
          {stat.label}
        </span>

        {/* Right: your player (blue) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1, height: 8, background: 'var(--bg-muted)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
            <div style={{ width: `${(v2 / 100) * 100}%`, height: '100%', background: compPlayer ? (compBetter ? '#3b82f6' : 'rgba(59,130,246,0.4)') : 'var(--bg-muted)', borderRadius: 'var(--radius-full)', transition: 'width 0.4s ease' }} />
          </div>
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: compBetter ? '#3b82f6' : 'var(--text-muted)', minWidth: 24 }}>{compPlayer ? v2 : '—'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h3 className="card-title">Compare to My Squad</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
          {/* Player headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', alignItems: 'start' }}>
            {/* Target */}
            <div style={{ textAlign: 'center', padding: 'var(--space-3)', background: 'rgba(249,115,22,0.08)', borderRadius: 'var(--radius-md)', border: '2px solid var(--color-primary)' }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2, fontWeight: 700 }}>Transfer Target</div>
              <div style={{ fontWeight: 800, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', marginBottom: 2 }}>{target.name}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>{target.position}</div>
              <div style={{ fontWeight: 900, fontSize: 'var(--font-size-xl)', color: 'var(--color-primary)', lineHeight: 1 }}>{targetOvr}</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>OVR</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 'var(--font-size-lg)', color: 'var(--text-muted)' }}>VS</div>

            {/* Your player */}
            <div style={{ textAlign: 'center', padding: 'var(--space-3)', background: compPlayer ? 'rgba(59,130,246,0.08)' : 'var(--bg-muted)', borderRadius: 'var(--radius-md)', border: `2px solid ${compPlayer ? '#3b82f6' : 'var(--border-color)'}` }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2, fontWeight: 700 }}>Your Player</div>
              {compPlayer ? (
                <>
                  <div style={{ fontWeight: 800, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', marginBottom: 2 }}>{compPlayer.name}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>{compPlayer.position}</div>
                  <div style={{ fontWeight: 900, fontSize: 'var(--font-size-xl)', color: '#3b82f6', lineHeight: 1 }}>{compOvr}</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>OVR</div>
                </>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', fontWeight: 600, padding: 'var(--space-2) 0' }}>Select a player</div>
              )}
            </div>
          </div>

          {/* Dropdown */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 'var(--space-1)' }}>
              Compare against
            </label>
            <select
              className="form-select"
              value={compId}
              onChange={e => setCompId(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">Choose a player...</option>
              {mySquad.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.position}) — OVR {p.overallRating}</option>
              ))}
            </select>
          </div>

          {/* Improvement summary */}
          {compPlayer && (
            <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: ovrDiff > 0 ? 'rgba(34,197,94,0.08)' : ovrDiff < 0 ? 'rgba(239,68,68,0.08)' : 'var(--bg-muted)', border: `1px solid ${ovrDiff > 0 ? 'rgba(34,197,94,0.3)' : ovrDiff < 0 ? 'rgba(239,68,68,0.3)' : 'var(--border-color)'}`, textAlign: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: ovrDiff > 0 ? 'var(--color-success)' : ovrDiff < 0 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                {ovrDiff > 0
                  ? `${target.name} is ${ovrDiff} OVR point${ovrDiff !== 1 ? 's' : ''} better than your current ${compPlayer.position}`
                  : ovrDiff < 0
                  ? `${target.name} is ${Math.abs(ovrDiff)} OVR point${Math.abs(ovrDiff) !== 1 ? 's' : ''} worse than your current ${compPlayer.position}`
                  : `${target.name} matches your current ${compPlayer.position} rating`}
              </span>
            </div>
          )}

          {/* Legend */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--color-primary)' }} />
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-secondary)' }}>{target.name} (Target)</span>
            </div>
            {compPlayer && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-secondary)' }}>{compPlayer.name} (Yours)</span>
                <div style={{ width: 12, height: 12, borderRadius: 2, background: '#3b82f6' }} />
              </div>
            )}
          </div>

          {/* Stat bars */}
          {TRANSFER_COMPARE_STATS.map(stat => (
            <StatRow key={stat.key} stat={stat} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Player Card ────────────────────────────────────────────────

function PlayerCard({ player, team, onBuy, onView, timeLeft, userTeamId, onRemove, onCompare, isOwn: isOwnProp }) {
  const isOwn = isOwnProp !== undefined ? isOwnProp : team?.id === userTeamId;
  const ovr = calcOvr(player);
  const wage = calcPlayerMonthlyWage(player);
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div className="flex items-center gap-3 mb-3">
        <PlayerAvatar player={player} size="md" />
        <div className="flex-1">
          <div className="font-semibold">{player.name}</div>
          <div className="flex items-center gap-2">
            <span className="player-position-badge">{player.position}</span>
            <span className="text-xs text-muted">{player.nationality}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold" style={{ color: 'var(--color-primary)' }}>{formatPrice(player.transferPrice || player.salary || 50)}</div>
          {timeLeft && <div className="text-xs text-muted flex items-center gap-1 justify-end"><Clock size={10} />{timeLeft}</div>}
        </div>
      </div>
      <div className="flex gap-2 text-xs" style={{ marginBottom: 8 }}>
        <span className="badge badge-orange">OVR {ovr}</span>
        <span className="badge badge-gray">{player.age}y</span>
        <span className="badge badge-blue">{player.height?.ft || '6\'5"'}</span>
      </div>
      {/* Monthly wage */}
      <div style={{
        padding: '4px 8px', background: 'var(--color-danger-light)', borderRadius: 'var(--radius-sm)',
        fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)', fontWeight: 700, marginBottom: 8,
        display: 'inline-block',
      }}>
        {fmtWage(wage)}
      </div>
      {team && !isOwn && <div className="text-xs text-muted mb-2">🏀 {team.name}</div>}
      <div className="flex gap-2">
        <button className="btn btn-ghost btn-sm flex-1" onClick={() => onView(player)}>
          <Eye size={12} /> View
        </button>
        {isOwn ? (
          <button className="btn btn-danger btn-sm flex-1" onClick={() => onRemove(player)}>
            <X size={12} /> Remove
          </button>
        ) : (
          <button className="btn btn-primary btn-sm flex-1" onClick={() => onBuy(player, team)}>Buy</button>
        )}
      </div>
      {!isOwn && onCompare && (
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 6, fontSize: 11, color: 'var(--color-primary)', opacity: 0.85, width: '100%' }}
          onClick={() => onCompare(player)}
        >
          Compare to My Squad
        </button>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────

export default function Transfer() {
  const { state, dispatch, addNotification } = useGame();
  const [activeTab, setActiveTab] = useState('market');
  const [search, setSearch] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [listPlayer, setListPlayer] = useState(null);
  const [listPrice, setListPrice] = useState('');
  const [viewPlayer, setViewPlayer] = useState(null);
  const [playerFilters, setPlayerFilters] = useState({ ...DEFAULT_PLAYER_FILTERS });
  const [staffFilters, setStaffFilters] = useState({ ...DEFAULT_STAFF_FILTERS });
  const [compareTarget, setCompareTarget] = useState(null);

  const team = state.userTeam;
  const allTeams = state.allTeams || [];

  const marketPlayers = useMemo(() => {
    const result = [];
    allTeams.forEach(t => {
      if (t.id === team?.id) return;
      (t.players || []).forEach(p => {
        if (p.isOnTransferMarket) result.push({ player: p, team: t });
      });
    });
    return result;
  }, [allTeams, team]);

  const myListings = useMemo(() =>
    (team?.players || []).filter(p => p.isOnTransferMarket),
    [team]
  );

  // Count active filters
  const activeFilterCount = [
    playerFilters.minPrice > 0 || playerFilters.maxPrice < 10000,
    playerFilters.minWage > 0 || playerFilters.maxWage < 15000,
    playerFilters.positions.length > 0,
    playerFilters.nationality !== '',
    playerFilters.minOvr > 0 || playerFilters.maxOvr < 100,
    Object.keys(playerFilters.attributes).length > 0,
    staffFilters.roles.length > 0,
    staffFilters.characterizations.length > 0,
    staffFilters.minAbility > 0 || staffFilters.maxAbility < 100,
  ].filter(Boolean).length;

  const filtered = useMemo(() => {
    const pf = playerFilters;
    return marketPlayers.filter(({ player }) => {
      const price = player.transferPrice || 50;
      const ovr = calcOvr(player);
      const wage = calcPlayerMonthlyWage(player);
      if (search && !player.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (price < pf.minPrice || price > pf.maxPrice) return false;
      if (wage < pf.minWage || wage > pf.maxWage) return false;
      if (pf.positions.length > 0 && !pf.positions.includes(player.position)) return false;
      if (pf.nationality && !player.nationality?.toLowerCase().includes(pf.nationality.toLowerCase())) return false;
      if (ovr < pf.minOvr || ovr > pf.maxOvr) return false;
      for (const [key, minVal] of Object.entries(pf.attributes)) {
        if ((player.attributes?.[key] ?? 0) < minVal) return false;
      }
      return true;
    });
  }, [marketPlayers, search, playerFilters]);

  const handleList = () => {
    if (!listPlayer || !listPrice || isNaN(listPrice)) return;
    const price = parseFloat(listPrice);
    const updatedPlayers = team.players.map(p =>
      p.id === listPlayer.id ? { ...p, isOnTransferMarket: true, transferPrice: price, listedAt: Date.now() } : p
    );
    dispatch({ type: 'UPDATE_TEAM', payload: { ...team, players: updatedPlayers } });
    addNotification(`${listPlayer.name} listed for ${formatPrice(price)}`, 'success');
    setShowListModal(false);
    setListPlayer(null);
    setListPrice('');
  };

  const handleRemoveListing = (player) => {
    const updatedPlayers = team.players.map(p =>
      p.id === player.id ? { ...p, isOnTransferMarket: false, transferPrice: null, listedAt: null } : p
    );
    dispatch({ type: 'UPDATE_TEAM', payload: { ...team, players: updatedPlayers } });
    addNotification(`${player.name} removed from market`, 'info');
  };

  const handleBuy = (player, fromTeam) => {
    const price = player.transferPrice || 50;
    if ((team?.budget || 0) < price) { addNotification('Insufficient funds!', 'error'); return; }
    const updatedSeller = { ...fromTeam, players: fromTeam.players.map(p => p.id === player.id ? null : p).filter(Boolean) };
    const boughtPlayer = { ...player, isOnTransferMarket: false, transferPrice: null };
    const updatedBuyer = { ...team, budget: (team.budget || 0) - price, players: [...team.players, boughtPlayer] };
    const updatedTeams = allTeams.map(t => {
      if (t.id === fromTeam.id) return updatedSeller;
      if (t.id === team.id) return updatedBuyer;
      return t;
    });
    dispatch({ type: 'UPDATE_ALL_TEAMS', payload: updatedTeams });
    addNotification(`${player.name} signed for ${formatPrice(price)}!`, 'success');
  };

  const getTimeLeft = (listedAt) => {
    if (!listedAt) return '72h';
    const msLeft = (listedAt + 72 * 60 * 60 * 1000) - Date.now();
    if (msLeft <= 0) return 'Expired';
    const h = Math.floor(msLeft / (60 * 60 * 1000));
    const m = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000));
    return `${h}h ${m}m`;
  };

  const availableToList = (team?.players || []).filter(p => !p.isOnTransferMarket);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>Transfer Market</h1>
        <p>Buy and sell players to strengthen your squad</p>
      </div>

      <div className="tabs mb-4">
        <button className={`tab${activeTab === 'market' ? ' active' : ''}`} onClick={() => setActiveTab('market')}>
          Market ({marketPlayers.length})
        </button>
        <button className={`tab${activeTab === 'mylistings' ? ' active' : ''}`} onClick={() => setActiveTab('mylistings')}>
          My Listings ({myListings.length})
        </button>
        <button className={`tab${activeTab === 'history' ? ' active' : ''}`} onClick={() => setActiveTab('history')}>
          History
        </button>
      </div>

      {activeTab === 'market' && (
        <div>
          {/* Search + Filter bar */}
          <div className="card mb-4" style={{ padding: '12px 16px' }}>
            <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Search player name..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <button
                className={`btn btn-sm ${activeFilterCount > 0 ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setShowFilterModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Filter size={14} />
                Filters
                {activeFilterCount > 0 && (
                  <span style={{ background: 'white', color: 'var(--color-primary)', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900 }}>
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {activeFilterCount > 0 && (
                <button className="btn btn-sm btn-ghost" onClick={() => { setPlayerFilters({ ...DEFAULT_PLAYER_FILTERS }); setStaffFilters({ ...DEFAULT_STAFF_FILTERS }); }}>
                  <X size={12} /> Clear
                </button>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><ArrowLeftRight size={40} /></div>
              <div className="empty-state-title">No players match your filters</div>
              <div className="empty-state-desc">Try adjusting filters or wait for other GMs to list players.</div>
            </div>
          ) : (
            <div className="grid-auto">
              {filtered.map(({ player, team: t }) => (
                <PlayerCard key={player.id} player={player} team={t} onBuy={handleBuy} onView={setViewPlayer} timeLeft={getTimeLeft(player.listedAt)} userTeamId={team?.id} onRemove={handleRemoveListing} onCompare={setCompareTarget} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'mylistings' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-muted">Budget: <strong style={{ color: 'var(--color-success)' }}>${team?.budget?.toFixed(2)}</strong></div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowListModal(true)}>+ List Player</button>
          </div>
          {myListings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">No active listings</div>
              <div className="empty-state-desc">List a player to generate revenue for your club</div>
            </div>
          ) : (
            <div className="grid-auto">
              {myListings.map(player => (
                <PlayerCard key={player.id} player={player} team={team} onBuy={() => {}} onView={setViewPlayer} timeLeft={getTimeLeft(player.listedAt)} userTeamId={team?.id} onRemove={handleRemoveListing} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card">
          <div className="card-title mb-4">Transfer History</div>
          {(team?.transferHistory || []).length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <div className="empty-state-icon">📜</div>
              <div className="empty-state-title">No transfers yet</div>
            </div>
          ) : (
            <table>
              <thead><tr><th>Player</th><th>From</th><th>To</th><th>Fee</th><th>Date</th></tr></thead>
              <tbody>
                {(team.transferHistory || []).map((h, i) => (
                  <tr key={i}>
                    <td>{h.playerName}</td><td>{h.from}</td><td>{h.to}</td>
                    <td style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{formatPrice(h.fee)}</td>
                    <td className="text-muted">{new Date(h.date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Transfer Compare Modal */}
      {compareTarget && (
        <TransferCompareModal
          target={compareTarget}
          mySquad={team?.players || []}
          onClose={() => setCompareTarget(null)}
        />
      )}

      {/* Filter Modal */}
      {showFilterModal && (
        <FilterModal
          onClose={() => setShowFilterModal(false)}
          playerFilters={playerFilters} setPlayerFilters={setPlayerFilters}
          staffFilters={staffFilters} setStaffFilters={setStaffFilters}
        />
      )}

      {/* List Player Modal */}
      {showListModal && (
        <div className="modal-overlay" onClick={() => setShowListModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 className="card-title">List Player for Sale</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowListModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Select Player</label>
                <select className="form-select" value={listPlayer?.id || ''} onChange={e => setListPlayer(availableToList.find(p => p.id === e.target.value))}>
                  <option value="">Choose a player...</option>
                  {availableToList.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.position}) — OVR {calcOvr(p)}</option>
                  ))}
                </select>
              </div>
              {listPlayer && (
                <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--color-danger-light)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)', fontWeight: 700 }}>
                  Monthly wage: {fmtWage(calcPlayerMonthlyWage(listPlayer))}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Asking Price ($)</label>
                <input className="form-input" type="number" min={10} max={5000} placeholder="e.g. 150" value={listPrice} onChange={e => setListPrice(e.target.value)} />
                <span className="text-xs text-muted">Listing expires after 72 hours.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowListModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleList} disabled={!listPlayer || !listPrice}>List Player</button>
            </div>
          </div>
        </div>
      )}

      {/* View Player Modal */}
      {viewPlayer && (
        <div className="modal-overlay" onClick={() => setViewPlayer(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{viewPlayer.name} — Full Profile</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setViewPlayer(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="flex items-center gap-3 mb-4">
                <PlayerAvatar player={viewPlayer} size="lg" />
                <div>
                  <div className="font-bold text-lg">{viewPlayer.name}</div>
                  <div className="text-sm text-muted">{viewPlayer.position} · {viewPlayer.nationality} · Age {viewPlayer.age}</div>
                  <div className="text-sm text-muted">{viewPlayer.height?.ft} · {viewPlayer.weight?.lbs}lbs</div>
                </div>
              </div>
              {/* Wage + asking price highlight */}
              <div className="grid-2" style={{ gap: 'var(--space-3)', marginBottom: 16 }}>
                <div style={{ padding: 'var(--space-3)', background: 'var(--color-primary-100)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>Asking Price</div>
                  <div style={{ fontWeight: 900, color: 'var(--color-primary)', fontSize: 'var(--font-size-lg)' }}>{formatPrice(viewPlayer.transferPrice || viewPlayer.salary || 50)}</div>
                </div>
                <div style={{ padding: 'var(--space-3)', background: 'var(--color-danger-light)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>Monthly Wage</div>
                  <div style={{ fontWeight: 900, color: 'var(--color-danger)', fontSize: 'var(--font-size-lg)' }}>{fmtWage(calcPlayerMonthlyWage(viewPlayer))}</div>
                </div>
              </div>
              <div className="grid-3" style={{ gap: 8, marginBottom: 16 }}>
                {Object.entries(viewPlayer.attributes || {}).slice(0, 9).map(([k, v]) => (
                  <div key={k} className="stat-card" style={{ padding: 8, textAlign: 'center' }}>
                    <div className="stat-value" style={{ fontSize: 'var(--font-size-lg)' }}>{v}</div>
                    <div className="stat-label" style={{ fontSize: '0.6rem' }}>{ATTRIBUTE_NAMES[k]?.label ?? k}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
