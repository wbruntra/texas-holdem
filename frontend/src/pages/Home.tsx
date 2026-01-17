import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function Home() {
  const [roomCode, setRoomCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [showGameSettings, setShowGameSettings] = useState(false)
  const [bigBlind, setBigBlind] = useState(10)
  const [startingChips, setStartingChips] = useState(1000)
  const navigate = useNavigate()

  const getErrorMessage = (err: unknown, fallback: string) => {
    if (axios.isAxiosError(err)) {
      const message = err.response?.data?.error
      if (typeof message === 'string' && message.trim()) return message
    }
    return fallback
  }

  const handleCreateRoom = async () => {
    setCreating(true)
    setError('')

    try {
      const smallBlind = Math.floor(bigBlind / 2)
      // Call create room endpoint
      const response = await axios.post('/api/rooms', {
        smallBlind,
        bigBlind,
        startingChips,
      })

      const roomCode = response.data.room_code // Note: casing might change in new API response
      // My room-service/router returns the room object.
      // Room object has `room_code`.
      // Previous API returned `roomCode`.
      // I should check `rooms.js` response.
      // `rooms.js` does `res.json(room)`.
      // `room-service.ts` createRoom returns `getRoomById`.
      // `getRoomById` returns db row + players + currentGame.
      // DB row uses snake_case `room_code`.
      // So response.data.room_code is correct.

      navigate(`/table/${roomCode}`)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to create room'))
    } finally {
      setCreating(false)
      setShowGameSettings(false)
    }
  }

  const handleShowSettings = () => {
    setShowGameSettings(true)
    setError('')
  }

  const handleCancelSettings = () => {
    setShowGameSettings(false)
    setBigBlind(10)
    setStartingChips(1000)
  }

  const handleJoinRoom = () => {
    if (roomCode.trim()) {
      navigate(`/player/${roomCode}`)
    }
  }

  return (
    <div
      className="container d-flex flex-column justify-content-center min-vh-100 py-5"
      style={{ maxWidth: '600px' }}
    >
      <div className="text-center mb-5">
        <h1 className="display-4 fw-bold text-white mb-2">Texas Hold'em</h1>
        <p className="lead text-secondary">A simple multiplayer poker game</p>
      </div>

      <div className="card bg-dark text-white border-secondary mb-4 shadow">
        <div className="card-body p-4">
          <h2 className="h4 mb-3">Create New Room</h2>
          <p className="text-secondary mb-4">
            Start a new poker room and show the table on this screen.
          </p>
          <button
            onClick={handleShowSettings}
            disabled={creating}
            className="btn-poker btn-poker-primary btn-poker-lg w-100"
          >
            {creating ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
                Creating...
              </>
            ) : (
              'Create Room'
            )}
          </button>
        </div>
      </div>

      <div className="card bg-dark text-white border-secondary shadow">
        <div className="card-body p-4 text-center">
          <h2 className="h4 mb-3 text-start">Join Room</h2>
          <p className="text-secondary mb-4 text-start">
            Enter room code to join the table on your device.
          </p>
          <div className="input-group input-group-lg">
            <input
              type="text"
              placeholder="Room Code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
              className="form-control text-center bg-dark text-white border-secondary fw-bold"
              style={{ letterSpacing: '4px' }}
            />
            <button
              onClick={handleJoinRoom}
              disabled={!roomCode.trim()}
              className="btn-poker btn-poker-primary px-4"
            >
              Join
            </button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger mt-4 py-3 shadow-sm text-center">{error}</div>}

      {showGameSettings && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
          onClick={handleCancelSettings}
        >
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content bg-dark text-white border-secondary shadow-lg">
              <div className="modal-header border-secondary">
                <h5 className="modal-title fw-bold">Room Settings</h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={handleCancelSettings}
                ></button>
              </div>
              <div className="modal-body p-4">
                <div className="mb-4 text-center">
                  <label htmlFor="bigBlind" className="form-label fw-bold d-block mb-3">
                    Big Blind Amount
                  </label>
                  <div className="d-flex gap-3 align-items-center justify-content-center">
                    <button
                      type="button"
                      onClick={() => setBigBlind((prev) => Math.max(2, prev - 2))}
                      className="btn btn-outline-secondary rounded-circle"
                      style={{ width: '48px', height: '48px', fontSize: '24px', lineHeight: 0 }}
                    >
                      −
                    </button>
                    <input
                      id="bigBlind"
                      type="number"
                      min="2"
                      step="2"
                      value={bigBlind}
                      onChange={(e) => setBigBlind(parseInt(e.target.value) || 2)}
                      className="form-control form-control-lg bg-black text-white border-secondary text-center fw-bold"
                      style={{ maxWidth: '120px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setBigBlind((prev) => prev + 2)}
                      className="btn btn-outline-secondary rounded-circle"
                      style={{ width: '48px', height: '48px', fontSize: '24px', lineHeight: 0 }}
                    >
                      +
                    </button>
                  </div>
                  <div className="small text-secondary mt-3">
                    Small Blind will be{' '}
                    <span className="text-info">${Math.floor(bigBlind / 2)}</span>
                  </div>
                </div>

                <div className="mb-4 text-center">
                  <label htmlFor="startingChips" className="form-label fw-bold d-block mb-3">
                    Starting Chips
                  </label>
                  <div className="d-flex gap-3 align-items-center justify-content-center">
                    <button
                      type="button"
                      onClick={() => setStartingChips((prev) => Math.max(100, prev - 100))}
                      className="btn btn-outline-secondary rounded-circle"
                      style={{ width: '48px', height: '48px', fontSize: '24px', lineHeight: 0 }}
                    >
                      −
                    </button>
                    <input
                      id="startingChips"
                      type="number"
                      min="100"
                      step="100"
                      value={startingChips}
                      onChange={(e) => setStartingChips(parseInt(e.target.value) || 100)}
                      className="form-control form-control-lg bg-black text-white border-secondary text-center fw-bold"
                      style={{ maxWidth: '120px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setStartingChips((prev) => prev + 100)}
                      className="btn btn-outline-secondary rounded-circle"
                      style={{ width: '48px', height: '48px', fontSize: '24px', lineHeight: 0 }}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              <div className="modal-footer border-secondary p-3">
                <button
                  onClick={handleCancelSettings}
                  className="btn-poker btn-poker-outline me-auto"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateRoom}
                  disabled={creating || bigBlind < 2 || startingChips < 100}
                  className="btn-poker btn-poker-primary px-4"
                >
                  {creating ? 'Creating...' : 'Create Room'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
