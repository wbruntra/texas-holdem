import type { Player, Pot } from '../components/table/types'

// Also support the table view types
type TablePlayer = {
  currentBet: number
  totalBet?: number
}

type AnyPlayer = Player | TablePlayer

/**
 * Calculate the total pot from player contributions
 * This is used during active rounds when pot is being built
 * Note: totalBet already includes currentBet (it's cumulative), so we only sum totalBet
 */
export function calculateTotalPot(players: AnyPlayer[]): number {
  return players.reduce((sum, player) => {
    const totalBet = 'totalBet' in player ? player.totalBet || 0 : 0
    return sum + totalBet
  }, 0)
}

/**
 * Calculate the total pot amount from pots array
 * This is used during showdown when pots have been distributed
 */
export function calculatePotsTotal(pots: Pot[] | undefined): number {
  if (!pots || pots.length === 0) return 0
  return pots.reduce((sum, pot) => sum + pot.amount, 0)
}

/**
 * Get the display pot - either from calculated player bets or from pots array
 */
export function getDisplayPot(players: AnyPlayer[], pots?: Pot[]): number {
  // If we have pots (typically during showdown), use that
  if (pots && pots.length > 0) {
    return calculatePotsTotal(pots)
  }
  // Otherwise calculate from player contributions
  return calculateTotalPot(players)
}
