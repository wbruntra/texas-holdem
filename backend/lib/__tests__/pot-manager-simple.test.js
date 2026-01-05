const { describe, it, expect } = require('bun:test')
const { calculatePots, distributePots, awardPots, getTotalPot } = require('../pot-manager')
const { PLAYER_STATUS } = require('../game-constants')

function createTestPlayer(position, chips, totalBet, status = PLAYER_STATUS.ACTIVE) {
  return {
    position,
    chips,
    totalBet,
    holeCards: [],
    status,
  }
}

describe('calculatePots', () => {
  it('should handle simple pot with equal bets', () => {
    const players = [
      createTestPlayer(0, 900, 100),
      createTestPlayer(1, 900, 100),
      createTestPlayer(2, 900, 100),
    ]

    const pots = calculatePots(players)

    expect(pots).toHaveLength(1)
    expect(pots[0].amount).toBe(300)
    expect(pots[0].eligiblePlayers).toEqual([0, 1, 2])
  })
})

describe('distributePots with mock evaluator', () => {
  it('should determine winner using mock evaluation', () => {
    // Create a mock evaluator that returns different hand strengths
    const mockEvaluateHand = (holeCards, communityCards = []) => {
      // Simple mock: use first hole card to determine hand strength
      if (holeCards[0] === 'winner') {
        return {
          rank: 8, // Four of a kind
          rankName: 'Four of a Kind',
          value: 100,
          cards: [],
        }
      }
      return {
        rank: 2, // Pair
        rankName: 'Pair',
        value: 20,
        cards: [],
      }
    }

    const players = [createTestPlayer(0, 1000, 0), createTestPlayer(1, 1000, 0)]
    // Use special markers to determine who wins
    players[0].holeCards = ['winner', 'mock']
    players[1].holeCards = ['loser', 'mock']

    const pots = [{ amount: 200, eligiblePlayers: [0, 1] }]

    const result = distributePots(pots, players, [], mockEvaluateHand)

    expect(result).toHaveLength(1)
    expect(result[0].winners).toEqual([0]) // Player 0 wins with higher rank
    expect(result[0].winAmount).toBe(200)
    expect(result[0].winningRankName).toBe('Four of a Kind')
  })

  it('should handle tie with mock evaluator', () => {
    const mockEvaluateHand = (holeCards, communityCards = []) => {
      // Return same hand strength for both players (tie)
      return {
        rank: 3, // Two pair
        rankName: 'Two Pair',
        value: 50,
        cards: [],
      }
    }

    const players = [createTestPlayer(0, 1000, 0), createTestPlayer(1, 1000, 0)]
    players[0].holeCards = ['tie1', 'mock']
    players[1].holeCards = ['tie2', 'mock']

    const pots = [
      { amount: 201, eligiblePlayers: [0, 1] }, // Odd amount to test remainder
    ]

    const result = distributePots(pots, players, [], mockEvaluateHand)

    expect(result).toHaveLength(1)
    expect(result[0].winners).toEqual([0, 1]) // Both tie
    expect(result[0].winAmount).toBe(100) // 201 / 2 = 100 with remainder going to first
    expect(result[0].winningRankName).toBe('Two Pair')
  })
})

describe('awardPots', () => {
  it('should award pot to single winner', () => {
    const players = [
      createTestPlayer(0, 1000, 0),
      createTestPlayer(1, 1000, 0),
      createTestPlayer(2, 1000, 0),
    ]

    const pots = [{ amount: 300, eligiblePlayers: [0, 1, 2], winners: [1] }]

    const result = awardPots(pots, players)

    expect(result[0].chips).toBe(1000)
    expect(result[1].chips).toBe(1300) // 1000 + 300
    expect(result[2].chips).toBe(1000)
  })
})

describe('getTotalPot', () => {
  it('should sum all pot amounts', () => {
    const pots = [
      { amount: 100, eligiblePlayers: [0, 1] },
      { amount: 50, eligiblePlayers: [1, 2] },
      { amount: 25, eligiblePlayers: [0] },
    ]

    expect(getTotalPot(pots)).toBe(175)
  })
})
