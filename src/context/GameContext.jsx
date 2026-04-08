import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase.js';
import {
  apiGetWorld, apiGetMatches, apiGetStandings, apiGetUserState,
  apiGetTransferMarket, apiSaveUserState, apiRecordMatchResult,
  apiGetGameBrainConfig,
  apiGetWorldState, apiStampMarketSeedDate,
  apiSeedFreeAgents, apiSeedStaffMarket,
} from '../api.js';
import { processPendingMatches } from '../engine/gameScheduler.js';

// ── Build game state from Firestore data ───────────────────────

function buildLeagues(worldLeagues, dbMatches, dbStandings) {
  const dbNameMap = {};
  dbStandings.forEach(s => { if (s.teamId) dbNameMap[s.teamId] = s.teamName; });

  return worldLeagues.map(league => {
    const schedule = dbMatches
      .filter(m => m.leagueId === league.id)
      .map(m => ({
        id:            m.id,
        leagueId:      m.leagueId,
        homeTeamId:    m.homeTeamId,
        awayTeamId:    m.awayTeamId,
        homeTeamName:  m.homeTeamName,
        awayTeamName:  m.awayTeamName,
        scheduledDate: Number(m.scheduledDate),
        played:        m.played,
        result:        m.played ? { homeScore: m.homeScore, awayScore: m.awayScore } : null,
        // log is NOT stored in match docs – it lives in match_logs/{id}
      }));

    const standings = dbStandings
      .filter(s => s.leagueId === league.id)
      .map(s => ({
        teamId:   s.teamId,
        teamName: s.teamName,
        wins:     Number(s.wins),
        losses:   Number(s.losses),
        points:   Number(s.points),
      }));

    const finalStandings = standings.length > 0
      ? standings
      : (league.teams || []).map(t => ({
          teamId: t.id, teamName: dbNameMap[t.id] || t.name, wins: 0, losses: 0, points: 0,
        }));

    const teams = (league.teams || []).map(t => ({
      ...t,
      name: dbNameMap[t.id] || t.name,
    }));

    return { ...league, teams, schedule, standings: finalStandings };
  });
}

function buildUserTeam(leagues, userState) {
  const allTeams = leagues.flatMap(l => l.teams || []);
  const baseTeam = allTeams.find(t => t.id === userState.teamId);
  if (!baseTeam) return null;

  const profileData = userState.profileData || {};
  const evolvedPlayers = Array.isArray(userState.playersState) && userState.playersState.length > 0
    ? userState.playersState
    : (baseTeam.players || []);

  const userLeague = leagues.find(l => l.teams?.some(t => t.id === userState.teamId));
  const seasonMatches = (userLeague?.schedule || [])
    .filter(m => m.homeTeamId === userState.teamId || m.awayTeamId === userState.teamId)
    .map(m => ({
      ...m,
      date:         m.scheduledDate,
      isHome:       m.homeTeamId === userState.teamId,
      opponentName: m.homeTeamId === userState.teamId ? m.awayTeamName : m.homeTeamName,
      opponentId:   m.homeTeamId === userState.teamId ? m.awayTeamId   : m.homeTeamId,
    }));

  return {
    ...baseTeam,
    name:          profileData.teamName?.trim()    || baseTeam.name,
    stadiumName:   profileData.stadiumName?.trim() || baseTeam.stadiumName,
    isUserTeam:    true,
    players:       evolvedPlayers,
    seasonMatches,
    budget:         userState.budget         ?? 250,
    facilities:     userState.facilities     ?? {},
    tactics:        userState.tactics        ?? {},
    training:       profileData.training     ?? {},
    fanCount:       userState.fanCount       ?? 250,
    fanEnthusiasm:  userState.fanEnthusiasm  ?? 20,
    ticketPrice:    userState.ticketPrice    ?? 20,
    teamExposure:   userState.teamExposure   ?? 0,
    chemistryGauge: userState.chemistryGauge ?? 50,
    momentumBar:    userState.momentumBar    ?? 65,
    motivationBar:  userState.motivationBar  ?? 60,
    reputation:     userState.reputation     ?? 10,
    matchHistory:   userState.matchHistory   ?? [],
    youthDraft:     userState.youthDraft     ?? null,
    staff:          userState.staff          ?? {},
    lastFanGrowthDate:     userState.lastFanGrowthDate     ?? null,
    lastTrainingApplied:   userState.lastTrainingApplied   ?? 0,
    weeksPlayed:           userState.weeksPlayed           ?? 0,
    lastMatchBrainHighlights: userState.lastMatchBrainHighlights ?? [],
    lastWeekFanGrowth:     userState.lastWeekFanGrowth     ?? null,
    trainingHighlights:    userState.trainingHighlights    ?? [],
    wins:         userState.seasonRecord?.wins    ?? 0,
    losses:       userState.seasonRecord?.losses  ?? 0,
    seasonRecord: {
      wins:   userState.seasonRecord?.wins   ?? 0,
      losses: userState.seasonRecord?.losses ?? 0,
    },
  };
}

function buildUserProfile(dbUser, profileData) {
  return {
    id:                   dbUser?.id,
    username:             dbUser?.username             || '',
    email:                dbUser?.email                || '',
    isAdmin:              dbUser?.isAdmin              ?? false,
    bio:                  profileData?.bio             || '',
    gender:               profileData?.gender          || '',
    avatar:               profileData?.avatar          || { type: 'initials', emoji: null },
    settingsChangesToday: profileData?.settingsChangesToday || 0,
    lastSettingsChange:   profileData?.lastSettingsChange   || null,
    joinedAt:             dbUser?.createdAt            || Date.now(),
    records:              profileData?.records         || { wins: 0, losses: 0, honors: [] },
  };
}

function extractUserState(state) {
  const t = state.userTeam;
  if (!t) return null;
  return {
    teamId:         t.id,
    budget:         t.budget         ?? 250,
    facilities:     t.facilities     ?? {},
    tactics:        t.tactics        ?? {},
    playersState:   t.players        ?? [],
    fanCount:       t.fanCount       ?? 250,
    fanEnthusiasm:  t.fanEnthusiasm  ?? 20,
    ticketPrice:    t.ticketPrice    ?? 20,
    teamExposure:   t.teamExposure   ?? 0,
    chemistryGauge: t.chemistryGauge ?? 50,
    momentumBar:    t.momentumBar    ?? 65,
    motivationBar:  t.motivationBar  ?? 60,
    reputation:     t.reputation     ?? 10,
    matchHistory:   t.matchHistory   ?? [],
    youthDraft:     t.youthDraft     ?? null,
    staff:          t.staff          ?? {},
    lastFanGrowthDate:   t.lastFanGrowthDate   ?? null,
    lastTrainingApplied: t.lastTrainingApplied ?? 0,
    weeksPlayed:         t.weeksPlayed         ?? 0,
    lastMatchBrainHighlights: t.lastMatchBrainHighlights ?? [],
    lastWeekFanGrowth:   t.lastWeekFanGrowth   ?? null,
    trainingHighlights:  t.trainingHighlights  ?? [],
    seasonRecord:   { wins: t.wins ?? 0, losses: t.losses ?? 0 },
    profileData: {
      bio:                  state.user?.bio                  || '',
      gender:               state.user?.gender               || '',
      avatar:               state.user?.avatar               || { type: 'initials', emoji: null },
      settingsChangesToday: state.user?.settingsChangesToday || 0,
      lastSettingsChange:   state.user?.lastSettingsChange   || null,
      records:              state.user?.records              || { wins: 0, losses: 0, honors: [] },
      teamName:             state.userTeam?.name             || '',
      stadiumName:          state.userTeam?.stadiumName      || '',
      training:             state.userTeam?.training         ?? {},
    },
  };
}

// ── Context setup ──────────────────────────────────────────────

const GameContext = createContext(null);

const initialState = {
  user:          null,
  userTeam:      null,
  leagues:       null,
  allTeams:      [],
  transferMarket: [],
  currentMatch:  null,
  isMatchLive:   false,
  notifications: [],
  lastUpdated:   null,
  initialized:   false,
};

function gameReducer(state, action) {
  switch (action.type) {
    case 'INIT_GAME':
      return { ...state, ...action.payload, initialized: true, lastUpdated: Date.now() };
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'UPDATE_TEAM': {
      const updated = action.payload;
      return {
        ...state,
        userTeam: updated,
        allTeams: state.allTeams.map(t => t.id === updated.id ? updated : t),
        leagues: (state.leagues || []).map(l => ({
          ...l,
          teams: (l.teams || []).map(t => t.id === updated.id ? updated : t),
        })),
        lastUpdated: Date.now(),
      };
    }
    case 'UPDATE_PLAYER': {
      const updatedPlayers = state.userTeam.players.map(p =>
        p.id === action.payload.id ? action.payload : p
      );
      const updatedTeam = { ...state.userTeam, players: updatedPlayers };
      return {
        ...state,
        userTeam: updatedTeam,
        allTeams: state.allTeams.map(t => t.id === updatedTeam.id ? updatedTeam : t),
        lastUpdated: Date.now(),
      };
    }
    case 'UPDATE_ALL_TEAMS':
      return {
        ...state,
        allTeams: action.payload,
        userTeam: action.payload.find(t => t.isUserTeam) || state.userTeam,
        lastUpdated: Date.now(),
      };
    case 'UPDATE_LEAGUES':
      return { ...state, leagues: action.payload, lastUpdated: Date.now() };
    case 'SET_TRANSFER_MARKET':
      return { ...state, transferMarket: action.payload };
    case 'SET_MATCH_LIVE':
      return { ...state, currentMatch: action.payload, isMatchLive: true };
    case 'END_MATCH':
      return { ...state, currentMatch: null, isMatchLive: false };
    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [action.payload, ...state.notifications].slice(0, 50) };
    case 'CLEAR_NOTIFICATION':
      return { ...state, notifications: state.notifications.filter(n => n.id !== action.payload) };
    case 'CLEAR_ALL_NOTIFICATIONS':
      return { ...state, notifications: [] };
    case 'UPDATE_USER':
      return { ...state, user: { ...state.user, ...action.payload } };
    default:
      return state;
  }
}

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const justLoaded = useRef(false);

  // ── Core data loader (called on login + polling) ──────────────
  const loadGameData = useCallback(async () => {
    if (!auth.currentUser) return;

    try {
      let [world, dbMatches, dbStandings, userStateRes, transferMarket, gameBrainOverrides] = await Promise.all([
        apiGetWorld(),
        apiGetMatches(),
        apiGetStandings(),
        apiGetUserState(),
        apiGetTransferMarket(),
        apiGetGameBrainConfig(),
      ]);

      const isAdminUser = userStateRes?.user?.isAdmin ?? false;

      if (!world || (!userStateRes?.state && !isAdminUser)) {
        if (!world) {
          dispatch({
            type: 'ADD_NOTIFICATION',
            payload: {
              id: Date.now(),
              message: 'Game world not initialized yet. Ask the admin to seed the world.',
              type: 'error',
              timestamp: Date.now(),
            },
          });
        }
        dispatch({ type: 'INIT_GAME', payload: { ...initialState, initialized: true } });
        return;
      }

      const leagues = buildLeagues(world.leagues, dbMatches, dbStandings);
      const user    = buildUserProfile(userStateRes.user, userStateRes.state?.profileData || {});

      // ── Auto-seed transfer market ─
      // Trigger if admin OR if the market is completely empty (e.g. first time setup)
      if (isAdminUser || transferMarket.length === 0) {
        try {
          const worldState = await apiGetWorldState();
          const lastSeedMs = worldState?.lastMarketSeedDate?.toMillis?.()
            ?? worldState?.lastMarketSeedDate?.seconds * 1000
            ?? 0;
          const daysSinceSeed = (Date.now() - lastSeedMs) / 86_400_000;
          if (daysSinceSeed > 7 || transferMarket.length === 0) {
            await Promise.all([apiSeedFreeAgents(), apiSeedStaffMarket()]);
            await apiStampMarketSeedDate();
            // Refetch immediately so they appear on screen right away
            transferMarket = await apiGetTransferMarket();
          }
        } catch { /* non-fatal */ }
      }

      // ── Simulate any pending matches ────────────────────────────
      let simulatedLeagues = leagues;
      let processedMatchData = [];
      try {
        const allTeamsForSim = leagues.flatMap(l => l.teams || []);
        const fullSchedule   = leagues.flatMap(l => l.schedule || []);
        const simResult = processPendingMatches(allTeamsForSim, fullSchedule);
        processedMatchData = simResult.processedMatchData;

        // Apply Game Brain admin overrides to processed results
        if (gameBrainOverrides && processedMatchData.length > 0) {
          processedMatchData = processedMatchData.map(md => {
            const ov = gameBrainOverrides[md.matchId];
            if (!ov) return md;
            let { homeScore, awayScore } = md;
            if (ov.homeScore != null) homeScore = ov.homeScore;
            if (ov.awayScore != null) awayScore = ov.awayScore;
            if (ov.forceWinner === 'home' && homeScore <= awayScore) homeScore = awayScore + 5;
            if (ov.forceWinner === 'away' && awayScore <= homeScore) awayScore = homeScore + 5;
            return { ...md, homeScore, awayScore };
          });
          // Also update schedule with overridden scores
          processedMatchData.forEach(md => {
            const idx = simResult.updatedSchedule.findIndex(m => m.id === md.matchId);
            if (idx >= 0) {
              simResult.updatedSchedule[idx] = {
                ...simResult.updatedSchedule[idx],
                result: { homeScore: md.homeScore, awayScore: md.awayScore },
              };
            }
          });
        }

        // Persist results to Firebase: mark matches played + update standings
        for (const matchData of processedMatchData) {
          apiRecordMatchResult({
            matchId:       matchData.matchId,
            leagueId:      matchData.leagueId,
            homeTeamId:    matchData.homeTeamId,
            awayTeamId:    matchData.awayTeamId,
            homeTeamName:  matchData.homeTeamName,
            awayTeamName:  matchData.awayTeamName,
            homeScore:     matchData.homeScore,
            awayScore:     matchData.awayScore,
            log:           matchData.events,
            playerStats:   matchData.playerStats,
            quarterScores: matchData.quarterScores,
          }).catch(() => {});
        }

        simulatedLeagues = leagues.map(l => ({
          ...l,
          teams:    (l.teams    || []).map(t => simResult.updatedTeams.find(u => u.id === t.id) || t),
          schedule: simResult.updatedSchedule.filter(m => m.leagueId === l.id),
        }));
      } catch (simErr) {
        console.warn('Match simulation error (non-fatal):', simErr);
      }

      // ── Sunday fan growth ────────────────────────────────────────
      // Once per week (Sunday), apply fan growth based on enthusiasm + results.
      const now = Date.now();
      const thisWeekSunday = (() => {
        const d = new Date(now);
        const day = d.getDay(); // 0=Sun
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - day); // roll back to Sunday
        return d.getTime();
      })();
      const lastFanGrowth = userStateRes.state?.lastFanGrowthDate ?? 0;
      if (userStateRes.state && lastFanGrowth < thisWeekSunday) {
        const enthusiasm = userStateRes.state.fanEnthusiasm ?? 20;
        const history = userStateRes.state.matchHistory ?? [];
        const recentWins = history.slice(0, 5).filter(m =>
          m.result === 'W' || (m.teamScore ?? m.userScore ?? 0) > (m.oppScore ?? m.opponentScore ?? 0)
        ).length;
        const recentLosses = Math.min(5, history.slice(0, 5).length) - recentWins;
        const baseGrowth = Math.round((enthusiasm / 100) * 50 + (enthusiasm > 50 ? 20 : 0));
        const resultBonus = (recentWins - 2) * 8; // -16..+24 based on last 5
        // Seniority bonus: each week played adds 1% growth (max 50% bonus)
        const weeksPlayed = userStateRes.state.weeksPlayed ?? 0;
        const seniorityMult = Math.min(1 + weeksPlayed * 0.01, 1.5);
        const growth = Math.max(0, Math.round((baseGrowth + resultBonus) * seniorityMult));
        userStateRes.state.fanCount = (userStateRes.state.fanCount ?? 250) + growth;
        userStateRes.state.lastFanGrowthDate = now;
        userStateRes.state.weeksPlayed = weeksPlayed + 1;
        // Store fan growth info for display in Fans.jsx
        userStateRes.state.lastWeekFanGrowth = { growth, recentWins, recentLosses };
      }

      // ── Weekly training progression ──────────────────────────────
      // Once per week (Sunday), apply attribute gains based on training plan.
      const TRAINING_ATTR_MAP = {
        offensiveSchemes:  ['courtVision', 'passingAccuracy', 'basketballIQ'],
        defensiveDrills:   ['perimeterDefense', 'interiorDefense', 'helpDefense'],
        skillWorkShooting: ['threePtShooting', 'midRangeScoring', 'freeThrowShooting'],
        conditioning:      ['staminaEndurance', 'conditioningFitness', 'agilityLateralSpeed'],
        teamBuilding:      ['teamFirstAttitude', 'leadershipCommunication', 'handlePressureMental'],
        gymStrength:       ['verticalLeapingAbility', 'bodyControl', 'agilityLateralSpeed'],
      };
      const lastTrainingApplied = userStateRes.state?.lastTrainingApplied ?? 0;
      if (userStateRes.state && lastTrainingApplied < thisWeekSunday) {
        const trainingPlan  = userStateRes.state.profileData?.training ?? {};
        const focusPlayers  = trainingPlan.focusPlayers ?? [];
        const players       = userStateRes.state.playersState ?? [];
        const trainingHighlights = [];
        userStateRes.state.playersState = players.map(p => {
          // Injured players don't develop this week
          if (p.injuryStatus && p.injuryStatus !== 'healthy') return p;
          const isFocus   = focusPlayers.includes(p.id);
          const newAttrs  = { ...(p.attributes || {}) };
          let topGainKey  = null;
          let topGainVal  = 0;

          for (const [area, keys] of Object.entries(TRAINING_ATTR_MAP)) {
            const pts      = trainingPlan[area] ?? 0;
            if (pts <= 0) continue;
            // base gain: up to ~0.6 per attribute at max 40 pts; focus doubles it
            const baseGain = (pts / 100) * 1.5;
            const gain     = isFocus ? baseGain * 2 : baseGain;
            keys.forEach(k => {
              if (newAttrs[k] != null) {
                newAttrs[k] = Math.min(99, newAttrs[k] + gain);
                if (gain > topGainVal) { topGainVal = gain; topGainKey = k; }
              }
            });
          }

          // Training Brain: track streak and apply breakthrough
          const prevKey     = p.trainingStreakKey ?? null;
          const prevStreak  = p.trainingStreak    ?? 0;
          const newStreakKey = topGainKey;
          const newStreak   = newStreakKey === prevKey ? prevStreak + 1 : (topGainKey ? 1 : 0);

          // Breakthrough: 3+ weeks on same attribute → +0.5 bonus
          if (newStreak >= 3 && topGainKey && newAttrs[topGainKey] != null) {
            newAttrs[topGainKey] = Math.min(99, newAttrs[topGainKey] + 0.5);
            trainingHighlights.push(`${p.name} hit a breakthrough week in ${topGainKey.replace(/([A-Z])/g, ' $1').toLowerCase()}!`);
          }

          // Focus player: 20% chance of +1 on best attribute
          if (isFocus && topGainKey && Math.random() < 0.2 && newAttrs[topGainKey] != null) {
            newAttrs[topGainKey] = Math.min(99, newAttrs[topGainKey] + 1);
            trainingHighlights.push(`${p.name} had a standout focus session this week!`);
          }

          return {
            ...p,
            attributes:       newAttrs,
            trainingStreak:   newStreak,
            trainingStreakKey: newStreakKey,
          };
        });
        userStateRes.state.lastTrainingApplied = now;
        if (trainingHighlights.length > 0) {
          userStateRes.state.trainingHighlights = trainingHighlights;
        }
      }

      const userTeam = buildUserTeam(simulatedLeagues, userStateRes.state);

      if (!userTeam && !user.isAdmin) {
        dispatch({ type: 'INIT_GAME', payload: { ...initialState, initialized: true } });
        return;
      }

      if (userTeam && processedMatchData.length > 0) {
        const updatedUserTeam = simulatedLeagues
          .flatMap(l => l.teams || [])
          .find(t => t.id === userTeam.id);
        if (updatedUserTeam) {
          if (updatedUserTeam.matchHistory?.length) {
            userTeam.matchHistory = updatedUserTeam.matchHistory;
          }
          if (updatedUserTeam.seasonRecord) {
            userTeam.seasonRecord = updatedUserTeam.seasonRecord;
            userTeam.wins   = userTeam.seasonRecord.wins   ?? 0;
            userTeam.losses = userTeam.seasonRecord.losses ?? 0;
          }
          // Propagate updated player seasonStats from simulation back to userTeam
          if (updatedUserTeam.players?.length) {
            const simPlayerMap = Object.fromEntries(updatedUserTeam.players.map(p => [p.id, p]));
            userTeam.players = userTeam.players.map(p =>
              simPlayerMap[p.id]
                ? { ...p, seasonStats: simPlayerMap[p.id].seasonStats ?? p.seasonStats }
                : p
            );
          }
        }
      }

      const updatedLeagues = simulatedLeagues.map(l => ({
        ...l,
        teams: (l.teams || []).map(t => userTeam && t.id === userTeam.id ? userTeam : t),
      }));

      justLoaded.current = true;
      dispatch({
        type: 'INIT_GAME',
        payload: {
          user,
          userTeam,
          leagues: updatedLeagues,
          allTeams: updatedLeagues.flatMap(l => l.teams || []),
          transferMarket: transferMarket || [],
          lastUpdated: Date.now(),
        },
      });
    } catch {
      dispatch({ type: 'INIT_GAME', payload: { ...initialState, initialized: true } });
    }
  }, []);

  // ── React to Firebase Auth state changes ─────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        dispatch({ type: 'INIT_GAME', payload: { ...initialState, initialized: true } });
        return;
      }
      loadGameData();
    });
    return () => unsubscribe();
  }, [loadGameData]);

  // ── Poll every 3 minutes for real-time match results ──────────
  useEffect(() => {
    if (!state.initialized || !state.user) return;
    const interval = setInterval(loadGameData, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [state.initialized, state.user?.id, loadGameData]);

  // ── Auto-save per-user state on change ──────────────────────
  useEffect(() => {
    if (!state.initialized || !state.user || !state.userTeam) return;
    if (!auth.currentUser) return;
    if (justLoaded.current) { justLoaded.current = false; return; }

    const payload = extractUserState(state);
    if (payload) apiSaveUserState(payload);
  }, [state.user, state.userTeam, state.lastUpdated]);

  const addNotification = useCallback((msg, type = 'info') => {
    const note = { id: Date.now() + Math.random(), message: msg, type, timestamp: Date.now() };
    dispatch({ type: 'ADD_NOTIFICATION', payload: note });
    setTimeout(() => dispatch({ type: 'CLEAR_NOTIFICATION', payload: note.id }), 5000);
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    dispatch({ type: 'INIT_GAME', payload: { ...initialState, initialized: true } });
  }, []);

  return (
    <GameContext.Provider value={{ state, dispatch, addNotification, logout }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
