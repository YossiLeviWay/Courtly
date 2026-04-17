import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import {
  doc, getDoc, getDocs, setDoc, deleteDoc, addDoc, updateDoc,
  collection, query, where, orderBy, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { buildRoundRobinRounds } from './engine/gameScheduler.js';

// ── Field-name normalizers ────────────────────────────────────────
// The migration stored PostgreSQL rows verbatim (snake_case).
// New records written by the app use camelCase.
// These helpers accept either format and always return camelCase.

function normalizeMatch(m) {
  return {
    id:            m.id,
    leagueId:      m.leagueId      ?? m.league_id      ?? '',
    homeTeamId:    m.homeTeamId    ?? m.home_team_id    ?? '',
    awayTeamId:    m.awayTeamId    ?? m.away_team_id    ?? '',
    homeTeamName:  m.homeTeamName  ?? m.home_team_name  ?? '',
    awayTeamName:  m.awayTeamName  ?? m.away_team_name  ?? '',
    scheduledDate: Number(m.scheduledDate ?? m.scheduled_date ?? 0),
    played:        m.played        ?? false,
    homeScore:     m.homeScore     ?? m.home_score      ?? null,
    awayScore:     m.awayScore     ?? m.away_score      ?? null,
    // log is NOT loaded here – stored in match_logs/{id} to respect Firestore 1 MB limit
  };
}

function normalizeStanding(s) {
  return {
    leagueId: s.leagueId ?? s.league_id ?? '',
    teamId:   s.teamId   ?? s.team_id   ?? '',
    teamName: s.teamName ?? s.team_name ?? '',
    wins:     Number(s.wins)   || 0,
    losses:   Number(s.losses) || 0,
    points:   Number(s.points) || 0,
  };
}

function normalizeUserState(s) {
  if (!s) return null;
  return {
    userId:              s.userId              ?? s.user_id,
    teamId:              s.teamId              ?? s.team_id,
    budget:              s.budget              ?? 250,
    facilities:          s.facilities          ?? {},
    tactics:             s.tactics             ?? {},
    playersState:        s.playersState        ?? s.players_state  ?? [],
    fanCount:            s.fanCount            ?? s.fan_count       ?? 250,
    fanEnthusiasm:       s.fanEnthusiasm       ?? s.fan_enthusiasm  ?? 20,
    ticketPrice:         s.ticketPrice         ?? s.ticket_price    ?? 20,
    teamExposure:        s.teamExposure        ?? s.team_exposure   ?? 0,
    chemistryGauge:      s.chemistryGauge      ?? s.chemistry_gauge ?? 50,
    momentumBar:         s.momentumBar         ?? s.momentum_bar    ?? 65,
    motivationBar:       s.motivationBar       ?? 60,
    reputation:          s.reputation          ?? 10,
    matchHistory:        s.matchHistory        ?? s.match_history   ?? [],
    seasonRecord:        s.seasonRecord        ?? s.season_record   ?? { wins: 0, losses: 0 },
    staff:               s.staff               ?? {},
    youthDraft:          s.youthDraft          ?? null,
    lastFanGrowthDate:   s.lastFanGrowthDate   ?? 0,
    lastTrainingApplied: s.lastTrainingApplied ?? 0,
    weeksPlayed:         s.weeksPlayed         ?? 0,
    lastWeekFanGrowth:   s.lastWeekFanGrowth   ?? null,
    trainingHighlights:  s.trainingHighlights  ?? [],
    lastMatchBrainHighlights: s.lastMatchBrainHighlights ?? [],
    financeLog:          s.financeLog          ?? [],
    lastWeeklyFinanceTick: s.lastWeeklyFinanceTick ?? 0,
    profileData:         s.profileData         ?? s.profile_data    ?? {},
    updatedAt:           s.updatedAt           ?? s.updated_at,
  };
}

function normalizeUser(u) {
  if (!u) return null;
  return {
    id:        u.id,
    email:     u.email    ?? '',
    username:  u.username ?? '',
    isAdmin:   u.isAdmin  ?? false,
    createdAt: u.createdAt ?? u.created_at ?? Date.now(),
  };
}

// ── Auth ─────────────────────────────────────────────────────────

export async function apiRegister(email, password, username, teamId, teamData, teamName) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  const batch = writeBatch(db);

  batch.set(doc(db, 'users', uid), {
    id: uid,
    email: email.toLowerCase(),
    username: username || '',
    createdAt: Date.now(),
  });

  const customName = teamName?.trim() || '';
  batch.set(doc(db, 'user_team_state', uid), {
    userId: uid,
    teamId: teamId || null,
    budget: 1500,
    facilities: {},
    tactics: {},
    playersState: teamData?.players ?? [],
    fanCount: 250,
    fanEnthusiasm: 20,
    ticketPrice: 20,
    teamExposure: 0,
    chemistryGauge: 50,
    momentumBar: 65,
    motivationBar: 60,
    reputation: 10,
    matchHistory: [],
    seasonRecord: { wins: 0, losses: 0 },
    staff: {
      headCoach: {
        id: `hc_${uid}`,
        role: 'Head Coach',
        name: _randomStaffName('coach'),
        level: 1,
        abilities: { gamePlanning: 28, playerDevelopment: 25, motivation: 30, tacticalKnowledge: 27 },
        salary: 180,
        contractYears: 2,
      },
      scout1: {
        id: `sc_${uid}`,
        role: 'Scout',
        name: _randomStaffName('scout'),
        level: 1,
        abilities: { playerEvaluation: 30, networking: 25, reporting: 28 },
        salary: 90,
        contractYears: 1,
      },
      teamManager: {
        id: `tm_${uid}`,
        role: 'Team Manager',
        name: _randomStaffName('manager'),
        level: 1,
        abilities: { logistics: 28, budgetManagement: 25, communication: 30 },
        salary: 120,
        contractYears: 2,
      },
    },
    profileData: {
      bio: '', avatar: { type: 'initials', emoji: null },
      gender: '', teamName: customName, stadiumName: '',
    },
    updatedAt: Date.now(),
  });

  await batch.commit();

  if (customName && teamId) await _propagateTeamName(teamId, customName);

  return { userId: uid, username };
}

export async function apiLogin(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const snap = await getDoc(doc(db, 'users', cred.user.uid));
  return { userId: cred.user.uid, username: snap.data()?.username || '' };
}

// ── Staff name generator ──────────────────────────────────────────

const STAFF_FIRST = ['Mike','Dave','James','Carlos','Tony','Kevin','Eric','Matt','Chris','Paul','Luis','Tom'];
const STAFF_LAST  = ['Rivera','Johnson','Williams','Martinez','Smith','Brown','Davis','Garcia','Taylor','Lee'];
function _randomStaffName(seed) {
  const h = Math.abs([...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0));
  return `${STAFF_FIRST[h % STAFF_FIRST.length]} ${STAFF_LAST[(h >> 4) % STAFF_LAST.length]}`;
}

// ── Player contract normalization ─────────────────────────────────
// Migrated players may lack contractYears/salary. Derive them
// deterministically from player id so the same player always gets
// the same values across sessions.

function _idHash(id) {
  let h = 5381;
  for (let i = 0; i < (id?.length ?? 0); i++) {
    h = ((h << 5) + h + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function _salaryFromOvr(ovr, hash) {
  if (ovr >= 85) return 18 + (hash % 12);   // $18–29k/yr
  if (ovr >= 75) return 10 + (hash % 8);    // $10–17k/yr
  if (ovr >= 65) return 5  + (hash % 5);    // $5–9k/yr
  if (ovr >= 55) return 2  + (hash % 3);    // $2–4k/yr
  return 1 + (hash % 2);                    // $1–2k/yr
}

function _contractYearsFromOvr(ovr, hash) {
  if (ovr >= 80) return 2 + (hash % 3);     // 2–4 yrs
  if (ovr >= 65) return 1 + (hash % 3);     // 1–3 yrs
  return 1 + (hash % 2);                    // 1–2 yrs
}

function normalizePlayerForClient(p) {
  const ovr  = p.overallRating || 60;
  const hash = _idHash(p.id);
  return {
    injuryStatus:    'healthy',
    fatigue:         10,
    motivation:      70,
    lastFormRating:  65,
    seasonsInClub:   0,
    ...p,
    salary:        p.salary        ?? _salaryFromOvr(ovr, hash),
    contractYears: p.contractYears ?? _contractYearsFromOvr(ovr, hash),
    seasonsInClub: p.seasonsInClub ?? 0,
  };
}

// ── Free-agent demand calculation (public helper) ─────────────────

export function calcFreeAgentDemand(player) {
  const ovr  = player.overallRating || 60;
  const hash = _idHash(player.id);
  const baseSalary = player.salary ?? _salaryFromOvr(ovr, hash);
  const age  = player.age || 25;

  // High-form players demand a premium; older players are more flexible
  const formBonus   = ((player.lastFormRating ?? 65) - 65) / 100; // –0.35 … +0.34
  const ageFactor   = age >= 33 ? 0.85 : age >= 30 ? 0.92 : 1.0;
  const salaryDemand = Math.max(1, Math.round(baseSalary * (1.1 + formBonus * 0.25) * ageFactor));

  const contractDemand = age >= 33 ? 1
    : age >= 30 ? 1 + (hash % 2)
    : ovr >= 80 ? 2 + (hash % 2)
    : ovr >= 65 ? 1 + (hash % 2)
    : 1;

  return { salaryDemand, contractDemand };
}

// ── Shared World ─────────────────────────────────────────────────

export async function apiGetWorld() {
  try {
    const [leagueSnap, teamSnap, playerSnap, staffSnap] = await Promise.all([
      getDocs(collection(db, 'leagues')),
      getDocs(collection(db, 'teams')),
      getDocs(collection(db, 'players')),
      getDocs(collection(db, 'staff')),
    ]);

    const leagues = leagueSnap.docs.map(d => d.data());
    const teams   = teamSnap.docs.map(d => d.data());
    const players = playerSnap.docs.map(d => normalizePlayerForClient(d.data()));
    const staff   = staffSnap.docs.map(d => d.data());

    const playersByTeam = {};
    players.forEach(p => {
      if (!playersByTeam[p.teamId]) playersByTeam[p.teamId] = [];
      playersByTeam[p.teamId].push(p);
    });

    const staffByTeam = {};
    staff.forEach(s => {
      if (!staffByTeam[s.teamId]) staffByTeam[s.teamId] = [];
      staffByTeam[s.teamId].push(s);
    });

    const teamsByLeague = {};
    teams.forEach(t => {
      if (!teamsByLeague[t.leagueId]) teamsByLeague[t.leagueId] = [];
      teamsByLeague[t.leagueId].push({
        ...t,
        players: playersByTeam[t.id] || [],
        staff:   staffByTeam[t.id]   || [],
      });
    });

    return {
      leagues: leagues.map(l => ({ ...l, teams: teamsByLeague[l.id] || [] })),
    };
  } catch { return null; }
}

// ── Free Agent Market ─────────────────────────────────────────────

export async function apiFreeAgentRelease(player) {
  try {
    const { salaryDemand, contractDemand } = calcFreeAgentDemand(player);
    const ref = doc(collection(db, 'transfer_market'));
    await setDoc(ref, {
      id:             ref.id,
      isFreeAgent:    true,
      playerId:       player.id,
      playerName:     player.name,
      position:       player.position,
      overallRating:  player.overallRating || 60,
      age:            player.age || 25,
      nationality:    player.nationality || '',
      salaryDemand,    // $k / year
      contractDemand,  // seasons
      playerData:     player,
      releasedAt:     Date.now(),
    });
  } catch (err) {
    console.error('Free agent release error:', err);
  }
}

export async function apiBuyFreeAgent(listingId, player, contractYears, salaryPerYear) {
  try {
    await deleteDoc(doc(db, 'transfer_market', listingId));
    // Return the player object with the signed contract
    return { ...player, contractYears, salary: salaryPerYear, seasonsInClub: 0, isOnTransferMarket: false };
  } catch (err) {
    console.error('Buy free agent error:', err);
    return null;
  }
}

export async function apiHireStaff(listingId) {
  try {
    await deleteDoc(doc(db, 'transfer_market', listingId));
    return true;
  } catch (err) {
    console.error('Hire staff error:', err);
    return false;
  }
}

export async function apiReleaseStaff(staffMember) {
  try {
    const ref = doc(collection(db, 'transfer_market'));
    await setDoc(ref, {
      ...staffMember,
      id: ref.id, // Generate a new listing ID
      isStaff: true,
      listedAt: Date.now(),
    });
    return true;
  } catch (err) {
    console.error('Release staff error:', err);
    return false;
  }
}

// ── Matches ──────────────────────────────────────────────────────

export async function apiGetMatches() {
  try {
    const snap = await getDocs(collection(db, 'matches'));
    return snap.docs.map(d => normalizeMatch(d.data()));
  } catch { return []; }
}

// ── Match Logs (separate collection to respect Firestore 1 MB limit) ─────────
// Events log and player stats are stored in match_logs/{matchId} rather than
// embedded in matches/{matchId} or user_team_state, keeping those docs small.

export async function apiSaveMatchLog(matchId, { events, playerStats, quarterScores, homeScore, awayScore, homeTeamName, awayTeamName, leagueId } = {}) {
  if (!matchId) return;
  try {
    await setDoc(doc(db, 'match_logs', matchId), {
      matchId,
      leagueId:      leagueId      || '',
      homeTeamName:  homeTeamName  || '',
      awayTeamName:  awayTeamName  || '',
      homeScore:     homeScore     ?? null,
      awayScore:     awayScore     ?? null,
      events:        events        || [],
      playerStats:   playerStats   || {},
      quarterScores: quarterScores || [],
      savedAt:       Date.now(),
    });
  } catch (err) {
    console.error('Save match log error:', err);
  }
}

export async function apiGetMatchLog(matchId) {
  if (!matchId) return null;
  try {
    const snap = await getDoc(doc(db, 'match_logs', matchId));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error('Get match log error:', err);
    return null;
  }
}

export async function apiRecordMatchResult({
  matchId, leagueId,
  homeTeamId, awayTeamId,
  homeTeamName, awayTeamName,
  homeScore, awayScore,
  log, playerStats, quarterScores,
}) {
  // Always save the match log first — independently of other writes so a
  // failed match-document update never blocks highlight/stats storage.
  await apiSaveMatchLog(matchId, { events: log, playerStats, quarterScores, homeScore, awayScore, homeTeamName, awayTeamName, leagueId });

  try {
    // Mark match as played — use setDoc+merge so it works whether or not
    // the document already exists in Firestore.
    await setDoc(doc(db, 'matches', matchId), {
      played: true, homeScore, awayScore,
    }, { merge: true });
  } catch (err) {
    console.warn('Could not update match document (non-fatal):', err);
  }

  try {
    // Increment standings (requires a read first)
    const homeRef = doc(db, 'standings', `${leagueId}_${homeTeamId}`);
    const awayRef = doc(db, 'standings', `${leagueId}_${awayTeamId}`);
    const [homeSnap, awaySnap] = await Promise.all([getDoc(homeRef), getDoc(awayRef)]);

    const hd = homeSnap.data() || { wins: 0, losses: 0, points: 0 };
    const ad = awaySnap.data() || { wins: 0, losses: 0, points: 0 };
    const homeWon = homeScore > awayScore;
    const awayWon = awayScore > homeScore;

    const standBatch = writeBatch(db);
    standBatch.set(homeRef, {
      leagueId, teamId: homeTeamId, teamName: homeTeamName || hd.teamName || '',
      wins:   (hd.wins   || 0) + (homeWon ? 1 : 0),
      losses: (hd.losses || 0) + (homeWon ? 0 : 1),
      points: (hd.points || 0) + (homeWon ? 2 : 1),
    });
    standBatch.set(awayRef, {
      leagueId, teamId: awayTeamId, teamName: awayTeamName || ad.teamName || '',
      wins:   (ad.wins   || 0) + (awayWon ? 1 : 0),
      losses: (ad.losses || 0) + (awayWon ? 0 : 1),
      points: (ad.points || 0) + (awayWon ? 2 : 1),
    });
    await standBatch.commit();
  } catch (err) {
    console.error('Record match standings error:', err);
  }
}

// ── Standings ────────────────────────────────────────────────────

export async function apiGetStandings() {
  try {
    const snap = await getDocs(collection(db, 'standings'));
    return snap.docs.map(d => normalizeStanding(d.data()));
  } catch { return []; }
}

// ── Transfer Market ──────────────────────────────────────────────

export async function apiGetTransferMarket() {
  try {
    const snap = await getDocs(collection(db, 'transfer_market'));
    return snap.docs.map(d => d.data());
  } catch { return []; }
}

export async function apiListPlayerForTransfer(playerData) {
  try {
    const existing = await getDocs(
      query(collection(db, 'transfer_market'), where('playerId', '==', playerData.playerId))
    );
    const batch = writeBatch(db);
    existing.docs.forEach(d => batch.delete(d.ref));

    const newRef = doc(collection(db, 'transfer_market'));
    batch.set(newRef, {
      id:              newRef.id,
      playerId:        playerData.playerId,
      playerName:      playerData.playerName      || '',
      position:        playerData.position        || '',
      overallRating:   playerData.overallRating   || 0,
      age:             playerData.age             || 0,
      nationality:     playerData.nationality     || '',
      askingPrice:     playerData.askingPrice,
      sellingTeamId:   playerData.sellingTeamId,
      sellingTeamName: playerData.sellingTeamName || '',
      listedAt:        Date.now(),
      playerData:      playerData.playerData      || {},
    });
    await batch.commit();
    return newRef.id;
  } catch (err) {
    console.error('List transfer error:', err);
  }
}

export async function apiDelistPlayer(listingId) {
  try {
    await deleteDoc(doc(db, 'transfer_market', listingId));
  } catch (err) {
    console.error('Delist error:', err);
  }
}

// ── User profile ─────────────────────────────────────────────────

export async function apiUpdateProfile(fields) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');

  const stateRef = doc(db, 'user_team_state', uid);
  const snap = await getDoc(stateRef);
  if (!snap.exists()) throw new Error('User state not found');

  const current = snap.data();
  const updatedProfile = {
    ...(current.profileData || {}),
    ...(fields.bio                  !== undefined && { bio:                   fields.bio }),
    ...(fields.gender               !== undefined && { gender:                fields.gender }),
    ...(fields.avatar               !== undefined && { avatar:                fields.avatar }),
    ...(fields.teamName             !== undefined && { teamName:              fields.teamName }),
    ...(fields.stadiumName          !== undefined && { stadiumName:           fields.stadiumName }),
    ...(fields.settingsChangesToday !== undefined && { settingsChangesToday:  fields.settingsChangesToday }),
    ...(fields.lastSettingsChange   !== undefined && { lastSettingsChange:    fields.lastSettingsChange }),
  };

  const batch = writeBatch(db);
  batch.update(stateRef, { profileData: updatedProfile, updatedAt: Date.now() });

  if (fields.username !== undefined || fields.email !== undefined) {
    const userRef = doc(db, 'users', uid);
    const userUpdate = {};
    if (fields.username !== undefined) userUpdate.username = fields.username;
    if (fields.email    !== undefined) userUpdate.email    = fields.email.toLowerCase();
    batch.update(userRef, userUpdate);
  }

  await batch.commit();

  if (fields.teamName?.trim()) {
    await _propagateTeamName(current.teamId, fields.teamName.trim());
  }

  return { success: true };
}

export async function apiChangePassword(currentPassword, newPassword) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
  return { success: true };
}

// ── Per-user team state ──────────────────────────────────────────

export async function apiGetUserState() {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  try {
    const [stateSnap, userSnap] = await Promise.all([
      getDoc(doc(db, 'user_team_state', uid)),
      getDoc(doc(db, 'users', uid)),
    ]);
    return {
      state: stateSnap.exists() ? normalizeUserState(stateSnap.data()) : null,
      user:  userSnap.exists()  ? normalizeUser(userSnap.data())       : null,
    };
  } catch { return null; }
}

export async function apiSaveUserState(payload) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    // Strip log and playerStats from matchHistory entries before saving to Firestore.
    // These large arrays are stored in match_logs/{matchId} instead, to keep
    // user_team_state well under Firestore's 1 MB document limit.
    const slimHistory = (payload.matchHistory ?? []).map(entry => {
      // eslint-disable-next-line no-unused-vars
      const { log, playerStats, ...slim } = entry;
      return slim;
    });

    await setDoc(doc(db, 'user_team_state', uid), {
      userId:              uid,
      teamId:              payload.teamId,
      budget:              payload.budget              ?? 250,
      facilities:          payload.facilities          ?? {},
      tactics:             payload.tactics             ?? {},
      playersState:        payload.playersState        ?? [],
      fanCount:            payload.fanCount            ?? 250,
      fanEnthusiasm:       payload.fanEnthusiasm       ?? 20,
      ticketPrice:         payload.ticketPrice         ?? 20,
      teamExposure:        payload.teamExposure        ?? 0,
      chemistryGauge:      payload.chemistryGauge      ?? 50,
      momentumBar:         payload.momentumBar         ?? 65,
      motivationBar:       payload.motivationBar       ?? 60,
      reputation:          payload.reputation          ?? 10,
      matchHistory:        slimHistory,
      seasonRecord:        payload.seasonRecord        ?? { wins: 0, losses: 0 },
      staff:               payload.staff               ?? {},
      youthDraft:          payload.youthDraft          ?? null,
      lastFanGrowthDate:   payload.lastFanGrowthDate   ?? 0,
      lastTrainingApplied: payload.lastTrainingApplied ?? 0,
      weeksPlayed:         payload.weeksPlayed         ?? 0,
      lastWeekFanGrowth:   payload.lastWeekFanGrowth   ?? null,
      trainingHighlights:  payload.trainingHighlights  ?? [],
      lastMatchBrainHighlights: payload.lastMatchBrainHighlights ?? [],
      financeLog:          (payload.financeLog         ?? []).slice(0, 50),
      lastWeeklyFinanceTick: payload.lastWeeklyFinanceTick ?? 0,
      profileData:         payload.profileData         ?? {},
      updatedAt:           Date.now(),
    }, { merge: true });
  } catch (err) {
    console.error('Save user state error:', err);
  }
}

// ── Admin APIs ───────────────────────────────────────────────

/** Admin: set a user's team budget directly by userId. */
export async function apiAdminSetBudget(userId, newBudget) {
  await updateDoc(doc(db, 'user_team_state', userId), { budget: Number(newBudget) });
}

/** Batch-update the scheduledDate of a set of match documents (one round). */
export async function apiUpdateRoundDates(matchIds, newTimestampMs) {
  if (!matchIds?.length) return;
  const batch = writeBatch(db);
  for (const matchId of matchIds) {
    batch.update(doc(db, 'matches', matchId), { scheduledDate: newTimestampMs });
  }
  await batch.commit();
}

/** Batch-update arbitrary fields on individual matches. edits = { matchId: { field: value } } */
export async function apiUpdateMatchesBatch(edits) {
  const entries = Object.entries(edits);
  if (!entries.length) return;
  const CHUNK = 400;
  for (let i = 0; i < entries.length; i += CHUNK) {
    const batch = writeBatch(db);
    entries.slice(i, i + CHUNK).forEach(([matchId, fields]) => {
      batch.update(doc(db, 'matches', matchId), fields);
    });
    await batch.commit();
  }
}

/** Update a single match document (admin override). */
export async function apiUpdateMatch(matchId, fields, collectionName = 'matches') {
  await setDoc(doc(db, collectionName, matchId), fields, { merge: true });
}

/** Read matches from any collection (used by admin for cross-season view). */
export async function apiGetMatchesFromCollection(collectionName = 'matches') {
  try {
    const snap = await getDocs(collection(db, collectionName));
    return snap.docs.map(d => normalizeMatch(d.data()));
  } catch { return []; }
}

/** Get Game Brain match overrides from Firestore (admin only).
 *  Returns { [matchId]: { forceWinner?: 'home'|'away', homeScore?: number, awayScore?: number } }
 */
export async function apiGetGameBrainConfig() {
  try {
    const snap = await getDoc(doc(db, 'app_config', 'gameBrain'));
    if (snap.exists()) return snap.data().overrides || {};
  } catch {}
  return {};
}

/** Save Game Brain overrides (admin only). */
export async function apiSaveGameBrainConfig(overrides) {
  await setDoc(doc(db, 'app_config', 'gameBrain'), { overrides });
}

/** Get season configuration from Firestore. */
export async function apiGetSeasonConfig() {
  try {
    const snap = await getDoc(doc(db, 'app_config', 'seasons'));
    if (snap.exists()) return snap.data();
  } catch {}
  return {
    currentSeason: 1,
    seasons: [{ number: 1, name: 'Season 1', active: true, collection: 'matches', createdAt: Date.now() }],
  };
}

/** Save season configuration to Firestore. */
export async function apiSaveSeasonConfig(config) {
  await setDoc(doc(db, 'app_config', 'seasons'), config);
}

/** Reset all matches in a collection to unplayed (no scores). */
export async function apiResetAllMatches(collectionName = 'matches') {
  const snap = await getDocs(collection(db, collectionName));
  const CHUNK = 400;
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + CHUNK).forEach(d => {
      batch.update(d.ref, { played: false, homeScore: null, awayScore: null });
    });
    await batch.commit();
  }
}

/** Reset all standings to 0 wins/losses/points. */
export async function apiResetStandings() {
  const snap = await getDocs(collection(db, 'standings'));
  const CHUNK = 400;
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + CHUNK).forEach(d => {
      batch.update(d.ref, { wins: 0, losses: 0, points: 0 });
    });
    await batch.commit();
  }
}

/** Batch-create all matches for a new season. */
export async function apiCreateSeasonMatches(collectionName, matches) {
  const CHUNK = 400;
  for (let i = 0; i < matches.length; i += CHUNK) {
    const batch = writeBatch(db);
    matches.slice(i, i + CHUNK).forEach(m => {
      batch.set(doc(db, collectionName, m.id), m);
    });
    await batch.commit();
  }
}

/**
 * Delete all existing matches, reset standings, then regenerate a full
 * round-robin schedule for every league starting at startTimestampMs.
 * Each round is spaced 3 days apart. Match IDs: s1-{li}-r{ri}-{homeId}-vs-{awayId}
 */
export async function apiRegenerateSchedule(leagues, startTimestampMs) {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const ROUND_GAP_MS = 3 * DAY_MS;
  const CHUNK = 400;

  // 1. Delete all existing matches
  const existingSnap = await getDocs(collection(db, 'matches'));
  for (let i = 0; i < existingSnap.docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    existingSnap.docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }

  // 2. Reset standings in the standings collection
  await apiResetStandings();

  // 2b. Reset every user's seasonRecord (best-effort — skip if admin rules not yet deployed)
  try {
    const userStateSnap = await getDocs(collection(db, 'user_team_state'));
    for (let i = 0; i < userStateSnap.docs.length; i += CHUNK) {
      const batch = writeBatch(db);
      userStateSnap.docs.slice(i, i + CHUNK).forEach(d => {
        batch.update(d.ref, { seasonRecord: { wins: 0, losses: 0 } });
      });
      await batch.commit();
    }
  } catch (e) {
    console.warn('Could not reset user seasonRecords (deploy updated Firestore rules to fix):', e.message);
  }

  // 3. Generate and write new matches
  const allMatches = [];
  leagues.forEach((league, li) => {
    if (!league.teams?.length) return;
    const rounds = buildRoundRobinRounds(league.teams);
    rounds.forEach((round, ri) => {
      const scheduledDate = startTimestampMs + ri * ROUND_GAP_MS;
      round.forEach(({ homeTeam, awayTeam }) => {
        allMatches.push({
          id:           `s1-${li}-r${ri}-${homeTeam.id}-vs-${awayTeam.id}`,
          leagueId:     league.id,
          homeTeamId:   homeTeam.id,
          awayTeamId:   awayTeam.id,
          homeTeamName: homeTeam.name || homeTeam.id,
          awayTeamName: awayTeam.name || awayTeam.id,
          scheduledDate,
          round:        ri + 1,
          played:       false,
          homeScore:    null,
          awayScore:    null,
        });
      });
    });
  });

  for (let i = 0; i < allMatches.length; i += CHUNK) {
    const batch = writeBatch(db);
    allMatches.slice(i, i + CHUNK).forEach(m => {
      batch.set(doc(db, 'matches', m.id), m);
    });
    await batch.commit();
  }

  const roundCount = leagues.length
    ? buildRoundRobinRounds(leagues[0].teams || []).length
    : 0;

  return { matchCount: allMatches.length, roundCount };
}

/** Get all user profiles + team states (admin only). */
export async function apiGetAllUserStates() {
  try {
    const [statesSnap, usersSnap] = await Promise.all([
      getDocs(collection(db, 'user_team_state')),
      getDocs(collection(db, 'users')),
    ]);
    const users = {};
    usersSnap.docs.forEach(d => { users[d.id] = normalizeUser(d.data()); });
    return statesSnap.docs.map(d => ({
      state: normalizeUserState(d.data()),
      user:  users[d.id] || null,
    }));
  } catch (err) {
    console.error('Get all user states error:', err);
    return [];
  }
}

// ── Feedback ─────────────────────────────────────────────────────

export async function apiSendFeedback(userId, username, message) {
  const now = Date.now();
  const ref = await addDoc(collection(db, 'feedback'), {
    userId,
    username,
    message,
    createdAt: now,
    read: false,
  });
  await updateDoc(doc(db, 'users', userId), { lastFeedbackAt: now });
  return ref;
}

export async function apiGetFeedback() {
  try {
    const snap = await getDocs(query(collection(db, 'feedback'), orderBy('createdAt', 'desc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('Get feedback error:', err);
    return [];
  }
}

export async function apiMarkFeedbackRead(docId) {
  await updateDoc(doc(db, 'feedback', docId), { read: true });
}

// ── Admin: Seed transfer market ──────────────────────────────────

/** Seed N generated free agents into the transfer_market collection (admin only). */
export async function apiSeedFreeAgents(count = 45) {
  const { generatePlayer } = await import('./engine/playerGenerator.js');
  const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
  const batch = writeBatch(db);
  for (let i = 0; i < count; i++) {
    const pos = POSITIONS[i % POSITIONS.length];
    const player = generatePlayer({ position: pos });
    const { salaryDemand, contractDemand } = calcFreeAgentDemand(player); // Dynamic wage based on ability/age/form

    const ref = doc(collection(db, 'transfer_market'));
    batch.set(ref, {
      id: ref.id,
      isFreeAgent: true,
      playerId: player.id,
      playerName: player.name,
      position: player.position,
      overallRating: player.overallRating,
      age: player.age,
      nationality: player.nationality,
      salaryDemand,
      contractYears: contractDemand || 2,
      releasedAt: Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000),
      seeded: true,
      playerData: player,
    });
  }
  await batch.commit();
  return count;
}

const STAFF_ROLE_DEFS = [
  { role: 'Head Coach', abilities: ['tactics', 'motivation', 'playerDevelopment', 'matchPreparation'] },
  { role: 'Scout', abilities: ['talentIdentification', 'opponentAnalysis', 'youthDevelopment', 'networkReach'] },
  { role: 'Fitness Coach', abilities: ['conditioning', 'injuryPrevention', 'recovery', 'peakPerformance'] },
  { role: 'Assistant Coach', abilities: ['offensiveSystems', 'defensiveSystems', 'setPlays', 'playerRelations'] },
  { role: 'Team Manager', abilities: ['logistics', 'budgetManagement', 'teamHarmony', 'mediaRelations'] },
];

/** Seed staff members into the transfer_market (admin only). */
export async function apiSeedStaffMarket(count = 100) {
  const batch = writeBatch(db);
  for (let i = 0; i < count; i++) {
    const roleDef = STAFF_ROLE_DEFS[i % STAFF_ROLE_DEFS.length];
    const avgAbility = 20 + Math.floor(Math.random() * 60); // 20-80
    const abilities = {};
    roleDef.abilities.forEach(k => {
      abilities[k] = Math.max(10, Math.min(99, avgAbility - 10 + Math.floor(Math.random() * 20)));
    });
    const name = _randomStaffName(String(i + Date.now()));
    const monthlyWage = 200 + Math.round(avgAbility * 30);
    const ref = doc(collection(db, 'transfer_market'));
    batch.set(ref, {
      id: ref.id,
      isStaff: true,
      staffRole: roleDef.role,
      name,
      abilities,
      avgAbility,
      monthlyWage,
      hireCost: Math.round(avgAbility * 10),
      seeded: true,
      listedAt: Date.now(),
    });
  }
  await batch.commit();
  return count;
}

// ── App config / world state ──────────────────────────────────────

/** Read the world_state config doc (returns plain object or null). */
export async function apiGetWorldState() {
  try {
    const snap = await getDoc(doc(db, 'app_config', 'world_state'));
    if (snap.exists()) return snap.data();
  } catch {}
  return null;
}

/** Stamp the current server time as lastMarketSeedDate on world_state. */
export async function apiStampMarketSeedDate() {
  await setDoc(
    doc(db, 'app_config', 'world_state'),
    { lastMarketSeedDate: serverTimestamp() },
    { merge: true },
  );
}

/** Returns a map of { [teamId]: username } for all registered users who have a teamId. */
export async function apiGetTeamUserMap() {
  try {
    const snap = await getDocs(collection(db, 'users'));
    const map = {};
    snap.docs.forEach(d => {
      const data = d.data();
      if (data.teamId) map[data.teamId] = data.username || 'Player';
    });
    return map;
  } catch (err) {
    console.warn('Could not load team-user map:', err);
    return {};
  }
}

// ── Internal helper ──────────────────────────────────────────────

async function _propagateTeamName(teamId, name) {
  if (!teamId || !name) return;
  const [standSnap, homeSnap, awaySnap] = await Promise.all([
    getDocs(query(collection(db, 'standings'),    where('teamId',     '==', teamId))),
    getDocs(query(collection(db, 'matches'),      where('homeTeamId', '==', teamId))),
    getDocs(query(collection(db, 'matches'),      where('awayTeamId', '==', teamId))),
  ]);

  const batch = writeBatch(db);
  standSnap.docs.forEach(d => batch.update(d.ref, { teamName:     name }));
  homeSnap.docs.forEach(d  => batch.update(d.ref, { homeTeamName: name }));
  awaySnap.docs.forEach(d  => batch.update(d.ref, { awayTeamName: name }));
  batch.update(doc(db, 'teams', teamId), { name });
  await batch.commit();
}
