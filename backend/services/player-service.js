/**
 * Player Service - Handles player management
 */

const bcrypt = require('bcryptjs')
const db = require('@holdem/database/db')
const eventLogger = require('@/services/event-logger')
const { EVENT_TYPE } = require('@/lib/event-types')

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

  // Check if game exists
  const game = await db('games').where({ id: gameId }).first()
  if (!game) {
    throw new Error('Game not found')
  }

  // Check if player already exists in this game (allow rejoin regardless of game status)
  const existingPlayer = await db('players').where({ game_id: gameId, name: playerName }).first()

  if (existingPlayer) {
    // Allow rejoin if password matches
    const isValid = await bcrypt.compare(password, existingPlayer.password_hash)
    if (!isValid) {
      throw new Error('Invalid password')
    }

    // Update connection status
    await db('players')
      .where({ id: existingPlayer.id })
      .update({ connected: 1, updated_at: new Date() })

    eventLogger.logEvent(
      EVENT_TYPE.PLAYER_REJOINED,
      {
        playerId: existingPlayer.id,
        playerName,
      },
      gameId,
    )

    return {
      id: existingPlayer.id,
      name: existingPlayer.name,
      position: existingPlayer.position,
      chips: existingPlayer.chips,
      gameId,
    }
  }

  // New player: only allow joining if game is still in waiting status
  if (game.status !== 'waiting') {
    throw new Error('Game already started')
  }

  // Check player limit (max 10 players)
  const playerCount = await db('players').where({ game_id: gameId }).count('id as count')
  if (playerCount[0].count >= 10) {
    throw new Error('Game is full')
  }

  // Get next position
  const players = await db('players')
    .where({ game_id: gameId })
    .orderBy('position', 'desc')
    .limit(1)

  const position = players.length > 0 ? players[0].position + 1 : 0

  // Create player
  const passwordHash = await bcrypt.hash(password, 8)

  const [playerId] = await db('players').insert({
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

  eventLogger.logEvent(
    EVENT_TYPE.PLAYER_JOINED,
    {
      playerId,
      playerName,
      position,
      chips: game.starting_chips,
    },
    gameId,
  )

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
    showCards: player.show_cards === 1,
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
    eventLogger.logEvent(
      EVENT_TYPE.PLAYER_LEFT,
      {
        playerId,
        playerName: player.name,
        disconnected: true,
      },
      player.gameId,
    )
  } else {
    // If game not started, can remove player
    await db('players').where({ id: playerId }).delete()
    eventLogger.logEvent(
      EVENT_TYPE.PLAYER_LEFT,
      {
        playerId,
        playerName: player.name,
        removed: true,
      },
      player.gameId,
    )
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

  eventLogger.logEvent(
    EVENT_TYPE.PLAYER_AUTHENTICATED,
    {
      playerId: player.id,
      playerName,
    },
    gameId,
  )

  return getPlayerById(player.id)
}

/**
 * Update player showCards status
 */
async function setShowCards(playerId, showCards) {
  const player = await getPlayerById(playerId)
  await db('players')
    .where({ id: playerId })
    .update({ show_cards: showCards ? 1 : 0, updated_at: new Date() })

  if (showCards && player) {
    eventLogger.logEvent(
      EVENT_TYPE.CARDS_SHOWN,
      {
        playerId,
        playerName: player.name,
      },
      player.gameId,
    )
  }
}

module.exports = {
  joinGame,
  getPlayerById,
  authenticatePlayer,
  leaveGame,
  updateConnectionStatus,
  getAllPlayersInGame: getPlayersInGame,
  setShowCards,
}
