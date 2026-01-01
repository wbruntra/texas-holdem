import type { GameState } from './types'
import { formatCard, getSuitColor } from './cardUtils'

type Props = {
  game: GameState
}

export default function CommunityCenter({ game }: Props) {
  const communityCards = game.communityCards || []

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
        <div className="pot-display">
          <div className="pot-label">Pot</div>
          <div className="pot-amount">${game.pot}</div>
        </div>
      </div>
    </div>
  )
}
