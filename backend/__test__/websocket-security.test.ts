import { beforeAll, afterAll, describe, it, expect } from 'bun:test'
import type { ServerWebSocket } from 'bun'
import app from '../hono-app'
import bunWsService, { WebSocketData } from '../services/bun-websocket-service'
import roomService from '../services/room-service'
import gameService from '../services/game-service'
import * as playerService from '../services/player-service'

// Helper to create a WebSocket client and wait for messages
type WSMessage = {
  type: string
  payload?: any
  requestId?: string
}

function createWebSocketClient(url: string): Promise<{
  ws: WebSocket
  messages: WSMessage[]
  waitForMessage: (type: string, timeout?: number) => Promise<WSMessage>
  send: (msg: any) => void
  close: () => void
}> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const messages: WSMessage[] = []
    let messageIndex = 0
    const pendingResolvers: Map<string, { resolve: Function; reject: Function }> = new Map()

    ws.onopen = () => {
      resolve({
        ws,
        messages,
        waitForMessage: (type: string, timeout = 5000) => {
          return new Promise((res, rej) => {
            // Check already received messages starting from last checked index
            for (let i = messageIndex; i < messages.length; i++) {
              if (messages[i].type === type) {
                messageIndex = i + 1
                res(messages[i])
                return
              }
            }

            // Set up resolver for future messages
            const timer = setTimeout(() => {
              pendingResolvers.delete(type)
              rej(new Error(`Timeout waiting for message type: ${type}`))
            }, timeout)

            pendingResolvers.set(type, {
              resolve: (msg: WSMessage) => {
                clearTimeout(timer)
                res(msg)
              },
              reject: rej,
            })
          })
        },
        send: (msg: any) => ws.send(JSON.stringify(msg)),
        close: () => ws.close(),
      })
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as WSMessage
        messages.push(data)

        const resolver = pendingResolvers.get(data.type)
        if (resolver) {
          pendingResolvers.delete(data.type)
          resolver.resolve(data)
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e)
      }
    }

    ws.onerror = (err) => {
      reject(err)
    }
  })
}

describe('WebSocket Security', () => {
  let server: ReturnType<typeof Bun.serve>
  let serverUrl: string
  let roomCode: string
  let gameId: number
  let aliceToken: string
  let bobToken: string
  let alicePlayerId: number
  let bobPlayerId: number

  beforeAll(async () => {
    // Start server on a random port
    server = Bun.serve<WebSocketData>({
      port: 0, // Random available port
      fetch(req, server) {
        if (
          server.upgrade(req, {
            data: {},
          })
        ) {
          return undefined
        }
        return app.fetch(req, server)
      },
      websocket: {
        open(ws) {
          bunWsService.open(ws)
        },
        message(ws, message) {
          bunWsService.message(ws, message)
        },
        close(ws) {
          bunWsService.close(ws)
        },
        drain(ws) {
          bunWsService.drain(ws)
        },
      },
    })

    serverUrl = `ws://localhost:${server.port}`

    // Create a room
    const room = await roomService.createRoom({
      smallBlind: 10,
      bigBlind: 20,
      startingChips: 1000,
    })
    roomCode = room.room_code

    // Get game info
    const game = await gameService.getGameByRoomCode(roomCode)
    if (!game) {
      throw new Error('Failed to create game')
    }
    gameId = game.id

    // Join as Alice
    const aliceJoin = await roomService.joinRoom(roomCode, 'Alice', 'password123')
    alicePlayerId = aliceJoin.player.id
    // Generate JWT for Alice (simulate what rooms.hono.ts does)
    const jwt = await import('jsonwebtoken')
    aliceToken = jwt.sign({ playerId: alicePlayerId }, process.env.JWT_SECRET || 'sellingswam', {
      expiresIn: '24h',
    })

    // Join as Bob
    const bobJoin = await roomService.joinRoom(roomCode, 'Bob', 'password456')
    bobPlayerId = bobJoin.player.id
    bobToken = jwt.sign({ playerId: bobPlayerId }, process.env.JWT_SECRET || 'sellingswam', {
      expiresIn: '24h',
    })

    // Both players join the game
    await playerService.joinGame(gameId, alicePlayerId)
    await playerService.joinGame(gameId, bobPlayerId)

    // Start the game
    await gameService.startGame(gameId)
  })

  afterAll(() => {
    server.stop()
  })

  it('allows unauthenticated connection to table stream without hole cards', async () => {
    const client = await createWebSocketClient(`${serverUrl}/ws`)

    // Subscribe to table stream without token
    client.send({
      type: 'subscribe',
      payload: {
        roomCode,
        stream: 'table',
      },
    })

    const subscribed = await client.waitForMessage('subscribed')
    expect(subscribed.payload.authenticated).toBe(false)
    expect(subscribed.payload.stream).toBe('table')

    const gameState = await client.waitForMessage('game_state')
    expect(gameState.payload.state.players).toBeDefined()
    expect(gameState.payload.state.players.length).toBe(2)

    // Verify no hole cards are visible
    for (const player of gameState.payload.state.players) {
      expect(player.holeCards).toEqual([])
    }

    client.close()
  })

  it('allows authenticated connection to player stream and shows only own hole cards', async () => {
    const client = await createWebSocketClient(`${serverUrl}/ws`)

    // Subscribe to player stream with Alice's token
    client.send({
      type: 'subscribe',
      payload: {
        roomCode,
        stream: 'player',
        token: aliceToken,
      },
    })

    const subscribed = await client.waitForMessage('subscribed')
    expect(subscribed.payload.authenticated).toBe(true)
    expect(subscribed.payload.stream).toBe('player')

    const gameState = await client.waitForMessage('game_state')
    const players = gameState.payload.state.players
    expect(players.length).toBe(2)

    // Find Alice and Bob
    const alice = players.find((p: any) => p.name === 'Alice')
    const bob = players.find((p: any) => p.name === 'Bob')

    expect(alice).toBeDefined()
    expect(bob).toBeDefined()

    // Alice should see her own hole cards
    expect(alice.holeCards.length).toBe(2)
    expect(alice.holeCards[0]).toHaveProperty('rank')
    expect(alice.holeCards[0]).toHaveProperty('suit')

    // Bob's cards should be hidden from Alice
    expect(bob.holeCards).toEqual([])

    client.close()
  })

  it('shows Bob only his own hole cards, not Alices', async () => {
    const client = await createWebSocketClient(`${serverUrl}/ws`)

    // Subscribe to player stream with Bob's token
    client.send({
      type: 'subscribe',
      payload: {
        roomCode,
        stream: 'player',
        token: bobToken,
      },
    })

    const subscribed = await client.waitForMessage('subscribed')
    expect(subscribed.payload.authenticated).toBe(true)

    const gameState = await client.waitForMessage('game_state')
    const players = gameState.payload.state.players

    const alice = players.find((p: any) => p.name === 'Alice')
    const bob = players.find((p: any) => p.name === 'Bob')

    // Alice's cards should be hidden from Bob
    expect(alice.holeCards).toEqual([])

    // Bob should see his own hole cards
    expect(bob.holeCards.length).toBe(2)
    expect(bob.holeCards[0]).toHaveProperty('rank')

    client.close()
  })

  it('allows player stream without token but hides all hole cards', async () => {
    const client = await createWebSocketClient(`${serverUrl}/ws`)

    // Subscribe to player stream WITHOUT token
    client.send({
      type: 'subscribe',
      payload: {
        roomCode,
        stream: 'player',
      },
    })

    const subscribed = await client.waitForMessage('subscribed')
    expect(subscribed.payload.authenticated).toBe(false)
    expect(subscribed.payload.stream).toBe('player')

    const gameState = await client.waitForMessage('game_state')

    // All hole cards should be hidden
    for (const player of gameState.payload.state.players) {
      expect(player.holeCards).toEqual([])
    }

    client.close()
  })

  it('ignores client-provided playerId and uses JWT token only', async () => {
    const client = await createWebSocketClient(`${serverUrl}/ws`)

    // Subscribe with Alice's token but claiming to be Bob
    client.send({
      type: 'subscribe',
      payload: {
        roomCode,
        stream: 'player',
        playerId: bobPlayerId, // Try to impersonate Bob
        token: aliceToken, // But use Alice's token
      },
    })

    const subscribed = await client.waitForMessage('subscribed')
    expect(subscribed.payload.authenticated).toBe(true)

    const gameState = await client.waitForMessage('game_state')
    const players = gameState.payload.state.players

    const alice = players.find((p: any) => p.name === 'Alice')
    const bob = players.find((p: any) => p.name === 'Bob')

    // Should see Alice's cards (from token), not Bob's
    expect(alice.holeCards.length).toBe(2)
    expect(bob.holeCards).toEqual([])

    client.close()
  })

  it('handles invalid JWT token gracefully', async () => {
    const client = await createWebSocketClient(`${serverUrl}/ws`)

    client.send({
      type: 'subscribe',
      payload: {
        roomCode,
        stream: 'player',
        token: 'invalid-token',
      },
    })

    const subscribed = await client.waitForMessage('subscribed')
    expect(subscribed.payload.authenticated).toBe(false)

    const gameState = await client.waitForMessage('game_state')

    // No cards should be visible with invalid token
    for (const player of gameState.payload.state.players) {
      expect(player.holeCards).toEqual([])
    }

    client.close()
  })

  it('broadcasts game updates to all subscribed clients', async () => {
    const aliceClient = await createWebSocketClient(`${serverUrl}/ws`)
    const bobClient = await createWebSocketClient(`${serverUrl}/ws`)

    // Alice subscribes
    aliceClient.send({
      type: 'subscribe',
      payload: {
        roomCode,
        stream: 'player',
        token: aliceToken,
      },
    })

    // Bob subscribes
    bobClient.send({
      type: 'subscribe',
      payload: {
        roomCode,
        stream: 'player',
        token: bobToken,
      },
    })

    // Wait for both to be subscribed
    await aliceClient.waitForMessage('subscribed')
    await bobClient.waitForMessage('subscribed')

    // Get initial game_state messages
    const aliceInitial = await aliceClient.waitForMessage('game_state')
    const bobInitial = await bobClient.waitForMessage('game_state')

    // Verify initial state
    expect(aliceInitial.payload.reason).toBe('subscribe')
    expect(bobInitial.payload.reason).toBe('subscribe')

    // Trigger a game update by emitting an event
    const gameEvents = (await import('../lib/game-events')).default
    gameEvents.emitGameUpdate(gameId.toString(), 'test_update')

    // Wait for second game_state message (the broadcast)
    const aliceUpdate = await aliceClient.waitForMessage('game_state')
    const bobUpdate = await bobClient.waitForMessage('game_state')

    expect(aliceUpdate.payload.reason).toBe('test_update')
    expect(bobUpdate.payload.reason).toBe('test_update')

    // Each should only see their own cards
    const aliceInUpdate = aliceUpdate.payload.state.players.find((p: any) => p.name === 'Alice')
    const bobInAliceView = aliceUpdate.payload.state.players.find((p: any) => p.name === 'Bob')
    expect(aliceInUpdate.holeCards.length).toBe(2)
    expect(bobInAliceView.holeCards).toEqual([])

    const bobInUpdate = bobUpdate.payload.state.players.find((p: any) => p.name === 'Bob')
    const aliceInBobView = bobUpdate.payload.state.players.find((p: any) => p.name === 'Alice')
    expect(bobInUpdate.holeCards.length).toBe(2)
    expect(aliceInBobView.holeCards).toEqual([])

    aliceClient.close()
    bobClient.close()
  })
})
