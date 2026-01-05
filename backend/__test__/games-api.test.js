import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import request from 'supertest'
import app from '../app.js'
// import knex from 'knex'
// import * as config from '@holdem/database/knexfile.js'
import db from '@holdem/database/db'

describe('Games API', () => {
  afterAll(async () => {
    // Clean up data but keep schema
    await db('actions').delete()
    await db('hands').delete()
    await db('players').delete()
    await db('games').delete()
    await db('showdown_history').delete()
    // Don't destroy the connection as other tests may be running
  })

  describe('Game lifecycle', () => {
    let game
    let player1Token
    let player2Token

    it('should create a new game', async () => {
      const gameData = {
        smallBlind: 5,
        bigBlind: 10,
        startingChips: 1000,
      }

      const response = await request(app).post('/api/games').send(gameData)

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('id')
      expect(response.body).toHaveProperty('roomCode')
      expect(response.body.smallBlind).toBe(gameData.smallBlind)
      expect(response.body.bigBlind).toBe(gameData.bigBlind)
      expect(response.body.startingChips).toBe(gameData.startingChips)
      expect(response.body.status).toBe('waiting')

      game = response.body
    })

    it('should allow first player to join', async () => {
      const joinData = {
        name: 'Alice',
        password: 'pass123',
      }

      const response = await request(app).post(`/api/games/${game.id}/join`).send(joinData)

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('player')
      expect(response.body).toHaveProperty('token')
      expect(response.body.player.name).toBe('Alice')
      expect(response.body.player.gameId).toBe(game.id)

      player1Token = response.body.token
    })

    it('should allow second player to join', async () => {
      const joinData = {
        name: 'Bob',
        password: 'pass456',
      }

      const response = await request(app).post(`/api/games/${game.id}/join`).send(joinData)

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('player')
      expect(response.body).toHaveProperty('token')
      expect(response.body.player.name).toBe('Bob')
      expect(response.body.player.gameId).toBe(game.id)

      player2Token = response.body.token
    })

    it('should start the game', async () => {
      const response = await request(app)
        .post(`/api/games/${game.id}/start`)
        .set('Authorization', `Bearer ${player1Token}`)

      expect(response.status).toBe(200)
      expect(response.body.status).toBe('active')
      expect(response.body.players).toHaveLength(2)
      expect(response.body.currentRound).toBe('preflop')
    })

    it('should get game state after starting', async () => {
      const response = await request(app).get(`/api/games/room/${game.roomCode}/state`)

      expect(response.status).toBe(200)
      expect(response.body.status).toBe('active')
      expect(response.body.players).toHaveLength(2)
      expect(response.body.currentRound).toBe('preflop')
    })

    it('should allow first player to go all-in', async () => {
      const response = await request(app)
        .post(`/api/games/${game.id}/actions`)
        .set('Authorization', `Bearer ${player1Token}`)
        .send({ action: 'all_in' })

      expect(response.status).toBe(200)
      expect(response.body.players[0].status).toBe('all_in')
      expect(response.body.players[0].chips).toBe(0)
      expect(response.body.currentBet).toBe(1000) // Alice's starting chips
    })

    it('should allow second player to call all-in', async () => {
      const response = await request(app)
        .post(`/api/games/${game.id}/actions`)
        .set('Authorization', `Bearer ${player2Token}`)
        .send({ action: 'call' })

      expect(response.status).toBe(200)
      expect(response.body.players[1].status).toBe('all_in')
      expect(response.body.players[1].chips).toBe(0)
      expect(response.body.action_finished).toBe(true)
    })

    it('should advance to flop', async () => {
      const response = await request(app)
        .post(`/api/games/${game.id}/advance`)
        .set('Authorization', `Bearer ${player1Token}`)

      expect(response.status).toBe(200)
      expect(response.body.currentRound).toBe('flop')
      expect(response.body.communityCards).toHaveLength(3)
      expect(response.body.action_finished).toBe(true)
    })

    it('should advance to turn', async () => {
      const response = await request(app)
        .post(`/api/games/${game.id}/advance`)
        .set('Authorization', `Bearer ${player1Token}`)

      expect(response.status).toBe(200)
      expect(response.body.currentRound).toBe('turn')
      expect(response.body.communityCards).toHaveLength(4)
      expect(response.body.action_finished).toBe(true)
    })

    it('should advance to river', async () => {
      const response = await request(app)
        .post(`/api/games/${game.id}/advance`)
        .set('Authorization', `Bearer ${player1Token}`)

      expect(response.status).toBe(200)
      expect(response.body.currentRound).toBe('river')
      expect(response.body.communityCards).toHaveLength(5)
      expect(response.body.action_finished).toBe(true)
    })

    it('should advance to showdown', async () => {
      const response = await request(app)
        .post(`/api/games/${game.id}/advance`)
        .set('Authorization', `Bearer ${player1Token}`)

      expect(response.status).toBe(200)
      expect(response.body.currentRound).toBe('showdown')
      expect(response.body.status).toBe('completed')
      expect(response.body.winners).toBeDefined()
    })
  })

  describe('All-in bug scenario', () => {
    let game
    let player1Token
    let player2Token
    let player1Id
    let player2Id

    it('should create a new game', async () => {
      const gameData = {
        smallBlind: 5,
        bigBlind: 10,
        startingChips: 1000,
      }

      const response = await request(app).post('/api/games').send(gameData)

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('id')
      expect(response.body).toHaveProperty('roomCode')
      expect(response.body.smallBlind).toBe(gameData.smallBlind)
      expect(response.body.bigBlind).toBe(gameData.bigBlind)
      expect(response.body.startingChips).toBe(gameData.startingChips)
      expect(response.body.status).toBe('waiting')

      game = response.body
    })

    it('should allow first player to join', async () => {
      const joinData = {
        name: 'Alice',
        password: 'pass123',
      }

      const response = await request(app).post(`/api/games/${game.id}/join`).send(joinData)

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('player')
      expect(response.body).toHaveProperty('token')
      expect(response.body.player.name).toBe('Alice')
      expect(response.body.player.gameId).toBe(game.id)

      player1Token = response.body.token
      player1Id = response.body.player.id
    })

    it('should allow second player to join', async () => {
      const joinData = {
        name: 'Bob',
        password: 'pass456',
      }

      const response = await request(app).post(`/api/games/${game.id}/join`).send(joinData)

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('player')
      expect(response.body).toHaveProperty('token')
      expect(response.body.player.name).toBe('Bob')
      expect(response.body.player.gameId).toBe(game.id)

      player2Token = response.body.token
      player2Id = response.body.player.id
    })

    it('should start the game', async () => {
      const response = await request(app)
        .post(`/api/games/${game.id}/start`)
        .set('Authorization', `Bearer ${player1Token}`)

      expect(response.status).toBe(200)
      expect(response.body.status).toBe('active')
      expect(response.body.players).toHaveLength(2)
      expect(response.body.currentRound).toBe('preflop')
    })

    it('should have posted blinds correctly', async () => {
      const response = await request(app).get(`/api/games/room/${game.roomCode}/state`)

      expect(response.status).toBe(200)
      expect(response.body.status).toBe('active')
      expect(response.body.players).toHaveLength(2)
      expect(response.body.currentRound).toBe('preflop')

      // Check that blinds were posted
      const players = response.body.players
      const totalBets = players.reduce((sum, p) => sum + (p.totalBet || 0), 0)
      expect(totalBets).toBe(15) // 5 + 10 blinds

      // Check that current bet is 10 (big blind)
      expect(response.body.currentBet).toBe(10)

      // Check that players have different total bets (one should have 5, one should have 10)
      const betAmounts = players.map((p) => p.totalBet || 0)
      expect(betAmounts).toContain(5)
      expect(betAmounts).toContain(10)
      expect(betAmounts.reduce((a, b) => a + b)).toBe(15)
    })

    it('should manipulate player chip totals', async () => {
      // Directly manipulate the database to set specific chip amounts
      await db('players').where({ id: player1Id }).update({ chips: 100 })
      await db('players').where({ id: player2Id }).update({ chips: 200 })

      // Verify the changes
      const players = await db('players').where({ game_id: game.id }).select('id', 'chips')
      const player1 = players.find((p) => p.id === player1Id)
      const player2 = players.find((p) => p.id === player2Id)

      expect(player1.chips).toBe(100)
      expect(player2.chips).toBe(200)
    })

    it('should allow player with 100 chips to go all-in', async () => {
      // Get current game state to see whose turn it is and their current bets
      const stateResponse = await request(app).get(`/api/games/room/${game.roomCode}/state`)

      expect(stateResponse.status).toBe(200)

      // Find which player has 100 chips and should act
      const players = stateResponse.body.players
      const playerWith100Chips = players.find((p) => p.chips === 100)
      const playerWith200Chips = players.find((p) => p.chips === 200)

      expect(playerWith100Chips).toBeDefined()
      expect(playerWith200Chips).toBeDefined()

      // Record the current bet before all-in
      const existingBet = playerWith100Chips.currentBet || 0

      // Determine which token to use based on whose turn it is
      const currentPlayerId =
        stateResponse.body.currentPlayerPosition !== null
          ? players[stateResponse.body.currentPlayerPosition].id
          : null

      let actingToken
      if (currentPlayerId === playerWith100Chips.id) {
        actingToken = player1Id === playerWith100Chips.id ? player1Token : player2Token
      } else if (currentPlayerId === playerWith200Chips.id) {
        actingToken = player1Id === playerWith200Chips.id ? player1Token : player2Token
      } else {
        // If it's not clear whose turn, try with the player who has 100 chips
        actingToken = player1Id === playerWith100Chips.id ? player1Token : player2Token
      }

      const response = await request(app)
        .post(`/api/games/${game.id}/actions`)
        .set('Authorization', `Bearer ${actingToken}`)
        .send({ action: 'all_in' })

      expect(response.status).toBe(200)

      // Verify the all-in action worked
      const updatedPlayers = response.body.players
      const allInPlayer = updatedPlayers.find((p) => p.id === playerWith100Chips.id)
      expect(allInPlayer.status).toBe('all_in')
      expect(allInPlayer.chips).toBe(0)
      expect(allInPlayer.currentBet).toBe(existingBet + 100) // existing bet + remaining chips
      expect(response.body.currentBet).toBe(existingBet + 100)
    })

    it('should allow player with 200 chips to call the all-in', async () => {
      // Get current game state to see whose turn it is now
      const stateResponse = await request(app).get(`/api/games/room/${game.roomCode}/state`)

      expect(stateResponse.status).toBe(200)

      // Find the players
      const players = stateResponse.body.players
      const playerWith0Chips = players.find((p) => p.chips === 0) // all-in player
      const playerWith200Chips = players.find((p) => p.chips === 200)

      expect(playerWith0Chips).toBeDefined()
      expect(playerWith200Chips).toBeDefined()
      expect(playerWith0Chips.status).toBe('all_in')

      // Record the calling player's existing bet before calling
      const callingPlayerExistingBet = playerWith200Chips.totalBet || 0

      // Determine which token to use for the player with 200 chips
      const actingToken = player1Id === playerWith200Chips.id ? player1Token : player2Token

      const response = await request(app)
        .post(`/api/games/${game.id}/actions`)
        .set('Authorization', `Bearer ${actingToken}`)
        .send({ action: 'call' })

      expect(response.status).toBe(200)

      // Verify the call action worked
      const updatedPlayers = response.body.players
      const callingPlayer = updatedPlayers.find((p) => p.id === playerWith200Chips.id)
      const allInPlayer = updatedPlayers.find((p) => p.id === playerWith0Chips.id)

      // The calling player should have matched the all-in bet
      expect(callingPlayer.currentBet).toBe(allInPlayer.currentBet)

      // Calculate expected chips: original 200 - (amount needed to call)
      // Amount needed to call = allInPlayer.currentBet - callingPlayer.existingBet
      const amountNeededToCall = allInPlayer.currentBet - callingPlayerExistingBet
      expect(callingPlayer.chips).toBe(200 - amountNeededToCall)

      expect(response.body.action_finished).toBe(true) // Both players all-in, should be finished
    })

    it('should advance to flop and show 3 community cards', async () => {
      const response = await request(app)
        .post(`/api/games/${game.id}/advance`)
        .set('Authorization', `Bearer ${player1Token}`)

      expect(response.status).toBe(200)
      expect(response.body.currentRound).toBe('flop')
      expect(response.body.communityCards).toHaveLength(3)
      expect(response.body.action_finished).toBe(true)
      expect(response.body.status).toBe('active') // Game should still be active during flop
    })

    it('should advance to turn and show 4 community cards', async () => {
      const response = await request(app)
        .post(`/api/games/${game.id}/advance`)
        .set('Authorization', `Bearer ${player1Token}`)

      expect(response.status).toBe(200)
      expect(response.body.currentRound).toBe('turn')
      expect(response.body.communityCards).toHaveLength(4)
      expect(response.body.action_finished).toBe(true)
      expect(response.body.status).toBe('active') // Game should still be active during turn

      // Also check GET state endpoint specifically
      const stateResponse = await request(app).get(`/api/games/room/${game.roomCode}/state`)

      expect(stateResponse.status).toBe(200)
      expect(stateResponse.body.status).toBe('active') // This should NOT be 'completed' when there are only 4 cards
      expect(stateResponse.body.communityCards).toHaveLength(4)
      expect(stateResponse.body.currentRound).toBe('turn')
    })

    it('should advance to river and show 5 community cards', async () => {
      const response = await request(app)
        .post(`/api/games/${game.id}/advance`)
        .set('Authorization', `Bearer ${player1Token}`)

      expect(response.status).toBe(200)
      expect(response.body.currentRound).toBe('river')
      expect(response.body.communityCards).toHaveLength(5)
      expect(response.body.action_finished).toBe(true)
      expect(response.body.status).toBe('active') // Game should still be active during river
    })

    it('should advance to showdown and complete the game', async () => {
      const response = await request(app)
        .post(`/api/games/${game.id}/advance`)
        .set('Authorization', `Bearer ${player1Token}`)

      expect(response.status).toBe(200)
      expect(response.body.currentRound).toBe('showdown')
      expect(response.body.winners).toBeDefined()

      // Debug: check player chips
      const playersWithChips = response.body.players.filter((p) => p.chips > 0)
      console.log(
        'Players after showdown:',
        response.body.players.map((p) => ({ name: p.name, chips: p.chips })),
      )
      console.log('Players with chips:', playersWithChips.length)

      // Game should remain active if multiple players have chips
      if (playersWithChips.length > 1) {
        expect(response.body.status).toBe('active')
      } else {
        expect(response.body.status).toBe('completed')
      }
    })
  })

  describe('Authentication Headers Verification', () => {
    it('should return both JWT token and session cookie when player joins', async () => {
      // Create game
      const gameResponse = await request(app).post('/api/games').send({
        smallBlind: 5,
        bigBlind: 10,
        startingChips: 1000,
      })

      expect(gameResponse.status).toBe(201)
      expect(gameResponse.body).toHaveProperty('id')
      expect(gameResponse.body).toHaveProperty('roomCode')

      // Player joins
      const joinResponse = await request(app)
        .post(`/api/games/${gameResponse.body.id}/join`)
        .send({ name: 'AuthTestPlayer', password: 'testpass123' })

      // Verify successful join
      expect(joinResponse.status).toBe(201)
      expect(joinResponse.body).toHaveProperty('player')
      expect(joinResponse.body.player.name).toBe('AuthTestPlayer')

      // Verify JWT token in response body
      expect(joinResponse.body).toHaveProperty('token')
      expect(typeof joinResponse.body.token).toBe('string')
      expect(joinResponse.body.token.length).toBeGreaterThan(20)

      // Verify cookie header exists
      expect(joinResponse.headers).toHaveProperty('set-cookie')
      const setCookieHeader = joinResponse.headers['set-cookie']
      expect(Array.isArray(setCookieHeader)).toBe(true)
      expect(setCookieHeader.length).toBeGreaterThan(0)

      // Verify cookie contains session data
      const sessionCookie = setCookieHeader[0]
      expect(sessionCookie).toContain('holdem=')
      expect(sessionCookie).toContain('path=/')

      // Verify JWT token can be decoded and contains expected fields
      const { verifyToken } = await import('../middleware/auth.js')
      const decoded = verifyToken(joinResponse.body.token)
      expect(decoded).toBeTruthy()
      expect(decoded).toHaveProperty('playerId')
      expect(decoded).toHaveProperty('gameId')
      expect(decoded.playerId).toBe(joinResponse.body.player.id)
      expect(decoded.gameId).toBe(gameResponse.body.id)

      // Test that JWT token works for authenticated requests
      const gameStateResponse = await request(app)
        .get(`/api/games/${gameResponse.body.id}`)
        .set('Authorization', `Bearer ${joinResponse.body.token}`)

      expect(gameStateResponse.status).toBe(200)
      expect(gameStateResponse.body).toHaveProperty('players')
      expect(gameStateResponse.body.players.length).toBe(1)
      expect(gameStateResponse.body.players[0].name).toBe('AuthTestPlayer')

      // Test that session cookie format is correct
      // Note: Cookie-based session testing requires more complex setup with jar
      // so we'll just verify the cookie format is correct
      expect(sessionCookie).toMatch(/^holdem=[^;]+; path=\/; httponly$/)
    })
  })
})
