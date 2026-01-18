import type { GameState } from '../game-types'
import type { GameEvent } from '../event-types'
import { EVENT_TYPES } from '../event-types'
import { createInitialState, type GameConfig, type PlayerConfig } from './initial-state'
import * as handlers from './event-handlers'

export type { GameConfig, PlayerConfig }
export { createInitialState }

/**
 * Calculate if the game is over (only 1 or 0 players have chips after a hand)
 */
export function calculateIsGameOver(state: GameState): boolean {
  const playersWithChips = state.players.filter((p) => p.chips > 0)
  const handIsComplete =
    state.currentRound === 'showdown' || state.status === 'completed' || state.status === 'waiting'

  return state.players.length >= 2 && playersWithChips.length <= 1 && handIsComplete
}

/**
 * Derive game state from a sequence of events
 */
export function deriveGameState(
  gameConfig: GameConfig,
  players: PlayerConfig[],
  events: GameEvent[],
): GameState {
  let state = createInitialState(gameConfig, players)

  for (const event of events) {
    state = applyEvent(state, event)
  }

  const isGameOver = calculateIsGameOver(state)

  return {
    ...state,
    isGameOver,
  }
}

/**
 * Derive state from a snapshot with new events
 */
export function deriveFromSnapshot(
  snapshot: GameState,
  lastSequence: number,
  newEvents: GameEvent[],
): GameState {
  let state = snapshot

  const eventsToApply = newEvents.filter((e) => e.sequenceNumber > lastSequence)

  for (const event of eventsToApply) {
    state = applyEvent(state, event)
  }

  return state
}

/**
 * Apply a single event to a game state
 */
export function applyEvent(state: GameState, event: GameEvent): GameState {
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

    case EVENT_TYPES.GAME_CREATED:
      return state

    default:
      console.warn(`[StateDerivation] Unhandled event type: ${event.eventType}`)
      return state
  }
}
