import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

interface GameSummary {
  id: number
  roomCode: string
  gameNumber: number
  status: string
  handNumber: number
  smallBlind: number
  bigBlind: number
  startingChips: number
  createdAt: string
  players: string[]
}

export default function AdminPage() {
  const [games, setGames] = useState<GameSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetchGames()
  }, [])

  const fetchGames = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/admin/games')
      setGames(response.data)
      setError('')
    } catch (err) {
      setError('Failed to load game history')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return (
      date.toLocaleDateString() +
      ' ' +
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    )
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'badge bg-success'
      case 'active':
        return 'badge bg-primary'
      case 'waiting':
        return 'badge bg-warning text-dark'
      default:
        return 'badge bg-secondary'
    }
  }

  if (loading) {
    return (
      <div className="container d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h2 text-white mb-1">Game History</h1>
          <p className="text-secondary mb-0">Select a game to watch its replay</p>
        </div>
        <button onClick={() => navigate('/')} className="btn btn-outline-secondary">
          ← Back to Home
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {games.length === 0 ? (
        <div className="card bg-dark text-white border-secondary">
          <div className="card-body text-center py-5">
            <p className="text-secondary mb-0">No games found</p>
          </div>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-dark table-hover align-middle">
            <thead>
              <tr className="text-secondary">
                <th>Room</th>
                <th>Game #</th>
                <th>Status</th>
                <th>Hands Played</th>
                <th>Players</th>
                <th>Blinds</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {games.map((game) => (
                <tr
                  key={game.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/admin/replay/${game.id}`)}
                >
                  <td>
                    <span className="fw-bold text-warning" style={{ letterSpacing: '2px' }}>
                      {game.roomCode}
                    </span>
                  </td>
                  <td>#{game.gameNumber}</td>
                  <td>
                    <span className={getStatusBadge(game.status)}>{game.status}</span>
                  </td>
                  <td>{game.handNumber}</td>
                  <td>{game.players.length > 0 ? game.players.join(', ') : '-'}</td>
                  <td>
                    {game.smallBlind}/{game.bigBlind}
                  </td>
                  <td className="text-secondary">{formatDate(game.createdAt)}</td>
                  <td>
                    <button className="btn btn-sm btn-outline-primary">Watch Replay →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
