import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import HorizontalSlider from '../components/HorizontalSlider';
import { BACKEND_LOCAL_PORT } from '@scaffold/shared/config';

interface Player {
  id: string;
  name: string;
  position: number;
  chips: number;
  currentBet: number;
  status: string;
  holeCards?: Array<{ rank: string; suit: string }>;
}

interface Pot {
  amount: number;
  eligiblePlayers: number[];
  winners?: number[] | null;
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
  communityCards: Array<{ rank: string; suit: string }>;
  players: Player[];
  dealerPosition: number;
  winners?: number[];
  bigBlind?: number;
}

interface ValidActions {
  canAct: boolean;
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount?: number;
  canBet: boolean;
  minBet?: number;
  maxBet?: number;
  canRaise: boolean;
  minRaise?: number;
  maxRaise?: number;
}

export default function PlayerView() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [game, setGame] = useState<GameState | null>(null);
  const [validActions, setValidActions] = useState<ValidActions | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [password, setPassword] = useState('');
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  const [raiseAmount, setRaiseAmount] = useState<number>(0);
  const [betAmount, setBetAmount] = useState<number>(0);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [canRevealCard, setCanRevealCard] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const playerNameStorageKey = roomCode ? `holdem:${roomCode}:playerName` : null;

  const getApiErrorMessage = (err: unknown, fallback: string) => {
    if (!axios.isAxiosError(err)) return fallback;
    const data = err.response?.data as { error?: string } | undefined;
    return data?.error || fallback;
  };

  // Initialize bet/raise amounts when validActions change
  useEffect(() => {
    if (!validActions) return;

    if (validActions.canBet && validActions.minBet !== undefined) {
      const minBet = validActions.minBet;
      setBetAmount((prev) => (prev >= minBet ? prev : minBet));
    }
    if (validActions.canRaise && validActions.minRaise !== undefined) {
      const minRaise = validActions.minRaise;
      setRaiseAmount((prev) => (prev >= minRaise ? prev : minRaise));
    }
  }, [validActions]);

  // Check for existing authentication on mount
  useEffect(() => {
    const checkExistingAuth = async () => {
      if (!roomCode) {
        setCheckingAuth(false);
        return;
      }

      // Prefill name from localStorage (lets us identify ourselves pre-flop too)
      if (playerNameStorageKey) {
        const storedName = localStorage.getItem(playerNameStorageKey);
        if (storedName && !playerName) {
          setPlayerName(storedName);
        }
      }

      try {
        // Get game info
        const gameResponse = await axios.get(`/api/games/room/${roomCode}`);
        const gameId = gameResponse.data.id;

        // Try to fetch game state with credentials
        const stateResponse = await axios.get(`/api/games/${gameId}`, {
          withCredentials: true,
        });

        // If we get here, we're authenticated!
        setGame(stateResponse.data);
        setJoined(true);

        // If we don't have a stored name yet, try to infer it (works once hole cards exist)
        if (!playerNameStorageKey || !localStorage.getItem(playerNameStorageKey)) {
          const authenticatedPlayer = stateResponse.data.players.find(
            (p: Player) => p.holeCards && p.holeCards.length > 0
          );
          if (authenticatedPlayer) {
            setPlayerName(authenticatedPlayer.name);
            if (playerNameStorageKey) {
              localStorage.setItem(playerNameStorageKey, authenticatedPlayer.name);
            }
          }
        }
      } catch {
        // Not authenticated, show login form
      } finally {
        setCheckingAuth(false);
      }
    };

    checkExistingAuth();
  }, [roomCode, playerName, playerNameStorageKey]);

  // WebSocket connection for real-time game state updates
  // Falls back to polling if WebSocket unavailable
  useEffect(() => {
    if (!joined || !game?.id || !roomCode) return;

    const gameId = game.id;
    let ws: WebSocket | null = null;
    let pollInterval: number | null = null;
    let reconnectTimeout: number | null = null;

    // WebSocket connection logic
    const connectWebSocket = () => {
      // Connect directly to backend to ensure cookies are sent properly
      // Vite proxy doesn't forward cookies on WebSocket upgrade
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//localhost:${BACKEND_LOCAL_PORT}/ws`;
      
      console.log('[PlayerView] Connecting to WebSocket:', wsUrl);
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[PlayerView] WebSocket connected');
        setWsConnected(true);
        setError('');

        // Subscribe to player stream
        if (ws && ws.readyState === WebSocket.OPEN) {
          // Get stored playerId for authentication
          const storedPlayerId = playerNameStorageKey 
            ? localStorage.getItem(`${playerNameStorageKey}:playerId`)
            : null;
            
          ws.send(JSON.stringify({
            type: 'subscribe',
            payload: {
              roomCode,
              stream: 'player',
              gameId,
              playerId: storedPlayerId // Send playerId for auth
            }
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[PlayerView] WebSocket message:', message.type);

          switch (message.type) {
            case 'hello':
              console.log('[PlayerView] Server hello:', message.payload);
              break;

            case 'subscribed':
              console.log('[PlayerView] Subscribed to player stream');
              // Stop polling when WS is active
              if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
              }
              break;

            case 'game_state':
              console.log('[PlayerView] Game state update:', message.payload.reason);
              const nextGame: GameState = message.payload.state;
              setGame(nextGame);

              const me = playerName
                ? nextGame.players.find(p => p.name === playerName)
                : undefined;

              const isMyTurnNow =
                !!me &&
                nextGame.status === 'active' &&
                nextGame.currentPlayerPosition !== null &&
                nextGame.currentPlayerPosition === (me?.position ?? -1);

              // Check if we can reveal a card
              const canReveal = checkCanRevealCard(nextGame, playerName);
              setCanRevealCard(canReveal);

              // Fetch valid actions if it's our turn (Phase 3 will push these)
              if (isMyTurnNow) {
                fetchValidActions(gameId);
              } else {
                setValidActions(prev => (prev ? null : prev));
              }

              setError('');
              break;

            case 'error':
              console.error('[PlayerView] WebSocket error:', message.payload.error);
              setError(message.payload.error);
              break;
          }
        } catch (err) {
          console.error('[PlayerView] Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('[PlayerView] WebSocket error:', error);
        setWsConnected(false);
      };

      ws.onclose = () => {
        console.log('[PlayerView] WebSocket disconnected');
        setWsConnected(false);

        // Fall back to polling
        if (!pollInterval) {
          startPolling();
        }

        // Attempt to reconnect after 3 seconds
        reconnectTimeout = window.setTimeout(() => {
          console.log('[PlayerView] Attempting to reconnect...');
          connectWebSocket();
        }, 3000);
      };
    };

    // Helper to fetch valid actions
    const fetchValidActions = async (gid: string) => {
      try {
        const actionsResponse = await axios.get(
          `/api/games/${gid}/actions/valid`,
          { withCredentials: true }
        );
        setValidActions(actionsResponse.data);
      } catch (err: unknown) {
        if (!(axios.isAxiosError(err) && err.response?.status === 403)) {
          console.error('[PlayerView] Failed to fetch valid actions:', err);
        }
      }
    };

    // Polling fallback logic
    const startPolling = () => {
      const tick = async () => {
        try {
          const response = await axios.get(`/api/games/${gameId}`, {
            withCredentials: true,
          });

          const nextGame: GameState = response.data;
          setGame(nextGame);

          const me = playerName
            ? nextGame.players.find(p => p.name === playerName)
            : undefined;

          const isMyTurnNow =
            !!me &&
            nextGame.status === 'active' &&
            nextGame.currentPlayerPosition !== null &&
            nextGame.currentPlayerPosition === (me?.position ?? -1);

          const canReveal = checkCanRevealCard(nextGame, playerName);
          setCanRevealCard(canReveal);

          if (isMyTurnNow) {
            await fetchValidActions(gameId);
          } else {
            setValidActions(prev => (prev ? null : prev));
          }

          setError('');
        } catch (err: unknown) {
          if (!(axios.isAxiosError(err) && err.response?.status === 403)) {
            setError(getApiErrorMessage(err, 'Failed to load game'));
          }
        }
      };

      tick(); // Initial fetch
      pollInterval = window.setInterval(tick, 1500);
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
  }, [joined, game?.id, roomCode, playerName]);

  const handleJoin = async () => {
    if (!roomCode || !playerName.trim() || !password.trim()) return;

    try {
      // Get game ID first
      const gameResponse = await axios.get(`/api/games/room/${roomCode}`);
      const gameId = gameResponse.data.id;
      const gameData = gameResponse.data;

      // Check if player already exists in the game
      const playerExists = gameData.players?.some((p: Player) => p.name === playerName.trim());

      if (playerExists) {
        // Use auth endpoint for reconnection
        await axios.post(
          `/api/games/${gameId}/auth`,
          { name: playerName.trim(), password },
          { withCredentials: true }
        );
      } else {
        // Use join endpoint for new players
        await axios.post(
          `/api/games/${gameId}/join`,
          { name: playerName.trim(), password },
          { withCredentials: true }
        );
      }

      if (playerNameStorageKey) {
        localStorage.setItem(playerNameStorageKey, playerName.trim());
      }

      // Get initial game state
      const stateResponse = await axios.get(`/api/games/${gameId}`, {
        withCredentials: true,
      });

      setGame(stateResponse.data);
      
      // Store playerId in localStorage for WebSocket auth
      const authenticatedPlayer = stateResponse.data.players.find(
        (p: Player) => p.holeCards && p.holeCards.length > 0
      );
      if (authenticatedPlayer && playerNameStorageKey) {
        localStorage.setItem(`${playerNameStorageKey}:playerId`, authenticatedPlayer.id);
      }
      
      setJoined(true);
      setError('');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to join game'));
    }
  };

  const handleStartGame = async () => {
    if (!game?.id) return;

    try {
      await axios.post(`/api/games/${game.id}/start`, {}, {
        withCredentials: true,
      });
      setError('');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to start game'));
    }
  };

  const handleAction = async (action: string, amount?: number) => {
    if (!game?.id) return;

    try {
      await axios.post(
        `/api/games/${game.id}/actions`,
        { action, amount },
        { withCredentials: true }
      );
      setError('');
      setRaiseAmount(0);
      setBetAmount(0);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to submit action'));
    }
  };

  const handleNextHand = async () => {
    if (!game?.id) return;

    try {
      const res = await axios.post(
        `/api/games/${game.id}/next-hand`,
        {},
        { withCredentials: true }
      );
      setGame(res.data);
      setError('');
      setValidActions(null);
      setRaiseAmount(0);
      setBetAmount(0);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to start next hand'));
    }
  };

  const handleRevealCard = async () => {
    if (!game?.id) return;

    try {
      const res = await axios.post(
        `/api/games/${game.id}/reveal-card`,
        {},
        { withCredentials: true }
      );
      setGame(res.data);
      setError('');
      setCanRevealCard(false);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to reveal card'));
    }
  };

  const checkCanRevealCard = (gameState: GameState, myPlayerName: string | null) => {
    if (!myPlayerName || gameState.status !== 'active') {
      return false;
    }

    // Can't reveal in preflop or showdown
    if (!gameState.currentRound || gameState.currentRound === 'preflop' || gameState.currentRound === 'showdown') {
      return false;
    }

    // Count players with chips
    const playersWithChips = gameState.players.filter(
      p => p.chips > 0 && p.status !== 'out' && p.status !== 'folded'
    );

    // Can only reveal if I'm the only one with chips
    if (playersWithChips.length !== 1) {
      return false;
    }

    // Must be that player
    const myPlayer = gameState.players.find(p => p.name === myPlayerName);
    return (myPlayer?.chips ?? 0) > 0;
  };

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

  // Show loading while checking authentication
  if (checkingAuth) {
    return (
      <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', textAlign: 'center' }}>
        <h2>Checking authentication...</h2>
      </div>
    );
  }

  // Join screen
  if (!joined) {
    return (
      <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px' }}>
        <h1>Join Game</h1>
        <p>Room: {roomCode}</p>
        
        <div style={{ marginTop: '30px' }}>
          <input
            type="text"
            placeholder="Your Name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            style={{
              width: '100%',
              padding: '15px',
              fontSize: '18px',
              marginBottom: '15px',
            }}
          />
          
          <input
            type="password"
            placeholder="Password (min 4 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
            style={{
              width: '100%',
              padding: '15px',
              fontSize: '18px',
              marginBottom: '15px',
            }}
          />
          
          <button
            onClick={handleJoin}
            disabled={!playerName.trim() || password.length < 4}
            style={{
              width: '100%',
              padding: '15px',
              fontSize: '18px',
              cursor: (!playerName.trim() || password.length < 4) ? 'not-allowed' : 'pointer',
            }}
          >
            Join Game
          </button>
        </div>

        {error && (
          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            backgroundColor: '#fee', 
            color: '#c00',
            borderRadius: '5px',
          }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  if (!game) {
    return <div style={{ padding: '50px', textAlign: 'center' }}>Loading...</div>;
  }

  const myPlayer = game.players.find(p => p.name === playerName);
  const isMyTurn = myPlayer && game.currentPlayerPosition === myPlayer.position;

  const isShowdown = game.currentRound === 'showdown';
  const winnerPositions = Array.isArray(game.winners) ? game.winners : [];
  const amWinner = !!myPlayer && winnerPositions.includes(myPlayer.position);

  const derivedMaxBet = validActions?.maxBet ?? validActions?.maxRaise ?? myPlayer?.chips ?? 0;

  return (
    <div style={{ 
      padding: '12px',
      minHeight: '95vh',
      backgroundColor: '#1a472a',
      color: '#fff',
      maxWidth: '600px',
      margin: '0 auto',
    }}>
      <div style={{ 
        textAlign: 'center', 
        marginBottom: '12px',
        backgroundColor: '#234a34',
        padding: '10px',
        borderRadius: '8px',
      }}>
        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
          {playerName} • ${myPlayer?.chips || 0}
        </div>
        <div style={{ fontSize: '14px', opacity: 0.8, marginTop: '4px' }}>
          Room: {game.roomCode} | {game.currentRound}
        </div>
      </div>

      {/* Hole Cards */}
      {myPlayer?.holeCards && myPlayer.holeCards.length > 0 && (
        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          justifyContent: 'center',
          marginBottom: '12px',
        }}>
          {myPlayer.holeCards.map((card, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: '#fff',
                color: getSuitColor(card.suit),
                padding: '12px 8px',
                borderRadius: '8px',
                fontSize: '32px',
                fontWeight: 'bold',
                width: '60px',
                height: '88px',
                textAlign: 'center',
                boxShadow: '0 4px 8px rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {formatCard(card)}
            </div>
          ))}
        </div>
      )}

      {/* Showdown */}
      {isShowdown && (
        <div style={{
          marginBottom: '20px',
          padding: '16px',
          backgroundColor: '#234a34',
          borderRadius: '10px',
          border: '2px solid #456'
        }}>
          <h3 style={{ textAlign: 'center', marginTop: 0 }}>Showdown</h3>

          {winnerPositions.length > 0 && (
            <div style={{
              textAlign: 'center',
              marginBottom: '12px',
              fontSize: '18px'
            }}>
              Winner{winnerPositions.length > 1 ? 's' : ''}: {' '}
              <strong>
                {game.players
                  .filter(p => winnerPositions.includes(p.position))
                  .map(p => p.name)
                  .join(', ')}
              </strong>
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '12px'
          }}>
            {game.players.map(p => (
              <div
                key={p.id}
                style={{
                  backgroundColor: winnerPositions.includes(p.position) ? '#2a5a3a' : '#1a472a',
                  border: winnerPositions.includes(p.position) ? '2px solid gold' : '2px solid #456',
                  borderRadius: '10px',
                  padding: '12px'
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '18px' }}>
                  {p.name}{winnerPositions.includes(p.position) ? ' 🏆' : ''}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(p.holeCards || []).length > 0 ? (
                    p.holeCards!.map((card, idx) => (
                      <div
                        key={idx}
                        style={{
                          backgroundColor: '#fff',
                          color: getSuitColor(card.suit),
                          borderRadius: '8px',
                          fontSize: '20px',
                          fontWeight: 'bold',
                          width: '44px',
                          height: '64px',
                          textAlign: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {formatCard(card)}
                      </div>
                    ))
                  ) : (
                    <>
                      <div style={{
                        backgroundColor: '#0066cc',
                        background: 'linear-gradient(135deg, #0066cc 0%, #004499 100%)',
                        borderRadius: '8px',
                        fontSize: '20px',
                        fontWeight: 'bold',
                        width: '44px',
                        height: '64px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(255,255,255,0.85)',
                        opacity: 0.85,
                      }}>
                        🂠
                      </div>
                      <div style={{
                        backgroundColor: '#0066cc',
                        background: 'linear-gradient(135deg, #0066cc 0%, #004499 100%)',
                        borderRadius: '8px',
                        fontSize: '20px',
                        fontWeight: 'bold',
                        width: '44px',
                        height: '64px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(255,255,255,0.85)',
                        opacity: 0.85,
                      }}>
                        🂠
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleNextHand}
            style={{
              width: '100%',
              marginTop: '14px',
              padding: '16px',
              fontSize: '18px',
              backgroundColor: amWinner ? 'gold' : '#4CAF50',
              color: amWinner ? '#000' : '#fff',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {amWinner ? '🏆 Next Hand' : 'Start Next Hand'}
          </button>
        </div>
      )}

      {/* Fold button - positioned above pot to prevent accidental touches */}
      {game.status === 'active' && isMyTurn && validActions?.canAct && validActions.canFold && (
        <button
          onClick={() => handleAction('fold')}
          style={{
            width: '100%',
            padding: '15px',
            fontSize: '18px',
            backgroundColor: '#c00',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            marginBottom: '12px',
          }}
        >
          Fold
        </button>
      )}

      {/* Game Info */}
      <div style={{ 
        textAlign: 'center',
        padding: '10px',
        backgroundColor: '#234a34',
        borderRadius: '8px',
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', opacity: 0.7 }}>Room: {game.roomCode}</span>
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
        <div style={{ fontSize: '18px' }}>
          {game.pots && game.pots.length > 1 ? (
            <div>
              <div>Pot: <strong>${game.pot}</strong></div>
              {game.pots.map((pot, idx) => (
                <div key={idx} style={{ fontSize: '14px', marginTop: '3px', opacity: 0.85 }}>
                  {idx === 0 ? 'Main' : `Side ${idx}`}: ${pot.amount}
                  {myPlayer && pot.eligiblePlayers.includes(myPlayer.position) && (
                    <span style={{ color: '#0f0', marginLeft: '6px' }}>✓</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div>Pot: <strong>${game.pot}</strong></div>
          )}
        </div>
        {(game.currentBet > 0 || (myPlayer && myPlayer.currentBet > 0)) && (
          <div style={{ fontSize: '14px', marginTop: '6px', opacity: 0.9 }}>
            {game.currentBet > 0 && <span>To Call: ${game.currentBet}</span>}
            {myPlayer && myPlayer.currentBet > 0 && (
              <span style={{ color: '#ff0', marginLeft: game.currentBet > 0 ? '10px' : '0' }}>
                Your Bet: ${myPlayer.currentBet}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {game.status === 'waiting' && (
        <button
          onClick={handleStartGame}
          style={{
            width: '100%',
            padding: '20px',
            fontSize: '20px',
            backgroundColor: '#0a0',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Start Game
        </button>
      )}

      {game.status === 'active' && (
        <div>
          {isMyTurn && validActions?.canAct ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {validActions.canCheck && (
                <button
                  onClick={() => handleAction('check')}
                  style={{
                    padding: '15px',
                    fontSize: '18px',
                    backgroundColor: '#0a0',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  Check
                </button>
              )}              
              {validActions.canBet && validActions.minBet !== undefined && (
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ marginBottom: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
                      Bet: ${Math.max(betAmount, validActions.minBet)}
                    </div>
                    {/* Horizontal Slider */}
                    <div style={{ 
                      marginBottom: '10px', 
                      padding: '12px', 
                      backgroundColor: '#2a5a3a',
                      borderRadius: '8px',
                    }}>
                      <HorizontalSlider
                        value={Math.max(betAmount, validActions.minBet)}
                        min={validActions.minBet}
                        max={derivedMaxBet}
                        step={1}
                        onChange={(value) => setBetAmount(value)}
                        thumbColor="#0a0"
                        trackColor="#456"
                      />
                    </div>
                    
                    {/* +/- Buttons */}
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', alignItems: 'center', marginBottom: '8px' }}>
                      <button
                        onClick={() => setBetAmount(prev => Math.max(prev - (game.bigBlind || 10), validActions.minBet!))}
                        style={{
                          width: '60px',
                          height: '50px',
                          fontSize: '24px',
                          backgroundColor: '#00a',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        −
                      </button>
                      <div style={{ fontSize: '13px', opacity: 0.75, minWidth: '80px', textAlign: 'center' }}>
                        +/− ${game.bigBlind || 10} (BB)
                      </div>
                      <button
                        onClick={() => setBetAmount(prev => Math.min(prev + (game.bigBlind || 10), derivedMaxBet))}
                        style={{
                          width: '60px',
                          height: '50px',
                          fontSize: '24px',
                          backgroundColor: '#00a',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAction('bet', Math.max(betAmount, validActions.minBet!))}
                    style={{
                      width: '100%',
                      padding: '15px',
                      fontSize: '18px',
                      backgroundColor: '#00a',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                    }}
                  >
                    Bet ${Math.max(betAmount, validActions.minBet)}
                  </button>
                </div>
              )}              
              {validActions.canCall && validActions.callAmount !== undefined && (
                <button
                  onClick={() => handleAction('call')}
                  style={{
                    padding: '15px',
                    fontSize: '18px',
                    backgroundColor: '#0a0',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  Call ${validActions.callAmount}
                </button>
              )}
              
              {validActions.canRaise && validActions.minRaise !== undefined && validActions.maxRaise !== undefined && (
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ marginBottom: '10px', textAlign: 'center' }}>
                    {(() => {
                      const minInc = validActions.minRaise!;
                      const maxInc = validActions.maxRaise!;
                      const inc = Math.min(Math.max(raiseAmount, minInc), maxInc);
                      const raiseTo = game.currentBet + inc;

                      return (
                        <>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
                            Raise to: ${raiseTo}
                          </div>
                          {/* Horizontal Slider */}
                          <div style={{ 
                            marginBottom: '10px', 
                            padding: '12px', 
                            backgroundColor: '#2a5a3a',
                            borderRadius: '8px',
                          }}>
                            <HorizontalSlider
                              value={inc}
                              min={validActions.minRaise}
                              max={validActions.maxRaise}
                              step={1}
                              onChange={(value) => setRaiseAmount(value)}
                              thumbColor="#f80"
                              trackColor="#456"
                            />
                          </div>
                          
                          {/* +/- Buttons */}
                          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', alignItems: 'center', marginBottom: '8px' }}>
                            <button
                              onClick={() => setRaiseAmount(prev => Math.max(prev - (game.bigBlind || 10), minInc))}
                              style={{
                                width: '60px',
                                height: '50px',
                                fontSize: '24px',
                                backgroundColor: '#f80',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              −
                            </button>
                            <div style={{ fontSize: '13px', opacity: 0.75, minWidth: '80px', textAlign: 'center' }}>
                              +/− ${game.bigBlind || 10} (BB)
                            </div>
                            <button
                              onClick={() => setRaiseAmount(prev => Math.min(prev + (game.bigBlind || 10), maxInc))}
                              style={{
                                width: '60px',
                                height: '50px',
                                fontSize: '24px',
                                backgroundColor: '#f80',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              +
                            </button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <button
                    onClick={() => {
                      const minInc = validActions.minRaise!;
                      const maxInc = validActions.maxRaise!;
                      const inc = Math.min(Math.max(raiseAmount, minInc), maxInc);
                      handleAction('raise', inc);
                    }}
                    style={{
                      width: '100%',
                      padding: '15px',
                      fontSize: '18px',
                      backgroundColor: '#f80',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                    }}
                  >
                    {(() => {
                      const minInc = validActions.minRaise!;
                      const maxInc = validActions.maxRaise!;
                      const inc = Math.min(Math.max(raiseAmount, minInc), maxInc);
                      return `Raise to $${game.currentBet + inc}`;
                    })()}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              {canRevealCard && game.currentRound && game.currentRound !== 'preflop' && game.currentRound !== 'showdown' ? (
                <button
                  onClick={handleRevealCard}
                  style={{
                    width: '100%',
                    padding: '15px',
                    fontSize: '18px',
                    backgroundColor: '#088',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    marginBottom: '15px',
                  }}
                >
                  Reveal Next Card
                </button>
              ) : null}
              <div style={{ 
                textAlign: 'center',
                padding: '20px',
                backgroundColor: '#456',
                borderRadius: '10px',
                fontSize: '18px',
              }}>
                {myPlayer?.status === 'folded' ? 'You folded' : 'Waiting for other players...'}
              </div>
            </div>
          )}
        </div>
      )}

      {game.status === 'completed' && (
        <div style={{
          textAlign: 'center',
          padding: '20px',
          backgroundColor: '#234',
          borderRadius: '10px',
          marginBottom: '20px',
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>
            🎉 Game Over!
          </div>
          <div style={{ fontSize: '18px', marginBottom: '10px' }}>
            {myPlayer && myPlayer.chips > 0 ? 
              `You won with $${myPlayer.chips}!` : 
              'Better luck next time!'}
          </div>
          <div style={{ fontSize: '14px', opacity: 0.7 }}>
            The game has ended. One player has all the chips.
          </div>
        </div>
      )}

      {error && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: '#fee', 
          color: '#c00',
          borderRadius: '5px',
          textAlign: 'center',
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
