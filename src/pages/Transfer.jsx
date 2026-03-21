import { useState, useMemo } from 'react';
import { useGame } from '../context/GameContext.jsx';
import { ArrowLeftRight, Search, Filter, Clock, DollarSign, X, Eye } from 'lucide-react';
import PlayerAvatar from '../components/ui/PlayerAvatar.jsx';

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

function formatPrice(n) { return `$${Number(n).toLocaleString()}`; }

function PlayerCard({ player, team, onBuy, onView, timeLeft, userTeamId, onRemove }) {
  const isOwn = team?.id === userTeamId;
  const overallRating = Math.round(Object.values(player.attributes || {}).reduce((a,b) => a+b, 0) / 30) || 50;
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div className="flex items-center gap-3 mb-3">
        <PlayerAvatar player={player} size="md" />
        <div className="flex-1">
          <div className="font-semibold">{player.name}</div>
          <div className="flex items-center gap-2">
            <span className="player-position-badge">{player.position}</span>
            <span className="text-xs text-muted">{player.nationality}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold" style={{ color: 'var(--color-primary)' }}>{formatPrice(player.transferPrice || player.salary || 50)}</div>
          {timeLeft && <div className="text-xs text-muted flex items-center gap-1 justify-end"><Clock size={10} />{timeLeft}</div>}
        </div>
      </div>
      <div className="flex gap-2 text-xs" style={{ marginBottom: 8 }}>
        <span className="badge badge-orange">OVR {overallRating}</span>
        <span className="badge badge-gray">{player.age}y</span>
        <span className="badge badge-blue">{player.height?.ft || '6\'5"'}</span>
      </div>
      {team && !isOwn && <div className="text-xs text-muted mb-2">🏀 {team.name}</div>}
      <div className="flex gap-2">
        <button className="btn btn-ghost btn-sm flex-1" onClick={() => onView(player)}>
          <Eye size={12} /> View
        </button>
        {isOwn ? (
          <button className="btn btn-danger btn-sm flex-1" onClick={() => onRemove(player)}>
            <X size={12} /> Remove
          </button>
        ) : (
          <button className="btn btn-primary btn-sm flex-1" onClick={() => onBuy(player, team)}>
            Buy
          </button>
        )}
      </div>
    </div>
  );
}

export default function Transfer() {
  const { state, dispatch, addNotification } = useGame();
  const [activeTab, setActiveTab] = useState('market');
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState('');
  const [maxPrice, setMaxPrice] = useState(1000);
  const [showListModal, setShowListModal] = useState(false);
  const [listPlayer, setListPlayer] = useState(null);
  const [listPrice, setListPrice] = useState('');
  const [viewPlayer, setViewPlayer] = useState(null);

  const team = state.userTeam;
  const allTeams = state.allTeams || [];

  // Players currently on market (from all teams except user)
  const marketPlayers = useMemo(() => {
    const result = [];
    allTeams.forEach(t => {
      if (t.id === team?.id) return;
      (t.players || []).forEach(p => {
        if (p.isOnTransferMarket) result.push({ player: p, team: t });
      });
    });
    return result;
  }, [allTeams, team]);

  // User's listed players
  const myListings = useMemo(() =>
    (team?.players || []).filter(p => p.isOnTransferMarket),
    [team]
  );

  // Filtered market
  const filtered = useMemo(() => {
    return marketPlayers.filter(({ player, team: t }) => {
      if (search && !player.name.toLowerCase().includes(search.toLowerCase()) && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (posFilter && player.position !== posFilter) return false;
      if ((player.transferPrice || 50) > maxPrice) return false;
      return true;
    });
  }, [marketPlayers, search, posFilter, maxPrice]);

  const handleList = () => {
    if (!listPlayer || !listPrice || isNaN(listPrice)) return;
    const price = parseFloat(listPrice);
    const updatedPlayers = team.players.map(p =>
      p.id === listPlayer.id ? { ...p, isOnTransferMarket: true, transferPrice: price, listedAt: Date.now() } : p
    );
    dispatch({ type: 'UPDATE_TEAM', payload: { ...team, players: updatedPlayers } });
    addNotification(`${listPlayer.name} listed for ${formatPrice(price)}`, 'success');
    setShowListModal(false);
    setListPlayer(null);
    setListPrice('');
  };

  const handleRemoveListing = (player) => {
    const updatedPlayers = team.players.map(p =>
      p.id === player.id ? { ...p, isOnTransferMarket: false, transferPrice: null, listedAt: null } : p
    );
    dispatch({ type: 'UPDATE_TEAM', payload: { ...team, players: updatedPlayers } });
    addNotification(`${player.name} removed from market`, 'info');
  };

  const handleBuy = (player, fromTeam) => {
    const price = player.transferPrice || 50;
    if ((team?.budget || 0) < price) {
      addNotification('Insufficient funds!', 'error');
      return;
    }
    // Remove from selling team
    const updatedSeller = { ...fromTeam, players: fromTeam.players.map(p => p.id === player.id ? null : p).filter(Boolean) };
    // Add to user team
    const boughtPlayer = { ...player, isOnTransferMarket: false, transferPrice: null };
    const updatedBuyer = { ...team, budget: (team.budget || 0) - price, players: [...team.players, boughtPlayer] };

    const updatedTeams = allTeams.map(t => {
      if (t.id === fromTeam.id) return updatedSeller;
      if (t.id === team.id) return updatedBuyer;
      return t;
    });
    dispatch({ type: 'UPDATE_ALL_TEAMS', payload: updatedTeams });
    addNotification(`${player.name} signed for ${formatPrice(price)}!`, 'success');
  };

  const getTimeLeft = (listedAt) => {
    if (!listedAt) return '72h';
    const msLeft = (listedAt + 72 * 60 * 60 * 1000) - Date.now();
    if (msLeft <= 0) return 'Expired';
    const h = Math.floor(msLeft / (60 * 60 * 1000));
    const m = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000));
    return `${h}h ${m}m`;
  };

  const availableToList = (team?.players || []).filter(p => !p.isOnTransferMarket);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>Transfer Market</h1>
        <p>Buy and sell players to strengthen your squad</p>
      </div>

      <div className="tabs mb-4">
        <button className={`tab${activeTab==='market'?' active':''}`} onClick={() => setActiveTab('market')}>
          Market ({marketPlayers.length})
        </button>
        <button className={`tab${activeTab==='mylistings'?' active':''}`} onClick={() => setActiveTab('mylistings')}>
          My Listings ({myListings.length})
        </button>
        <button className={`tab${activeTab==='history'?' active':''}`} onClick={() => setActiveTab('history')}>
          History
        </button>
      </div>

      {activeTab === 'market' && (
        <div>
          {/* Filters */}
          <div className="card mb-4" style={{ padding: '12px 16px' }}>
            <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Search player or team..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="form-select" style={{ width: 120 }} value={posFilter} onChange={e => setPosFilter(e.target.value)}>
                <option value="">All Positions</option>
                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <div className="flex items-center gap-2" style={{ minWidth: 200 }}>
                <span className="text-xs text-muted">Max:</span>
                <input type="range" min={0} max={1000} step={50} value={maxPrice} onChange={e => setMaxPrice(+e.target.value)} style={{ flex: 1 }} />
                <span className="text-xs font-bold" style={{ color: 'var(--color-primary)' }}>${maxPrice}</span>
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><ArrowLeftRight size={40} /></div>
              <div className="empty-state-title">No players available</div>
              <div className="empty-state-desc">The market is empty. Other GMs will list players here as the season progresses.</div>
            </div>
          ) : (
            <div className="grid-auto">
              {filtered.map(({ player, team: t }) => (
                <PlayerCard key={player.id} player={player} team={t} onBuy={handleBuy} onView={setViewPlayer} timeLeft={getTimeLeft(player.listedAt)} userTeamId={team?.id} onRemove={handleRemoveListing} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'mylistings' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-muted">Budget: <strong style={{ color: 'var(--color-success)' }}>${team?.budget?.toFixed(2)}</strong></div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowListModal(true)}>
              + List Player
            </button>
          </div>
          {myListings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">No active listings</div>
              <div className="empty-state-desc">List a player to generate revenue for your club</div>
            </div>
          ) : (
            <div className="grid-auto">
              {myListings.map(player => (
                <PlayerCard key={player.id} player={player} team={team} onBuy={() => {}} onView={setViewPlayer} timeLeft={getTimeLeft(player.listedAt)} userTeamId={team?.id} onRemove={handleRemoveListing} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card">
          <div className="card-title mb-4">Transfer History</div>
          {(team?.transferHistory || []).length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <div className="empty-state-icon">📜</div>
              <div className="empty-state-title">No transfers yet</div>
            </div>
          ) : (
            <table>
              <thead><tr><th>Player</th><th>From</th><th>To</th><th>Fee</th><th>Date</th></tr></thead>
              <tbody>
                {(team.transferHistory || []).map((h, i) => (
                  <tr key={i}>
                    <td>{h.playerName}</td>
                    <td>{h.from}</td>
                    <td>{h.to}</td>
                    <td style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{formatPrice(h.fee)}</td>
                    <td className="text-muted">{new Date(h.date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* List Player Modal */}
      {showListModal && (
        <div className="modal-overlay" onClick={() => setShowListModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 className="card-title">List Player for Sale</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowListModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Select Player</label>
                <select className="form-select" value={listPlayer?.id || ''} onChange={e => setListPlayer(availableToList.find(p => p.id === e.target.value))}>
                  <option value="">Choose a player...</option>
                  {availableToList.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.position})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Asking Price ($)</label>
                <input className="form-input" type="number" min={10} max={5000} placeholder="e.g. 150" value={listPrice} onChange={e => setListPrice(e.target.value)} />
                <span className="text-xs text-muted">Market is peer-to-peer. Listing expires after 72 hours.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowListModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleList} disabled={!listPlayer || !listPrice}>List Player</button>
            </div>
          </div>
        </div>
      )}

      {/* View Player Modal */}
      {viewPlayer && (
        <div className="modal-overlay" onClick={() => setViewPlayer(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{viewPlayer.name} — Full Profile</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setViewPlayer(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="flex items-center gap-3 mb-4">
                <PlayerAvatar player={viewPlayer} size="lg" />
                <div>
                  <div className="font-bold text-lg">{viewPlayer.name}</div>
                  <div className="text-sm text-muted">{viewPlayer.position} · {viewPlayer.nationality} · Age {viewPlayer.age}</div>
                  <div className="text-sm text-muted">{viewPlayer.height?.ft} · {viewPlayer.weight?.lbs}lbs</div>
                </div>
              </div>
              <div className="grid-3" style={{ gap: 8, marginBottom: 16 }}>
                {Object.entries(viewPlayer.attributes || {}).slice(0, 6).map(([k, v]) => (
                  <div key={k} className="stat-card" style={{ padding: 8, textAlign: 'center' }}>
                    <div className="stat-value" style={{ fontSize: 'var(--font-size-lg)' }}>{v}</div>
                    <div className="stat-label" style={{ fontSize: '0.6rem' }}>{k.replace(/([A-Z])/g,' $1').trim()}</div>
                  </div>
                ))}
              </div>
              <div className="badge badge-orange" style={{ fontSize: 'var(--font-size-xs)' }}>
                ⭐ Special: {viewPlayer.specialAbility?.replace(/([A-Z])/g,' $1').trim()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
