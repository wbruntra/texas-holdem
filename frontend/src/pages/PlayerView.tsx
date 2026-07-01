import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { FaTrophy, FaSyncAlt } from 'react-icons/fa'
import { useAnimatedNumber } from '~/hooks/useAnimatedNumber'
import PlayerJoinGame from '~/components/PlayerJoinGame'
import PlayerShowdown from '~/components/PlayerShowdown'
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

function TableRosterRow({
  player,
  isTurn,
  isDealer,
  isFolded,
  isAllIn,
  isOut,
  isWinner,
}: {
  player: Player
  isTurn: boolean
  isDealer: boolean
  isFolded: boolean
  isAllIn: boolean
  isOut: boolean
  isWinner: boolean
}) {
  const { value: displayedChips, isAnimating, direction } = useAnimatedNumber(player.chips)

  return (
    <div
      className={`table-roster-row ${isTurn ? 'turn' : ''} ${isFolded || isOut ? 'folded' : ''} ${isWinner ? 'winner' : ''}`}
    >
      <div className="table-roster-name">
        {isDealer && <span className="dealer-chip">D</span>}
        <span>{player.name}</span>
      </div>
      <div className="table-roster-meta">
        {isFolded && <span className="table-roster-tag">FOLD</span>}
        {isAllIn && <span className="table-roster-tag">ALL-IN</span>}
        {isOut && <span className="table-roster-tag">OUT</span>}
        {isWinner && <span className="table-roster-tag win">WIN</span>}
        {player.currentBet > 0 && !isFolded && (
          <span className="table-roster-bet">${player.currentBet}</span>
        )}
        <span
          className={`table-roster-stack ${isAnimating && direction === 'up' ? 'stack-gain' : ''}`}
        >
          ${displayedChips}
        </span>
      </div>
    </div>
  )
}

export default function PlayerView() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const [isActing, setIsActing] = useState(false)
  const [viewMode, setViewMode] = useState<'hand' | 'table'>('hand')
  const [showResults, setShowResults] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const wasGameOverRef = useRef(false)
  const [showFoldWarning, setShowFoldWarning] = useState(false)

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
          {sortedPlayers.map((p) => (
            <TableRosterRow
              key={p.id}
              player={p}
              isTurn={p.position === game.currentPlayerPosition}
              isDealer={p.position === game.dealerPosition}
              isFolded={p.status === 'folded'}
              isAllIn={p.status === 'all_in'}
              isOut={p.status === 'out'}
              isWinner={winnerPositions.includes(p.position)}
            />
          ))}
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
              <FaTrophy className="me-2" />
              View Results
            </button>
            <button
              onClick={handleNewGame}
              disabled={isResetting}
              className="btn-poker btn-poker-primary flex-grow-1"
            >
              {isResetting ? (
                'Resetting…'
              ) : (
                <>
                  <FaSyncAlt className="me-2" />
                  New Game
                </>
              )}
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
                myPlayer={myPlayer}
                winnerPositions={winnerPositions}
                amWinner={amWinner}
                onNextHand={nextHand}
                onToggleShowCards={toggleShowCards}
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
