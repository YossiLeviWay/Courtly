import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useGame } from './context/GameContext.jsx';
import Layout from './components/layout/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Squad from './pages/Squad.jsx';
import PlayerProfile from './pages/PlayerProfile.jsx';
import Tactics from './pages/Tactics.jsx';
import Staff from './pages/Staff.jsx';
import Training from './pages/Training.jsx';
import Facilities from './pages/Facilities.jsx';
import Fans from './pages/Fans.jsx';
import Calendar from './pages/Calendar.jsx';
import League from './pages/League.jsx';
import Transfer from './pages/Transfer.jsx';
import TeamInfo from './pages/TeamInfo.jsx';
import Settings from './pages/Settings.jsx';
import Profile from './pages/Profile.jsx';
import LiveMatch from './pages/LiveMatch.jsx';

function ProtectedRoute({ children }) {
  const { state } = useGame();
  if (!state.initialized) return (
    <div className="loading-screen">
      <svg className="loading-ball" viewBox="0 0 64 64" width="64" height="64">
        <circle cx="32" cy="32" r="30" fill="#E8621A"/>
        <path d="M32 2 Q50 18 32 32 Q14 46 32 62" stroke="#C04E10" strokeWidth="2.5" fill="none"/>
        <path d="M2 32 Q18 14 32 32 Q46 50 62 32" stroke="#C04E10" strokeWidth="2.5" fill="none"/>
      </svg>
      <p style={{color:'var(--text-muted)', fontWeight:600}}>Loading Courtly...</p>
    </div>
  );
  if (!state.user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="squad" element={<Squad />} />
          <Route path="squad/:playerId" element={<PlayerProfile />} />
          <Route path="tactics" element={<Tactics />} />
          <Route path="staff" element={<Staff />} />
          <Route path="training" element={<Training />} />
          <Route path="facilities" element={<Facilities />} />
          <Route path="fans" element={<Fans />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="league" element={<League />} />
          <Route path="transfer" element={<Transfer />} />
          <Route path="team" element={<TeamInfo />} />
          <Route path="settings" element={<Settings />} />
          <Route path="profile" element={<Profile />} />
          <Route path="match/live" element={<LiveMatch />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
