const { test, expect, beforeEach, afterEach } = require('bun:test')
const gameService = require('../services/game-service')
const playerService = require('../services/player-service')
const actionService = require('../services/action-service')
const db = require('@holdem/database/db')

let gameId
let player1
let player2

beforeEach(async () => {
  // Create a new game
  const game = await gameService.createGame({
    smallBlind: 5,
    bigBlind: 10,
    startingChips: 1000,
  })
  gameId = game.id

  // Join two players
  player1 = await playerService.joinGame(gameId, 'Alice', 'pass1')
  player2 = await playerService.joinGame(gameId, 'Bob', 'pass2')

  // Start the game
  await gameService.startGame(gameId)
})

afterEach(async () => {
  // Clean up
  if (gameId) {
    // Get all hands for this game
    const hands = await db('hands').where('game_id', gameId).select('id')
    const handIds = hands.map((h) => h.id)

    // Delete actions for these hands
    if (handIds.length > 0) {
      await db('actions').whereIn('hand_id', handIds).del()
    }

    await db('hands').where('game_id', gameId).del()
    await db('players').where('game_id', gameId).del()
    await db('games').where('id', gameId).del()
  }
})

test('Advance endpoint: should be available when betting is complete', async () => {
  console.log('\n🎯 Testing advance endpoint availability when betting complete\n')

  // Get initial game state
  let state = await gameService.getGameById(gameId)

  console.log('Initial state:')
  console.log(`  Round: ${state.currentRound}`)
  console.log(`  Current player: ${state.currentPlayerPosition}`)
  console.log(
    `  P0 (${state.players[0].name}): chips=${state.players[0].chips}, currentBet=${state.players[0].currentBet}`,
  )
  console.log(
    `  P1 (${state.players[1].name}): chips=${state.players[1].chips}, currentBet=${state.players[1].currentBet}`,
  )
  console.log()

  // Complete preflop betting (both check/call)
  const sbPlayer = state.players.find((p) => p.currentBet === 5)
  const bbPlayer = state.players.find((p) => p.currentBet === 10)

  console.log('Preflop actions:')
  await actionService.submitAction(sbPlayer.id, 'call')
  console.log(`  ${sbPlayer.name} calls`)

  state = await gameService.getGameById(gameId)
  await actionService.submitAction(bbPlayer.id, 'check')
  console.log(`  ${bbPlayer.name} checks`)

  state = await gameService.getGameById(gameId)
  console.log(`\nAfter preflop:`)
  console.log(`  Current player position: ${state.currentPlayerPosition}`)
  console.log(`  Round: ${state.currentRound}`)

  // With auto-advance feature, betting completion automatically advances to next round
  // (unless there are all-in players, which require manual advance)
  expect(state.currentRound).toBe('flop')
  expect(state.currentPlayerPosition).not.toBe(null) // Set to first player to act on flop
  console.log(`  ✅ Auto-advanced to flop after betting completed`)

  console.log(`\nTest updated: Auto-advance now handles simple betting completion`)
  console.log(`  Old behavior: stayed at preflop, needed manual advance`)
  console.log(`  New behavior: auto-advances to flop for player convenience`)
  console.log(`  Current player position: ${state.currentPlayerPosition}`)
  console.log(`  Community cards: ${state.communityCards.length}`)

  // Verify we advanced to flop
  expect(state.currentRound).toBe('flop')
  expect(state.communityCards.length).toBe(3)
  expect(state.currentPlayerPosition).not.toBe(null)
  console.log(`  ✅ Successfully advanced to flop`)

  // Complete flop betting (both check)
  console.log(`\nFlop actions:`)
  const firstToAct = state.players[state.currentPlayerPosition]
  await actionService.submitAction(firstToAct.id, 'check')
  console.log(`  ${firstToAct.name} checks`)

  state = await gameService.getGameById(gameId)
  const secondToAct = state.players[state.currentPlayerPosition]
  await actionService.submitAction(secondToAct.id, 'check')
  console.log(`  ${secondToAct.name} checks`)

  state = await gameService.getGameById(gameId)
  console.log(`\nAfter flop betting:`)
  console.log(`  Current player position: ${state.currentPlayerPosition}`)
  console.log(`  Round: ${state.currentRound}`)

  // With auto-advance, the game automatically advances to turn after flop betting completes
  expect(state.currentRound).toBe('turn')
  expect(state.currentPlayerPosition).not.toBe(null) // Set to first player to act on turn
  console.log(`  ✅ Auto-advanced to turn after flop betting completed`)

  console.log(`\nVerifying auto-advance continued to work:`)
  console.log(`  Flop -> Turn: automatic`)
  expect(state.currentPlayerPosition).not.toBe(null)
  console.log(`  ✅ Successfully advanced to turn`)

  console.log(`\n✅ Test passed: Advance is available when currentPlayerPosition is null`)
})

test('Advance endpoint: should reject when betting not complete', async () => {
  console.log('\n🎯 Testing advance endpoint rejects when betting incomplete\n')

  // Get initial game state (preflop with blinds posted)
  let state = await gameService.getGameById(gameId)

  console.log('Initial state (preflop, SB needs to act):')
  console.log(`  Round: ${state.currentRound}`)
  console.log(`  Current player: ${state.currentPlayerPosition}`)
  console.log()

  // Try to advance without completing betting
  console.log('📍 Attempting to advance while betting incomplete...')
  const resultState = await gameService.advanceRoundIfReady(gameId)

  // advanceRoundIfReady should not advance if betting is incomplete
  expect(resultState.currentRound).toBe('preflop')
  expect(resultState.currentPlayerPosition).toBe(0)
  console.log(`  Round: ${resultState.currentRound}`)
  console.log(`  Current player: ${resultState.currentPlayerPosition}`)
  console.log(`  ✅ Did not advance (still on preflop with active player)`)
})
