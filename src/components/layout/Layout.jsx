import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Header from './Header.jsx';
import ToastContainer from '../ui/ToastContainer.jsx';
import { useGame } from '../../context/GameContext.jsx';

export default function Layout() {
  const { state } = useGame();
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-main">
        <Header />
        <main className="page-content animate-fade-in">
          <Outlet />
        </main>
      </div>
      <ToastContainer notifications={state.notifications} />
    </div>
  );
}
