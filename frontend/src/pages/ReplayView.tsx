import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import PokerTableScene from '~/components/table/PokerTableScene'
import { deriveGameState, type GameConfig, type GameEvent, type GameState } from '@holdem/shared'

interface GameMetadata {
  id: number
  roomCode: string
  smallBlind: number
  bigBlind: number
  startingChips: number
}

interface ReplayData {
  game: GameMetadata
  events: GameEvent[]
}

export default function ReplayView() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const [replayData, setReplayData] = useState<ReplayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [eventIndex, setEventIndex] = useState(0)

  // Fetch events on mount
  useEffect(() => {
    if (!gameId) return

    const fetchEvents = async () => {
      try {
        setLoading(true)
        const response = await axios.get(`/api/admin/games/${gameId}/events`)
        setReplayData(response.data)
        setEventIndex(0)
        setError('')
      } catch (err) {
        setError('Failed to load game events')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [gameId])

  // Derive game state at current event index
  const gameState = useMemo<GameState | null>(() => {
    if (!replayData) return null

    const config: GameConfig = {
      smallBlind: replayData.game.smallBlind,
      bigBlind: replayData.game.bigBlind,
      startingChips: replayData.game.startingChips,
    }

    // Apply events up to current index
    const eventsToApply = replayData.events.slice(0, eventIndex + 1)
    return deriveGameState(config, [], eventsToApply)
  }, [replayData, eventIndex])

  // Current event for display
  const currentEvent = useMemo(() => {
    if (!replayData || eventIndex < 0 || eventIndex >= replayData.events.length) return null
    return replayData.events[eventIndex]
  }, [replayData, eventIndex])

  // Arrow key navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!replayData) return

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setEventIndex((prev) => Math.max(0, prev - 1))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setEventIndex((prev) => Math.min(replayData.events.length - 1, prev + 1))
      }
    },
    [replayData],
  )

  // Register keyboard listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const totalEvents = replayData?.events.length ?? 0

  // Format event type for display
  const formatEventType = (type: string) => {
    return type.replace(/_/g, ' ').toLowerCase()
  }

  if (loading) {
    return (
      <div className="d-flex flex-column justify-content-center align-items-center min-vh-100 text-white">
        <div className="spinner-border text-primary mb-3" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <h2>Loading replay...</h2>
      </div>
    )
  }

  if (error) {
    return (
      <div className="d-flex flex-column justify-content-center align-items-center min-vh-100 text-white text-center">
        <div className="alert alert-danger px-5 py-4 shadow">
          <h3 className="h4 mb-3">Error</h3>
          <p className="mb-4">{error}</p>
          <button onClick={() => navigate('/admin')} className="btn btn-outline-danger">
            Back to Game List
          </button>
        </div>
      </div>
    )
  }

  if (!gameState || !replayData) {
    return (
      <div className="d-flex flex-column justify-content-center align-items-center min-vh-100 text-white">
        <h2 className="mb-4">No replay data</h2>
        <button onClick={() => navigate('/admin')} className="btn btn-primary">
          Back to Game List
        </button>
      </div>
    )
  }

  // Add roomCode to state for PokerTableScene compatibility
  const displayState = {
    ...gameState,
    roomCode: replayData.game.roomCode,
    id: String(replayData.game.id),
  }

  return (
    <>
      <PokerTableScene game={displayState as any} wsConnected={false}>
        {/* Replay Controls Overlay */}
        <div
          className="position-absolute bottom-0 start-0 end-0 p-3"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000 }}
        >
          <div className="container">
            <div className="row align-items-center">
              {/* Back button */}
              <div className="col-auto">
                <button
                  onClick={() => navigate('/admin')}
                  className="btn btn-outline-secondary btn-sm"
                >
                  ← Back
                </button>
              </div>

              {/* Event info */}
              <div className="col text-center text-white">
                <div className="mb-2">
                  <span className="badge bg-dark me-2">Room {replayData.game.roomCode}</span>
                  <span className="badge bg-secondary me-2">Hand #{gameState.handNumber}</span>
                  {currentEvent && (
                    <span className="badge bg-primary">
                      {formatEventType(currentEvent.eventType)}
                    </span>
                  )}
                </div>
                <div className="d-flex align-items-center justify-content-center gap-3">
                  <button
                    onClick={() => setEventIndex((prev) => Math.max(0, prev - 1))}
                    disabled={eventIndex === 0}
                    className="btn btn-outline-light"
                  >
                    ← Prev
                  </button>
                  <span className="text-warning fw-bold" style={{ minWidth: '120px' }}>
                    Event {eventIndex + 1} / {totalEvents}
                  </span>
                  <button
                    onClick={() => setEventIndex((prev) => Math.min(totalEvents - 1, prev + 1))}
                    disabled={eventIndex >= totalEvents - 1}
                    className="btn btn-outline-light"
                  >
                    Next →
                  </button>
                </div>
                <div className="mt-2 text-secondary small">Use ← → arrow keys to navigate</div>
              </div>

              {/* Timeline slider */}
              <div className="col-12 mt-3">
                <input
                  type="range"
                  className="form-range"
                  min="0"
                  max={totalEvents - 1}
                  value={eventIndex}
                  onChange={(e) => setEventIndex(parseInt(e.target.value))}
                  style={{ cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>
        </div>
      </PokerTableScene>
    </>
  )
}
