import { useState, useMemo, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { Shield, Save, ChevronDown, ChevronRight, RefreshCw, Edit2, Check, X, Plus, Trophy } from 'lucide-react';
import { useGame } from '../context/GameContext.jsx';
import {
  apiUpdateMatchesBatch, apiUpdateMatch, apiGetMatchesFromCollection,
  apiGetAllUserStates, apiGetSeasonConfig, apiSaveSeasonConfig, apiCreateSeasonMatches,
  apiResetAllMatches, apiResetStandings, apiRegenerateSchedule,
  apiGetFeedback, apiMarkFeedbackRead,
} from '../api.js';
import { buildRoundRobinRounds } from '../engine/gameScheduler.js';

// ── Helpers ───────────────────────────────────────────────────

function tsToInputVal(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function groupByRound(matches) {
  // Group by scheduledDate; each unique date = one matchday
  const map = new Map();
  for (const m of matches) {
    const key = m.scheduledDate;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(m);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([ts, ms], i) => ({ roundIdx: i, ts, matches: ms }));
}

// ── Regenerate Schedule Panel ──────────────────────────────────

function RegenerateSchedulePanel({ leagues, onDone }) {
  const todayAt22 = (() => {
    const d = new Date();
    d.setHours(22, 0, 0, 0);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T22:00`;
  })();

  const [startDate, setStartDate] = useState(todayAt22);
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState('');

  async function handleGenerate() {
    if (!startDate) return;
    if (!window.confirm('This will DELETE all existing matches and create a fresh round-robin schedule. This cannot be undone. Continue?')) return;
    setSaving(true);
    setMsg('');
    try {
      const startTs = new Date(startDate).getTime();
      const result = await apiRegenerateSchedule(leagues, startTs);
      setMsg(`✓ Schedule regenerated: ${result.matchCount} fixtures across ${result.roundCount} rounds. First matchday: ${new Date(startTs).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
      onDone?.();
    } catch (err) {
      setMsg(`✗ Error: ${err.message}`);
    }
    setSaving(false);
  }

  return (
    <div className="card" style={{ padding: '20px 24px', marginBottom: 24, borderLeft: '3px solid var(--color-primary)' }}>
      <div style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', marginBottom: 4 }}>🗓 Regenerate Season 1 Schedule</div>
      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 16 }}>
        Deletes all existing matches and rebuilds a full round-robin for all {leagues.length} leagues.
        Each matchday is 3 days apart. <strong>Standings will also be reset to 0.</strong>
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ marginBottom: 4 }}>Start date &amp; time (your local time)</label>
          <input
            type="datetime-local"
            className="form-input"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </div>
        <button
          className="btn btn-primary"
          disabled={!startDate || saving || !leagues.length}
          onClick={handleGenerate}
          style={{ flexShrink: 0 }}
        >
          {saving
            ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
            : '⚡ Generate & Save Schedule'}
        </button>
      </div>
      {msg && (
        <div style={{ marginTop: 12, padding: '8px 14px', background: msg.startsWith('✓') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${msg.startsWith('✓') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 'var(--radius)', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: msg.startsWith('✓') ? '#16a34a' : '#dc2626' }}>
          {msg}
        </div>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Schedule Manager (with per-match editing) ─────────────────

function ScheduleManager({ collectionName = 'matches' }) {
  const [matches, setMatches]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [edits, setEdits]             = useState({});   // { matchId: { scheduledDate? } }
  const [resultEdits, setResultEdits] = useState({});   // { matchId: { homeScore, awayScore } }
  const [saving, setSaving]           = useState(false);
  const [msg, setMsg]                 = useState('');
  const [expanded, setExpanded]       = useState(new Set());
  const [editingMatch, setEditingMatch] = useState(null); // matchId being date-edited
  const [editingResult, setEditingResult] = useState(null); // matchId being result-edited

  const load = useCallback(async () => {
    setLoading(true);
    const data = await apiGetMatchesFromCollection(collectionName);
    setMatches(data.sort((a, b) => a.scheduledDate - b.scheduledDate));
    setEdits({});
    setResultEdits({});
    setLoading(false);
  }, [collectionName]);

  useEffect(() => { load(); }, [load]);

  const rounds = useMemo(() => groupByRound(matches), [matches]);
  const now = Date.now();
  const totalEdits = Object.keys(edits).length + Object.keys(resultEdits).length;

  function setRoundDate(roundTs, newTs) {
    const roundMatches = rounds.find(r => r.ts === roundTs)?.matches || [];
    setEdits(prev => {
      const next = { ...prev };
      roundMatches.forEach(m => {
        if (newTs && newTs !== m.scheduledDate) next[m.id] = { ...(next[m.id] || {}), scheduledDate: newTs };
        else { const e = { ...next[m.id] }; delete e.scheduledDate; if (Object.keys(e).length) next[m.id] = e; else delete next[m.id]; }
      });
      return next;
    });
  }

  function setMatchDate(matchId, newTs, origTs) {
    setEdits(prev => {
      const next = { ...prev };
      if (newTs && newTs !== origTs) next[matchId] = { ...(next[matchId] || {}), scheduledDate: newTs };
      else { const e = { ...next[matchId] }; delete e.scheduledDate; if (Object.keys(e).length) next[matchId] = e; else delete next[matchId]; }
      return next;
    });
  }

  function commitResult(matchId, homeScore, awayScore) {
    setResultEdits(prev => ({ ...prev, [matchId]: { homeScore: Number(homeScore), awayScore: Number(awayScore), played: true } }));
    setEditingResult(null);
  }

  async function handleSaveAll() {
    const allEdits = {};
    Object.entries(edits).forEach(([id, fields]) => { allEdits[id] = { ...(allEdits[id] || {}), ...fields }; });
    Object.entries(resultEdits).forEach(([id, fields]) => { allEdits[id] = { ...(allEdits[id] || {}), ...fields }; });
    if (!Object.keys(allEdits).length) return;

    setSaving(true);
    try {
      await apiUpdateMatchesBatch(allEdits);
      setMsg(`✓ Saved ${Object.keys(allEdits).length} change(s).`);
      setTimeout(() => setMsg(''), 5000);
      await load();
    } catch (err) {
      setMsg(`✗ Error: ${err.message}`);
    }
    setSaving(false);
  }

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
      <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
      <div style={{ marginTop: 8 }}>Loading from Firebase…</div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)' }}>
            {rounds.length} Matchdays · {matches.length} Fixtures
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 2 }}>
            Edit round dates (bulk) or individual match times. Admin can override any result.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={load}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-primary" disabled={!totalEdits || saving} onClick={handleSaveAll}>
            <Save size={16} /> {saving ? 'Saving…' : `Save ${totalEdits} Change${totalEdits !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ padding: '10px 16px', background: msg.startsWith('✓') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${msg.startsWith('✓') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 'var(--font-size-sm)', fontWeight: 600, color: msg.startsWith('✓') ? '#16a34a' : '#dc2626' }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rounds.map((round) => {
          const isPast  = round.ts < now;
          const isOpen  = expanded.has(round.roundIdx);
          const toggle  = () => setExpanded(prev => { const s = new Set(prev); s.has(round.roundIdx) ? s.delete(round.roundIdx) : s.add(round.roundIdx); return s; });
          const roundEdited = round.matches.some(m => edits[m.id]?.scheduledDate);
          const playedCount = round.matches.filter(m => m.played).length;

          // Display date for the round header (use first match's edited or original date)
          const firstMatch = round.matches[0];
          const roundDisplayTs = edits[firstMatch?.id]?.scheduledDate ?? round.ts;

          return (
            <div key={round.ts} className="card" style={{ padding: 0, borderLeft: roundEdited ? '3px solid var(--color-primary)' : undefined }}>
              {/* Round header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', flexWrap: 'wrap' }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer', minWidth: 200 }}
                  onClick={toggle}
                >
                  <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: isPast ? 'var(--bg-muted)' : 'var(--color-primary-100)', color: isPast ? 'var(--text-muted)' : 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11 }}>
                    {round.roundIdx + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      Matchday {round.roundIdx + 1} · {round.matches.length} games
                      {isPast && <span className="badge badge-gray" style={{ fontSize: '0.6rem' }}>PAST</span>}
                      {playedCount > 0 && <span className="badge badge-orange" style={{ fontSize: '0.6rem' }}>{playedCount}/{round.matches.length} played</span>}
                      {roundEdited && <span className="badge badge-orange" style={{ fontSize: '0.6rem' }}>EDITED</span>}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                      {fmtDate(roundDisplayTs)}
                    </div>
                  </div>
                  {isOpen ? <ChevronDown size={14} style={{ flexShrink: 0 }} /> : <ChevronRight size={14} style={{ flexShrink: 0 }} />}
                </div>

                {/* Bulk round date picker */}
                <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>All:</span>
                  <input
                    type="datetime-local"
                    className="form-input"
                    style={{ fontSize: 11, padding: '4px 8px', width: 'auto' }}
                    value={tsToInputVal(roundDisplayTs)}
                    onChange={e => {
                      const newTs = e.target.value ? new Date(e.target.value).getTime() : null;
                      setRoundDate(round.ts, newTs);
                    }}
                  />
                </div>
              </div>

              {/* Match list */}
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border-color)', padding: '8px 16px 12px' }}>
                  {round.matches.map(m => {
                    const matchEditedTs = edits[m.id]?.scheduledDate;
                    const matchDisplayTs = matchEditedTs ?? m.scheduledDate;
                    const resultEdit = resultEdits[m.id];
                    const isEditingThisDate = editingMatch === m.id;
                    const isEditingThisResult = editingResult === m.id;

                    return (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                        {/* Teams */}
                        <div style={{ flex: 1, minWidth: 200, fontSize: 'var(--font-size-sm)' }}>
                          <span style={{ fontWeight: 600 }}>{m.homeTeamName}</span>
                          <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>vs</span>
                          <span style={{ fontWeight: 600 }}>{m.awayTeamName}</span>
                        </div>

                        {/* Score / result */}
                        {(m.played || resultEdit) && !isEditingThisResult && (
                          <span className="badge badge-gray" style={{ fontSize: '0.7rem', cursor: 'pointer' }} onClick={() => setEditingResult(m.id)} title="Click to override result">
                            {resultEdit ? `${resultEdit.homeScore}–${resultEdit.awayScore} *` : `${m.homeScore ?? '?'}–${m.awayScore ?? '?'}`}
                          </span>
                        )}

                        {/* Result editor */}
                        {isEditingThisResult && (
                          <ResultEditor
                            homeTeam={m.homeTeamName}
                            awayTeam={m.awayTeamName}
                            defaultHome={resultEdit?.homeScore ?? m.homeScore ?? 0}
                            defaultAway={resultEdit?.awayScore ?? m.awayScore ?? 0}
                            onSave={(h, a) => commitResult(m.id, h, a)}
                            onCancel={() => setEditingResult(null)}
                          />
                        )}

                        {/* Individual date editor */}
                        {isEditingThisDate ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input
                              autoFocus
                              type="datetime-local"
                              className="form-input"
                              style={{ fontSize: 11, padding: '3px 6px', width: 'auto' }}
                              value={tsToInputVal(matchDisplayTs)}
                              onChange={e => {
                                const newTs = e.target.value ? new Date(e.target.value).getTime() : null;
                                setMatchDate(m.id, newTs, m.scheduledDate);
                              }}
                            />
                            <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px' }} onClick={() => setEditingMatch(null)}>
                              <Check size={12} color="var(--color-success)" />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {matchEditedTs && (
                              <span style={{ fontSize: 10, color: 'var(--color-primary)' }}>{fmtDate(matchEditedTs)}</span>
                            )}
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '2px 6px', opacity: 0.6 }}
                              title="Edit this match's time"
                              onClick={() => { setEditingMatch(m.id); setEditingResult(null); }}
                            >
                              <Edit2 size={12} />
                            </button>
                            {!m.played && !resultEdit && (
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '2px 6px', opacity: 0.6, fontSize: 10 }}
                                title="Set result"
                                onClick={() => { setEditingResult(m.id); setEditingMatch(null); }}
                              >
                                +score
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResultEditor({ homeTeam, awayTeam, defaultHome, defaultAway, onSave, onCancel }) {
  const [h, setH] = useState(String(defaultHome));
  const [a, setA] = useState(String(defaultAway));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <input type="number" min="0" max="200" style={{ width: 44, padding: '2px 4px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: 12, textAlign: 'center' }} value={h} onChange={e => setH(e.target.value)} />
      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>–</span>
      <input type="number" min="0" max="200" style={{ width: 44, padding: '2px 4px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: 12, textAlign: 'center' }} value={a} onChange={e => setA(e.target.value)} />
      <button className="btn btn-ghost btn-sm" style={{ padding: '2px 5px' }} onClick={() => onSave(h, a)}><Check size={11} color="var(--color-success)" /></button>
      <button className="btn btn-ghost btn-sm" style={{ padding: '2px 5px' }} onClick={onCancel}><X size={11} color="var(--color-danger)" /></button>
    </div>
  );
}

// ── Season Manager ────────────────────────────────────────────

function SeasonManager({ leagues }) {
  const [config, setConfig]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [creating, setCreating]     = useState(false);
  const [startDate, setStartDate]   = useState('');
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState('');
  const [viewSeason, setViewSeason] = useState(null); // season number to preview

  useEffect(() => {
    apiGetSeasonConfig().then(c => {
      setConfig(c);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
      <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const nextNum = (config.currentSeason || 1) + 1;
  const allSeasons = config.seasons || [{ number: 1, name: 'Season 1', active: true, collection: 'matches', createdAt: Date.now() }];

  async function handleCreateSeason() {
    if (!startDate) return;
    setSaving(true);
    setMsg('');
    try {
      const startTs = new Date(startDate).getTime();
      const MS_3D   = 3 * 24 * 60 * 60 * 1000;
      const collectionName = `matches_${nextNum}`;
      const allMatches = [];

      leagues.forEach((league, li) => {
        const rounds = buildRoundRobinRounds(league.teams || []);
        rounds.forEach((round, ri) => {
          const roundTs = startTs + ri * MS_3D;
          round.forEach(({ homeTeam, awayTeam }) => {
            allMatches.push({
              id:            `s${nextNum}-${li}-r${ri}-${homeTeam.id}-vs-${awayTeam.id}`,
              season:        nextNum,
              leagueId:      league.id,
              homeTeamId:    homeTeam.id,
              awayTeamId:    awayTeam.id,
              homeTeamName:  homeTeam.name || homeTeam.id,
              awayTeamName:  awayTeam.name || awayTeam.id,
              scheduledDate: roundTs,
              played:        false,
              homeScore:     null,
              awayScore:     null,
            });
          });
        });
      });

      await apiCreateSeasonMatches(collectionName, allMatches);

      const newConfig = {
        currentSeason: config.currentSeason,
        seasons: [
          ...allSeasons,
          { number: nextNum, name: `Season ${nextNum}`, active: false, collection: collectionName, createdAt: Date.now(), matchCount: allMatches.length },
        ],
      };
      await apiSaveSeasonConfig(newConfig);
      setConfig(newConfig);
      setCreating(false);
      setMsg(`✓ Season ${nextNum} created with ${allMatches.length} fixtures. Edit the schedule, then activate it when ready.`);
    } catch (err) {
      setMsg(`✗ Error: ${err.message}`);
    }
    setSaving(false);
  }

  async function handleActivate(seasonNumber) {
    if (!window.confirm(`Activate Season ${seasonNumber}? This will switch the live game to the new season fixtures.`)) return;
    const newConfig = {
      ...config,
      currentSeason: seasonNumber,
      seasons: allSeasons.map(s => ({ ...s, active: s.number === seasonNumber })),
    };
    await apiSaveSeasonConfig(newConfig);
    setConfig(newConfig);
    setMsg(`✓ Season ${seasonNumber} is now active. Users will see the new fixtures on next login.`);
  }

  return (
    <div>
      {msg && (
        <div style={{ padding: '10px 16px', background: msg.startsWith('✓') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${msg.startsWith('✓') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 'var(--font-size-sm)', fontWeight: 600, color: msg.startsWith('✓') ? '#16a34a' : '#dc2626' }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <Trophy size={20} color="var(--color-primary)" />
        <div>
          <span style={{ fontWeight: 700 }}>Active Season: </span>
          <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>Season {config.currentSeason}</span>
        </div>
      </div>

      {/* Season list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {allSeasons.map(s => (
          <div key={s.number} className="card" style={{ padding: '14px 18px', borderLeft: s.active ? '3px solid var(--color-primary)' : undefined }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {s.name}
                  {s.active && <span className="badge badge-orange" style={{ fontSize: '0.6rem' }}>ACTIVE</span>}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                  Collection: <code style={{ background: 'var(--bg-muted)', padding: '1px 4px', borderRadius: 3 }}>{s.collection}</code>
                  {s.matchCount && ` · ${s.matchCount} matches`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setViewSeason(viewSeason === s.number ? null : s.number)}
                >
                  {viewSeason === s.number ? 'Hide Schedule' : 'View Schedule'}
                </button>
                {!s.active && (
                  <button className="btn btn-primary btn-sm" onClick={() => handleActivate(s.number)}>
                    Activate
                  </button>
                )}
              </div>
            </div>

            {viewSeason === s.number && (
              <div style={{ marginTop: 16 }}>
                <ScheduleManager collectionName={s.collection} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create new season */}
      {!creating ? (
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> Create Season {nextNum}
        </button>
      ) : (
        <div className="card" style={{ padding: '20px 24px' }}>
          <h4 style={{ margin: '0 0 8px', fontWeight: 700 }}>Create Season {nextNum}</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 16 }}>
            Generates a full round-robin schedule for all {leagues.length} leagues ({leagues.flatMap(l => l.teams || []).length} teams total).
            Each matchday is spaced 3 days apart.
          </p>
          <div className="form-group">
            <label className="form-label">Season Start Date &amp; Time</label>
            <input
              type="datetime-local"
              className="form-input"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn btn-primary" disabled={!startDate || saving} onClick={handleCreateSeason}>
              {saving ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</> : `Generate ${nextNum === 2 ? 'Season 2' : `Season ${nextNum}`} Schedule`}
            </button>
            <button className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
          </div>
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
      )}
    </div>
  );
}

// ── Reset Zone ────────────────────────────────────────────────

function ResetZone({ onReset }) {
  const [resetting, setResetting] = useState(false);
  const [msg, setMsg]             = useState('');

  async function handleReset() {
    if (!window.confirm('⚠️ This will set ALL matches back to unplayed and reset all standings to 0. This cannot be undone. Continue?')) return;
    setResetting(true);
    setMsg('');
    try {
      await apiResetAllMatches('matches');
      await apiResetStandings();
      setMsg('✓ All matches reset to unplayed. All standings cleared. Refresh the page.');
      onReset?.();
    } catch (err) {
      setMsg(`✗ Error: ${err.message}`);
    }
    setResetting(false);
  }

  return (
    <div style={{ marginTop: 40, padding: '20px 24px', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 'var(--radius-lg)', background: 'rgba(239,68,68,0.04)' }}>
      <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: 6, fontSize: 'var(--font-size-sm)' }}>⚠ Danger Zone</div>
      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: 16 }}>
        Reset all match results to <strong>unplayed</strong> and clear all standings back to 0–0. Use this when starting a season fresh.
      </p>
      {msg && (
        <div style={{ marginBottom: 12, fontSize: 'var(--font-size-sm)', fontWeight: 600, color: msg.startsWith('✓') ? '#16a34a' : '#dc2626' }}>{msg}</div>
      )}
      <button
        className="btn btn-sm"
        style={{ background: '#dc2626', color: '#fff', border: 'none' }}
        disabled={resetting}
        onClick={handleReset}
      >
        {resetting ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Resetting…</> : '🔄 Reset All Results & Standings'}
      </button>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
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
                const teamId   = standing.teamId || standing.id;
                const teamName = standing.teamName || standing.name;
                const isExp    = expanded === teamId;
                const team     = league.teams?.find(t => t.id === teamId);

                return (
                  <div key={teamId} className="card" style={{ padding: 0 }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer' }}
                      onClick={() => setExpanded(isExp ? null : teamId)}
                    >
                      <div style={{ width: 24, textAlign: 'center', fontWeight: 800, color: si < 3 ? 'var(--color-primary)' : 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>{si + 1}</div>
                      <div style={{ flex: 1, fontWeight: 600 }}>{teamName}</div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        <span>{standing.wins || 0}W–{standing.losses || 0}L</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{standing.points || 0} pts</span>
                      </div>
                      {isExp ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                    {isExp && team && (
                      <div style={{ borderTop: '1px solid var(--border-color)', padding: '12px 16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
                          {(team.players || []).sort((a, b) => (b.overallRating || 0) - (a.overallRating || 0)).slice(0, 10).map(p => (
                            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', padding: '3px 0', borderBottom: '1px solid var(--border-color)' }}>
                              <span>{p.name} <span style={{ color: 'var(--text-muted)' }}>{p.position}</span></span>
                              <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{p.overallRating}</span>
                            </div>
                          ))}
                        </div>
                        {team.stadiumName && <div style={{ marginTop: 8, fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>🏟 {team.stadiumName}</div>}
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
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGetAllUserStates().then(data => { setUsers(data.filter(u => u.user)); setLoading(false); });
  }, []);

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
      <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
      <div>Loading users…</div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 16, fontWeight: 700 }}>{users.length} registered users</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {users.map(({ user, state: uState }) => {
          const teamName = state.allTeams?.find(t => t.id === uState?.teamId)?.name || uState?.teamId || '—';
          const played   = (uState?.seasonRecord?.wins || 0) + (uState?.seasonRecord?.losses || 0);
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
                <div style={{ display: 'flex', gap: 12, fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  {uState?.budget != null && <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>${uState.budget}k</span>}
                  <span>{uState?.seasonRecord?.wins || 0}W – {uState?.seasonRecord?.losses || 0}L</span>
                  <span>{played} played</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Feedback Inbox ────────────────────────────────────────────

function FeedbackInbox() {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiGetFeedback().then(data => { setItems(data); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markRead(id) {
    await apiMarkFeedbackRead(id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, read: true } : i));
  }

  const unreadCount = items.filter(i => !i.read).length;

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
      <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
      <div>Loading feedback…</div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (items.length === 0) return (
    <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>💬</div>
      <div style={{ fontWeight: 600 }}>No feedback yet</div>
      <div style={{ fontSize: 'var(--font-size-sm)', marginTop: 4 }}>Messages from users will appear here.</div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontWeight: 700 }}>{items.length} message{items.length !== 1 ? 's' : ''}</span>
        {unreadCount > 0 && (
          <span className="badge badge-orange" style={{ fontSize: '0.68rem' }}>{unreadCount} unread</span>
        )}
        <button className="btn btn-ghost btn-sm" onClick={load} style={{ marginLeft: 'auto' }}>
          <RefreshCw size={13} style={{ marginRight: 4 }} /> Refresh
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(item => {
          const date = new Date(item.createdAt);
          const timeAgo = (() => {
            const mins = Math.floor((Date.now() - item.createdAt) / 60000);
            if (mins < 1) return 'just now';
            if (mins < 60) return `${mins}m ago`;
            const hrs = Math.floor(mins / 60);
            if (hrs < 24) return `${hrs}h ago`;
            return `${Math.floor(hrs / 24)}d ago`;
          })();
          return (
            <div
              key={item.id}
              className="card"
              style={{
                padding: '12px 16px',
                borderLeft: item.read ? undefined : '3px solid var(--color-primary)',
                opacity: item.read ? 0.75 : 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {!item.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', display: 'inline-block', flexShrink: 0 }} />}
                  <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>{item.username || item.userId}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }} title={date.toLocaleString()}>{timeAgo}</span>
                  {!item.read && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => markRead(item.id)}
                      style={{ fontSize: '0.68rem', padding: '2px 8px', height: 'auto' }}
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {item.message}
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

  const leagues = state.leagues || [];
  const [scheduleKey, setScheduleKey] = useState(0);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Shield size={28} color="var(--color-primary)" />
          <div>
            <h1 style={{ margin: 0 }}>Admin Panel</h1>
            <p style={{ margin: 0 }}>Manage schedule, seasons, teams, and users</p>
          </div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 24 }}>
        {[
          ['schedule', '📅 Schedule'],
          ['seasons',  '🏆 Seasons'],
          ['teams',    '🏀 Teams'],
          ['users',    '👤 Users'],
          ['feedback', '💬 Feedback'],
        ].map(([k, l]) => (
          <button key={k} className={`tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'schedule' && (
        <>
          <RegenerateSchedulePanel leagues={leagues} onDone={() => setScheduleKey(k => k + 1)} />
          <ScheduleManager key={scheduleKey} collectionName="matches" />
          <ResetZone />
        </>
      )}
      {tab === 'seasons'  && <SeasonManager leagues={leagues} />}
      {tab === 'teams'    && <TeamsView leagues={leagues} />}
      {tab === 'users'    && <UsersView />}
      {tab === 'feedback' && <FeedbackInbox />}
    </div>
  );
}
