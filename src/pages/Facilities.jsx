import { useState, useRef, useEffect } from 'react';
import { useGame } from '../context/GameContext.jsx';
import {
  Building2,
  TrendingUp,
  Clock,
  DollarSign,
  CheckCircle,
  Lock,
  Zap,
  AlertCircle,
  Radio,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────

const FACILITY_DEFS = [
  {
    key: 'trainingCourt',
    name: 'Training Court',
    icon: '🏀',
    primary: 'Training efficiency & skill improvement',
    secondary: 'Faster player development and session quality',
  },
  {
    key: 'gym',
    name: 'GYM',
    icon: '💪',
    primary: 'Player fitness & stamina improvement',
    secondary: 'Higher endurance cap and fatigue recovery rate',
  },
  {
    key: 'youthAcademy',
    name: 'Youth Academy',
    icon: '🌱',
    primary: 'New player quality & potential',
    secondary: 'Better prospects from youth drafts each month',
  },
  {
    key: 'media',
    name: 'Media Center',
    icon: '📺',
    primary: 'Team exposure & fan growth acceleration',
    secondary: 'Each level adds +10% fan growth/week & boosts press coverage',
  },
  {
    key: 'merchandise',
    name: 'Merchandise Store',
    icon: '🛍️',
    primary: 'Daily income generation',
    secondary: 'Passive revenue from merchandise sales',
  },
  {
    key: 'basketballHall',
    name: 'Basketball Hall',
    icon: '🏟️',
    primary: 'Supporter capacity (start: 600) & home advantage',
    secondary: 'Larger crowds amplify home court edge',
  },
  {
    key: 'medicalCenter',
    name: 'Medical Center',
    icon: '🏥',
    primary: 'Injury risk reduction & faster recovery',
    secondary: 'Each level cuts injury risk by 8% and speeds up healing',
    maxLevel: 5,
    baseCost: 80,
    baseTime: 8,
  },
  {
    key: 'scoutingOffice',
    name: 'Scouting Office',
    icon: '🔭',
    primary: 'Transfer insight & youth scouting perks',
    secondary: 'Reveals hidden attributes, unlocks regions, free scout reports',
    maxLevel: 5,
    baseCost: 60,
    baseTime: 7,
  },
];

const BASE_COST = 100;
const BASE_TIME = 10; // hours

// ── Facility data helpers ───────────────────────────────────────

// Get current level (accounting for completed upgrades)
function getFacilityLevel(facilityData) {
  if (typeof facilityData === 'number') return facilityData;
  if (!facilityData) return 0;
  return facilityData.level ?? 0;
}

// Get upgrade progress (null if not upgrading)
function getUpgradeProgress(facilityData) {
  if (typeof facilityData !== 'object' || !facilityData?.upgradeStarted) return null;
  const elapsed = Date.now() - facilityData.upgradeStarted;
  const totalMs = facilityData.upgradeHours * 3600 * 1000;
  const done = elapsed >= totalMs;
  return { elapsed, totalMs, done, hoursLeft: Math.max(0, (totalMs - elapsed) / 3600000) };
}

// Format hours remaining as "Xh Ym"
function formatTimeRemaining(hoursLeft) {
  const totalMinutes = Math.ceil(hoursLeft * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m remaining`;
  if (h > 0) return `${h}h remaining`;
  return `${m}m remaining`;
}

// ── Per-facility upgrade benefit descriptions ───────────────────

function getUpgradeBenefits(key, nextLevel) {
  const lv = nextLevel;
  const map = {
    trainingCourt: [
      { icon: '📈', text: `Training efficiency +${lv * 10}%` },
      { icon: '⭐', text: `Skill gain rate ×${(1 + lv * 0.12).toFixed(2)}` },
      { icon: '🎯', text: `Unlocks harder drills at Lv ${lv >= 5 ? '5+' : lv}` },
      { icon: '🕐', text: `Session recovery time −${lv}h` },
    ],
    gym: [
      { icon: '💪', text: `Stamina cap +${lv * 4} pts` },
      { icon: '⚡', text: `Fatigue recovery ×${(1 + lv * 0.1).toFixed(1)}` },
      { icon: '🏃', text: `Speed & athleticism boost` },
      { icon: '🩺', text: `Injury risk −${lv * 2}%` },
    ],
    youthAcademy: [
      { icon: '🌟', text: `Youth prospect quality +${lv * 8} OVR avg` },
      { icon: '🎓', text: `Potential ceiling ×${(1 + lv * 0.08).toFixed(2)}` },
      { icon: '📅', text: `New prospect every ${Math.max(1, 4 - Math.floor(lv / 3))} months` },
      { icon: '🔍', text: `Scouting radius ×${lv}` },
    ],
    media: [
      { icon: '📡', text: `Team exposure +${lv * 10}% fan growth/week` },
      { icon: '👥', text: `Fan growth multiplier ×${(1 + lv * 0.1).toFixed(1)}` },
      { icon: '📰', text: `Press coverage score ${lv * 10}/100` },
      { icon: '💬', text: `Social engagement +${lv * 15}%` },
    ],
    merchandise: [
      { icon: '💵', text: `Merch income $${50 + lv * 30}/week` },
      { icon: '🛒', text: `Item variety tier ${Math.min(lv, 5)}` },
      { icon: '📊', text: `Revenue share +${lv * 5}%` },
      { icon: '🎽', text: `Exclusive drops at Lv ${lv >= 7 ? lv : '7+'}` },
    ],
    basketballHall: [
      { icon: '🏟️', text: `Capacity +${lv * 200} seats (total ${600 + lv * 200})` },
      { icon: '🏠', text: `Home advantage +${lv * 3}%` },
      { icon: '🎤', text: `Crowd intimidation ×${(1 + lv * 0.05).toFixed(2)}` },
      { icon: '💰', text: `Gate revenue +${lv * 10}%` },
    ],
    medicalCenter: [
      { icon: '🩺', text: `Injury risk −${lv * 8}%` },
      { icon: '💊', text: `Recovery speed +${lv} day/week` },
      lv >= 3 ? { icon: '🧬', text: 'Rehab programs unlock at L3' } : { icon: '🔒', text: 'Advanced rehab at L3' },
      lv >= 5 ? { icon: '🌟', text: 'Full injury prevention suite at L5' } : { icon: '🔒', text: 'Prevention suite at L5' },
    ],
    scoutingOffice: [
      { icon: '🔍', text: 'Exact attribute values in transfer market' },
      lv >= 3 ? { icon: '🌍', text: 'Extra scout region unlocked at L3' } : { icon: '🔒', text: 'Extra region at L3' },
      lv >= 5 ? { icon: '🎓', text: 'Free Youth Academy scout report at L5' } : { icon: '🔒', text: 'Free scout at L5' },
      { icon: '📊', text: `Scouting accuracy +${lv * 12}%` },
    ],
  };
  return map[key] ?? [];
}

// ── Upgrade Benefit Tooltip ─────────────────────────────────────

function UpgradeTooltip({ facilityKey, nextLevel, visible, anchorRef }) {
  const benefits = getUpgradeBenefits(facilityKey, nextLevel);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (visible && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({
        top: rect.top + window.scrollY - 8,
        left: rect.left + rect.width / 2,
      });
    }
  }, [visible, anchorRef]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: pos.top,
        left: pos.left,
        transform: 'translate(-50%, -100%)',
        zIndex: 999,
        background: 'var(--bg-card)',
        border: '1.5px solid var(--color-primary)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-3) var(--space-4)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        minWidth: 220,
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Level {nextLevel} Benefits
      </div>
      {benefits.map((b, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
          <span style={{ fontSize: '0.85rem', lineHeight: 1 }}>{b.icon}</span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', fontWeight: 500 }}>{b.text}</span>
        </div>
      ))}
      {/* Arrow */}
      <div style={{
        position: 'absolute',
        bottom: -7,
        left: '50%',
        width: 12,
        height: 12,
        background: 'var(--bg-card)',
        border: '1.5px solid var(--color-primary)',
        borderTop: 'none',
        borderLeft: 'none',
        transform: 'translateX(-50%) rotate(45deg)',
      }} />
    </div>
  );
}

function getUpgradeCost(level, facilityKey) {
  const def = FACILITY_DEFS.find(d => d.key === facilityKey);
  const base = def?.baseCost ?? BASE_COST;
  return Math.round(base * Math.pow(1.5, level));
}

function getUpgradeTime(level) {
  return Math.round(BASE_TIME * Math.pow(1.15, level) * 10) / 10;
}

function formatCost(cost) {
  if (cost >= 1000) return `$${(cost / 1000).toFixed(1)}k`;
  return `$${cost}`;
}

// ── Sub-components ─────────────────────────────────────────────

function LevelDots({ level, max = 10 }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 'var(--space-2)' }}>
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: i < level ? 'var(--color-primary)' : 'var(--bg-muted)',
            border: `2px solid ${i < level ? 'var(--color-primary)' : 'var(--border-color)'}`,
            transition: 'all 0.2s ease',
          }}
        />
      ))}
    </div>
  );
}

function FacilityCard({ def, facilityData, budget, onUpgrade }) {
  const level = getFacilityLevel(facilityData);
  const upgradeProgress = getUpgradeProgress(facilityData);
  const isUpgrading = upgradeProgress && !upgradeProgress.done;
  const facilityMaxLevel = def?.maxLevel ?? 10;
  const isMaxed = level >= facilityMaxLevel;
  const cost = getUpgradeCost(level, def.key);
  const hours = getUpgradeTime(level);
  const canAfford = budget >= cost;
  const [showTooltip, setShowTooltip] = useState(false);
  const btnRef = useRef(null);

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        border: isUpgrading
          ? '2px solid var(--color-warning)'
          : isMaxed
          ? '2px solid var(--color-success)'
          : '1px solid var(--border-card)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top accent bar */}
      {(isUpgrading || isMaxed) && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: isMaxed
              ? 'var(--color-success)'
              : 'linear-gradient(90deg, var(--color-warning), var(--color-primary))',
          }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <span style={{ fontSize: '2rem', lineHeight: 1 }}>{def.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 'var(--font-size-base)', color: 'var(--text-primary)' }}>
            {def.name}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
            {isMaxed ? (
              <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>MAX LEVEL</span>
            ) : isUpgrading ? (
              <span style={{ color: 'var(--color-warning)', fontWeight: 700 }}>Upgrading to Level {level + 1}…</span>
            ) : (
              `Level ${level} → ${level + 1}`
            )}
          </div>
        </div>
        <div
          style={{
            background: isMaxed
              ? 'var(--color-success-light)'
              : level === 0
              ? 'var(--bg-muted)'
              : 'var(--color-primary-100)',
            color: isMaxed ? 'var(--color-success)' : level === 0 ? 'var(--text-muted)' : 'var(--color-primary)',
            fontWeight: 800,
            fontSize: 'var(--font-size-lg)',
            width: 44,
            height: 44,
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {level}
        </div>
      </div>

      {/* Level dots */}
      <LevelDots level={level} />

      {/* Impact */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
          <TrendingUp size={13} style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {def.primary}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
          <Zap size={13} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {def.secondary}
          </span>
        </div>
      </div>

      {/* Upgrade section */}
      {!isMaxed && (
        <div
          style={{
            marginTop: 'auto',
            paddingTop: 'var(--space-3)',
            borderTop: '1px solid var(--border-color)',
          }}
        >
          {isUpgrading ? (
            <div>
              <div style={{ background: 'var(--bg-muted)', borderRadius: 'var(--radius-full)', height: 6, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ height: '100%', background: 'var(--color-primary)', width: `${Math.min(100, upgradeProgress.elapsed / upgradeProgress.totalMs * 100)}%`, transition: 'width 1s' }} />
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                ⏳ {formatTimeRemaining(upgradeProgress.hoursLeft)}
              </p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                  <DollarSign size={13} style={{ color: 'var(--color-primary)' }} />
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>{formatCost(cost)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                  <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{hours}h</span>
                </div>
              </div>
              <div style={{ position: 'relative' }}>
                <button
                  ref={btnRef}
                  className={`btn btn-sm ${canAfford ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ width: '100%' }}
                  disabled={!canAfford}
                  onClick={() => onUpgrade(def.key, cost)}
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  title={!canAfford ? `Need ${formatCost(cost)} to upgrade` : `Upgrade to level ${level + 1}`}
                >
                  {canAfford ? (
                    <>
                      <TrendingUp size={13} />
                      Upgrade
                    </>
                  ) : (
                    <>
                      <Lock size={13} />
                      Insufficient funds
                    </>
                  )}
                </button>
                <UpgradeTooltip
                  facilityKey={def.key}
                  nextLevel={level + 1}
                  visible={showTooltip}
                  anchorRef={btnRef}
                />
              </div>
            </>
          )}
        </div>
      )}

      {isMaxed && (
        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-3)',
            background: 'var(--color-success-light)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <CheckCircle size={14} style={{ color: 'var(--color-success)' }} />
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-success)' }}>
            Fully Upgraded
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────

export default function Facilities() {
  const { state, dispatch, addNotification } = useGame();
  const { userTeam } = state;

  if (!userTeam) {
    return (
      <div className="page-content animate-fade-in">
        <div className="empty-state">
          <div className="empty-state-icon">🏟️</div>
          <div className="empty-state-title">No team data found</div>
          <div className="empty-state-desc">Start a new game to manage your facilities.</div>
        </div>
      </div>
    );
  }

  const budget = userTeam.budget ?? 200;
  const facilities = userTeam.facilities ?? {
    trainingCourt: 0,
    gym: 0,
    youthAcademy: 0,
    media: 0,
    merchandise: 0,
    basketballHall: 0,
  };

  // ── Check for completed upgrades on mount ──────────────────
  useEffect(() => {
    const currentFacilities = userTeam?.facilities || {};
    let changed = false;
    const updated = { ...currentFacilities };
    Object.keys(currentFacilities).forEach(key => {
      const prog = getUpgradeProgress(currentFacilities[key]);
      if (prog?.done) {
        updated[key] = (currentFacilities[key].level ?? 0) + 1;
        changed = true;
      }
    });
    if (changed) {
      dispatch({ type: 'UPDATE_TEAM', payload: { ...userTeam, facilities: updated } });
      addNotification('A facility upgrade has been completed!', 'success');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Poll every 30s for completed upgrades ─────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const currentFacilities = userTeam?.facilities || {};
      let changed = false;
      const updated = { ...currentFacilities };
      Object.keys(currentFacilities).forEach(key => {
        const prog = getUpgradeProgress(currentFacilities[key]);
        if (prog?.done) {
          updated[key] = (currentFacilities[key].level ?? 0) + 1;
          changed = true;
        }
      });
      if (changed) {
        dispatch({ type: 'UPDATE_TEAM', payload: { ...userTeam, facilities: updated } });
        addNotification('A facility upgrade has been completed!', 'success');
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [userTeam, dispatch, addNotification]);

  function handleUpgrade(key, cost) {
    if (budget < 0) {
      addNotification('Cannot upgrade while in deficit. Clear your debt first.', 'error');
      return;
    }
    if (budget < cost) {
      addNotification('Insufficient budget for this upgrade.', 'error');
      return;
    }

    const currentLevel = getFacilityLevel(facilities[key]);
    const def = FACILITY_DEFS.find(d => d.key === key);
    const facilityMaxLevel = def?.maxLevel ?? 10;
    if (currentLevel >= facilityMaxLevel) {
      addNotification('This facility is already at max level.', 'info');
      return;
    }

    const facilityBaseTime = def?.baseTime ?? BASE_TIME;
    const upgradeHours = Math.round(facilityBaseTime * Math.pow(1.15, currentLevel));
    const newFacilities = {
      ...facilities,
      [key]: { level: currentLevel, upgradeStarted: Date.now(), upgradeHours },
    };

    const newBudget = budget - cost;
    const financeLog = [
      {
        timestamp: Date.now(),
        type: 'facility_upgrade',
        description: `Facility Upgrade – ${def?.name ?? key} to Lv ${currentLevel + 1}`,
        amount: -cost,
        balanceAfter: newBudget,
      },
      ...(userTeam.financeLog ?? []),
    ].slice(0, 50);

    const updatedTeam = {
      ...userTeam,
      budget: newBudget,
      facilities: newFacilities,
      financeLog,
      // Media Center upgrades increase teamExposure, which accelerates weekly fan growth
      ...(key === 'media' ? { teamExposure: currentLevel + 1 } : {}),
    };

    dispatch({ type: 'UPDATE_TEAM', payload: updatedTeam });

    addNotification(`Upgrading ${def?.name ?? key}… ${formatCost(cost)} deducted. Will complete in ${upgradeHours}h.`, 'info');
  }

  // Income estimates — use getFacilityLevel for safety
  const fanCount = userTeam.fanCount ?? 250;
  const ticketPrice = userTeam.ticketPrice ?? 20;
  const merchandiseLevel = getFacilityLevel(facilities.merchandise);
  const gateRevenue = Math.round(fanCount * ticketPrice * 0.3);
  const merchRevenue = Math.round(50 * (1 + merchandiseLevel * 0.3));

  const totalFacilityLevel = FACILITY_DEFS.reduce((sum, d) => sum + getFacilityLevel(facilities[d.key]), 0);

  return (
    <div className="page-content animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div>
            <h1>Facilities</h1>
            <p>Upgrade your club infrastructure to unlock new capabilities</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-4)', background: 'var(--color-primary-100)', borderRadius: 'var(--radius-full)' }}>
            <Building2 size={15} style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)' }}>
              {totalFacilityLevel} / 60 total levels
            </span>
          </div>
        </div>
      </div>

      {/* Deficit lock warning */}
      {budget < 0 && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: 'var(--space-5)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Lock size={18} color="#ef4444" />
          <div>
            <span style={{ fontWeight: 700, color: '#ef4444', fontSize: 'var(--font-size-sm)' }}>
              Upgrades locked — team is in deficit (${Math.abs(budget).toLocaleString()}k debt)
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginLeft: 8 }}>
              Clear your debt to resume facility upgrades.
            </span>
          </div>
        </div>
      )}

      {/* Facility Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 'var(--space-5)',
          marginBottom: 'var(--space-8)',
        }}
      >
        {FACILITY_DEFS.map(def => (
          <FacilityCard
            key={def.key}
            def={def}
            facilityData={facilities[def.key] ?? 0}
            budget={budget}
            onUpgrade={handleUpgrade}
          />
        ))}
      </div>

      {/* Financial Management Section */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, marginBottom: 'var(--space-5)' }}>
          Financial Management
        </h2>
      </div>

      <div className="grid-3 mb-6">
        {/* Budget card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <DollarSign size={16} style={{ color: 'var(--color-primary)' }} />
              Current Budget
            </span>
          </div>
          <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 900, color: budget > 500 ? 'var(--color-success)' : budget > 100 ? 'var(--color-warning)' : 'var(--color-danger)', marginBottom: 'var(--space-2)' }}>
            {formatCost(budget)}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Available for upgrades
          </div>
          <div
            style={{
              marginTop: 'var(--space-3)',
              padding: 'var(--space-2) var(--space-3)',
              background: 'var(--color-info-light)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-2)',
            }}
          >
            <AlertCircle size={13} style={{ color: 'var(--color-info)', flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-info)' }}>
              Starting funds: $200. Earn more through match revenue.
            </span>
          </div>
        </div>

        {/* Gate Revenue */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ fontSize: '1rem' }}>🏟️</span>
              Gate Revenue
            </span>
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-primary)', marginBottom: 'var(--space-2)' }}>
            {formatCost(gateRevenue)}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
            Per match (30% of gate)
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
            {fanCount.toLocaleString()} fans × ${ticketPrice} ticket × 0.3
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
            Upgrade Basketball Hall to grow supporter capacity
          </div>
        </div>

        {/* Merchandise Revenue */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ fontSize: '1rem' }}>🛍️</span>
              Merchandise Sales
            </span>
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-primary)', marginBottom: 'var(--space-2)' }}>
            {formatCost(merchRevenue)}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
            Per day (passive income)
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
            Base $50 + 30% per Merchandise Store level
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
            Store Level: {merchandiseLevel} / 10
          </div>
        </div>
      </div>

      {/* Upgrade Tips */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, var(--color-primary-100) 0%, var(--bg-card) 100%)',
          border: '1px solid var(--color-primary-200)',
        }}
      >
        <div className="card-header">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Zap size={16} style={{ color: 'var(--color-primary)' }} />
            Upgrade Priority Guide
          </span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-3)',
          }}
        >
          {[
            { icon: '🏀', tip: 'Training Court first — accelerates player development immediately' },
            { icon: '🏟️', tip: 'Basketball Hall grows fan capacity and home crowd advantage' },
            { icon: '🛍️', tip: 'Merchandise Store generates passive income every day' },
            { icon: '🌱', tip: 'Youth Academy boosts potential of draft picks each month' },
          ].map(({ icon, tip }) => (
            <div
              key={tip}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-2)',
                padding: 'var(--space-3)',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-card)',
              }}
            >
              <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{icon}</span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
