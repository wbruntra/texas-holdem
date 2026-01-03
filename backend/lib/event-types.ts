export const EVENT_TYPE = {
  GAME_CREATED: 'game:created',
  GAME_STARTED: 'game:started',
  GAME_RESET: 'game:reset',
  GAME_COMPLETED: 'game:completed',

  PLAYER_JOINED: 'player:joined',
  PLAYER_LEFT: 'player:left',
  PLAYER_AUTHENTICATED: 'player:authenticated',
  PLAYER_REJOINED: 'player:rejoined',

  HAND_STARTED: 'hand:started',
  HAND_COMPLETED: 'hand:completed',

  ROUND_STARTED: 'round:started',
  ROUND_COMPLETED: 'round:completed',

  ACTION_CHECK: 'action:check',
  ACTION_BET: 'action:bet',
  ACTION_CALL: 'action:call',
  ACTION_RAISE: 'action:raise',
  ACTION_FOLD: 'action:fold',
  ACTION_ALL_IN: 'action:all_in',

  BLINDS_POSTED: 'state:blinds_posted',
  CARDS_DEALT: 'state:cards_dealt',
  COMMUNITY_CARDS_REVEALED: 'state:community_cards_revealed',
  SHOWDOWN: 'state:showdown',
  POTS_DISTRIBUTED: 'state:pots_distributed',
  CARDS_SHOWN: 'state:cards_shown',

  STATE_ADVANCED: 'admin:state_advanced',
  CARD_REVEALED: 'admin:card_revealed',
} as const

export type EventType = (typeof EVENT_TYPE)[keyof typeof EVENT_TYPE]
