/**
 * Core poker engine - handles cards, deck, and hand evaluation
 */

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'

export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
export const RANK_VALUES: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
}

export const HAND_RANKINGS = {
  HIGH_CARD: 1,
  PAIR: 2,
  TWO_PAIR: 3,
  THREE_OF_A_KIND: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  FOUR_OF_A_KIND: 8,
  STRAIGHT_FLUSH: 9,
  ROYAL_FLUSH: 10,
} as const

export type HandRanking = (typeof HAND_RANKINGS)[keyof typeof HAND_RANKINGS]

export interface Card {
  rank: Rank
  suit: Suit
  value: number
  toString(): string
}

export interface HandEvaluation {
  rank: HandRanking
  rankName: string
  value: number
  cards: Card[]
  highCard?: number
  quads?: Rank
  trips?: Rank
  pair?: Rank
  pairs?: Rank[]
}

export interface DealResult {
  players: Card[][]
  deck: Card[]
}

export interface SeededRandom {
  (): number
}

export function createCard(rank: Rank, suit: Suit): Card {
  return {
    rank,
    suit,
    value: RANK_VALUES[rank],
    toString() {
      const suitSymbols: Record<Suit, string> = {
        hearts: '♥',
        diamonds: '♦',
        clubs: '♣',
        spades: '♠',
      }
      return `${rank}${suitSymbols[suit]}`
    },
  }
}

export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(createCard(rank, suit))
    }
  }
  return deck
}

export function shuffleDeck(deck: Card[], seed?: string | number): Card[] {
  const shuffled = [...deck]

  if (seed !== undefined) {
    const seededRandom = createSeededRandom(seed)
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
  } else {
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
  }

  return shuffled
}

export function createSeededRandom(seed: string | number): SeededRandom {
  let seedNum: number
  if (typeof seed === 'string') {
    seedNum = !isNaN(Number(seed)) ? Number(seed) : stringToHash(seed)
  } else {
    seedNum = Number(seed)
  }

  let state = seedNum

  return function (): number {
    state += 0x6d2b79f5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function stringToHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

export function dealHoleCards(deck: Card[], numPlayers: number): DealResult {
  const players: Card[][] = Array(numPlayers)
    .fill(null)
    .map(() => [])
  let deckIndex = 0

  for (let i = 0; i < 2; i++) {
    for (let p = 0; p < numPlayers; p++) {
      players[p].push(deck[deckIndex++])
    }
  }

  return {
    players,
    deck: deck.slice(deckIndex),
  }
}

export interface RankCount {
  [rank: string]: number
}

export interface SuitCount {
  [suit: string]: number
}

export function countRanks(cards: Card[]): RankCount {
  const counts: RankCount = {}
  for (const card of cards) {
    counts[card.rank] = (counts[card.rank] || 0) + 1
  }
  return counts
}

export function countSuits(cards: Card[]): SuitCount {
  const counts: SuitCount = {}
  for (const card of cards) {
    counts[card.suit] = (counts[card.suit] || 0) + 1
  }
  return counts
}

export function checkStraight(cards: Card[]): number | false {
  const values = [...new Set(cards.map((c) => c.value))].sort((a, b) => b - a)

  if (values.length < 5) return false

  for (let i = 0; i <= values.length - 5; i++) {
    let isStraight = true
    for (let j = 0; j < 4; j++) {
      if (values[i + j] - values[i + j + 1] !== 1) {
        isStraight = false
        break
      }
    }
    if (isStraight) return values[i]
  }

  if (
    values.includes(14) &&
    values.includes(2) &&
    values.includes(3) &&
    values.includes(4) &&
    values.includes(5)
  ) {
    return 5
  }

  return false
}

export function checkFlush(cards: Card[]): Card[] | false {
  const suitCounts = countSuits(cards)
  for (const suit in suitCounts) {
    if (suitCounts[suit] >= 5) {
      return cards
        .filter((c) => c.suit === suit)
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
    }
  }
  return false
}

export function evaluateHand(holeCards: Card[], communityCards: Card[] = []): HandEvaluation {
  const allCards = [...holeCards, ...communityCards]
  if (allCards.length < 5) {
    return {
      rank: HAND_RANKINGS.HIGH_CARD,
      rankName: 'High Card',
      value: 0,
      cards: allCards.sort((a, b) => b.value - a.value),
    }
  }

  const rankCounts = countRanks(allCards)
  const sortedCards = [...allCards].sort((a, b) => b.value - a.value)

  const groups: { [count: string]: { rank: Rank; value: number; count: number }[] } = {}
  for (const rank in rankCounts) {
    const count = rankCounts[rank]
    if (!groups[count]) groups[count] = []
    groups[count].push({
      rank: rank as Rank,
      value: RANK_VALUES[rank as Rank],
      count,
    })
  }

  for (const count in groups) {
    groups[count].sort((a, b) => b.value - a.value)
  }

  const flush = checkFlush(allCards)
  const straight = checkStraight(allCards)

  if (flush && straight) {
    const flushCards = flush
    const straightCheck = checkStraight(flushCards)
    if (straightCheck) {
      const isRoyal = flushCards[0].value === 14 && straightCheck === 14
      return {
        rank: isRoyal ? HAND_RANKINGS.ROYAL_FLUSH : HAND_RANKINGS.STRAIGHT_FLUSH,
        rankName: isRoyal ? 'Royal Flush' : 'Straight Flush',
        value: straightCheck * 100000,
        cards: flushCards.slice(0, 5),
        highCard: straightCheck,
      }
    }
  }

  if (groups[4]) {
    const quads = groups[4][0]
    const kicker = sortedCards.find((c) => c.rank !== quads.rank)
    return {
      rank: HAND_RANKINGS.FOUR_OF_A_KIND,
      rankName: 'Four of a Kind',
      value: quads.value * 100000 + (kicker?.value || 0),
      cards: allCards.filter((c) => c.rank === quads.rank).concat(kicker ? [kicker] : []),
      quads: quads.rank,
    }
  }

  if (groups[3] && (groups[2] || groups[3].length > 1)) {
    const trips = groups[3][0]
    const pair = groups[2] ? groups[2][0] : groups[3][1]
    return {
      rank: HAND_RANKINGS.FULL_HOUSE,
      rankName: 'Full House',
      value: trips.value * 100000 + pair.value,
      cards: allCards.filter((c) => c.rank === trips.rank || c.rank === pair.rank).slice(0, 5),
      trips: trips.rank,
      pair: pair.rank,
    }
  }

  if (flush) {
    const flushValue = flush.reduce((sum, card, i) => sum + card.value * Math.pow(100, 4 - i), 0)
    return {
      rank: HAND_RANKINGS.FLUSH,
      rankName: 'Flush',
      value: flushValue,
      cards: flush.slice(0, 5),
    }
  }

  if (straight) {
    return {
      rank: HAND_RANKINGS.STRAIGHT,
      rankName: 'Straight',
      value: straight * 100000,
      cards: sortedCards.slice(0, 5),
      highCard: straight,
    }
  }

  if (groups[3]) {
    const trips = groups[3][0]
    const kickers = sortedCards.filter((c) => c.rank !== trips.rank).slice(0, 2)
    return {
      rank: HAND_RANKINGS.THREE_OF_A_KIND,
      rankName: 'Three of a Kind',
      value: trips.value * 100000 + kickers[0].value * 100 + (kickers[1]?.value || 0),
      cards: allCards.filter((c) => c.rank === trips.rank).concat(kickers),
      trips: trips.rank,
    }
  }

  if (groups[2] && groups[2].length >= 2) {
    const pair1 = groups[2][0]
    const pair2 = groups[2][1]
    const kicker = sortedCards.find((c) => c.rank !== pair1.rank && c.rank !== pair2.rank)
    return {
      rank: HAND_RANKINGS.TWO_PAIR,
      rankName: 'Two Pair',
      value: pair1.value * 10000 + pair2.value * 100 + (kicker?.value || 0),
      cards: allCards
        .filter((c) => c.rank === pair1.rank || c.rank === pair2.rank)
        .concat(kicker ? [kicker] : [])
        .slice(0, 5),
      pairs: [pair1.rank, pair2.rank],
    }
  }

  if (groups[2]) {
    const pair = groups[2][0]
    const kickers = sortedCards.filter((c) => c.rank !== pair.rank).slice(0, 3)
    return {
      rank: HAND_RANKINGS.PAIR,
      rankName: 'Pair',
      value:
        pair.value * 100000 +
        kickers.reduce((sum, card, i) => sum + card.value * Math.pow(100, 2 - i), 0),
      cards: allCards.filter((c) => c.rank === pair.rank).concat(kickers),
      pair: pair.rank,
    }
  }

  const topFive = sortedCards.slice(0, 5)
  const highCardValue = topFive.reduce(
    (sum, card, i) => sum + card.value * Math.pow(100, 4 - i),
    0,
  )
  return {
    rank: HAND_RANKINGS.HIGH_CARD,
    rankName: 'High Card',
    value: highCardValue,
    cards: topFive,
  }
}

export function compareHands(hand1: HandEvaluation, hand2: HandEvaluation): number {
  if (hand1.rank !== hand2.rank) {
    return hand1.rank > hand2.rank ? 1 : -1
  }

  if (hand1.value !== hand2.value) {
    return hand1.value > hand2.value ? 1 : -1
  }

  return 0
}

export interface PlayerWithHoleCards {
  holeCards: Card[]
  [key: string]: unknown
}

export function determineWinners(
  players: PlayerWithHoleCards[],
  communityCards: Card[],
): number[] {
  const evaluations = players.map((player, index) => ({
    index,
    hand: evaluateHand(player.holeCards, communityCards),
    player,
  }))

  let bestHand = evaluations[0].hand
  for (let i = 1; i < evaluations.length; i++) {
    const comparison = compareHands(evaluations[i].hand, bestHand)
    if (comparison > 0) {
      bestHand = evaluations[i].hand
    }
  }

  const winners = evaluations
    .filter((e) => compareHands(e.hand, bestHand) === 0)
    .map((e) => e.index)

  return winners
}
