/**
 * Game Service - Handles game creation, state management, and persistence
 */

const db = require('../../db')
const {
  createGameState,
  startNewHand,
  advanceRound,
  processShowdown,
  isBettingRoundComplete,
  shouldAutoAdvance,
  shouldContinueToNextRound,
  GAME_STATUS,
  ROUND,
} = require('../lib/game-state-machine')
const { calculatePots, getTotalPot } = require('../lib/pot-manager')

/**
 * Generate a unique 6-character room code
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Exclude ambiguous characters
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * Create a new game
 * @param {Object} config - Game configuration
 * @returns {Promise<Object>} Created game with room code
 */
async function createGame(config = {}) {
  const { smallBlind = 5, bigBlind = 10, startingChips = 1000 } = config

  // Generate unique room code
  let roomCode
  let attempts = 0
  do {
    roomCode = generateRoomCode()
    const existing = await db('games').where({ room_code: roomCode }).first()
    if (!existing) break
    attempts++
  } while (attempts < 10)

  if (attempts >= 10) {
    throw new Error('Failed to generate unique room code')
  }

  const [gameId] = await db('games').insert({
    room_code: roomCode,
    status: GAME_STATUS.WAITING,
    small_blind: smallBlind,
    big_blind: bigBlind,
    starting_chips: startingChips,
    dealer_position: 0,
    pot: 0,
    current_bet: 0,
    hand_number: 0,
    last_raise: 0,
  })

  return {
    id: gameId,
    roomCode,
    status: GAME_STATUS.WAITING,
    smallBlind,
    bigBlind,
    startingChips,
  }
}

/**
 * Get game by ID
 * @param {string} gameId - Game ID
 * @returns {Promise<Object|null>} Game object or null
 */
async function getGameById(gameId) {
  const game = await db('games').where({ id: gameId }).first()
  if (!game) return null

  const players = await db('players').where({ game_id: gameId }).orderBy('position')

  const gameState = {
    id: game.id,
    roomCode: game.room_code,
    status: game.status,
    smallBlind: game.small_blind,
    bigBlind: game.big_blind,
    startingChips: game.starting_chips,
    dealerPosition: game.dealer_position,
    currentRound: game.current_round,
    pot: game.pot,
    pots: game.pots ? JSON.parse(game.pots) : [],
    communityCards: game.community_cards ? JSON.parse(game.community_cards) : [],
    deck: game.deck ? JSON.parse(game.deck) : [],
    winners: game.winners ? JSON.parse(game.winners) : undefined,
    currentBet: game.current_bet,
    currentPlayerPosition: game.current_player_position,
    handNumber: game.hand_number,
    lastRaise: game.last_raise,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      chips: p.chips,
      currentBet: p.current_bet,
      totalBet: p.total_bet || 0,
      holeCards: p.hole_cards ? JSON.parse(p.hole_cards) : [],
      status: p.status,
      isDealer: p.is_dealer === 1,
      isSmallBlind: p.is_small_blind === 1,
      isBigBlind: p.is_big_blind === 1,
      lastAction: p.last_action,
      connected: p.connected === 1,
    })),
  }

  // If game is completed, clear the current player position
  if (gameState.status === 'completed') {
    gameState.currentPlayerPosition = null
  }

  return gameState
}

/**
 * Get game by room code
 * @param {string} roomCode - Room code
 * @returns {Promise<Object|null>} Game object or null
 */
async function getGameByRoomCode(roomCode) {
  const game = await db('games').where({ room_code: roomCode }).first()
  if (!game) return null

  return getGameById(game.id)
}

/**
 * Start a game (begin first hand)
 * @param {string} gameId - Game ID
 * @returns {Promise<Object>} Updated game state
 */
async function startGame(gameId) {
  const game = await getGameById(gameId)
  if (!game) {
    throw new Error('Game not found')
  }

  if (game.status !== GAME_STATUS.WAITING) {
    throw new Error('Game already started')
  }

  if (game.players.length < 2) {
    throw new Error('Need at least 2 players to start')
  }

  // Create game state and start first hand
  const gameState = createGameState({
    smallBlind: game.smallBlind,
    bigBlind: game.bigBlind,
    startingChips: game.startingChips,
    players: game.players,
  })

  const newState = startNewHand(gameState)

  // Save updated state to database
  await saveGameState(gameId, newState)

  // Create hand record at start with initial state
  await createHandRecord(gameId, newState)

  // Record blind posts as actions
  try {
    const { recordBlindPost } = require('./action-service')
    const players = newState.players

    const sbPlayer = players.find((p) => p.isSmallBlind)
    const bbPlayer = players.find((p) => p.isBigBlind)

    if (sbPlayer && sbPlayer.currentBet > 0) {
      await recordBlindPost(gameId, sbPlayer.id, 'small_blind', sbPlayer.currentBet)
    }
    if (bbPlayer && bbPlayer.currentBet > 0) {
      await recordBlindPost(gameId, bbPlayer.id, 'big_blind', bbPlayer.currentBet)
    }
  } catch (error) {
    console.error('Failed to record blind posts:', error)
  }

  return getGameById(gameId)
}

/**
 * Save game state to database
 * @param {string} gameId - Game ID
 * @param {Object} state - Game state
 */
async function saveGameState(gameId, state) {
  await db.transaction(async (trx) => {
    // Update game
    await trx('games')
      .where({ id: gameId })
      .update({
        status: state.status,
        dealer_position: state.dealerPosition,
        current_round: state.currentRound,
        pot: state.pot,
        pots:
          Array.isArray(state.pots) && state.pots.length > 0 ? JSON.stringify(state.pots) : null,
        community_cards:
          state.communityCards.length > 0 ? JSON.stringify(state.communityCards) : null,
        deck: state.deck && state.deck.length > 0 ? JSON.stringify(state.deck) : null,
        winners:
          Array.isArray(state.winners) && state.winners.length > 0
            ? JSON.stringify(state.winners)
            : null,
        current_bet: state.currentBet,
        current_player_position: state.currentPlayerPosition,
        hand_number: state.handNumber,
        last_raise: state.lastRaise,
        updated_at: new Date(),
      })

    // Update players
    for (const player of state.players) {
      await trx('players')
        .where({ id: player.id })
        .update({
          chips: player.chips,
          current_bet: player.currentBet,
          total_bet: player.totalBet || 0,
          hole_cards: player.holeCards.length > 0 ? JSON.stringify(player.holeCards) : null,
          status: player.status,
          is_dealer: player.isDealer ? 1 : 0,
          is_small_blind: player.isSmallBlind ? 1 : 0,
          is_big_blind: player.isBigBlind ? 1 : 0,
          last_action: player.lastAction,
          updated_at: new Date(),
        })
    }
  })
}

/**
 * Advance to next round if betting is complete
 * @param {string} gameId - Game ID
 * @returns {Promise<Object>} Updated game state
 */
/**
 * Advance exactly one round (for manual button clicks)
 * Does NOT auto-advance through multiple rounds
 * @param {string} gameId - Game ID
 * @returns {Promise<Object>} Updated game state
 */
async function advanceOneRound(gameId) {
  const game = await getGameById(gameId)
  if (!game) {
    throw new Error('Game not found')
  }

  let gameState = game

  // Check if betting is complete
  if (!isBettingRoundComplete(gameState) && !shouldAutoAdvance(gameState)) {
    // Betting not complete, cannot advance
    return gameState
  }

  if (gameState.currentRound === ROUND.SHOWDOWN) {
    // Already at showdown
    return gameState
  }

  // Advance one round
  if (shouldContinueToNextRound(gameState)) {
    gameState = advanceRound(gameState)

    // Recalculate pots after advancing
    gameState.pots = calculatePots(gameState.players)
    gameState.pot = getTotalPot(gameState.pots)

    await saveGameState(gameId, gameState)
  } else {
    // Go to showdown
    gameState = advanceRound(gameState)

    // Final pot calculation
    gameState.pots = calculatePots(gameState.players)
    gameState.pot = getTotalPot(gameState.pots)

    gameState = processShowdown(gameState)
    await saveGameState(gameId, gameState)

    // Complete hand record with final state
    await completeHandRecord(gameId, gameState)
  }

  return gameState
}

async function advanceRoundIfReady(gameId) {
  const game = await getGameById(gameId)
  if (!game) {
    throw new Error('Game not found')
  }

  let gameState = game

  // Check if we should auto-advance (everyone all-in or only one player can act)
  const shouldAutoAdvanceNow = shouldAutoAdvance(gameState)

  // Keep advancing rounds while betting is complete OR should auto-advance
  while (
    (isBettingRoundComplete(gameState) || shouldAutoAdvance(gameState)) &&
    gameState.currentRound !== ROUND.SHOWDOWN
  ) {
    // Before advancing, if only one player can act and they need to check, do it automatically
    if (shouldAutoAdvance(gameState) && gameState.currentPlayerPosition !== null) {
      const activePlayers = gameState.players.filter((p) => p.status === 'active' && p.chips > 0)

      // If exactly one player can act and no bet to call, auto-check
      if (activePlayers.length === 1 && gameState.currentBet === 0) {
        const actingPlayer = activePlayers[0]
        const playerPosition = gameState.players.findIndex((p) => p.id === actingPlayer.id)

        if (playerPosition === gameState.currentPlayerPosition) {
          // Import processAction here to avoid circular dependency issues
          const { processAction } = require('../lib/betting-logic')

          // Auto-check for this player
          gameState = processAction(gameState, playerPosition, 'check', 0)
          await saveGameState(gameId, gameState)

          // Record the auto-check action
          const { recordAction } = require('./action-service')
          await recordAction(gameId, actingPlayer.id, 'check', 0, gameState.currentRound)
        }
      }
    }

    if (shouldContinueToNextRound(gameState)) {
      gameState = advanceRound(gameState)

      // Recalculate pots after each round
      gameState.pots = calculatePots(gameState.players)
      gameState.pot = getTotalPot(gameState.pots)

      // If auto-advancing, add timestamp for when this round's cards were revealed
      if (shouldAutoAdvanceNow) {
        gameState.autoAdvanceTimestamp = Date.now()
      }

      await saveGameState(gameId, gameState)

      // If auto-advancing, add delay before next round
      if (shouldAutoAdvanceNow && shouldAutoAdvance(gameState)) {
        // 2 second delay between auto-revealed cards
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    } else {
      // Go to showdown
      gameState = advanceRound(gameState)

      // Final pot calculation
      gameState.pots = calculatePots(gameState.players)
      gameState.pot = getTotalPot(gameState.pots)

      gameState = processShowdown(gameState)
      await saveGameState(gameId, gameState)

      // Complete hand record with final state
      await completeHandRecord(gameId, gameState)
      break
    }
  }

  return getGameById(gameId)
}

/**
 * Start next hand
 * @param {string} gameId - Game ID
 * @returns {Promise<Object>} Updated game state
 */
async function startNextHand(gameId) {
  const game = await getGameById(gameId)
  if (!game) {
    throw new Error('Game not found')
  }

  if (game.currentRound !== ROUND.SHOWDOWN) {
    throw new Error('Current hand not finished')
  }

  const newState = startNewHand(game)
  await saveGameState(gameId, newState)

  // Create hand record at start
  await createHandRecord(gameId, newState)

  // Record blind posts as actions
  try {
    const { recordBlindPost } = require('./action-service')
    const players = newState.players

    const sbPlayer = players.find((p) => p.isSmallBlind)
    const bbPlayer = players.find((p) => p.isBigBlind)

    if (sbPlayer && sbPlayer.currentBet > 0) {
      await recordBlindPost(gameId, sbPlayer.id, 'small_blind', sbPlayer.currentBet)
    }
    if (bbPlayer && bbPlayer.currentBet > 0) {
      await recordBlindPost(gameId, bbPlayer.id, 'big_blind', bbPlayer.currentBet)
    }
  } catch (error) {
    console.error('Failed to record blind posts:', error)
  }

  return getGameById(gameId)
}

/**
 * Create hand record at start of hand
 * @param {string} gameId - Game ID
 * @param {Object} gameState - Game state at hand start
 * @returns {Promise<string>} Hand ID
 */
async function createHandRecord(gameId, gameState) {
  // Capture player stacks at start
  const playerStacksStart = gameState.players.map((p) => ({
    player_id: p.id,
    position: p.position,
    name: p.name,
    chips: p.chips,
  }))

  // Capture hole cards for each player
  const playerHoleCards = {}
  gameState.players.forEach((p) => {
    if (p.holeCards && p.holeCards.length > 0) {
      playerHoleCards[p.id] = p.holeCards
    }
  })

  const [handId] = await db('hands').insert({
    game_id: gameId,
    hand_number: gameState.handNumber,
    dealer_position: gameState.dealerPosition,
    deck: gameState.deck ? JSON.stringify(gameState.deck) : null,
    player_hole_cards: JSON.stringify(playerHoleCards),
    player_stacks_start: JSON.stringify(playerStacksStart),
    small_blind: gameState.smallBlind,
    big_blind: gameState.bigBlind,
    community_cards: JSON.stringify([]),
  })

  return handId
}

/**
 * Update hand record at completion (showdown)
 * @param {string} gameId - Game ID
 * @param {Object} gameState - Game state after showdown
 */
async function completeHandRecord(gameId, gameState) {
  const hand = await db('hands').where({ game_id: gameId }).orderBy('hand_number', 'desc').first()

  if (!hand) {
    console.error('No hand record found to complete')
    return
  }

  // Capture player stacks at end
  const playerStacksEnd = gameState.players.map((p) => ({
    player_id: p.id,
    position: p.position,
    chips: p.chips,
  }))

  await db('hands')
    .where({ id: hand.id })
    .update({
      winners: gameState.winners ? JSON.stringify(gameState.winners) : null,
      pot_amount: gameState.pot,
      pots: gameState.pots ? JSON.stringify(gameState.pots) : null,
      community_cards: JSON.stringify(gameState.communityCards),
      player_stacks_end: JSON.stringify(playerStacksEnd),
      completed_at: new Date(),
      updated_at: new Date(),
    })
}

/**
 * Record hand history (legacy - kept for compatibility)
 * @param {string} gameId - Game ID
 * @param {Object} gameState - Game state after showdown
 * @deprecated Use createHandRecord at start and completeHandRecord at end
 */
async function recordHandHistory(gameId, gameState) {
  // For backwards compatibility, check if hand already exists
  const existingHand = await db('hands')
    .where({ game_id: gameId, hand_number: gameState.handNumber })
    .first()

  if (existingHand) {
    // Hand was created at start, just complete it
    await completeHandRecord(gameId, gameState)
  } else {
    // Old flow - create complete record at once
    await db('hands').insert({
      game_id: gameId,
      hand_number: gameState.handNumber,
      dealer_position: gameState.dealerPosition,
      winners: gameState.winners ? JSON.stringify(gameState.winners) : null,
      pot_amount: gameState.pot,
      community_cards: JSON.stringify(gameState.communityCards),
      completed_at: new Date(),
    })
  }
}

/**
 * Delete a game
 * @param {string} gameId - Game ID
 */
async function deleteGame(gameId) {
  await db('games').where({ id: gameId }).delete()
}

module.exports = {
  generateRoomCode,
  createGame,
  getGameById,
  getGameByRoomCode,
  startGame,
  saveGameState,
  advanceRoundIfReady,
  advanceOneRound,
  startNextHand,
  createHandRecord,
  completeHandRecord,
  recordHandHistory,
  deleteGame,
}
