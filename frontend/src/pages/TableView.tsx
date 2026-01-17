import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { QRCodeSVG } from 'qrcode.react'

import PokerTableScene from '~/components/table/PokerTableScene'
import GameOverModal from '~/components/GameOverModal'
import { useAppDispatch, useAppSelector } from '~/store/hooks'
import { setGame, setLoading, setError, setWsConnected } from '~/store/gameSlice'
import { useSoundEffects } from '~/hooks/useSoundEffects'
import { WebSocketManager } from '~/lib/WebSocketManager'
import type { Player } from '~/components/table/types'

export default function TableView() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const dispatch = useAppDispatch()
  const game = useAppSelector((state) => state.game.game)
  const loading = useAppSelector((state) => state.game.loading)
  const error = useAppSelector((state) => state.game.error)
  const wsConnected = useAppSelector((state) => state.game.wsConnected)
  const [showGameOverModal, setShowGameOverModal] = useState(true)
  const [isResetting, setIsResetting] = useState(false)
  const { playCheckSound, playBetSound, playCardFlipSound } = useSoundEffects()

  const wsManagerRef = useRef<WebSocketManager | null>(null)

  const previousActionsRef = useRef<Record<string, string | null>>({})
  const previousCommunityCardsCountRef = useRef(0)

  const getApiErrorMessage = (err: unknown, fallback: string) => {
    if (!axios.isAxiosError(err)) return fallback
    const data = err.response?.data as { error?: string } | undefined
    return data?.error || fallback
  }

  useEffect(() => {
    if (!game) return

    game.players.forEach((player: Player) => {
      const previousAction = previousActionsRef.current[player.id]
      const currentAction = player.lastAction

      if (currentAction && currentAction !== previousAction) {
        const action = currentAction.toLowerCase()

        if (action === 'check') {
          playCheckSound()
        } else if (action === 'bet' || action === 'raise' || action === 'call') {
          playBetSound()
        }
      }

      if (currentAction) {
        previousActionsRef.current[player.id] = currentAction
      }
    })
  }, [game, playCheckSound, playBetSound])

  useEffect(() => {
    if (!game) return

    const currentCardsCount = game.communityCards?.length || 0
    const previousCardsCount = previousCommunityCardsCountRef.current

    if (currentCardsCount > previousCardsCount) {
      playCardFlipSound()
    }

    previousCommunityCardsCountRef.current = currentCardsCount
  }, [game, playCardFlipSound])

  useEffect(() => {
    if (game?.status === 'completed' || game?.isGameOver) {
      // Delay showing the game over modal so users can see the final showdown
      const timer = setTimeout(() => setShowGameOverModal(true), 3000)
      return () => clearTimeout(timer)
    }
  }, [game?.status, game?.isGameOver])

  useEffect(() => {
    if (!roomCode) return

    wsManagerRef.current = new WebSocketManager({
      onHello: (payload) => {
        console.log('[TableView] Server hello:', payload)
        dispatch(setError(''))
      },
      onSubscribed: () => {
        console.log('[TableView] Subscribed to table stream')
        dispatch(setLoading(false))
      },
      onGameState: (payload) => {
        console.log('[TableView] Game state update:', payload.reason)
        dispatch(setGame(payload.state as Parameters<typeof setGame>[0]))
        dispatch(setError(''))
        dispatch(setLoading(false))
      },
      onError: (err) => {
        console.error('[TableView] WebSocket error:', err)
        dispatch(setError(err))
      },
    })

    wsManagerRef.current.connect(roomCode, 'table')

    return () => {
      wsManagerRef.current?.disconnect()
      wsManagerRef.current = null
    }
  }, [roomCode, dispatch])

  useEffect(() => {
    if (wsManagerRef.current) {
      const isConnected = wsManagerRef.current.isConnected()
      dispatch(setWsConnected(isConnected))
    }
  }, [wsManagerRef.current, dispatch])

  const handleNewGame = async () => {
    if (!roomCode) return

    setIsResetting(true)
    try {
      await axios.post(`/api/games/room/${roomCode}/new-game`)
      setShowGameOverModal(false)
    } catch (err: unknown) {
      const errorMsg = getApiErrorMessage(err, 'Failed to start new game')
      dispatch(setError(errorMsg))
      alert(errorMsg)
    } finally {
      setIsResetting(false)
    }
  }

  if (loading) {
    return (
      <div className="container d-flex flex-column justify-content-center align-items-center min-vh-100 text-white">
        <div className="spinner-border text-primary mb-3" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <h2>Loading room...</h2>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container d-flex flex-column justify-content-center align-items-center min-vh-100 text-white text-center">
        <div className="alert alert-danger px-5 py-4 shadow">
          <h3 className="h4 mb-3">Error</h3>
          <p className="mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="btn btn-outline-danger">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="container d-flex flex-column justify-content-center align-items-center min-vh-100 text-white">
        <h2 className="mb-4">Game not found</h2>
        <a href="/" className="btn btn-primary">
          Go Home
        </a>
      </div>
    )
  }

  return (
    <>
      <PokerTableScene game={game} wsConnected={wsConnected}>
        {game.status === 'waiting' && (
          <div
            className="modal show d-block"
            style={{
              backgroundColor: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(8px)',
              zIndex: 1000,
            }}
          >
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content bg-dark text-white border-secondary shadow-lg py-5 px-3">
                <div className="text-center">
                  <h2 className="mb-4 display-6 fw-bold">Waiting for Players</h2>

                  <div className="bg-white p-3 rounded-4 d-inline-block shadow mb-4">
                    <QRCodeSVG
                      value={`${window.location.protocol}//${window.location.host}/player/${game.roomCode}`}
                      size={280}
                      level="H"
                    />
                  </div>

                  <div className="h4 text-secondary mb-2">Scan to join</div>
                  <div
                    className="display-4 fw-bold text-warning mb-4"
                    style={{ letterSpacing: '4px' }}
                  >
                    {game.roomCode}
                  </div>

                  <hr className="border-secondary w-50 mx-auto mb-4" />

                  <div className="h5 text-info">
                    {game.players.length} player{game.players.length !== 1 ? 's' : ''} joined
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Reopen Game Over Modal Button */}
        {(game.status === 'completed' || !!game.isGameOver) && !showGameOverModal && (
          <button
            className="btn btn-warning position-absolute top-0 end-0 m-4 shadow-lg fw-bold"
            style={{ zIndex: 1050 }}
            onClick={() => setShowGameOverModal(true)}
          >
            🏆 View Results & Reset
          </button>
        )}
      </PokerTableScene>

      <GameOverModal
        game={game}
        isOpen={(game.status === 'completed' || !!game.isGameOver) && showGameOverModal}
        onClose={() => setShowGameOverModal(false)}
        onResetGame={handleNewGame}
        isResetting={isResetting}
      />
    </>
  )
}
