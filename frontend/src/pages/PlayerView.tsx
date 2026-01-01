import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import HorizontalSlider from '../components/HorizontalSlider'
import PlayerJoinGame from '../components/PlayerJoinGame'
import PlayerShowdown from '../components/PlayerShowdown'
import { usePlayerGame } from '../hooks/usePlayerGame'

export default function PlayerView() {
  const { roomCode } = useParams<{ roomCode: string }>()

  const {
    game,
    validActions,
    playerName,
    setPlayerName,
    joined,
    error,
    checkingAuth,
    canRevealCard,
    wsConnected,
    joinGame,
    startGame,
    performAction,
    nextHand,
    revealCard,
    advanceRound,
  } = usePlayerGame(roomCode)

  const [raiseAmount, setRaiseAmount] = useState<number>(0)
  const [betAmount, setBetAmount] = useState<number>(0)

  // Global styles for polished buttons
  const buttonBaseStyle = {
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 'bold' as const,
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  }

  const buttonHoverStyle = `
    button:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }
    button:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `

  // Initialize bet/raise amounts when validActions change
  useEffect(() => {
    if (!validActions) return

    if (validActions.canBet && validActions.minBet !== undefined) {
      const minBet = validActions.minBet
      setBetAmount((prev) => (prev >= minBet ? prev : minBet))
    }
    if (validActions.canRaise && validActions.minRaise !== undefined) {
      const minRaise = validActions.minRaise
      setRaiseAmount((prev) => (prev >= minRaise ? prev : minRaise))
    }
  }, [validActions])

  const handleAction = async (action: string, amount?: number) => {
    await performAction(action, amount)
    setRaiseAmount(0)
    setBetAmount(0)
  }

  const formatCard = (card: { rank: string; suit: string }) => {
    const suitSymbols: Record<string, string> = {
      hearts: '♥',
      diamonds: '♦',
      clubs: '♣',
      spades: '♠',
    }
    return `${card.rank}${suitSymbols[card.suit] || card.suit}`
  }

  const getSuitColor = (suit: string) => {
    return suit === 'hearts' || suit === 'diamonds' ? '#d00' : '#000'
  }

  // Show loading while checking authentication
  if (checkingAuth) {
    return (
      <div
        style={{
          maxWidth: '600px',
          margin: '0 auto',
          padding: '20px',
          textAlign: 'center',
          minHeight: '100vh',
          backgroundColor: '#1a472a',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <h2>Checking authentication...</h2>
      </div>
    )
  }

  // Join screen
  if (!joined) {
    return (
      <PlayerJoinGame
        roomCode={roomCode}
        playerName={playerName}
        setPlayerName={setPlayerName}
        onJoin={joinGame}
        error={error}
      />
    )
  }

  if (!game) {
    return (
      <div
        style={{
          padding: '50px',
          textAlign: 'center',
          minHeight: '100vh',
          backgroundColor: '#1a472a',
          color: '#fff',
        }}
      >
        Loading...
      </div>
    )
  }

  const myPlayer = game.players.find((p) => p.name === playerName)
  const isMyTurn = myPlayer && game.currentPlayerPosition === myPlayer.position

  const isShowdown = game.currentRound === 'showdown'
  const winnerPositions = Array.isArray(game.winners) ? game.winners : []
  const amWinner = !!myPlayer && winnerPositions.includes(myPlayer.position)

  const derivedMaxBet = validActions?.maxBet ?? validActions?.maxRaise ?? myPlayer?.chips ?? 0

  return (
    <div
      style={{
        padding: '12px',
        minHeight: '100vh',
        backgroundColor: '#1a472a',
        color: '#fff',
        maxWidth: '600px',
        margin: '0 auto',
      }}
    >
      <style>{buttonHoverStyle}</style>
      <div
        style={{
          textAlign: 'center',
          marginBottom: '12px',
          backgroundColor: '#234a34',
          padding: '12px',
          borderRadius: '10px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
          {playerName} • ${myPlayer?.chips || 0}
        </div>
        <div style={{ fontSize: '14px', opacity: 0.8, marginTop: '4px' }}>
          Room: {game.roomCode} | {game.currentRound}
        </div>
      </div>

      {/* Hole Cards */}
      {myPlayer?.holeCards && myPlayer.holeCards.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '10px',
            justifyContent: 'center',
            marginBottom: '12px',
          }}
        >
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
        <PlayerShowdown
          game={game}
          winnerPositions={winnerPositions}
          amWinner={amWinner}
          onNextHand={nextHand}
        />
      )}

      {/* Fold button - positioned above pot to prevent accidental touches */}
      {game.status === 'active' && isMyTurn && validActions?.canAct && validActions.canFold && (
        <button
          onClick={() => handleAction('fold')}
          style={{
            ...buttonBaseStyle,
            width: '100%',
            padding: '16px',
            fontSize: '18px',
            background: 'linear-gradient(135deg, #d32f2f 0%, #c62828 100%)',
            color: '#fff',
            marginBottom: '12px',
          }}
        >
          Fold
        </button>
      )}

      {/* Game Info */}
      <div
        style={{
          textAlign: 'center',
          padding: '10px',
          backgroundColor: '#234a34',
          borderRadius: '8px',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}
        >
          <span style={{ fontSize: '12px', opacity: 0.7 }}>Room: {game.roomCode}</span>
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: wsConnected ? '#2a5a3a' : '#5a3a2a',
              border: `1px solid ${wsConnected ? '#4f4' : '#fa4'}`,
              color: wsConnected ? '#4f4' : '#fa4',
              fontWeight: 'bold',
            }}
            title={wsConnected ? 'Connected via WebSocket' : 'Polling fallback'}
          >
            {wsConnected ? '⚡ WS' : '🔄 POLL'}
          </span>
        </div>
        <div style={{ fontSize: '18px' }}>
          {game.pots && game.pots.length > 1 ? (
            <div>
              <div>
                Pot: <strong>${game.pot}</strong>
              </div>
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
            <div>
              Pot: <strong>${game.pot}</strong>
            </div>
          )}
        </div>
        {(game.currentBet > 0 || (myPlayer && myPlayer.currentBet > 0)) && (
          <div style={{ fontSize: '14px', marginTop: '6px', opacity: 0.9 }}>
            {game.currentBet > 0 && <span>To Call: ${game.currentBet}</span>}
            {myPlayer && myPlayer.currentBet > 0 && (
              <span
                style={{
                  color: '#ff0',
                  marginLeft: game.currentBet > 0 ? '10px' : '0',
                }}
              >
                Your Bet: ${myPlayer.currentBet}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {game.status === 'waiting' && (
        <button
          onClick={startGame}
          style={{
            ...buttonBaseStyle,
            width: '100%',
            padding: '20px',
            fontSize: '20px',
            background: 'linear-gradient(135deg, #43a047 0%, #2e7d32 100%)',
            color: '#fff',
          }}
        >
          🎮 Start Game
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
                    ...buttonBaseStyle,
                    padding: '16px',
                    fontSize: '18px',
                    background: 'linear-gradient(135deg, #43a047 0%, #388e3c 100%)',
                    color: '#fff',
                  }}
                >
                  ✓ Check
                </button>
              )}
              {validActions.canBet && validActions.minBet !== undefined && (
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ marginBottom: '10px', textAlign: 'center' }}>
                    <div
                      style={{
                        fontSize: '18px',
                        fontWeight: 'bold',
                        marginBottom: '8px',
                      }}
                    >
                      Bet: ${Math.max(betAmount, validActions.minBet)}
                    </div>
                    {/* Horizontal Slider */}
                    <div
                      style={{
                        marginBottom: '12px',
                        padding: '16px',
                        background: 'linear-gradient(135deg, #2a5a3a 0%, #1f4a2f 100%)',
                        borderRadius: '12px',
                        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.3)',
                      }}
                    >
                      <HorizontalSlider
                        value={Math.max(betAmount, validActions.minBet)}
                        min={validActions.minBet}
                        max={derivedMaxBet}
                        step={1}
                        onChange={(value) => setBetAmount(value)}
                        thumbColor="#43a047"
                        trackColor="#2c3e50"
                      />
                    </div>

                    {/* +/- Buttons */}
                    <div
                      style={{
                        display: 'flex',
                        gap: '12px',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginBottom: '8px',
                      }}
                    >
                      <button
                        onClick={() =>
                          setBetAmount((prev) =>
                            Math.max(prev - (game.bigBlind || 10), validActions.minBet!),
                          )
                        }
                        style={{
                          ...buttonBaseStyle,
                          width: '64px',
                          height: '54px',
                          fontSize: '28px',
                          background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                          color: '#fff',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        −
                      </button>
                      <div
                        style={{
                          fontSize: '13px',
                          opacity: 0.8,
                          minWidth: '90px',
                          textAlign: 'center',
                          fontWeight: '500',
                        }}
                      >
                        ±${game.bigBlind || 10} BB
                      </div>
                      <button
                        onClick={() =>
                          setBetAmount((prev) =>
                            Math.min(prev + (game.bigBlind || 10), derivedMaxBet),
                          )
                        }
                        style={{
                          ...buttonBaseStyle,
                          width: '64px',
                          height: '54px',
                          fontSize: '28px',
                          background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                          color: '#fff',
                          borderRadius: '12px',
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
                      ...buttonBaseStyle,
                      width: '100%',
                      padding: '16px',
                      fontSize: '19px',
                      background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                      color: '#fff',
                    }}
                  >
                    💰 Bet ${Math.max(betAmount, validActions.minBet)}
                  </button>
                </div>
              )}
              {validActions.canCall && validActions.callAmount !== undefined && (
                <button
                  onClick={() => handleAction('call')}
                  style={{
                    ...buttonBaseStyle,
                    padding: '16px',
                    fontSize: '18px',
                    background: 'linear-gradient(135deg, #43a047 0%, #388e3c 100%)',
                    color: '#fff',
                  }}
                >
                  Call ${validActions.callAmount}
                </button>
              )}

              {validActions.canRaise &&
                validActions.minRaise !== undefined &&
                validActions.maxRaise !== undefined && (
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ marginBottom: '10px', textAlign: 'center' }}>
                      {(() => {
                        const minInc = validActions.minRaise!
                        const maxInc = validActions.maxRaise!
                        const inc = Math.min(Math.max(raiseAmount, minInc), maxInc)
                        const raiseTo = game.currentBet + inc

                        return (
                          <>
                            <div
                              style={{
                                fontSize: '18px',
                                fontWeight: 'bold',
                                marginBottom: '8px',
                              }}
                            >
                              Raise to: ${raiseTo}
                            </div>
                            {/* Horizontal Slider */}
                            <div
                              style={{
                                marginBottom: '12px',
                                padding: '16px',
                                background: 'linear-gradient(135deg, #5a3a2a 0%, #4a2f1f 100%)',
                                borderRadius: '12px',
                                boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.3)',
                              }}
                            >
                              <HorizontalSlider
                                value={inc}
                                min={validActions.minRaise}
                                max={validActions.maxRaise}
                                step={1}
                                onChange={(value) => setRaiseAmount(value)}
                                thumbColor="#ff9800"
                                trackColor="#2c3e50"
                              />
                            </div>

                            {/* +/- Buttons */}
                            <div
                              style={{
                                display: 'flex',
                                gap: '12px',
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginBottom: '8px',
                              }}
                            >
                              <button
                                onClick={() =>
                                  setRaiseAmount((prev) =>
                                    Math.max(prev - (game.bigBlind || 10), minInc),
                                  )
                                }
                                style={{
                                  ...buttonBaseStyle,
                                  width: '64px',
                                  height: '54px',
                                  fontSize: '28px',
                                  background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                                  color: '#fff',
                                  borderRadius: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                −
                              </button>
                              <div
                                style={{
                                  fontSize: '13px',
                                  opacity: 0.8,
                                  minWidth: '90px',
                                  textAlign: 'center',
                                  fontWeight: '500',
                                }}
                              >
                                ±${game.bigBlind || 10} BB
                              </div>
                              <button
                                onClick={() =>
                                  setRaiseAmount((prev) =>
                                    Math.min(prev + (game.bigBlind || 10), maxInc),
                                  )
                                }
                                style={{
                                  ...buttonBaseStyle,
                                  width: '64px',
                                  height: '54px',
                                  fontSize: '28px',
                                  background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                                  color: '#fff',
                                  borderRadius: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                +
                              </button>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                    <button
                      onClick={() => {
                        const minInc = validActions.minRaise!
                        const maxInc = validActions.maxRaise!
                        const inc = Math.min(Math.max(raiseAmount, minInc), maxInc)
                        handleAction('raise', inc)
                      }}
                      style={{
                        ...buttonBaseStyle,
                        width: '100%',
                        padding: '16px',
                        fontSize: '19px',
                        background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                        color: '#fff',
                      }}
                    >
                      {(() => {
                        const minInc = validActions.minRaise!
                        const maxInc = validActions.maxRaise!
                        const inc = Math.min(Math.max(raiseAmount, minInc), maxInc)
                        return `Raise to $${game.currentBet + inc}`
                      })()}
                    </button>
                  </div>
                )}
            </div>
          ) : (
            <div>
              {canRevealCard &&
              game.currentRound &&
              game.currentRound !== 'preflop' &&
              game.currentRound !== 'showdown' ? (
                <button
                  onClick={revealCard}
                  style={{
                    ...buttonBaseStyle,
                    width: '100%',
                    padding: '16px',
                    fontSize: '18px',
                    background: 'linear-gradient(135deg, #00acc1 0%, #0097a7 100%)',
                    color: '#fff',
                    marginBottom: '15px',
                  }}
                >
                  🃏 Reveal Next Card
                </button>
              ) : null}
              {game.currentPlayerPosition === null &&
              myPlayer &&
              myPlayer.status !== 'folded' &&
              myPlayer.status !== 'out' &&
              game.currentRound !== 'showdown' ? (
                <button
                  onClick={advanceRound}
                  style={{
                    ...buttonBaseStyle,
                    width: '100%',
                    padding: '16px',
                    fontSize: '18px',
                    background: 'linear-gradient(135deg, #5e35b1 0%, #512da8 100%)',
                    color: '#fff',
                    marginBottom: '15px',
                  }}
                >
                  {game.currentRound === 'preflop'
                    ? '🎲 Deal Flop'
                    : game.currentRound === 'flop'
                      ? '🎲 Deal Turn'
                      : game.currentRound === 'turn'
                        ? '🎲 Deal River'
                        : '👁️ Go to Showdown'}
                </button>
              ) : null}
              <div
                style={{
                  textAlign: 'center',
                  padding: '20px',
                  backgroundColor: '#456',
                  borderRadius: '10px',
                  fontSize: '18px',
                }}
              >
                {myPlayer?.status === 'folded' ? 'You folded' : 'Waiting for other players...'}
              </div>
            </div>
          )}
        </div>
      )}

      {game.status === 'completed' && (
        <div
          style={{
            textAlign: 'center',
            padding: '20px',
            backgroundColor: '#234',
            borderRadius: '10px',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              marginBottom: '10px',
            }}
          >
            🎉 Game Over!
          </div>
          <div style={{ fontSize: '18px', marginBottom: '10px' }}>
            {myPlayer && myPlayer.chips > 0
              ? `You won with $${myPlayer.chips}!`
              : 'Better luck next time!'}
          </div>
          <div style={{ fontSize: '14px', opacity: 0.7 }}>
            The game has ended. One player has all the chips.
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: '20px',
            padding: '15px',
            backgroundColor: '#fee',
            color: '#c00',
            borderRadius: '5px',
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
