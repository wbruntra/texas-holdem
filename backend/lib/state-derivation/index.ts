/**
 * Re-export shared state derivation for backward compatibility
 * Also provides backend-specific convenience functions that need database access
 */
import type { GameState, GameConfig, PlayerConfig } from '@holdem/shared'
export {
  deriveGameState,
  deriveFromSnapshot,
  applyEvent,
  calculateIsGameOver,
  createInitialState,
  type GameConfig,
  type PlayerConfig,
} from '@holdem/shared'

import { deriveGameState } from '@holdem/shared'

/**
 * Convenience function to fetch events and derive state for a game
 * This requires database access so it remains in the backend
 */
export async function deriveGameStateForGame(gameId: number): Promise<GameState> {
  const { getGameMetadata } = await import('@/services/game-service')
  const { getEvents } = await import('@/services/event-store')

  const metadata = await getGameMetadata(gameId)
  if (!metadata) throw new Error(`Game ${gameId} not found`)

  const events = await getEvents(gameId)

  const gameConfig: GameConfig = {
    smallBlind: metadata.smallBlind,
    bigBlind: metadata.bigBlind,
    startingChips: metadata.startingChips,
  }

  const players: PlayerConfig[] = []

  return deriveGameState(gameConfig, players, events)
}
