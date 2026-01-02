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
        className="card p-4 bg-dark text-white border-secondary"
        style={{ maxWidth: '420px', width: '100%' }}
      >
        <h1 className="text-center mb-4">Join Game</h1>
        <p className="text-center text-secondary mb-4">Room: {roomCode}</p>

        <form onSubmit={handleJoin} className="w-100">
          <div className="mb-3">
            <input
              type="text"
              placeholder="Your Name"
              value={playerName}
              maxLength={10}
              onChange={(e) => setPlayerName(e.target.value)}
              className="form-control form-control-lg bg-dark text-white border-secondary"
            />
          </div>

          <div className="mb-3">
            <input
              type="text"
              placeholder="Password (4+ chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-control form-control-lg bg-dark text-white border-secondary"
            />
          </div>

          <button
            type="submit"
            disabled={!playerName.trim() || password.length < 4}
            className="btn btn-primary btn-lg w-100 mt-2"
          >
            Join Game
          </button>
        </form>

        {error && <div className="alert alert-danger mt-4 py-2 text-center">{error}</div>}
      </div>
    </div>
  )
}
