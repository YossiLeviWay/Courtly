import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { auth, db } from '../firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

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

  // Listen to Firebase auth state and load game state from Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, 'gameStates', firebaseUser.uid));
          if (snap.exists()) {
            dispatch({ type: 'INIT_GAME', payload: snap.data() });
          } else {
            dispatch({ type: 'INIT_GAME', payload: { initialized: true } });
          }
        } catch {
          dispatch({ type: 'INIT_GAME', payload: { initialized: true } });
        }
      } else {
        dispatch({ type: 'INIT_GAME', payload: { ...initialState, initialized: true } });
      }
    });
    return unsubscribe;
  }, []);

  // Save to Firestore whenever game state changes
  useEffect(() => {
    if (!state.initialized || !state.user) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const toSave = {
      user: state.user,
      userTeam: state.userTeam,
      leagues: state.leagues,
      allTeams: state.allTeams,
      lastUpdated: state.lastUpdated,
    };

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
