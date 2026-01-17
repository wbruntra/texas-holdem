import type { GameState } from '~/components/table/types'
import PokerCard from '~/components/table/PokerCard'

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
  return (
    <div className="d-flex flex-column h-100">
      <div className="text-center mb-3">
        <h3 className="mb-0">Showdown</h3>
      </div>

      <div className="flex-grow-1 overflow-auto overflow-x-hidden p-1">
        {game.pots && game.pots.length > 0 && (
          <div className="mb-3">
            {game.pots.map((pot, idx) => {
              if (!pot.winners || pot.winners.length === 0) return null

              const potLabel =
                game.pots!.length > 1 ? (idx === 0 ? 'Main Pot' : `Side Pot ${idx}`) : 'Pot'

              const potWinners = game.players.filter((p) => pot.winners!.includes(p.position))
              const winAmount = pot.winAmount || Math.floor(pot.amount / pot.winners.length)

              return (
                <div
                  key={idx}
                  className="bg-success bg-opacity-25 border border-success border-opacity-25 rounded p-2 mb-2 text-center"
                >
                  <div
                    className="small text-uppercase text-white-50 mb-1"
                    style={{ fontSize: '0.7rem' }}
                  >
                    {potLabel}
                  </div>
                  {potWinners.map((winner, wIdx) => (
                    <div key={wIdx} className="mb-1">
                      <strong>{winner.name}</strong> won{' '}
                      <strong className="text-warning">${winAmount}</strong>
                      {pot.winningRankName && (
                        <div className="small text-white-50">{pot.winningRankName}</div>
                      )}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        <div className="row g-2">
          {game.players.map((p) => (
            <div key={p.id} className="col-6">
              <div
                className={`p-2 rounded h-100 ${
                  winnerPositions.includes(p.position)
                    ? 'bg-warning bg-opacity-10 border border-warning'
                    : 'bg-black bg-opacity-25 border border-white border-opacity-10'
                }`}
              >
                <div className="text-center mb-2">
                  <div className="fw-bold text-truncate" style={{ fontSize: '0.9rem' }}>
                    {p.name} {winnerPositions.includes(p.position) && '🏆'}
                  </div>
                </div>
                <div className="d-flex gap-1 justify-content-center">
                  {(p.holeCards || []).length > 0 ? (
                    p.holeCards!.map((card, idx) => (
                      <PokerCard key={idx} card={card} className="small" />
                    ))
                  ) : (
                    <>
                      <PokerCard hidden className="small" />
                      <PokerCard hidden className="small" />
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3">
        {amWinner &&
          game.players.filter((p) => p.status === 'active' || p.status === 'all_in').length ===
            1 && (
            <div className="mb-3">
              <button
                onClick={() => {
                  const me = game.players.find((p) => winnerPositions.includes(p.position))
                  if (me) onToggleShowCards(!((me as { showCards?: boolean }).showCards ?? false))
                }}
                className="btn-poker btn-poker-info w-100 btn-action-lg"
                style={{ height: '48px', fontSize: '1rem' }}
              >
                {game.players.find((p) => winnerPositions.includes(p.position))?.showCards
                  ? '🙈 Hide Cards'
                  : '👁️ Reveal Cards'}
              </button>
            </div>
          )}

        {game.isGameOver ? (
          <div className="alert alert-warning text-center fw-bold border-2 border-warning mb-0">
            <div className="display-6 mb-2">🏆</div>
            <div>GAME OVER</div>
            <div className="small fw-normal mt-1">Check the main screen for results</div>
          </div>
        ) : (
          <button
            onClick={onNextHand}
            className={`btn-poker w-100 btn-action-lg ${
              amWinner ? 'btn-poker-secondary' : 'btn-poker-primary'
            }`}
          >
            {amWinner ? '🏆 Next Hand' : 'Start Next Hand'}
          </button>
        )}
      </div>
    </div>
  )
}
