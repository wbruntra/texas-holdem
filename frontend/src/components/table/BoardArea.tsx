import PokerCard from './PokerCard'
import type { Card, Player } from './types'

type Props = {
  pot: number
  toCall: number
  communityCards: Card[]
  myPlayer: Player | null
  currentPlayerPosition: number | null
}

const BOARD_SIZE = 5

export default function BoardArea({
  pot,
  toCall,
  communityCards,
  myPlayer,
  currentPlayerPosition,
}: Props) {
  const isMyTurn = !!myPlayer && currentPlayerPosition === myPlayer.position
  const cards = Array.from({ length: BOARD_SIZE }, (_, i) => communityCards[i] ?? null)

  return (
    <div className={`board-area ${isMyTurn ? 'my-turn' : ''}`}>
      <div className="board-head">
        <div className="board-pot">
          <div className="board-pot-label">POT</div>
          <div className="board-pot-value">${pot}</div>
        </div>
        {toCall > 0 && <div className="board-tocall">To call ${toCall}</div>}
      </div>

      <div className="board-row">
        {cards.map((card, idx) => (
          <PokerCard key={idx} card={card ?? undefined} hidden={!card} className="board" />
        ))}
      </div>

      {myPlayer?.holeCards && myPlayer.holeCards.length > 0 && (
        <div className="board-hole">
          <div className="board-hole-label">YOU</div>
          <div className="board-hole-row">
            {myPlayer.holeCards.map((card: Card, idx: number) => (
              <PokerCard key={idx} card={card} className="hole" />
            ))}
          </div>
          <div className="board-hole-stack">${myPlayer.chips}</div>
        </div>
      )}
    </div>
  )
}
