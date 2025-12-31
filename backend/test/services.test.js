/**
 * Tests for service layer - game, player, and action services
 */

// Set test environment before importing modules
process.env.NODE_ENV = 'test'

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
const db = require('../../db')
const gameService = require('../services/game-service')
const playerService = require('../services/player-service')
const actionService = require('../services/action-service')

// Helper to clean database before each test
async function cleanDatabase() {
  await db('actions').delete()
  await db('hands').delete()
  await db('players').delete()
  await db('games').delete()
}

describe('Game Service', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  test('creates a new game with room code', async () => {
    const game = await gameService.createGame({
      smallBlind: 10,
      bigBlind: 20,
      startingChips: 500,
    })

    expect(game.id).toBeDefined()
    expect(game.roomCode).toBeDefined()
    expect(game.roomCode.length).toBe(6)
    expect(game.status).toBe('waiting')
    expect(game.smallBlind).toBe(10)
    expect(game.bigBlind).toBe(20)
    expect(game.startingChips).toBe(500)
  })

  test('generates unique room codes', async () => {
    const game1 = await gameService.createGame()
    const game2 = await gameService.createGame()

    expect(game1.roomCode).not.toBe(game2.roomCode)
  })

  test('retrieves game by ID', async () => {
    const created = await gameService.createGame()
    const retrieved = await gameService.getGameById(created.id)

    expect(retrieved).toBeDefined()
    expect(retrieved.id).toBe(created.id)
    expect(retrieved.roomCode).toBe(created.roomCode)
  })

  test('retrieves game by room code', async () => {
    const created = await gameService.createGame()
    const retrieved = await gameService.getGameByRoomCode(created.roomCode)

    expect(retrieved).toBeDefined()
    expect(retrieved.id).toBe(created.id)
  })

  test('returns null for non-existent game', async () => {
    const game = await gameService.getGameById('non-existent-id')
    expect(game).toBeNull()
  })

  test('starts a game with at least 2 players', async () => {
    const game = await gameService.createGame()

    // Add players
    await playerService.joinGame(game.id, 'Alice', 'pass1')
    await playerService.joinGame(game.id, 'Bob', 'pass2')

    const started = await gameService.startGame(game.id)

    expect(started.status).toBe('active')
    expect(started.handNumber).toBe(1)
    expect(started.currentRound).toBe('preflop')
    expect(started.pot).toBe(15) // 5 + 10 blinds
    expect(started.players[0].holeCards.length).toBe(2)
    expect(started.players[1].holeCards.length).toBe(2)
  })

  test('throws error when starting game with fewer than 2 players', async () => {
    const game = await gameService.createGame()
    await playerService.joinGame(game.id, 'Alice', 'pass1')

    await expect(gameService.startGame(game.id)).rejects.toThrow('Need at least 2 players')
  })

  test('throws error when starting already active game', async () => {
    const game = await gameService.createGame()
    await playerService.joinGame(game.id, 'Alice', 'pass1')
    await playerService.joinGame(game.id, 'Bob', 'pass2')

    await gameService.startGame(game.id)

    await expect(gameService.startGame(game.id)).rejects.toThrow('already started')
  })

  test('deletes a game', async () => {
    const game = await gameService.createGame()
    await gameService.deleteGame(game.id)

    const retrieved = await gameService.getGameById(game.id)
    expect(retrieved).toBeNull()
  })
})

describe('Player Service', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  test('joins a game', async () => {
    const game = await gameService.createGame()
    const player = await playerService.joinGame(game.id, 'Alice', 'pass1')

    expect(player.id).toBeDefined()
    expect(player.name).toBe('Alice')
    expect(player.position).toBe(0)
    expect(player.chips).toBe(1000)
  })

  test('assigns sequential positions to players', async () => {
    const game = await gameService.createGame()
    const player1 = await playerService.joinGame(game.id, 'Alice', 'pass1')
    const player2 = await playerService.joinGame(game.id, 'Bob', 'pass2')
    const player3 = await playerService.joinGame(game.id, 'Charlie', 'pass3')

    expect(player1.position).toBe(0)
    expect(player2.position).toBe(1)
    expect(player3.position).toBe(2)
  })

  test('prevents duplicate player names', async () => {
    const game = await gameService.createGame()
    await playerService.joinGame(game.id, 'Alice', 'pass1')

    await expect(playerService.joinGame(game.id, 'Alice', 'pass1')).rejects.toThrow(
      'already taken',
    )
  })

  test('prevents joining game that has started', async () => {
    const game = await gameService.createGame()
    await playerService.joinGame(game.id, 'Alice', 'pass1')
    await playerService.joinGame(game.id, 'Bob', 'pass2')
    await gameService.startGame(game.id)

    await expect(playerService.joinGame(game.id, 'Charlie', 'pass3')).rejects.toThrow(
      'already started',
    )
  })

  test('enforces 10 player limit', async () => {
    const game = await gameService.createGame()

    // Add 10 players
    for (let i = 0; i < 10; i++) {
      await playerService.joinGame(game.id, `Player${i}`, 'password')
    }

    // 11th player should fail
    await expect(playerService.joinGame(game.id, 'Player11', 'password')).rejects.toThrow('full')
  })

  test('retrieves player by ID', async () => {
    const game = await gameService.createGame()
    const created = await playerService.joinGame(game.id, 'Alice', 'pass1')
    const retrieved = await playerService.getPlayerById(created.id)

    expect(retrieved).toBeDefined()
    expect(retrieved.id).toBe(created.id)
    expect(retrieved.name).toBe('Alice')
  })

  test('authenticates player with correct password', async () => {
    const game = await gameService.createGame()
    await playerService.joinGame(game.id, 'Alice', 'mypassword')

    const authenticated = await playerService.authenticatePlayer(game.id, 'Alice', 'mypassword')
    expect(authenticated).toBeDefined()
    expect(authenticated.name).toBe('Alice')
  })

  test('rejects authentication with wrong password', async () => {
    const game = await gameService.createGame()
    await playerService.joinGame(game.id, 'Alice', 'mypassword')

    await expect(
      playerService.authenticatePlayer(game.id, 'Alice', 'wrongpassword'),
    ).rejects.toThrow('Invalid credentials')
  })

  test('rejects authentication for non-existent player', async () => {
    const game = await gameService.createGame()

    await expect(
      playerService.authenticatePlayer(game.id, 'Alice', 'anypassword'),
    ).rejects.toThrow('Invalid credentials')
  })

  test('requires password with minimum length', async () => {
    const game = await gameService.createGame()

    await expect(playerService.joinGame(game.id, 'Alice', 'abc')).rejects.toThrow(
      'at least 4 characters',
    )
  })

  test('removes player from waiting game', async () => {
    const game = await gameService.createGame()
    const player = await playerService.joinGame(game.id, 'Alice', 'pass1')

    await playerService.leaveGame(player.id)

    const retrieved = await playerService.getPlayerById(player.id)
    expect(retrieved).toBeNull()
  })

  test('marks player as disconnected in active game', async () => {
    const game = await gameService.createGame()
    const player1 = await playerService.joinGame(game.id, 'Alice', 'pass1')
    const player2 = await playerService.joinGame(game.id, 'Bob', 'pass2')

    await gameService.startGame(game.id)
    await playerService.leaveGame(player1.id)

    const retrieved = await playerService.getPlayerById(player1.id)
    expect(retrieved).toBeDefined()
    expect(retrieved.connected).toBe(false)
  })

  test('gets all players in a game', async () => {
    const game = await gameService.createGame()
    await playerService.joinGame(game.id, 'Alice', 'pass1')
    await playerService.joinGame(game.id, 'Bob', 'pass2')
    await playerService.joinGame(game.id, 'Charlie', 'pass3')

    const players = await playerService.getAllPlayersInGame(game.id)

    expect(players.length).toBe(3)
    expect(players[0].name).toBe('Alice')
    expect(players[1].name).toBe('Bob')
    expect(players[2].name).toBe('Charlie')
  })
})

describe('Action Service', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  test('submits a valid fold action', async () => {
    const game = await gameService.createGame()
    const player1 = await playerService.joinGame(game.id, 'Alice', 'pass1')
    const player2 = await playerService.joinGame(game.id, 'Bob', 'pass2')

    await gameService.startGame(game.id)

    // In heads-up, player 0 (dealer/small blind) acts first
    const gameState = await gameService.getGameById(game.id)
    const firstPlayer = gameState.players[gameState.currentPlayerPosition]
    const playerObj = firstPlayer.id === player1.id ? player1 : player2

    const result = await actionService.submitAction(playerObj.id, 'fold')

    expect(result).toBeDefined()
    const updatedPlayer = result.players.find((p) => p.id === playerObj.id)
    expect(updatedPlayer.status).toBe('folded')
  })

  test('submits a valid call action', async () => {
    const game = await gameService.createGame({ startingChips: 1000 })
    const player1 = await playerService.joinGame(game.id, 'Alice', 'pass1')
    const player2 = await playerService.joinGame(game.id, 'Bob', 'pass2')

    await gameService.startGame(game.id)

    const gameState = await gameService.getGameById(game.id)
    const firstPlayer = gameState.players[gameState.currentPlayerPosition]
    const playerObj = firstPlayer.id === player1.id ? player1 : player2
    const initialChips = firstPlayer.chips

    const result = await actionService.submitAction(playerObj.id, 'call')

    const updatedPlayer = result.players.find((p) => p.id === playerObj.id)
    expect(updatedPlayer.chips).toBeLessThan(initialChips)
  })

  test('submits a valid raise action', async () => {
    const game = await gameService.createGame({ startingChips: 1000 })
    const player1 = await playerService.joinGame(game.id, 'Alice', 'pass1')
    const player2 = await playerService.joinGame(game.id, 'Bob', 'pass2')

    await gameService.startGame(game.id)

    const gameState = await gameService.getGameById(game.id)
    const firstPlayer = gameState.players[gameState.currentPlayerPosition]
    const playerObj = firstPlayer.id === player1.id ? player1 : player2

    const result = await actionService.submitAction(playerObj.id, 'raise', 20)

    expect(result.currentBet).toBeGreaterThan(10)
  })

  test("rejects action when not player's turn", async () => {
    const game = await gameService.createGame()
    const player1 = await playerService.joinGame(game.id, 'Alice', 'pass1')
    const player2 = await playerService.joinGame(game.id, 'Bob', 'pass2')

    await gameService.startGame(game.id)

    const gameState = await gameService.getGameById(game.id)
    const notCurrentPlayer = gameState.players.find(
      (_, idx) => idx !== gameState.currentPlayerPosition,
    )
    const playerObj = notCurrentPlayer.id === player1.id ? player1 : player2

    await expect(actionService.submitAction(playerObj.id, 'fold')).rejects.toThrow('Not your turn')
  })

  test('gets valid actions for current player', async () => {
    const game = await gameService.createGame()
    const player1 = await playerService.joinGame(game.id, 'Alice', 'pass1')
    const player2 = await playerService.joinGame(game.id, 'Bob', 'pass2')

    await gameService.startGame(game.id)

    const gameState = await gameService.getGameById(game.id)
    const firstPlayer = gameState.players[gameState.currentPlayerPosition]
    const playerObj = firstPlayer.id === player1.id ? player1 : player2

    const actions = await actionService.getPlayerValidActions(playerObj.id)

    expect(actions.canAct).toBe(true)
    expect(actions.canFold).toBe(true)
    expect(actions.canCall).toBe(true)
  })

  test('advances to flop after preflop betting complete', async () => {
    const game = await gameService.createGame()
    const player1 = await playerService.joinGame(game.id, 'Alice', 'pass1')
    const player2 = await playerService.joinGame(game.id, 'Bob', 'pass2')

    await gameService.startGame(game.id)

    // Get initial state
    let gameState = await gameService.getGameById(game.id)
    expect(gameState.currentRound).toBe('preflop')

    // First player calls
    const firstPlayer = gameState.players[gameState.currentPlayerPosition]
    const playerObj1 = firstPlayer.id === player1.id ? player1 : player2

    gameState = await actionService.submitAction(playerObj1.id, 'call')

    // Second player checks
    const secondPlayer = gameState.players[gameState.currentPlayerPosition]
    const playerObj2 = secondPlayer.id === player1.id ? player1 : player2

    gameState = await actionService.submitAction(playerObj2.id, 'check')

    // Should advance to flop
    expect(gameState.currentRound).toBe('flop')
    expect(gameState.communityCards.length).toBe(3)
  })

  test('completes full hand to showdown', async () => {
    const game = await gameService.createGame()
    const player1 = await playerService.joinGame(game.id, 'Alice', 'pass1')
    const player2 = await playerService.joinGame(game.id, 'Bob', 'pass2')

    await gameService.startGame(game.id)

    let gameState = await gameService.getGameById(game.id)

    // Helper to complete a betting round by checking/calling (never fold)
    async function completeBettingRound() {
      const startingRound = gameState.currentRound
      let iterationCount = 0
      const maxIterations = 10 // Safety limit

      // Note: `currentPlayerPosition` typically stays non-null across a round transition.
      // Stop once the round changes.
      while (
        gameState.currentPlayerPosition !== null &&
        gameState.currentRound === startingRound &&
        iterationCount < maxIterations
      ) {
        iterationCount++
        const currentPlayer = gameState.players[gameState.currentPlayerPosition]
        const playerObj = currentPlayer.id === player1.id ? player1 : player2
        const actions = await actionService.getPlayerValidActions(playerObj.id)

        // Prefer check, then call
        if (actions.canCheck) {
          gameState = await actionService.submitAction(playerObj.id, 'check')
        } else if (actions.canCall) {
          gameState = await actionService.submitAction(playerObj.id, 'call')
        } else {
          // This shouldn't happen if game logic is correct
          throw new Error(
            `No valid check or call action for player at position ${gameState.currentPlayerPosition}`,
          )
        }
      }

      if (iterationCount >= maxIterations) {
        throw new Error('Betting round did not complete within max iterations')
      }
    }

    // Complete preflop
    await completeBettingRound()
    expect(gameState.currentRound).toBe('flop')

    // Complete flop
    await completeBettingRound()
    expect(gameState.currentRound).toBe('turn')

    // Complete turn
    await completeBettingRound()
    expect(gameState.currentRound).toBe('river')

    // Complete river
    await completeBettingRound()
    expect(gameState.currentRound).toBe('showdown')

    // Should have winners
    expect(gameState.winners).toBeDefined()
    expect(gameState.winners.length).toBeGreaterThan(0)
  })
})
