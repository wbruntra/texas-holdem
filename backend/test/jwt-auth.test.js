/**
 * Tests for JWT authentication middleware
 */

import { describe, test, expect } from 'bun:test'
const {
  generateToken,
  verifyToken,
  extractToken,
  getPlayerIdFromRequest,
} = require('../middleware/auth')

describe('JWT Authentication', () => {
  describe('generateToken and verifyToken', () => {
    test('generates a valid JWT token with playerId and gameId', () => {
      const playerId = 'player-123'
      const gameId = 456

      const token = generateToken(playerId, gameId)

      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')
      expect(token.split('.').length).toBe(3) // JWT has 3 parts
    })

    test('verifies a valid token and returns decoded payload', () => {
      const playerId = 'player-abc'
      const gameId = 789

      const token = generateToken(playerId, gameId)
      const decoded = verifyToken(token)

      expect(decoded).toBeTruthy()
      expect(decoded.playerId).toBe(playerId)
      expect(decoded.gameId).toBe(gameId)
    })

    test('returns null for invalid tokens', () => {
      const invalidToken = 'invalid.jwt.token'

      const decoded = verifyToken(invalidToken)

      expect(decoded).toBeNull()
    })

    test('returns null for tampered tokens', () => {
      const playerId = 'player-123'
      const gameId = 456

      const token = generateToken(playerId, gameId)
      const tamperedToken = token.slice(0, -5) + 'xxxxx'

      const decoded = verifyToken(tamperedToken)

      expect(decoded).toBeNull()
    })
  })

  describe('extractToken', () => {
    test('extracts token from Bearer header', () => {
      const token = 'my.jwt.token'
      const authHeader = `Bearer ${token}`

      const extracted = extractToken(authHeader)

      expect(extracted).toBe(token)
    })

    test('returns null for missing auth header', () => {
      const extracted = extractToken(undefined)

      expect(extracted).toBeNull()
    })

    test('returns null for empty auth header', () => {
      const extracted = extractToken('')

      expect(extracted).toBeNull()
    })

    test('returns raw token if not Bearer format', () => {
      const rawToken = 'raw.token.here'

      const extracted = extractToken(rawToken)

      expect(extracted).toBe(rawToken)
    })
  })

  describe('getPlayerIdFromRequest', () => {
    test('extracts playerId from JWT in Authorization header', async () => {
      const playerId = 'jwt-player-123'
      const gameId = 456
      const token = generateToken(playerId, gameId)

      const req = {
        headers: {
          authorization: `Bearer ${token}`,
        },
        session: {},
      }

      const extractedPlayerId = await getPlayerIdFromRequest(req)

      expect(extractedPlayerId).toBe(playerId)
    })

    test('falls back to session playerId when no JWT', async () => {
      const sessionPlayerId = 'session-player-456'

      const req = {
        headers: {},
        session: {
          playerId: sessionPlayerId,
        },
      }

      const extractedPlayerId = await getPlayerIdFromRequest(req)

      expect(extractedPlayerId).toBe(sessionPlayerId)
    })

    test('prefers JWT over session when both present', async () => {
      const jwtPlayerId = 'jwt-player-789'
      const sessionPlayerId = 'session-player-999'
      const token = generateToken(jwtPlayerId, 123)

      const req = {
        headers: {
          authorization: `Bearer ${token}`,
        },
        session: {
          playerId: sessionPlayerId,
        },
      }

      const extractedPlayerId = await getPlayerIdFromRequest(req)

      expect(extractedPlayerId).toBe(jwtPlayerId)
    })

    test('returns null when neither JWT nor session present', async () => {
      const req = {
        headers: {},
        session: {},
      }

      const extractedPlayerId = await getPlayerIdFromRequest(req)

      expect(extractedPlayerId).toBeNull()
    })

    test('falls back to session when JWT is invalid but session is valid', async () => {
      const sessionPlayerId = 'session-player-123'

      const req = {
        headers: {
          authorization: 'Bearer invalid.token.here',
        },
        session: {
          playerId: sessionPlayerId,
        },
      }

      const extractedPlayerId = await getPlayerIdFromRequest(req)

      expect(extractedPlayerId).toBe(sessionPlayerId)
    })
  })
})
