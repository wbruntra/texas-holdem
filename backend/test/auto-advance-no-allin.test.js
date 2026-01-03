const { test, expect, beforeEach, afterEach } = require('bun:test')
const gameService = require('../services/game-service')
const playerService = require('../services/player-service')
const actionService = require('../services/action-service')
const db = require('@holdem/database/db')

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

test('Auto-advance on normal betting completion (no all-ins)', async () => {
  console.log('\n🎯 Testing auto-advance when no all-ins and betting completes\n')

  let state = await gameService.getGameById(gameId)

  const sbPlayer = state.players.find((p) => p.currentBet === 5)
  const bbPlayer = state.players.find((p) => p.currentBet === 10)

  console.log('Initial state: preflop with blinds')
  console.log(`  ${sbPlayer.name}: ${sbPlayer.chips} chips`)
  console.log(`  ${bbPlayer.name}: ${bbPlayer.chips} chips\n`)

  // SB calls
  state = await actionService.submitAction(sbPlayer.id, 'call', 0)
  console.log(`${sbPlayer.name} calls`)
  console.log(`  Current player position: ${state.currentPlayerPosition}`)
  console.log(`  Round: ${state.currentRound}\n`)

  // BB checks
  console.log(`${bbPlayer.name} checks`)
  state = await actionService.submitAction(bbPlayer.id, 'check', 0)
  console.log(`  Current player position: ${state.currentPlayerPosition}`)
  console.log(`  Round: ${state.currentRound}`)
  console.log(`  Community cards: ${state.communityCards.length}`)

  // KEY TEST: After BB checks with no all-ins, it should auto-advance to FLOP
  // NOT stay at PREFLOP waiting for manual /advance call
  // Note: currentPlayerPosition will be set to first player to act on flop (not null)
  expect(state.currentRound).toBe('flop') // Should be at flop, not preflop!
  expect(state.communityCards.length).toBe(3) // Flop should be revealed
  expect(state.currentPlayerPosition).not.toBeNull() // Ready for next betting round

  console.log('\n✅ Auto-advanced to flop after check-check (no manual advance needed!)\n')

  // Now test another round: both check on flop
  console.log(`Both players check on flop...`)

  // After advancing to flop, currentPlayerPosition should be set to first to act
  let currentPos = state.currentPlayerPosition
  const firstPlayer = state.players[currentPos]
  const secondPos = (currentPos + 1) % 2
  const secondPlayer = state.players[secondPos]

  state = await actionService.submitAction(firstPlayer.id, 'check', 0)
  expect(state.currentRound).toBe('flop') // Still on flop, waiting for second player

  state = await actionService.submitAction(secondPlayer.id, 'check', 0)
  console.log(`  Round after second check: ${state.currentRound}`)
  console.log(`  Community cards: ${state.communityCards.length}\n`)

  // Should auto-advance to turn
  expect(state.currentRound).toBe('turn')
  expect(state.communityCards.length).toBe(4)

  console.log('✅ Auto-advanced to turn after check-check on flop\n')
})
