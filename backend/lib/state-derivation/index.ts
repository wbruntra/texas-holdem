import type { GameState } from '@holdem/shared'
import type { GameEvent } from '@/services/event-store'
import { EVENT_TYPES } from '@holdem/shared'
import { createInitialState, type GameConfig, type PlayerConfig } from './initial-state'
import * as handlers from './event-handlers'

export type { GameConfig, PlayerConfig }

export function deriveGameState(
  gameConfig: GameConfig,
  players: PlayerConfig[],
  events: GameEvent[],
): GameState {
  let state = createInitialState(gameConfig, players)

  for (const event of events) {
    state = applyEvent(state, event)
  }

  return state
}

export function deriveFromSnapshot(
  snapshot: GameState,
  lastSequence: number,
  newEvents: GameEvent[],
): GameState {
  let state = snapshot

  // Filter out events already covered by snapshot (though caller should probably handle this)
  const eventsToApply = newEvents.filter((e) => e.sequenceNumber > lastSequence)

  for (const event of eventsToApply) {
    state = applyEvent(state, event)
  }

  return state
}

function applyEvent(state: GameState, event: GameEvent): GameState {
  switch (event.eventType) {
    case EVENT_TYPES.PLAYER_JOINED:
      return handlers.handlePlayerJoined(state, event)

    case EVENT_TYPES.HAND_START:
      return handlers.handleHandStart(state, event)

    case EVENT_TYPES.POST_BLIND:
      return handlers.handlePostBlind(state, event)

    case EVENT_TYPES.CHECK:
      return handlers.handleCheck(state, event)

    case EVENT_TYPES.BET:
      return handlers.handleBet(state, event)

    case EVENT_TYPES.CALL:
      return handlers.handleCall(state, event)

    case EVENT_TYPES.RAISE:
      return handlers.handleRaise(state, event)

    case EVENT_TYPES.FOLD:
      return handlers.handleFold(state, event)

    case EVENT_TYPES.ALL_IN:
      return handlers.handleAllIn(state, event)

    case EVENT_TYPES.DEAL_COMMUNITY:
      return handlers.handleDealCommunity(state, event)

    case EVENT_TYPES.SHOWDOWN:
      return handlers.handleShowdown(state, event)

    case EVENT_TYPES.AWARD_POT:
      return handlers.handleAwardPot(state, event)

    case EVENT_TYPES.HAND_COMPLETE:
      return handlers.handleHandComplete(state, event)

    case EVENT_TYPES.REVEAL_CARDS:
      return handlers.handleRevealCards(state, event)

    case EVENT_TYPES.ADVANCE_ROUND:
      return handlers.handleAdvanceRound(state, event)

    // Ignored events (don't affect state or handled elsewhere)
    case EVENT_TYPES.GAME_CREATED:
      return state

    default:
      console.warn(`[StateDerivation] Unhandled event type: ${event.eventType}`)
      return state
  }
}

// Convenience function to fetch events and derive state for a game
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

  // Note: Players are logically re-added via PLAYER_JOINED events
  // But initial state needs at least empty list
  const players: PlayerConfig[] = []

  return deriveGameState(gameConfig, players, events)
}
