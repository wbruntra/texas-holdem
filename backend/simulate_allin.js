#!/usr/bin/env bun
/**
 * Test all-in chip duplication bug - Sequential tests with shared DB
 *
 * Note: this is a standalone script (not a bun:test suite).
 */

const dbModule = require('@holdem/database/db')
const db = dbModule.default || dbModule

const { getGameById } = require('./services/game-service')
const { ROUND } = require('./lib/game-constants')

async function runTest(name, chipA, chipB) {
  console.log(`\n   Test: ${name}...`)

  let game = null
  let playerA = null
  let playerB = null

  try {
    const gameService = require('./services/game-service')
    const playerService = require('./services/player-service')
    const actionService = require('./services/action-service')

    // Create game
    game = await gameService.createGame({ smallBlind: 5, bigBlind: 10, startingChips: 1000 })
    playerA = await playerService.joinGame(game.id, 'PlayerA', 'passA')
    playerB = await playerService.joinGame(game.id, 'PlayerB', 'passB')

    // Set chips before start
    await db('players').where({ id: playerA.id }).update({ chips: chipA })
    await db('players').where({ id: playerB.id }).update({ chips: chipB })

    // Start game
    let gameState = await gameService.startGame(game.id)
    gameState = await getGameById(game.id)

    // Play: SB calls, BB raises all-in, SB calls
    await actionService.submitAction(playerA.id, 'call', 0)
    await actionService.submitAction(playerB.id, 'raise', 90)
    await actionService.submitAction(playerA.id, 'call', 0)

    // Advance to showdown
    while (gameState.currentRound !== ROUND.SHOWDOWN) {
      gameState = await gameService.advanceRoundIfReady(game.id)
    }

    gameState = await getGameById(game.id)
    const finalA = gameState.players.find((p) => p.name === 'PlayerA')
    const finalB = gameState.players.find((p) => p.name === 'PlayerB')
    const totalChips = finalA.chips + finalB.chips
    const initialTotal = chipA + chipB

    if (totalChips === initialTotal) {
      console.log(`   ✅ PASS: ${initialTotal} → ${totalChips}`)
      return true
    } else {
      console.log(`   ❌ FAIL: Expected ${initialTotal}, got ${totalChips}`)
      return false
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`)
    return false
  } finally {
    if (game && game.id) {
      try {
        await db('actions')
          .whereIn('player_id', db('players').select('id').where({ game_id: game.id }))
          .delete()
        await db('hands').where({ game_id: game.id }).delete()
        await db('players').where({ game_id: game.id }).delete()
        await db('games').where({ id: game.id }).delete()
      } catch (e) {}
    }
  }
}

async function main() {
  console.log('='.repeat(60))
  console.log('🧪 ALL-IN CHIP DUPLICATION TESTS')
  console.log('='.repeat(60))

  const tests = [
    { name: 'A=200, B=100', a: 200, b: 100 },
    { name: 'A=100, B=200', a: 100, b: 200 },
    { name: 'A=500, B=300', a: 500, b: 300 },
    { name: 'A=1000, B=500', a: 1000, b: 500 },
    { name: 'A=300, B=300', a: 300, b: 300 },
    { name: 'A=50, B=200', a: 50, b: 200 },
    { name: 'A=150, B=50', a: 150, b: 50 },
  ]

  let passed = 0
  let failed = 0

  for (const test of tests) {
    const result = await runTest(test.name, test.a, test.b)
    if (result) passed++
    else failed++
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`📊 RESULTS: ${passed}/${tests.length} passed`)
  console.log('='.repeat(60))
}

main().finally(() => {
  if (typeof db.destroy === 'function') {
    db.destroy()
  }
})
