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
    return <div style={{ padding: '50px', textAlign: 'center' }}>Loading...</div>
  }

  if (error) {
    return <div style={{ padding: '50px', textAlign: 'center', color: '#c00' }}>{error}</div>
  }

  if (!game) {
    return <div style={{ padding: '50px', textAlign: 'center' }}>Game not found</div>
  }

  return (
    <>
      <PokerTableScene game={game} wsConnected={wsConnected}>
        {game.status === 'waiting' && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              backdropFilter: 'blur(8px)',
            }}
          >
            <div
              className="text-center p-5 rounded"
              style={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                boxShadow: '0 0 50px rgba(0,0,0,0.5)',
                color: '#fff',
              }}
            >
              <h2 className="mb-4 fw-bold">Waiting for Players</h2>
              <div
                className="d-inline-flex p-3 rounded mb-4"
                style={{
                  backgroundColor: 'white',
                }}
              >
                <QRCodeSVG
                  value={`${window.location.protocol}//${window.location.host}/player/${game.roomCode}`}
                  size={240}
                  level="M"
                />
              </div>
              <div className="fs-5 mb-2" style={{ opacity: 0.8 }}>
                Scan to join
              </div>
              <div className="fs-3 fw-bold text-warning" style={{ letterSpacing: '2px' }}>
                {game.roomCode}
              </div>
              <div className="mt-4 small opacity-50">
                {game.players.length} player{game.players.length !== 1 ? 's' : ''} joined
              </div>
            </div>
          </div>
        )}
      </PokerTableScene>

      {/* Game Over Modal */}
      {game.status === 'completed' && showGameOverModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(3px)',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              backgroundColor: '#1a1a1a',
              padding: '40px 50px',
              borderRadius: '12px',
              boxShadow: '0 0 40px rgba(255, 215, 0, 0.3)',
              border: '2px solid #FFD700',
              position: 'relative',
              maxWidth: '500px',
            }}
          >
            <button
              onClick={() => setShowGameOverModal(false)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#FFD700',
                fontSize: '28px',
                cursor: 'pointer',
                padding: '0',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Close"
            >
              ✕
            </button>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>🏆</div>
            <div
              style={{
                fontSize: '36px',
                fontWeight: 'bold',
                marginBottom: '24px',
                color: '#FFD700',
                textShadow: '0 0 15px rgba(255, 215, 0, 0.4)',
              }}
            >
              GAME OVER!
            </div>
            <div style={{ fontSize: '16px', marginBottom: '20px', opacity: 0.9 }}>
              Final Chip Count
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                marginBottom: '24px',
              }}
            >
              {game.players.map((player) => (
                <div
                  key={player.name}
                  style={{
                    fontSize: '14px',
                    padding: '12px 16px',
                    backgroundColor: player.chips > 0 ? '#1a3a1a' : '#2a1a1a',
                    borderRadius: '6px',
                    border: player.chips > 0 ? '1px solid #0f0' : '1px solid #f00',
                    color: player.chips > 0 ? '#4f4' : '#aaa',
                    fontWeight: 'bold',
                  }}
                >
                  {player.name}: ${player.chips}
                </div>
              ))}
            </div>
            <div style={{ fontSize: '12px', color: '#aaa' }}>Room: {game.roomCode}</div>
          </div>
        </div>
      )}
    </>
  )
}
