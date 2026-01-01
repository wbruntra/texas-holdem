import type { GameState, Player, ValidActions } from '../hooks/usePlayerGameLogic'
import HorizontalSlider from './HorizontalSlider'
import {
  buttonBaseStyle,
  buttonStyles,
  containerStyles,
  cardStyles,
  inputStyles,
  loaderStyles,
  errorStyles,
} from '../styles/playerViewStyles'

interface PlayerViewDisplayProps {
  checkingAuth: boolean
  joined: boolean
  game: GameState | null
  myPlayer: Player | undefined
  isMyTurn: boolean
  isShowdown: boolean
  amWinner: boolean
  wsConnected: boolean
  validActions: ValidActions | null
  betAmount: number
  raiseAmount: number
  canRevealCard: boolean
  error: string
  playerName: string
  password: string
  onPlayerNameChange: (name: string) => void
  onPasswordChange: (password: string) => void
  onJoin: (name: string, password: string) => void
  onStartGame: () => void
  onFold: () => void
  onCheck: () => void
  onBet: (amount: number) => void
  onCall: () => void
  onRaise: (amount: number) => void
  onNextHand: () => void
  onRevealCard: () => void
  onAdvanceRound: () => void
  onBetAmountChange: (amount: number) => void
  onRaiseAmountChange: (amount: number) => void
}

export default function PlayerViewDisplay({
  checkingAuth,
  joined,
  game,
  myPlayer,
  isMyTurn,
  isShowdown,
  amWinner,
  wsConnected,
  validActions,
  betAmount,
  raiseAmount,
  canRevealCard,
  error,
  playerName,
  password,
  onPlayerNameChange,
  onPasswordChange,
  onJoin,
  onStartGame,
  onFold,
  onCheck,
  onBet,
  onCall,
  onRaise,
  onNextHand,
  onRevealCard,
  onAdvanceRound,
  onBetAmountChange,
  onRaiseAmountChange,
}: PlayerViewDisplayProps) {
  // Show loading while checking authentication
  if (checkingAuth) {
    return (
      <div style={loaderStyles.container}>
        <h2>Checking authentication...</h2>
      </div>
    )
  }

  // Join screen
  if (!joined) {
    return (
      <div style={loaderStyles.container}>
        <h1>Join Game</h1>
        <p>Room: {game?.roomCode}</p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            onJoin(playerName, password)
          }}
          style={{
            marginTop: '30px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <input
            type="text"
            placeholder="Your Name"
            value={playerName}
            maxLength={10}
            onChange={(e) => onPlayerNameChange(e.target.value)}
            style={inputStyles.text}
          />

          <input
            type="text"
            placeholder="Security Word (min 4 chars)"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            style={inputStyles.password}
          />

          <button
            type="submit"
            disabled={!playerName.trim() || password.length < 4}
            style={{
              ...buttonBaseStyle,
              width: '100%',
              maxWidth: '200px',
              padding: '15px',
              fontSize: '18px',
              ...buttonStyles.primary,
            }}
          >
            Join Game
          </button>
        </form>

        {error && <div style={errorStyles}>{error}</div>}
      </div>
    )
  }

  if (!game) {
    return <div style={{ ...loaderStyles.container, minHeight: '100vh' }}>Loading...</div>
  }

  const derivedMaxBet = validActions?.maxBet ?? validActions?.maxRaise ?? myPlayer?.chips ?? 0
  const winnerPositions = Array.isArray(game.winners) ? game.winners : []

  return (
    <div style={containerStyles.main}>
      <style>{`
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
      `}</style>

      {/* Header */}
      <div style={containerStyles.header}>
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
          style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '12px' }}
        >
          {myPlayer.holeCards.map((card, idx) => (
            <div
              key={idx}
              style={{
                ...cardStyles.holeCard,
                color: card.suit === 'hearts' || card.suit === 'diamonds' ? '#d00' : '#000',
              }}
            >
              {formatCard(card)}
            </div>
          ))}
        </div>
      )}

      {/* Showdown */}
      {isShowdown && (
        <div
          style={{
            marginBottom: '20px',
            padding: '16px',
            backgroundColor: '#234a34',
            borderRadius: '10px',
            border: '2px solid #456',
          }}
        >
          <h3 style={{ textAlign: 'center', marginTop: 0 }}>Showdown</h3>

          {winnerPositions.length > 0 && (
            <div style={{ textAlign: 'center', marginBottom: '12px', fontSize: '18px' }}>
              Winner{winnerPositions.length > 1 ? 's' : ''}:{' '}
              <strong>
                {game.players
                  .filter((p) => winnerPositions.includes(p.position))
                  .map((p) => p.name)
                  .join(', ')}
              </strong>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '12px',
            }}
          >
            {game.players.map((p) => (
              <div
                key={p.id}
                style={{
                  backgroundColor: winnerPositions.includes(p.position) ? '#2a5a3a' : '#1a472a',
                  border: winnerPositions.includes(p.position)
                    ? '2px solid gold'
                    : '2px solid #456',
                  borderRadius: '10px',
                  padding: '12px',
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '18px' }}>
                  {p.name}
                  {winnerPositions.includes(p.position) ? ' 🏆' : ''}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(p.holeCards || []).length > 0 ? (
                    p.holeCards!.map((card, idx) => (
                      <div
                        key={idx}
                        style={{
                          ...cardStyles.showdownCard,
                          color:
                            card.suit === 'hearts' || card.suit === 'diamonds' ? '#d00' : '#000',
                        }}
                      >
                        {formatCard(card)}
                      </div>
                    ))
                  ) : (
                    <>
                      <div style={cardStyles.faceDownCard}>🂠</div>
                      <div style={cardStyles.faceDownCard}>🂠</div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={onNextHand}
            style={{
              ...buttonBaseStyle,
              width: '100%',
              marginTop: '14px',
              padding: '16px',
              fontSize: '18px',
              ...(amWinner
                ? {
                    background: 'linear-gradient(135deg, #ffc107 0%, #ffb300 100%)',
                    color: '#000',
                  }
                : buttonStyles.primary),
            }}
          >
            {amWinner ? '🏆 Next Hand' : 'Start Next Hand'}
          </button>
        </div>
      )}

      {/* Fold button */}
      {game.status === 'active' && isMyTurn && validActions?.canAct && validActions.canFold && (
        <button
          onClick={onFold}
          style={{
            ...buttonBaseStyle,
            width: '100%',
            padding: '16px',
            fontSize: '18px',
            marginBottom: '12px',
            ...buttonStyles.danger,
          }}
        >
          🚫 Fold
        </button>
      )}

      {/* Game Info */}
      <div style={containerStyles.gameInfo}>
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
          onClick={onStartGame}
          style={{
            ...buttonBaseStyle,
            width: '100%',
            padding: '20px',
            fontSize: '20px',
            ...buttonStyles.primary,
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
                  onClick={onCheck}
                  style={{
                    ...buttonBaseStyle,
                    padding: '16px',
                    fontSize: '18px',
                    ...buttonStyles.secondary,
                  }}
                >
                  ✓ Check
                </button>
              )}

              {validActions.canBet && validActions.minBet !== undefined && (
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ marginBottom: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
                      Bet: ${Math.max(betAmount, validActions.minBet)}
                    </div>

                    <div
                      style={{ ...containerStyles.sliderContainer, ...containerStyles.betSlider }}
                    >
                      <HorizontalSlider
                        value={Math.max(betAmount, validActions.minBet)}
                        min={validActions.minBet}
                        max={derivedMaxBet}
                        step={1}
                        onChange={onBetAmountChange}
                        thumbColor="#43a047"
                        trackColor="#2c3e50"
                      />
                    </div>

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
                          onBetAmountChange(
                            Math.max(betAmount - (game.bigBlind || 10), validActions.minBet!),
                          )
                        }
                        style={{
                          ...buttonBaseStyle,
                          width: '64px',
                          height: '54px',
                          fontSize: '28px',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          ...buttonStyles.bet,
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
                          onBetAmountChange(
                            Math.min(betAmount + (game.bigBlind || 10), derivedMaxBet),
                          )
                        }
                        style={{
                          ...buttonBaseStyle,
                          width: '64px',
                          height: '54px',
                          fontSize: '28px',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          ...buttonStyles.bet,
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => onBet(Math.max(betAmount, validActions.minBet!))}
                    style={{
                      ...buttonBaseStyle,
                      width: '100%',
                      padding: '16px',
                      fontSize: '19px',
                      ...buttonStyles.bet,
                    }}
                  >
                    💰 Bet ${Math.max(betAmount, validActions.minBet)}
                  </button>
                </div>
              )}

              {validActions.canCall && validActions.callAmount !== undefined && (
                <button
                  onClick={onCall}
                  style={{
                    ...buttonBaseStyle,
                    padding: '16px',
                    fontSize: '18px',
                    ...buttonStyles.secondary,
                  }}
                >
                  📞 Call ${validActions.callAmount}
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
                              style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}
                            >
                              Raise to: ${raiseTo}
                            </div>

                            <div
                              style={{
                                ...containerStyles.sliderContainer,
                                ...containerStyles.raiseSlider,
                              }}
                            >
                              <HorizontalSlider
                                value={inc}
                                min={validActions.minRaise}
                                max={validActions.maxRaise}
                                step={1}
                                onChange={onRaiseAmountChange}
                                thumbColor="#ff9800"
                                trackColor="#2c3e50"
                              />
                            </div>

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
                                  onRaiseAmountChange(
                                    Math.max(raiseAmount - (game.bigBlind || 10), minInc),
                                  )
                                }
                                style={{
                                  ...buttonBaseStyle,
                                  width: '64px',
                                  height: '54px',
                                  fontSize: '28px',
                                  borderRadius: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  ...buttonStyles.raise,
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
                                  onRaiseAmountChange(
                                    Math.min(raiseAmount + (game.bigBlind || 10), maxInc),
                                  )
                                }
                                style={{
                                  ...buttonBaseStyle,
                                  width: '64px',
                                  height: '54px',
                                  fontSize: '28px',
                                  borderRadius: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  ...buttonStyles.raise,
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
                        onRaise(inc)
                      }}
                      style={{
                        ...buttonBaseStyle,
                        width: '100%',
                        padding: '16px',
                        fontSize: '19px',
                        ...buttonStyles.raise,
                      }}
                    >
                      {(() => {
                        const minInc = validActions.minRaise!
                        const maxInc = validActions.maxRaise!
                        const inc = Math.min(Math.max(raiseAmount, minInc), maxInc)
                        return `🚀 Raise to $${game.currentBet + inc}`
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
                  onClick={onRevealCard}
                  style={{
                    ...buttonBaseStyle,
                    width: '100%',
                    padding: '16px',
                    fontSize: '18px',
                    marginBottom: '15px',
                    ...buttonStyles.special,
                  }}
                >
                  🎴 Reveal Next Card
                </button>
              ) : null}
              {game.currentPlayerPosition === null &&
              myPlayer &&
              myPlayer.status !== 'folded' &&
              myPlayer.status !== 'out' &&
              game.currentRound !== 'showdown' ? (
                <button
                  onClick={onAdvanceRound}
                  style={{
                    ...buttonBaseStyle,
                    width: '100%',
                    padding: '16px',
                    fontSize: '18px',
                    marginBottom: '15px',
                    ...buttonStyles.advance,
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
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>
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

      {error && <div style={errorStyles}>{error}</div>}
    </div>
  )
}

function formatCard(card: { rank: string; suit: string }) {
  const suitSymbols: Record<string, string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
  }
  return `${card.rank}${suitSymbols[card.suit] || card.suit}`
}
