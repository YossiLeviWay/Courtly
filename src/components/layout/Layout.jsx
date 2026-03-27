import { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Header from './Header.jsx';
import ToastContainer from '../ui/ToastContainer.jsx';
import { useGame } from '../../context/GameContext.jsx';

export default function Layout() {
  const { state } = useGame();
  const location  = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar  = useCallback(() => setSidebarOpen(v => !v), []);
  const closeSidebar   = useCallback(() => setSidebarOpen(false), []);

  // Close sidebar on route change (mobile UX)
  useEffect(() => { closeSidebar(); }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      {/* Overlay that closes sidebar on mobile tap */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar} aria-hidden="true" />
      )}
      <div className="app-main">
        <Header onMenuToggle={toggleSidebar} />
        <main className="page-content animate-fade-in">
          <Outlet />
        </main>
      </div>
      <ToastContainer notifications={state.notifications} />
    </div>
  );
}
