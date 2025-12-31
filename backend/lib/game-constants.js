/**
 * Game Constants - Shared constants used across game modules
 */

const GAME_STATUS = {
  WAITING: 'waiting',
  ACTIVE: 'active',
  COMPLETED: 'completed',
};

const ROUND = {
  PREFLOP: 'preflop',
  FLOP: 'flop',
  TURN: 'turn',
  RIVER: 'river',
  SHOWDOWN: 'showdown',
};

const PLAYER_STATUS = {
  ACTIVE: 'active',
  FOLDED: 'folded',
  ALL_IN: 'all_in',
  OUT: 'out',
};

const ACTION_TYPE = {
  FOLD: 'fold',
  CHECK: 'check',
  CALL: 'call',
  BET: 'bet',
  RAISE: 'raise',
  ALL_IN: 'all_in',
};

module.exports = {
  GAME_STATUS,
  ROUND,
  PLAYER_STATUS,
  ACTION_TYPE,
};
