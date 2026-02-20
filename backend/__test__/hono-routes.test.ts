import { beforeAll, describe, it, expect, mock } from 'bun:test'

mock.module('../services/room-service', () => {
  return {
    default: {
      createRoom: async () => {
        return {
          id: 1,
          roomCode: 'ROOM01',
          status: 'waiting',
          smallBlind: 5,
          bigBlind: 10,
          startingChips: 1000,
        }
      },
      getRoomByCode: async () => null,
      joinRoom: async () => {
        return {
          player: { id: 10, name: 'Alice' },
          token: 'test-token',
        }
      },
    },
  }
})

mock.module('../services/game-service', () => {
  return {
    default: {
      getGameByRoomCode: async () => null,
    },
  }
})

let app: typeof import('../hono-app').default

beforeAll(async () => {
  app = (await import('../hono-app')).default
})

describe('Hono API routes', () => {
  it('responds to health check', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ health: 'OK' })
  })

  it('returns 404 for missing room', async () => {
    const res = await app.request('/api/rooms/NOPE')
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json).toEqual({ error: 'Room not found' })
  })

  it('creates a room via POST /api/rooms', async () => {
    const res = await app.request('/api/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        smallBlind: 5,
        bigBlind: 10,
        startingChips: 1000,
      }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.roomCode).toBe('ROOM01')
    expect(json.smallBlind).toBe(5)
    expect(json.bigBlind).toBe(10)
    expect(json.startingChips).toBe(1000)
  })

  it('returns 404 for missing game by room code', async () => {
    const res = await app.request('/api/games/room/NOPE')
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json).toEqual({ error: 'Game not found' })
  })
})
