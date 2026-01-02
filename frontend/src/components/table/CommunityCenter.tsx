import type { GameState } from './types'
import { formatCard, getSuitColor } from './cardUtils'
import { getDisplayPot } from '../../utils/potUtils'

type Props = {
  game: GameState
}

export default function CommunityCenter({ game }: Props) {
  const communityCards = game.communityCards || []
  const displayPot = getDisplayPot(game.players, game.pots)
  const isShowdown = game.currentRound === 'showdown'

  return (
    <div className="poker-table-center">
      <div className="poker-table-community">
        {Array.from({ length: 5 }).map((_, idx) => {
          const card = communityCards[idx]

          if (card) {
            return (
              <div
                key={idx}
                className="community-card"
                style={{ color: getSuitColor(card.suit) }}
                aria-label={`Community card ${idx + 1}: ${formatCard(card)}`}
              >
                {formatCard(card)}
              </div>
            )
          }

          return (
            <div
              key={idx}
              className="community-card back"
              aria-label={`Community card ${idx + 1}: face down`}
            />
          )
        })}
      </div>

      <div className="poker-table-pot">
        {isShowdown && game.pots && game.pots.length > 0 ? (
          <div className="pot-display" style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {game.pots.map((pot, idx) => {
              if (!pot.winners || pot.winners.length === 0) return null

              const potLabel =
                game.pots!.length > 1 ? (idx === 0 ? 'Main Pot' : `Side Pot ${idx}`) : 'Winner'

              const winners = game.players.filter((p) => pot.winners!.includes(p.position))
              const winAmount = pot.winAmount || Math.floor(pot.amount / pot.winners.length)

              return (
                <div key={idx} style={{ marginBottom: '8px', padding: '4px' }}>
                  <div className="pot-label" style={{ fontSize: '0.7rem', marginBottom: '2px' }}>
                    {potLabel}
                  </div>
                  {winners.map((winner, wIdx) => (
                    <div key={wIdx} style={{ fontSize: '0.85rem', marginBottom: '2px' }}>
                      <strong>{winner.name}</strong> won <strong>${winAmount}</strong>
                      {pot.winningRankName && (
                        <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                          {pot.winningRankName}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="pot-display">
            <div className="pot-label">Pot</div>
            <div className="pot-amount">${displayPot}</div>
          </div>
        )}
      </div>
    </div>
  )
}
