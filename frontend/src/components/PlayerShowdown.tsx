import type { GameState } from '~/components/table/types'

interface PlayerShowdownProps {
  game: GameState
  winnerPositions: number[]
  amWinner: boolean
  onNextHand: () => Promise<void>
  onToggleShowCards: (show: boolean) => Promise<void>
}

export default function PlayerShowdown({
  game,
  winnerPositions,
  amWinner,
  onNextHand,
  onToggleShowCards,
}: PlayerShowdownProps) {
  const getSuitClass = (suit: string) => {
    return suit === 'hearts' || suit === 'diamonds' ? 'card-red' : 'card-black'
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
    <div className="card bg-dark text-white border-secondary mb-4">
      <div className="card-body">
        <h3 className="text-center mb-3">Showdown</h3>

        {game.pots && game.pots.length > 0 && (
          <div className="mb-4">
            {game.pots.map((pot, idx) => {
              if (!pot.winners || pot.winners.length === 0) return null

              const potLabel =
                game.pots!.length > 1 ? (idx === 0 ? 'Main Pot' : `Side Pot ${idx}`) : 'Pot'

              const potWinners = game.players.filter((p) => pot.winners!.includes(p.position))
              const winAmount = pot.winAmount || Math.floor(pot.amount / pot.winners.length)

              return (
                <div key={idx} className="alert alert-success text-center mb-2">
                  <div
                    className="small text-uppercase text-muted mb-1"
                    style={{ fontSize: '0.7rem' }}
                  >
                    {potLabel}
                  </div>
                  {potWinners.map((winner, wIdx) => (
                    <div key={wIdx} className="mb-1">
                      <strong>{winner.name}</strong> won <strong>${winAmount}</strong>
                      {pot.winningRankName && (
                        <span className="text-muted"> with {pot.winningRankName}</span>
                      )}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {(!game.pots || game.pots.length === 0) && winnerPositions.length > 0 && (
          <div className="alert alert-success text-center mb-4">
            <div className="h5 mb-1">
              Winner{winnerPositions.length > 1 ? 's' : ''}:{' '}
              <strong>
                {game.players
                  .filter((p) => winnerPositions.includes(p.position))
                  .map((p) => p.name)
                  .join(', ')}
              </strong>
            </div>
          </div>
        )}

        <div className="row g-3">
          {game.players.map((p) => (
            <div key={p.id} className="col-12 col-md-6">
              <div
                className={`card h-100 ${
                  winnerPositions.includes(p.position)
                    ? 'border-warning bg-opacity-25 bg-success'
                    : 'border-secondary bg-transparent'
                }`}
              >
                <div className="card-body p-2 text-center">
                  <div className="fw-bold mb-2">
                    {p.name}
                    {winnerPositions.includes(p.position) ? ' 🏆' : ''}
                  </div>
                  <div className="d-flex gap-2 justify-content-center">
                    {(p.holeCards || []).length > 0 ? (
                      p.holeCards!.map((card, idx) => (
                        <div key={idx} className={`card-display small ${getSuitClass(card.suit)}`}>
                          {formatCard(card)}
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="card-back">🂠</div>
                        <div className="card-back">🂠</div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {amWinner &&
          game.players.filter((p) => p.status === 'active' || p.status === 'all_in').length ===
            1 && (
            <div className="text-center mt-3">
              <button
                onClick={() => {
                  const me = game.players.find((p) => winnerPositions.includes(p.position))
                  if (me) onToggleShowCards(!((me as { showCards?: boolean }).showCards ?? false))
                }}
                className="btn btn-outline-info btn-sm"
              >
                {game.players.find((p) => winnerPositions.includes(p.position))?.showCards
                  ? '🙈 Hide Cards'
                  : '👁️ Reveal Cards'}
              </button>
            </div>
          )}

        <button
          onClick={onNextHand}
          className={`btn btn-lg w-100 mt-4 ${amWinner ? 'btn-warning text-dark fw-bold' : 'btn-success fw-bold'}`}
        >
          {amWinner ? '🏆 Next Hand' : 'Start Next Hand'}
        </button>
      </div>
    </div>
  )
}
