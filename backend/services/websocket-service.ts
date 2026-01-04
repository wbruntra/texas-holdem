// @ts-ignore
import WebSocket from 'ws'
// @ts-ignore
import Keygrip from 'keygrip'
// @ts-ignore
import gameService from '@/services/game-service'
// @ts-ignore
import playerService from '@/services/player-service'
// @ts-ignore
import actionService from '@/services/action-service'
import gameEvents from '@/lib/game-events'
import { calculatePots, distributePots } from '@/lib/pot-manager'
import { evaluateHand } from '@/lib/poker-engine'
// @ts-ignore
import { verifyToken } from '@/middleware/auth'

const SHOWDOWN_ROUND = 'showdown'

const SESSION_KEYS = ['hackedescape']
const keygrip = new Keygrip(SESSION_KEYS)

interface Subscription {
  roomCode: string
  stream: string
  gameId: number
  playerId: number | null
}

interface WSMessage {
  type: string
  requestId?: string
  payload?: Record<string, unknown>
}

class WebSocketService {
  private wss: WebSocket.Server | null = null
  private subscriptions: Map<WebSocket, Subscription> = new Map()

  /**
   * Initialize WebSocket server
   */
  initialize(server: any): void {
    this.wss = new WebSocket.Server({
      server,
      path: '/ws',
    })

    this.wss.on('connection', (ws: WebSocket, req: any) => {
      console.log('[WS] Client connected')

      const session = this.parseSession(req)
      let playerId: number | null = null
      if (session && session.playerId) {
        playerId = session.playerId
      }

      ;(ws as any).playerId = playerId

      if (playerId) {
        console.log('[WS] Authenticated connection:', playerId)
      } else {
        console.log('[WS] Unauthenticated connection')
      }

      this.sendMessage(ws, {
        type: 'hello',
        payload: {
          serverTime: new Date().toISOString(),
          protocolVersion: 1,
          authenticated: !!playerId,
        },
      })

      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as WSMessage
          await this.handleMessage(ws, message)
        } catch (error) {
          console.error('[WS] Message parse error:', error)
          this.sendError(ws, 'Invalid message format')
        }
      })

      ws.on('close', () => {
        console.log('[WS] Client disconnected')
        this.subscriptions.delete(ws)
      })

      ws.on('error', (error: Error) => {
        console.error('[WS] WebSocket error:', error)
      })
    })

    gameEvents.onGameUpdate(async (data: { gameId: string; reason: string }) => {
      await this.broadcastGameUpdate(parseInt(data.gameId, 10), data.reason)
    })

    console.log('[WS] WebSocket server initialized on /ws')
  }

  /**
   * Handle incoming WebSocket messages
   */
  async handleMessage(ws: WebSocket, message: WSMessage): Promise<void> {
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

  /**
   * Handle subscription requests
   */
  async handleSubscribe(ws: WebSocket, payload: any, requestId?: string): Promise<void> {
    const {
      roomCode,
      stream,
      gameId: clientGameId,
      playerId: clientPlayerIdFromPayload,
      token,
    } = payload

    if (!roomCode || !stream) {
      return this.sendError(ws, 'roomCode and stream are required', requestId)
    }

    if (stream !== 'table' && stream !== 'player') {
      return this.sendError(ws, 'stream must be "table" or "player"', requestId)
    }

    try {
      const game = await gameService.getGameByRoomCode(roomCode)

      if (!game) {
        return this.sendError(ws, 'Game not found', requestId)
      }

      let authenticatedPlayerId: number | null = null

      if (stream === 'player') {
        if (token) {
          const decoded = verifyToken(token)
          if (decoded && decoded.playerId) {
            const player = await playerService.getPlayerById(decoded.playerId)
            if (player && player.gameId === game.id) {
              authenticatedPlayerId = player.id
              console.log('[WS] Player authenticated via JWT:', authenticatedPlayerId)
            } else {
              console.warn('[WS] JWT player not found or wrong game:', decoded.playerId)
            }
          } else {
            console.warn('[WS] Invalid JWT token provided')
          }
        }

        if (!authenticatedPlayerId && (ws as any).playerId) {
          const player = await playerService.getPlayerById((ws as any).playerId)

          if (player && player.gameId === game.id) {
            authenticatedPlayerId = player.id
            console.log('[WS] Player authenticated via session:', authenticatedPlayerId)
          }
        }

        if (!authenticatedPlayerId && clientPlayerIdFromPayload) {
          const player = await playerService.getPlayerById(clientPlayerIdFromPayload)

          if (player && player.gameId === game.id) {
            authenticatedPlayerId = player.id
            console.log('[WS] Player authenticated via playerId:', authenticatedPlayerId)
          } else {
            console.warn('[WS] Invalid playerId provided:', clientPlayerIdFromPayload)
          }
        }

        if (!authenticatedPlayerId && clientGameId && clientGameId === game.id) {
          console.warn('[WS] Player stream requested but no auth - using table view sanitization')
        } else if (!authenticatedPlayerId && !clientGameId && !token) {
          return this.sendError(ws, 'Authentication required for player stream', requestId)
        }
      }

      this.subscriptions.set(ws, {
        roomCode,
        stream,
        gameId: game.id,
        playerId: authenticatedPlayerId,
      })

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

      console.log(
        `[WS] Client subscribed to ${stream} stream: ${roomCode}${authenticatedPlayerId ? ` (player: ${authenticatedPlayerId})` : ''}`,
      )
    } catch (error) {
      console.error('[WS] Subscribe error:', error)
      this.sendError(ws, 'Failed to subscribe', requestId)
    }
  }

  /**
   * Handle resume requests for existing subscriptions
   */
  async handleResume(ws: WebSocket, payload: any, requestId?: string): Promise<void> {
    const subscription = this.subscriptions.get(ws)

    if (!subscription) {
      return this.sendError(ws, 'Not subscribed', requestId)
    }

    try {
      const game = await gameService.getGameById(subscription.gameId)

      if (!game) {
        return this.sendError(ws, 'Game not found', requestId)
      }

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

      console.log(`[WS] Client resumed: ${subscription.roomCode}`)
    } catch (error) {
      console.error('[WS] Resume error:', error)
      this.sendError(ws, 'Failed to resume', requestId)
    }
  }

  /**
   * Broadcast game update to all subscribers
   */
  async broadcastGameUpdate(gameId: number, reason: string): Promise<void> {
    try {
      let game = await gameService.getGameById(gameId)

      if (!game) {
        console.warn(`[WS] Game not found for broadcast: ${gameId}`)
        return
      }

      game = (await actionService.normalizeTurnIfNeeded(gameId)) || game

      if (!game) return

      const revision = game.handNumber ? String(game.handNumber) : '0'

      for (const [ws, subscription] of this.subscriptions.entries()) {
        if (subscription.gameId === gameId && ws.readyState === WebSocket.OPEN) {
          const sanitizedState =
            subscription.stream === 'player' && subscription.playerId
              ? this.sanitizePlayerState(game, subscription.playerId)
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

      console.log(`[WS] Broadcasted game update: ${game.roomCode} (${reason})`)
    } catch (error) {
      console.error('[WS] Broadcast error:', error)
    }
  }

  /**
   * Sanitize game state for table view (hides hole cards)
   */
  sanitizeTableState(game: any): any {
    const isShowdown = game.currentRound === SHOWDOWN_ROUND

    const playersWithChips = game.players.filter(
      (p: any) => p.chips > 0 && p.status !== 'out' && p.status !== 'folded',
    )
    const allInPlayers = game.players.filter((p: any) => p.status === 'all_in')
    const shouldRevealAllCards =
      isShowdown || (playersWithChips.length === 1 && allInPlayers.length > 0)

    let pots = calculatePots(game.players)

    if (isShowdown && pots.length > 0) {
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
    }
  }

  /**
   * Sanitize game state for player view (shows own hole cards)
   */
  sanitizePlayerState(game: any, playerId: number): any {
    const isShowdown = game.currentRound === SHOWDOWN_ROUND

    let pots = calculatePots(game.players)

    if (isShowdown && pots.length > 0) {
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
    }
  }

  /**
   * Parse session from WebSocket request
   */
  parseSession(req: any): { playerId: number } | null {
    try {
      const cookies = this.parseCookies(req.headers.cookie || '')
      console.log('[WS] Parsed cookies:', Object.keys(cookies))

      const sessionCookie = cookies['holdem']
      const signatureCookie = cookies['holdem.sig']

      if (!sessionCookie) {
        console.log('[WS] No holdem cookie found')
        return null
      }

      if (!signatureCookie) {
        console.log('[WS] No holdem.sig cookie found')
        return null
      }

      console.log('[WS] Session cookie length:', sessionCookie.length)
      console.log('[WS] Signature cookie length:', signatureCookie.length)

      const decodedValue = decodeURIComponent(sessionCookie)
      const decodedSignature = decodeURIComponent(signatureCookie)

      const expectedSignature = keygrip.sign('holdem=' + decodedValue)
      if (decodedSignature !== expectedSignature) {
        console.warn('[WS] Invalid session signature')
        console.warn('[WS] Expected:', expectedSignature)
        console.warn('[WS] Got:', decodedSignature)
        return null
      }

      const sessionJson = Buffer.from(decodedValue, 'base64').toString('utf-8')
      const session = JSON.parse(sessionJson)

      console.log('[WS] Session parsed successfully, playerId:', session.playerId)
      return session
    } catch (error) {
      console.error('[WS] Session parse error:', error)
      return null
    }
  }

  /**
   * Parse cookies from header
   */
  parseCookies(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {}

    if (!cookieHeader) {
      return cookies
    }

    cookieHeader.split(';').forEach((cookie) => {
      const trimmed = cookie.trim()
      const equalsIndex = trimmed.indexOf('=')
      if (equalsIndex > 0) {
        const name = trimmed.substring(0, equalsIndex)
        const value = trimmed.substring(equalsIndex + 1)
        cookies[name] = value
      }
    })

    return cookies
  }

  /**
   * Send message to WebSocket client
   */
  sendMessage(ws: WebSocket, message: Record<string, unknown>): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }

  /**
   * Send error message to WebSocket client
   */
  sendError(ws: WebSocket, errorMessage: string, requestId?: string): void {
    this.sendMessage(ws, {
      type: 'error',
      requestId,
      payload: {
        error: errorMessage,
      },
    })
  }

  /**
   * Close WebSocket server
   */
  close(): void {
    if (this.wss) {
      this.wss.close()
      console.log('[WS] WebSocket server closed')
    }
  }
}

const wsService = new WebSocketService()

export default wsService
