/**
 * Action Service - Handles player actions (bet, raise, fold, etc.)
 */

const db = require('../../db')
const { validateAction, processAction, getValidActions } = require('../lib/betting-logic')
const { getGameById, saveGameState, advanceRoundIfReady } = require('./game-service')
const { getPlayerById } = require('./player-service')
const { ACTION_TYPE, PLAYER_STATUS } = require('../lib/game-constants')
const { getNextActingPosition } = require('../lib/game-state-machine')
const eventLogger = require('./event-logger')
const { EVENT_TYPE } = require('../lib/event-types')

async function normalizeTurnIfNeeded(gameId) {
  const game = await getGameById(gameId)
  if (!game || game.status !== 'active') return game

  if (game.currentPlayerPosition === null || game.currentPlayerPosition === undefined) {
    return game
  }

  const current = game.players[game.currentPlayerPosition]
  if (current && current.status === PLAYER_STATUS.ACTIVE) {
    return game
  }

  const next = getNextActingPosition(game.players, game.currentPlayerPosition)
  const patched = { ...game, currentPlayerPosition: next }
  await saveGameState(game.id, patched)

  // If nobody can act, let the game advance automatically.
  if (next === null) {
    return advanceRoundIfReady(game.id)
  }

  return getGameById(game.id)
}

/**
 * Submit a player action
 * @param {string} playerId - Player ID
 * @param {string} action - Action type
 * @param {number} amount - Bet/raise amount (optional)
 * @returns {Promise<Object>} Updated game state
 */
async function submitAction(playerId, action, amount = 0) {
  // Get player
  const player = await getPlayerById(playerId)
  if (!player) {
    throw new Error('Player not found')
  }

  // Get game state
  let game = await getGameById(player.gameId)
  if (!game) {
    throw new Error('Game not found')
  }

  // Heal old/broken states where turn points at ALL_IN/FOLDED.
  game = (await normalizeTurnIfNeeded(game.id)) || game

  if (game.status !== 'active') {
    throw new Error('Game is not active')
  }

  // Find player position in game state
  const playerPosition = game.players.findIndex((p) => p.id === playerId)
  if (playerPosition === -1) {
    throw new Error('Player not in game')
  }

  // Validate and process action
  const validation = validateAction(game, playerPosition, action, amount)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  let newState = processAction(game, playerPosition, action, amount)

  // Save updated state
  await saveGameState(game.id, newState)

  // Log the action event
  const eventTypeMap = {
    check: EVENT_TYPE.ACTION_CHECK,
    bet: EVENT_TYPE.ACTION_BET,
    call: EVENT_TYPE.ACTION_CALL,
    raise: EVENT_TYPE.ACTION_RAISE,
    fold: EVENT_TYPE.ACTION_FOLD,
    all_in: EVENT_TYPE.ACTION_ALL_IN,
  }
  const eventType = eventTypeMap[action] || 'action:unknown'
  eventLogger.logEvent(
    eventType,
    {
      playerId,
      playerName: player.name,
      playerPosition,
      action,
      amount,
      round: game.currentRound,
      remainingChips: newState.players[playerPosition].chips,
    },
    game.id,
  )

  // Record action in history
  if (game.currentRound) {
    await recordAction(game.id, playerId, action, amount, game.currentRound)
  }

  // CHECK FOR WIN BY FOLD
  // If only one player remains (active or all-in), the hand is over.
  // This handles two cases:
  // 1. Everyone else folded and no one is all-in (simple case)
  // 2. Someone went all-in, then everyone else folded (should not force full playout)
  const activePlayers = newState.players.filter((p) => p.status === PLAYER_STATUS.ACTIVE)
  const allInPlayers = newState.players.filter((p) => p.status === PLAYER_STATUS.ALL_IN)
  const playersStillInHand = activePlayers.length + allInPlayers.length

  if (playersStillInHand === 1) {
    // Only one player left - either they're active or all-in, they win!
    // Advance directly to showdown without auto-advancing through rounds
    const { advanceRound, processShowdown, ROUND } = require('../lib/game-state-machine')

    // If not already at showdown, advance to showdown
    if (newState.currentRound !== ROUND.SHOWDOWN) {
      newState = advanceRound(newState)
      newState.currentRound = ROUND.SHOWDOWN // Force to showdown
    }

    // Process showdown to award the pot
    newState = processShowdown(newState)

    // Save the final state
    await saveGameState(game.id, newState)

    // Complete hand record
    const { completeHandRecord } = require('./game-service')
    await completeHandRecord(game.id, newState)
  }

  // AUTO-ADVANCE IN SIMPLE CASES (no all-ins)
  // When betting completes and no players are all-in, automatically advance to next round
  // This is a convenience feature for the common case where all players check or call
  const { isBettingRoundComplete, shouldAutoAdvance } = require('../lib/game-state-machine')

  if (
    allInPlayers.length === 0 && // No all-in players (simple case)
    isBettingRoundComplete(newState) && // Betting is complete
    !shouldAutoAdvance(newState) && // Not already auto-advancing (redundant check but safe)
    newState.currentRound !== 'showdown' // Not already at showdown
  ) {
    // Auto-advance one round for player convenience
    const { advanceOneRound } = require('./game-service')
    await advanceOneRound(game.id)
  }

  // Get fresh state to return
  const finalState = await getGameById(game.id)

  // Normalize turn if needed (in case current player is now ALL_IN/OUT)
  const normalizedState = (await normalizeTurnIfNeeded(finalState.id)) || finalState

  return normalizedState
}

/**
 * Get valid actions for a player
 * @param {string} playerId - Player ID
 * @returns {Promise<Object>} Valid actions
 */
async function getPlayerValidActions(playerId) {
  // Get player
  const player = await getPlayerById(playerId)
  if (!player) {
    throw new Error('Player not found')
  }

  // Get game state
  let game = await getGameById(player.gameId)
  if (!game) {
    throw new Error('Game not found')
  }

  // Heal old/broken states where turn points at ALL_IN/FOLDED.
  game = (await normalizeTurnIfNeeded(game.id)) || game

  if (game.status !== 'active') {
    return { canAct: false, reason: 'Game not active' }
  }

  // Find player position
  const playerPosition = game.players.findIndex((p) => p.id === playerId)
  if (playerPosition === -1) {
    return { canAct: false, reason: 'Player not in game' }
  }

  return getValidActions(game, playerPosition)
}

/**
 * Record an action in the database
 * @param {string} gameId - Game ID
 * @param {string} playerId - Player ID
 * @param {string} actionType - Action type
 * @param {number} amount - Amount
 * @param {string} round - Current round
 */
async function recordAction(gameId, playerId, actionType, amount, round) {
  // Get current hand
  const hand = await db('hands').where({ game_id: gameId }).orderBy('hand_number', 'desc').first()

  if (!hand) {
    // Hand not yet created - this shouldn't happen in new flow
    console.warn('No hand record found for action', { gameId, playerId, actionType })
    return
  }

  // Get next sequence number for this hand
  const lastAction = await db('actions')
    .where({ hand_id: hand.id })
    .orderBy('sequence_number', 'desc')
    .first()

  const sequenceNumber = lastAction ? lastAction.sequence_number + 1 : 1

  await db('actions').insert({
    hand_id: hand.id,
    player_id: playerId,
    action_type: actionType,
    amount,
    round,
    sequence_number: sequenceNumber,
  })
}

/**
 * Record blind post action
 * @param {string} gameId - Game ID
 * @param {string} playerId - Player ID
 * @param {string} blindType - 'small_blind' or 'big_blind'
 * @param {number} amount - Blind amount
 */
async function recordBlindPost(gameId, playerId, blindType, amount) {
  eventLogger.logEvent(
    EVENT_TYPE.BLINDS_POSTED,
    {
      playerId,
      blindType,
      amount,
    },
    gameId,
  )
  await recordAction(gameId, playerId, blindType, amount, 'preflop')
}

/**
 * Get action history for a hand
 * @param {string} handId - Hand ID
 * @returns {Promise<Array>} Array of actions
 */
async function getHandActions(handId) {
  const actions = await db('actions')
    .where({ hand_id: handId })
    .orderBy('sequence_number')
    .orderBy('created_at')

  return actions.map((a) => ({
    id: a.id,
    playerId: a.player_id,
    actionType: a.action_type,
    amount: a.amount,
    round: a.round,
    sequenceNumber: a.sequence_number,
    timestamp: a.created_at,
  }))
}

/**
 * Reveal the next community card (manual action when only one player has chips)
 * @param {string} playerId - Player ID
 * @returns {Promise<Object>} Updated game state
 */
async function revealCard(playerId) {
  // Get player
  const player = await getPlayerById(playerId)
  if (!player) {
    throw new Error('Player not found')
  }

  // Get game state
  let game = await getGameById(player.gameId)
  if (!game) {
    throw new Error('Game not found')
  }

  if (game.status !== 'active') {
    throw new Error('Game is not active')
  }

  // Find player position in game state
  const playerPosition = game.players.findIndex((p) => p.id === playerId)
  if (playerPosition === -1) {
    throw new Error('Player not in game')
  }

  // Validate that player can reveal a card
  const { canRevealCard } = require('../lib/betting-logic')
  const validation = canRevealCard(game, playerPosition)
  if (!validation.canReveal) {
    throw new Error(validation.error || 'Cannot reveal card in current game state')
  }

  // Reveal the card
  const { revealNextCard } = require('../lib/game-state-machine')
  let newState = revealNextCard(game)

  eventLogger.logEvent(
    EVENT_TYPE.CARD_REVEALED,
    {
      playerId,
      round: newState.currentRound,
      communityCards: newState.communityCards,
    },
    game.id,
  )

  // Save updated state
  await saveGameState(game.id, newState)

  // If we just moved to showdown, process it
  if (newState.currentRound === 'showdown') {
    const { processShowdown } = require('../lib/game-state-machine')
    newState = processShowdown(newState)
    await saveGameState(game.id, newState)
  }

  return getGameById(game.id)
}

/**
 * Get action history for a game
 * @param {string} gameId - Game ID
 * @param {number} handNumber - Hand number (optional)
 * @returns {Promise<Array>} Array of actions
 */
async function getGameActions(gameId, handNumber = null) {
  let query = db('actions')
    .join('hands', 'actions.hand_id', 'hands.id')
    .where('hands.game_id', gameId)

  if (handNumber !== null) {
    query = query.where('hands.hand_number', handNumber)
  }

  const actions = await query
    .select('actions.*', 'hands.hand_number')
    .orderBy('hands.hand_number')
    .orderBy('actions.sequence_number')
    .orderBy('actions.created_at')

  return actions.map((a) => ({
    id: a.id,
    handId: a.hand_id,
    handNumber: a.hand_number,
    playerId: a.player_id,
    actionType: a.action_type,
    amount: a.amount,
    round: a.round,
    sequenceNumber: a.sequence_number,
    timestamp: a.created_at,
  }))
}

module.exports = {
  submitAction,
  getPlayerValidActions,
  recordAction,
  recordBlindPost,
  getHandActions,
  getGameActions,
  normalizeTurnIfNeeded,
  revealCard,
}
