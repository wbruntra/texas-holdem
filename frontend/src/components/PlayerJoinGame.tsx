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
    <div
      style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: '20px',
        minHeight: '100vh',
        backgroundColor: '#1a472a',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <h1>Join Game</h1>
      <p>Room: {roomCode}</p>

      <form
        onSubmit={handleJoin}
        style={{
          marginTop: '30px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <input
          type="text"
          placeholder="Your Name"
          value={playerName}
          maxLength={10}
          onChange={(e) => setPlayerName(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '200px',
            padding: '15px',
            fontSize: '18px',
            marginBottom: '15px',
            boxSizing: 'border-box',
          }}
        />

        <input
          type="text"
          placeholder="Security Word (min 4 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '200px',
            padding: '15px',
            fontSize: '18px',
            marginBottom: '15px',
            boxSizing: 'border-box',
          }}
        />

        <button
          type="submit"
          disabled={!playerName.trim() || password.length < 4}
          style={{
            width: '100%',
            maxWidth: '200px',
            padding: '15px',
            fontSize: '18px',
            cursor: !playerName.trim() || password.length < 4 ? 'not-allowed' : 'pointer',
          }}
        >
          Join Game
        </button>
      </form>

      {error && (
        <div
          style={{
            marginTop: '20px',
            padding: '15px',
            backgroundColor: '#fee',
            color: '#c00',
            borderRadius: '5px',
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
