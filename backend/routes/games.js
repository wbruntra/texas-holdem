import express from 'express'
import gameService from '@/services/game-service'
import * as playerService from '@/services/player-service'
import * as actionService from '@/services/action-service'
import gameEvents from '@/lib/game-events'
import { isBettingRoundComplete, shouldAutoAdvance } from '@/lib/game-state-machine'
import { calculatePots, distributePots } from '@/lib/pot-manager'
import { evaluateHand } from '@/lib/poker-engine'
import * as eventLogger from '@/services/event-logger'
import { requireAuth } from '@/middleware/auth'
import { appendEvent } from '@/services/event-store'
import { EVENT_TYPES as EVENT_TYPES_V2 } from '@holdem/shared'

const router = express.Router()

const SHOWDOWN_ROUND = 'showdown'

function shouldRevealAllCards(game) {
  if (game.currentRound === SHOWDOWN_ROUND) {
    return true
  }

  const playersWithChips = game.players.filter(
    (p) => p.chips > 0 && p.status !== 'out' && p.status !== 'folded',
  )
  const allInPlayers = game.players.filter((p) => p.status === 'all_in')

  return playersWithChips.length === 1 && allInPlayers.length > 0
}

// Middleware to load game-specific player context
async function loadPlayer(req, res, next) {
  try {
    // req.roomPlayer is set by requireAuth
    if (!req.roomPlayer) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const gameId = parseInt(req.params.gameId, 10)
    if (isNaN(gameId)) {
      // If route doesn't have gameId, skip (or error if strictly for game specific routes)
      return next()
    }

    const player = await gameService.getGamePlayer(gameId, req.roomPlayer.id)
    if (!player) {
      return res.status(403).json({ error: 'Not joined this game' })
    }

    // Enrich player with room player name for convenience if needed,
    // but playerService.getPlayerById does that.
    // Let's get full player object.
    const fullPlayer = await playerService.getPlayerById(player.id)

    req.player = fullPlayer
    next()
  } catch (error) {
    next(error)
  }
}

// No create game route here, handled by Rooms

router.get('/room/:roomCode', async (req, res, next) => {
  try {
    const game = await gameService.getGameByRoomCode(req.params.roomCode)

    if (!game) {
      // It's possible room exists but no game? Room service creates one.
      return res.status(404).json({ error: 'Game not found' })
    }

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

// Get active game state for room
router.get('/room/:roomCode/state', async (req, res, next) => {
  try {
    let game = await gameService.getGameByRoomCode(req.params.roomCode)

    if (!game) {
      return res.status(404).json({ error: 'Game not found' })
    }

    game = (await actionService.normalizeTurnIfNeeded(game.id)) || game

    const revealCards = shouldRevealAllCards(game)

    let pots = calculatePots(game.players)

    const isShowdown = game.currentRound === SHOWDOWN_ROUND
    if (isShowdown && pots.length > 0) {
      pots = distributePots(pots, game.players, game.communityCards, evaluateHand)
    }

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
      pots: pots,
      currentBet: game.currentBet,
      currentPlayerPosition: game.currentPlayerPosition,
      handNumber: game.handNumber,
      communityCards: game.communityCards || [],
      winners: game.winners || undefined,
      players: game.players.map((p) => ({
        id: p.id,
        name: p.name, // Derived from room_players
        position: p.position,
        chips: p.chips,
        currentBet: p.currentBet,
        totalBet: p.totalBet || 0,
        status: p.status,
        holeCards: revealCards || p.showCards ? p.holeCards || [] : [],
        lastAction: p.lastAction || null,
        connected: p.connected,
      })),
    }

    res.json(tableState)
  } catch (error) {
    next(error)
  }
})

// Get specific game state (authenticated)
router.get('/:gameId', requireAuth, loadPlayer, async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)
    let game = await gameService.getGameById(gameId)

    if (!game) {
      return res.status(404).json({ error: 'Game not found' })
    }

    if (req.player.gameId !== game.id) {
      return res.status(403).json({ error: 'Not authorized for this game' })
    }

    game = (await actionService.normalizeTurnIfNeeded(game.id)) || game

    const isShowdown = game.currentRound === SHOWDOWN_ROUND

    let pots = calculatePots(game.players)

    if (isShowdown && pots.length > 0) {
      pots = distributePots(pots, game.players, game.communityCards, evaluateHand)
    }

    let visibleCommunityCards = []
    if (game.communityCards) {
      if (game.currentRound === 'flop') {
        visibleCommunityCards = game.communityCards.slice(0, 3)
      } else if (game.currentRound === 'turn') {
        visibleCommunityCards = game.communityCards.slice(0, 4)
      } else if (game.currentRound === 'river' || game.currentRound === SHOWDOWN_ROUND) {
        visibleCommunityCards = game.communityCards
      }
    }

    const currentPlayerId = req.player.id
    const revealCards = shouldRevealAllCards(game)
    const gameState = {
      ...game,
      seed: undefined, // Ensure seed is never sent to client
      pots: pots,
      deck: undefined,
      communityCards: visibleCommunityCards,
      players: game.players.map((p) => ({
        ...p,
        holeCards: revealCards || p.showCards || p.id === currentPlayerId ? p.holeCards : [],
      })),
    }

    res.json(gameState)
  } catch (error) {
    next(error)
  }
})

// Join game (Sit at table)
router.post('/:gameId/join', requireAuth, async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)
    // req.roomPlayer is set by requireAuth

    // Call playerService using roomPlayer.id
    const result = await playerService.joinGame(gameId, req.roomPlayer.id)

    gameEvents.emitGameUpdate(gameId, 'join')

    res.status(201).json({
      player: result,
      message: 'Joined game successfully',
    })
  } catch (error) {
    next(error)
  }
})

// Remove auth route, handled by Rooms

router.post('/:gameId/start', requireAuth, loadPlayer, async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)
    // Only verify authorization via loadPlayer

    const game = await gameService.startGame(gameId)

    gameEvents.emitGameUpdate(gameId, 'start')

    res.json(game)
  } catch (error) {
    next(error)
  }
})

// Start NEW game (Reset replacement)
router.post('/room/:roomCode/new-game', async (req, res, next) => {
  try {
    const game = await gameService.getGameByRoomCode(req.params.roomCode)

    if (!game) {
      return res.status(404).json({ error: 'Active game not found (needed for room lookup)' })
      // Or use roomService.getRoomByCode to get ID.
    }

    // We need roomId. Game object has it.
    const roomId = game.roomId

    // We can call startNewGame
    // Logic: check if current game is completed? Or force it?
    // User wants "Reset Game" -> "New Game".
    // If game is in progress, it should probably be stopped?
    // startNewGame logic in game-service marks old game completed.

    const newGame = await gameService.startNewGame(roomId)

    // Emit room update to notify all clients in the room about the new game
    gameEvents.emitRoomUpdate(req.params.roomCode, newGame.id, 'new_game')

    res.json(newGame)
  } catch (error) {
    next(error)
  }
})

// Keep legacy reset route for now, maps to new game
router.post('/room/:roomCode/reset', async (req, res, next) => {
  try {
    const game = await gameService.getGameByRoomCode(req.params.roomCode)
    if (!game) return res.status(404).json({ error: 'Game not found' })

    const newGame = await gameService.startNewGame(game.roomId)
    gameEvents.emitRoomUpdate(req.params.roomCode, newGame.id, 'new_game')
    res.json(newGame)
  } catch (error) {
    next(error)
  }
})

router.post('/:gameId/actions', requireAuth, loadPlayer, async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)
    const { action, amount } = req.body

    if (!action) {
      return res.status(400).json({ error: 'Action required' })
    }

    const gameState = await actionService.submitAction(req.player.id, action, amount || 0)

    const revealCards = shouldRevealAllCards(gameState)

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

    const sanitizedState = {
      ...gameState,
      deck: undefined,
      communityCards: visibleCommunityCards,
      players: gameState.players.map((p) => ({
        ...p,
        holeCards: revealCards || p.showCards || p.id === req.player.id ? p.holeCards : [],
      })),
    }

    gameEvents.emitGameUpdate(gameId, 'action')

    res.json(sanitizedState)
  } catch (error) {
    next(error)
  }
})

router.post('/:gameId/reveal-card', requireAuth, loadPlayer, async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)
    const gameState = await actionService.revealCard(req.player.id)

    const revealCards = shouldRevealAllCards(gameState)

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

    const sanitizedState = {
      ...gameState,
      deck: undefined,
      communityCards: visibleCommunityCards,
      players: gameState.players.map((p) => ({
        ...p,
        holeCards: revealCards || p.showCards || p.id === req.player.id ? p.holeCards : [],
      })),
    }

    gameEvents.emitGameUpdate(gameId, 'reveal')

    res.json(sanitizedState)
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message || 'Cannot reveal card' })
    }
    next(error)
  }
})

router.post('/:gameId/advance', requireAuth, loadPlayer, async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)

    const game = await gameService.getGameById(gameId)
    if (!game) {
      return res.status(404).json({ error: 'Game not found' })
    }

    if (!isBettingRoundComplete(game) && !shouldAutoAdvance(game) && !game.action_finished) {
      return res.status(400).json({ error: 'Betting round not complete' })
    }

    const nextState = await gameService.advanceOneRound(gameId)

    const revealCards = shouldRevealAllCards(nextState)

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
      deck: undefined,
      communityCards: visibleCommunityCards,
      players: nextState.players.map((p) => ({
        ...p,
        holeCards: revealCards || p.showCards || p.id === req.player.id ? p.holeCards : [],
      })),
    }

    const reason = nextState.action_finished ? 'advance_all_in' : 'advance'
    gameEvents.emitGameUpdate(gameId, reason)

    // RECORD V2 EVENT (MANUAL ADVANCE)
    if (reason === 'advance_all_in') {
      await appendEvent(
        gameId,
        nextState.handNumber,
        EVENT_TYPES_V2.ADVANCE_ROUND,
        req.player.id,
        {
          fromRound: game.currentRound,
          toRound: nextState.currentRound,
          newCommunityCards: nextState.communityCards.slice(game.communityCards.length),
        },
      )
    }

    res.json(sanitizedState)
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message || 'Cannot advance round' })
    }
    next(error)
  }
})

router.get('/:gameId/actions/valid', requireAuth, loadPlayer, async (req, res, next) => {
  try {
    const actions = await actionService.getPlayerValidActions(req.player.id)
    res.json(actions)
  } catch (error) {
    next(error)
  }
})

router.post('/:gameId/next-hand', requireAuth, loadPlayer, async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)
    const game = await gameService.getGameById(gameId)
    if (!game) {
      return res.status(404).json({ error: 'Game not found' })
    }

    if (game.currentRound !== SHOWDOWN_ROUND) {
      return res.status(400).json({ error: 'Current hand not finished' })
    }

    const nextState = await gameService.startNextHand(gameId)

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
      deck: undefined,
      communityCards: visibleCommunityCards,
      players: nextState.players.map((p) => ({
        ...p,
        holeCards: p.id === req.player.id ? p.holeCards : [],
      })),
    }

    gameEvents.emitGameUpdate(gameId, 'next_hand')

    res.json(sanitizedState)
  } catch (error) {
    next(error)
  }
})

router.post('/:gameId/show-cards', requireAuth, loadPlayer, async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)
    const { showCards } = req.body

    const game = await gameService.getGameById(gameId)
    if (!game) return res.status(404).json({ error: 'Game not found' })
    if (game.currentRound !== SHOWDOWN_ROUND)
      return res.status(400).json({ error: 'Not in showdown' })

    await playerService.setShowCards(req.player.id, showCards)

    gameEvents.emitGameUpdate(gameId, 'show_cards')

    res.json({ success: true, showCards })
  } catch (error) {
    next(error)
  }
})

router.post('/:gameId/leave', requireAuth, loadPlayer, async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)
    const playerGameId = req.player.gameId

    await playerService.leaveGame(req.player.id)

    // Note: Session management is different now, handled by client token

    gameEvents.emitGameUpdate(playerGameId, 'leave')

    res.json({ message: 'Left game successfully' })
  } catch (error) {
    next(error)
  }
})

router.get('/:gameId/players', async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)
    const players = await playerService.getAllPlayersInGame(gameId)
    res.json(players)
  } catch (error) {
    next(error)
  }
})

router.get('/events/all', async (req, res, next) => {
  try {
    const events = eventLogger.getEvents()
    res.json({
      enabled: eventLogger.enabled,
      count: events.length,
      events,
    })
  } catch (error) {
    next(error)
  }
})

router.get('/events/game/:gameId', async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)
    const events = eventLogger.getGameEvents(gameId)
    res.json({
      gameId,
      count: events.length,
      events,
    })
  } catch (error) {
    next(error)
  }
})

router.delete('/events/all', async (req, res, next) => {
  try {
    eventLogger.clear()
    res.json({ message: 'Event log cleared' })
  } catch (error) {
    next(error)
  }
})

router.post('/events/export', async (req, res, next) => {
  try {
    const { filename } = req.body
    const filePath = filename || `event-log-${Date.now()}.json`
    const success = eventLogger.exportToFile(filePath)

    if (success) {
      res.json({ message: 'Events exported', filePath })
    } else {
      res.status(500).json({ error: 'Failed to export events' })
    }
  } catch (error) {
    next(error)
  }
})

export default router
