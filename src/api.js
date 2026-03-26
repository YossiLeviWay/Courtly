import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import {
  doc, getDoc, getDocs, setDoc, deleteDoc,
  collection, query, where, writeBatch,
} from 'firebase/firestore';
import { auth, db } from './firebase.js';

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
    log:           m.log           ?? [],
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
    userId:         s.userId         ?? s.user_id,
    teamId:         s.teamId         ?? s.team_id,
    budget:         s.budget         ?? 250,
    facilities:     s.facilities     ?? {},
    tactics:        s.tactics        ?? {},
    playersState:   s.playersState   ?? s.players_state  ?? [],
    fanCount:       s.fanCount       ?? s.fan_count       ?? 250,
    fanEnthusiasm:  s.fanEnthusiasm  ?? s.fan_enthusiasm  ?? 20,
    ticketPrice:    s.ticketPrice    ?? s.ticket_price    ?? 20,
    teamExposure:   s.teamExposure   ?? s.team_exposure   ?? 0,
    chemistryGauge: s.chemistryGauge ?? s.chemistry_gauge ?? 50,
    momentumBar:    s.momentumBar    ?? s.momentum_bar    ?? 65,
    reputation:     s.reputation     ?? 10,
    matchHistory:   s.matchHistory   ?? s.match_history   ?? [],
    seasonRecord:   s.seasonRecord   ?? s.season_record   ?? { wins: 0, losses: 0 },
    profileData:    s.profileData    ?? s.profile_data    ?? {},
    updatedAt:      s.updatedAt      ?? s.updated_at,
  };
}

function normalizeUser(u) {
  if (!u) return null;
  return {
    id:        u.id,
    email:     u.email    ?? '',
    username:  u.username ?? '',
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
    budget: 250,
    facilities: {},
    tactics: {},
    playersState: teamData?.players ?? [],
    fanCount: 250,
    fanEnthusiasm: 20,
    ticketPrice: 20,
    teamExposure: 0,
    chemistryGauge: 50,
    momentumBar: 65,
    reputation: 10,
    matchHistory: [],
    seasonRecord: { wins: 0, losses: 0 },
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
    const players = playerSnap.docs.map(d => d.data());
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

// ── Matches ──────────────────────────────────────────────────────

export async function apiGetMatches() {
  try {
    const snap = await getDocs(collection(db, 'matches'));
    return snap.docs.map(d => normalizeMatch(d.data()));
  } catch { return []; }
}

export async function apiRecordMatchResult({
  matchId, leagueId,
  homeTeamId, awayTeamId,
  homeTeamName, awayTeamName,
  homeScore, awayScore, log,
}) {
  try {
    // 1. Mark match as played
    const matchBatch = writeBatch(db);
    matchBatch.update(doc(db, 'matches', matchId), {
      played: true, homeScore, awayScore, log: log || [],
    });
    await matchBatch.commit();

    // 2. Increment standings (requires a read first)
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
      points: (hd.points || 0) + (homeWon ? 3 : 0),
    });
    standBatch.set(awayRef, {
      leagueId, teamId: awayTeamId, teamName: awayTeamName || ad.teamName || '',
      wins:   (ad.wins   || 0) + (awayWon ? 1 : 0),
      losses: (ad.losses || 0) + (awayWon ? 0 : 1),
      points: (ad.points || 0) + (awayWon ? 3 : 0),
    });
    await standBatch.commit();
  } catch (err) {
    console.error('Record match error:', err);
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
    await setDoc(doc(db, 'user_team_state', uid), {
      userId:         uid,
      teamId:         payload.teamId,
      budget:         payload.budget         ?? 250,
      facilities:     payload.facilities     ?? {},
      tactics:        payload.tactics        ?? {},
      playersState:   payload.playersState   ?? [],
      fanCount:       payload.fanCount       ?? 250,
      fanEnthusiasm:  payload.fanEnthusiasm  ?? 20,
      ticketPrice:    payload.ticketPrice    ?? 20,
      teamExposure:   payload.teamExposure   ?? 0,
      chemistryGauge: payload.chemistryGauge ?? 50,
      momentumBar:    payload.momentumBar    ?? 65,
      reputation:     payload.reputation     ?? 10,
      matchHistory:   payload.matchHistory   ?? [],
      seasonRecord:   payload.seasonRecord   ?? { wins: 0, losses: 0 },
      profileData:    payload.profileData    ?? {},
      updatedAt:      Date.now(),
    }, { merge: true });
  } catch (err) {
    console.error('Save user state error:', err);
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
