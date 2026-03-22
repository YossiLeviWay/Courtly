import { useState, useMemo } from 'react';
import { useGame } from '../context/GameContext.jsx';
import { Star, Users, Calendar, CheckCircle } from 'lucide-react';

// ── Seeded random ──────────────────────────────────────────────

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ── Draft prospect generation ──────────────────────────────────

function generateDraftProspect(facilityLevel, teamReputation, seed) {
  const rng = mulberry32(seed);
  const baseQuality = 40 + facilityLevel * 3 + Math.floor(teamReputation / 10);
  const age = 19 + Math.floor(rng() * 5);
  const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
  const position = positions[Math.floor(rng() * positions.length)];

  const ATTR_KEYS = [
    'courtVision', 'perimeterDefense', 'interiorDefense', 'offBallMovement', 'rebounding',
    'freeThrowShooting', 'clutchPerformance', 'staminaEndurance', 'leadershipCommunication',
    'postMoves', 'threePtShooting', 'midRangeScoring', 'ballHandlingDribbling', 'passingAccuracy',
    'basketballIQ', 'aggressivenessOffensive', 'helpDefense', 'onBallScreenNavigation',
    'conditioningFitness', 'patienceOffense', 'disciplineFouling', 'handlePressureMental',
    'verticalLeapingAbility', 'agilityLateralSpeed', 'settingScreens', 'finishingAtTheRim',
    'consistencyPerformance', 'workEthicOutOfGame', 'teamFirstAttitude', 'bodyControl',
  ];

  const attributes = {};
  ATTR_KEYS.forEach(k => {
    const base = baseQuality - 15 + Math.floor(rng() * 30);
    attributes[k] = Math.max(30, Math.min(95, base));
  });

  const overallRating = Math.round(Object.values(attributes).reduce((a, b) => a + b, 0) / ATTR_KEYS.length);
  const potential = Math.min(99, overallRating + 5 + Math.floor(rng() * 20));

  const firstNames = ['Marcus', 'Jake', 'Tyler', 'Jordan', 'Chris', 'Darius', 'Devon', 'Isaiah', 'Malik', 'Andre'];
  const lastNames = ['Johnson', 'Williams', 'Davis', 'Brown', 'Thompson', 'Garcia', 'Martinez', 'Young', 'Hall', 'King'];
  const name = firstNames[Math.floor(rng() * firstNames.length)] + ' ' + lastNames[Math.floor(rng() * lastNames.length)];

  return {
    id: `draft-${seed}`,
    name,
    position,
    age,
    overallRating,
    potential,
    attributes,
    salary: 20 + Math.floor(rng() * 30),
    contractYears: 2 + Math.floor(rng() * 3),
    yearsInClub: 0,
    fatigue: 10,
    injuryStatus: 'healthy',
    lastFormRating: 60,
    seasonStats: { gamesPlayed: 0, points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, fgMade: 0, fgAttempts: 0 },
    isYouthAcademy: true,
  };
}

// ── Main Page ──────────────────────────────────────────────────

export default function YouthAcademy() {
  const { state, dispatch, addNotification } = useGame();
  const userTeam = state.userTeam;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${now.getMonth()}`;
  const lastDraftMonth = userTeam?.youthDraft?.lastDraftMonth;
  const alreadyDrafted = lastDraftMonth === currentMonth;

  const youthLevel = userTeam?.facilities?.youthAcademy;
  const facilityLevel = typeof youthLevel === 'object' ? (youthLevel?.level ?? 0) : (youthLevel ?? 0);
  const reputation = userTeam?.reputation ?? 10;

  // Generate 3 prospects deterministically for this month
  const prospects = useMemo(() => {
    const monthSeed = now.getFullYear() * 100 + now.getMonth();
    return [0, 1, 2].map(i => generateDraftProspect(facilityLevel, reputation, monthSeed * 3 + i));
  }, [facilityLevel, reputation, now.getFullYear(), now.getMonth()]);

  const [selected, setSelected] = useState(null);

  const handleDraft = () => {
    if (!selected || alreadyDrafted) return;
    const newPlayer = { ...selected, id: `youth-${Date.now()}`, isYouthAcademy: true };
    const updatedPlayers = [...(userTeam.players || []), newPlayer];
    dispatch({
      type: 'UPDATE_TEAM', payload: {
        ...userTeam,
        players: updatedPlayers,
        youthDraft: { lastDraftMonth: currentMonth, lastDraftedPlayer: newPlayer.name }
      }
    });
    addNotification(`${newPlayer.name} drafted and added to the squad!`, 'success');
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>🌱 Youth Academy</h1>
        <p>Draft one young prospect per month to grow your squad</p>
      </div>

      {/* Draft window info */}
      <div className="card mb-5">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {alreadyDrafted ? '✅ Draft Complete' : '📅 Draft Window Open'}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
              {alreadyDrafted
                ? `You drafted ${userTeam?.youthDraft?.lastDraftedPlayer} this month. Next window opens next month.`
                : `Pick one prospect before end of ${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}.`}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Youth Academy Level</div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, color: 'var(--color-primary)' }}>{facilityLevel}/10</div>
          </div>
        </div>
      </div>

      {/* Prospects grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
        {prospects.map(p => (
          <div key={p.id}
            onClick={() => !alreadyDrafted && setSelected(selected?.id === p.id ? null : p)}
            style={{
              padding: 16, borderRadius: 'var(--radius-lg)',
              border: selected?.id === p.id ? '2px solid var(--color-primary)' : '2px solid var(--border-color)',
              background: selected?.id === p.id ? 'var(--color-primary-100)' : 'var(--bg-card)',
              cursor: alreadyDrafted ? 'default' : 'pointer',
              transition: 'all 0.15s',
              opacity: alreadyDrafted ? 0.6 : 1,
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{p.position} · Age {p.age}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, color: 'var(--color-primary)' }}>{p.overallRating}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>OVR</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              <span className="badge badge-orange">Potential: {p.potential}</span>
              <span className="badge" style={{ background: 'var(--bg-muted)' }}>${p.salary}k/yr</span>
              <span className="badge" style={{ background: 'var(--bg-muted)' }}>{p.contractYears} seasons</span>
            </div>
            {selected?.id === p.id && (
              <div style={{ marginTop: 8, fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 600 }}>
                ✓ Selected — click "Draft Player" below to confirm
              </div>
            )}
          </div>
        ))}
      </div>

      {!alreadyDrafted && (
        <button
          className="btn btn-primary btn-lg"
          disabled={!selected}
          onClick={handleDraft}>
          <Star size={18} /> Draft {selected?.name ?? 'Player'}
        </button>
      )}
    </div>
  );
}
