import type { CSSProperties } from 'react'
import type { Card } from './types'
import './PokerCard.css'

type Props = {
  card?: Card | null
  hidden?: boolean
  className?: string
  style?: CSSProperties
}

const suitSymbols: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

export default function PokerCard({ card, hidden, className = '', style }: Props) {
  if (hidden || !card) {
    return (
      <div className={`poker-card card-back ${className}`} style={style}>
        <div className="card-pattern"></div>
      </div>
    )
  }

  const { rank, suit } = card
  const symbol = suitSymbols[suit.toLowerCase()] || suit

  let colorClass = 'text-black'
  switch (suit.toLowerCase()) {
    case 'hearts':
      colorClass = 'text-red'
      break
    case 'diamonds':
      colorClass = 'text-blue'
      break
    case 'clubs':
      colorClass = 'text-green'
      break
    case 'spades':
      colorClass = 'text-black'
      break
  }

  return (
    <div className={`poker-card card-face ${colorClass} ${className}`} style={style}>
      <span className="card-text">
        {rank}
        {symbol}
      </span>
    </div>
  )
}
