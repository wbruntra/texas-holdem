import { describe, it, expect } from 'vitest'
import { calculateTotalPot, calculatePotsTotal, getDisplayPot } from '../potUtils'

describe('potUtils', () => {
  describe('calculateTotalPot', () => {
    it('returns 0 for empty player array', () => {
      expect(calculateTotalPot([])).toBe(0)
    })

    it('sums totalBet from all players', () => {
      const players = [
        { totalBet: 100, currentBet: 50 },
        { totalBet: 200, currentBet: 0 },
        { totalBet: 50, currentBet: 25 },
      ]
      expect(calculateTotalPot(players)).toBe(350)
    })

    it('handles players with totalBet of 0', () => {
      const players = [
        { totalBet: 0, currentBet: 0 },
        { totalBet: 100, currentBet: 50 },
      ]
      expect(calculateTotalPot(players)).toBe(100)
    })

    it('handles undefined totalBet', () => {
      const players = [{ currentBet: 50 }, { totalBet: 100, currentBet: 0 }]
      expect(calculateTotalPot(players)).toBe(100)
    })
  })

  describe('calculatePotsTotal', () => {
    it('returns 0 for empty pots array', () => {
      expect(calculatePotsTotal([])).toBe(0)
    })

    it('returns 0 for undefined pots', () => {
      expect(calculatePotsTotal(undefined)).toBe(0)
    })

    it('sums amounts from all pots', () => {
      const pots = [
        { amount: 100, eligiblePlayers: [0, 1], winners: null },
        { amount: 50, eligiblePlayers: [1, 2], winners: null },
        { amount: 25, eligiblePlayers: [0, 1, 2], winners: null },
      ]
      expect(calculatePotsTotal(pots)).toBe(175)
    })

    it('handles single pot', () => {
      const pots = [{ amount: 200, eligiblePlayers: [0, 1, 2], winners: null }]
      expect(calculatePotsTotal(pots)).toBe(200)
    })
  })

  describe('getDisplayPot', () => {
    it('returns calculated pots total when pots array provided', () => {
      const players = [{ totalBet: 100, currentBet: 50 }]
      const pots = [{ amount: 200, eligiblePlayers: [0], winners: null }]
      expect(getDisplayPot(players, pots)).toBe(200)
    })

    it('returns calculated total from players when no pots provided', () => {
      const players = [
        { totalBet: 100, currentBet: 50 },
        { totalBet: 200, currentBet: 0 },
      ]
      expect(getDisplayPot(players, undefined)).toBe(300)
    })

    it('returns 0 when both players and pots are empty', () => {
      expect(getDisplayPot([], undefined)).toBe(0)
    })

    it('prefers pots over player bets when both provided', () => {
      const players = [{ totalBet: 500, currentBet: 100 }]
      const pots = [{ amount: 200, eligiblePlayers: [0], winners: null }]
      expect(getDisplayPot(players, pots)).toBe(200)
    })
  })
})
