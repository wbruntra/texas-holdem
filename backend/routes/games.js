import express from 'express'
import gameService from '@/services/game-service'
import * as playerService from '@/services/player-service'
import * as actionService from '@/services/action-service'
import gameEvents from '@/lib/game-events'
import { isBettingRoundComplete, shouldAutoAdvance } from '@/lib/game-state-machine'
import { calculatePots, distributePots } from '@/lib/pot-manager'
import { evaluateHand } from '@/lib/poker-engine'
import * as eventLogger from '@/services/event-logger'
import { getPlayerIdFromRequest, generateToken, requireAuth } from '@/middleware/auth'

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

async function loadPlayer(req, res, next) {
  try {
    const playerId = await getPlayerIdFromRequest(req)
    if (!playerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const player = await playerService.getPlayerById(playerId)
    if (!player) {
      if (req.session) req.session = null
      return res.status(401).json({ error: 'Player not found' })
    }
    req.player = player
    next()
  } catch (error) {
    next(error)
  }
}

router.post('/', async (req, res, next) => {
  try {
    const { smallBlind, bigBlind, startingChips } = req.body

    // Basic validation
    if (smallBlind !== undefined && (!Number.isInteger(smallBlind) || smallBlind <= 0)) {
      return res.status(400).json({ error: 'smallBlind must be a positive integer' })
    }
    if (bigBlind !== undefined && (!Number.isInteger(bigBlind) || bigBlind <= 0)) {
      return res.status(400).json({ error: 'bigBlind must be a positive integer' })
    }
    if (startingChips !== undefined && (!Number.isInteger(startingChips) || startingChips <= 0)) {
      return res.status(400).json({ error: 'startingChips must be a positive integer' })
    }
    if (smallBlind !== undefined && bigBlind !== undefined && smallBlind >= bigBlind) {
      return res.status(400).json({ error: 'smallBlind must be less than bigBlind' })
    }

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

router.get('/room/:roomCode', async (req, res, next) => {
  try {
    const game = await gameService.getGameByRoomCode(req.params.roomCode)

    if (!game) {
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
        name: p.name,
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

router.post('/:gameId/join', async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)
    const { name, password } = req.body

    if (!name || !password) {
      return res.status(400).json({ error: 'Name and password required' })
    }

    const player = await playerService.joinGame(gameId, name, password)

    if (req.session) {
      req.session.playerId = player.id
    }

    const token = generateToken(player.id, gameId)

    gameEvents.emitGameUpdate(gameId, 'join')

    res.status(201).json({
      player,
      token,
      message: 'Joined game successfully',
    })
  } catch (error) {
    next(error)
  }
})

router.post('/:gameId/auth', async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)
    const { name, password } = req.body

    if (!name || !password) {
      return res.status(400).json({ error: 'Name and password required' })
    }

    const player = await playerService.authenticatePlayer(gameId, name, password)

    if (req.session) {
      req.session.playerId = player.id
    }

    const token = generateToken(player.id, gameId)

    res.json({
      player,
      token,
      message: 'Authenticated successfully',
    })
  } catch (error) {
    if (error.message === 'Invalid credentials') {
      return res.status(401).json({ error: error.message })
    }
    next(error)
  }
})

router.post('/:gameId/start', requireAuth, loadPlayer, async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)
    if (req.player.gameId !== gameId) {
      return res.status(403).json({ error: 'Not authorized for this game' })
    }

    const game = await gameService.startGame(gameId)

    gameEvents.emitGameUpdate(gameId, 'start')

    res.json(game)
  } catch (error) {
    next(error)
  }
})

router.post('/room/:roomCode/reset', async (req, res, next) => {
  try {
    const game = await gameService.getGameByRoomCode(req.params.roomCode)

    if (!game) {
      return res.status(404).json({ error: 'Game not found' })
    }

    if (game.status !== 'completed') {
      return res.status(400).json({ error: 'Can only reset completed games' })
    }

    const resetGame = await gameService.resetGame(game.id)

    gameEvents.emitGameUpdate(game.id, 'reset')

    res.json(resetGame)
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

    if (req.player.gameId !== gameId) {
      return res.status(403).json({ error: 'Not authorized for this game' })
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
    // if (error instanceof Error) {
    //   return res.status(400).json({ error: error.message || 'Invalid action' })
    // }
    next(error)
  }
})

router.post('/:gameId/reveal-card', requireAuth, loadPlayer, async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)
    if (req.player.gameId !== gameId) {
      return res.status(403).json({ error: 'Not authorized for this game' })
    }

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
    if (req.player.gameId !== gameId) {
      return res.status(403).json({ error: 'Not authorized for this game' })
    }

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
    const gameId = parseInt(req.params.gameId, 10)
    if (req.player.gameId !== gameId) {
      return res.status(403).json({ error: 'Not authorized for this game' })
    }

    const actions = await actionService.getPlayerValidActions(req.player.id)

    res.json(actions)
  } catch (error) {
    next(error)
  }
})

router.post('/:gameId/next-hand', requireAuth, loadPlayer, async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)
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
    if (!game) {
      return res.status(404).json({ error: 'Game not found' })
    }

    if (game.currentRound !== SHOWDOWN_ROUND) {
      return res.status(400).json({ error: 'Not in showdown' })
    }

    if (req.player.gameId !== gameId) {
      return res.status(403).json({ error: 'Not authorized for this game' })
    }

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
    if (req.player.gameId !== gameId) {
      return res.status(403).json({ error: 'Not authorized for this game' })
    }

    const playerGameId = req.player.gameId

    await playerService.leaveGame(req.player.id)

    req.session = null

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
