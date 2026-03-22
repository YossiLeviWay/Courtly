import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import {
  getToken, clearToken,
  apiGetWorld, apiGetMatches, apiGetStandings, apiGetUserState,
  apiSaveUserState,
} from '../api.js';

// ── Build game state from structured DB rows ───────────────────

function buildLeagues(worldLeagues, dbMatches, dbStandings) {
  // Build a team_id → team_name map from the DB (authoritative, reflects user renames)
  const dbNameMap = {};
  dbStandings.forEach(s => { if (s.team_id) dbNameMap[s.team_id] = s.team_name; });

  return worldLeagues.map(league => {
    const schedule = dbMatches
      .filter(m => m.league_id === league.id)
      .map(m => ({
        id: m.id,
        homeTeamId: m.home_team_id,
        awayTeamId: m.away_team_id,
        homeTeamName: m.home_team_name,
        awayTeamName: m.away_team_name,
        scheduledDate: Number(m.scheduled_date),
        played: m.played,
        result: m.played ? { homeScore: m.home_score, awayScore: m.away_score } : null,
        log: m.log || [],
      }));

    const standings = dbStandings
      .filter(s => s.league_id === league.id)
      .map(s => ({ teamId: s.team_id, teamName: s.team_name, wins: Number(s.wins), losses: Number(s.losses), points: Number(s.points) }));

    const finalStandings = standings.length > 0
      ? standings
      : (league.teams || []).map(t => ({ teamId: t.id, teamName: dbNameMap[t.id] || t.name, wins: 0, losses: 0, points: 0 }));

    // Apply DB team names to every team so the league table always reads from world_standings
    const teams = (league.teams || []).map(t => ({
      ...t,
      name: dbNameMap[t.id] || t.name,
    }));

    return { ...league, teams, schedule, standings: finalStandings };
  });
}

function buildUserTeam(leagues, userState) {
  // leagues is the already-built array (with DB names applied)
  const allTeams = leagues.flatMap(l => l.teams || []);
  const baseTeam = allTeams.find(t => t.id === userState.team_id);
  if (!baseTeam) return null;

  const profileData = userState.profile_data || {};
  const evolvedPlayers = Array.isArray(userState.players_state) && userState.players_state.length > 0
    ? userState.players_state
    : (baseTeam.players || []);

  // Attach user's fixture schedule so Dashboard/Calendar can show upcoming matches
  const userLeague = leagues.find(l => l.teams?.some(t => t.id === userState.team_id));
  const seasonMatches = (userLeague?.schedule || [])
    .filter(m => m.homeTeamId === userState.team_id || m.awayTeamId === userState.team_id)
    .map(m => ({
      ...m,
      date: m.scheduledDate,                // Dashboard uses m.date
      isHome: m.homeTeamId === userState.team_id,
      opponentName: m.homeTeamId === userState.team_id ? m.awayTeamName : m.homeTeamName,
      opponentId: m.homeTeamId === userState.team_id ? m.awayTeamId : m.homeTeamId,
    }));

  return {
    ...baseTeam,
    // Apply user's custom team/stadium names if set
    name: profileData.teamName?.trim() || baseTeam.name,
    stadiumName: profileData.stadiumName?.trim() || baseTeam.stadiumName,
    isUserTeam: true,
    players: evolvedPlayers,
    seasonMatches,
    budget: userState.budget ?? 250,
    facilities: userState.facilities ?? {},
    tactics: userState.tactics ?? {},
    training: profileData.training ?? {},
    fanCount: userState.fan_count ?? 250,
    fanEnthusiasm: userState.fan_enthusiasm ?? 20,
    ticketPrice: userState.ticket_price ?? 20,
    teamExposure: userState.team_exposure ?? 0,
    chemistryGauge: userState.chemistry_gauge ?? 50,
    momentumBar: userState.momentum_bar ?? 65,
    reputation: userState.reputation ?? 10,
    matchHistory: userState.match_history ?? [],
    wins: userState.season_record?.wins ?? 0,
    losses: userState.season_record?.losses ?? 0,
  };
}

function buildUserProfile(dbUser, profileData) {
  return {
    id: dbUser?.id,
    username: dbUser?.username || '',
    email: dbUser?.email || '',
    bio: profileData?.bio || '',
    gender: profileData?.gender || '',
    avatar: profileData?.avatar || { type: 'initials', emoji: null },
    settingsChangesToday: profileData?.settingsChangesToday || 0,
    lastSettingsChange: profileData?.lastSettingsChange || null,
    joinedAt: dbUser?.created_at || Date.now(),
    records: profileData?.records || { wins: 0, losses: 0, honors: [] },
  };
}

function extractUserState(state) {
  const t = state.userTeam;
  if (!t) return null;
  return {
    teamId: t.id,
    budget: t.budget ?? 250,
    facilities: t.facilities ?? {},
    tactics: t.tactics ?? {},
    playersState: t.players ?? [],
    fanCount: t.fanCount ?? 250,
    fanEnthusiasm: t.fanEnthusiasm ?? 20,
    ticketPrice: t.ticketPrice ?? 20,
    teamExposure: t.teamExposure ?? 0,
    chemistryGauge: t.chemistryGauge ?? 50,
    momentumBar: t.momentumBar ?? 65,
    reputation: t.reputation ?? 10,
    matchHistory: t.matchHistory ?? [],
    seasonRecord: { wins: t.wins ?? 0, losses: t.losses ?? 0 },
    profileData: {
      bio: state.user?.bio || '',
      gender: state.user?.gender || '',
      avatar: state.user?.avatar || { type: 'initials', emoji: null },
      settingsChangesToday: state.user?.settingsChangesToday || 0,
      lastSettingsChange: state.user?.lastSettingsChange || null,
      records: state.user?.records || { wins: 0, losses: 0, honors: [] },
      teamName: state.userTeam?.name || '',
      stadiumName: state.userTeam?.stadiumName || '',
      training: state.userTeam?.training ?? {},
    },
  };
}

// ── Context setup ──────────────────────────────────────────────

const GameContext = createContext(null);

const initialState = {
  user: null,
  userTeam: null,
  leagues: null,
  allTeams: [],
  transferMarket: [],
  currentMatch: null,
  isMatchLive: false,
  notifications: [],
  lastUpdated: null,
  initialized: false,
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

  // ── Load from structured DB tables on mount ─────────────────
  useEffect(() => {
    const token = getToken();
    if (!token) {
      dispatch({ type: 'INIT_GAME', payload: { ...initialState, initialized: true } });
      return;
    }

    Promise.all([
      apiGetWorld(),        // { leagues } — teams + players + staff (shared, static)
      apiGetMatches(),      // world_matches rows (shared, dynamic)
      apiGetStandings(),    // world_standings rows (shared, dynamic)
      apiGetUserState(),    // { state, user } (per-user)
    ]).then(([world, dbMatches, dbStandings, userStateRes]) => {
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
        clearToken();
        dispatch({ type: 'INIT_GAME', payload: { ...initialState, initialized: true } });
        return;
      }

      const leagues = buildLeagues(world.leagues, dbMatches, dbStandings);
      const userTeam = buildUserTeam(leagues, userStateRes.state);
      const user = buildUserProfile(
        { ...userStateRes.user, id: userStateRes.state.user_id },
        userStateRes.state.profile_data || {}
      );

      if (!userTeam) {
        clearToken();
        dispatch({ type: 'INIT_GAME', payload: { ...initialState, initialized: true } });
        return;
      }

      const updatedLeagues = leagues.map(l => ({
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
          lastUpdated: Date.now(),
        },
      });
    }).catch(() => {
      clearToken();
      dispatch({ type: 'INIT_GAME', payload: { ...initialState, initialized: true } });
    });
  }, []);

  // ── Auto-save per-user state on change ──────────────────────
  useEffect(() => {
    if (!state.initialized || !state.user || !state.userTeam) return;
    if (!getToken()) return;
    if (justLoaded.current) { justLoaded.current = false; return; }

    const payload = extractUserState(state);
    if (payload) apiSaveUserState(payload);
  }, [state.user, state.userTeam, state.lastUpdated]);

  const addNotification = useCallback((msg, type = 'info') => {
    const note = { id: Date.now() + Math.random(), message: msg, type, timestamp: Date.now() };
    dispatch({ type: 'ADD_NOTIFICATION', payload: note });
    setTimeout(() => dispatch({ type: 'CLEAR_NOTIFICATION', payload: note.id }), 5000);
  }, []);

  const logout = useCallback(() => {
    clearToken();
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
