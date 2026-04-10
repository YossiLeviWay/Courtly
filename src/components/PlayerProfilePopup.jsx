import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, Minus, ChevronUp, ChevronDown, BarChart2, User, FileText, TrendingUp } from 'lucide-react';
import { calculateOverallRating } from '../engine/playerGenerator.js';
import { apiGetMatchLog } from '../api.js';
import PlayerAvatar from './ui/PlayerAvatar.jsx';

// ── Constants ────────────────────────────────────────────────────
const MIN_W = 360;
const MIN_H = 280;
const DEFAULT_W = 520;
const DEFAULT_H = 620;

const NATIONALITY_FLAGS = {
  American:'🇺🇸',Canadian:'🇨🇦',Brazilian:'🇧🇷',Argentinian:'🇦🇷',
  Spanish:'🇪🇸',French:'🇫🇷',German:'🇩🇪',Italian:'🇮🇹',Greek:'🇬🇷',
  Turkish:'🇹🇷',Serbian:'🇷🇸',Croatian:'🇭🇷',Slovenian:'🇸🇮',
  Lithuanian:'🇱🇹',Latvian:'🇱🇻',Australian:'🇦🇺',Nigerian:'🇳🇬',
  Senegalese:'🇸🇳',Cameroonian:'🇨🇲',Congolese:'🇨🇩',Angolan:'🇦🇴',
  'South African':'🇿🇦',Chinese:'🇨🇳',Japanese:'🇯🇵','South Korean':'🇰🇷',
  Filipino:'🇵🇭',Lebanese:'🇱🇧',Israeli:'🇮🇱',Iranian:'🇮🇷',
  Sudanese:'🇸🇩',British:'🇬🇧',Dutch:'🇳🇱',Polish:'🇵🇱',Czech:'🇨🇿',
  Montenegrin:'🇲🇪',Venezuelan:'🇻🇪',Dominican:'🇩🇴','Puerto Rican':'🇵🇷',
  'New Zealander':'🇳🇿',Icelandic:'🇮🇸',
};

const ATTR_GROUPS = [
  { label: 'Offense', color: '#f97316', keys: [
    ['courtVision','Court Vision'],['threePtShooting','3PT Shooting'],
    ['midRangeScoring','Mid-Range'],['finishingAtTheRim','Finishing'],
    ['ballHandlingDribbling','Ball Handling'],['passingAccuracy','Passing'],
    ['offBallMovement','Off-Ball Move'],['postMoves','Post Moves'],
    ['freeThrowShooting','Free Throws'],
  ]},
  { label: 'Defense', color: '#3b82f6', keys: [
    ['perimeterDefense','Perimeter Def'],['interiorDefense','Interior Def'],
    ['helpDefense','Help Defense'],['rebounding','Rebounding'],
    ['settingScreens','Screens'],['disciplineFouling','Discipline'],
  ]},
  { label: 'Physical', color: '#22c55e', keys: [
    ['staminaEndurance','Stamina'],['agilityLateralSpeed','Agility'],
    ['verticalLeapingAbility','Vertical'],['bodyControl','Body Control'],
    ['conditioningFitness','Conditioning'],['aggressivenessOffensive','Aggressiveness'],
  ]},
  { label: 'Mental', color: '#8b5cf6', keys: [
    ['basketballIQ','Basketball IQ'],['leadershipCommunication','Leadership'],
    ['clutchPerformance','Clutch'],['handlePressureMental','Mental'],
    ['patienceOffense','Patience'],['consistencyPerformance','Consistency'],
    ['workEthicOutOfGame','Work Ethic'],['teamFirstAttitude','Team-First'],
    ['onBallScreenNavigation','Screen Nav'],
  ]},
];
// ── Staff report generator ────────────────────────────────────────
function generateStaffReports(player, staff, ovr) {
  const reports = [];
  const attrs = player.attributes || {};
  const form = player.recentForm ?? 0;
  const staffArr = Object.values(staff || {});

  const coach = staffArr.find(s => s.role === 'Head Coach' || s.role === 'Assistant Coach');
  if (coach) {
    const iq = attrs.basketballIQ ?? 50;
    const effort = attrs.workEthicOutOfGame ?? 50;
    const formNote = form > 1 ? ' Currently on a hot streak — keep rotating him.' : form < -1 ? ' Recent form is a concern; consider a confidence session.' : '';
    reports.push({
      role: coach.role, name: coach.name, icon: '🏀',
      text: `${player.name} ${ovr >= 75 ? 'is a key contributor to our system' : ovr >= 60 ? 'is developing well within our scheme' : 'needs more work to fit our system'}. ` +
        `Basketball IQ of ${iq} ${iq >= 70 ? 'is excellent — reads plays well' : iq >= 50 ? 'is adequate' : 'needs significant improvement'}. ` +
        `Work ethic in training: ${effort >= 70 ? 'outstanding' : effort >= 50 ? 'solid' : 'needs to be addressed'}.${formNote}`
    });
  }

  const physio = staffArr.find(s => s.role === 'Physio');
  if (physio) {
    const fatigue = player.fatigue ?? 0;
    const cond = attrs.conditioningFitness ?? 50;
    const sta = attrs.staminaEndurance ?? 50;
    const injNote = player.injuryStatus && player.injuryStatus !== 'healthy' ? ` Currently ${player.injuryStatus} — recovery protocol active.` : '';
    reports.push({
      role: 'Physio', name: physio.name, icon: '🏥',
      text: `Fatigue at ${fatigue}%: ${fatigue > 70 ? '⚠️ High — recommend rest before next match' : fatigue > 40 ? 'Moderate — monitor closely' : 'Good levels'}. ` +
        `Conditioning (${cond}) and stamina (${sta}) suggest ${cond >= 65 && sta >= 65 ? 'can handle heavy minutes load' : 'rotation management recommended'}.${injNote}`
    });
  }

  const scout = staffArr.find(s => s.role === 'Scout');
  if (scout) {
    const sortedAttrs = Object.entries(attrs).sort((a, b) => b[1] - a[1]);
    const top3 = sortedAttrs.slice(0, 3).map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').trim()} (${v})`).join(', ');
    const weak = sortedAttrs.slice(-2).map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').trim()} (${v})`).join(', ');
    reports.push({
      role: 'Scout', name: scout.name, icon: '🔭',
      text: `Profile: ${player.nationality}, Age ${player.age}. ` +
        `OVR ${ovr} — ${ovr >= 80 ? 'elite talent' : ovr >= 65 ? 'quality player' : ovr >= 50 ? 'average level' : 'below average'}. ` +
        `Strengths: ${top3}. Needs work: ${weak}.`
    });
  }

  const psych = staffArr.find(s => s.role === 'Psychologist');
  if (psych) {
    const mental = attrs.handlePressureMental ?? 50;
    const leader = attrs.leadershipCommunication ?? 50;
    const clutch = attrs.clutchPerformance ?? 50;
    reports.push({
      role: 'Psychologist', name: psych.name, icon: '🧠',
      text: `Mental profile: handles pressure ${mental >= 70 ? 'very well' : mental >= 50 ? 'adequately' : 'poorly under stress'}. ` +
        `Leadership: ${leader >= 70 ? 'natural leader — strong locker-room presence' : leader >= 50 ? 'follows well' : 'introverted, needs mentoring'}. ` +
        `Clutch rating ${clutch}: ${clutch >= 70 ? 'rises to the occasion in big moments' : clutch >= 50 ? 'performs consistently in pressure' : 'tends to shrink in high-stakes moments'}.`
    });
  }

  const nutritionist = staffArr.find(s => s.role === 'Nutritionist');
  if (nutritionist) {
    const cond = attrs.conditioningFitness ?? 50;
    reports.push({
      role: 'Nutritionist', name: nutritionist.name, icon: '🥗',
      text: `${player.name} is ${cond >= 70 ? 'following the nutrition plan excellently — peak physical shape' : cond >= 50 ? 'adhering to the plan reasonably well' : 'not following the recommended nutrition protocol — conditioning is suffering'}. ` +
        `Body stats look ${(player.weight?.kg ?? 90) < 115 ? 'in good range for position' : 'heavy — consider conditioning focus'}.`
    });
  }

  const strengthCoach = staffArr.find(s => s.role === 'Strength & Conditioning Coach');
  if (strengthCoach) {
    const vert = attrs.verticalLeapingAbility ?? 50;
    const agi = attrs.agilityLateralSpeed ?? 50;
    reports.push({
      role: 'S&C Coach', name: strengthCoach.name, icon: '💪',
      text: `Athletic profile: Vertical ${vert}, Agility ${agi}. ` +
        `${vert >= 70 && agi >= 70 ? 'Exceptional athlete — maintains elite physical standards' : vert >= 50 && agi >= 50 ? 'Good athleticism with room for targeted gains' : 'Needs dedicated strength and conditioning work'}. ` +
        `Recommend ${player.fatigue > 50 ? 'recovery sessions before increasing load' : 'progressive overload program'}.`
    });
  }

  return reports;
}
// ── Sub-components ────────────────────────────────────────────────

function AttrGroupBar({ label, value, color }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
      <div style={{ flex:1, height:7, background:'var(--bg-muted)', borderRadius:4, overflow:'hidden' }}>
        <div style={{ width:`${value}%`, height:'100%', background:color, borderRadius:4, transition:'width 0.4s' }} />
      </div>
      <span style={{ minWidth:26, textAlign:'right', fontSize:'var(--font-size-xs)', fontWeight:700, color }}>{Math.round(value)}</span>
    </div>
  );
}

function TabButton({ id, active, onClick, icon, label }) {
  return (
    <button
      onClick={() => onClick(id)}
      style={{
        display:'flex', alignItems:'center', gap:4, padding:'6px 10px',
        borderRadius:'var(--radius-md)', border:'none', cursor:'pointer',
        background: active ? 'var(--color-primary)' : 'transparent',
        color: active ? 'white' : 'var(--text-muted)',
        fontSize:'var(--font-size-xs)', fontWeight: active ? 700 : 500,
        transition:'all 0.15s', flexShrink:0,
      }}
    >
      {icon}
      <span style={{ display:'none', ['@media (min-width: 480px)' ]: { display:'inline' } }}>{label}</span>
      <span>{label}</span>
    </button>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────
function OverviewTab({ player, ovr }) {
  const attrs = player.attributes || {};
  const form = player.recentForm ?? 0;
  const formColor = form > 0 ? '#22c55e' : form < 0 ? '#ef4444' : 'var(--text-muted)';
  const formArrow = form > 0 ? '↑' : form < 0 ? '↓' : '→';
  const flag = NATIONALITY_FLAGS[player.nationality] || '🌍';

  // Group averages for radar-style overview
  const groupAvgs = ATTR_GROUPS.map(g => ({
    label: g.label,
    color: g.color,
    value: g.keys.reduce((sum, [k]) => sum + (attrs[k] ?? 0), 0) / g.keys.length,
  }));

  const topAttrs = Object.entries(attrs).sort((a,b) => b[1]-a[1]).slice(0,5);
  const weakAttrs = Object.entries(attrs).sort((a,b) => a[1]-b[1]).slice(0,3);

  const ovrColor = ovr >= 80 ? '#22c55e' : ovr >= 65 ? '#f97316' : '#ef4444';

  return (
    <div style={{ padding:'0 16px 16px' }}>
      {/* Bio strip */}
      <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom:16, padding:'12px 14px', background:'var(--bg-muted)', borderRadius:'var(--radius-md)' }}>
        {[
          ['Position', player.position],
          ['Age', player.age ?? '—'],
          ['Nationality', `${flag} ${player.nationality ?? '—'}`],
          ['Contract', player.contractYears ? `${player.contractYears} yr` : '—'],
          ['Height', player.height?.cm ? `${player.height.cm} cm` : '—'],
          ['Weight', player.weight?.kg ? `${player.weight.kg} kg` : '—'],
        ].map(([lbl, val]) => (
          <div key={lbl} style={{ minWidth:80 }}>
            <div style={{ fontSize:'0.6rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:0.5, fontWeight:700 }}>{lbl}</div>
            <div style={{ fontSize:'var(--font-size-sm)', fontWeight:600 }}>{val}</div>
          </div>
        ))}
        <div>
          <div style={{ fontSize:'0.6rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:0.5, fontWeight:700 }}>Form</div>
          <div style={{ fontSize:'var(--font-size-sm)', fontWeight:700, color:formColor }}>{formArrow} {form > 0 ? '+' : ''}{form}</div>
        </div>
      </div>

      {/* OVR + group bars */}
      <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:16, marginBottom:16 }}>
        <div style={{ textAlign:'center', padding:'12px 16px', background:`${ovrColor}15`, borderRadius:'var(--radius-md)', border:`2px solid ${ovrColor}` }}>
          <div style={{ fontSize:'2.5rem', fontWeight:900, color:ovrColor, lineHeight:1 }}>{ovr}</div>
          <div style={{ fontSize:'0.6rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:0.5, marginTop:2 }}>OVR</div>
          <div style={{ marginTop:8, fontSize:'var(--font-size-xs)', color:'var(--text-muted)' }}>
            {player.personality?.join(', ') || '—'}
          </div>
        </div>
        <div>
          {groupAvgs.map(g => (
            <div key={g.label} style={{ marginBottom:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                <span style={{ fontSize:'var(--font-size-xs)', fontWeight:700, color:g.color }}>{g.label}</span>
              </div>
              <AttrGroupBar label={g.label} value={g.value} color={g.color} />
            </div>
          ))}
        </div>
      </div>

      {/* Top / weak attrs */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div style={{ padding:'10px 12px', background:'rgba(34,197,94,0.07)', borderRadius:'var(--radius-md)', border:'1px solid rgba(34,197,94,0.2)' }}>
          <div style={{ fontSize:'0.65rem', fontWeight:700, color:'#22c55e', textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>Strengths</div>
          {topAttrs.map(([k,v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:'var(--font-size-xs)', marginBottom:3 }}>
              <span style={{ color:'var(--text-secondary)' }}>{k.replace(/([A-Z])/g,' $1').trim()}</span>
              <span style={{ fontWeight:700, color:'#22c55e' }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ padding:'10px 12px', background:'rgba(239,68,68,0.07)', borderRadius:'var(--radius-md)', border:'1px solid rgba(239,68,68,0.2)' }}>
          <div style={{ fontSize:'0.65rem', fontWeight:700, color:'#ef4444', textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>Weaknesses</div>
          {weakAttrs.map(([k,v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:'var(--font-size-xs)', marginBottom:3 }}>
              <span style={{ color:'var(--text-secondary)' }}>{k.replace(/([A-Z])/g,' $1').trim()}</span>
              <span style={{ fontWeight:700, color:'#ef4444' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
// ── Attributes Tab ────────────────────────────────────────────────
function AttributesTab({ player }) {
  const attrs = player.attributes || {};
  return (
    <div style={{ padding:'0 16px 16px' }}>
      {ATTR_GROUPS.map(g => (
        <div key={g.label} style={{ marginBottom:20 }}>
          <div style={{ fontSize:'var(--font-size-xs)', fontWeight:800, color:g.color, textTransform:'uppercase', letterSpacing:1, marginBottom:8, paddingBottom:4, borderBottom:`2px solid ${g.color}40` }}>
            {g.label}
          </div>
          {g.keys.map(([key, label]) => {
            const v = attrs[key] ?? 0;
            const pct = v;
            const barColor = v >= 75 ? g.color : v >= 50 ? `${g.color}99` : `${g.color}55`;
            return (
              <div key={key} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <span style={{ minWidth:130, fontSize:'var(--font-size-xs)', color:'var(--text-secondary)' }}>{label}</span>
                <div style={{ flex:1, height:7, background:'var(--bg-muted)', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ width:`${pct}%`, height:'100%', background:barColor, borderRadius:4, transition:'width 0.4s' }} />
                </div>
                <span style={{ minWidth:24, textAlign:'right', fontSize:'var(--font-size-xs)', fontWeight:700, color: v >= 75 ? g.color : v >= 50 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{v}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Stats Tab ─────────────────────────────────────────────────────
function StatsTab({ player, schedule, userTeamId }) {
  const [games, setGames] = useState(null);
  const [loading, setLoading] = useState(false);

  // Try to load per-game match logs in the background
  useEffect(() => {
    if (games !== null || loading) return;
    if (!schedule || !userTeamId) return;
    setLoading(true);
    const played = schedule.filter(m => m.played && (m.homeTeamId === userTeamId || m.awayTeamId === userTeamId));
    if (played.length === 0) { setLoading(false); setGames([]); return; }
    Promise.all(
      played.map(m => apiGetMatchLog(m.id).then(log => ({ m, log })).catch(() => ({ m, log: null })))
    ).then(results => {
      const rows = results
        .filter(r => r.log?.playerStats?.[player.id])
        .map(r => {
          const s = r.log.playerStats[player.id];
          const isHome = r.m.homeTeamId === userTeamId;
          const oppName = isHome ? r.m.awayTeamName : r.m.homeTeamName;
          const oppId = isHome ? r.m.awayTeamId : r.m.homeTeamId;
          const us = isHome ? (r.log.homeScore ?? r.m.result?.homeScore ?? 0) : (r.log.awayScore ?? r.m.result?.awayScore ?? 0);
          const them = isHome ? (r.log.awayScore ?? r.m.result?.awayScore ?? 0) : (r.log.homeScore ?? r.m.result?.homeScore ?? 0);
          return { ...s, oppName, oppId, date: r.m.scheduledDate, won: us > them, us, them };
        })
        .sort((a, b) => b.date - a.date);
      setGames(rows);
      setLoading(false);
    }).catch(() => { setGames([]); setLoading(false); });
  }, [games, loading, schedule, userTeamId, player.id]);

  // ── Primary data source: player.seasonStats (always available) ──
  const ss = player.seasonStats || {};
  const gp = ss.gamesPlayed || 0;

  const hasSeason = gp > 0;
  const hasMatchLogs = games && games.length > 0;

  function pgAvg(val) {
    if (!gp) return '—';
    return ((val || 0) / gp).toFixed(1);
  }
  function pct(m, a) { return (a || 0) > 0 ? (((m || 0) / a) * 100).toFixed(0) + '%' : '—'; }

  // If no data at all yet
  if (!hasSeason && !loading && games !== null && !hasMatchLogs) {
    return (
      <div style={{ padding:24, textAlign:'center' }}>
        <div style={{ fontSize:'2rem', marginBottom:8 }}>📊</div>
        <div style={{ fontWeight:700, color:'var(--text-muted)' }}>No match data yet</div>
        <div style={{ fontSize:'var(--font-size-xs)', color:'var(--text-muted)', marginTop:4 }}>Stats will appear after matches are played.</div>
      </div>
    );
  }

  return (
    <div style={{ padding:'0 16px 16px' }}>
      {/* Season averages — from player.seasonStats */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:'var(--font-size-xs)', fontWeight:800, textTransform:'uppercase', letterSpacing:1, color:'var(--text-muted)', marginBottom:10 }}>
          Season Averages ({gp} GP)
        </div>
        {!hasSeason ? (
          <div style={{ textAlign:'center', color:'var(--text-muted)', fontSize:'var(--font-size-xs)', padding:'12px 0' }}>
            {loading ? 'Loading…' : 'No games played yet'}
          </div>
        ) : (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8, marginBottom:8 }}>
              {[
                ['PPG', pgAvg(ss.points)],
                ['RPG', pgAvg(ss.rebounds)],
                ['APG', pgAvg(ss.assists)],
                ['SPG', pgAvg(ss.steals)],
              ].map(([l, v]) => (
                <div key={l} style={{ textAlign:'center', padding:'10px 6px', background:'var(--bg-muted)', borderRadius:'var(--radius-md)' }}>
                  <div style={{ fontSize:'var(--font-size-lg)', fontWeight:900, color:'var(--color-primary)' }}>{v}</div>
                  <div style={{ fontSize:'0.6rem', color:'var(--text-muted)', fontWeight:700 }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8 }}>
              {[
                ['BPG', pgAvg(ss.blocks)],
                ['TPG', pgAvg(ss.turnovers)],
                ['FG%', pct(ss.fgMade, ss.fgAttempts)],
                ['3P%', pct(ss.threePtMade, ss.threePtAttempts)],
              ].map(([l, v]) => (
                <div key={l} style={{ textAlign:'center', padding:'10px 6px', background:'var(--bg-muted)', borderRadius:'var(--radius-md)' }}>
                  <div style={{ fontSize:'var(--font-size-lg)', fontWeight:900, color:'var(--text-primary)' }}>{v}</div>
                  <div style={{ fontSize:'0.6rem', color:'var(--text-muted)', fontWeight:700 }}>{l}</div>
                </div>
              ))}
            </div>
            {/* Season totals row */}
            <div style={{ marginTop:10, display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:6 }}>
              {[
                ['Total PTS', ss.points ?? 0],
                ['Total REB', ss.rebounds ?? 0],
                ['Total AST', ss.assists ?? 0],
              ].map(([l, v]) => (
                <div key={l} style={{ textAlign:'center', padding:'6px 4px', background:'var(--bg-muted)', borderRadius:'var(--radius-sm)' }}>
                  <div style={{ fontSize:'var(--font-size-sm)', fontWeight:800 }}>{v}</div>
                  <div style={{ fontSize:'0.6rem', color:'var(--text-muted)', fontWeight:700 }}>{l}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Last 5 games — from match logs if available */}
      {loading && !hasMatchLogs && (
        <div style={{ fontSize:'var(--font-size-xs)', color:'var(--text-muted)', textAlign:'center', padding:'8px 0' }}>Loading game log…</div>
      )}
      {hasMatchLogs && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:'var(--font-size-xs)', fontWeight:800, textTransform:'uppercase', letterSpacing:1, color:'var(--text-muted)', marginBottom:8 }}>Last 5 Games</div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'var(--font-size-xs)', whiteSpace:'nowrap' }}>
              <thead>
                <tr style={{ color:'var(--text-muted)', borderBottom:'2px solid var(--border-color)' }}>
                  {['Opp','W/L','PTS','REB','AST','STL','BLK','FG%'].map(h => (
                    <th key={h} style={{ padding:'4px 6px', textAlign:'center', fontWeight:700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {games.slice(0,5).map((g, i) => {
                  const fg = (g.fgAttempts ?? 0) > 0 ? ((g.fgMade / g.fgAttempts) * 100).toFixed(0) + '%' : '—';
                  return (
                    <tr key={i} style={{ borderBottom:'1px solid var(--border-color)', background: g.won ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.04)' }}>
                      <td style={{ padding:'5px 6px', fontWeight:600, maxWidth:90, overflow:'hidden', textOverflow:'ellipsis' }}>{g.oppName}</td>
                      <td style={{ padding:'5px 6px', textAlign:'center' }}>
                        <span className={`badge ${g.won ? 'badge-green' : 'badge-red'}`} style={{ fontSize:'0.55rem' }}>{g.won ? 'W' : 'L'}</span>
                      </td>
                      <td style={{ padding:'5px 6px', textAlign:'center', fontWeight:700, color:(g.points??0)>=20?'var(--color-primary)':'inherit' }}>{g.points ?? 0}</td>
                      <td style={{ padding:'5px 6px', textAlign:'center' }}>{g.rebounds ?? 0}</td>
                      <td style={{ padding:'5px 6px', textAlign:'center' }}>{g.assists ?? 0}</td>
                      <td style={{ padding:'5px 6px', textAlign:'center' }}>{g.steals ?? 0}</td>
                      <td style={{ padding:'5px 6px', textAlign:'center' }}>{g.blocks ?? 0}</td>
                      <td style={{ padding:'5px 6px', textAlign:'center', color:'var(--text-muted)' }}>{fg}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Staff Report Tab ──────────────────────────────────────────────
function StaffTab({ player, staff, ovr }) {
  const reports = useMemo(() => generateStaffReports(player, staff, ovr), [player, staff, ovr]);
  if (reports.length === 0) {
    return (
      <div style={{ padding:24, textAlign:'center' }}>
        <div style={{ fontSize:'2rem', marginBottom:8 }}>👥</div>
        <div style={{ fontWeight:700, color:'var(--text-muted)' }}>No relevant staff members</div>
        <div style={{ fontSize:'var(--font-size-xs)', color:'var(--text-muted)', marginTop:4 }}>Hire coaches, physios, and scouts to get player reports.</div>
      </div>
    );
  }
  return (
    <div style={{ padding:'0 16px 16px', display:'flex', flexDirection:'column', gap:12 }}>
      {reports.map((r, i) => (
        <div key={i} style={{ padding:'12px 14px', background:'var(--bg-muted)', borderRadius:'var(--radius-md)', borderLeft:'3px solid var(--color-primary)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
            <span style={{ fontSize:'1rem' }}>{r.icon}</span>
            <span style={{ fontWeight:700, fontSize:'var(--font-size-xs)', color:'var(--color-primary)' }}>{r.role}</span>
            <span style={{ fontSize:'var(--font-size-xs)', color:'var(--text-muted)' }}>— {r.name}</span>
          </div>
          <p style={{ margin:0, fontSize:'var(--font-size-sm)', color:'var(--text-secondary)', lineHeight:1.6 }}>{r.text}</p>
        </div>
      ))}
    </div>
  );
}
// ── Main Popup Component ──────────────────────────────────────────
export default function PlayerProfilePopup({ player, staff, schedule, userTeamId, onClose, zIndex, onFocus, clickX, clickY }) {
  const popupRef = useRef(null);
  const headerRef = useRef(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);

  const [minimized, setMinimized] = useState(false);
  const [tab, setTab] = useState('overview');

  const ovr = player.overallRating ?? calculateOverallRating(player);
  const flag = NATIONALITY_FLAGS[player.nationality] || '🌍';
  const ovrColor = ovr >= 80 ? '#22c55e' : ovr >= 65 ? '#f97316' : '#ef4444';
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  // Set initial position & size once mounted — open near click location
  useEffect(() => {
    const el = popupRef.current;
    if (!el || isMobile) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = Math.min(DEFAULT_W, vw - 40);
    const h = Math.min(DEFAULT_H, vh - 80);
    let x, y;
    if (clickX != null && clickY != null) {
      // Center vertically so the popup is always fully visible; x follows click with clamping
      x = Math.max(10, Math.min(vw - w - 10, clickX - w / 2));
      y = Math.max(10, Math.min(vh - h - 10, (vh - h) / 2));
    } else {
      // Fallback: center with cascade offset
      const offset = ((zIndex - 1000) % 6) * 24;
      x = Math.max(20, Math.min(vw - w - 20, (vw - w) / 2 + offset - 60));
      y = Math.max(20, Math.min(vh - h - 20, (vh - h) / 2 + offset - 60));
    }
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.width = w + 'px';
    el.style.height = h + 'px';
  }, [isMobile, zIndex, clickX, clickY]);

  // Drag via header
  useEffect(() => {
    const header = headerRef.current;
    const el = popupRef.current;
    if (!header || !el || isMobile) return;

    function onDown(e) {
      if (e.target.closest('button')) return;
      const rect = el.getBoundingClientRect();
      dragRef.current = { mx: e.clientX, my: e.clientY, px: rect.left, py: rect.top };
      onFocus?.();
      e.preventDefault();
    }
    function onMove(e) {
      if (!dragRef.current) return;
      const { mx, my, px, py } = dragRef.current;
      const w = el.offsetWidth, h = el.offsetHeight;
      const nx = Math.max(0, Math.min(window.innerWidth - w, px + e.clientX - mx));
      const ny = Math.max(0, Math.min(window.innerHeight - h, py + e.clientY - my));
      el.style.left = nx + 'px'; el.style.top = ny + 'px';
    }
    function onUp() { dragRef.current = null; }

    // Touch support
    function onTouchDown(e) {
      if (e.target.closest('button')) return;
      const t = e.touches[0];
      const rect = el.getBoundingClientRect();
      dragRef.current = { mx: t.clientX, my: t.clientY, px: rect.left, py: rect.top };
    }
    function onTouchMove(e) {
      if (!dragRef.current) return;
      const t = e.touches[0];
      const { mx, my, px, py } = dragRef.current;
      const w = el.offsetWidth, h = el.offsetHeight;
      const nx = Math.max(0, Math.min(window.innerWidth - w, px + t.clientX - mx));
      const ny = Math.max(0, Math.min(window.innerHeight - h, py + t.clientY - my));
      el.style.left = nx + 'px'; el.style.top = ny + 'px';
      e.preventDefault();
    }

    header.addEventListener('mousedown', onDown);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    header.addEventListener('touchstart', onTouchDown, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onUp);
    return () => {
      header.removeEventListener('mousedown', onDown);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      header.removeEventListener('touchstart', onTouchDown);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onUp);
    };
  }, [isMobile, onFocus]);

  // Resize via bottom-right handle
  const onResizeDown = useCallback((e) => {
    const el = popupRef.current;
    if (!el) return;
    resizeRef.current = { mx: e.clientX, my: e.clientY, w: el.offsetWidth, h: el.offsetHeight };
    e.preventDefault();
    function onMove(e) {
      if (!resizeRef.current) return;
      const { mx, my, w, h } = resizeRef.current;
      const nw = Math.max(MIN_W, w + e.clientX - mx);
      const nh = Math.max(MIN_H, h + e.clientY - my);
      el.style.width = nw + 'px'; el.style.height = nh + 'px';
    }
    function onUp() {
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const TABS = [
    { id: 'overview', icon: <User size={12} />, label: 'Overview' },
    { id: 'attributes', icon: <BarChart2 size={12} />, label: 'Attributes' },
    { id: 'stats', icon: <TrendingUp size={12} />, label: 'Stats' },
    { id: 'staff', icon: <FileText size={12} />, label: 'Staff' },
  ];

  const popupStyle = isMobile ? {
    position: 'fixed', inset: 0, zIndex,
    background: 'var(--bg-card)', display: 'flex', flexDirection: 'column',
    borderRadius: 0,
  } : {
    position: 'fixed', zIndex,
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    minWidth: MIN_W, minHeight: MIN_H,
  };

  return (
    <div ref={popupRef} style={popupStyle} onClick={onFocus}>
      {/* ── Header (drag handle) ── */}
      <div
        ref={headerRef}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
          background: `linear-gradient(135deg, ${ovrColor}22, var(--bg-muted))`,
          borderBottom: '1px solid var(--border-color)',
          cursor: isMobile ? 'default' : 'move',
          userSelect: 'none', flexShrink: 0,
        }}
      >
        <PlayerAvatar player={player} size="sm" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 'var(--font-size-sm)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {player.name}
            {player.isCaptain && <span style={{ marginLeft: 6, fontSize: '0.6rem', color: 'var(--color-primary)' }}>C</span>}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            {player.position} · {flag} · Age {player.age ?? '—'}
          </div>
        </div>
        <div style={{ textAlign: 'center', marginRight: 4 }}>
          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 900, color: ovrColor, lineHeight: 1 }}>{ovr}</div>
          <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>OVR</div>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          style={{ padding: 4, flexShrink: 0 }}
          onClick={e => { e.stopPropagation(); setMinimized(v => !v); }}
          title={minimized ? 'Restore' : 'Minimize'}
        >
          {minimized ? <ChevronUp size={14} /> : <Minus size={14} />}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          style={{ padding: 4, flexShrink: 0 }}
          onClick={e => { e.stopPropagation(); onClose(); }}
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      {!minimized && (
        <>
          {/* ── Tab bar ── */}
          <div style={{ display: 'flex', gap: 4, padding: '8px 12px', borderBottom: '1px solid var(--border-color)', overflowX: 'auto', flexShrink: 0 }}>
            {TABS.map(t => (
              <TabButton key={t.id} id={t.id} active={tab === t.id} onClick={setTab} icon={t.icon} label={t.label} />
            ))}
          </div>

          {/* ── Tab content (scrollable) ── */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            <div style={{ paddingTop: 12 }}>
              {tab === 'overview'    && <OverviewTab player={player} ovr={ovr} />}
              {tab === 'attributes'  && <AttributesTab player={player} />}
              {tab === 'stats'       && <StatsTab player={player} schedule={schedule} userTeamId={userTeamId} />}
              {tab === 'staff'       && <StaffTab player={player} staff={staff} ovr={ovr} />}
            </div>
          </div>

          {/* ── Resize handle (desktop only) ── */}
          {!isMobile && (
            <div
              onMouseDown={onResizeDown}
              style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 18, height: 18, cursor: 'se-resize',
                background: 'linear-gradient(135deg, transparent 50%, var(--border-color) 50%)',
                borderRadius: '0 0 var(--radius-lg) 0',
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
