import { useGame } from '../../context/GameContext.jsx';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

const ICONS = { success: CheckCircle, error: AlertCircle, info: Info };

export default function ToastContainer({ notifications = [] }) {
  const { dispatch } = useGame();

  if (!notifications.length) return null;

  return (
    <div className="toast-container">
      {notifications.slice(0, 4).map(n => {
        const Icon = ICONS[n.type] || Info;
        const colors = { success: '#2E7D32', error: '#C62828', info: '#E8621A' };
        return (
          <div key={n.id} className={`toast ${n.type}`}>
            <Icon size={18} color={colors[n.type] || colors.info} />
            <span className="flex-1">{n.message}</span>
            <button
              onClick={() => dispatch({ type: 'CLEAR_NOTIFICATION', payload: n.id })}
              style={{ padding: 2, opacity: 0.6 }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
