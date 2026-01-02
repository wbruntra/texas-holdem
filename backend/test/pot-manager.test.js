const { calculatePots, distributePots, awardPots, getTotalPot } = require('../lib/pot-manager')
const { PLAYER_STATUS } = require('../lib/game-state-machine')
const { HAND_RANKINGS } = require('../lib/poker-engine')

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

  describe('Showdown scenario: 3 players with side pots and folded player', () => {
    it('should correctly calculate pots and award to correct winners', () => {
      /**
       * Scenario:
       * - Player 0: Starts with 100 chips, all-in pre-flop
       * - Player 1: Starts with 300 chips
       * - Player 2: Starts with 300 chips
       *
       * Pre-flop action:
       * 1. Everyone bets 100
       * 2. Player 0 is now all-in (no chips left)
       * 3. Player 1 and Player 2 still have chips remaining
       *
       * Post-flop action:
       * 4. Player 1 bets 50 (total contribution: 150)
       * 5. Player 2 raises to 100 (50 + 50 more) (total contribution: 150)
       * 6. Player 1 folds (final totalBet: 150)
       * 7. Showdown: Player 0 vs Player 2
       *
       * Expected pots:
       * - Main pot: 100 * 2 (all active players) + 150 (folded player 1) = 350
       * - Side pot: 50 * 1 (only player 2 contributed beyond player 0's all-in) = 50
       * Total in pots: 400
       *
       * Eligibility:
       * - Main pot: Players 0 and 2 (folded player 1 contributed but cannot win)
       * - Side pot: Only Player 2 (player 0 is all-in at 100)
       * Winners: Player 0 gets main pot (350), Player 2 gets side pot (50)
       */

      // Set up the game state after all betting is complete
      const players = [
        {
          position: 0,
          chips: 0, // Will be updated with pot winnings
          totalBet: 100,
          status: PLAYER_STATUS.ALL_IN,
          holeCards: ['As', 'Ah'], // Pair of Aces
        },
        {
          position: 1,
          chips: 150, // 300 - 150 bet
          totalBet: 150,
          status: PLAYER_STATUS.FOLDED, // Folded after betting 150
          holeCards: ['Kd', 'Qd'], // Has cards but folded
        },
        {
          position: 2,
          chips: 150, // 300 - 150 bet
          totalBet: 150,
          status: PLAYER_STATUS.ACTIVE, // Still in hand
          holeCards: ['Ks', 'Kh'], // Pair of Kings
        },
      ]

      // Step 1: Calculate pots
      const pots = calculatePots(players)

      // Verify pot structure
      expect(pots).toHaveLength(2)

      // Main pot: 100 from each player (0, 1, 2) = 100 * 3 = 300
      // Player 0 can only win up to 300 (their all-in amount matched by all players)
      expect(pots[0].amount).toBe(300)
      expect(pots[0].eligiblePlayers).toEqual([0, 2]) // Only active/all-in players, not folded
      expect(pots[0].winners).toBeNull() // Not yet distributed

      // Side pot: Remaining from players 1 and 2 (150-100 each) = 50 * 2 = 100
      expect(pots[1].amount).toBe(100)
      expect(pots[1].eligiblePlayers).toEqual([2]) // Only player 2 (player 1 folded)
      expect(pots[1].winners).toBeNull() // Not yet distributed

      // Verify total pot amount
      // Total bets: 100 + 150 + 150 = 400
      expect(getTotalPot(pots)).toBe(400)

      // Step 2: Distribute pots based on hand evaluation
      const communityCards = ['Ac', '2c', '3c', '4h', '5h']

      // Use a simple evaluation that respects hand rankings
      const evaluateTestHand = (holeCards, communityCards) => {
        // This is a simplified evaluation for testing
        // Player 0 has a pair of Aces
        // Player 2 has a pair of Kings (at best, since community has 2, 3, 4, 5)
        // Player 0's pair of Aces beats Player 2's pair of Kings
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

        // Check for pair in hole cards
        const card1Rank = holeCards[0][0]
        const card2Rank = holeCards[1][0]

        if (card1Rank === card2Rank) {
          // Pocket pair
          const pairValue = cardValues[card1Rank] * 100000
          return {
            rank: HAND_RANKINGS.PAIR,
            rankName: `Pair of ${card1Rank}s`,
            value: pairValue,
            description: `Pair of ${card1Rank}s`,
          }
        }

        // High card fallback
        const highValue = Math.max(cardValues[card1Rank], cardValues[card2Rank])
        const value = highValue * 100000
        return {
          rank: HAND_RANKINGS.HIGH_CARD,
          rankName: 'High Card',
          value,
          description: `High card ${card1Rank}${card2Rank}`,
        }
      }

      const distributedPots = distributePots(pots, players, communityCards, evaluateTestHand)

      // Main pot should go to player 0 (has Pair of Aces)
      expect(distributedPots[0].winners).toEqual([0])
      expect(distributedPots[0].winAmount).toBe(300)
      expect(distributedPots[0].winningRankName).toBe('Pair of As')

      // Side pot should go to player 2 (only eligible player)
      expect(distributedPots[1].winners).toEqual([2])
      expect(distributedPots[1].winAmount).toBe(100)
      expect(distributedPots[1].winningRankName).toBe('Pair of Ks')

      // Step 3: Award pots to players
      const finalPlayers = awardPots(distributedPots, players)

      // Player 0 should win main pot
      expect(finalPlayers[0].chips).toBe(300) // 0 + 300
      // Player 1 should still have 150 (their remaining chips, they forfeited their bets)
      expect(finalPlayers[1].chips).toBe(150)
      // Player 2 should win side pot and have remaining chips
      expect(finalPlayers[2].chips).toBe(250) // 150 + 100

      // Total chips should equal starting total: 100 + 300 + 300 = 700
      const totalChips = finalPlayers.reduce((sum, p) => sum + p.chips, 0)
      expect(totalChips).toBe(700)
    })

    it('should handle scenario where side pot winner differs from main pot winner', () => {
      /**
       * Alternative scenario where a folded player with lower bet wins against higher better
       * (if they hadn't folded)
       *
       * - Player 0: All-in for 100
       * - Player 1: Bets 200 and folds
       * - Player 2: Calls 200
       *
       * Main pot: 100 * 3 = 300 (all eligible)
       * Side pot: (200-100) * 2 = 200 (only players 1 and 2)
       * Player 1 folded but contributed, so ineligible for both pots
       * Main pot goes to better of players 0 and 2
       * Side pot goes to player 2 (only eligible)
       */
      const players = [
        {
          position: 0,
          chips: 0,
          totalBet: 100,
          status: PLAYER_STATUS.ALL_IN,
          holeCards: ['As', 'Ks'], // Strong hand
        },
        {
          position: 1,
          chips: 100, // 300 - 200 bet
          totalBet: 200,
          status: PLAYER_STATUS.FOLDED, // Folded
          holeCards: ['9h', '8h'], // Weak hand (but doesn't matter, folded)
        },
        {
          position: 2,
          chips: 100, // 300 - 200 bet
          totalBet: 200,
          status: PLAYER_STATUS.ACTIVE,
          holeCards: ['Qh', 'Jh'], // Medium hand
        },
      ]

      const pots = calculatePots(players)

      // Main pot: 100 from each player (0, 1, 2) = 100 * 3 = 300
      expect(pots[0].amount).toBe(300)
      expect(pots[0].eligiblePlayers).toEqual([0, 2]) // Not player 1 (folded)

      // Side pot: Remaining from players 1 and 2 (200-100 each) = 100 * 2 = 200
      expect(pots[1].amount).toBe(200)
      expect(pots[1].eligiblePlayers).toEqual([2]) // Only player 2

      expect(getTotalPot(pots)).toBe(500) // Total bets: 100 + 200 + 200

      // With the hands given (A-K vs Q-J), player 0 wins both pots
      const communityCards = ['2d', '3d', '4d', '5d', '6d']

      const evaluateTestHand = (holeCards) => {
        const cardValues = { A: 14, K: 13, Q: 12, J: 11, 9: 9, 8: 8, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 }
        const card1Value = cardValues[holeCards[0][0]]
        const card2Value = cardValues[holeCards[1][0]]
        const total = card1Value + card2Value
        return {
          rank: 1,
          rankName: 'High Card',
          value: total * 100000,
          description: `${holeCards[0][0]} ${holeCards[1][0]}`,
        }
      }

      const distributedPots = distributePots(pots, players, communityCards, evaluateTestHand)

      // Main pot should go to player 0 (A-K = 27 vs Q-J = 23)
      expect(distributedPots[0].winners).toEqual([0])
      // Side pot should go to player 2 (only eligible player for this pot)
      expect(distributedPots[1].winners).toEqual([2])

      const finalPlayers = awardPots(distributedPots, players)
      expect(finalPlayers[0].chips).toBe(300) // 0 + 300 from main pot
      expect(finalPlayers[1].chips).toBe(100) // unchanged
      expect(finalPlayers[2].chips).toBe(300) // 100 + 200 from side pot
    })
  })
})
