import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { QRCodeSVG } from 'qrcode.react'
import { BACKEND_LOCAL_PORT } from '@holdem/shared/config'

import PokerTableScene from '~/components/table/PokerTableScene'
import GameOverModal from '~/components/GameOverModal'
import { useAppDispatch, useAppSelector } from '~/store/hooks'
import { setGame, setLoading, setError, setWsConnected } from '~/store/gameSlice'
import { useSoundEffects } from '~/hooks/useSoundEffects'
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
    if (game?.status === 'completed') {
      setShowGameOverModal(true)
    }
  }, [game?.status])

  useEffect(() => {
    if (!roomCode) return

    let ws: WebSocket | null = null
    let pollInterval: number | null = null
    let reconnectTimeout: number | null = null

    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const isDevelopment =
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      const wsUrl = isDevelopment
        ? `${protocol}//localhost:${BACKEND_LOCAL_PORT}/ws`
        : `${protocol}//${window.location.host}/ws`

      console.log('[TableView] Connecting to WebSocket:', wsUrl)
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('[TableView] WebSocket connected')
        dispatch(setWsConnected(true))
        dispatch(setError(''))

        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'subscribe',
              payload: {
                roomCode,
                stream: 'table',
              },
            }),
          )
        }
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          console.log('[TableView] WebSocket message:', message.type)

          switch (message.type) {
            case 'hello':
              console.log('[TableView] Server hello:', message.payload)
              break

            case 'subscribed':
              console.log('[TableView] Subscribed to table stream')
              dispatch(setLoading(false))
              if (pollInterval) {
                clearInterval(pollInterval)
                pollInterval = null
              }
              break

            case 'game_state':
              console.log('[TableView] Game state update:', message.payload.reason)
              dispatch(setGame(message.payload.state))
              dispatch(setError(''))
              dispatch(setLoading(false))
              break

            case 'error':
              console.error('[TableView] WebSocket error:', message.payload.error)
              dispatch(setError(message.payload.error))
              break
          }
        } catch (err) {
          console.error('[TableView] Failed to parse WebSocket message:', err)
        }
      }

      ws.onerror = () => {
        console.error('[TableView] WebSocket error')
        dispatch(setWsConnected(false))
      }

      ws.onclose = () => {
        console.log('[TableView] WebSocket disconnected')
        dispatch(setWsConnected(false))

        if (!pollInterval) {
          startPolling()
        }

        reconnectTimeout = window.setTimeout(() => {
          console.log('[TableView] Attempting to reconnect...')
          connectWebSocket()
        }, 3000)
      }
    }

    const startPolling = () => {
      const fetchGame = async () => {
        try {
          const response = await axios.get(`/api/games/room/${roomCode}/state`)
          dispatch(setGame(response.data))
          dispatch(setError(''))
          dispatch(setLoading(false))
        } catch (err: unknown) {
          dispatch(setError(getApiErrorMessage(err, 'Failed to load game')))
          dispatch(setLoading(false))
        }
      }

      fetchGame()
      pollInterval = window.setInterval(fetchGame, 2000)
    }

    connectWebSocket()

    return () => {
      if (ws) {
        ws.close()
      }
      if (pollInterval) {
        clearInterval(pollInterval)
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
      }
    }
  }, [roomCode, dispatch])

  const handleResetGame = async () => {
    if (!roomCode) return

    setIsResetting(true)
    try {
      await axios.post(`/api/games/room/${roomCode}/reset`)
      setShowGameOverModal(false)
    } catch (err: unknown) {
      const errorMsg = getApiErrorMessage(err, 'Failed to reset game')
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
      </PokerTableScene>

      <GameOverModal
        game={game}
        isOpen={game.status === 'completed' && showGameOverModal}
        onClose={() => setShowGameOverModal(false)}
        onResetGame={handleResetGame}
        isResetting={isResetting}
      />
    </>
  )
}
