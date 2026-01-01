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

  const handleCreateGame = async () => {
    setCreating(true)
    setError('')

    try {
      const smallBlind = Math.floor(bigBlind / 2)
      const response = await axios.post('/api/games', {
        smallBlind,
        bigBlind,
        startingChips,
      })

      const roomCode = response.data.roomCode
      navigate(`/table/${roomCode}`)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to create game'))
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

  const handleJoinGame = () => {
    if (roomCode.trim()) {
      navigate(`/player/${roomCode}`)
    }
  }

  return (
    <div
      style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: '20px',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        boxSizing: 'border-box',
        backgroundColor: '#1a472a',
        color: '#fff',
      }}
    >
      <h1 style={{ marginTop: '0', marginBottom: '1.5rem' }}>Texas Hold'em</h1>

      <div style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.5em', marginBottom: '0.5rem' }}>Create New Game</h2>
        <p style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
          Start a new game and show the table on this screen
        </p>
        <button
          onClick={handleShowSettings}
          disabled={creating}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            cursor: creating ? 'not-allowed' : 'pointer',
            width: '100%',
            maxWidth: '300px',
          }}
        >
          {creating ? 'Creating...' : 'Create Game'}
        </button>
      </div>

      <div style={{ marginTop: '3rem' }}>
        <h2 style={{ fontSize: '1.5em', marginBottom: '0.5rem' }}>Join Existing Game</h2>
        <p style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
          Enter room code to join as a player
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <input
            type="text"
            placeholder="Room Code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            onKeyPress={(e) => e.key === 'Enter' && handleJoinGame()}
            style={{
              padding: '12px',
              fontSize: '16px',
              width: '140px',
              textTransform: 'uppercase',
              boxSizing: 'border-box',
            }}
            className="text-center"
          />
          <button
            onClick={handleJoinGame}
            disabled={!roomCode.trim()}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              cursor: !roomCode.trim() ? 'not-allowed' : 'pointer',
              flex: '0 0 auto',
            }}
          >
            Join
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            marginTop: '1.5rem',
            padding: '12px',
            backgroundColor: '#fee',
            color: '#c00',
            borderRadius: '5px',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      {showGameSettings && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={handleCancelSettings}
        >
          <div
            style={{
              backgroundColor: '#1a1a1a',
              color: 'rgba(255, 255, 255, 0.87)',
              padding: '48px',
              borderRadius: '8px',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: '20px', color: 'rgba(255, 255, 255, 0.87)' }}>
              Game Settings
            </h2>

            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="bigBlind"
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: 'bold',
                  color: 'rgba(255, 255, 255, 0.87)',
                }}
              >
                Big Blind:
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setBigBlind((prev) => Math.max(2, prev - 2))}
                  style={{
                    backgroundColor: '#444',
                    color: '#fff',
                    border: '1px solid #666',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    padding: 0,
                  }}
                >
                  -
                </button>
                <input
                  id="bigBlind"
                  type="number"
                  min="2"
                  step="2"
                  value={bigBlind}
                  onChange={(e) => setBigBlind(parseInt(e.target.value) || 2)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    color: 'rgba(255, 255, 255, 0.87)',
                    backgroundColor: '#2a2a2a',
                    border: '1px solid #444',
                    textAlign: 'center',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setBigBlind((prev) => prev + 2)}
                  style={{
                    backgroundColor: '#444',
                    color: '#fff',
                    border: '1px solid #666',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    padding: 0,
                  }}
                >
                  +
                </button>
              </div>
              <div
                style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)', marginTop: '4px' }}
              >
                Small Blind will be {Math.floor(bigBlind / 2)}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label
                htmlFor="startingChips"
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: 'bold',
                  color: 'rgba(255, 255, 255, 0.87)',
                }}
              >
                Starting Chips:
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setStartingChips((prev) => Math.max(100, prev - 100))}
                  style={{
                    backgroundColor: '#444',
                    color: '#fff',
                    border: '1px solid #666',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    padding: 0,
                  }}
                >
                  -
                </button>
                <input
                  id="startingChips"
                  type="number"
                  min="100"
                  step="100"
                  value={startingChips}
                  onChange={(e) => setStartingChips(parseInt(e.target.value) || 100)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    color: 'rgba(255, 255, 255, 0.87)',
                    backgroundColor: '#2a2a2a',
                    border: '1px solid #444',
                    textAlign: 'center',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setStartingChips((prev) => prev + 100)}
                  style={{
                    backgroundColor: '#444',
                    color: '#fff',
                    border: '1px solid #666',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    padding: 0,
                  }}
                >
                  +
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCancelSettings}
                style={{
                  padding: '10px 20px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  backgroundColor: '#2a2a2a',
                  color: 'rgba(255, 255, 255, 0.87)',
                  border: '1px solid #444',
                  borderRadius: '4px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGame}
                disabled={creating || bigBlind < 2 || startingChips < 100}
                style={{
                  padding: '10px 20px',
                  fontSize: '16px',
                  cursor:
                    creating || bigBlind < 2 || startingChips < 100 ? 'not-allowed' : 'pointer',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  opacity: creating || bigBlind < 2 || startingChips < 100 ? 0.5 : 1,
                }}
              >
                {creating ? 'Creating...' : 'Create Game'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
