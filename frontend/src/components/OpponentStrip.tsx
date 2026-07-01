import type { Player } from '~/components/table/types'
import { useAnimatedNumber } from '~/hooks/useAnimatedNumber'

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

function OpponentTile({
  player,
  isMe,
  isActive,
  isDealer,
  isFolded,
  isAllIn,
  isOut,
  actionText,
}: {
  player: Player
  isMe: boolean
  isActive: boolean
  isDealer: boolean
  isFolded: boolean
  isAllIn: boolean
  isOut: boolean
  actionText: string | null
}) {
  const { value: displayedChips, isAnimating, direction } = useAnimatedNumber(player.chips)

  const cls = [
    'opponent-tile',
    isMe ? 'me' : '',
    isActive ? 'active' : '',
    isFolded ? 'folded' : '',
    isAllIn ? 'allin' : '',
    isOut ? 'out' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cls}>
      <div className="opponent-tile-head">
        {isDealer && <span className="dealer-chip">D</span>}
        <span className="opponent-name">{player.name}</span>
      </div>
      <div className={`opponent-stack ${isAnimating && direction === 'up' ? 'stack-gain' : ''}`}>
        ${displayedChips}
      </div>
      {actionText && <div className="opponent-action">{actionText}</div>}
      {(isFolded || isAllIn || isOut) && !actionText && (
        <div className="opponent-action">{isFolded ? 'FOLD' : isAllIn ? 'ALL-IN' : 'OUT'}</div>
      )}
    </div>
  )
}

export default function OpponentStrip({
  players,
  myName,
  currentPlayerPosition,
  dealerPosition,
  isShowdown = false,
  winnerPositions = [],
}: Props) {
  const sortedPlayers = [...players].sort((a, b) => a.position - b.position)

  if (sortedPlayers.length === 0) return null

  return (
    <div className="opponent-strip">
      {sortedPlayers.map((p) => {
        const isWinner = winnerPositions.includes(p.position)
        const actionText = isShowdown && isWinner ? 'WIN' : formatAction(p)

        return (
          <OpponentTile
            key={p.id}
            player={p}
            isMe={p.name === myName}
            isActive={p.position === currentPlayerPosition}
            isDealer={p.position === dealerPosition}
            isFolded={p.status === 'folded'}
            isAllIn={p.status === 'all_in'}
            isOut={p.status === 'out'}
            actionText={actionText}
          />
        )
      })}
    </div>
  )
}
