import type { Player } from '~/components/table/types'

type Props = {
  players: Player[]
  myName: string
  currentPlayerPosition: number | null
  dealerPosition: number | null
  isShowdown?: boolean
  winnerPositions?: number[]
}

function formatAction(p: Player): string | null {
  const action = p.lastAction
  if (!action) return null
  switch (action.toLowerCase()) {
    case 'fold':
      return 'Fold'
    case 'check':
      return 'Check'
    case 'call':
      return p.currentBet > 0 ? `Call ${p.currentBet}` : 'Call'
    case 'bet':
      return p.currentBet > 0 ? `Bet ${p.currentBet}` : 'Bet'
    case 'raise':
      return p.currentBet > 0 ? `Raise ${p.currentBet}` : 'Raise'
    case 'all_in':
      return p.currentBet > 0 ? `All-in ${p.currentBet}` : 'All-in'
    default:
      return action
  }
}

export default function OpponentStrip({
  players,
  myName,
  currentPlayerPosition,
  dealerPosition,
  isShowdown = false,
  winnerPositions = [],
}: Props) {
  const opponents = players
    .filter((p) => p.name !== myName)
    .sort((a, b) => a.position - b.position)

  if (opponents.length === 0) return null

  return (
    <div className="opponent-strip">
      {opponents.map((p) => {
        const isActive = p.position === currentPlayerPosition
        const isDealer = p.position === dealerPosition
        const isFolded = p.status === 'folded'
        const isAllIn = p.status === 'all_in'
        const isOut = p.status === 'out'
        const isWinner = winnerPositions.includes(p.position)
        const actionText = isShowdown && isWinner ? 'WIN' : formatAction(p)

        const cls = [
          'opponent-tile',
          isActive ? 'active' : '',
          isFolded ? 'folded' : '',
          isAllIn ? 'allin' : '',
          isOut ? 'out' : '',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <div key={p.id} className={cls}>
            <div className="opponent-tile-head">
              {isDealer && <span className="dealer-chip">D</span>}
              <span className="opponent-name">{p.name}</span>
            </div>
            <div className="opponent-stack">${p.chips}</div>
            {actionText && <div className="opponent-action">{actionText}</div>}
            {(isFolded || isAllIn || isOut) && !actionText && (
              <div className="opponent-action">
                {isFolded ? 'FOLD' : isAllIn ? 'ALL-IN' : 'OUT'}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
