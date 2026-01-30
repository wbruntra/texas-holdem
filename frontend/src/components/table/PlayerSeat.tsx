import { useState, useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { GameState, Player } from './types'
import PokerCard from './PokerCard'
import ChipStack from './ChipStack'

type Props = {
  game: GameState
  player: Player
  index: number
  style: CSSProperties
  orientation?: 'top' | 'bottom' | 'left' | 'right'
}

export default function PlayerSeat({ game, player, index, style, orientation = 'bottom' }: Props) {
  const isFolded = player.status === 'folded'
  const isAllIn = player.status === 'all_in'
  // Active means involved in hand (not folded), OR it's their turn
  const isActive = player.status === 'active' || player.status === 'all_in'
  const isCurrentTurn = game.currentPlayerPosition === index
  const isDealer = game.dealerPosition === index
  const winnerPositions = Array.isArray(game.winners) ? game.winners : []
  const isWinner = winnerPositions.includes(player.position)
  const isShowdown = game.currentRound === 'showdown'

  // Track chip stack animation
  const [showStackGain, setShowStackGain] = useState(false)
  const previousChipsRef = useRef(player.chips)
  const previousWinnerRef = useRef(isWinner)

  useEffect(() => {
    // Trigger stack gain animation when player becomes a winner and chips increase
    if (isWinner && isShowdown && player.chips > previousChipsRef.current) {
      setShowStackGain(true)
      const timer = setTimeout(() => {
        setShowStackGain(false)
      }, 600)
      return () => clearTimeout(timer)
    }
    previousChipsRef.current = player.chips
    previousWinnerRef.current = isWinner
  }, [isWinner, isShowdown, player.chips])

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
      className={`poker-seat orient-${orientation} ${isActive || isCurrentTurn ? 'active' : 'inactive'} ${isFolded ? 'is-folded' : ''}`}
      style={style}
    >
      {/* Cards Display - Outer Element */}
      {/* Only show cards if not folded */}
      {!isFolded && (isActive || isAllIn || isShowdown) && (
        <div className="hand-container">
          {/* Security principle: Backend controls what we receive.
              If we have hole cards, show them face-up.
              If not, show card backs.
              The backend will only send cards when they should be visible. */}
          {player.holeCards && player.holeCards.length > 0 ? (
            player.holeCards.slice(0, 2).map((card, i) => (
              <div
                key={i}
                style={{
                  transform:
                    i === 0 ? 'rotate(-8deg) translateX(2px)' : 'rotate(8deg) translateX(8px)',
                  zIndex: i === 0 ? 1 : 2,
                  marginTop: i === 1 ? '4px' : '0',
                  display: 'flex', // Ensure wrapper behaves correctly
                }}
              >
                <PokerCard card={card} className="small deal-animation" />
              </div>
            ))
          ) : (
            <>
              {/* Card Backs - shown when backend doesn't send cards */}
              <div
                style={{
                  transform: 'rotate(-8deg) translateX(14px)',
                  zIndex: 1,
                  display: 'flex',
                }}
              >
                <PokerCard hidden className="small" />
              </div>
              <div
                style={{
                  transform: 'rotate(8deg) translateX(8px)',
                  zIndex: 2,
                  marginTop: '4px',
                  display: 'flex',
                }}
              >
                <PokerCard hidden className="small" />
              </div>
            </>
          )}
        </div>
      )}

      {/* Main Pill Container - Middle Element */}
      <div
        className={`seat-pill ${isCurrentTurn ? 'active-turn' : ''} ${isWinner && isShowdown ? 'is-winner' : ''} ${isAllIn ? 'all-in' : ''}`}
      >
        {/* Avatar Area */}
        <div className="seat-avatar">
          {getInitials(player.name)}

          {/* Dealer Button Overlay - Inside avatar again */}
          {isDealer && (
            <div
              className="dealer-button"
              style={{
                position: 'absolute',
                bottom: -6,
                right: -6,
                width: '18px',
                height: '18px',
                fontSize: '11px',
                zIndex: 20,
                border: '1px solid #fff',
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
            {isWinner && isShowdown && '🏆 '}
            {player.name}
          </div>
          <div
            className={`player-stack ${isAllIn ? 'all-in-text' : ''} ${showStackGain ? 'stack-gain' : ''}`}
          >
            {isAllIn ? 'ALL-IN' : `$${player.chips}`}
          </div>
        </div>
      </div>

      {/* Bet Chips - Inner Element */}
      <div className="seat-chips" style={{ minWidth: '24px', minHeight: '24px' }}>
        {player.currentBet > 0 && <ChipStack amount={player.currentBet} />}
      </div>
    </div>
  )
}
