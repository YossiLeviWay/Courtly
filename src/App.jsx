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
import Fixtures from './pages/Fixtures.jsx';
import League from './pages/League.jsx';
import Transfer from './pages/Transfer.jsx';
import TeamInfo from './pages/TeamInfo.jsx';
import Settings from './pages/Settings.jsx';
import Profile from './pages/Profile.jsx';
import LiveMatch from './pages/LiveMatch.jsx';
import FinancialReport from './pages/FinancialReport.jsx';
import SearchPage from './pages/Search.jsx';
import YouthAcademy from './pages/YouthAcademy.jsx';
import Scouts from './pages/Scouts.jsx';
import Admin from './pages/Admin.jsx';
import SetupAdmin from './pages/SetupAdmin.jsx';
import MatchDetailPage from './pages/MatchDetailPage.jsx';

function ProtectedRoute({ children }) {
  const { state } = useGame();

  if (!state.initialized) return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh',
      background: 'var(--bg-app, #fff)', gap: 16,
    }}>
      <svg viewBox="0 0 64 64" width="64" height="64" style={{ animation: 'spin 1s linear infinite' }}>
        <circle cx="32" cy="32" r="30" fill="#E8621A"/>
        <path d="M32 2 Q50 18 32 32 Q14 46 32 62" stroke="#C04E10" strokeWidth="2.5" fill="none"/>
        <path d="M2 32 Q18 14 32 32 Q46 50 62 32" stroke="#C04E10" strokeWidth="2.5" fill="none"/>
      </svg>
      <p style={{ color: '#888', fontWeight: 600, margin: 0 }}>Loading Courtly...</p>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!state.user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter basename="/Courtly">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/setup-admin" element={<SetupAdmin />} />
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
          <Route path="fixtures" element={<Fixtures />} />
          <Route path="calendar" element={<Fixtures />} />
          <Route path="league" element={<League />} />
          <Route path="transfer" element={<Transfer />} />
          <Route path="team" element={<TeamInfo />} />
          <Route path="settings" element={<Settings />} />
          <Route path="profile" element={<Profile />} />
          <Route path="match/live" element={<LiveMatch />} />
          <Route path="match/:matchId" element={<MatchDetailPage />} />
          <Route path="finances" element={<FinancialReport />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="youth-academy" element={<ProtectedRoute><YouthAcademy /></ProtectedRoute>} />
          <Route path="scouts" element={<ProtectedRoute><Scouts /></ProtectedRoute>} />
          <Route path="admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
