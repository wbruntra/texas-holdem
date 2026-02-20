import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import gameService from '../services/game-service'
import * as playerService from '../services/player-service'
import * as actionService from '../services/action-service'
import gameEvents from '../lib/game-events'
// @ts-ignore
import { isBettingRoundComplete, shouldAutoAdvance } from '../lib/game-state-machine'
// @ts-ignore
import { calculatePots, distributePots } from '../lib/pot-manager'
import { evaluateHand } from '../lib/poker-engine'
import * as eventLogger from '../services/event-logger'
import { requireAuth } from '../middleware/auth-hono'
import { appendEvent } from '../services/event-store'
import { EVENT_TYPES as EVENT_TYPES_V2 } from '@holdem/shared'

const SHOWDOWN_ROUND = 'showdown'

type Variables = {
  player: any // RoomPlayer
  gamePlayer: any // GamePlayer (full context)
}

const app = new Hono<{ Variables: Variables }>()

function shouldRevealAllCards(game: any) {
  if (game.currentRound === SHOWDOWN_ROUND) {
    return true
  }

  const playersWithChips = game.players.filter(
    (p: any) => p.chips > 0 && p.status !== 'out' && p.status !== 'folded',
  )
  const allInPlayers = game.players.filter((p: any) => p.status === 'all_in')

  return playersWithChips.length === 1 && allInPlayers.length > 0
}

// Middleware to load game-specific player context
const loadPlayer = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  try {
    const roomPlayer = c.get('player')
    if (!roomPlayer) {
      return c.json({ error: 'Not authenticated' }, 401)
    }

    const gameIdStr = c.req.param('gameId')
    if (!gameIdStr) {
      return next()
    }

    const gameId = parseInt(gameIdStr, 10)
    if (isNaN(gameId)) {
      return next()
    }

    // @ts-ignore
    const player = await gameService.getGamePlayer(gameId, roomPlayer.id)
    if (!player) {
      return c.json({ error: 'Not joined this game' }, 403)
    }

    // Get full player object using room_player_id
    // @ts-ignore
    const fullPlayer = await playerService.getPlayerById(roomPlayer.id, gameId)

    c.set('gamePlayer', fullPlayer)
    await next()
  } catch (error) {
    throw error
  }
})

// Routes

app.get('/room/:roomCode', async (c) => {
  // @ts-ignore
  const game = await gameService.getGameByRoomCode(c.req.param('roomCode'))

  if (!game) {
    return c.json({ error: 'Game not found' }, 404)
  }

  const publicGame = {
    id: game.id,
    roomCode: game.roomCode,
    status: game.status,
    smallBlind: game.smallBlind,
    bigBlind: game.bigBlind,
    startingChips: game.startingChips,
    players: game.players.map((p: any) => ({
      name: p.name,
      position: p.position,
      chips: p.chips,
      connected: p.connected,
    })),
  }

  return c.json(publicGame)
})

app.get('/room/:roomCode/state', async (c) => {
  // @ts-ignore
  let game = await gameService.getGameByRoomCode(c.req.param('roomCode'))

  if (!game) {
    return c.json({ error: 'Game not found' }, 404)
  }

  // @ts-ignore
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
    players: game.players.map((p: any) => ({
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

  return c.json(tableState)
})

app.get('/:gameId', requireAuth, loadPlayer, async (c) => {
  const gameId = parseInt(c.req.param('gameId'), 10)
  // @ts-ignore
  let game = await gameService.getGameById(gameId)

  if (!game) {
    return c.json({ error: 'Game not found' }, 404)
  }

  const gamePlayer = c.get('gamePlayer')

  if (gamePlayer.gameId !== game.id) {
    return c.json({ error: 'Not authorized for this game' }, 403)
  }

  // @ts-ignore
  game = (await actionService.normalizeTurnIfNeeded(game.id)) || game

  const isShowdown = game.currentRound === SHOWDOWN_ROUND

  let pots = calculatePots(game.players)

  if (isShowdown && pots.length > 0) {
    pots = distributePots(pots, game.players, game.communityCards, evaluateHand)
  }

  let visibleCommunityCards: any[] = []
  if (game.communityCards) {
    if (game.currentRound === 'flop') {
      visibleCommunityCards = game.communityCards.slice(0, 3)
    } else if (game.currentRound === 'turn') {
      visibleCommunityCards = game.communityCards.slice(0, 4)
    } else if (game.currentRound === 'river' || game.currentRound === SHOWDOWN_ROUND) {
      visibleCommunityCards = game.communityCards
    }
  }

  const currentPlayerId = gamePlayer.id
  const revealCards = shouldRevealAllCards(game)
  const gameState = {
    ...game,
    seed: undefined,
    pots: pots,
    deck: undefined,
    communityCards: visibleCommunityCards,
    players: game.players.map((p: any) => ({
      ...p,
      holeCards: revealCards || p.showCards || p.id === currentPlayerId ? p.holeCards : [],
    })),
  }

  return c.json(gameState)
})

app.post('/:gameId/join', requireAuth, async (c) => {
  const gameId = parseInt(c.req.param('gameId'), 10)
  const roomPlayer = c.get('player')

  // @ts-ignore
  const result = await playerService.joinGame(gameId, roomPlayer.id)

  gameEvents.emitGameUpdate(gameId.toString(), 'join')

  return c.json(
    {
      player: result,
      message: 'Joined game successfully',
    },
    201,
  )
})

app.post('/:gameId/start', requireAuth, loadPlayer, async (c) => {
  const gameId = parseInt(c.req.param('gameId'), 10)

  // @ts-ignore
  const game = await gameService.startGame(gameId)

  gameEvents.emitGameUpdate(gameId.toString(), 'start')

  return c.json(game)
})

app.post('/room/:roomCode/new-game', async (c) => {
  // @ts-ignore
  const game = await gameService.getGameByRoomCode(c.req.param('roomCode'))

  if (!game) {
    return c.json({ error: 'Active game not found' }, 404)
  }

  const roomId = game.roomId

  // @ts-ignore
  const newGame = await gameService.startNewGame(roomId)

  gameEvents.emitRoomUpdate(c.req.param('roomCode'), newGame.id, 'new_game')

  return c.json(newGame)
})

app.post('/room/:roomCode/reset', async (c) => {
  //Legacy alias
  // @ts-ignore
  const game = await gameService.getGameByRoomCode(c.req.param('roomCode'))
  if (!game) return c.json({ error: 'Game not found' }, 404)

  // @ts-ignore
  const newGame = await gameService.startNewGame(game.roomId)
  gameEvents.emitRoomUpdate(c.req.param('roomCode'), newGame.id, 'new_game')
  return c.json(newGame)
})

app.post('/:gameId/actions', requireAuth, loadPlayer, async (c) => {
  const gameId = parseInt(c.req.param('gameId'), 10)
  const { action, amount } = await c.req.json()

  if (!action) {
    return c.json({ error: 'Action required' }, 400)
  }

  const gamePlayer = c.get('gamePlayer')

  // @ts-ignore
  const gameState = await actionService.submitAction(gamePlayer.id, gameId, action, amount || 0)

  const revealCards = shouldRevealAllCards(gameState)

  let visibleCommunityCards: any[] = []
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
    players: gameState.players.map((p: any) => ({
      ...p,
      holeCards: revealCards || p.showCards || p.id === gamePlayer.id ? p.holeCards : [],
    })),
  }

  gameEvents.emitGameUpdate(gameId.toString(), 'action')

  return c.json(sanitizedState)
})

app.post('/:gameId/reveal-card', requireAuth, loadPlayer, async (c) => {
  try {
    const gameId = parseInt(c.req.param('gameId'), 10)
    const gamePlayer = c.get('gamePlayer')

    // @ts-ignore
    const gameState = await actionService.revealCard(gamePlayer.id, gameId)

    const revealCards = shouldRevealAllCards(gameState)

    let visibleCommunityCards: any[] = []
    // ... (same logic for cards)
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
      players: gameState.players.map((p: any) => ({
        ...p,
        holeCards: revealCards || p.showCards || p.id === gamePlayer.id ? p.holeCards : [],
      })),
    }

    gameEvents.emitGameUpdate(gameId.toString(), 'reveal')

    return c.json(sanitizedState)
  } catch (error: any) {
    return c.json({ error: error.message || 'Cannot reveal card' }, 400)
  }
})

app.post('/:gameId/advance', requireAuth, loadPlayer, async (c) => {
  try {
    const gameId = parseInt(c.req.param('gameId'), 10)
    const gamePlayer = c.get('gamePlayer')

    // @ts-ignore
    const game = await gameService.getGameById(gameId)
    if (!game) {
      return c.json({ error: 'Game not found' }, 404)
    }

    if (!isBettingRoundComplete(game) && !shouldAutoAdvance(game) && !game.action_finished) {
      return c.json({ error: 'Betting round not complete' }, 400)
    }

    // @ts-ignore
    const nextState = await gameService.advanceOneRound(gameId)

    const revealCards = shouldRevealAllCards(nextState)

    let visibleCommunityCards: any[] = []
    if (nextState.communityCards) {
      // ... same logic
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
      players: nextState.players.map((p: any) => ({
        ...p,
        holeCards: revealCards || p.showCards || p.id === gamePlayer.id ? p.holeCards : [],
      })),
    }

    const reason = nextState.action_finished ? 'advance_all_in' : 'advance'
    gameEvents.emitGameUpdate(gameId.toString(), reason)

    if (reason === 'advance_all_in') {
      await appendEvent(
        gameId,
        nextState.handNumber,
        EVENT_TYPES_V2.ADVANCE_ROUND,
        gamePlayer.id,
        {
          fromRound: game.currentRound,
          toRound: nextState.currentRound,
          newCommunityCards: nextState.communityCards.slice(game.communityCards.length),
        },
      )
    }

    return c.json(sanitizedState)
  } catch (error: any) {
    return c.json({ error: error.message || 'Cannot advance round' }, 400)
  }
})

app.get('/:gameId/actions/valid', requireAuth, loadPlayer, async (c) => {
  const gameId = parseInt(c.req.param('gameId'), 10)
  const gamePlayer = c.get('gamePlayer')

  // @ts-ignore
  const actions = await actionService.getPlayerValidActions(gamePlayer.id, gameId)
  return c.json(actions)
})

app.post('/:gameId/next-hand', requireAuth, loadPlayer, async (c) => {
  const gameId = parseInt(c.req.param('gameId'), 10)
  const gamePlayer = c.get('gamePlayer')

  // @ts-ignore
  const game = await gameService.getGameById(gameId)
  if (!game) return c.json({ error: 'Game not found' }, 404)

  if (game.currentRound !== SHOWDOWN_ROUND) {
    return c.json({ error: 'Current hand not finished' }, 400)
  }

  // @ts-ignore
  const nextState = await gameService.startNextHand(gameId)

  let visibleCommunityCards: any[] = []
  if (nextState.communityCards) {
    // ...
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
    players: nextState.players.map((p: any) => ({
      ...p,
      holeCards: p.id === gamePlayer.id ? p.holeCards : [],
    })),
  }

  gameEvents.emitGameUpdate(gameId.toString(), 'next_hand')

  return c.json(sanitizedState)
})

app.post('/:gameId/show-cards', requireAuth, loadPlayer, async (c) => {
  const gameId = parseInt(c.req.param('gameId'), 10)
  const { showCards } = await c.req.json()

  // @ts-ignore
  const game = await gameService.getGameById(gameId)
  if (!game) return c.json({ error: 'Game not found' }, 404)
  if (game.currentRound !== SHOWDOWN_ROUND) return c.json({ error: 'Not in showdown' }, 400)

  const gamePlayer = c.get('gamePlayer')

  // @ts-ignore
  await playerService.setShowCards(gamePlayer.id, gameId, showCards)

  gameEvents.emitGameUpdate(gameId.toString(), 'show_cards')

  return c.json({ success: true, showCards })
})

app.post('/:gameId/leave', requireAuth, loadPlayer, async (c) => {
  const gameId = parseInt(c.req.param('gameId'), 10)
  const gamePlayer = c.get('gamePlayer')

  // @ts-ignore
  await playerService.leaveGame(gamePlayer.id, gamePlayer.gameId)

  gameEvents.emitGameUpdate(gamePlayer.gameId.toString(), 'leave')

  return c.json({ message: 'Left game successfully' })
})

app.get('/:gameId/players', async (c) => {
  const gameId = parseInt(c.req.param('gameId'), 10)
  // @ts-ignore
  const players = await playerService.getAllPlayersInGame(gameId)
  return c.json(players)
})

app.get('/events/all', (c) => {
  const events = eventLogger.getEvents()
  return c.json({
    enabled: eventLogger.enabled,
    count: events.length,
    events,
  })
})

app.get('/events/game/:gameId', (c) => {
  const gameId = parseInt(c.req.param('gameId'), 10)
  const events = eventLogger.getGameEvents(gameId)
  return c.json({
    gameId,
    count: events.length,
    events,
  })
})

app.delete('/events/all', (c) => {
  eventLogger.clear()
  return c.json({ message: 'Event log cleared' })
})

app.post('/events/export', async (c) => {
  const { filename } = await c.req.json()
  const filePath = filename || `event-log-${Date.now()}.json`
  const success = eventLogger.exportToFile(filePath)

  if (success) {
    return c.json({ message: 'Events exported', filePath })
  } else {
    return c.json({ error: 'Failed to export events' }, 500)
  }
})

export default app
