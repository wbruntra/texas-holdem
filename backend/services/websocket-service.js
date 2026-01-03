/**
 * WebSocket Service - Handles WebSocket connections and game state broadcasting
 * Phase 2: Authenticated "player" stream + public "table" stream
 */

const WebSocket = require('ws')
const Keygrip = require('keygrip')
const gameService = require('@/services/game-service')
const playerService = require('@/services/player-service')
const actionService = require('@/services/action-service')
const gameEvents = require('@/lib/game-events')
const { calculatePots, distributePots } = require('@/lib/pot-manager')
const { evaluateHand } = require('@/lib/poker-engine')
const { verifyToken } = require('@/middleware/auth')

const SHOWDOWN_ROUND = 'showdown'

// Cookie session keys (must match app.js configuration)
const SESSION_KEYS = ['hackedescape']
const keygrip = new Keygrip(SESSION_KEYS)

class WebSocketService {
  constructor() {
    this.wss = null
    this.subscriptions = new Map() // ws -> { roomCode, stream, gameId, playerId? }
  }

  /**
   * Initialize WebSocket server
   * @param {http.Server} server - HTTP server instance
   */
  initialize(server) {
    this.wss = new WebSocket.Server({
      server,
      path: '/ws',
    })

    this.wss.on('connection', (ws, req) => {
      console.log('[WS] Client connected')
      // console.log('[WS] Cookie header:', req.headers.cookie || '(none)')

      // Parse session from cookies
      const session = this.parseSession(req)
      const playerId = session?.playerId || null

      // Store session info on the WebSocket
      ws.playerId = playerId

      if (playerId) {
        console.log('[WS] Authenticated connection:', playerId)
      } else {
        console.log('[WS] Unauthenticated connection')
      }

      // Send hello message
      this.sendMessage(ws, {
        type: 'hello',
        payload: {
          serverTime: new Date().toISOString(),
          protocolVersion: 1,
          authenticated: !!playerId,
        },
      })

      // Handle incoming messages
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString())
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

      ws.on('error', (error) => {
        console.error('[WS] WebSocket error:', error)
      })
    })

    // Subscribe to game update events
    gameEvents.onGameUpdate(async ({ gameId, reason }) => {
      await this.broadcastGameUpdate(gameId, reason)
    })

    console.log('[WS] WebSocket server initialized on /ws')
  }

  /**
   * Handle incoming WebSocket message
   */
  async handleMessage(ws, message) {
    const { type, requestId, payload } = message

    switch (type) {
      case 'subscribe':
        await this.handleSubscribe(ws, payload, requestId)
        break

      case 'resume':
        await this.handleResume(ws, payload, requestId)
        break

      default:
        this.sendError(ws, `Unknown message type: ${type}`, requestId)
    }
  }

  /**
   * Handle subscription request
   */
  async handleSubscribe(ws, payload, requestId) {
    const { roomCode, stream, gameId: clientGameId, playerId: clientPlayerId, token } = payload

    if (!roomCode || !stream) {
      return this.sendError(ws, 'roomCode and stream are required', requestId)
    }

    if (stream !== 'table' && stream !== 'player') {
      return this.sendError(ws, 'stream must be "table" or "player"', requestId)
    }

    try {
      // Get game by room code
      const game = await gameService.getGameByRoomCode(roomCode)

      if (!game) {
        return this.sendError(ws, 'Game not found', requestId)
      }

      let playerId = null

      // For player stream, try multiple auth methods (in order of preference)
      if (stream === 'player') {
        // Method 1: JWT token (preferred - allows non-browser clients)
        if (token) {
          const decoded = verifyToken(token)
          if (decoded && decoded.playerId) {
            const player = await playerService.getPlayerById(decoded.playerId)
            if (player && player.gameId === game.id) {
              playerId = player.id
              console.log('[WS] Player authenticated via JWT:', playerId)
            } else {
              console.warn('[WS] JWT player not found or wrong game:', decoded.playerId)
            }
          } else {
            console.warn('[WS] Invalid JWT token provided')
          }
        }

        // Method 2: Session-based auth (from cookies)
        if (!playerId && ws.playerId) {
          const player = await playerService.getPlayerById(ws.playerId)

          if (player && player.gameId === game.id) {
            playerId = player.id
            console.log('[WS] Player authenticated via session:', playerId)
          }
        }

        // Method 3: Client-provided playerId (legacy localStorage method)
        if (!playerId && clientPlayerId) {
          const player = await playerService.getPlayerById(clientPlayerId)

          if (player && player.gameId === game.id) {
            playerId = player.id
            console.log('[WS] Player authenticated via playerId:', playerId)
          } else {
            console.warn('[WS] Invalid playerId provided:', clientPlayerId)
          }
        }

        // Method 4: Fallback to table view if gameId matches
        if (!playerId && clientGameId && clientGameId === game.id) {
          console.warn('[WS] Player stream requested but no auth - using table view sanitization')
          // Keep playerId = null, will use table sanitization
        } else if (!playerId && !clientGameId && !token) {
          return this.sendError(ws, 'Authentication required for player stream', requestId)
        }
      }

      // Store subscription
      this.subscriptions.set(ws, {
        roomCode,
        stream,
        gameId: game.id,
        playerId,
      })

      // Send subscribed confirmation
      this.sendMessage(ws, {
        type: 'subscribed',
        requestId,
        payload: {
          gameId: game.id,
          roomCode,
          stream,
          authenticated: !!playerId,
        },
      })

      // Normalize turn in case current player is ALL_IN or FOLDED
      const normalizedGame = (await actionService.normalizeTurnIfNeeded(game.id)) || game

      // Send initial game state snapshot
      // If player stream with no playerId, use table sanitization
      const sanitizedState =
        stream === 'player' && playerId
          ? this.sanitizePlayerState(normalizedGame, playerId)
          : this.sanitizeTableState(normalizedGame)

      this.sendMessage(ws, {
        type: 'game_state',
        requestId,
        payload: {
          state: sanitizedState,
          revision: game.handNumber?.toString() || '0',
          reason: 'subscribe',
        },
      })

      console.log(
        `[WS] Client subscribed to ${stream} stream: ${roomCode}${playerId ? ` (player: ${playerId})` : ''}`,
      )
    } catch (error) {
      console.error('[WS] Subscribe error:', error)
      this.sendError(ws, 'Failed to subscribe', requestId)
    }
  }

  /**
   * Handle resume request (reconnect with last known revision)
   */
  async handleResume(ws, payload, requestId) {
    const subscription = this.subscriptions.get(ws)

    if (!subscription) {
      return this.sendError(ws, 'Not subscribed', requestId)
    }

    try {
      const game = await gameService.getGameById(subscription.gameId)

      if (!game) {
        return this.sendError(ws, 'Game not found', requestId)
      }

      // Normalize turn in case current player is ALL_IN or FOLDED
      const normalizedGame =
        (await actionService.normalizeTurnIfNeeded(subscription.gameId)) || game

      // Always send full snapshot on resume (authoritative)
      const sanitizedState =
        subscription.stream === 'player' && subscription.playerId
          ? this.sanitizePlayerState(normalizedGame, subscription.playerId)
          : this.sanitizeTableState(normalizedGame)

      this.sendMessage(ws, {
        type: 'game_state',
        requestId,
        payload: {
          state: sanitizedState,
          revision: game.handNumber?.toString() || '0',
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
   * Broadcast game state update to all subscribed clients
   */
  async broadcastGameUpdate(gameId, reason) {
    try {
      let game = await gameService.getGameById(gameId)

      if (!game) {
        console.warn(`[WS] Game not found for broadcast: ${gameId}`)
        return
      }

      // Normalize turn in case current player is ALL_IN or FOLDED
      // This ensures WebSocket broadcasts match HTTP API responses
      game = (await actionService.normalizeTurnIfNeeded(gameId)) || game

      const revision = game.handNumber?.toString() || '0'

      // Send to all clients subscribed to this game (both table and player streams)
      for (const [ws, subscription] of this.subscriptions.entries()) {
        if (subscription.gameId === gameId && ws.readyState === WebSocket.OPEN) {
          // Sanitize state per-connection based on stream type and auth
          // If player stream with playerId, show that player's cards
          // Otherwise use table sanitization
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
   * Sanitize game state for table view (public, no hole cards except when rules allow)
   * Cards are revealed when:
   * 1. It's showdown, OR
   * 2. Only one player has chips and others are all-in (standard poker rules)
   */
  sanitizeTableState(game) {
    const isShowdown = game.currentRound === SHOWDOWN_ROUND

    // Check if cards should be revealed due to all-in situation
    const playersWithChips = game.players.filter(
      (p) => p.chips > 0 && p.status !== 'out' && p.status !== 'folded',
    )
    const allInPlayers = game.players.filter((p) => p.status === 'all_in')
    const shouldRevealAllCards =
      isShowdown || (playersWithChips.length === 1 && allInPlayers.length > 0)

    // Calculate pots from player bets
    let pots = calculatePots(game.players)

    // If it's showdown, distribute pots to add winner information
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
      players: game.players.map((p) => ({
        id: p.id,
        name: p.name,
        position: p.position,
        chips: p.chips,
        currentBet: p.currentBet,
        totalBet: p.totalBet || 0,
        status: p.status,
        holeCards:
          (shouldRevealAllCards &&
            (game.players.filter((pl) => pl.status === 'active' || pl.status === 'all_in').length >
              1 ||
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
   * Sanitize game state for player view (show only that player's hole cards, except showdown)
   */
  sanitizePlayerState(game, playerId) {
    const isShowdown = game.currentRound === SHOWDOWN_ROUND

    // Calculate pots from player bets
    let pots = calculatePots(game.players)

    // If it's showdown, distribute pots to add winner information
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
      players: game.players.map((p) => ({
        id: p.id,
        name: p.name,
        position: p.position,
        chips: p.chips,
        currentBet: p.currentBet,
        totalBet: p.totalBet || 0,
        status: p.status,
        holeCards:
          (isShowdown &&
            (game.players.filter((pl) => pl.status === 'active' || pl.status === 'all_in').length >
              1 ||
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
   * Parse session from cookies during WebSocket upgrade
   */
  parseSession(req) {
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

      // Cookie value might be URL-encoded
      const decodedValue = decodeURIComponent(sessionCookie)
      const decodedSignature = decodeURIComponent(signatureCookie)

      // Verify signature
      const expectedSignature = keygrip.sign(`holdem=${decodedValue}`)
      if (decodedSignature !== expectedSignature) {
        console.warn('[WS] Invalid session signature')
        console.warn('[WS] Expected:', expectedSignature)
        console.warn('[WS] Got:', decodedSignature)
        return null
      }

      // Decode Base64 session data
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
   * Parse cookies from cookie header string
   */
  parseCookies(cookieHeader) {
    const cookies = {}

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
   * Send a message to a WebSocket client
   */
  sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }

  /**
   * Send an error message
   */
  sendError(ws, errorMessage, requestId = null) {
    this.sendMessage(ws, {
      type: 'error',
      requestId,
      payload: {
        error: errorMessage,
      },
    })
  }

  /**
   * Close all connections and cleanup
   */
  close() {
    if (this.wss) {
      this.wss.close()
      console.log('[WS] WebSocket server closed')
    }
  }
}

// Singleton instance
const wsService = new WebSocketService()

module.exports = wsService
