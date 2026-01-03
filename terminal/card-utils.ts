export interface Card {
  rank: string
  suit: string
}

const suitSymbols: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

const suitColors: Record<string, string> = {
  hearts: '\x1b[31m',
  diamonds: '\x1b[36m',
  clubs: '\x1b[32m',
  spades: '\x1b[37m',
}

const reset = '\x1b[0m'

export function formatCard(card: Card, useColor = true): string {
  const symbol = suitSymbols[card.suit.toLowerCase()] || '?'
  if (!useColor) {
    return `${card.rank}${symbol}`
  }
  const color = suitColors[card.suit.toLowerCase()] || ''
  return `${color}${card.rank}${symbol}${reset}`
}

export function formatCards(cards: Card[], useColor = true): string {
  if (!cards || cards.length === 0) return ''
  return cards.map((c) => formatCard(c, useColor)).join(' ')
}

export function formatCardPlain(card: Card): string {
  return formatCard(card, false)
}
