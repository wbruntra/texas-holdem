const { describe, it, expect } = require('bun:test')
const { determineWinnersFromMockHands } = require('../poker-engine')

describe('determineWinnersFromMockHands', () => {
  it('should determine single winner correctly', () => {
    const hands = [
      { position: 0, rank: 8, tieBreaker: 14 }, // Four of a kind
      { position: 1, rank: 3, tieBreaker: 12 }, // Two pair
      { position: 2, rank: 2, tieBreaker: 13 }, // Pair
    ]

    const winners = determineWinnersFromMockHands(hands)

    expect(winners).toEqual([0])
  })

  it('should handle tie correctly', () => {
    const hands = [
      { position: 0, rank: 8, tieBreaker: 14 }, // Four of a kind, Aces
      { position: 1, rank: 8, tieBreaker: 13 }, // Four of a kind, Kings
      { position: 2, rank: 3, tieBreaker: 12 }, // Two pair
    ]

    const winners = determineWinnersFromMockHands(hands)

    expect(winners).toEqual([0])
  })

  it('should handle exact tie (same rank and tie-breaker)', () => {
    const hands = [
      { position: 0, rank: 2, tieBreaker: 14 }, // Pair of Aces
      { position: 1, rank: 2, tieBreaker: 14 }, // Pair of Aces
      { position: 2, rank: 1, tieBreaker: 13 }, // High card
    ]

    const winners = determineWinnersFromMockHands(hands)

    expect(winners).toEqual([0, 1])
  })

  it('should return empty for no hands', () => {
    const hands = []

    const winners = determineWinnersFromMockHands(hands)

    expect(winners).toEqual([])
  })

  it('should handle multiple winners with three-way tie', () => {
    const hands = [
      { position: 0, rank: 1, tieBreaker: 14 }, // High card Ace
      { position: 1, rank: 1, tieBreaker: 14 }, // High card Ace
      { position: 2, rank: 1, tieBreaker: 14 }, // High card Ace
    ]

    const winners = determineWinnersFromMockHands(hands)

    expect(winners).toEqual([0, 1, 2])
  })
})
