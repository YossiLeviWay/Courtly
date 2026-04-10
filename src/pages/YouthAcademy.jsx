import { useState, useMemo } from 'react';
import { useGame } from '../context/GameContext.jsx';
import { Star, Users, Calendar, CheckCircle, Eye } from 'lucide-react';

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
  // Draft is available every Sunday
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const isSunday = dayOfWeek === 0;
  const lastDraftedAt = userTeam?.youthDraft?.lastDraftedAt ?? 0;
  const lastDraftDate = new Date(lastDraftedAt);
  // Already drafted this week if lastDraftedAt is in the current week (Mon–Sun cycle ending this Sunday)
  const thisWeekSunday = (() => {
    const d = new Date(now);
    d.setHours(23, 59, 59, 999);
    d.setDate(d.getDate() + (7 - d.getDay()) % 7); // next Sunday (or today if Sunday)
    return d.getTime();
  })();
  const lastWeekSunday = thisWeekSunday - 7 * 24 * 60 * 60 * 1000;
  const alreadyDrafted = lastDraftedAt > lastWeekSunday;
  const nextSunday = new Date(thisWeekSunday + (alreadyDrafted ? 7 * 24 * 60 * 60 * 1000 : 0));
  nextSunday.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((nextSunday.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  const nextAvailable = nextSunday.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const draftOpen = isSunday && !alreadyDrafted;

  const youthLevel = userTeam?.facilities?.youthAcademy;
  const facilityLevel = typeof youthLevel === 'object' ? (youthLevel?.level ?? 0) : (youthLevel ?? 0);
  const reputation = userTeam?.reputation ?? 10;

  // Generate 3 prospects deterministically for this week (unique per team + week)
  const draftedProspectIds = userTeam?.youthDraft?.draftedProspectIds ?? [];
  const prospects = useMemo(() => {
    // Week number since Unix epoch
    const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    // Team-specific hash so different teams get different prospects
    const teamHash = (userTeam?.id ?? 'team').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const weekSeed = weekNumber * 1000 + (teamHash % 1000);
    return [0, 1, 2]
      .map(i => generateDraftProspect(facilityLevel, reputation, weekSeed * 3 + i))
      .filter(p => !draftedProspectIds.includes(p.id));
  }, [facilityLevel, reputation, userTeam?.id, draftedProspectIds]);

  const [selected, setSelected] = useState(null);
  const [revealedIds, setRevealedIds] = useState(new Set());

  function revealProspect(id) {
    setRevealedIds(prev => new Set([...prev, id]));
  }

  const handleDraft = () => {
    if (!selected || alreadyDrafted) return;
    const newPlayer = { ...selected, id: `youth-${Date.now()}`, isYouthAcademy: true };
    const updatedPlayers = [...(userTeam.players || []), newPlayer];

    // Fan buzz: higher-rated prospects generate more excitement
    const ovr = newPlayer.overallRating || 60;
    const enthusiasmBoost = ovr >= 80 ? 8 : ovr >= 70 ? 5 : ovr >= 60 ? 3 : 1;
    const buzzMsg = ovr >= 80
      ? `${newPlayer.name} is a highly-rated prospect — fans are buzzing about his potential!`
      : ovr >= 70
      ? `${newPlayer.name} joins from the academy. Supporters are optimistic about his future.`
      : `${newPlayer.name} has been drafted. The academy continues to develop young talent.`;

    const updatedDraftedIds = [...draftedProspectIds, selected.id];
    dispatch({
      type: 'UPDATE_TEAM', payload: {
        ...userTeam,
        players: updatedPlayers,
        fanEnthusiasm: Math.min(100, (userTeam.fanEnthusiasm ?? 20) + enthusiasmBoost),
        youthDraft: {
          lastDraftedAt: Date.now(),
          lastDraftedPlayer: newPlayer.name,
          draftedProspectIds: updatedDraftedIds,
        }
      }
    });
    addNotification(`${newPlayer.name} drafted and added to the squad! ${enthusiasmBoost > 3 ? '🔥 Fans are excited!' : ''}`, 'success');
    addNotification(buzzMsg, 'info');
  };

  return (
    <div className="animate-fade-in">
      {/* Hero header */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        borderRadius: 'var(--radius-xl)', padding: '32px 24px', marginBottom: 24,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(232,98,26,0.15) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <div style={{ fontSize: '3rem' }}>🌱</div>
            <div>
              <h1 style={{ color: 'white', margin: 0, fontSize: 'var(--font-size-2xl)', fontWeight: 900 }}>Youth Academy</h1>
              <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0, fontSize: 'var(--font-size-sm)' }}>Level {facilityLevel}/10 · New prospects every Sunday</p>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>Prospects Drafted</div>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 900, color: 'var(--color-primary)' }}>
                {(userTeam?.youthDraft?.draftedProspectIds ?? []).length}
              </div>
            </div>
          </div>

          {/* Draft status banner */}
          {draftOpen ? (
            <div style={{ background: 'rgba(232,98,26,0.2)', border: '2px solid var(--color-primary)', borderRadius: 'var(--radius-lg)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: '1.5rem', animation: 'pulse 1.5s infinite' }}>🏀</div>
              <div>
                <div style={{ color: 'white', fontWeight: 800, fontSize: 'var(--font-size-base)' }}>Draft Day is Open!</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 'var(--font-size-sm)' }}>Scout the prospects, reveal their report, and draft your favourite.</div>
              </div>
            </div>
          ) : !isSunday ? (
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-lg)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: '1.5rem' }}>📅</div>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>Next Draft: {nextAvailable}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 'var(--font-size-sm)' }}>{daysLeft} day{daysLeft !== 1 ? 's' : ''} until Sunday Draft Day</div>
              </div>
            </div>
          ) : (
            <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 'var(--radius-lg)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: '1.5rem' }}>✅</div>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>Drafted this week: {userTeam?.youthDraft?.lastDraftedPlayer}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 'var(--font-size-sm)' }}>Next draft available {nextAvailable}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Prospects section */}
      {!isSunday && !alreadyDrafted ? (
        /* Not Sunday yet */
        <div className="card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ fontSize: '4rem', marginBottom: 16 }}>🔮</div>
          <div style={{ fontWeight: 800, fontSize: 'var(--font-size-xl)', marginBottom: 8 }}>Come Back on Sunday</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', maxWidth: 360, margin: '0 auto', marginBottom: 24 }}>
            The Youth Academy runs a weekly scouting event every Sunday. New prospects will be revealed then — who will emerge?
          </div>
          <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ padding: '20px 24px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-lg)', border: '2px dashed var(--border-color)', minWidth: 140, textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 8, filter: 'grayscale(1)', opacity: 0.4 }}>🏃</div>
                <div style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Prospect {i}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Reveals Sunday</div>
              </div>
            ))}
          </div>
        </div>
      ) : prospects.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: '3rem', marginBottom: 8 }}>🎓</div>
          <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 'var(--font-size-lg)' }}>All prospects drafted!</div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>New prospects arrive next Sunday.</div>
        </div>
      ) : (
        <>
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', marginBottom: 16 }}>
            {draftOpen ? '🏀 This Week\'s Prospects — Choose Wisely' : '👁 This Week\'s Prospects (Preview)'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20, marginBottom: 28 }}>
            {prospects.map((p, idx) => {
              const isRevealed = revealedIds.has(p.id);
              const isSelected = selected?.id === p.id;
              const starCount = p.potential >= 85 ? 5 : p.potential >= 75 ? 4 : p.potential >= 65 ? 3 : p.potential >= 55 ? 2 : 1;
              const starColor = starCount >= 4 ? '#f59e0b' : starCount >= 3 ? '#f97316' : 'var(--text-muted)';
              const isElite = p.overallRating >= 75;
              return (
                <div key={p.id} style={{
                  borderRadius: 'var(--radius-xl)', overflow: 'hidden',
                  border: isSelected ? '3px solid var(--color-primary)' : isElite && isRevealed ? '2px solid #f59e0b' : '2px solid var(--border-card)',
                  background: isSelected ? 'var(--color-primary-100)' : 'var(--bg-card)',
                  boxShadow: isSelected ? '0 0 24px rgba(232,98,26,0.25)' : 'none',
                  transition: 'all 0.2s',
                  opacity: alreadyDrafted ? 0.65 : 1,
                }}>
                  {/* Card banner */}
                  <div style={{
                    height: 6,
                    background: isElite && isRevealed ? 'linear-gradient(90deg, #f59e0b, #f97316)' : starCount >= 3 ? 'var(--color-primary)' : 'var(--bg-muted)',
                  }} />

                  {!isRevealed ? (
                    /* Mystery card */
                    <div style={{ padding: 24, textAlign: 'center' }}>
                      <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
                        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-muted)', border: '3px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '2rem', color: 'var(--text-muted)' }}>?</div>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 'var(--font-size-base)', letterSpacing: 1, marginBottom: 4, color: 'var(--text-secondary)' }}>
                        UNKNOWN · {p.position}
                      </div>
                      <div style={{ marginBottom: 12, fontSize: '1.3rem', color: starColor, letterSpacing: 2 }}>
                        {'★'.repeat(starCount)}{'☆'.repeat(5 - starCount)}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 16 }}>
                        {starCount >= 5 ? '⚡ Exceptional prospect' : starCount >= 4 ? '🔥 High potential' : starCount >= 3 ? 'Solid prospect' : 'Development player'}
                      </div>
                      <button className="btn btn-primary btn-sm" onClick={() => revealProspect(p.id)} style={{ width: '100%' }}>
                        <Eye size={14} /> Reveal Scout Report
                      </button>
                    </div>
                  ) : (
                    /* Revealed card */
                    <div onClick={() => draftOpen && setSelected(isSelected ? null : p)}
                      style={{ padding: 20, cursor: draftOpen ? 'pointer' : 'default' }}>
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 'var(--font-size-base)' }}>{p.name}</div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{p.position} · Age {p.age}</div>
                          <div style={{ fontSize: '1rem', color: starColor, marginTop: 2 }}>{'★'.repeat(starCount)}{'☆'.repeat(5 - starCount)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: p.overallRating >= 75 ? '#22c55e' : p.overallRating >= 60 ? 'var(--color-primary)' : 'var(--text-secondary)', lineHeight: 1 }}>{p.overallRating}</div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>OVR</div>
                          {isElite && <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#f59e0b' }}>⭐ ELITE</div>}
                        </div>
                      </div>
                      {/* Potential bar */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>Potential</span>
                          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: p.potential >= 85 ? '#f59e0b' : 'var(--text-primary)' }}>{p.potential}</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--bg-muted)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${p.potential}%`, height: '100%', background: p.potential >= 85 ? 'linear-gradient(90deg,#f59e0b,#f97316)' : 'var(--color-primary)', borderRadius: 3, transition: 'width 0.4s' }} />
                        </div>
                      </div>
                      {/* Info badges */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                        <span className="badge" style={{ background: 'var(--bg-muted)' }}>💰 ${p.salary}k/yr</span>
                        <span className="badge" style={{ background: 'var(--bg-muted)' }}>📋 {p.contractYears} seasons</span>
                        <span className={`badge ${p.potential >= 80 ? 'badge-yellow' : 'badge-gray'}`}>POT {p.potential}</span>
                      </div>
                      {isSelected && draftOpen && (
                        <div style={{ padding: '8px 12px', background: 'rgba(232,98,26,0.12)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-primary)', fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 700 }}>
                          ✓ Selected — press "Draft Player" to confirm
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {draftOpen && (
            <div style={{ position: 'sticky', bottom: 20, zIndex: 50 }}>
              <button
                className="btn btn-primary btn-lg"
                disabled={!selected}
                onClick={handleDraft}
                style={{ width: '100%', maxWidth: 480, margin: '0 auto', display: 'flex', justifyContent: 'center', boxShadow: selected ? '0 8px 32px rgba(232,98,26,0.4)' : 'none', transition: 'box-shadow 0.2s' }}>
                <Star size={18} />
                {selected ? `Draft ${selected.name} (OVR ${selected.overallRating})` : 'Reveal & Select a Prospect'}
              </button>
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
      `}</style>
    </div>
  );
}
