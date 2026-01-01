const express = require('express')
const router = express.Router()
const gameService = require('../services/game-service')
const playerService = require('../services/player-service')
const actionService = require('../services/action-service')
const gameEvents = require('../lib/game-events')

const SHOWDOWN_ROUND = 'showdown'

/**
 * Middleware to require authentication
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.playerId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  next()
}

/**
 * Middleware to load player from session
 */
async function loadPlayer(req, res, next) {
  try {
    const player = await playerService.getPlayerById(req.session.playerId)
    if (!player) {
      req.session = null // Clear invalid session
      return res.status(401).json({ error: 'Player not found' })
    }
    req.player = player
    next()
  } catch (error) {
    next(error)
  }
}

/**
 * POST /api/games
 * Create a new game
 */
router.post('/', async (req, res, next) => {
  try {
    const { smallBlind, bigBlind, startingChips } = req.body

    const game = await gameService.createGame({
      smallBlind,
      bigBlind,
      startingChips,
    })

    res.status(201).json(game)
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/games/room/:roomCode
 * Get game by room code (public info only)
 */
router.get('/room/:roomCode', async (req, res, next) => {
  try {
    const game = await gameService.getGameByRoomCode(req.params.roomCode)

    if (!game) {
      return res.status(404).json({ error: 'Game not found' })
    }

    // Return public info only (no hole cards)
    const publicGame = {
      id: game.id,
      roomCode: game.roomCode,
      status: game.status,
      smallBlind: game.smallBlind,
      bigBlind: game.bigBlind,
      startingChips: game.startingChips,
      players: game.players.map((p) => ({
        name: p.name,
        position: p.position,
        chips: p.chips,
        connected: p.connected,
      })),
    }

    res.json(publicGame)
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/games/room/:roomCode/state
 * Shared table display state (no auth)
 */
router.get('/room/:roomCode/state', async (req, res, next) => {
  try {
    let game = await gameService.getGameByRoomCode(req.params.roomCode)

    if (!game) {
      return res.status(404).json({ error: 'Game not found' })
    }

    // Normalize turn in case current player is ALL_IN or FOLDED
    game = (await actionService.normalizeTurnIfNeeded(game.id)) || game

    const isShowdown = game.currentRound === SHOWDOWN_ROUND

    // Shared screen should show full table state.
    // Hole cards remain hidden until showdown.
    const tableState = {
      id: game.id,
      roomCode: game.roomCode,
      status: game.status,
      smallBlind: game.smallBlind,
      bigBlind: game.bigBlind,
      startingChips: game.startingChips,
      dealerPosition: game.dealerPosition,
      currentRound: game.currentRound,
      pot: game.pot,
      currentBet: game.currentBet,
      currentPlayerPosition: game.currentPlayerPosition,
      handNumber: game.handNumber,
      communityCards: game.communityCards || [],
      winners: game.winners || undefined,
      players: game.players.map((p) => ({
        id: p.id,
        name: p.name,
        position: p.position,
        chips: p.chips,
        currentBet: p.currentBet,
        status: p.status,
        holeCards: isShowdown ? p.holeCards || [] : [],
        lastAction: p.lastAction || null,
        connected: p.connected,
      })),
    }

    res.json(tableState)
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/games/:gameId
 * Get full game state (requires authentication)
 */
router.get('/:gameId', requireAuth, loadPlayer, async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)
    let game = await gameService.getGameById(gameId)

    if (!game) {
      return res.status(404).json({ error: 'Game not found' })
    }

    // Verify player is in this game
    if (req.player.gameId !== game.id) {
      return res.status(403).json({ error: 'Not authorized for this game' })
    }

    // Normalize turn in case current player is ALL_IN or FOLDED
    game = (await actionService.normalizeTurnIfNeeded(game.id)) || game

    const isShowdown = game.currentRound === SHOWDOWN_ROUND

    // Filter community cards based on current round (only show revealed cards)
    let visibleCommunityCards = []
    if (game.communityCards) {
      if (game.currentRound === 'flop') {
        visibleCommunityCards = game.communityCards.slice(0, 3)
      } else if (game.currentRound === 'turn') {
        visibleCommunityCards = game.communityCards.slice(0, 4)
      } else if (game.currentRound === 'river' || game.currentRound === SHOWDOWN_ROUND) {
        visibleCommunityCards = game.communityCards
      }
      // Pre-flop: no cards visible
    }

    // Return sanitized state: only show this player's hole cards (except at showdown)
    // and exclude deck to prevent information leakage
    const currentPlayerId = req.player.id
    const gameState = {
      ...game,
      deck: undefined, // Never expose the deck
      communityCards: visibleCommunityCards,
      players: game.players.map((p) => ({
        ...p,
        holeCards: isShowdown || p.id === currentPlayerId ? p.holeCards : [],
      })),
    }

    res.json(gameState)
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/games/:gameId/join
 * Join a game with name and password
 */
router.post('/:gameId/join', async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)
    const { name, password } = req.body

    if (!name || !password) {
      return res.status(400).json({ error: 'Name and password required' })
    }

    const player = await playerService.joinGame(gameId, name, password)

    // Set session
    req.session.playerId = player.id

    // Emit game update event
    gameEvents.emitGameUpdate(gameId, 'join')

    res.status(201).json({
      player,
      message: 'Joined game successfully',
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/games/:gameId/auth
 * Authenticate with existing player credentials
 */
router.post('/:gameId/auth', async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)
    const { name, password } = req.body

    if (!name || !password) {
      return res.status(400).json({ error: 'Name and password required' })
    }

    const player = await playerService.authenticatePlayer(gameId, name, password)

    // Set session
    req.session.playerId = player.id

    res.json({
      player,
      message: 'Authenticated successfully',
    })
  } catch (error) {
    if (error.message === 'Invalid credentials') {
      return res.status(401).json({ error: error.message })
    }
    next(error)
  }
})

/**
 * POST /api/games/:gameId/start
 * Start the game
 */
router.post('/:gameId/start', requireAuth, loadPlayer, async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)
    // Verify player is in this game
    if (req.player.gameId !== gameId) {
      return res.status(403).json({ error: 'Not authorized for this game' })
    }

    const game = await gameService.startGame(gameId)

    // Emit game update event
    gameEvents.emitGameUpdate(gameId, 'start')

    res.json(game)
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/games/:gameId/actions
 * Submit a player action
 */
router.post('/:gameId/actions', requireAuth, loadPlayer, async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)
    const { action, amount } = req.body

    if (!action) {
      return res.status(400).json({ error: 'Action required' })
    }

    // Verify player is in this game
    if (req.player.gameId !== gameId) {
      return res.status(403).json({ error: 'Not authorized for this game' })
    }

    const gameState = await actionService.submitAction(req.player.id, action, amount || 0)

    const isShowdown = gameState.currentRound === SHOWDOWN_ROUND

    // Filter community cards based on current round
    let visibleCommunityCards = []
    if (gameState.communityCards) {
      if (gameState.currentRound === 'flop') {
        visibleCommunityCards = gameState.communityCards.slice(0, 3)
      } else if (gameState.currentRound === 'turn') {
        visibleCommunityCards = gameState.communityCards.slice(0, 4)
      } else if (gameState.currentRound === 'river' || gameState.currentRound === SHOWDOWN_ROUND) {
        visibleCommunityCards = gameState.communityCards
      }
    }

    // Return game state with only this player's hole cards visible and no deck
    const sanitizedState = {
      ...gameState,
      deck: undefined, // Never expose the deck
      communityCards: visibleCommunityCards,
      players: gameState.players.map((p) => ({
        ...p,
        holeCards: isShowdown || p.id === req.player.id ? p.holeCards : [],
      })),
    }

    // Emit game update event
    gameEvents.emitGameUpdate(gameId, 'action')

    res.json(sanitizedState)
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message || 'Invalid action' })
    }
    next(error)
  }
})

/**
 * POST /api/games/:gameId/reveal-card
 * Manually reveal the next community card (when only 1 player has chips)
 */
router.post('/:gameId/reveal-card', requireAuth, loadPlayer, async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)
    // Verify player is in this game
    if (req.player.gameId !== gameId) {
      return res.status(403).json({ error: 'Not authorized for this game' })
    }

    const gameState = await actionService.revealCard(req.player.id)

    const isShowdown = gameState.currentRound === SHOWDOWN_ROUND

    // Filter community cards based on current round
    let visibleCommunityCards = []
    if (gameState.communityCards) {
      if (gameState.currentRound === 'flop') {
        visibleCommunityCards = gameState.communityCards.slice(0, 3)
      } else if (gameState.currentRound === 'turn') {
        visibleCommunityCards = gameState.communityCards.slice(0, 4)
      } else if (gameState.currentRound === 'river' || gameState.currentRound === SHOWDOWN_ROUND) {
        visibleCommunityCards = gameState.communityCards
      }
    }

    // Return game state with only this player's hole cards visible and no deck
    const sanitizedState = {
      ...gameState,
      deck: undefined, // Never expose the deck
      communityCards: visibleCommunityCards,
      players: gameState.players.map((p) => ({
        ...p,
        holeCards: isShowdown || p.id === req.player.id ? p.holeCards : [],
      })),
    }

    // Emit game update event
    gameEvents.emitGameUpdate(gameId, 'reveal')

    res.json(sanitizedState)
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message || 'Cannot reveal card' })
    }
    next(error)
  }
})

/**
 * POST /api/games/:gameId/advance
 * Advance to next round when betting is complete (any player can trigger)
 */
router.post('/:gameId/advance', requireAuth, loadPlayer, async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)
    // Verify player is in this game
    if (req.player.gameId !== gameId) {
      return res.status(403).json({ error: 'Not authorized for this game' })
    }

    const game = await gameService.getGameById(gameId)
    if (!game) {
      return res.status(404).json({ error: 'Game not found' })
    }

    // Check if betting is complete (currentPlayerPosition should be null)
    if (game.currentPlayerPosition !== null) {
      return res.status(400).json({ error: 'Betting round not complete' })
    }

    // Advance exactly one round (not auto-advance through all)
    const nextState = await gameService.advanceOneRound(gameId)

    const isShowdown = nextState.currentRound === SHOWDOWN_ROUND

    // Filter community cards based on current round
    let visibleCommunityCards = []
    if (nextState.communityCards) {
      if (nextState.currentRound === 'flop') {
        visibleCommunityCards = nextState.communityCards.slice(0, 3)
      } else if (nextState.currentRound === 'turn') {
        visibleCommunityCards = nextState.communityCards.slice(0, 4)
      } else if (nextState.currentRound === 'river' || nextState.currentRound === SHOWDOWN_ROUND) {
        visibleCommunityCards = nextState.communityCards
      }
    }

    // Return game state with only this player's hole cards visible and no deck
    const sanitizedState = {
      ...nextState,
      deck: undefined, // Never expose the deck
      communityCards: visibleCommunityCards,
      players: nextState.players.map((p) => ({
        ...p,
        holeCards: isShowdown || p.id === req.player.id ? p.holeCards : [],
      })),
    }

    // Emit game update event
    gameEvents.emitGameUpdate(gameId, 'advance')

    res.json(sanitizedState)
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message || 'Cannot advance round' })
    }
    next(error)
  }
})

/**
 * GET /api/games/:gameId/actions/valid
 * Get valid actions for current player
 */
router.get('/:gameId/actions/valid', requireAuth, loadPlayer, async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)
    // Verify player is in this game
    if (req.player.gameId !== gameId) {
      return res.status(403).json({ error: 'Not authorized for this game' })
    }

    const actions = await actionService.getPlayerValidActions(req.player.id)

    res.json(actions)
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/games/:gameId/next-hand
 * Start the next hand (any player can trigger)
 */
router.post('/:gameId/next-hand', requireAuth, loadPlayer, async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)
    // Verify player is in this game
    if (req.player.gameId !== gameId) {
      return res.status(403).json({ error: 'Not authorized for this game' })
    }

    const game = await gameService.getGameById(gameId)
    if (!game) {
      return res.status(404).json({ error: 'Game not found' })
    }

    if (game.currentRound !== SHOWDOWN_ROUND) {
      return res.status(400).json({ error: 'Current hand not finished' })
    }

    // Allow next hand even if winners is not set (handles old game states)
    // The startNewHand function will handle resetting the state properly

    const nextState = await gameService.startNextHand(gameId)

    // Not showdown anymore: only reveal this player's hole cards
    // Filter community cards (should be empty for new hand, but be safe)
    let visibleCommunityCards = []
    if (nextState.communityCards) {
      if (nextState.currentRound === 'flop') {
        visibleCommunityCards = nextState.communityCards.slice(0, 3)
      } else if (nextState.currentRound === 'turn') {
        visibleCommunityCards = nextState.communityCards.slice(0, 4)
      } else if (nextState.currentRound === 'river' || nextState.currentRound === SHOWDOWN_ROUND) {
        visibleCommunityCards = nextState.communityCards
      }
    }

    const sanitizedState = {
      ...nextState,
      deck: undefined, // Never expose the deck
      communityCards: visibleCommunityCards,
      players: nextState.players.map((p) => ({
        ...p,
        holeCards: p.id === req.player.id ? p.holeCards : [],
      })),
    }

    // Emit game update event
    gameEvents.emitGameUpdate(gameId, 'next_hand')

    res.json(sanitizedState)
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/games/:gameId/leave
 * Leave the game
 */
router.post('/:gameId/leave', requireAuth, loadPlayer, async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)
    // Verify player is in this game
    if (req.player.gameId !== gameId) {
      return res.status(403).json({ error: 'Not authorized for this game' })
    }

    const playerGameId = req.player.gameId

    await playerService.leaveGame(req.player.id)

    // Clear session
    req.session = null

    // Emit game update event
    gameEvents.emitGameUpdate(playerGameId, 'leave')

    res.json({ message: 'Left game successfully' })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/games/:gameId/players
 * Get all players in game (public info)
 */
router.get('/:gameId/players', async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)
    const players = await playerService.getAllPlayersInGame(gameId)

    res.json(players)
  } catch (error) {
    next(error)
  }
})

module.exports = router
