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
    toggleShowCards,
  } = usePlayerGame(roomCode)

  const [raiseAmount, setRaiseAmount] = useState<number>(0)
  const [betAmount, setBetAmount] = useState<number>(0)

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

  const getSuitClass = (suit: string) => {
    return suit === 'hearts' || suit === 'diamonds' ? 'card-red' : 'card-black'
  }

  // Show loading while checking authentication
  if (checkingAuth) {
    return (
      <div className="container d-flex flex-column justify-content-center align-items-center min-vh-100 text-white text-center">
        <div className="spinner-border text-primary mb-3" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
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
      <div className="container d-flex flex-column justify-content-center align-items-center min-vh-100 text-white text-center">
        <div className="spinner-grow text-success mb-3" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <h2>Loading game state...</h2>
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
    <div className="container py-2" style={{ maxWidth: '480px' }}>
      {/* Unified Dashboard */}
      <div className="card bg-dark text-white border-secondary p-3 pt-1 mb-3 shadow-sm">
        <div className="card-body p-2">
          {/* Top Row: Name & Chips */}
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div className="fw-bold text-truncate" style={{ maxWidth: '60%' }}>
              {playerName}
            </div>
            <div className="badge bg-success bg-opacity-25 text-success fs-6">
              ${myPlayer?.chips || 0}
            </div>
          </div>

          {/* Center: Pot & Table Info */}
          <div className="text-center bg-black bg-opacity-25 rounded p-2 mb-2 border border-secondary border-opacity-25">
            <div
              className="small text-secondary text-uppercase"
              style={{ fontSize: '0.7rem', letterSpacing: '1px' }}
            >
              Total Pot
            </div>
            <div className="h2 text-warning mb-0 fw-bold">${game.pot}</div>

            {game.pots && game.pots.length > 1 && (
              <div className="d-flex justify-content-center gap-2 mt-1">
                {game.pots.map((pot, idx) => (
                  <span
                    key={idx}
                    className="badge bg-secondary bg-opacity-50 text-light"
                    style={{ fontSize: '0.6rem' }}
                  >
                    {idx === 0 ? 'Main' : `Side ${idx}`}: ${pot.amount}
                  </span>
                ))}
              </div>
            )}

            {(game.currentBet > 0 || (myPlayer && myPlayer.currentBet > 0)) && (
              <div className="d-flex justify-content-center gap-3 mt-2 pt-2 border-top border-secondary border-opacity-25">
                {game.currentBet > 0 && (
                  <div className="small text-info fw-bold">To Call: ${game.currentBet}</div>
                )}
                {myPlayer && myPlayer.currentBet > 0 && (
                  <div className="small text-warning">Your Bet: ${myPlayer.currentBet}</div>
                )}
              </div>
            )}
          </div>

          {/* Bottom: Meta Info */}
          <div
            className="d-flex justify-content-between align-items-center text-secondary px-1"
            style={{ fontSize: '0.75rem' }}
          >
            <div>
              Room: <span className="text-light">{game.roomCode}</span>
            </div>
            <div className="text-capitalize">{game.currentRound}</div>
            <div className={wsConnected ? 'text-success' : 'text-warning'}>
              {wsConnected ? '⚡ Connected' : '🔄 Polling'}
            </div>
          </div>
        </div>
      </div>

      {/* Fold button - positioned above cards to prevent mis-clicks */}
      {game.status === 'active' && isMyTurn && validActions?.canAct && validActions.canFold && (
        <div className="mb-3 px-2">
          <button
            onClick={() => handleAction('fold')}
            className="btn btn-danger btn-lg w-100 fw-bold shadow-sm py-3"
          >
            Fold
          </button>
        </div>
      )}

      {/* Hole Cards */}
      {myPlayer?.holeCards && myPlayer.holeCards.length > 0 && (
        <div className="d-flex gap-2 justify-content-center mb-4">
          {myPlayer.holeCards.map((card, idx) => (
            <div key={idx} className={`card-display ${getSuitClass(card.suit)}`}>
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
          onToggleShowCards={toggleShowCards}
        />
      )}

      {/* Actions */}
      <div className="px-1">
        {game.status === 'waiting' && (
          <button onClick={startGame} className="btn btn-success btn-lg w-100 py-3 fw-bold shadow">
            🎮 Start Game
          </button>
        )}

        {game.status === 'active' && (
          <div>
            {isMyTurn && validActions?.canAct ? (
              <div className="d-grid gap-3">
                {validActions.canCheck && (
                  <button
                    onClick={() => handleAction('check')}
                    className="btn btn-success btn-lg fw-bold py-3"
                  >
                    ✓ Check
                  </button>
                )}

                {validActions.canBet && validActions.minBet !== undefined && (
                  <div className="card bg-dark bg-opacity-50 border-secondary p-2 text-center shadow-sm">
                    <div className="mb-3 bg-dark rounded px-2 py-3 shadow-inner">
                      <HorizontalSlider
                        value={Math.max(betAmount, validActions.minBet)}
                        min={validActions.minBet}
                        max={derivedMaxBet}
                        step={1}
                        onChange={(value) => setBetAmount(value)}
                        thumbColor="#0dcaf0"
                        trackColor="#2c3e50"
                      />
                    </div>

                    <div className="d-flex gap-2 justify-content-center align-items-center mb-2">
                      <button
                        onClick={() =>
                          setBetAmount((prev) =>
                            Math.max(prev - (game.bigBlind || 10), validActions.minBet!),
                          )
                        }
                        className="btn btn-outline-info rounded-circle p-0 d-flex align-items-center justify-content-center"
                        style={{ width: '40px', height: '40px', fontSize: '18px' }}
                      >
                        −
                      </button>
                      <div className="text-info fw-bold small" style={{ minWidth: '60px' }}>
                        ±${game.bigBlind || 10}
                      </div>
                      <button
                        onClick={() =>
                          setBetAmount((prev) =>
                            Math.min(prev + (game.bigBlind || 10), derivedMaxBet),
                          )
                        }
                        className="btn btn-outline-info rounded-circle p-0 d-flex align-items-center justify-content-center"
                        style={{ width: '40px', height: '40px', fontSize: '18px' }}
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() =>
                        handleAction('bet', Math.max(betAmount, validActions.minBet!))
                      }
                      className="btn btn-info w-100 fw-bold py-2 text-white"
                    >
                      💰 Bet ${Math.max(betAmount, validActions.minBet)}
                    </button>
                  </div>
                )}

                {validActions.canCall && validActions.callAmount !== undefined && (
                  <button
                    onClick={() => handleAction('call')}
                    className="btn btn-success btn-lg fw-bold py-3"
                  >
                    Call ${validActions.callAmount}
                  </button>
                )}

                {validActions.canRaise &&
                  validActions.minRaise !== undefined &&
                  validActions.maxRaise !== undefined && (
                    <div className="card bg-dark bg-opacity-50 border-secondary p-2 text-center shadow-sm">
                      {(() => {
                        const minInc = validActions.minRaise!
                        const maxInc = validActions.maxRaise!
                        const inc = Math.min(Math.max(raiseAmount, minInc), maxInc)

                        return (
                          <>
                            <div className="mb-3 bg-dark rounded px-2 py-3 shadow-inner">
                              <HorizontalSlider
                                value={inc}
                                min={validActions.minRaise}
                                max={validActions.maxRaise}
                                step={1}
                                onChange={(value) => setRaiseAmount(value)}
                                thumbColor="#ffc107"
                                trackColor="#2c3e50"
                              />
                            </div>

                            <div className="d-flex gap-2 justify-content-center align-items-center mb-2">
                              <button
                                onClick={() =>
                                  setRaiseAmount((prev) =>
                                    Math.max(prev - (game.bigBlind || 10), minInc),
                                  )
                                }
                                className="btn btn-outline-warning rounded-circle p-0 d-flex align-items-center justify-content-center"
                                style={{ width: '40px', height: '40px', fontSize: '18px' }}
                              >
                                −
                              </button>
                              <div
                                className="text-warning fw-bold small"
                                style={{ minWidth: '60px' }}
                              >
                                ±${game.bigBlind || 10}
                              </div>
                              <button
                                onClick={() =>
                                  setRaiseAmount((prev) =>
                                    Math.min(prev + (game.bigBlind || 10), maxInc),
                                  )
                                }
                                className="btn btn-outline-warning rounded-circle p-0 d-flex align-items-center justify-content-center"
                                style={{ width: '40px', height: '40px', fontSize: '18px' }}
                              >
                                +
                              </button>
                            </div>

                            <button
                              onClick={() => {
                                const minInc = validActions.minRaise!
                                const maxInc = validActions.maxRaise!
                                const inc = Math.min(Math.max(raiseAmount, minInc), maxInc)
                                handleAction('raise', inc)
                              }}
                              className="btn btn-warning w-100 fw-bold py-2"
                            >
                              Raise to ${game.currentBet + inc}
                            </button>
                          </>
                        )
                      })()}
                    </div>
                  )}
              </div>
            ) : (
              <div className="text-center">
                {canRevealCard &&
                game.currentRound &&
                game.currentRound !== 'preflop' &&
                game.currentRound !== 'showdown' ? (
                  <button
                    onClick={revealCard}
                    className="btn btn-info btn-lg w-100 py-3 fw-bold mb-3 shadow"
                  >
                    {game.currentRound === 'river' ? '🏆 Go to Showdown' : '🃏 Reveal Next Card'}
                  </button>
                ) : null}

                {!canRevealCard &&
                game.currentPlayerPosition === null &&
                myPlayer &&
                myPlayer.status !== 'folded' &&
                myPlayer.status !== 'out' &&
                game.currentRound !== 'showdown' ? (
                  <button
                    onClick={advanceRound}
                    className="btn btn-primary btn-lg w-100 py-3 fw-bold mb-3 shadow"
                  >
                    {(() => {
                      const activeCount = game.players.filter((p) => p.status === 'active').length
                      const allInCount = game.players.filter((p) => p.status === 'all_in').length
                      if (activeCount <= 1 && allInCount === 0) return '🏆 Claim Pot'

                      return game.currentRound === 'preflop'
                        ? '🎲 Deal Flop'
                        : game.currentRound === 'flop'
                          ? '🎲 Deal Turn'
                          : game.currentRound === 'turn'
                            ? '🎲 Deal River'
                            : '👁️ Go to Showdown'
                    })()}
                  </button>
                ) : (
                  <div className="alert alert-secondary py-3">
                    {myPlayer?.status === 'folded' ? 'You folded' : 'Waiting for other players...'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {game.status === 'completed' && (
          <div className="alert alert-info text-center py-4 shadow">
            <h4 className="alert-heading mb-3">🎉 Game Over!</h4>
            <div className="mb-2 h5">
              {myPlayer && myPlayer.chips > 0
                ? `You won with $${myPlayer.chips}!`
                : 'Better luck next time!'}
            </div>
            <hr />
            <div className="small text-muted border-0">
              The game has ended. One player has all the chips.
            </div>
          </div>
        )}

        {error && <div className="alert alert-danger text-center mt-3">{error}</div>}
      </div>
    </div>
  )
}
