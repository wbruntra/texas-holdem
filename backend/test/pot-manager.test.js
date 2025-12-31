const { calculatePots, distributePots, awardPots, getTotalPot } = require('../lib/pot-manager')
const { PLAYER_STATUS } = require('../lib/game-state-machine')

describe('Pot Manager', () => {
  describe('calculatePots', () => {
    it('should create single pot when all players bet same amount', () => {
      const players = [
        { totalBet: 100, status: PLAYER_STATUS.ACTIVE },
        { totalBet: 100, status: PLAYER_STATUS.ACTIVE },
        { totalBet: 100, status: PLAYER_STATUS.ACTIVE },
      ]

      const pots = calculatePots(players)

      expect(pots).toHaveLength(1)
      expect(pots[0].amount).toBe(300)
      expect(pots[0].eligiblePlayers).toEqual([0, 1, 2])
    })

    it('should create main pot and side pot with one all-in', () => {
      const players = [
        { totalBet: 100, status: PLAYER_STATUS.ACTIVE },
        { totalBet: 50, status: PLAYER_STATUS.ALL_IN }, // all-in for less
        { totalBet: 100, status: PLAYER_STATUS.ACTIVE },
      ]

      const pots = calculatePots(players)

      expect(pots).toHaveLength(2)
      // Main pot: 50 from each player
      expect(pots[0].amount).toBe(150)
      expect(pots[0].eligiblePlayers).toEqual([0, 1, 2])
      // Side pot: 50 from players 0 and 2
      expect(pots[1].amount).toBe(100)
      expect(pots[1].eligiblePlayers).toEqual([0, 2])
    })

    it('should create multiple side pots with multiple all-ins', () => {
      const players = [
        { totalBet: 100, status: PLAYER_STATUS.ACTIVE },
        { totalBet: 30, status: PLAYER_STATUS.ALL_IN },
        { totalBet: 150, status: PLAYER_STATUS.ACTIVE },
        { totalBet: 50, status: PLAYER_STATUS.ALL_IN },
      ]

      const pots = calculatePots(players)

      expect(pots).toHaveLength(4)
      // Main pot: 30 * 4 = 120
      expect(pots[0].amount).toBe(120)
      expect(pots[0].eligiblePlayers).toEqual([0, 1, 2, 3])
      // Side pot 1: (50-30) * 3 = 60
      expect(pots[1].amount).toBe(60)
      expect(pots[1].eligiblePlayers).toEqual([0, 2, 3])
      // Side pot 2: (100-50) * 2 = 100
      expect(pots[2].amount).toBe(100)
      expect(pots[2].eligiblePlayers).toEqual([0, 2])
      // Side pot 3: (150-100) * 1 = 50
      expect(pots[3].amount).toBe(50)
      expect(pots[3].eligiblePlayers).toEqual([2])
    })

    it('should add folded player contributions to main pot', () => {
      const players = [
        { totalBet: 100, status: PLAYER_STATUS.ACTIVE },
        { totalBet: 50, status: PLAYER_STATUS.FOLDED },
        { totalBet: 100, status: PLAYER_STATUS.ACTIVE },
      ]

      const pots = calculatePots(players)

      expect(pots).toHaveLength(1)
      // 100 + 100 from active + 50 from folded
      expect(pots[0].amount).toBe(250)
      expect(pots[0].eligiblePlayers).toEqual([0, 2]) // folded player not eligible
    })

    it('should handle player with zero contribution', () => {
      const players = [
        { totalBet: 100, status: PLAYER_STATUS.ACTIVE },
        { totalBet: 0, status: PLAYER_STATUS.FOLDED },
        { totalBet: 100, status: PLAYER_STATUS.ACTIVE },
      ]

      const pots = calculatePots(players)

      expect(pots).toHaveLength(1)
      expect(pots[0].amount).toBe(200)
      expect(pots[0].eligiblePlayers).toEqual([0, 2])
    })

    it('should handle complex scenario with folded and all-in players', () => {
      const players = [
        { totalBet: 100, status: PLAYER_STATUS.ACTIVE },
        { totalBet: 20, status: PLAYER_STATUS.FOLDED },
        { totalBet: 50, status: PLAYER_STATUS.ALL_IN },
        { totalBet: 30, status: PLAYER_STATUS.FOLDED },
        { totalBet: 100, status: PLAYER_STATUS.ACTIVE },
      ]

      const pots = calculatePots(players)

      expect(pots).toHaveLength(2)
      // Main pot: 50*3 (active+all-in) + 50 (folded contributions)
      expect(pots[0].amount).toBe(200)
      expect(pots[0].eligiblePlayers).toEqual([0, 2, 4])
      // Side pot: (100-50)*2
      expect(pots[1].amount).toBe(100)
      expect(pots[1].eligiblePlayers).toEqual([0, 4])
    })
  })

  describe('distributePots', () => {
    const mockEvaluateHand = (cards) => {
      // Mock hand evaluation - return rank and value based on first card
      const cardValues = {
        A: 14,
        K: 13,
        Q: 12,
        J: 11,
        T: 10,
        9: 9,
        8: 8,
        7: 7,
        6: 6,
        5: 5,
        4: 4,
        3: 3,
        2: 2,
      }
      const firstCard = cards[0]
      const cardValue = cardValues[firstCard[0]] || 10
      // Use a simple value system where higher card = higher value
      const value = cardValue * 100000 // Simple scoring
      return { rank: 1, value, description: `High card ${firstCard}` }
    }

    it('should award pot to player with best hand', () => {
      const pots = [{ amount: 300, eligiblePlayers: [0, 1, 2], winners: null }]

      const players = [
        { holeCards: ['Ah', 'Kh'] },
        { holeCards: ['Qd', 'Jd'] },
        { holeCards: ['9c', '8c'] },
      ]

      const communityCards = ['Ts', '7s', '6s', '5h', '4h']

      const result = distributePots(pots, players, communityCards, mockEvaluateHand)

      expect(result[0].winners).toEqual([0]) // Player 0 has Ace (highest)
      expect(result[0].winAmount).toBe(300)
    })

    it('should split pot on tie', () => {
      const pots = [{ amount: 300, eligiblePlayers: [0, 1, 2], winners: null }]

      const players = [
        { holeCards: ['Ah', 'Kh'] },
        { holeCards: ['Ad', 'Qd'] }, // Also has Ace
        { holeCards: ['9c', '8c'] },
      ]

      const communityCards = ['Ts', '7s', '6s', '5h', '4h']

      const result = distributePots(pots, players, communityCards, mockEvaluateHand)

      expect(result[0].winners).toEqual([0, 1]) // Both have Ace
      expect(result[0].winAmount).toBe(150) // Split pot
    })

    it('should award each pot independently', () => {
      const pots = [
        { amount: 150, eligiblePlayers: [0, 1, 2], winners: null },
        { amount: 100, eligiblePlayers: [0, 2], winners: null },
      ]

      const players = [
        { holeCards: ['9h', '8h'] },
        { holeCards: ['Kd', 'Qd'] }, // Only eligible for main pot
        { holeCards: ['Ac', 'Jc'] }, // Best hand overall
      ]

      const communityCards = ['Ts', '7s', '6s', '5h', '4h']

      const result = distributePots(pots, players, communityCards, mockEvaluateHand)

      expect(result[0].winners).toEqual([2]) // Player 2 wins main pot (A high)
      expect(result[1].winners).toEqual([2]) // Player 2 wins side pot (A high)
    })
  })

  describe('awardPots', () => {
    it('should add winnings to player chips', () => {
      const pots = [{ amount: 300, winners: [1], winAmount: 300 }]

      const players = [{ chips: 500 }, { chips: 200 }, { chips: 300 }]

      const result = awardPots(pots, players)

      expect(result[0].chips).toBe(500) // unchanged
      expect(result[1].chips).toBe(500) // 200 + 300
      expect(result[2].chips).toBe(300) // unchanged
    })

    it('should split pot evenly and give remainder to first winner', () => {
      const pots = [{ amount: 301, winners: [0, 2], winAmount: 150 }]

      const players = [{ chips: 100 }, { chips: 200 }, { chips: 100 }]

      const result = awardPots(pots, players)

      expect(result[0].chips).toBe(251) // 100 + 150 + 1 remainder
      expect(result[1].chips).toBe(200) // unchanged
      expect(result[2].chips).toBe(250) // 100 + 150
    })

    it('should award multiple pots', () => {
      const pots = [
        { amount: 150, winners: [1], winAmount: 150 },
        { amount: 100, winners: [2], winAmount: 100 },
      ]

      const players = [{ chips: 0 }, { chips: 0 }, { chips: 0 }]

      const result = awardPots(pots, players)

      expect(result[0].chips).toBe(0)
      expect(result[1].chips).toBe(150)
      expect(result[2].chips).toBe(100)
    })
  })

  describe('getTotalPot', () => {
    it('should sum all pot amounts', () => {
      const pots = [{ amount: 150 }, { amount: 100 }, { amount: 50 }]

      expect(getTotalPot(pots)).toBe(300)
    })

    it('should return 0 for empty pots', () => {
      expect(getTotalPot([])).toBe(0)
    })
  })
})
