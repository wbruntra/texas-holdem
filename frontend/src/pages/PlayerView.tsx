import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Offcanvas, Button } from 'react-bootstrap'
import HorizontalSlider from '~/components/HorizontalSlider'
import PlayerJoinGame from '~/components/PlayerJoinGame'
import PlayerShowdown from '~/components/PlayerShowdown'
import PokerCard from '~/components/table/PokerCard'
import PotWinAnimation, { type WinnerPayout } from '~/components/table/PotWinAnimation'
import { usePlayerGame } from '~/hooks/usePlayerGame'
import { getDisplayPot } from '~/utils/potUtils'
import type { Player, Card } from '~/components/table/types'
import { createMockPlayerViewState } from '~/dev/mock-player-view'

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
  const [showCommunityCards, setShowCommunityCards] = useState(false)
  const [isActing, setIsActing] = useState(false)
  const [showFoldWarning, setShowFoldWarning] = useState(false)
  const [animatingWinners, setAnimatingWinners] = useState<WinnerPayout[]>([])
  const previousWinnersRef = useRef<string>('')
  const [seatPositions, setSeatPositions] = useState<Map<number, { left: number; top: number }>>(
    new Map(),
  )

  const {
    game: liveGame,
    validActions: liveValidActions,
    playerName: livePlayerName,
    setPlayerName,
    joined: liveJoined,
    error,
    checkingAuth: liveCheckingAuth,
    betAmount: liveBetAmount,
    raiseAmount: liveRaiseAmount,
    joinGame: liveJoinGame,
    startGame: liveStartGame,
    performAction: livePerformAction,
    nextHand: liveNextHand,
    toggleShowCards: liveToggleShowCards,
    setBetAmount: liveSetBetAmount,
    setRaiseAmount: liveSetRaiseAmount,
  } = usePlayerGame(roomCode)

  const isMockMode =
    import.meta.env.DEV && new URLSearchParams(window.location.search).get('mock') === 'showdown'
  const mockState = useMemo(
    () => createMockPlayerViewState(roomCode, livePlayerName),
    [roomCode, livePlayerName],
  )

  const game = isMockMode ? mockState.game : liveGame
  const validActions = isMockMode ? mockState.validActions : liveValidActions
  const playerName = isMockMode ? mockState.playerName : livePlayerName
  const joined = isMockMode ? true : liveJoined
  const checkingAuth = isMockMode ? false : liveCheckingAuth
  const betAmount = isMockMode ? mockState.betAmount : liveBetAmount
  const raiseAmount = isMockMode ? mockState.raiseAmount : liveRaiseAmount
  const joinGame = isMockMode ? async () => {} : liveJoinGame
  const startGame = isMockMode ? async () => {} : liveStartGame
  const performAction = isMockMode ? async () => {} : livePerformAction
  const nextHand = isMockMode ? async () => {} : liveNextHand
  const toggleShowCards = isMockMode ? async () => {} : liveToggleShowCards
  const setBetAmount = isMockMode ? () => {} : liveSetBetAmount
  const setRaiseAmount = isMockMode ? () => {} : liveSetRaiseAmount

  // Animation complete handler
  const handleAnimationComplete = useCallback(() => {
    setAnimatingWinners([])
  }, [])

  // Detect when winners are announced and trigger animation
  useEffect(() => {
    if (!game) {
      setAnimatingWinners([])
      previousWinnersRef.current = ''
      return
    }

    const isShowdown = game.currentRound === 'showdown'
    const fallbackWinners = Array.isArray(game.winners) ? game.winners : []
    const potWinners = (game.pots || []).flatMap((pot) => pot.winners || [])
    const resolvedWinners = fallbackWinners.length > 0 ? fallbackWinners : potWinners
    const hasWinners = resolvedWinners.length > 0
    const hasPots = game.pots && game.pots.length > 0

    if (!isShowdown || !hasWinners || !hasPots) {
      setAnimatingWinners([])
      previousWinnersRef.current = ''
      return
    }

    // Create unique key for current winners state
    const winnersKey = `${resolvedWinners.join(',')}-${game.pots?.map((p) => p.amount).join(',')}`

    // Only trigger animation if winners changed
    if (winnersKey === previousWinnersRef.current) return
    previousWinnersRef.current = winnersKey

    // Calculate payouts for animation
    const payouts: WinnerPayout[] = []
    game.pots?.forEach((pot) => {
      const potWinners = pot.winners && pot.winners.length > 0 ? pot.winners : fallbackWinners
      if (!potWinners || potWinners.length === 0) return

      const winAmount = pot.winAmount || Math.floor(pot.amount / potWinners.length)
      potWinners.forEach((position) => {
        const player = game.players.find((p) => p.position === position)
        if (player) {
          payouts.push({
            playerId: player.id,
            position,
            amount: winAmount,
            name: player.name,
          })
        }
      })
    })

    if (payouts.length > 0) {
      setAnimatingWinners(payouts)
    }
  }, [game])

  const playSound = (type: 'check' | 'bet' | 'fold') => {
    const audio = audioMap[type]
    if (audio) {
      audio.currentTime = 0
      audio.play().catch((e) => console.log('Audio play failed', e))
    }
  }

  const handleAction = async (action: string, amount?: number) => {
    if (isActing) return

    setIsActing(true)
    try {
      // Play sound immediately on interaction
      if (action === 'check') playSound('check')
      else if (action === 'fold') playSound('fold')
      else if (['bet', 'raise', 'call'].includes(action)) playSound('bet')

      await performAction(action, amount)
      // Removed manual reset of betAmount/raiseAmount to prevent flicker
    } catch (e) {
      console.error('Action failed', e)
    } finally {
      setIsActing(false)
    }
  }

  const myPlayer = useMemo(
    () => game?.players?.find((p: Player) => p.name === playerName) ?? null,
    [game?.players, playerName],
  )
  const isMyTurn = !!myPlayer && game?.currentPlayerPosition === myPlayer.position

  // Dismiss fold warning when it's no longer the player's turn
  useEffect(() => {
    if (!isMyTurn) setShowFoldWarning(false)
  }, [isMyTurn])
  const isShowdown = game?.currentRound === 'showdown'
  const winnerPositions = useMemo(
    () => (Array.isArray(game?.winners) ? (game?.winners ?? []) : []),
    [game?.winners],
  )
  const amWinner = !!myPlayer && winnerPositions.includes(myPlayer.position)
  const derivedMaxBet = validActions?.maxBet ?? validActions?.maxRaise ?? myPlayer?.chips ?? 0
  const displayPot = game ? getDisplayPot(game.players, game.pots) : 0
  const shouldShowFab = game?.status === 'active'

  const handleSeatPositionsChange = useCallback(
    (positions: Map<number, { left: number; top: number }>) => {
      setSeatPositions(positions)
    },
    [],
  )

  // Early returns after all hooks
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

  return (
    <div
      className="container-fluid d-flex flex-column min-vh-100 p-3"
      style={{ maxWidth: '600px', margin: '0 auto', position: 'relative' }}
    >
      {/* Slide-out Sheet for Community Cards */}

      <Offcanvas
        show={showCommunityCards}
        onHide={() => setShowCommunityCards(false)}
        placement="bottom"
        className="text-bg-dark border-top border-secondary"
        style={{ height: 'auto', minHeight: '40vh', maxHeight: '60vh' }}
      >
        <Offcanvas.Header closeButton closeVariant="white">
          <Offcanvas.Title>Community Cards</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="d-flex flex-column align-items-center">
          <div className="d-flex gap-2 justify-content-center flex-wrap mb-4">
            {game.communityCards && game.communityCards.length > 0 ? (
              game.communityCards.map((card: Card, idx: number) => (
                <PokerCard key={idx} card={card} className="medium" />
              ))
            ) : (
              <div className="text-secondary fst-italic">No community cards dealt yet</div>
            )}
          </div>
          <div className="mt-auto w-100">
            <h6 className="text-secondary text-uppercase small mb-2 border-bottom border-secondary pb-1 text-center">
              Table Status
            </h6>
            <div className="d-flex flex-wrap gap-2 justify-content-center">
              {game.players.map((p: Player) => {
                const isMe = p.name === playerName
                const isActive = p.position === game.currentPlayerPosition
                const isDealer = p.position === game.dealerPosition
                const isWinner = winnerPositions.includes(p.position)

                return (
                  <div
                    key={p.id}
                    className={`d-flex flex-column align-items-center p-2 rounded text-center ${
                      isActive
                        ? 'bg-primary bg-opacity-25 border border-primary border-opacity-50 shadow'
                        : 'bg-black bg-opacity-25 border border-white border-opacity-10'
                    }`}
                    style={{ minWidth: '80px', flex: '1 1 auto' }}
                  >
                    <div className="d-flex align-items-center gap-1 mb-1">
                      {isDealer && (
                        <span
                          className="badge bg-light text-dark rounded-circle d-flex align-items-center justify-content-center p-0"
                          style={{ width: '16px', height: '16px', fontSize: '9px' }}
                        >
                          D
                        </span>
                      )}
                      <div
                        className={`fw-bold small text-truncate ${isMe ? 'text-info' : 'text-white'}`}
                        style={{ maxWidth: '80px', fontSize: '0.8rem' }}
                      >
                        {p.name}
                      </div>
                    </div>

                    <div className="lh-1">
                      {p.status !== 'active' ? (
                        <span
                          className={`text-uppercase x-small fw-bold ${
                            p.status === 'folded'
                              ? 'text-secondary'
                              : p.status === 'all_in'
                                ? 'text-danger'
                                : 'text-muted'
                          }`}
                          style={{ fontSize: '0.7rem' }}
                        >
                          {p.status === 'all_in' ? 'ALL-IN' : p.status}
                        </span>
                      ) : isWinner && isShowdown ? (
                        <span className="text-warning small" style={{ fontSize: '0.7rem' }}>
                          🏆 WIN
                        </span>
                      ) : (
                        <div
                          className="font-monospace text-success fw-bold"
                          style={{ fontSize: '0.9rem' }}
                        >
                          ${p.chips}
                        </div>
                      )}
                    </div>
                    {(p.status !== 'active' || (isWinner && isShowdown)) && (
                      <div
                        className="font-monospace text-success fw-bold mt-1"
                        style={{ fontSize: '0.75rem', opacity: 0.8 }}
                      >
                        ${p.chips}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </Offcanvas.Body>
      </Offcanvas>

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

          {shouldShowFab && (
            <Button
              variant="dark"
              size="sm"
              className="d-flex align-items-center justify-content-center gap-1 px-3 border border-info border-opacity-50"
              style={{ height: '32px', background: 'rgba(13, 202, 240, 0.12)' }}
              onClick={() => setShowCommunityCards(!showCommunityCards)}
            >
              <span style={{ fontSize: '16px' }}>🃏</span>
              <span className="small text-info">Board</span>
            </Button>
          )}

          <div className="d-flex flex-column align-items-end">
            <div className="text-secondary small text-uppercase" style={{ letterSpacing: '1px' }}>
              Stack
            </div>
            <div className="fw-bold h4 mb-0 text-success">${myPlayer?.chips || 0}</div>
          </div>
        </div>

        <div
          className="border-top border-secondary border-opacity-25 pt-2 align-items-center"
          style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr' }}
        >
          <div className="small text-start">
            <span className="text-secondary">Room:</span>{' '}
            <span className="text-white fw-bold">{game.roomCode}</span>
          </div>
          <div className="d-flex justify-content-center">
            {game.currentRound && game.status === 'active' && (
              <div
                className="badge bg-dark border border-secondary text-white fw-bold text-uppercase"
                style={{ fontSize: '0.68rem', letterSpacing: '1px' }}
              >
                {game.currentRound.replace('preflop', 'Pre-Flop')}
              </div>
            )}
          </div>
          {game.status === 'active' && (
            <div className="d-flex flex-column align-items-end">
              {game.handNumber !== undefined && (
                <div className="text-white fw-bold" style={{ fontSize: '0.78rem' }}>
                  Hand {game.handNumber + 1}
                </div>
              )}
              {(game.smallBlind || game.bigBlind) && (
                <div className="text-secondary font-monospace" style={{ fontSize: '0.72rem' }}>
                  {game.smallBlind ?? game.bigBlind! / 2}/{game.bigBlind}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isShowdown ? (
        <div className="d-flex flex-column flex-grow-1 gap-3">
          <div className="glass-panel p-3 text-center">
            <div
              className="text-secondary text-uppercase small mb-1"
              style={{ letterSpacing: '2px' }}
            >
              Pot
            </div>
            <div
              className="display-4 fw-bold text-warning"
              style={{ textShadow: '0 2px 10px rgba(212, 175, 55, 0.3)' }}
            >
              ${displayPot}
            </div>
            <div className="d-flex justify-content-center gap-2 mt-2">
              <div
                className="rounded-circle"
                style={{ width: '16px', height: '16px', background: '#ffd700' }}
              />
              <div
                className="rounded-circle"
                style={{ width: '16px', height: '16px', background: '#9b59b6' }}
              />
              <div
                className="rounded-circle"
                style={{ width: '16px', height: '16px', background: '#2c3e50' }}
              />
            </div>
          </div>
          <div className="glass-panel flex-grow-1 p-3">
            <PlayerShowdown
              game={game}
              winnerPositions={winnerPositions}
              amWinner={amWinner}
              onNextHand={nextHand}
              onToggleShowCards={toggleShowCards}
              onSeatPositionsChange={handleSeatPositionsChange}
            />
          </div>
        </div>
      ) : (
        <>
          {/* Fold button - always visible during active hand */}
          {game.status === 'active' && !isShowdown && (
            <div className="mb-3">
              {showFoldWarning && validActions?.canCheck ? (
                <div
                  className="rounded-3 p-3 border border-warning border-opacity-75"
                  style={{ background: 'rgba(255, 193, 7, 0.1)' }}
                >
                  <div className="text-warning fw-bold mb-2 text-center small">
                    You can check for free — fold anyway?
                  </div>
                  <div className="d-flex gap-2">
                    <button
                      onClick={() => {
                        setShowFoldWarning(false)
                        handleAction('check')
                      }}
                      disabled={isActing}
                      className="btn-poker btn-poker-primary btn-action-lg flex-grow-1"
                    >
                      <span>Check</span>
                      <span>✓</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowFoldWarning(false)
                        handleAction('fold')
                      }}
                      disabled={isActing}
                      className="btn-poker btn-poker-danger btn-action-lg flex-grow-1"
                    >
                      <span>{isActing ? 'Folding...' : 'Fold Anyway'}</span>
                      <span>{isActing ? '⏳' : '✕'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (validActions?.canCheck) {
                      setShowFoldWarning(true)
                    } else {
                      handleAction('fold')
                    }
                  }}
                  disabled={
                    isActing || !isMyTurn || !validActions?.canAct || !validActions?.canFold
                  }
                  className="btn-poker btn-poker-danger btn-action-lg w-100"
                  style={{
                    opacity: isMyTurn && validActions?.canAct && validActions?.canFold ? 1 : 0.35,
                    transition: 'opacity 0.3s',
                  }}
                >
                  <span>{isActing ? 'Folding...' : 'Fold'}</span>
                  <span>{isActing ? '⏳' : '✕'}</span>
                </button>
              )}
            </div>
          )}

          <div className="glass-panel flex-grow-1 p-3 d-flex flex-column mb-3 position-relative">
            {/* Pot + Cards */}
            <div className="d-flex flex-column align-items-center text-center flex-grow-1 justify-content-center">
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

            {/* Player table */}
            <div className="w-100 border-top border-secondary border-opacity-25 pt-2 mt-1">
              <div
                className="text-secondary text-uppercase text-center mb-2"
                style={{ letterSpacing: '1.5px', fontSize: '0.68rem' }}
              >
                Players
              </div>
              <div className="d-flex flex-column gap-1">
                {[...game.players]
                  .sort((a: Player, b: Player) => a.position - b.position)
                  .map((p: Player) => {
                    const isMe = p.name === playerName
                    const isActive = p.position === game.currentPlayerPosition
                    const isFolded = p.status === 'folded'
                    const isAllIn = p.status === 'all_in'
                    const isOut = p.status === 'out'

                    return (
                      <div
                        key={p.id}
                        className={`d-flex align-items-center px-2 rounded ${
                          isActive
                            ? 'bg-primary bg-opacity-25 border border-primary border-opacity-50'
                            : 'border border-white border-opacity-10'
                        }`}
                        style={{
                          fontSize: '0.85rem',
                          opacity: isFolded || isOut ? 0.45 : 1,
                          minHeight: '30px',
                        }}
                      >
                        {/* Active turn dot */}
                        <div style={{ width: '10px', flexShrink: 0, marginRight: '6px' }}>
                          {isActive && (
                            <div
                              className="rounded-circle bg-primary"
                              style={{ width: '8px', height: '8px' }}
                            />
                          )}
                        </div>

                        {/* Name */}
                        <div
                          className={`flex-grow-1 fw-bold text-truncate ${isMe ? 'text-info' : 'text-white'}`}
                          style={{ maxWidth: '55%' }}
                        >
                          {p.name}
                          {isMe && (
                            <span className="text-secondary ms-1" style={{ fontSize: '0.68rem' }}>
                              (you)
                            </span>
                          )}
                        </div>

                        {/* Status badge */}
                        {isFolded && (
                          <span
                            className="badge bg-secondary me-2"
                            style={{ fontSize: '0.62rem' }}
                          >
                            FOLD
                          </span>
                        )}
                        {isAllIn && (
                          <span className="badge bg-danger me-2" style={{ fontSize: '0.62rem' }}>
                            ALL-IN
                          </span>
                        )}

                        {/* Stack */}
                        <div
                          className={`font-monospace fw-bold ${isFolded || isOut ? 'text-muted' : 'text-success'}`}
                          style={{ fontSize: '0.82rem', flexShrink: 0 }}
                        >
                          ${p.chips}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>

          {/* Action panel - always visible during active hand */}
          {game.status === 'active' &&
            !isShowdown &&
            (validActions?.canAdvance ? (
              <div className="glass-panel p-3">
                <div className="d-grid gap-3">
                  <div className="text-center text-white mb-2">
                    {validActions.advanceReason === 'all_in_situation'
                      ? 'All players are All-In. Advance to next round?'
                      : 'Ready to advance?'}
                  </div>
                  <button
                    onClick={() => handleAction('advance_round')}
                    disabled={isActing}
                    className="btn-poker btn-poker-primary btn-action-lg w-100"
                  >
                    <span>{isActing ? 'Advancing...' : 'Advance Round'}</span>
                    <span>{isActing ? '⏳' : '⏩'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="glass-panel p-3">
                <div className="d-flex flex-column gap-2">
                  {/* Bet or Raise: full-width slider on top */}
                  {(() => {
                    const canBetOrRaise = !!(
                      isMyTurn &&
                      validActions?.canAct &&
                      (validActions?.canBet || validActions?.canRaise)
                    )
                    const isRaise = !!(isMyTurn && validActions?.canRaise)
                    const minVal = isRaise
                      ? (validActions?.minRaise ?? game.bigBlind ?? 10)
                      : (validActions?.minBet ?? game.bigBlind ?? 10)
                    const maxVal = isRaise
                      ? (validActions?.maxRaise ?? myPlayer?.chips ?? 0)
                      : derivedMaxBet || (myPlayer?.chips ?? 0)
                    const currentVal = canBetOrRaise
                      ? isRaise
                        ? Math.min(Math.max(raiseAmount, minVal), maxVal)
                        : Math.max(betAmount, minVal)
                      : (game.bigBlind ?? 10)
                    const setVal = isRaise ? setRaiseAmount : setBetAmount
                    const totalBet = isRaise ? game.currentBet + currentVal : currentVal
                    const displayMin = minVal || game.bigBlind || 10
                    const displayMax = maxVal || myPlayer?.chips || 100

                    return (
                      <div
                        className="bg-black bg-opacity-25 rounded-3 p-3 border border-white border-opacity-10"
                        style={{
                          opacity:
                            isMyTurn &&
                            validActions?.canAct &&
                            (validActions?.canBet || validActions?.canRaise)
                              ? 1
                              : 0.35,
                          transition: 'opacity 0.3s',
                        }}
                      >
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <button
                            className="btn-chip chip-minus"
                            onClick={() =>
                              setVal(Math.max(currentVal - (game.bigBlind || 10), minVal))
                            }
                            disabled={!canBetOrRaise || isActing}
                          >
                            −
                          </button>
                          <div className="flex-grow-1">
                            <HorizontalSlider
                              value={currentVal}
                              min={displayMin}
                              max={displayMax}
                              step={1}
                              onChange={canBetOrRaise ? setVal : () => {}}
                              thumbColor={isRaise ? '#ffc107' : '#0dcaf0'}
                              trackColor="rgba(255,255,255,0.1)"
                            />
                          </div>
                          <button
                            className="btn-chip chip-plus"
                            onClick={() =>
                              setVal(Math.min(currentVal + (game.bigBlind || 10), maxVal))
                            }
                            disabled={!canBetOrRaise || isActing}
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => handleAction(isRaise ? 'raise' : 'bet', currentVal)}
                          disabled={isActing || !canBetOrRaise}
                          className={`btn-poker ${isRaise ? 'btn-poker-secondary' : 'btn-poker-info'} btn-action-lg w-100`}
                        >
                          <span>
                            {isActing
                              ? 'Processing...'
                              : canBetOrRaise
                                ? `${isRaise ? 'Raise To' : 'Bet'} $${totalBet}`
                                : 'Bet'}
                          </span>
                          <span>{isActing ? '⏳' : isRaise ? '' : '💰'}</span>
                        </button>
                      </div>
                    )
                  })()}

                  {/* Check or Call: smaller button below */}
                  <button
                    onClick={() => {
                      if (validActions?.canCheck) handleAction('check')
                      else if (validActions?.canCall) handleAction('call')
                    }}
                    disabled={isActing || !isMyTurn || !validActions?.canAct}
                    className="btn-poker btn-poker-primary btn-action-lg w-100"
                    style={{
                      opacity: isMyTurn && validActions?.canAct ? 1 : 0.35,
                      transition: 'opacity 0.3s',
                    }}
                  >
                    <span>
                      {isMyTurn && validActions?.canCall && !validActions?.canCheck
                        ? isActing
                          ? 'Calling...'
                          : `Call $${validActions.callAmount}`
                        : isActing
                          ? 'Checking...'
                          : 'Check'}
                    </span>
                    <span>{isActing ? '⏳' : '✓'}</span>
                  </button>
                </div>

                {/* Status indicator when not acting */}
                {myPlayer?.status === 'folded' ? (
                  <div className="text-center text-danger small mt-2">
                    Folded — waiting for next hand
                  </div>
                ) : !isMyTurn ? (
                  <div className="text-center text-secondary small mt-2 d-flex align-items-center justify-content-center gap-2">
                    <span className="spinner-border spinner-border-sm"></span>
                    <span>Waiting for action...</span>
                  </div>
                ) : null}
              </div>
            ))}
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

      {animatingWinners.length > 0 && (
        <PotWinAnimation
          winners={animatingWinners}
          seatPositions={seatPositions}
          potPosition={{ left: 50, top: 50 }}
          onComplete={handleAnimationComplete}
        />
      )}
    </div>
  )
}
