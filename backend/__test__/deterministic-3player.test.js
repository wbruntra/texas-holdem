import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import request from 'supertest'
import app from '../app.js'
import db from '@holdem/database/test_db_connection'

describe('Deterministic 3-Player Game', () => {
  const SEED = 'test-3player-deterministic-123'
  let game
  let playerTokens = []

  beforeAll(async () => {
    // Run migration for seed columns
    await db.migrate.latest()
  })

  afterAll(async () => {
    // Clean up test data
    await db('actions').delete()
    await db('hands').delete()
    await db('players').delete()
    await db('games').delete()
  })

  describe('Game setup with seed', () => {
    it('should create a game with seed', async () => {
      const gameData = {
        smallBlind: 5,
        bigBlind: 10,
        startingChips: 1000,
        seed: SEED,
      }

      const response = await request(app).post('/api/games').send(gameData)

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('id')
      expect(response.body).toHaveProperty('seed')
      expect(response.body.seed).toBe(SEED)

      game = response.body
    })

    it('should allow 3 players to join', async () => {
      const players = [
        { name: 'Alice', password: 'pass1' },
        { name: 'Bob', password: 'pass2' },
        { name: 'Charlie', password: 'pass3' },
      ]

      for (const player of players) {
        const response = await request(app).post(`/api/games/${game.id}/join`).send(player)

        expect(response.status).toBe(201)
        expect(response.body).toHaveProperty('token')
        playerTokens.push(response.body.token)
      }

      // Verify 3 players in game
      const stateResponse = await request(app).get(`/api/games/room/${game.roomCode}/state`)

      expect(stateResponse.status).toBe(200)
      expect(stateResponse.body.players).toHaveLength(3)
    })

    it('should start the game deterministically', async () => {
      const response = await request(app)
        .post(`/api/games/${game.id}/start`)
        .set('Authorization', `Bearer ${playerTokens[0]}`)

      expect(response.status).toBe(200)
      expect(response.body.status).toBe('active')
      expect(response.body.handNumber).toBe(1)
      expect(response.body.players).toHaveLength(3)

      // With deterministic seed, we should get exact same cards every time
      // We can test this by verifying hole cards are consistent
      const alice = response.body.players.find((p) => p.name === 'Alice')
      const bob = response.body.players.find((p) => p.name === 'Bob')
      const charlie = response.body.players.find((p) => p.name === 'Charlie')

      expect(alice).toBeDefined()
      expect(bob).toBeDefined()
      expect(charlie).toBeDefined()

      // Store initial hole cards for verification later
      game.initialHoleCards = {
        alice: alice.holeCards,
        bob: bob.holeCards,
        charlie: charlie.holeCards,
      }
    })
  })

  describe('Deterministic gameplay test', () => {
    it('should produce same cards when restarted with same seed', async () => {
      // Create another game with same seed
      const gameData = {
        smallBlind: 5,
        bigBlind: 10,
        startingChips: 1000,
        seed: SEED,
      }

      const createResponse = await request(app).post('/api/games').send(gameData)
      const newGameId = createResponse.body.id

      // Add same 3 players
      const players = [
        { name: 'Alice2', password: 'pass1' },
        { name: 'Bob2', password: 'pass2' },
        { name: 'Charlie2', password: 'pass3' },
      ]

      const newTokens = []
      for (const player of players) {
        const joinResponse = await request(app).post(`/api/games/${newGameId}/join`).send(player)
        newTokens.push(joinResponse.body.token)
      }

      // Start the game
      const startResponse = await request(app)
        .post(`/api/games/${newGameId}/start`)
        .set('Authorization', `Bearer ${newTokens[0]}`)

      // Verify hole cards are the same as first game
      const newAlice = startResponse.body.players.find((p) => p.name === 'Alice2')
      const newBob = startResponse.body.players.find((p) => p.name === 'Bob2')
      const newCharlie = startResponse.body.players.find((p) => p.name === 'Charlie2')

      // The exact same cards should be dealt (same position, same cards)
      expect(newAlice.holeCards).toEqual(game.initialHoleCards.alice)
      expect(newBob.holeCards).toEqual(game.initialHoleCards.bob)
      expect(newCharlie.holeCards).toEqual(game.initialHoleCards.charlie)
    })

    it('should produce consistent community cards with same seed', async () => {
      // Advance to flop and check community cards
      const response = await request(app)
        .post(`/api/games/${game.id}/advance`)
        .set('Authorization', `Bearer ${playerTokens[0]}`)

      expect(response.status).toBe(200)
      expect(response.body.currentRound).toBe('flop')
      expect(response.body.communityCards).toHaveLength(3)

      // Store community cards for comparison
      const flopCards = response.body.communityCards

      // Create third game with same seed to test community cards consistency
      const gameData = {
        smallBlind: 5,
        bigBlind: 10,
        startingChips: 1000,
        seed: SEED,
      }

      const createResponse = await request(app).post('/api/games').send(gameData)
      const newGameId = createResponse.body.id

      // Add 3 players quickly
      const players = [
        { name: 'Test1', password: 'pass1' },
        { name: 'Test2', password: 'pass2' },
        { name: 'Test3', password: 'pass3' },
      ]

      const newTokens = []
      for (const player of players) {
        const joinResponse = await request(app).post(`/api/games/${newGameId}/join`).send(player)
        newTokens.push(joinResponse.body.token)
      }

      // Start and advance to flop
      await request(app)
        .post(`/api/games/${newGameId}/start`)
        .set('Authorization', `Bearer ${newTokens[0]}`)

      const advanceResponse = await request(app)
        .post(`/api/games/${newGameId}/advance`)
        .set('Authorization', `Bearer ${newTokens[0]}`)

      // Community cards should be identical
      expect(advanceResponse.body.communityCards).toEqual(flopCards)
    })
  })

  describe('Different seeds produce different results', () => {
    it('should produce different cards with different seed', async () => {
      const differentSeed = 'different-seed-456'

      const gameData = {
        smallBlind: 5,
        bigBlind: 10,
        startingChips: 1000,
        seed: differentSeed,
      }

      const createResponse = await request(app).post('/api/games').send(gameData)
      const newGameId = createResponse.body.id

      // Add 3 players
      const players = [
        { name: 'Diff1', password: 'pass1' },
        { name: 'Diff2', password: 'pass2' },
        { name: 'Diff3', password: 'pass3' },
      ]

      const newTokens = []
      for (const player of players) {
        const joinResponse = await request(app).post(`/api/games/${newGameId}/join`).send(player)
        newTokens.push(joinResponse.body.token)
      }

      // Start the game
      const startResponse = await request(app)
        .post(`/api/games/${newGameId}/start`)
        .set('Authorization', `Bearer ${newTokens[0]}`)

      // Should get different cards than original game
      const diffAlice = startResponse.body.players.find((p) => p.name === 'Diff1')
      const diffBob = startResponse.body.players.find((p) => p.name === 'Diff2')
      const diffCharlie = startResponse.body.players.find((p) => p.name === 'Diff3')

      // At least one player should have different cards
      const allCardsMatch =
        JSON.stringify(diffAlice.holeCards) === JSON.stringify(game.initialHoleCards.alice) &&
        JSON.stringify(diffBob.holeCards) === JSON.stringify(game.initialHoleCards.bob) &&
        JSON.stringify(diffCharlie.holeCards) === JSON.stringify(game.initialHoleCards.charlie)

      expect(allCardsMatch).toBe(false) // Should be different with different seed
    })
  })
})
