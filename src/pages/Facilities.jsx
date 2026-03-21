import { useState } from 'react';
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
    primary: 'Team motivation & fan engagement',
    secondary: 'Boosts fan enthusiasm and press coverage',
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
];

const BASE_COST = 100;
const BASE_TIME = 10; // hours

function getUpgradeCost(level) {
  return Math.round(BASE_COST * Math.pow(1.5, level));
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

function FacilityCard({ def, level, budget, upgrading, onUpgrade }) {
  const isMaxed = level >= 10;
  const cost = getUpgradeCost(level);
  const hours = getUpgradeTime(level);
  const canAfford = budget >= cost;

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        border: upgrading
          ? '2px solid var(--color-warning)'
          : isMaxed
          ? '2px solid var(--color-success)'
          : '1px solid var(--border-card)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top accent bar */}
      {(upgrading || isMaxed) && (
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
          {upgrading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-3)',
                background: 'var(--color-warning-light)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div className="animate-spin" style={{ width: 14, height: 14, border: '2px solid var(--color-warning)', borderTopColor: 'transparent', borderRadius: '50%' }} />
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-warning)' }}>
                Upgrade in progress…
              </span>
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
              <button
                className={`btn btn-sm ${canAfford ? 'btn-primary' : 'btn-ghost'}`}
                style={{ width: '100%' }}
                disabled={!canAfford}
                onClick={() => onUpgrade(def.key, cost)}
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

  const [upgradingKeys, setUpgradingKeys] = useState({});

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

  function handleUpgrade(key, cost) {
    if (budget < cost) {
      addNotification('Insufficient budget for this upgrade.', 'error');
      return;
    }

    const currentLevel = facilities[key] ?? 0;
    if (currentLevel >= 10) {
      addNotification('This facility is already at max level.', 'info');
      return;
    }

    const hours = getUpgradeTime(currentLevel);

    const updatedFacilities = {
      ...facilities,
      [key]: currentLevel + 1,
    };

    const updatedTeam = {
      ...userTeam,
      budget: budget - cost,
      facilities: updatedFacilities,
    };

    dispatch({ type: 'UPDATE_TEAM', payload: updatedTeam });

    // Simulate upgrade in progress for the duration
    setUpgradingKeys(prev => ({ ...prev, [key]: true }));
    const ms = Math.min(hours * 1000, 8000); // cap at 8s for UX
    setTimeout(() => {
      setUpgradingKeys(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      const def = FACILITY_DEFS.find(d => d.key === key);
      addNotification(`${def?.name ?? key} upgraded to Level ${currentLevel + 1}!`, 'success');
    }, ms);

    addNotification(`Upgrading ${FACILITY_DEFS.find(d => d.key === key)?.name}… ${formatCost(cost)} deducted.`, 'info');
  }

  // Income estimates
  const fanCount = userTeam.fanCount ?? 250;
  const ticketPrice = userTeam.ticketPrice ?? 20;
  const merchandiseLevel = facilities.merchandise ?? 0;
  const gateRevenue = Math.round(fanCount * ticketPrice * 0.3);
  const merchRevenue = Math.round(50 * (1 + merchandiseLevel * 0.3));

  const totalFacilityLevel = FACILITY_DEFS.reduce((sum, d) => sum + (facilities[d.key] ?? 0), 0);

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
            level={facilities[def.key] ?? 0}
            budget={budget}
            upgrading={!!upgradingKeys[def.key]}
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
