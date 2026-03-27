import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase.js';
import {
  apiGetWorld, apiGetMatches, apiGetStandings, apiGetUserState,
  apiGetTransferMarket, apiSaveUserState, apiSaveMatchLog,
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
    reputation:     userState.reputation     ?? 10,
    matchHistory:   userState.matchHistory   ?? [],
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
    reputation:     t.reputation     ?? 10,
    matchHistory:   t.matchHistory   ?? [],
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
    default:
      return state;
  }
}

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const justLoaded = useRef(false);

  // ── React to Firebase Auth state changes ─────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        dispatch({ type: 'INIT_GAME', payload: { ...initialState, initialized: true } });
        return;
      }

      Promise.all([
        apiGetWorld(),
        apiGetMatches(),
        apiGetStandings(),
        apiGetUserState(),
        apiGetTransferMarket(),
      ]).then(([world, dbMatches, dbStandings, userStateRes, transferMarket]) => {
        if (!world || !userStateRes?.state) {
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

        const leagues  = buildLeagues(world.leagues, dbMatches, dbStandings);
        const user     = buildUserProfile(userStateRes.user, userStateRes.state.profileData || {});

        // ── Simulate any pending matches ──────────────────────────
        let simulatedLeagues = leagues;
        let processedMatchData = [];
        try {
          const allTeamsForSim = leagues.flatMap(l => l.teams || []);
          const fullSchedule   = leagues.flatMap(l => l.schedule || []);
          const simResult = processPendingMatches(allTeamsForSim, fullSchedule);
          processedMatchData = simResult.processedMatchData;

          // Save match logs to Firebase in the background (non-blocking)
          for (const matchData of processedMatchData) {
            apiSaveMatchLog(matchData.matchId, matchData).catch(() => {});
          }

          // Rebuild leagues with updated teams + schedule
          simulatedLeagues = leagues.map(l => ({
            ...l,
            teams:    (l.teams    || []).map(t => simResult.updatedTeams.find(u => u.id === t.id) || t),
            schedule: simResult.updatedSchedule.filter(m => m.leagueId === l.id),
          }));
        } catch (simErr) {
          console.warn('Match simulation error (non-fatal):', simErr);
        }

        const userTeam = buildUserTeam(simulatedLeagues, userStateRes.state);

        if (!userTeam) {
          dispatch({ type: 'INIT_GAME', payload: { ...initialState, initialized: true } });
          return;
        }

        // Merge any new matchHistory from simulation into userTeam.
        // buildUserTeam() uses userState.matchHistory (Firestore) which doesn't yet contain
        // the freshly simulated matches, so we pull them from the updated simulatedLeagues.
        if (processedMatchData.length > 0) {
          const updatedUserTeam = simulatedLeagues
            .flatMap(l => l.teams || [])
            .find(t => t.id === userTeam.id);
          if (updatedUserTeam?.matchHistory?.length) {
            userTeam.matchHistory = updatedUserTeam.matchHistory;
            userTeam.seasonRecord = updatedUserTeam.seasonRecord || userTeam.seasonRecord;
            userTeam.wins   = userTeam.seasonRecord?.wins   ?? 0;
            userTeam.losses = userTeam.seasonRecord?.losses ?? 0;
          }
        }

        const updatedLeagues = simulatedLeagues.map(l => ({
          ...l,
          teams: (l.teams || []).map(t => t.id === userTeam.id ? userTeam : t),
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
      }).catch(() => {
        dispatch({ type: 'INIT_GAME', payload: { ...initialState, initialized: true } });
      });
    });

    return () => unsubscribe();
  }, []);

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
