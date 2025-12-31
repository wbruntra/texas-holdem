/**
 * Player Service - Handles player management
 */

const { v4: uuidv4 } = require('uuid')
const bcrypt = require('bcryptjs')
const db = require('../../db')

/**
 * Add a player to a game
 * @param {string} gameId - Game ID
 * @param {string} playerName - Player name
 * @param {string} password - Player password (for this game session)
 * @returns {Promise<Object>} Created player
 */
async function joinGame(gameId, playerName, password) {
  if (!playerName || playerName.trim().length === 0) {
    throw new Error('Player name is required')
  }

  if (!password || password.length < 4) {
    throw new Error('Password must be at least 4 characters')
  }

  // Check if game exists and is in waiting status
  const game = await db('games').where({ id: gameId }).first()
  if (!game) {
    throw new Error('Game not found')
  }

  if (game.status !== 'waiting') {
    throw new Error('Game already started')
  }

  // Check player limit (max 10 players)
  const playerCount = await db('players').where({ game_id: gameId }).count('id as count')
  if (playerCount[0].count >= 10) {
    throw new Error('Game is full')
  }

  // Check if name is already taken
  const existingPlayer = await db('players').where({ game_id: gameId, name: playerName }).first()

  if (existingPlayer) {
    throw new Error('Player name already taken')
  }

  // Get next position
  const players = await db('players')
    .where({ game_id: gameId })
    .orderBy('position', 'desc')
    .limit(1)

  const position = players.length > 0 ? players[0].position + 1 : 0

  // Create player
  const playerId = uuidv4()
  const passwordHash = await bcrypt.hash(password, 8)

  await db('players').insert({
    id: playerId,
    game_id: gameId,
    name: playerName,
    position,
    chips: game.starting_chips,
    current_bet: 0,
    status: 'active',
    password_hash: passwordHash,
    is_dealer: 0,
    is_small_blind: 0,
    is_big_blind: 0,
    connected: 1,
  })

  return {
    id: playerId,
    name: playerName,
    position,
    chips: game.starting_chips,
    gameId,
  }
}

/**
 * Get player by ID
 * @param {string} playerId - Player ID
 * @returns {Promise<Object|null>} Player object or null
 */
async function getPlayerById(playerId) {
  const player = await db('players').where({ id: playerId }).first()
  if (!player) return null

  return {
    id: player.id,
    gameId: player.game_id,
    name: player.name,
    position: player.position,
    chips: player.chips,
    currentBet: player.current_bet,
    holeCards: player.hole_cards ? JSON.parse(player.hole_cards) : [],
    status: player.status,
    isDealer: player.is_dealer === 1,
    isSmallBlind: player.is_small_blind === 1,
    isBigBlind: player.is_big_blind === 1,
    lastAction: player.last_action,
    connected: player.connected === 1,
  }
}

/**
 * Remove player from game
 * @param {string} playerId - Player ID
 */
async function leaveGame(playerId) {
  const player = await getPlayerById(playerId)
  if (!player) {
    throw new Error('Player not found')
  }

  // Check if game has started
  const game = await db('games').where({ id: player.gameId }).first()
  if (game.status !== 'waiting') {
    // If game started, mark as disconnected instead of deleting
    await db('players').where({ id: playerId }).update({ connected: 0, updated_at: new Date() })
  } else {
    // If game not started, can remove player
    await db('players').where({ id: playerId }).delete()
  }
}

/**
 * Update player connection status
 * @param {string} playerId - Player ID
 * @param {boolean} connected - Connection status
 */
async function updateConnectionStatus(playerId, connected) {
  await db('players')
    .where({ id: playerId })
    .update({ connected: connected ? 1 : 0, updated_at: new Date() })
}

/**
 * Get players in a game
 * @param {string} gameId - Game ID
 * @returns {Promise<Array>} Array of players
 */
async function getPlayersInGame(gameId) {
  const players = await db('players').where({ game_id: gameId }).orderBy('position')

  return players.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    chips: p.chips,
    currentBet: p.current_bet,
    status: p.status,
    connected: p.connected === 1,
  }))
}

/**
 * Authenticate a player with name and password
 * @param {string} gameId - Game ID
 * @param {string} playerName - Player name
 * @param {string} password - Player password
 * @returns {Promise<Object>} Player object if authenticated
 * @throws {Error} If authentication fails
 */
async function authenticatePlayer(gameId, playerName, password) {
  const player = await db('players').where({ game_id: gameId, name: playerName }).first()

  if (!player) {
    throw new Error('Invalid credentials')
  }

  const isValid = await bcrypt.compare(password, player.password_hash)
  if (!isValid) {
    throw new Error('Invalid credentials')
  }

  return getPlayerById(player.id)
}

module.exports = {
  joinGame,
  getPlayerById,
  authenticatePlayer,
  leaveGame,
  updateConnectionStatus,
  getAllPlayersInGame: getPlayersInGame,
}
