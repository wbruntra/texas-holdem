const { test, expect, beforeEach, afterEach } = require('bun:test')
const gameService = require('../services/game-service')
const playerService = require('../services/player-service')
const actionService = require('../services/action-service')
const db = require('@holdem/root/db')

let gameId
let player1
let player2

beforeEach(async () => {
  // Create a new game with same settings as GDJQVJ
  const game = await gameService.createGame({
    smallBlind: 5,
    bigBlind: 10,
    startingChips: 1000,
  })
  gameId = game.id

  // Join two players
  player1 = await playerService.joinGame(gameId, 'Bill', 'pass1')
  player2 = await playerService.joinGame(gameId, 'Jimmy', 'pass2')

  // Start the game
  await gameService.startGame(gameId)
})

afterEach(async () => {
  // Clean up
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

test('Bug: Overbet raise causes chip accounting error', async () => {
  console.log('\n🎯 Reproducing GDJQVJ overbet bug\n')

  // Get initial game state
  let state = await gameService.getGameById(gameId)

  console.log('Initial state:')
  console.log(
    `  P0 (${state.players[0].name}/dealer/SB): chips=${state.players[0].chips}, currentBet=${state.players[0].currentBet}`,
  )
  console.log(
    `  P1 (${state.players[1].name}/BB): chips=${state.players[1].chips}, currentBet=${state.players[1].currentBet}`,
  )
  console.log(`  Pot: ${state.pot}`)
  console.log('')

  const p0 = state.players[0]
  const p1 = state.players[1]

  // Determine who acts first (SB acts first preflop in heads-up)
  const sbPlayer = state.players.find((p) => p.currentBet === 5)
  const bbPlayer = state.players.find((p) => p.currentBet === 10)

  console.log(`  SB is ${sbPlayer.name} (P${sbPlayer.position})`)
  console.log(`  BB is ${bbPlayer.name} (P${bbPlayer.position})`)
  console.log(`  Current player to act: P${state.currentPlayerPosition}`)
  console.log('')

  // SB (P0) calls first
  console.log('Action 1: SB calls')
  await actionService.submitAction(sbPlayer.id, 'call')

  state = await gameService.getGameById(gameId)
  console.log(
    `  P0: chips=${state.players[0].chips}, currentBet=${state.players[0].currentBet}, totalBet=${state.players[0].totalBet}`,
  )
  console.log(
    `  P1: chips=${state.players[1].chips}, currentBet=${state.players[1].currentBet}, totalBet=${state.players[1].totalBet}`,
  )
  console.log(`  Pot: ${state.pot}, Current bet: ${state.currentBet}`)
  console.log('')

  // BB (P1) raises by $20
  console.log('Action 2: BB raises by $20')
  await actionService.submitAction(bbPlayer.id, 'raise', 20)

  state = await gameService.getGameById(gameId)
  console.log(
    `  P0: chips=${state.players[0].chips}, currentBet=${state.players[0].currentBet}, totalBet=${state.players[0].totalBet}`,
  )
  console.log(
    `  P1: chips=${state.players[1].chips}, currentBet=${state.players[1].currentBet}, totalBet=${state.players[1].totalBet}`,
  )
  console.log(`  Pot: ${state.pot}, Current bet: ${state.currentBet}`)
  console.log('')

  // SB tries to raise by $974 (overbet - only has $985 left)
  console.log('Action 3: SB tries to raise by $974 (OVERBET)')
  console.log(`  SB has ${state.players[sbPlayer.position].chips} chips`)
  console.log(`  To call: ${state.currentBet - state.players[sbPlayer.position].currentBet}`)
  console.log(
    `  To raise by 974: needs ${state.currentBet - state.players[sbPlayer.position].currentBet + 974}`,
  )
  console.log(`  But only has ${state.players[sbPlayer.position].chips} chips!`)
  console.log('')

  await actionService.submitAction(sbPlayer.id, 'raise', 974)

  state = await gameService.getGameById(gameId)
  console.log(`  After SB raises:`)
  console.log(
    `  P0: chips=${state.players[0].chips}, currentBet=${state.players[0].currentBet}, totalBet=${state.players[0].totalBet}, status=${state.players[0].status}`,
  )
  console.log(
    `  P1: chips=${state.players[1].chips}, currentBet=${state.players[1].currentBet}, totalBet=${state.players[1].totalBet}`,
  )
  console.log(`  Pot: ${state.pot}, Current bet: ${state.currentBet}`)
  console.log('')

  // Check SB went all-in
  expect(state.players[sbPlayer.position].chips).toBe(0)
  expect(state.players[sbPlayer.position].status).toBe('all_in')

  // SB should have bet exactly 985 more (10 so far + 985 = 995 total) ... wait no
  // SB started with 995 chips, bet 5, then called 5, so has 985 left
  // Total bet should be 5 + 5 + 985 = 995? No, 10 + 985 = 995
  const sbTotalExpected = 995 // All their chips
  expect(state.players[sbPlayer.position].totalBet).toBe(sbTotalExpected)

  // BB calls
  console.log('Action 4: BB calls')
  console.log(`  BB has ${state.players[bbPlayer.position].chips} chips`)
  console.log(`  Current bet: ${state.currentBet}`)
  console.log(`  BB current bet: ${state.players[bbPlayer.position].currentBet}`)
  console.log(`  Call amount: ${state.currentBet - state.players[bbPlayer.position].currentBet}`)
  console.log('')

  await actionService.submitAction(bbPlayer.id, 'call')

  state = await gameService.getGameById(gameId)
  console.log(`  After BB calls:`)
  console.log(
    `  P0: chips=${state.players[0].chips}, currentBet=${state.players[0].currentBet}, totalBet=${state.players[0].totalBet}, status=${state.players[0].status}`,
  )
  console.log(
    `  P1: chips=${state.players[1].chips}, currentBet=${state.players[1].currentBet}, totalBet=${state.players[1].totalBet}, status=${state.players[1].status}`,
  )
  console.log(`  Pot: ${state.pot}, Current bet: ${state.currentBet}`)
  console.log('')

  // Check BB also went all-in
  expect(state.players[bbPlayer.position].chips).toBe(0)
  expect(state.players[bbPlayer.position].status).toBe('all_in')

  // BB started with 990, raised to 30, so has 960 left
  // BB should match SB's bet of 995, so totalBet = 995
  const bbTotalExpected = 990 // All their remaining chips (started with 990 after blind)
  console.log(`Expected BB totalBet: ${bbTotalExpected}`)
  console.log(`Actual BB totalBet: ${state.players[bbPlayer.position].totalBet}`)
  expect(state.players[bbPlayer.position].totalBet).toBe(bbTotalExpected)

  // Total pot should be 995 + 990 = 1985
  const expectedPot = 1985
  console.log(`Expected pot: ${expectedPot}`)
  console.log(`Actual pot: ${state.pot}`)
  expect(state.pot).toBe(expectedPot)

  // Advance to showdown
  console.log('\\nAdvancing to showdown...')
  state = await gameService.advanceRoundIfReady(gameId)

  console.log(`\\nAfter showdown:`)
  console.log(`  P0: chips=${state.players[0].chips}`)
  console.log(`  P1: chips=${state.players[1].chips}`)
  console.log(`  Total chips: ${state.players[0].chips + state.players[1].chips}`)

  // Total chips should still be 2000
  expect(state.players[0].chips + state.players[1].chips).toBe(2000)
})
