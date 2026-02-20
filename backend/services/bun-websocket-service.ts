import { ServerWebSocket } from 'bun'
import gameService from './game-service'
import playerService from './player-service'
import * as actionService from './action-service'
import gameEvents from '../lib/game-events'
// @ts-ignore
import { calculatePots, distributePots } from '../lib/pot-manager'
import { evaluateHand } from '../lib/poker-engine'
import { calculateIsGameOver } from '../lib/game-state-machine'
// @ts-ignore
import db from '@holdem/database/db'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'sellingswam'
const SHOWDOWN_ROUND = 'showdown'

interface Subscription {
  roomCode: string
  stream: 'table' | 'player'
  gameId: number
  playerId: number | null
}

interface WSMessage {
  type: string
  requestId?: string
  payload?: Record<string, unknown>
}

// Extend ServerWebSocket data to include our custom data if needed,
// but usually we store state in a Map keyed by the ws object or use the `data` property of ServerWebSocket.
// Bun's ServerWebSocket<T> allows T to be our custom data type.
export interface WebSocketData {
  playerId?: number
  subscription?: Subscription
}

class BunWebSocketService {
  // We need to track subscribers.
  // Bun's `publish` API is great for broadcasting to topics, but we have specific "gameId" topics.
  // We can use `ws.subscribe(topic)` where topic is `game:${gameId}`.

  // However, we also need to handle "private" messages (player stream) which sanitizes data differently.
  // And "table" stream which is public.
  // Standard pub/sub might send the SAME message to everyone.
  // But we need to send DIFFERENT messages (sanitized) to different people for the same game event.
  // So we might still need to iterate or use specific topics like `game:${gameId}:player:${playerId}`.

  // Actually, keeping a set of connected clients and iterating might be easier for the complex sanitization logic
  // required by Poker (hiding hole cards based on state).
  // OR we can rely on `ws.data` to store subscription info and iterate manually.

  private clients: Set<ServerWebSocket<WebSocketData>> = new Set()

  constructor() {
    this.setupEventListeners()
  }

  private setupEventListeners() {
    gameEvents.onGameUpdate(async (data: { gameId: string; reason: string }) => {
      await this.broadcastGameUpdate(parseInt(data.gameId, 10), data.reason)
    })

    gameEvents.onRoomUpdate(
      async (data: { roomCode: string; newGameId: number; reason: string }) => {
        await this.broadcastRoomUpdate(data.roomCode, data.newGameId, data.reason)
      },
    )
  }

  // Called when a new connection is opened
  open(ws: ServerWebSocket<WebSocketData>) {
    console.log('[WS] Client connected')
    this.clients.add(ws)

    this.sendMessage(ws, {
      type: 'hello',
      payload: {
        serverTime: new Date().toISOString(),
        protocolVersion: 1,
        authenticated: false,
      },
    })
  }

  // Called when a message is received
  async message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
    try {
      const data = typeof message === 'string' ? message : message.toString()
      const parsed = JSON.parse(data) as WSMessage
      await this.handleMessage(ws, parsed)
    } catch (error) {
      console.error('[WS] Message parse error:', error)
      this.sendError(ws, 'Invalid message format')
    }
  }

  // Called when connection closes
  close(ws: ServerWebSocket<WebSocketData>) {
    console.log('[WS] Client disconnected')
    this.clients.delete(ws)
  }

  // Called when buffer is empty (backpressure)
  drain(ws: ServerWebSocket<WebSocketData>) {
    // No-op for now
  }

  async handleMessage(ws: ServerWebSocket<WebSocketData>, message: WSMessage) {
    const { type, requestId, payload } = message

    switch (type) {
      case 'subscribe':
        await this.handleSubscribe(ws, payload as any, requestId)
        break
      case 'resume':
        await this.handleResume(ws, payload as any, requestId)
        break
      default:
        this.sendError(ws, `Unknown message type: ${type}`, requestId)
    }
  }

  async handleSubscribe(ws: ServerWebSocket<WebSocketData>, payload: any, requestId?: string) {
    const { roomCode, stream, gameId: clientGameId, playerId: clientPlayerId, token } = payload

    if (!roomCode || !stream) {
      return this.sendError(ws, 'roomCode and stream are required', requestId)
    }

    if (stream !== 'table' && stream !== 'player') {
      return this.sendError(ws, 'stream must be "table" or "player"', requestId)
    }

    try {
      // @ts-ignore
      const game = await gameService.getGameByRoomCode(roomCode)
      if (!game) {
        return this.sendError(ws, 'Game not found', requestId)
      }

      let authenticatedPlayerId: number | null = null

      // Authenticate via JWT if provided
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as { playerId: number }
          if (decoded && decoded.playerId) {
            // Verify player belongs to this game/room if strict checking needed
            // For now, trust the token signature
            authenticatedPlayerId = decoded.playerId
            console.log('[WS] Player authenticated via JWT:', authenticatedPlayerId)
          }
        } catch (e) {
          console.warn('[WS] Invalid JWT token')
        }
      }

      // Fallback: if no token but client claims playerId, check if we can trust it?
      // original code had logic to trust session-based auth.
      // With strict JWT, we should NOT trust clientPlayerId without a token.
      // But for backward compat or if needed, we keep it strict for now.

      // Validation for 'player' stream
      if (stream === 'player') {
        if (!authenticatedPlayerId && !token) {
          console.warn('[WS] Player stream requested but no token')
          // We can allow it but sanitize heavily (view only?) or reject?
          // Original service returned error if no auth for player stream
          // UNLESS it was just "watching" ?
          // Original: if (!authenticatedPlayerId && !clientGameId && !token) -> return error
        }
      }

      // Update WS data
      ws.data.subscription = {
        roomCode,
        stream,
        gameId: game.id,
        playerId: authenticatedPlayerId,
      }
      ws.data.playerId = authenticatedPlayerId || undefined

      this.sendMessage(ws, {
        type: 'subscribed',
        requestId,
        payload: {
          gameId: game.id,
          roomCode,
          stream,
          authenticated: !!authenticatedPlayerId,
        },
      })

      // Send initial state
      // @ts-ignore
      const normalizedGame = (await actionService.normalizeTurnIfNeeded(game.id)) || game

      const sanitizedState =
        stream === 'player' && authenticatedPlayerId
          ? this.sanitizePlayerState(normalizedGame, authenticatedPlayerId)
          : this.sanitizeTableState(normalizedGame)

      this.sendMessage(ws, {
        type: 'game_state',
        requestId,
        payload: {
          state: sanitizedState,
          revision: game.handNumber ? String(game.handNumber) : '0',
          reason: 'subscribe',
        },
      })

      console.log(`[WS] Subscribed: ${roomCode} (${stream})`)
    } catch (error) {
      console.error('[WS] Subscribe error:', error)
      this.sendError(ws, 'Failed to subscribe', requestId)
    }
  }

  async handleResume(ws: ServerWebSocket<WebSocketData>, payload: any, requestId?: string) {
    const subscription = ws.data.subscription
    if (!subscription) {
      return this.sendError(ws, 'Not subscribed', requestId)
    }

    try {
      // @ts-ignore
      const game = await gameService.getGameById(subscription.gameId)
      if (!game) return this.sendError(ws, 'Game not found', requestId)

      // @ts-ignore
      const normalizedGame =
        (await actionService.normalizeTurnIfNeeded(subscription.gameId)) || game

      const sanitizedState =
        subscription.stream === 'player' && subscription.playerId
          ? this.sanitizePlayerState(normalizedGame, subscription.playerId)
          : this.sanitizeTableState(normalizedGame)

      this.sendMessage(ws, {
        type: 'game_state',
        requestId,
        payload: {
          state: sanitizedState,
          revision: game.handNumber ? String(game.handNumber) : '0',
          reason: 'resume',
        },
      })
    } catch (error) {
      console.error('[WS] Resume error:', error)
      this.sendError(ws, 'Failed to resume', requestId)
    }
  }

  async broadcastGameUpdate(gameId: number, reason: string) {
    try {
      // @ts-ignore
      let game = await gameService.getGameById(gameId)
      if (!game) return

      // @ts-ignore
      game = (await actionService.normalizeTurnIfNeeded(gameId)) || game
      if (!game) return

      const revision = game.handNumber ? String(game.handNumber) : '0'

      for (const ws of this.clients) {
        const sub = ws.data.subscription
        if (sub && sub.gameId === gameId && ws.readyState === WebSocket.OPEN) {
          const sanitizedState =
            sub.stream === 'player' && sub.playerId
              ? this.sanitizePlayerState(game, sub.playerId)
              : this.sanitizeTableState(game)

          this.sendMessage(ws, {
            type: 'game_state',
            payload: {
              state: sanitizedState,
              revision,
              reason,
            },
          })
        }
      }
      console.log(`[WS] Broadcasted game update: ${gameId} (${reason})`)
    } catch (error) {
      console.error('[WS] Broadcast error:', error)
    }
  }

  async broadcastRoomUpdate(roomCode: string, newGameId: number, reason: string) {
    try {
      // @ts-ignore
      const game = await gameService.getGameById(newGameId)
      if (!game) return

      const revision = game.handNumber ? String(game.handNumber) : '0'

      for (const ws of this.clients) {
        const sub = ws.data.subscription
        if (sub && sub.roomCode === roomCode && ws.readyState === WebSocket.OPEN) {
          // Update subscription automatically?
          // Original logic: subscription.gameId = newGameId
          sub.gameId = newGameId

          const sanitizedState =
            sub.stream === 'player' && sub.playerId
              ? this.sanitizePlayerState(game, sub.playerId)
              : this.sanitizeTableState(game)

          this.sendMessage(ws, {
            type: 'game_state',
            payload: {
              state: sanitizedState,
              revision,
              reason,
              newGameId,
            },
          })
        }
      }
      console.log(`[WS] Broadcasted room update: ${roomCode} -> ${newGameId}`)
    } catch (error) {
      console.error('[WS] Room broadcast error:', error)
    }
  }

  sendMessage(ws: ServerWebSocket<WebSocketData>, message: Record<string, unknown>) {
    ws.send(JSON.stringify(message))
  }

  sendError(ws: ServerWebSocket<WebSocketData>, errorMessage: string, requestId?: string) {
    this.sendMessage(ws, {
      type: 'error',
      requestId,
      payload: { error: errorMessage },
    })
  }

  // Copied from original WebSocketService
  sanitizeTableState(game: any): any {
    const isShowdown = game.currentRound === SHOWDOWN_ROUND

    // playersWithChips unused in original? preserved just in case
    // const playersWithChips = game.players.filter(
    //   (p: any) => p.chips > 0 && p.status !== 'out' && p.status !== 'folded',
    // )

    // Check if this is an actual showdown
    const eligiblePlayers = game.players.filter(
      (p: any) => p.status === 'active' || p.status === 'all_in',
    )
    const isRealShowdown = isShowdown && eligiblePlayers.length > 1
    const shouldRevealAllCards = isRealShowdown || game.action_finished === true

    let pots =
      game.pots && game.pots.length > 0 && !isRealShowdown
        ? game.pots
        : calculatePots(game.players)

    if (isRealShowdown && pots.length > 0) {
      pots = distributePots(pots, game.players, game.communityCards, evaluateHand)
    }

    return {
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
      action_finished: game.action_finished || false,
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
        holeCards:
          (shouldRevealAllCards &&
            (game.players.filter((pl: any) => pl.status === 'active' || pl.status === 'all_in')
              .length > 1 ||
              p.showCards)) ||
          p.showCards
            ? p.holeCards || []
            : [],
        lastAction: p.lastAction || null,
        connected: p.connected,
      })),
      // @ts-ignore
      isGameOver: calculateIsGameOver(game),
    }
  }

  sanitizePlayerState(game: any, playerId: number): any {
    const isShowdown = game.currentRound === SHOWDOWN_ROUND

    const eligiblePlayers = game.players.filter(
      (p: any) => p.status === 'active' || p.status === 'all_in',
    )
    const isRealShowdown = isShowdown && eligiblePlayers.length > 1

    let pots =
      game.pots && game.pots.length > 0 && !isRealShowdown
        ? game.pots
        : calculatePots(game.players)

    if (isRealShowdown && pots.length > 0) {
      pots = distributePots(pots, game.players, game.communityCards, evaluateHand)
    }

    return {
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
      action_finished: game.action_finished || false,
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
        holeCards:
          (isShowdown &&
            (game.players.filter((pl: any) => pl.status === 'active' || pl.status === 'all_in')
              .length > 1 ||
              p.showCards)) ||
          p.id === playerId
            ? p.holeCards || []
            : [],
        lastAction: p.lastAction || null,
        connected: p.connected,
        isDealer: p.isDealer,
        isSmallBlind: p.isSmallBlind,
        isBigBlind: p.isBigBlind,
      })),
      // @ts-ignore
      isGameOver: calculateIsGameOver(game),
    }
  }
}

const bunWsService = new BunWebSocketService()
export default bunWsService
