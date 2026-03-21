import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { auth, db } from '../firebase.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { generateTeam, generateLeagues } from '../engine/teamGenerator.js';

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

function deserializeFromFirestore(savedData) {
  const { user, userTeam, botTeamShells = [], leaguesMeta = [], lastUpdated } = savedData;

  // Rebuild each bot team: fresh players/staff + saved identity (preserves IDs)
  const botTeams = botTeamShells.map(shell =>
    Object.assign(generateTeam({ leagueIndex: shell.leagueIndex, isUserTeam: false }), shell)
  );

  const userLeagueIndex = userTeam?.leagueIndex ?? 0;

  // If no shells saved yet (old save format), fall back to full regeneration
  const useShells = botTeamShells.length > 0;

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

  // Listen to Firebase auth state and load game state from Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, 'gameStates', firebaseUser.uid));
          if (snap.exists()) {
            justLoaded.current = true;
            const fullState = deserializeFromFirestore(snap.data());
            dispatch({ type: 'INIT_GAME', payload: fullState });
          } else {
            // Check if this is a brand-new registration (< 30s) — if so, wait for
            // Login.jsx to write the doc; don't sign out mid-registration.
            const createdAt = new Date(firebaseUser.metadata.creationTime).getTime();
            if (Date.now() - createdAt < 30000) {
              // New account — Login.jsx will dispatch INIT_GAME after setDoc
              dispatch({ type: 'INIT_GAME', payload: { ...initialState, initialized: true } });
              return;
            }
            // Authenticated but no game data — sign out so user can re-register
            await signOut(auth);
            const note = { id: Date.now() + Math.random(), message: 'No account data found. Please register to create your club.', type: 'error', timestamp: Date.now() };
            dispatch({ type: 'ADD_NOTIFICATION', payload: note });
            setTimeout(() => dispatch({ type: 'CLEAR_NOTIFICATION', payload: note.id }), 6000);
            dispatch({ type: 'INIT_GAME', payload: { ...initialState, initialized: true } });
          }
        } catch (err) {
          console.error('Firestore load failed:', err.code, err.message);
          dispatch({ type: 'INIT_GAME', payload: { ...initialState, initialized: true } });
        }
      } else {
        dispatch({ type: 'INIT_GAME', payload: { ...initialState, initialized: true } });
      }
    });
    return unsubscribe;
  }, []);

  // Save to Firestore whenever game state changes — skip the load-triggered save
  useEffect(() => {
    if (!state.initialized || !state.user) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    // Skip the save immediately following a Firestore load (no changes were made)
    if (justLoaded.current) {
      justLoaded.current = false;
      return;
    }

    const toSave = serializeForFirestore(state);

    setDoc(doc(db, 'gameStates', uid), toSave).catch((err) => {
      console.error('Firestore save failed:', err.code, err.message);
    });
  }, [state.user, state.userTeam, state.leagues, state.allTeams, state.lastUpdated]);

  const addNotification = useCallback((msg, type = 'info') => {
    const note = { id: Date.now() + Math.random(), message: msg, type, timestamp: Date.now() };
    dispatch({ type: 'ADD_NOTIFICATION', payload: note });
    setTimeout(() => dispatch({ type: 'CLEAR_NOTIFICATION', payload: note.id }), 5000);
  }, []);

  const value = { state, dispatch, addNotification };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
