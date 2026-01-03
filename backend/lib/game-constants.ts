export const GAME_STATUS = {
  WAITING: 'waiting',
  ACTIVE: 'active',
  COMPLETED: 'completed',
} as const

export type GameStatus = (typeof GAME_STATUS)[keyof typeof GAME_STATUS]

export const ROUND = {
  PREFLOP: 'preflop',
  FLOP: 'flop',
  TURN: 'turn',
  RIVER: 'river',
  SHOWDOWN: 'showdown',
} as const

export type Round = (typeof ROUND)[keyof typeof ROUND]

export const PLAYER_STATUS = {
  ACTIVE: 'active',
  FOLDED: 'folded',
  ALL_IN: 'all_in',
  OUT: 'out',
} as const

export type PlayerStatus = (typeof PLAYER_STATUS)[keyof typeof PLAYER_STATUS]

export const ACTION_TYPE = {
  FOLD: 'fold',
  CHECK: 'check',
  CALL: 'call',
  BET: 'bet',
  RAISE: 'raise',
  ALL_IN: 'all_in',
} as const

export type ActionType = (typeof ACTION_TYPE)[keyof typeof ACTION_TYPE]
