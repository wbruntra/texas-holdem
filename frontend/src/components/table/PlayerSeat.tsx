import type { CSSProperties } from 'react'
import type { GameState, Player } from './types'
import { formatCard, getSuitColor } from './cardUtils'

type Props = {
  game: GameState
  player: Player
  index: number
  style: CSSProperties
}

export default function PlayerSeat({ game, player, index, style }: Props) {
  const isFolded = player.status === 'folded'
  const isAllIn = player.status === 'all_in'
  // Active means involved in hand (not folded), OR it's their turn
  const isActive = player.status === 'active' || player.status === 'all_in'
  const isCurrentTurn = game.currentPlayerPosition === index
  const isDealer = game.dealerPosition === index
  const winnerPositions = Array.isArray(game.winners) ? game.winners : []
  const isWinner = winnerPositions.includes(player.position)
  const isShowdown = game.currentRound === 'showdown'

  // Helper for initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  return (
    <div
      className={`poker-seat ${isActive || isCurrentTurn ? 'active' : 'inactive'} ${isFolded ? 'is-folded' : ''}`}
      style={style}
    >
      {/* Bet Bubble - Absolute positioned above/outside */}
      {player.currentBet > 0 && <div className="bet-bubble">${player.currentBet}</div>}

      {/* Main Pill Container */}
      <div
        className={`seat-pill ${isCurrentTurn ? 'active-turn' : ''} ${isWinner ? 'is-winner' : ''} ${isAllIn ? 'all-in' : ''}`}
      >
        {/* Avatar Area */}
        <div className="seat-avatar">
          {getInitials(player.name)}

          {/* Dealer Button Overlay */}
          {isDealer && (
            <div
              style={{
                position: 'absolute',
                bottom: -4,
                right: -4,
                backgroundColor: '#ffc107',
                color: '#000',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                fontSize: '10px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #fff',
                zIndex: 5,
              }}
              title="Dealer"
            >
              D
            </div>
          )}
        </div>

        {/* Player Info */}
        <div className="seat-info">
          <div className="player-name">
            {isWinner && '🏆 '}
            {player.name}
          </div>
          <div className={`player-stack ${isAllIn ? 'all-in-text' : ''}`}>
            {isAllIn ? 'ALL-IN' : `$${player.chips}`}
          </div>
        </div>
      </div>

      {/* Cards Display */}
      {/* Only show cards if not folded, or if folded but we want to show them temporarily (logic depends on game, usually folded = hidden/mucked) */}
      {!isFolded && (isActive || isAllIn || isShowdown) && (
        <div className="hand-container">
          {/* Logic for hole cards:
              If showdown and we have cards, show them face up.
              Else if active/all-in (and not showdown or no cards revealed), show backs. 
          */}
          {isShowdown && player.holeCards && player.holeCards.length > 0 ? (
            player.holeCards.slice(0, 2).map((card, i) => (
              <div
                key={i}
                className="poker-card-small"
                style={{
                  color: getSuitColor(card.suit),
                  transform:
                    i === 0 ? 'rotate(-6deg) translateX(4px)' : 'rotate(6deg) translateX(-4px)',
                  zIndex: i === 0 ? 1 : 2,
                  marginTop: i === 1 ? '4px' : '0', // Slight vertical offset for natural look? Or just rotation.
                }}
              >
                {formatCard(card)}
              </div>
            ))
          ) : (
            <>
              {/* Card Backs for active players hole cards */}
              <div
                className="poker-card-small poker-card-back"
                style={{ transform: 'rotate(-6deg) translateX(4px)', zIndex: 1 }}
              />
              <div
                className="poker-card-small poker-card-back"
                style={{ transform: 'rotate(6deg) translateX(-4px)', zIndex: 2 }}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
