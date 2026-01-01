/**
 * Test: One player goes all-in, another player still has chips
 * Expected: Other player gets a turn to act before betting round completes
 */

const { processAction } = require('./backend/lib/betting-logic')
const { isBettingRoundComplete } = require('./backend/lib/game-state-machine')
const { PLAYER_STATUS, ACTION_TYPE } = require('./backend/lib/game-constants')

// Create initial game state
function createTestGame() {
  return {
    status: 'active',
    smallBlind: 5,
    bigBlind: 10,
    currentRound: 'preflop',
    pot: 15,
    currentBet: 10, // Big blind is 10
    lastRaise: 10,
    players: [
      {
        id: 'p1',
        name: 'Player 1',
        position: 0,
        chips: 450, // Had 500, posted small blind of 5, then small blind, now 450
        currentBet: 5, // Posted small blind
        holeCards: ['2h', '3h'],
        status: PLAYER_STATUS.ACTIVE,
        lastAction: null,
      },
      {
        id: 'p2',
        name: 'Player 2',
        position: 1,
        chips: 490, // Had 500, posted big blind of 10
        currentBet: 10, // Posted big blind
        holeCards: ['Kd', 'Qd'],
        status: PLAYER_STATUS.ACTIVE,
        lastAction: null,
      },
    ],
    currentPlayerPosition: 0, // Player 1 to act first (left of big blind)
  }
}

console.log('='.repeat(80))
console.log('TEST: One Player All-In, Other Player Has Chips')
console.log('='.repeat(80))

let game = createTestGame()

console.log('\n--- Initial State ---')
console.log(`Current Bet: ${game.currentBet}`)
console.log(
  `Player 1 (position 0): chips=${game.players[0].chips}, currentBet=${game.players[0].currentBet}, status=${game.players[0].status}`,
)
console.log(
  `Player 2 (position 1): chips=${game.players[1].chips}, currentBet=${game.players[1].currentBet}, status=${game.players[1].status}`,
)
console.log(`Current Player Position: ${game.currentPlayerPosition}`)
console.log(`Betting Round Complete: ${isBettingRoundComplete(game)}`)

// Player 1 goes all-in for 450
console.log('\n--- Player 1 Goes All-In for 450 ---')
game = processAction(game, 0, ACTION_TYPE.ALL_IN, 0)

console.log(`Current Bet: ${game.currentBet}`)
console.log(
  `Player 1: chips=${game.players[0].chips}, currentBet=${game.players[0].currentBet}, status=${game.players[0].status}, lastAction=${game.players[0].lastAction}`,
)
console.log(
  `Player 2: chips=${game.players[1].chips}, currentBet=${game.players[1].currentBet}, status=${game.players[1].status}, lastAction=${game.players[1].lastAction}`,
)
console.log(`Current Player Position: ${game.currentPlayerPosition}`)
console.log(`Betting Round Complete: ${isBettingRoundComplete(game)}`)

// Expected state after Player 1 goes all-in:
// - Current bet should be 450 (Player 1's all-in amount)
// - Player 1 should be ALL_IN status
// - Player 2 should still be ACTIVE and need to act (currentPlayerPosition should be 1)
// - Betting round should NOT be complete

console.log('\n--- VALIDATION ---')
console.log(`Game state being checked:`)
console.log(`  currentBet: ${game.currentBet}`)
console.log(
  `  Player 1: currentBet=${game.players[0].currentBet}, status=${game.players[0].status}`,
)
console.log(
  `  Player 2: currentBet=${game.players[1].currentBet}, status=${game.players[1].status}, lastAction=${game.players[1].lastAction}`,
)

// Manually check what isBettingRoundComplete is evaluating
const activePlayers = game.players.filter(
  (p) => p.status === PLAYER_STATUS.ACTIVE || p.status === PLAYER_STATUS.ALL_IN,
)
const playersWhoCanAct = activePlayers.filter((p) => p.status === PLAYER_STATUS.ACTIVE)
console.log(`  activePlayers.length: ${activePlayers.length}`)
console.log(`  playersWhoCanAct.length: ${playersWhoCanAct.length}`)

const allMatched = activePlayers.every((p) => {
  if (p.status === PLAYER_STATUS.ALL_IN) {
    console.log(`    ${p.name} is ALL_IN → returns true`)
    return true
  }
  const matched = p.currentBet === game.currentBet && p.lastAction !== null
  console.log(
    `    ${p.name}: currentBet=${p.currentBet} vs currentBet=${game.currentBet}, lastAction=${p.lastAction} → returns ${matched}`,
  )
  return matched
})
console.log(`  allMatched result: ${allMatched}`)

if (game.currentBet === 450) {
  console.log('✓ Current bet correctly updated to 450')
} else {
  console.log(`✗ WRONG: Current bet is ${game.currentBet}, expected 450`)
}

if (game.players[0].status === PLAYER_STATUS.ALL_IN) {
  console.log('✓ Player 1 correctly marked as ALL_IN')
} else {
  console.log(`✗ WRONG: Player 1 status is ${game.players[0].status}`)
}

if (game.currentPlayerPosition === 1) {
  console.log('✓ Player 2 correctly set to act next')
} else {
  console.log(`✗ WRONG: Current player position is ${game.currentPlayerPosition}, expected 1`)
}

if (!isBettingRoundComplete(game)) {
  console.log('✓ Betting round correctly NOT marked as complete')
} else {
  console.log('✗ BUG: Betting round marked as complete - Player 2 did not get to act!')
}

// Now Player 2 should be able to call the all-in
console.log('\n--- Player 2 Calls All-In ---')
game = processAction(game, 1, ACTION_TYPE.CALL, 0)

console.log(`Current Bet: ${game.currentBet}`)
console.log(
  `Player 1: chips=${game.players[0].chips}, currentBet=${game.players[0].currentBet}, status=${game.players[0].status}`,
)
console.log(
  `Player 2: chips=${game.players[1].chips}, currentBet=${game.players[1].currentBet}, status=${game.players[1].status}, lastAction=${game.players[1].lastAction}`,
)
console.log(`Current Player Position: ${game.currentPlayerPosition}`)
console.log(`Betting Round Complete: ${isBettingRoundComplete(game)}`)

console.log('\n--- VALIDATION ---')
if (game.players[1].currentBet === 450) {
  console.log('✓ Player 2 correctly called the all-in (matched 450)')
} else {
  console.log(`✗ WRONG: Player 2 currentBet is ${game.players[1].currentBet}, expected 450`)
}

if (isBettingRoundComplete(game)) {
  console.log('✓ Betting round correctly marked as complete')
} else {
  console.log('✗ WRONG: Betting round not complete after both matched')
}

if (game.currentPlayerPosition === null) {
  console.log('✓ No current player (betting complete)')
} else {
  console.log(`✗ WRONG: Current player position is ${game.currentPlayerPosition}, expected null`)
}

console.log('\n' + '='.repeat(80))
