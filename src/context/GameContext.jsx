import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { generateTeam, generateLeagues } from '../engine/teamGenerator.js';
import { getToken, clearToken, apiSaveGame, apiLoadGame, apiGetWorld } from '../api.js';

// ── Firestore serialization ────────────────────────────────────
// We save: user + userTeam (full) + botTeamShells (id/name/etc., no players)
// + leaguesMeta (standings + schedule). Total ~40 KB, well under Firestore's 1 MB.
// On load, bot players/staff are regenerated fresh but identity fields (id, name,
// colors…) are restored from the shell — so schedule and standings IDs stay valid.

const BOT_SHELL_FIELDS = ['id','name','nickname','city','country','region',
  'stadiumName','founded','colors','league','leagueIndex','leagueId'];

function serializeForFirestore(state) {
  const botTeamShells = (state.allTeams || [])
    .filter(t => !t.isUserTeam)
    .map(t => Object.fromEntries(BOT_SHELL_FIELDS.map(k => [k, t[k]])));

  return {
    user: state.user,
    userTeam: state.userTeam,
    botTeamShells,
    leaguesMeta: (state.leagues || []).map(l => ({
      id: l.id,
      name: l.name,
      tier: l.tier,
      groupIndex: l.groupIndex,
      standings: l.standings || [],
      schedule: l.schedule || [],
    })),
    lastUpdated: state.lastUpdated,
  };
}

// worldTeams: full bot teams from the shared world_data table (optional).
// When provided, bot teams use those consistent names/players instead of
// regenerating randomly — making every user see the same world.
function deserializeFromFirestore(savedData, worldTeams = []) {
  const { user, userTeam, botTeamShells = [], leaguesMeta = [], lastUpdated } = savedData;

  let botTeams;
  if (worldTeams.length > 0) {
    // Use the shared world: take bot teams from world_data and overlay any
    // shell fields that may have changed (e.g. if the user renamed a rival team).
    botTeams = worldTeams
      .filter(t => t.id !== userTeam?.id)
      .map(wt => {
        const shell = botTeamShells.find(s => s.id === wt.id);
        return shell ? { ...wt, ...shell } : wt;
      });
  } else {
    // Legacy fallback: regenerate from shells (random each time)
    botTeams = botTeamShells.map(shell =>
      Object.assign(generateTeam({ leagueIndex: shell.leagueIndex, isUserTeam: false }), shell)
    );
  }

  const userLeagueIndex = userTeam?.leagueIndex ?? 0;

  // If no shells saved yet (old save format), fall back to full regeneration
  const useShells = botTeamShells.length > 0 || worldTeams.length > 0;

  const freshLeagues = useShells ? null : generateLeagues();

  const leagues = (leaguesMeta.length > 0 ? leaguesMeta : (freshLeagues || [])).map((meta, i) => {
    const groupIndex = meta.groupIndex ?? i;
    const leagueBotTeams = botTeams.filter(t => t.leagueIndex === groupIndex);
    let teams = useShells ? leagueBotTeams : (freshLeagues[i]?.teams || []);

    if (groupIndex === userLeagueIndex && userTeam) {
      teams = [userTeam, ...teams.filter(t => t.id !== userTeam.id)];
    }

    return {
      id: meta.id || `liga-c-${groupIndex}`,
      name: meta.name || `Liga C – Group ${groupIndex + 1}`,
      tier: meta.tier || 'C',
      groupIndex,
      teams,
      standings: meta.standings?.length ? meta.standings : teams.map(t => ({ teamId: t.id, teamName: t.name, wins: 0, losses: 0, points: 0 })),
      schedule: meta.schedule || [],
    };
  });

  return {
    user,
    userTeam,
    leagues,
    allTeams: leagues.flatMap(l => l.teams || []),
    lastUpdated,
  };
}

const GameContext = createContext(null);

const initialState = {
  user: null,
  userTeam: null,
  leagues: null,
  allTeams: [],
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
    case 'UPDATE_TEAM':
      return {
        ...state,
        userTeam: action.payload,
        allTeams: state.allTeams.map(t => t.id === action.payload.id ? action.payload : t),
        lastUpdated: Date.now(),
      };
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
    case 'SET_MATCH_LIVE':
      return { ...state, currentMatch: action.payload, isMatchLive: true };
    case 'END_MATCH':
      return { ...state, currentMatch: null, isMatchLive: false };
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [action.payload, ...state.notifications].slice(0, 50),
      };
    case 'CLEAR_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload),
      };
    case 'UPDATE_LEAGUES':
      return { ...state, leagues: action.payload, lastUpdated: Date.now() };
    default:
      return state;
  }
}

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  // Track whether state was loaded from Firestore vs. locally dispatched
  const justLoaded = useRef(false);

  // On mount: load saved game state AND the shared world in parallel.
  // The world provides consistent bot team names/players for every user.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      dispatch({ type: 'INIT_GAME', payload: { ...initialState, initialized: true } });
      return;
    }
    Promise.all([apiLoadGame(), apiGetWorld()])
      .then(([savedData, worldData]) => {
        if (savedData) {
          justLoaded.current = true;
          const worldTeams = worldData?.leagues?.flatMap(l => l.teams || []) ?? [];
          const fullState = deserializeFromFirestore(savedData, worldTeams);
          dispatch({ type: 'INIT_GAME', payload: fullState });
        } else {
          // Token exists but no game data — clear and show login
          clearToken();
          dispatch({ type: 'INIT_GAME', payload: { ...initialState, initialized: true } });
        }
      })
      .catch(() => {
        clearToken();
        dispatch({ type: 'INIT_GAME', payload: { ...initialState, initialized: true } });
      });
  }, []);

  // Auto-save to Postgres whenever game state changes — skip the load-triggered save
  useEffect(() => {
    if (!state.initialized || !state.user) return;
    if (!getToken()) return;

    if (justLoaded.current) {
      justLoaded.current = false;
      return;
    }

    apiSaveGame(serializeForFirestore(state));
  }, [state.user, state.userTeam, state.leagues, state.allTeams, state.lastUpdated]);

  const addNotification = useCallback((msg, type = 'info') => {
    const note = { id: Date.now() + Math.random(), message: msg, type, timestamp: Date.now() };
    dispatch({ type: 'ADD_NOTIFICATION', payload: note });
    setTimeout(() => dispatch({ type: 'CLEAR_NOTIFICATION', payload: note.id }), 5000);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    dispatch({ type: 'INIT_GAME', payload: { ...initialState, initialized: true } });
  }, []);

  const value = { state, dispatch, addNotification, logout };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
