import { FaTrophy, FaEye, FaEyeSlash } from 'react-icons/fa6'
import type { GameState, Player } from '~/components/table/types'
import PokerCard from '~/components/table/PokerCard'
import { useAnimatedNumber } from '~/hooks/useAnimatedNumber'

interface PlayerShowdownProps {
  game: GameState
  myPlayer: Player | null
  winnerPositions: number[]
  amWinner: boolean
  onNextHand: () => Promise<any>
  onToggleShowCards: (show: boolean) => Promise<any>
}

function ShowdownPlayerCard({
  player,
  isWinner,
  preWinChips,
}: {
  player: Player
  isWinner: boolean
  preWinChips: number
}) {
  const {
    value: displayedChips,
    isAnimating,
    direction,
  } = useAnimatedNumber(player.chips, 400, 800, preWinChips)

  return (
    <div
      className={`p-2 rounded h-100 ${
        isWinner
          ? 'bg-warning bg-opacity-10 border border-warning'
          : 'bg-black bg-opacity-25 border border-white border-opacity-10'
      }`}
    >
      <div className="text-center mb-2">
        <div className="fw-bold text-truncate" style={{ fontSize: '0.9rem' }}>
          {player.name} {isWinner && <FaTrophy className="text-warning" />}
        </div>
        <div
          className={`small fw-bold ${isAnimating && direction === 'up' ? 'stack-gain' : 'text-warning'}`}
        >
          ${displayedChips}
        </div>
      </div>
      <div className="d-flex gap-1 justify-content-center">
        {(player.holeCards || []).length > 0 ? (
          player.holeCards!.map((card, idx) => (
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
  )
}

export default function PlayerShowdown({
  game,
  myPlayer,
  winnerPositions,
  amWinner,
  onNextHand,
  onToggleShowCards,
}: PlayerShowdownProps) {
  // Winnings are already applied to player.chips by the time this component
  // mounts (it only renders once currentRound === 'showdown'), so seed the
  // count-up animation from chips-minus-winnings rather than the live value.
  const winningsByPosition = new Map<number, number>()
  game.pots?.forEach((pot) => {
    if (!pot.winners || pot.winners.length === 0) return
    const winAmount = pot.winAmount || Math.floor(pot.amount / pot.winners.length)
    pot.winners.forEach((position) => {
      winningsByPosition.set(position, (winningsByPosition.get(position) || 0) + winAmount)
    })
  })

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
              <ShowdownPlayerCard
                player={p}
                isWinner={winnerPositions.includes(p.position)}
                preWinChips={p.chips - (winningsByPosition.get(p.position) || 0)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3">
        {myPlayer && (myPlayer.status === 'active' || myPlayer.status === 'all_in') && (
          <div className="mb-3">
            <button
              onClick={() => onToggleShowCards(!myPlayer.showCards)}
              className="btn-poker btn-poker-info w-100 btn-action-lg"
              style={{ height: '48px', fontSize: '1rem' }}
            >
              {myPlayer.showCards ? (
                <>
                  <FaEyeSlash className="me-2" />
                  Hide Cards
                </>
              ) : (
                <>
                  <FaEye className="me-2" />
                  Reveal Cards
                </>
              )}
            </button>
          </div>
        )}

        {game.isGameOver ? (
          <div className="alert alert-warning text-center fw-bold border-2 border-warning mb-0">
            <div className="display-6 mb-2">
              <FaTrophy />
            </div>
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
            {amWinner ? (
              <>
                <FaTrophy className="me-2" />
                Next Hand
              </>
            ) : (
              'Start Next Hand'
            )}
          </button>
        )}
      </div>
    </div>
  )
}
