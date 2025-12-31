import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { BACKEND_LOCAL_PORT } from '@scaffold/shared/config';

interface Player {
  id: string;
  name: string;
  position: number;
  chips: number;
  currentBet: number;
  status: string;
  holeCards?: Array<{ rank: string; suit: string }>;
  lastAction?: string | null;
}

interface Pot {
  amount: number;
  eligiblePlayers: number[];
  winners?: number[] | null;
  winningRankName?: string;
}

interface GameState {
  id: string;
  roomCode: string;
  status: string;
  currentRound: string;
  pot: number;
  pots?: Pot[];
  currentBet: number;
  currentPlayerPosition: number | null;
  communityCards?: Array<{ rank: string; suit: string }>;
  players: Player[];
  dealerPosition: number;
  winners?: number[];
}

export default function TableView() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [game, setGame] = useState<GameState | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showGameOverModal, setShowGameOverModal] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);

  const getApiErrorMessage = (err: unknown, fallback: string) => {
    if (!axios.isAxiosError(err)) return fallback;
    const data = err.response?.data as { error?: string } | undefined;
    return data?.error || fallback;
  };

  useEffect(() => {
    if (!roomCode) return;

    let ws: WebSocket | null = null;
    let pollInterval: number | null = null;
    let reconnectTimeout: number | null = null;

    // WebSocket connection logic
    const connectWebSocket = () => {
      // In development: connect directly to backend (Vite proxy doesn't forward cookies)
      // In production: use same domain/port as the page
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const wsUrl = isDevelopment 
        ? `${protocol}//localhost:${BACKEND_LOCAL_PORT}/ws`
        : `${protocol}//${window.location.host}/ws`;
      
      console.log('[TableView] Connecting to WebSocket:', wsUrl);
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[TableView] WebSocket connected');
        setWsConnected(true);
        setError('');

        // Subscribe to table stream
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'subscribe',
            payload: {
              roomCode,
              stream: 'table'
            }
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[TableView] WebSocket message:', message.type);

          switch (message.type) {
            case 'hello':
              console.log('[TableView] Server hello:', message.payload);
              break;

            case 'subscribed':
              console.log('[TableView] Subscribed to table stream');
              setLoading(false);
              // Stop polling when WS is active
              if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
              }
              break;

            case 'game_state':
              console.log('[TableView] Game state update:', message.payload.reason);
              setGame(message.payload.state);
              setError('');
              setLoading(false);
              break;

            case 'error':
              console.error('[TableView] WebSocket error:', message.payload.error);
              setError(message.payload.error);
              break;
          }
        } catch (err) {
          console.error('[TableView] Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('[TableView] WebSocket error:', error);
        setWsConnected(false);
      };

      ws.onclose = () => {
        console.log('[TableView] WebSocket disconnected');
        setWsConnected(false);

        // Fall back to polling
        if (!pollInterval) {
          startPolling();
        }

        // Attempt to reconnect after 3 seconds
        reconnectTimeout = window.setTimeout(() => {
          console.log('[TableView] Attempting to reconnect...');
          connectWebSocket();
        }, 3000);
      };
    };

    // Polling fallback logic
    const startPolling = () => {
      const fetchGame = async () => {
        try {
          const response = await axios.get(`/api/games/room/${roomCode}/state`);
          setGame(response.data);
          setError('');
          setLoading(false);
        } catch (err: unknown) {
          setError(getApiErrorMessage(err, 'Failed to load game'));
          setLoading(false);
        }
      };

      fetchGame(); // Initial fetch
      pollInterval = window.setInterval(fetchGame, 2000);
    };

    // Try WebSocket first
    connectWebSocket();

    // Cleanup
    return () => {
      if (ws) {
        ws.close();
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [roomCode]);

  const formatCard = (card: { rank: string; suit: string }) => {
    const suitSymbols: Record<string, string> = {
      hearts: '♥',
      diamonds: '♦',
      clubs: '♣',
      spades: '♠',
    };
    return `${card.rank}${suitSymbols[card.suit] || card.suit}`;
  };

  const getSuitColor = (suit: string) => {
    return suit === 'hearts' || suit === 'diamonds' ? '#d00' : '#000';
  };

  const formatAction = (action: string | null | undefined) => {
    if (!action) return '';
    // Convert action types to readable format
    const actionMap: Record<string, string> = {
      'fold': 'Folded',
      'check': 'Checked',
      'call': 'Called',
      'bet': 'Bet',
      'raise': 'Raised',
      'all_in': 'All-In',
    };
    return actionMap[action.toLowerCase()] || action;
  };

  if (loading) {
    return <div style={{ padding: '50px', textAlign: 'center' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: '50px', textAlign: 'center', color: '#c00' }}>{error}</div>;
  }

  if (!game) {
    return <div style={{ padding: '50px', textAlign: 'center' }}>Game not found</div>;
  }

  const isShowdown = game.currentRound === 'showdown';
  const winnerPositions = Array.isArray(game.winners) ? game.winners : [];
  const activePlayers = game.players.filter(p => p.status !== 'folded' && p.status !== 'out');

  // Helper to get pot label (Main, Side 1, Side 2, etc.)
  const getPotLabel = (idx: number) => idx === 0 ? 'Main' : `Side ${idx}`;

  // Helper to get winner names for a pot
  const getPotWinnerNames = (pot: Pot) => {
    return game.players
      .filter(p => pot.winners && pot.winners.includes(p.position))
      .map(p => p.name)
      .join(', ');
  };

  return (
    <div style={{ 
      padding: '20px', 
      minHeight: '100vh',
      backgroundColor: '#1a472a',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Main container: stable max-width */}
      <div style={{
        width: '100%',
        maxWidth: '1200px',
      }}>

        {/* 1) COMPACT HEADER */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          gap: '20px',
          alignItems: 'center',
          marginBottom: '20px',
          padding: '12px',
          backgroundColor: '#234a34',
          borderRadius: '8px',
          border: '1px solid #456',
        }}>
          <div style={{ fontSize: '14px', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '8px' }}>
            Room: <strong>{game.roomCode}</strong>
            <span 
              style={{ 
                fontSize: '10px', 
                padding: '2px 6px', 
                borderRadius: '4px',
                backgroundColor: wsConnected ? '#2a5a3a' : '#5a3a2a',
                border: `1px solid ${wsConnected ? '#4f4' : '#fa4'}`,
                color: wsConnected ? '#4f4' : '#fa4',
                fontWeight: 'bold'
              }}
              title={wsConnected ? 'Connected via WebSocket' : 'Polling fallback'}
            >
              {wsConnected ? '⚡ WS' : '🔄 POLL'}
            </span>
          </div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', textAlign: 'center' }}>
            {game.currentRound ? game.currentRound.charAt(0).toUpperCase() + game.currentRound.slice(1) : 'Waiting'}
          </div>
          <div style={{ fontSize: '14px', opacity: 0.9, textAlign: 'right' }}>
            Players In: <strong>{activePlayers.length}/{game.players.length}</strong>
          </div>
        </div>

        {/* 2) TABLE SUMMARY: Pot + Current Bet + To Act */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}>
          {/* Pot Panel */}
          <div style={{
            padding: '12px',
            backgroundColor: '#234a34',
            borderRadius: '8px',
            border: '2px solid gold',
            minHeight: '80px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}>
            <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>POT</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
              ${game.pot}
            </div>
            {game.pots && game.pots.length > 1 ? (
              <div style={{ fontSize: '11px', opacity: 0.8, lineHeight: '1.4' }}>
                {game.pots.map((pot, idx) => (
                  <div key={idx}>
                    {getPotLabel(idx)}: ${pot.amount}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Current Bet Panel */}
          <div style={{
            padding: '12px',
            backgroundColor: '#234a34',
            borderRadius: '8px',
            border: '2px solid #456',
            minHeight: '80px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}>
            <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>CURRENT BET</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
              {game.currentBet > 0 ? `$${game.currentBet}` : '—'}
            </div>
          </div>

          {/* Turn Indicator Panel */}
          <div style={{
            padding: '12px',
            backgroundColor: '#234a34',
            borderRadius: '8px',
            border: '2px solid #456',
            minHeight: '80px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}>
            <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>TO ACT</div>
            {game.currentPlayerPosition !== null ? (
              <div style={{ fontSize: '18px', fontWeight: 'bold', wordBreak: 'break-word' }}>
                {game.players[game.currentPlayerPosition]?.name || '—'}
              </div>
            ) : (
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>—</div>
            )}
          </div>
        </div>

        {/* 3) COMMUNITY CARDS */}
        <div style={{
          marginBottom: '20px',
          padding: '16px',
          backgroundColor: '#234a34',
          borderRadius: '8px',
          border: '1px solid #456',
        }}>
          <h2 style={{
            margin: '0 0 16px 0',
            fontSize: '14px',
            opacity: 0.8,
            fontWeight: 'bold',
            textTransform: 'uppercase',
          }}>
            Community Cards
          </h2>
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}>
            {Array.from({ length: 5 }).map((_, idx) => {
              const card = (game.communityCards || [])[idx];

              if (card) {
                return (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: '#fff',
                      color: getSuitColor(card.suit),
                      padding: '16px 12px',
                      borderRadius: '8px',
                      fontSize: '36px',
                      fontWeight: 'bold',
                      minWidth: '70px',
                      textAlign: 'center',
                      boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                      border: '1px solid #ddd',
                    }}
                  >
                    {formatCard(card)}
                  </div>
                );
              }

              // Placeholder (face-down)
              return (
                <div
                  key={idx}
                  style={{
                    backgroundColor: '#0066cc',
                    background: 'linear-gradient(135deg, #0066cc 0%, #004499 100%)',
                    color: '#fff',
                    padding: '16px 12px',
                    borderRadius: '8px',
                    fontSize: '36px',
                    fontWeight: 'bold',
                    minWidth: '70px',
                    textAlign: 'center',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.6)',
                    opacity: 0.7,
                  }}
                >
                  🂠
                </div>
              );
            })}
          </div>
        </div>

        {/* 4) SHOWDOWN WINNING RANKS (compact, in table summary) */}
        {isShowdown && game.pots && game.pots.length > 0 && (
          <div style={{
            marginBottom: '20px',
            padding: '12px',
            backgroundColor: '#2a5a3a',
            borderRadius: '8px',
            border: '2px solid gold',
          }}>
            <h3 style={{
              margin: '0 0 10px 0',
              fontSize: '14px',
              fontWeight: 'bold',
            }}>
              Winning Hands
            </h3>
            <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
              {game.pots.map((pot, idx) => (
                <div key={idx} style={{ marginBottom: idx < (game.pots?.length ?? 0) - 1 ? '6px' : 0 }}>
                  <strong>{getPotLabel(idx)}:</strong> {pot.winningRankName || 'Unknown'} —{' '}
                  <span style={{ opacity: 0.9 }}>{getPotWinnerNames(pot)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5) PLAYERS LIST (single column, no duplication) */}
        <div style={{
          marginBottom: '20px',
        }}>
          <h2 style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            opacity: 0.8,
            fontWeight: 'bold',
            textTransform: 'uppercase',
          }}>
            Players
          </h2>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}>
            {game.players.map((player, idx) => {
              const isFolded = player.status === 'folded';
              const isActive = player.status === 'active';
              const isAllIn = player.status === 'all_in';
              const isCurrentTurn = game.currentPlayerPosition === idx;
              const isDealer = game.dealerPosition === idx;
              const isWinner = winnerPositions.includes(player.position);

              return (
                <div
                  key={player.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '140px 80px 80px 80px 1fr',
                    gap: '10px',
                    alignItems: 'center',
                    padding: '10px',
                    backgroundColor:
                      isCurrentTurn ? '#2a5a3a' : isWinner ? '#2a4a3a' : isFolded ? '#1a2a1a' : '#234a34',
                    borderRadius: '6px',
                    border: isDealer
                      ? '2px solid gold'
                      : isWinner
                      ? '2px solid #4f4'
                      : isFolded
                      ? '1px solid #444'
                      : '1px solid #456',
                    opacity: isFolded ? 0.6 : 1,
                  }}
                >
                  {/* Identity (name + dealer) */}
                  <div style={{
                    fontSize: '13px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    overflow: 'hidden',
                  }}>
                    {isDealer && <span style={{ fontSize: '14px' }}>🔵</span>}
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {player.name}
                    </span>
                  </div>

                  {/* Stack */}
                  <div style={{
                    fontSize: '12px',
                    color: '#4f4',
                    fontWeight: 'bold',
                    textAlign: 'center',
                  }}>
                    ${player.chips}
                  </div>

                  {/* In-front (current bet) */}
                  <div style={{
                    fontSize: '12px',
                    color: player.currentBet > 0 ? '#ff0' : '#aaa',
                    textAlign: 'center',
                  }}>
                    {player.currentBet > 0 ? `$${player.currentBet}` : '—'}
                  </div>

                  {/* Action/Status */}
                  <div style={{
                    fontSize: '11px',
                    textAlign: 'center',
                    opacity: 0.9,
                  }}>
                    {isFolded ? '❌ Fold' : isAllIn ? '⛔ All-in' : formatAction(player.lastAction) || (isActive ? '✓' : '—')}
                  </div>

                  {/* Cards */}
                  <div style={{
                    display: 'flex',
                    gap: '6px',
                    justifyContent: 'flex-end',
                    minHeight: '30px',
                    alignItems: 'center',
                  }}>
                    {isShowdown && player.holeCards && player.holeCards.length > 0 ? (
                      player.holeCards.map((card, cardIdx) => (
                        <div
                          key={cardIdx}
                          style={{
                            backgroundColor: '#fff',
                            color: getSuitColor(card.suit),
                            padding: '4px 6px',
                            borderRadius: '4px',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            minWidth: '32px',
                            textAlign: 'center',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                          }}
                        >
                          {formatCard(card)}
                        </div>
                      ))
                    ) : !isFolded && (isActive || isAllIn) ? (
                      <>
                        <div
                          style={{
                            backgroundColor: '#0066cc',
                            background: 'linear-gradient(135deg, #0066cc 0%, #004499 100%)',
                            padding: '6px 4px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            minWidth: '28px',
                            textAlign: 'center',
                            border: '1px solid #fff',
                          }}
                        >
                          🂠
                        </div>
                        <div
                          style={{
                            backgroundColor: '#0066cc',
                            background: 'linear-gradient(135deg, #0066cc 0%, #004499 100%)',
                            padding: '6px 4px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            minWidth: '28px',
                            textAlign: 'center',
                            border: '1px solid #fff',
                          }}
                        >
                          🂠
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: '11px', opacity: 0.6 }}>—</div>
                    )}
                    {isWinner && <span style={{ fontSize: '14px' }}>🏆</span>}
                    {isCurrentTurn && <span style={{ fontSize: '14px' }}>⏱️</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Waiting for players */}
        {game.status === 'waiting' && (
          <div
            style={{
              marginBottom: '20px',
              textAlign: 'center',
              fontSize: '16px',
              padding: '16px',
              backgroundColor: '#456',
              borderRadius: '8px',
            }}
          >
            Waiting for players to join...
            <div style={{ marginTop: '8px', fontSize: '13px', opacity: 0.8 }}>
              Share code: <strong>{game.roomCode}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Game Over Modal */}
      {game.status === 'completed' && showGameOverModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(3px)',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              backgroundColor: '#1a1a1a',
              padding: '40px 50px',
              borderRadius: '12px',
              boxShadow: '0 0 40px rgba(255, 215, 0, 0.3)',
              border: '2px solid #FFD700',
              position: 'relative',
              maxWidth: '500px',
            }}
          >
            <button
              onClick={() => setShowGameOverModal(false)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#FFD700',
                fontSize: '28px',
                cursor: 'pointer',
                padding: '0',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Close"
            >
              ✕
            </button>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>🏆</div>
            <div
              style={{
                fontSize: '36px',
                fontWeight: 'bold',
                marginBottom: '24px',
                color: '#FFD700',
                textShadow: '0 0 15px rgba(255, 215, 0, 0.4)',
              }}
            >
              GAME OVER!
            </div>
            <div style={{ fontSize: '16px', marginBottom: '20px', opacity: 0.9 }}>
              Final Chip Count
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                marginBottom: '24px',
              }}
            >
              {game.players.map((player) => (
                <div
                  key={player.name}
                  style={{
                    fontSize: '14px',
                    padding: '12px 16px',
                    backgroundColor: player.chips > 0 ? '#1a3a1a' : '#2a1a1a',
                    borderRadius: '6px',
                    border: player.chips > 0 ? '1px solid #0f0' : '1px solid #f00',
                    color: player.chips > 0 ? '#4f4' : '#aaa',
                    fontWeight: 'bold',
                  }}
                >
                  {player.name}: ${player.chips}
                </div>
              ))}
            </div>
            <div style={{ fontSize: '12px', color: '#aaa' }}>Room: {game.roomCode}</div>
          </div>
        </div>
      )}
    </div>
  );
}
