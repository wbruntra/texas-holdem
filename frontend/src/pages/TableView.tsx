import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { QRCodeSVG } from 'qrcode.react'
import { BACKEND_LOCAL_PORT } from '@scaffold/shared/config'

import PokerTableScene from '../components/table/PokerTableScene'
import type { GameState } from '../components/table/types'

export default function TableView() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const [game, setGame] = useState<GameState | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [showGameOverModal, setShowGameOverModal] = useState(true)
  const [wsConnected, setWsConnected] = useState(false)

  const getApiErrorMessage = (err: unknown, fallback: string) => {
    if (!axios.isAxiosError(err)) return fallback
    const data = err.response?.data as { error?: string } | undefined
    return data?.error || fallback
  }

  useEffect(() => {
    if (!roomCode) return

    let ws: WebSocket | null = null
    let pollInterval: number | null = null
    let reconnectTimeout: number | null = null

    // WebSocket connection logic
    const connectWebSocket = () => {
      // In development: connect directly to backend (Vite proxy doesn't forward cookies)
      // In production: use same domain/port as the page
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
        setWsConnected(true)
        setError('')

        // Subscribe to table stream
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
              setLoading(false)
              // Stop polling when WS is active
              if (pollInterval) {
                clearInterval(pollInterval)
                pollInterval = null
              }
              break

            case 'game_state':
              console.log('[TableView] Game state update:', message.payload.reason)
              setGame(message.payload.state)
              setError('')
              setLoading(false)
              break

            case 'error':
              console.error('[TableView] WebSocket error:', message.payload.error)
              setError(message.payload.error)
              break
          }
        } catch (err) {
          console.error('[TableView] Failed to parse WebSocket message:', err)
        }
      }

      ws.onerror = (error) => {
        console.error('[TableView] WebSocket error:', error)
        setWsConnected(false)
      }

      ws.onclose = () => {
        console.log('[TableView] WebSocket disconnected')
        setWsConnected(false)

        // Fall back to polling
        if (!pollInterval) {
          startPolling()
        }

        // Attempt to reconnect after 3 seconds
        reconnectTimeout = window.setTimeout(() => {
          console.log('[TableView] Attempting to reconnect...')
          connectWebSocket()
        }, 3000)
      }
    }

    // Polling fallback logic
    const startPolling = () => {
      const fetchGame = async () => {
        try {
          const response = await axios.get(`/api/games/room/${roomCode}/state`)
          setGame(response.data)
          setError('')
          setLoading(false)
        } catch (err: unknown) {
          setError(getApiErrorMessage(err, 'Failed to load game'))
          setLoading(false)
        }
      }

      fetchGame() // Initial fetch
      pollInterval = window.setInterval(fetchGame, 2000)
    }

    // Try WebSocket first
    connectWebSocket()

    // Cleanup
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
  }, [roomCode])

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

      {/* Game Over Modal */}
      {game.status === 'completed' && showGameOverModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(4px)', zIndex: 1100 }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div
              className="modal-content bg-dark text-white border-warning shadow-lg p-4"
              style={{ border: '2px solid gold' }}
            >
              <button
                onClick={() => setShowGameOverModal(false)}
                className="btn-close btn-close-white position-absolute top-0 end-0 m-3"
                aria-label="Close"
              ></button>

              <div className="modal-body text-center p-4">
                <div className="display-1 mb-3">🏆</div>
                <h2 className="display-6 fw-bold text-warning mb-4">GAME OVER!</h2>

                <p className="small text-secondary mb-4 uppercase text-uppercase fw-bold">
                  Final Chip Count
                </p>

                <div className="d-flex flex-column gap-2 mb-5">
                  {[...game.players]
                    .sort((a, b) => b.chips - a.chips)
                    .map((player) => (
                      <div
                        key={player.name}
                        className={`d-flex justify-content-between p-3 rounded border ${
                          player.chips > 0
                            ? 'bg-success bg-opacity-10 border-success text-success'
                            : 'bg-danger bg-opacity-10 border-danger text-secondary'
                        }`}
                      >
                        <span className="fw-bold">{player.name}</span>
                        <span className="fw-bold">${player.chips}</span>
                      </div>
                    ))}
                </div>

                <div className="small text-secondary border-top border-secondary pt-3 mt-2">
                  Room: <span className="text-light">{game.roomCode}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
