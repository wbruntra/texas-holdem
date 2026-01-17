import { useParams } from 'react-router-dom'
import HorizontalSlider from '~/components/HorizontalSlider'
import PlayerJoinGame from '~/components/PlayerJoinGame'
import PlayerShowdown from '~/components/PlayerShowdown'
import PokerCard from '~/components/table/PokerCard'
import { usePlayerGame } from '~/hooks/usePlayerGame'
import { getDisplayPot } from '~/utils/potUtils'
import type { Player, Card } from '~/components/table/types'

// Import sound assets
import checkSoundUrl from '~/assets/check.mp3'
import betSoundUrl from '~/assets/bet.wav'
import foldSoundUrl from '~/assets/card_flip.mp3'

// Preload sounds
const audioMap = {
  check: new Audio(checkSoundUrl),
  bet: new Audio(betSoundUrl),
  fold: new Audio(foldSoundUrl),
}

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
    wsConnected,
    betAmount,
    raiseAmount,
    joinGame,
    startGame,
    performAction,
    nextHand,
    toggleShowCards,
    setBetAmount,
    setRaiseAmount,
  } = usePlayerGame(roomCode)

  const playSound = (type: 'check' | 'bet' | 'fold') => {
    const audio = audioMap[type]
    if (audio) {
      audio.currentTime = 0
      audio.play().catch((e) => console.log('Audio play failed', e))
    }
  }

  const handleAction = async (action: string, amount?: number) => {
    // Play sound immediately on interaction
    if (action === 'check') playSound('check')
    else if (action === 'fold') playSound('fold')
    else if (['bet', 'raise', 'call'].includes(action)) playSound('bet')

    await performAction(action, amount)
    setBetAmount(0)
    setRaiseAmount(0)
  }

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

  const myPlayer = game.players.find((p: Player) => p.name === playerName)
  const isMyTurn = myPlayer && game.currentPlayerPosition === myPlayer.position

  const isShowdown = game.currentRound === 'showdown'
  const winnerPositions = Array.isArray(game.winners) ? game.winners : []
  const amWinner = !!myPlayer && winnerPositions.includes(myPlayer.position)

  const derivedMaxBet = validActions?.maxBet ?? validActions?.maxRaise ?? myPlayer?.chips ?? 0

  const displayPot = getDisplayPot(game.players, game.pots)

  return (
    <div
      className="container-fluid d-flex flex-column min-vh-100 p-3"
      style={{ maxWidth: '600px', margin: '0 auto' }}
    >
      <div
        className={`glass-panel p-3 mb-3 d-flex flex-column gap-3 ${isMyTurn ? 'turn-active' : ''}`}
      >
        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex flex-column">
            <div className="text-secondary small text-uppercase" style={{ letterSpacing: '1px' }}>
              Player
            </div>
            <div className="fw-bold h4 mb-0">{playerName}</div>
          </div>
          <div className="d-flex flex-column align-items-end">
            <div className="text-secondary small text-uppercase" style={{ letterSpacing: '1px' }}>
              Stack
            </div>
            <div className="fw-bold h4 mb-0 text-success">${myPlayer?.chips || 0}</div>
          </div>
        </div>

        <div className="d-flex justify-content-between align-items-center border-top border-secondary border-opacity-25 pt-2">
          <div className="small">
            <span className="text-secondary">Room:</span>{' '}
            <span className="text-white fw-bold">{game.roomCode}</span>
          </div>
          <div className={`small fw-bold ${wsConnected ? 'text-success' : 'text-warning'}`}>
            {wsConnected ? '● LIVE' : '○ POLL'}
          </div>
        </div>
      </div>

      {isShowdown ? (
        <div className="glass-panel flex-grow-1 p-3">
          <PlayerShowdown
            game={game}
            winnerPositions={winnerPositions}
            amWinner={amWinner}
            onNextHand={nextHand}
            onToggleShowCards={toggleShowCards}
          />
        </div>
      ) : (
        <>
          {/* Moved Fold Button to the top for safety */}
          {game.status === 'active' &&
            isMyTurn &&
            validActions?.canAct &&
            validActions.canFold && (
              <div className="mb-3">
                <button
                  onClick={() => handleAction('fold')}
                  className="btn-poker btn-poker-danger btn-action-lg w-100"
                >
                  <span>Fold</span>
                  <span>✕</span>
                </button>
              </div>
            )}

          <div className="glass-panel flex-grow-1 p-3 d-flex flex-column justify-content-center align-items-center mb-3 text-center">
            <div className="mb-4 w-100">
              <div
                className="text-secondary text-uppercase small mb-1"
                style={{ letterSpacing: '2px' }}
              >
                Pot
              </div>
              <div
                className="display-3 fw-bold text-warning"
                style={{ textShadow: '0 2px 10px rgba(212, 175, 55, 0.3)' }}
              >
                ${displayPot}
              </div>
              {game.currentBet > 0 && (
                <div className="mt-2 text-info fw-bold">To Call: ${game.currentBet}</div>
              )}
            </div>

            {myPlayer?.holeCards && myPlayer.holeCards.length > 0 && (
              <div className="d-flex gap-3 justify-content-center mb-4">
                {myPlayer.holeCards.map((card: Card, idx: number) => (
                  <PokerCard key={idx} card={card} className="large" />
                ))}
              </div>
            )}
          </div>

          {game.status === 'active' && isMyTurn && validActions?.canAct ? (
            <div className="glass-panel p-3">
              <div className="d-grid gap-3">
                {/* Fold moved to top */}

                {validActions.canCheck && (
                  <button
                    onClick={() => handleAction('check')}
                    className="btn-poker btn-poker-primary btn-action-lg w-100"
                  >
                    <span>Check</span>
                    <span>✓</span>
                  </button>
                )}

                {validActions.canCall && validActions.callAmount !== undefined && (
                  <button
                    onClick={() => handleAction('call')}
                    className="btn-poker btn-poker-primary btn-action-lg w-100"
                  >
                    <span>Call ${validActions.callAmount}</span>
                  </button>
                )}

                {(validActions.canBet || validActions.canRaise) && (
                  <div className="d-flex flex-column gap-3">
                    <div className="bg-black bg-opacity-25 rounded-3 p-3 border border-white border-opacity-10">
                      {(() => {
                        const isRaise = validActions.canRaise
                        const minVal = isRaise ? validActions.minRaise! : validActions.minBet!
                        const maxVal = isRaise ? validActions.maxRaise! : derivedMaxBet
                        const currentVal = isRaise
                          ? Math.min(Math.max(raiseAmount, minVal), maxVal)
                          : Math.max(betAmount, minVal)
                        const setVal = isRaise ? setRaiseAmount : setBetAmount
                        const totalBet = isRaise ? game.currentBet + currentVal : currentVal

                        return (
                          <>
                            <div className="d-flex align-items-center gap-3 mb-3">
                              <button
                                className="btn-chip chip-minus"
                                onClick={() =>
                                  setVal(Math.max(currentVal - (game.bigBlind || 10), minVal))
                                }
                              >
                                −
                              </button>
                              <div className="flex-grow-1">
                                <HorizontalSlider
                                  value={currentVal}
                                  min={minVal}
                                  max={maxVal}
                                  step={1}
                                  onChange={setVal}
                                  thumbColor={isRaise ? '#ffc107' : '#0dcaf0'}
                                  trackColor="rgba(255,255,255,0.1)"
                                />
                              </div>
                              <button
                                className="btn-chip chip-plus"
                                onClick={() =>
                                  setVal(Math.min(currentVal + (game.bigBlind || 10), maxVal))
                                }
                              >
                                +
                              </button>
                            </div>
                            <button
                              onClick={() => handleAction(isRaise ? 'raise' : 'bet', currentVal)}
                              className={`btn-poker ${isRaise ? 'btn-poker-secondary' : 'btn-poker-info'} btn-action-lg w-100`}
                            >
                              <span>
                                {isRaise ? 'Raise To' : 'Bet'} ${totalBet}
                              </span>
                              <span>{isRaise ? '' : '💰'}</span>
                            </button>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : validActions?.canAdvance ? (
            <div className="glass-panel p-3">
              <div className="d-grid gap-3">
                <div className="text-center text-white mb-2">
                  {validActions.advanceReason === 'all_in_situation'
                    ? 'All players are All-In. Advance to next round?'
                    : 'Ready to advance?'}
                </div>
                <button
                  onClick={() => handleAction('advance_round')}
                  className="btn-poker btn-poker-primary btn-action-lg w-100"
                >
                  <span>Advance Round</span>
                  <span>⏩</span>
                </button>
              </div>
            </div>
          ) : (
            game.status === 'active' &&
            !isShowdown && (
              <div className="glass-panel p-3 text-center text-secondary">
                {myPlayer?.status === 'folded' ? (
                  <div>
                    <div className="h4 text-danger mb-1">Folded</div>
                    <div className="small">Waiting for next hand</div>
                  </div>
                ) : (
                  <div>
                    <div className="spinner-border spinner-border-sm text-secondary mb-2"></div>
                    <div>Waiting for action...</div>
                  </div>
                )}
              </div>
            )
          )}
        </>
      )}

      {game.status === 'waiting' && (
        <button
          onClick={startGame}
          className="btn-poker btn-poker-primary btn-action-lg w-100 mt-auto"
        >
          Start Game
        </button>
      )}
    </div>
  )
}
