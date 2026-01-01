import type { GameState } from '../hooks/usePlayerGame'

interface PlayerShowdownProps {
  game: GameState
  winnerPositions: number[]
  amWinner: boolean
  onNextHand: () => Promise<void>
}

export default function PlayerShowdown({
  game,
  winnerPositions,
  amWinner,
  onNextHand,
}: PlayerShowdownProps) {
  const getSuitColor = (suit: string) => {
    return suit === 'hearts' || suit === 'diamonds' ? '#d00' : '#000'
  }

  const formatCard = (card: { rank: string; suit: string }) => {
    const suitSymbols: Record<string, string> = {
      hearts: '♥',
      diamonds: '♦',
      clubs: '♣',
      spades: '♠',
    }
    return `${card.rank}${suitSymbols[card.suit] || card.suit}`
  }

  return (
    <div
      style={{
        marginBottom: '20px',
        padding: '16px',
        backgroundColor: '#234a34',
        borderRadius: '10px',
        border: '2px solid #456',
      }}
    >
      <h3 style={{ textAlign: 'center', marginTop: 0 }}>Showdown</h3>

      {winnerPositions.length > 0 && (
        <div
          style={{
            textAlign: 'center',
            marginBottom: '12px',
            fontSize: '18px',
          }}
        >
          Winner{winnerPositions.length > 1 ? 's' : ''}:{' '}
          <strong>
            {game.players
              .filter((p) => winnerPositions.includes(p.position))
              .map((p) => p.name)
              .join(', ')}
          </strong>
          {(() => {
            const winningRank = game.pots?.find((p) => p.winningRankName)?.winningRankName
            return winningRank ? <span> ({winningRank})</span> : null
          })()}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '12px',
        }}
      >
        {game.players.map((p) => (
          <div
            key={p.id}
            style={{
              backgroundColor: winnerPositions.includes(p.position) ? '#2a5a3a' : '#1a472a',
              border: winnerPositions.includes(p.position) ? '2px solid gold' : '2px solid #456',
              borderRadius: '10px',
              padding: '12px',
            }}
          >
            <div
              style={{
                fontWeight: 'bold',
                marginBottom: '8px',
                fontSize: '18px',
              }}
            >
              {p.name}
              {winnerPositions.includes(p.position) ? ' 🏆' : ''}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              {(p.holeCards || []).length > 0 ? (
                p.holeCards!.map((card, idx) => (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: '#fff',
                      color: getSuitColor(card.suit),
                      borderRadius: '8px',
                      fontSize: '20px',
                      fontWeight: 'bold',
                      width: '44px',
                      height: '64px',
                      textAlign: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {formatCard(card)}
                  </div>
                ))
              ) : (
                <>
                  <div
                    style={{
                      backgroundColor: '#0066cc',
                      background: 'linear-gradient(135deg, #0066cc 0%, #004499 100%)',
                      borderRadius: '8px',
                      fontSize: '20px',
                      fontWeight: 'bold',
                      width: '44px',
                      height: '64px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(255,255,255,0.85)',
                      opacity: 0.85,
                    }}
                  >
                    🂠
                  </div>
                  <div
                    style={{
                      backgroundColor: '#0066cc',
                      background: 'linear-gradient(135deg, #0066cc 0%, #004499 100%)',
                      borderRadius: '8px',
                      fontSize: '20px',
                      fontWeight: 'bold',
                      width: '44px',
                      height: '64px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(255,255,255,0.85)',
                      opacity: 0.85,
                    }}
                  >
                    🂠
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onNextHand}
        style={{
          width: '100%',
          marginTop: '14px',
          padding: '16px',
          fontSize: '18px',
          backgroundColor: amWinner ? 'gold' : '#4CAF50',
          color: amWinner ? '#000' : '#fff',
          border: 'none',
          borderRadius: '10px',
          cursor: 'pointer',
          fontWeight: 'bold',
        }}
      >
        {amWinner ? '🏆 Next Hand' : 'Start Next Hand'}
      </button>
    </div>
  )
}
