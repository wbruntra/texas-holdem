import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Home() {
  const [roomCode, setRoomCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const getErrorMessage = (err: unknown, fallback: string) => {
    if (axios.isAxiosError(err)) {
      const message = err.response?.data?.error;
      if (typeof message === 'string' && message.trim()) return message;
    }
    return fallback;
  };

  const handleCreateGame = async () => {
    setCreating(true);
    setError('');
    
    try {
      const response = await axios.post('/api/games', {
        smallBlind: 5,
        bigBlind: 10,
        startingChips: 1000,
      });
      
      const roomCode = response.data.roomCode;
      navigate(`/table/${roomCode}`);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to create game'));
    } finally {
      setCreating(false);
    }
  };

  const handleJoinGame = () => {
    if (roomCode.trim()) {
      navigate(`/player/${roomCode}`);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '50px auto', padding: '20px' }}>
      <h1>Texas Hold'em</h1>
      
      <div style={{ marginTop: '40px' }}>
        <h2>Create New Game</h2>
        <p>Start a new game and show the table on this screen</p>
        <button 
          onClick={handleCreateGame}
          disabled={creating}
          style={{
            padding: '15px 30px',
            fontSize: '18px',
            cursor: creating ? 'not-allowed' : 'pointer',
          }}
        >
          {creating ? 'Creating...' : 'Create Game'}
        </button>
      </div>

      <div style={{ marginTop: '60px' }}>
        <h2>Join Existing Game</h2>
        <p>Enter room code to join as a player</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            placeholder="Room Code (e.g. ABC123)"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            onKeyPress={(e) => e.key === 'Enter' && handleJoinGame()}
            style={{
              padding: '15px',
              fontSize: '18px',
              flex: 1,
              textTransform: 'uppercase',
            }}
          />
          <button
            onClick={handleJoinGame}
            disabled={!roomCode.trim()}
            style={{
              padding: '15px 30px',
              fontSize: '18px',
              cursor: !roomCode.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            Join
          </button>
        </div>
      </div>

      {error && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: '#fee', 
          color: '#c00',
          borderRadius: '5px',
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
