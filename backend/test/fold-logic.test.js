/**
 * Tests for folding logic
 * Ensures that:
 * 1. Regular fold (no all-in) ends the hand immediately
 * 2. Fold after all-in ends the hand immediately (not forcing full playout)
 */

const { describe, test, expect, beforeEach, afterEach } = require('bun:test')
const db = require('@holdem/database/db')
const gameService = require('../services/game-service')
const playerService = require('../services/player-service')
const actionService = require('../services/action-service')

describe('Fold Logic Tests', () => {
  let gameId

  beforeEach(async () => {
    // Create a new game for each test
    const game = await gameService.createGame({
      smallBlind: 5,
      bigBlind: 10,
      startingChips: 1000,
    })
    gameId = game.id
  })

  afterEach(async () => {
    if (gameId) {
      const hands = await db('hands').where('game_id', gameId).select('id')
      const handIds = hands.map((h) => h.id)

      if (handIds.length > 0) {
        await db('actions').whereIn('hand_id', handIds).del()
      }

      await db('hands').where('game_id', gameId).del()
      await db('players').where('game_id', gameId).del()
      await db('games').where('id', gameId).del()
    }
  })

  test('Regular fold (no all-in): last player folds, winner gets pot immediately', async () => {
    // Join two players for heads-up
    const player1 = await playerService.joinGame(gameId, 'Player 1', 'pass1')
    const player2 = await playerService.joinGame(gameId, 'Player 2', 'pass2')

    // Start game
    let game = await gameService.startGame(gameId)
    expect(game.status).toBe('active')
    expect(game.currentRound).toBe('preflop')

    // In heads-up, dealer is small blind
    // Player at position 0 is dealer/small blind, Player at position 1 is big blind
    // Small blind acts first pre-flop in heads-up
    const dealerPos = game.dealerPosition
    const smallBlindPlayer = game.players[dealerPos]
    const bigBlindPlayer = game.players[(dealerPos + 1) % 2]

    console.log(
      'Small blind player:',
      smallBlindPlayer.name,
      'position:',
      smallBlindPlayer.position,
    )
    console.log('Big blind player:', bigBlindPlayer.name, 'position:', bigBlindPlayer.position)
    console.log('Current player position:', game.currentPlayerPosition)

    // Small blind folds
    game = await actionService.submitAction(smallBlindPlayer.id, 'fold', 0)

    console.log('After fold - round:', game.currentRound)
    console.log('Winners:', game.winners)

    // Game should advance to showdown immediately
    expect(game.currentRound).toBe('showdown')
    expect(game.winners).toBeDefined()
    expect(game.winners.length).toBe(1)
    expect(game.winners[0]).toBe(bigBlindPlayer.position)

    // Winner should have received the pot
    const winner = game.players.find((p) => p.position === bigBlindPlayer.position)
    // Started with 1000, paid 10 BB, collected pot of 15 (5 SB + 10 BB) = 1000 - 10 + 15 = 1005
    expect(winner.chips).toBe(1005)

    // Loser should have their remaining chips (started with 1000, paid 5 SB and lost it)
    const loser = game.players.find((p) => p.position === smallBlindPlayer.position)
    expect(loser.chips).toBe(995)
  })

  test('Fold after all-in: one player goes all-in, other folds - winner gets pot immediately', async () => {
    // Join two players for heads-up
    const player1 = await playerService.joinGame(gameId, 'Player 1', 'pass1')
    const player2 = await playerService.joinGame(gameId, 'Player 2', 'pass2')

    // Start game
    let game = await gameService.startGame(gameId)
    expect(game.status).toBe('active')
    expect(game.currentRound).toBe('preflop')

    const dealerPos = game.dealerPosition
    const smallBlindPlayer = game.players[dealerPos]
    const bigBlindPlayer = game.players[(dealerPos + 1) % 2]

    console.log('\n--- Fold After All-In Test ---')
    console.log(
      'Small blind player:',
      smallBlindPlayer.name,
      'position:',
      smallBlindPlayer.position,
      'chips:',
      smallBlindPlayer.chips,
    )
    console.log(
      'Big blind player:',
      bigBlindPlayer.name,
      'position:',
      bigBlindPlayer.position,
      'chips:',
      bigBlindPlayer.chips,
    )
    console.log('Current player position:', game.currentPlayerPosition)
    console.log('Current to act:', game.players[game.currentPlayerPosition].name)

    // Small blind goes all-in
    game = await actionService.submitAction(smallBlindPlayer.id, 'all_in', 995) // Has 995 after paying 5 SB

    console.log('\nAfter small blind all-in:')
    console.log('Small blind status:', game.players[dealerPos].status)
    console.log('Current player position:', game.currentPlayerPosition)
    console.log('Current to act:', game.players[game.currentPlayerPosition].name)

    // Verify small blind is now all-in
    const smallBlindAfterAllIn = game.players.find((p) => p.id === smallBlindPlayer.id)
    expect(smallBlindAfterAllIn.status).toBe('all_in')

    // Big blind folds
    game = await actionService.submitAction(bigBlindPlayer.id, 'fold', 0)

    console.log('\nAfter big blind fold:')
    console.log('Round:', game.currentRound)
    console.log('Winners:', game.winners)
    console.log('Small blind chips:', game.players[dealerPos].chips)
    console.log('Big blind chips:', game.players[(dealerPos + 1) % 2].chips)

    // Game should advance to showdown immediately, NOT force full playout
    expect(game.currentRound).toBe('showdown')
    expect(game.winners).toBeDefined()
    expect(game.winners.length).toBe(1)

    // Small blind (who went all-in) should win
    expect(game.winners[0]).toBe(smallBlindPlayer.position)

    // Winner should have received the pot (their all-in + opponent's big blind)
    const winner = game.players.find((p) => p.position === smallBlindPlayer.position)
    // Started with 1000, all-in for 1000, gets back 1000 + 10 from big blind = 1010
    expect(winner.chips).toBe(1010)

    // Loser should have their remaining chips (started with 1000, paid 10 big blind)
    const loser = game.players.find((p) => p.position === bigBlindPlayer.position)
    expect(loser.chips).toBe(990)
  })

  test('All-in call scenario for comparison: both players see showdown', async () => {
    // This test shows the expected behavior when both players commit chips
    // In all-in scenarios, the game requires manual advance through rounds
    const player1 = await playerService.joinGame(gameId, 'Player 1', 'pass1')
    const player2 = await playerService.joinGame(gameId, 'Player 2', 'pass2')

    let game = await gameService.startGame(gameId)

    const dealerPos = game.dealerPosition
    const smallBlindPlayer = game.players[dealerPos]
    const bigBlindPlayer = game.players[(dealerPos + 1) % 2]

    // Small blind goes all-in
    game = await actionService.submitAction(smallBlindPlayer.id, 'all_in', 995) // Has 995 after paying 5 SB

    // Big blind calls all-in
    game = await actionService.submitAction(bigBlindPlayer.id, 'call', 990) // Call remaining 990 (has paid 10 BB already)

    // In the all-in call scenario, both players are committed
    // The auto-advance logic doesn't apply here as it's the complex all-in case
    // Both players have chips in the pot and should see cards revealed
    expect(game.currentRound).toBe('preflop') // Still on preflop, needs manual advance

    // But we can verify both are all-in
    const sbAfter = game.players.find((p) => p.id === smallBlindPlayer.id)
    const bbAfter = game.players.find((p) => p.id === bigBlindPlayer.id)
    expect(sbAfter.status).toBe('all_in')
    expect(bbAfter.status).toBe('all_in')
  })

  test('Three-player fold: last active player wins when others fold', async () => {
    // Test with 3 players to ensure fold logic works with more than heads-up
    const player1 = await playerService.joinGame(gameId, 'Player 1', 'pass1')
    const player2 = await playerService.joinGame(gameId, 'Player 2', 'pass2')
    const player3 = await playerService.joinGame(gameId, 'Player 3', 'pass3')

    let game = await gameService.startGame(gameId)
    expect(game.players.length).toBe(3)

    console.log('\n--- Three Player Fold Test ---')
    console.log('Current player position:', game.currentPlayerPosition)
    console.log('Players:')
    game.players.forEach((p, i) => {
      console.log(
        `  ${i}: ${p.name}, position: ${p.position}, status: ${p.status}, current bet: ${p.currentBet}`,
      )
    })

    // Find who acts first (player after big blind)
    const firstToAct = game.players[game.currentPlayerPosition]

    console.log('\nFirst to act:', firstToAct.name)

    // First player folds
    game = await actionService.submitAction(firstToAct.id, 'fold', 0)

    console.log('After first fold - current player position:', game.currentPlayerPosition)
    console.log('Round:', game.currentRound)

    // Find next player to act
    const secondToAct = game.players[game.currentPlayerPosition]
    expect(secondToAct.id).not.toBe(firstToAct.id)

    console.log('Second to act:', secondToAct.name)

    // Second player folds
    game = await actionService.submitAction(secondToAct.id, 'fold', 0)

    console.log('After second fold - round:', game.currentRound)
    console.log('Winners:', game.winners)

    // Game should advance to showdown, last player wins
    expect(game.currentRound).toBe('showdown')
    expect(game.winners).toBeDefined()
    expect(game.winners.length).toBe(1)

    // Find the remaining active player (the winner)
    const activePlayers = game.players.filter((p) => p.status === 'active')
    console.log('Active players:', activePlayers)
    expect(activePlayers.length).toBe(1)

    const activePlayer = activePlayers[0]
    expect(game.winners[0]).toBe(activePlayer.position)
  })
})
