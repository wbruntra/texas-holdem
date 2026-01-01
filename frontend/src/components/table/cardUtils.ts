import type { Card } from './types'

export const formatCard = (card: Card) => {
  const suitSymbols: Record<string, string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
  }
  return `${card.rank}${suitSymbols[card.suit] || card.suit}`
}

export const getSuitColor = (suit: string) => {
  switch (suit.toLowerCase()) {
    case 'hearts':
      return '#e00'
    case 'diamonds':
      return '#26f'
    case 'clubs':
      return '#080'
    case 'spades':
      return '#000'
    default:
      return '#000'
  }
}

export const formatAction = (action: string | null | undefined) => {
  if (!action) return ''
  const actionMap: Record<string, string> = {
    fold: 'Folded',
    check: 'Checked',
    call: 'Called',
    bet: 'Bet',
    raise: 'Raised',
    all_in: 'All-In',
  }
  return actionMap[action.toLowerCase()] || action
}
