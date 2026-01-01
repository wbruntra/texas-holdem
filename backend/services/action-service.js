/**
 * Action Service - Handles player actions (bet, raise, fold, etc.)
 */

const db = require('../../db')
const { validateAction, processAction, getValidActions } = require('../lib/betting-logic')
const { getGameById, saveGameState, advanceRoundIfReady } = require('./game-service')
const { getPlayerById } = require('./player-service')
const { ACTION_TYPE, PLAYER_STATUS } = require('../lib/game-constants')
const { getNextActingPosition } = require('../lib/game-state-machine')

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

  const newState = processAction(game, playerPosition, action, amount)

  // Save updated state
  await saveGameState(game.id, newState)

  // Record action in history
  if (game.currentRound) {
    await recordAction(game.id, playerId, action, amount, game.currentRound)
  }

  // CHECK FOR WIN BY FOLD
  // If only one active player remains and NO ONE is all-in, the hand is over.
  // We should auto-advance to Showdown effectively immediately so the winner gets the pot.
  // We don't need to "wait for players to see what happened" because "Fold" -> "Winner" is immediate.
  const activePlayers = newState.players.filter((p) => p.status === PLAYER_STATUS.ACTIVE)
  const allInPlayers = newState.players.filter((p) => p.status === PLAYER_STATUS.ALL_IN)

  if (activePlayers.length === 1 && allInPlayers.length === 0) {
    // Everyone else folded. Advance to finish the hand.
    await advanceRoundIfReady(game.id)
  }

  // DO NOT AUTO-ADVANCE when betting completes - let players manually reveal cards
  // This prevents race conditions and double-processing of showdown

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
