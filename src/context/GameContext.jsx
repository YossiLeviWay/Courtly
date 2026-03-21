import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { auth, db } from '../firebase.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { generateLeagues } from '../engine/teamGenerator.js';

// ── Firestore serialization ────────────────────────────────────
// Save only user + userTeam + league standings/schedule to stay under 1 MB.
// Bot team rosters are regenerated from teamGenerator on load.
function serializeForFirestore(state) {
  return {
    user: state.user,
    userTeam: state.userTeam,
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
  const { user, userTeam, leaguesMeta = [], lastUpdated } = savedData;
  const freshLeagues = generateLeagues();
  const userLeagueIndex = userTeam?.leagueIndex ?? 0;

  const leagues = freshLeagues.map((league, i) => {
    const meta = leaguesMeta.find(m => m.groupIndex === i) || {};
    let teams = league.teams;
    if (i === userLeagueIndex && userTeam) {
      // Put the user's saved team at slot 0 in their league
      teams = [userTeam, ...league.teams.slice(1)];
    }
    return {
      ...league,
      teams,
      standings: meta.standings?.length ? meta.standings : league.standings,
      schedule: meta.schedule?.length ? meta.schedule : league.schedule,
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
