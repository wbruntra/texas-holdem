const { test, expect, beforeEach, afterEach } = require('bun:test')
const gameService = require('../services/game-service')
const playerService = require('../services/player-service')
const actionService = require('../services/action-service')
const db = require('../../db')

let gameId
let player1
let player2

beforeEach(async () => {
  const game = await gameService.createGame({
    smallBlind: 5,
    bigBlind: 10,
    startingChips: 1000,
  })
  gameId = game.id

  player1 = await playerService.joinGame(gameId, 'Alice', 'pass1')
  player2 = await playerService.joinGame(gameId, 'Bob', 'pass2')

  await gameService.startGame(gameId)
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

test('Manual advance with both all-in should go one round at a time', async () => {
  console.log('\n🎯 Testing manual advance with all-in players\n')

  let state = await gameService.getGameById(gameId)

  const sbPlayer = state.players.find((p) => p.currentBet === 5)
  const bbPlayer = state.players.find((p) => p.currentBet === 10)

  console.log('Initial state: preflop with blinds')
  console.log(`  ${sbPlayer.name}: ${sbPlayer.chips} chips`)
  console.log(`  ${bbPlayer.name}: ${bbPlayer.chips} chips\n`)

  // SB goes all-in
  await actionService.submitAction(sbPlayer.id, 'raise', 990)
  state = await gameService.getGameById(gameId)
  console.log(`${sbPlayer.name} goes all-in`)
  console.log(`  Status: ${state.players[sbPlayer.position].status}\n`)

  // BB calls all-in
  await actionService.submitAction(bbPlayer.id, 'call')
  state = await gameService.getGameById(gameId)

  console.log(`${bbPlayer.name} calls all-in`)
  console.log(`  Status: ${state.players[bbPlayer.position].status}`)
  console.log(`  Current player position: ${state.currentPlayerPosition}`)
  console.log(`  Round: ${state.currentRound}\n`)

  expect(state.currentPlayerPosition).toBe(null)
  expect(state.currentRound).toBe('preflop')

  // Manually advance ONE round
  console.log('Manually advancing (click "Deal Flop")')
  state = await gameService.advanceOneRound(gameId)

  console.log(`  Round after advance: ${state.currentRound}`)
  console.log(`  Community cards: ${state.communityCards.length}`)
  console.log(`  Current player position: ${state.currentPlayerPosition}\n`)

  expect(state.currentRound).toBe('flop')
  expect(state.communityCards.length).toBe(3)
  expect(state.currentPlayerPosition).toBe(null) // Still null, both all-in

  // Manually advance again
  console.log('Manually advancing again (click "Deal Turn")')
  state = await gameService.advanceOneRound(gameId)

  console.log(`  Round after advance: ${state.currentRound}`)
  console.log(`  Community cards: ${state.communityCards.length}`)
  console.log(`  Current player position: ${state.currentPlayerPosition}\n`)

  expect(state.currentRound).toBe('turn')
  expect(state.communityCards.length).toBe(4)

  // Manually advance again
  console.log('Manually advancing again (click "Deal River")')
  state = await gameService.advanceOneRound(gameId)

  console.log(`  Round after advance: ${state.currentRound}`)
  console.log(`  Community cards: ${state.communityCards.length}`)
  console.log(`  Current player position: ${state.currentPlayerPosition}\n`)

  expect(state.currentRound).toBe('river')
  expect(state.communityCards.length).toBe(5)

  // Manually advance to showdown
  console.log('Manually advancing to showdown (click "Go to Showdown")')
  state = await gameService.advanceOneRound(gameId)

  console.log(`  Round after advance: ${state.currentRound}`)
  console.log(`  Current player position: ${state.currentPlayerPosition}`)
  console.log(`  Winners: ${state.winners}\n`)

  expect(state.currentRound).toBe('showdown')
  expect(state.winners).toBeDefined()

  console.log('✅ Successfully advanced one round at a time through all streets')
})
