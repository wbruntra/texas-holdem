import { PLAYER_STATUS, type PlayerStatus } from './game-constants'
import type { Card, HandEvaluation } from './poker-engine'
import { compareHands } from './poker-engine'

export interface Player {
  id: string | number
  name: string
  position: number
  chips: number
  currentBet: number
  totalBet?: number
  holeCards: Card[]
  status: PlayerStatus
  isDealer: boolean
  isSmallBlind: boolean
  isBigBlind: boolean
  lastAction: string | null
  showCards: boolean
}

export interface Pot {
  amount: number
  eligiblePlayers: number[]
  winners: number[] | null
  winAmount?: number
  winningRankName?: string
}

interface ContributionPlayer {
  position: number
  remaining: number
  isEligible: boolean
}

export function calculatePots(players: Player[]): Pot[] {
  const remainingContributions: ContributionPlayer[] = players.map((p, idx) => ({
    position: idx,
    remaining: p.totalBet || 0,
    isEligible: p.status === PLAYER_STATUS.ACTIVE || p.status === PLAYER_STATUS.ALL_IN,
  }))

  const eligiblePlayers = remainingContributions.filter((c) => c.isEligible)

  if (eligiblePlayers.length === 0) {
    const totalAmount = remainingContributions.reduce((sum, c) => sum + c.remaining, 0)
    return [
      {
        amount: totalAmount,
        eligiblePlayers: [],
        winners: null,
      },
    ]
  }

  const pots: Pot[] = []

  while (eligiblePlayers.some((p) => p.remaining > 0)) {
    const eligibleWithMoney = eligiblePlayers.filter((p) => p.remaining > 0)

    if (eligibleWithMoney.length === 0) break

    const lowestBet = Math.min(...eligibleWithMoney.map((p) => p.remaining))

    let potAmount = 0
    const contributingPlayers: number[] = []

    remainingContributions.forEach((player) => {
      if (player.remaining > 0) {
        const contribution = Math.min(lowestBet, player.remaining)
        potAmount += contribution
        player.remaining -= contribution
        contributingPlayers.push(player.position)
      }
    })

    const eligibleWinners = eligibleWithMoney.map((p) => p.position).sort((a, b) => a - b)

    if (potAmount > 0) {
      pots.push({
        amount: potAmount,
        eligiblePlayers: eligibleWinners,
        winners: null,
      })
    }
  }

  return pots
}

export function distributePots(
  pots: Pot[],
  players: Player[],
  communityCards: Card[],
  evaluateHand: (holeCards: Card[], communityCards?: Card[]) => HandEvaluation,
): Pot[] {
  const results = pots.map((pot) => {
    const eligiblePlayers = pot.eligiblePlayers
      .map((pos) => ({ position: pos, player: players[pos] }))
      .filter(({ player }) => player && player.holeCards && player.holeCards.length === 2)

    if (eligiblePlayers.length === 0) {
      return { ...pot, winners: [] }
    }

    const evaluations = eligiblePlayers.map(({ position, player }) => {
      const hand = evaluateHand(player.holeCards, communityCards)
      return { position, hand }
    })

    let bestHand = evaluations[0].hand
    for (let i = 1; i < evaluations.length; i++) {
      const comp = compareHands(evaluations[i].hand, bestHand)
      if (comp > 0) {
        bestHand = evaluations[i].hand
      }
    }

    const winners = evaluations
      .filter((e) => compareHands(e.hand, bestHand) === 0)
      .map((e) => e.position)

    return {
      ...pot,
      winners,
      winAmount: Math.floor(pot.amount / winners.length),
      winningRankName: bestHand.rankName,
    }
  })

  return results
}

export function awardPots(pots: Pot[], players: Player[]): Player[] {
  const updatedPlayers = players.map((p) => ({ ...p }))

  pots.forEach((pot) => {
    if (pot.winners && pot.winners.length > 0) {
      const amountPerWinner = Math.floor(pot.amount / pot.winners.length)
      const remainder = pot.amount % pot.winners.length

      pot.winners.forEach((position, idx) => {
        const award = amountPerWinner + (idx === 0 ? remainder : 0)
        updatedPlayers[position].chips += award
      })
    }
  })

  return updatedPlayers
}

export function getTotalPot(pots: Pot[]): number {
  return pots.reduce((sum, pot) => sum + pot.amount, 0)
}
