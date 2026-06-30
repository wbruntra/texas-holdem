import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import PlayerJoinGame from '~/components/PlayerJoinGame'
import PlayerShowdown from '~/components/PlayerShowdown'
import PotWinAnimation, { type WinnerPayout } from '~/components/table/PotWinAnimation'
import BoardArea from '~/components/table/BoardArea'
import OpponentStrip from '~/components/OpponentStrip'
import ActionBar from '~/components/ActionBar'
import GameOverModal from '~/components/GameOverModal'
import PokerCard from '~/components/table/PokerCard'
import { usePlayerGame } from '~/hooks/usePlayerGame'
import { getDisplayPot } from '~/utils/potUtils'
import type { Player } from '~/components/table/types'
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
  const [isActing, setIsActing] = useState(false)
  const [viewMode, setViewMode] = useState<'hand' | 'table'>('hand')
  const [showResults, setShowResults] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const wasGameOverRef = useRef(false)
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
    wsConnected: liveWsConnected,
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
  const wsConnected = isMockMode ? false : liveWsConnected
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

  const gameOver = !!game && (game.status === 'completed' || !!game.isGameOver)

  // Start a fresh game from the beginning (mirrors the table view's reset).
  const handleNewGame = useCallback(async () => {
    if (!roomCode || isMockMode) return
    setIsResetting(true)
    try {
      await axios.post(`/api/games/room/${roomCode}/new-game`)
      setShowResults(false)
    } catch (e) {
      console.error('Failed to start new game', e)
    } finally {
      setIsResetting(false)
    }
  }, [roomCode, isMockMode])

  // Pop the results modal once when the game ends.
  useEffect(() => {
    if (gameOver && !wasGameOverRef.current) setShowResults(true)
    wasGameOverRef.current = gameOver
  }, [gameOver])

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
  const displayPot = game ? getDisplayPot(game.players, game.pots) : 0

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

  const toCall =
    myPlayer && game.currentBet > myPlayer.currentBet ? game.currentBet - myPlayer.currentBet : 0

  const viewToggle = () => (
    <div className="view-toggle">
      <button
        type="button"
        className={viewMode === 'hand' ? 'active' : ''}
        onClick={() => setViewMode('hand')}
      >
        My Hand
      </button>
      <button
        type="button"
        className={viewMode === 'table' ? 'active' : ''}
        onClick={() => setViewMode('table')}
      >
        Table
      </button>
    </div>
  )

  if (viewMode === 'table') {
    const sortedPlayers = [...game.players].sort((a, b) => a.position - b.position)

    return (
      <div className="play-root">
        {viewToggle()}

        <div className="status-strip">
          <div className="status-strip-row">
            <div className="d-flex flex-column">
              <span className="me-name-label">Room</span>
              <span className="me-name">{game.roomCode}</span>
            </div>
            <span
              className={`badge ${wsConnected ? 'text-bg-success' : 'text-bg-warning'} align-self-center`}
            >
              {wsConnected ? 'LIVE' : 'POLL'}
            </span>
          </div>
          <div className="status-strip-row">
            {game.currentRound && game.status === 'active' && (
              <div className="round-badge">{game.currentRound.replace('preflop', 'Pre-Flop')}</div>
            )}
            <div className="meta-line">
              {game.handNumber !== undefined &&
                game.status === 'active' &&
                `H${game.handNumber + 1}`}
              {(game.smallBlind || game.bigBlind) &&
                ` ${game.smallBlind ?? game.bigBlind! / 2}/${game.bigBlind}`}
            </div>
          </div>
        </div>

        {game.status === 'active' && (
          <div className="glass-panel p-3 text-center">
            {game.communityCards && game.communityCards.length > 0 && (
              <div className="d-flex justify-content-center gap-2 mb-2 flex-wrap">
                {game.communityCards.map((card, i) => (
                  <PokerCard key={i} card={card} className="table-tab-card" />
                ))}
              </div>
            )}
            <div
              className="text-secondary text-uppercase small mb-1"
              style={{ letterSpacing: '2px' }}
            >
              Pot
            </div>
            <div className="h2 fw-bold text-warning mb-0">${displayPot}</div>
          </div>
        )}

        <div className="table-roster">
          {sortedPlayers.map((p) => {
            const isTurn = p.position === game.currentPlayerPosition
            const isDealer = p.position === game.dealerPosition
            const isFolded = p.status === 'folded'
            const isAllIn = p.status === 'all_in'
            const isOut = p.status === 'out'
            const isWinner = winnerPositions.includes(p.position)

            return (
              <div
                key={p.id}
                className={`table-roster-row ${isTurn ? 'turn' : ''} ${isFolded || isOut ? 'folded' : ''} ${isWinner ? 'winner' : ''}`}
              >
                <div className="table-roster-name">
                  {isDealer && <span className="dealer-chip">D</span>}
                  <span>{p.name}</span>
                  {p.name === playerName && <span className="table-roster-you">YOU</span>}
                </div>
                <div className="table-roster-meta">
                  {isFolded && <span className="table-roster-tag">FOLD</span>}
                  {isAllIn && <span className="table-roster-tag">ALL-IN</span>}
                  {isOut && <span className="table-roster-tag">OUT</span>}
                  {isWinner && <span className="table-roster-tag win">WIN</span>}
                  {p.currentBet > 0 && !isFolded && (
                    <span className="table-roster-bet">${p.currentBet}</span>
                  )}
                  <span className="table-roster-stack">${p.chips}</span>
                </div>
              </div>
            )
          })}
        </div>

        {game.status === 'waiting' && (
          <button
            onClick={startGame}
            className="btn-poker btn-poker-primary btn-action-lg w-100 mt-auto"
          >
            Start Game
          </button>
        )}

        {gameOver && (
          <div className="d-flex gap-2 mt-auto">
            <button
              onClick={() => setShowResults(true)}
              className="btn-poker btn-poker-secondary flex-grow-1"
            >
              🏆 View Results
            </button>
            <button
              onClick={handleNewGame}
              disabled={isResetting}
              className="btn-poker btn-poker-primary flex-grow-1"
            >
              {isResetting ? 'Resetting…' : '🔄 New Game'}
            </button>
          </div>
        )}

        <GameOverModal
          game={game}
          isOpen={gameOver && showResults}
          onClose={() => setShowResults(false)}
          onResetGame={handleNewGame}
          isResetting={isResetting}
        />
      </div>
    )
  }

  return (
    <div className="play-root">
      {viewToggle()}
      {/* Status strip */}
      <div className="status-strip">
        <div className="status-strip-row">
          <div className="d-flex flex-column">
            <span className="me-name-label">You</span>
            <span className="me-name">{playerName}</span>
          </div>
          <div className="d-flex flex-column align-items-end">
            <span className="me-stack-label">Stack</span>
            <span className="me-stack">${myPlayer?.chips || 0}</span>
          </div>
        </div>
        <div className="status-strip-row">
          <div className="meta-line">#{game.roomCode}</div>
          {game.currentRound && game.status === 'active' && (
            <div className="round-badge">{game.currentRound.replace('preflop', 'Pre-Flop')}</div>
          )}
          <div className="meta-line">
            {game.handNumber !== undefined &&
              game.status === 'active' &&
              `H${game.handNumber + 1}`}
            {(game.smallBlind || game.bigBlind) &&
              ` ${game.smallBlind ?? game.bigBlind! / 2}/${game.bigBlind}`}
          </div>
        </div>
      </div>

      {isShowdown ? (
        <>
          <OpponentStrip
            players={game.players}
            myName={playerName}
            currentPlayerPosition={game.currentPlayerPosition}
            dealerPosition={game.dealerPosition}
            isShowdown
            winnerPositions={winnerPositions}
          />
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
        </>
      ) : (
        <>
          <OpponentStrip
            players={game.players}
            myName={playerName}
            currentPlayerPosition={game.currentPlayerPosition}
            dealerPosition={game.dealerPosition}
          />

          <BoardArea
            pot={displayPot}
            toCall={toCall}
            communityCards={game.communityCards || []}
            myPlayer={myPlayer}
            currentPlayerPosition={game.currentPlayerPosition}
          />

          {game.status === 'active' && (
            <ActionBar
              validActions={validActions}
              myPlayer={myPlayer}
              bigBlind={game.bigBlind}
              currentBet={game.currentBet}
              pot={displayPot}
              isMyTurn={isMyTurn}
              isActing={isActing}
              betAmount={betAmount}
              raiseAmount={raiseAmount}
              setBetAmount={setBetAmount}
              setRaiseAmount={setRaiseAmount}
              onAction={handleAction}
              showFoldWarning={showFoldWarning}
              onFoldTap={() => {
                if (validActions?.canCheck) setShowFoldWarning(true)
                else handleAction('fold')
              }}
              onFoldConfirm={() => {
                setShowFoldWarning(false)
                handleAction('check')
              }}
              onFoldCancel={() => {
                setShowFoldWarning(false)
                handleAction('fold')
              }}
            />
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

      {animatingWinners.length > 0 && (
        <PotWinAnimation
          winners={animatingWinners}
          seatPositions={seatPositions}
          potPosition={{ left: 50, top: 50 }}
          onComplete={handleAnimationComplete}
        />
      )}

      <GameOverModal
        game={game}
        isOpen={gameOver && showResults}
        onClose={() => setShowResults(false)}
        onResetGame={handleNewGame}
        isResetting={isResetting}
      />
    </div>
  )
}
