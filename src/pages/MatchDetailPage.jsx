import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext.jsx';
import MatchDetailModal from '../components/MatchDetailModal.jsx';

export default function MatchDetailPage() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { state } = useGame();

  // Scroll to top on mount
  useEffect(() => { window.scrollTo(0, 0); }, []);

  // Find the match across all league schedules
  const match = (state.leagues || [])
    .flatMap(lg => lg.schedule || [])
    .find(m => m.id === matchId);

  if (!match) {
    return (
      <div className="page-content animate-fade-in">
        <button
          onClick={() => navigate('/fixtures')}
          style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer', fontSize: 'var(--font-size-sm)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          ← Back to Fixtures
        </button>
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">Match not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content animate-fade-in">
      <MatchDetailModal
        match={match}
        allTeams={state.allTeams}
        userTeamId={state.userTeam?.id}
        onClose={() => navigate('/fixtures')}
        asPage={true}
      />
    </div>
  );
}
