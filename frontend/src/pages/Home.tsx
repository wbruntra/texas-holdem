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
      }}
    >
      <h1 style={{ marginTop: '0', marginBottom: '1.5rem' }}>Texas Hold'em</h1>

      <div style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.5em', marginBottom: '0.5rem' }}>
          Create New Game
        </h2>
        <p style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
          Start a new game and show the table on this screen
        </p>
        <button
          onClick={handleCreateGame}
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
        <h2 style={{ fontSize: '1.5em', marginBottom: '0.5rem' }}>
          Join Existing Game
        </h2>
        <p style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
          Enter room code to join as a player
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Room Code (e.g. ABC123)"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            onKeyPress={(e) => e.key === 'Enter' && handleJoinGame()}
            style={{
              padding: '12px',
              fontSize: '16px',
              flex: '1 1 auto',
              minWidth: '150px',
              textTransform: 'uppercase',
              boxSizing: 'border-box',
            }}
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
    </div>
  );
}
