/**
 * Game Event Types
 *
 * These are the immutable events that get recorded in the event store.
 * Only successfully executed actions become events.
 */
export const EVENT_TYPES = {
  // Game lifecycle
  GAME_CREATED: 'GAME_CREATED',
  PLAYER_JOINED: 'PLAYER_JOINED',

  // Hand lifecycle
  HAND_START: 'HAND_START', // Includes full deck, implicitly deals to all eligible players
  POST_BLIND: 'POST_BLIND', // Small blind or big blind posting

  // Player betting actions
  CHECK: 'CHECK',
  BET: 'BET',
  CALL: 'CALL',
  RAISE: 'RAISE',
  FOLD: 'FOLD',
  ALL_IN: 'ALL_IN', // Convenience type for bet/raise/call with insufficient chips

  // Player display actions
  REVEAL_CARDS: 'REVEAL_CARDS', // Player chooses to show cards (e.g., after winning by fold)

  // Round progression
  DEAL_COMMUNITY: 'DEAL_COMMUNITY', // Deals flop/turn/river (automatic after betting complete)
  ADVANCE_ROUND: 'ADVANCE_ROUND', // Manual advance when all-in situation (no betting possible)

  // Showdown
  SHOWDOWN: 'SHOWDOWN',
  AWARD_POT: 'AWARD_POT',
  HAND_COMPLETE: 'HAND_COMPLETE',
} as const

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES]

/**
 * Player Action Types
 *
 * These are the actions a player can attempt. The backend validates
 * whether the action is legal before recording it as an event.
 */
export const PLAYER_ACTIONS = {
  // Betting actions (during player's turn)
  CHECK: 'check',
  BET: 'bet',
  CALL: 'call',
  RAISE: 'raise',
  FOLD: 'fold',
  ALL_IN: 'all_in',

  // Non-turn actions
  REVEAL_CARDS: 'reveal_cards', // Show cards after winning
  ADVANCE_ROUND: 'advance_round', // Manual advance in all-in situation
  START_NEXT_HAND: 'start_next_hand',
} as const

export type PlayerAction = (typeof PLAYER_ACTIONS)[keyof typeof PLAYER_ACTIONS]

/**
 * Round types for DEAL_COMMUNITY events
 */
export const COMMUNITY_ROUNDS = {
  FLOP: 'flop', // 3 cards
  TURN: 'turn', // 1 card
  RIVER: 'river', // 1 card
} as const

export type CommunityRound = (typeof COMMUNITY_ROUNDS)[keyof typeof COMMUNITY_ROUNDS]
