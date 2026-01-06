import { useState } from 'react'

interface PlayerJoinGameProps {
  roomCode: string | undefined
  playerName: string
  setPlayerName: (name: string) => void
  onJoin: (password: string) => Promise<void>
  error: string
}

export default function PlayerJoinGame({
  roomCode,
  playerName,
  setPlayerName,
  onJoin,
  error,
}: PlayerJoinGameProps) {
  const [password, setPassword] = useState('')

  const handleJoin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    await onJoin(password)
  }

  return (
    <div className="container d-flex flex-column justify-content-center align-items-center min-vh-100">
      <div
        className="glass-panel p-4 text-white"
        style={{
          maxWidth: '420px',
          width: '100%',
        }}
      >
        <h1 className="text-center mb-2">Join Game</h1>
        <p className="text-center mb-4" style={{ color: '#e2e8f0', fontSize: '1.1rem' }}>
          Room: <strong style={{ color: '#fbbf24' }}>{roomCode}</strong>
        </p>

        <form onSubmit={handleJoin} className="w-100">
          <div className="mb-4">
            <label
              htmlFor="playerName"
              className="form-label mb-2"
              style={{ color: '#f1f5f9', fontWeight: 600 }}
            >
              Your Name
            </label>
            <input
              id="playerName"
              type="text"
              placeholder="Enter your name"
              value={playerName}
              maxLength={10}
              onChange={(e) => setPlayerName(e.target.value)}
              className="form-control form-control-lg"
              style={{
                background: 'var(--bg-deep)',
                color: '#f1f5f9',
                border: '1px solid var(--border-subtle)',
                fontSize: '1.1rem',
              }}
            />
          </div>

          <div className="mb-4">
            {/* <label
              htmlFor="playerPassword"
              className="form-label mb-2"
              style={{ color: '#f1f5f9', fontWeight: 600 }}
            >
              Password
            </label> */}
            <input
              id="playerPassword"
              type="text"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-control form-control-lg"
              style={{
                background: 'var(--bg-deep)',
                color: '#f1f5f9',
                border: '1px solid var(--border-subtle)',
                fontSize: '1.1rem',
              }}
            />
            <div className="form-text mt-2" style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>
              4+ characters. Use to rejoin if you disconnect.
            </div>
          </div>

          <button
            type="submit"
            disabled={!playerName.trim() || password.length < 4}
            className="btn-poker btn-poker-primary btn-poker-lg w-100"
          >
            Join Game
          </button>
        </form>

        {error && (
          <div
            className="mt-4 py-3 text-center"
            style={{
              background: 'var(--accent-danger-dim)',
              color: '#ff6b6b',
              borderRadius: '8px',
              border: '1px solid rgba(244, 63, 94, 0.3)',
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
