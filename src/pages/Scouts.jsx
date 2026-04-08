import { useState, useMemo, useEffect } from 'react';
import { useGame } from '../context/GameContext.jsx';
import { Star, MapPin, Clock, Send, UserPlus, X, CheckCircle } from 'lucide-react';

// ── Seeded RNG (mulberry32) ──────────────────────────────────────

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ── Constants ───────────────────────────────────────────────────

const REGIONS = ['NBA', 'Europe', 'South America', 'College', 'Asia', 'Africa'];

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

const FIRST_NAMES = [
  'Marcus', 'Jake', 'Tyler', 'Jordan', 'Chris', 'Darius', 'Devon', 'Isaiah', 'Malik', 'Andre',
  'DeShawn', 'Terrell', 'Antoine', 'Cedric', 'Leon', 'Brandon', 'Victor', 'Ramon', 'Kwame', 'Elijah',
  'Carlos', 'Luis', 'Diego', 'Rafael', 'Pablo', 'Luca', 'Nikola', 'Bogdan', 'Sasha', 'Ivan',
];
const LAST_NAMES = [
  'Johnson', 'Williams', 'Davis', 'Brown', 'Thompson', 'Garcia', 'Martinez', 'Young', 'Hall', 'King',
  'Mitchell', 'Robinson', 'Walker', 'Allen', 'Scott', 'Nelson', 'Carter', 'Rivera', 'Perez', 'Evans',
  'Petrov', 'Novak', 'Bauer', 'Müller', 'Okafor', 'Diallo', 'Mensah', 'Santos', 'Ferreira', 'Lopez',
];

const SCOUT_FIRST = ['Ray', 'Todd', 'Phil', 'Dana', 'Hank', 'Gus', 'Neil', 'Curt', 'Roy', 'Al'];
const SCOUT_LAST  = ['Parsons', 'Whitfield', 'Donnelly', 'Reeves', 'Kolb', 'Harmon', 'Osei', 'Fitch', 'Drummond', 'Pratt'];

const ATTR_KEYS = [
  'courtVision', 'perimeterDefense', 'interiorDefense', 'offBallMovement', 'rebounding',
  'freeThrowShooting', 'clutchPerformance', 'staminaEndurance', 'leadershipCommunication',
  'postMoves', 'threePtShooting', 'midRangeScoring', 'ballHandlingDribbling', 'passingAccuracy',
  'basketballIQ', 'aggressivenessOffensive', 'helpDefense', 'onBallScreenNavigation',
  'conditioningFitness', 'patienceOffense', 'disciplineFouling', 'handlePressureMental',
  'verticalLeapingAbility', 'agilityLateralSpeed', 'settingScreens', 'finishingAtTheRim',
  'consistencyPerformance', 'workEthicOutOfGame', 'teamFirstAttitude', 'bodyControl',
];

// ── Hire cost by level ───────────────────────────────────────────

function hireCost(level) {
  // Level 1 = $50k, scales by 40k per level
  return 50 + (level - 1) * 40;
}

// ── Generate available-for-hire scouts ──────────────────────────

function generateAvailableScouts(seed) {
  return [0, 1, 2].map(i => {
    const rng = mulberry32(seed + i * 999);
    const level = 1 + Math.floor(rng() * 3); // levels 1-3 available to hire
    const nameIdx1 = Math.floor(rng() * SCOUT_FIRST.length);
    const nameIdx2 = Math.floor(rng() * SCOUT_LAST.length);
    const regionIdx = Math.floor(rng() * REGIONS.length);
    return {
      id: `avail-${seed}-${i}`,
      name: `${SCOUT_FIRST[nameIdx1]} ${SCOUT_LAST[nameIdx2]}`,
      level,
      region: REGIONS[regionIdx],
      salary: level * 5000,
      missionStatus: 'idle',
      missionTarget: null,
      missionDaysLeft: 0,
      missionStarted: null,
    };
  });
}

// ── Generate prospects from a completed mission ──────────────────

function generateProspects(scoutId, region, scoutLevel, missionStarted) {
  const seed = Math.floor(missionStarted / 1000) + scoutLevel * 17;
  const rng = mulberry32(seed);
  const count = 1 + Math.floor(rng() * 3); // 1-3 prospects
  const baseQuality = 40 + scoutLevel * 5;

  return Array.from({ length: count }, (_, i) => {
    const prng = mulberry32(seed + i * 313 + 1);
    const age = 18 + Math.floor(prng() * 10);
    const position = POSITIONS[Math.floor(prng() * POSITIONS.length)];
    const firstName = FIRST_NAMES[Math.floor(prng() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(prng() * LAST_NAMES.length)];

    const attributes = {};
    ATTR_KEYS.forEach(k => {
      const base = baseQuality - 12 + Math.floor(prng() * 24);
      attributes[k] = Math.max(30, Math.min(95, base));
    });

    const overallRating = Math.round(
      Object.values(attributes).reduce((a, b) => a + b, 0) / ATTR_KEYS.length
    );
    const potential = Math.min(99, overallRating + 5 + Math.floor(prng() * 18));
    const signCost = 30 + Math.floor(prng() * 80); // cost in $k

    return {
      id: `prospect-${scoutId}-${i}-${missionStarted}`,
      name: `${firstName} ${lastName}`,
      age,
      position,
      overallRating,
      potential,
      attributes,
      salary: 20 + Math.floor(prng() * 30),
      contractYears: 2 + Math.floor(prng() * 3),
      yearsInClub: 0,
      fatigue: 10,
      injuryStatus: 'healthy',
      lastFormRating: 60,
      seasonStats: { gamesPlayed: 0, points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, fgMade: 0, fgAttempts: 0 },
      region,
      signCost,
      fromScoutId: scoutId,
    };
  });
}

// ── Helpers ──────────────────────────────────────────────────────

function renderStars(level, max = 5) {
  return Array.from({ length: max }, (_, i) => (
    <Star
      key={i}
      size={14}
      fill={i < level ? 'var(--color-primary)' : 'none'}
      color={i < level ? 'var(--color-primary)' : 'var(--text-muted)'}
    />
  ));
}

// Mission duration: each "day" = 1 real hour for demo purposes
// 14 days → 14 hours total
function missionElapsedDays(missionStarted) {
  const elapsedMs = Date.now() - missionStarted;
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  return Math.min(14, elapsedHours); // 1 real hour = 1 game day
}

function missionComplete(scout) {
  if (!scout.missionStarted) return false;
  return missionElapsedDays(scout.missionStarted) >= 14;
}

function missionProgress(scout) {
  if (!scout.missionStarted) return 0;
  return Math.min(100, (missionElapsedDays(scout.missionStarted) / 14) * 100);
}

function daysRemaining(scout) {
  if (!scout.missionStarted) return 14;
  return Math.max(0, 14 - missionElapsedDays(scout.missionStarted));
}

// ── Staff Scout level from playerEvaluation ability (0–100) → 1–3 ──

function staffScoutLevel(staffMember) {
  const ability = staffMember?.playerEvaluation ?? staffMember?.abilities?.playerEvaluation ?? 50;
  if (ability >= 80) return 3;
  if (ability >= 55) return 2;
  return 1;
}

// ── Staff Scout Card ──────────────────────────────────────────────

function StaffScoutCard({ staffMember, onPickRegion, onRecall, isPicking, tick }) {
  const level       = staffScoutLevel(staffMember);
  const isOnMission = staffMember.missionStatus === 'scouting';
  const isDone      = isOnMission && missionComplete(staffMember);
  const progress    = missionProgress(staffMember);
  const remaining   = daysRemaining(staffMember);

  return (
    <div className="card" style={{ position: 'relative', borderTop: '3px solid var(--color-primary)' }}>
      <div style={{
        position: 'absolute', top: -10, right: 12,
        background: 'var(--color-primary)', color: 'white',
        fontSize: '0.55rem', fontWeight: 800, letterSpacing: 0.5,
        padding: '2px 7px', borderRadius: 99, textTransform: 'uppercase',
      }}>Club Staff</div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12, marginTop: 6 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: 'var(--color-primary-100)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, flexShrink: 0,
        }}>🔭</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{staffMember.name}</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>{renderStars(level)}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className="badge" style={{ background: 'var(--bg-muted)', fontSize: '0.6rem' }}>Staff Scout</span>
            <span className="badge" style={{ background: 'var(--bg-muted)', fontSize: '0.6rem' }}>
              Eval: {staffMember.playerEvaluation ?? staffMember.abilities?.playerEvaluation ?? '?'}
            </span>
          </div>
        </div>
      </div>

      {isOnMission && !isDone && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 'var(--font-size-sm)' }}>
            <span style={{ color: 'var(--text-muted)' }}><Send size={12} style={{ marginRight: 4 }} />Scouting {staffMember.missionTarget}</span>
            <span style={{ fontWeight: 600 }}><Clock size={12} style={{ marginRight: 3 }} />{remaining.toFixed(1)}d left</span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: 'var(--border-color)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 99, background: 'var(--color-primary)', width: `${progress}%`, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {isDone ? (
        <>
          <div style={{ padding: '8px 12px', borderRadius: 'var(--radius)', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle size={14} color="#22c55e" />
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: '#22c55e' }}>Mission complete — report ready!</span>
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => onRecall(staffMember.id, true)}>
            <CheckCircle size={14} /> Collect Report
          </button>
        </>
      ) : isOnMission ? (
        <button className="btn" style={{ width: '100%', fontSize: 'var(--font-size-sm)' }} onClick={() => onRecall(staffMember.id, false)}>
          <X size={13} /> Recall Scout
        </button>
      ) : isPicking ? (
        <div>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 8 }}>Select region to scout:</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            {REGIONS.map(r => (
              <button key={r} className="btn" style={{ fontSize: 'var(--font-size-xs)', padding: '6px 8px' }} onClick={() => onPickRegion(staffMember.id, r)}>
                {r}
              </button>
            ))}
          </div>
          <button className="btn" style={{ width: '100%', fontSize: 'var(--font-size-sm)' }} onClick={() => onPickRegion(null, null)}>Cancel</button>
        </div>
      ) : (
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => onPickRegion(staffMember.id, null)}>
          <Send size={14} /> Send on Mission
        </button>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────

export default function Scouts() {
  const { state, dispatch, addNotification } = useGame();
  const userTeam = state.userTeam;
  const scouts = useMemo(() => userTeam?.scouts ?? [], [userTeam]);

  // Staff members with Scout role — staff is a plain object keyed by role, not an array
  const staffScouts = useMemo(() =>
    Object.values(userTeam?.staff ?? {}).filter(s => s.role === 'Scout' || s.position === 'Scout'),
    [userTeam]
  );

  // Tick state to refresh mission timers
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000); // refresh every 30s
    return () => clearInterval(id);
  }, []);

  // Pending mission-target selection (hired scouts and staff scouts)
  const [pendingMission, setPendingMission]       = useState(null); // { scoutId }
  const [pendingStaffMission, setPendingStaffMission] = useState(null); // staffMember.id

  // Scouting reports: array of { scoutId, prospects, dismissed }
  // Derived from scouts that have completed missions
  const completedMissions = useMemo(() => {
    return scouts.filter(s => s.missionStatus === 'scouting' && missionComplete(s));
  }, [scouts, tick]);

  // Available-for-hire scouts (regenerate each week based on date)
  const hireSeed = useMemo(() => {
    const now = new Date();
    return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + Math.floor(now.getDate() / 7);
  }, []);
  const availableScouts = useMemo(() => generateAvailableScouts(hireSeed), [hireSeed]);

  // Filter out available scouts whose names already exist in roster
  const hireableScouts = useMemo(() => {
    const rosterNames = new Set(scouts.map(s => s.name));
    return availableScouts.filter(s => !rosterNames.has(s.name));
  }, [availableScouts, scouts]);

  // Dismissed prospect ids
  const [dismissedProspects, setDismissedProspects] = useState(new Set());

  function updateScouts(newScouts) {
    dispatch({
      type: 'UPDATE_TEAM',
      payload: { ...userTeam, scouts: newScouts },
    });
  }

  function handleSendMission(scoutId, region) {
    const updated = scouts.map(s =>
      s.id === scoutId
        ? { ...s, missionStatus: 'scouting', missionTarget: region, missionDaysLeft: 14, missionStarted: Date.now() }
        : s
    );
    updateScouts(updated);
    setPendingMission(null);
    addNotification(`Scout sent to ${region} on a 14-day mission!`, 'success');
  }

  function handleReturnScout(scoutId) {
    const updated = scouts.map(s =>
      s.id === scoutId
        ? { ...s, missionStatus: 'idle', missionTarget: null, missionDaysLeft: 0, missionStarted: null }
        : s
    );
    updateScouts(updated);
    addNotification('Scout recalled from mission.', 'info');
  }

  function handleCollectReport(scout) {
    // Mark scout as idle, mission data cleared
    const updated = scouts.map(s =>
      s.id === scout.id
        ? { ...s, missionStatus: 'idle', missionTarget: null, missionDaysLeft: 0, missionStarted: null }
        : s
    );
    updateScouts(updated);
    addNotification(`Scouting report collected from ${scout.missionTarget}!`, 'success');
  }

  function handleHireScout(avail) {
    const cost = hireCost(avail.level);
    if ((userTeam.budget ?? 0) < cost) {
      addNotification('Not enough budget to hire this scout.', 'error');
      return;
    }
    if (scouts.length >= 3) {
      addNotification('You can only have 3 scouts at a time.', 'error');
      return;
    }
    const newScout = {
      ...avail,
      id: `scout-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };
    dispatch({
      type: 'UPDATE_TEAM',
      payload: {
        ...userTeam,
        scouts: [...scouts, newScout],
        budget: (userTeam.budget ?? 0) - cost,
      },
    });
    addNotification(`${newScout.name} hired as scout!`, 'success');
  }

  function handleFireScout(scoutId) {
    const updated = scouts.filter(s => s.id !== scoutId);
    updateScouts(updated);
    addNotification('Scout released.', 'info');
  }

  function handleSignPlayer(prospect) {
    const cost = prospect.signCost;
    if ((userTeam.budget ?? 0) < cost) {
      addNotification('Not enough budget to sign this player.', 'error');
      return;
    }
    const newPlayer = {
      ...prospect,
      id: `scout-signed-${Date.now()}`,
      isFromScout: true,
    };
    delete newPlayer.signCost;
    delete newPlayer.region;
    delete newPlayer.fromScoutId;

    dispatch({
      type: 'UPDATE_TEAM',
      payload: {
        ...userTeam,
        players: [...(userTeam.players ?? []), newPlayer],
        budget: (userTeam.budget ?? 0) - cost,
      },
    });
    setDismissedProspects(prev => new Set([...prev, prospect.id]));
    addNotification(`${prospect.name} signed to the squad!`, 'success');
  }

  function handleDismissProspect(prospectId) {
    setDismissedProspects(prev => new Set([...prev, prospectId]));
  }

  // ── Staff scout mission handlers ────────────────────────────

  function handleStaffPickRegion(staffId, region) {
    if (!staffId) { setPendingStaffMission(null); return; }
    if (!region)  { setPendingStaffMission(staffId); return; }
    // Send the staff scout on mission
    const updatedStaff = (userTeam.staff ?? []).map(s =>
      s.id === staffId
        ? { ...s, missionStatus: 'scouting', missionTarget: region, missionDaysLeft: 14, missionStarted: Date.now() }
        : s
    );
    dispatch({ type: 'UPDATE_TEAM', payload: { ...userTeam, staff: updatedStaff } });
    setPendingStaffMission(null);
    addNotification(`Staff scout sent to ${region} on a 14-day mission!`, 'success');
  }

  function handleStaffRecall(staffId, collectReport) {
    const updatedStaff = (userTeam.staff ?? []).map(s =>
      s.id === staffId
        ? { ...s, missionStatus: 'idle', missionTarget: null, missionDaysLeft: 0, missionStarted: null }
        : s
    );
    dispatch({ type: 'UPDATE_TEAM', payload: { ...userTeam, staff: updatedStaff } });
    addNotification(collectReport ? 'Staff scout report collected!' : 'Staff scout recalled from mission.', 'info');
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>🔭 Scout System</h1>
        <p>Send scouts on missions to find prospects from around the world</p>
      </div>

      {/* ── Club Staff Scouts ─────────────────────────────────── */}
      {staffScouts.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
            Club Staff Scouts
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 16, marginTop: 0 }}>
            Staff members with a Scout role — managed via the Staff page
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {staffScouts.map(s => (
              <StaffScoutCard
                key={s.id}
                staffMember={s}
                isPicking={pendingStaffMission === s.id}
                onPickRegion={handleStaffPickRegion}
                onRecall={handleStaffRecall}
                tick={tick}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Scout Roster ──────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
            Your Scouts ({scouts.length}/3)
          </h2>
        </div>

        {scouts.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔭</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>No scouts hired yet</div>
            <div style={{ fontSize: 'var(--font-size-sm)' }}>Hire scouts below to start finding prospects</div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {scouts.map(scout => {
            const isOnMission = scout.missionStatus === 'scouting';
            const isDone = isOnMission && missionComplete(scout);
            const progress = missionProgress(scout);
            const remaining = daysRemaining(scout);
            const isPickingRegion = pendingMission?.scoutId === scout.id;

            return (
              <div key={scout.id} className="card" style={{ position: 'relative' }}>
                {/* Fire button */}
                {!isOnMission && (
                  <button
                    onClick={() => handleFireScout(scout.id)}
                    style={{
                      position: 'absolute', top: 12, right: 12,
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', padding: 2,
                    }}
                    title="Release scout"
                  >
                    <X size={15} />
                  </button>
                )}

                {/* Scout info */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: 'var(--color-primary-100)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, flexShrink: 0,
                  }}>🔭</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>{scout.name}</div>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                      {renderStars(scout.level)}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span className="badge" style={{ background: 'var(--bg-muted)' }}>
                        <MapPin size={11} style={{ marginRight: 3 }} />{scout.region}
                      </span>
                      <span className="badge" style={{ background: 'var(--bg-muted)' }}>
                        ${(scout.salary / 1000).toFixed(0)}k/mo
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mission status */}
                {isDone ? (
                  <div>
                    <div style={{
                      padding: '8px 12px', borderRadius: 'var(--radius)',
                      background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                      marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <CheckCircle size={14} color="#22c55e" />
                      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: '#22c55e' }}>
                        Mission complete! Report ready.
                      </span>
                    </div>
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%' }}
                      onClick={() => handleCollectReport(scout)}
                    >
                      <CheckCircle size={14} /> Collect Report
                    </button>
                  </div>
                ) : isOnMission ? (
                  <div>
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 'var(--font-size-sm)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>
                          <Send size={12} style={{ marginRight: 4 }} />
                          Scouting {scout.missionTarget}
                        </span>
                        <span style={{ fontWeight: 600 }}>
                          <Clock size={12} style={{ marginRight: 3 }} />
                          {remaining.toFixed(1)}d left
                        </span>
                      </div>
                      <div style={{
                        height: 6, borderRadius: 99, background: 'var(--border-color)', overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', borderRadius: 99,
                          background: 'var(--color-primary)',
                          width: `${progress}%`,
                          transition: 'width 0.3s',
                        }} />
                      </div>
                    </div>
                    <button
                      className="btn"
                      style={{ width: '100%', fontSize: 'var(--font-size-sm)' }}
                      onClick={() => handleReturnScout(scout.id)}
                    >
                      <X size={13} /> Recall Scout
                    </button>
                  </div>
                ) : (
                  <div>
                    {isPickingRegion ? (
                      <div>
                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 8 }}>
                          Select region to scout:
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                          {REGIONS.map(r => (
                            <button
                              key={r}
                              className="btn"
                              style={{ fontSize: 'var(--font-size-xs)', padding: '6px 8px' }}
                              onClick={() => handleSendMission(scout.id, r)}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                        <button
                          className="btn"
                          style={{ width: '100%', fontSize: 'var(--font-size-sm)' }}
                          onClick={() => setPendingMission(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                        onClick={() => setPendingMission({ scoutId: scout.id })}
                      >
                        <Send size={14} /> Send on Mission
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Scouting Reports ─────────────────────────────────── */}
      {completedMissions.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 16 }}>
            Scouting Reports
          </h2>
          {completedMissions.map(scout => {
            const prospects = generateProspects(
              scout.id, scout.missionTarget, scout.level, scout.missionStarted
            ).filter(p => !dismissedProspects.has(p.id));

            if (prospects.length === 0) return null;

            return (
              <div key={scout.id} style={{ marginBottom: 20 }}>
                <div style={{
                  fontWeight: 600, marginBottom: 10, fontSize: 'var(--font-size-sm)',
                  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {scout.name} — {scout.missionTarget} Report
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                  {prospects.map(p => (
                    <div key={p.id} className="card" style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 700, marginBottom: 2 }}>{p.name}</div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                            {p.position} · Age {p.age}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, color: 'var(--color-primary)' }}>
                            {p.overallRating}
                          </div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>OVR</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                        <span className="badge badge-orange">Pot: {p.potential}</span>
                        <span className="badge" style={{ background: 'var(--bg-muted)' }}>${p.salary}k/yr</span>
                        <span className="badge" style={{ background: 'var(--bg-muted)' }}>{p.contractYears} yrs</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-primary"
                          style={{ flex: 1, fontSize: 'var(--font-size-xs)', padding: '6px 10px' }}
                          onClick={() => handleSignPlayer(p)}
                          disabled={(userTeam.budget ?? 0) < p.signCost}
                        >
                          Sign — ${p.signCost}k
                        </button>
                        <button
                          className="btn"
                          style={{ fontSize: 'var(--font-size-xs)', padding: '6px 10px' }}
                          onClick={() => handleDismissProspect(p.id)}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Scout hiring is available via the Transfer Market → Staff tab */}
      <div className="card" style={{ padding: '14px 16px', border: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Want to hire a new scout?</div>
        <div style={{ fontSize: 'var(--font-size-sm)' }}>Visit the <strong>Transfer Market → Staff</strong> tab to browse and hire scouts &amp; staff.</div>
      </div>
    </div>
  );
}
