/**
 * Test to reproduce the chip shortage bug
 */

const {
  createGameState,
  startNewHand,
  processShowdown,
} = require('./backend/lib/game-state-machine')
const { processAction } = require('./backend/lib/betting-logic')
const { ACTION_TYPE, PLAYER_STATUS, ROUND } = require('./backend/lib/game-constants')

function validateChipTotal(state, label) {
  const total = state.players.reduce((sum, p) => sum + p.chips, 0)
  const expected = 2000 // 1000 each for 2 players
  if (total !== expected) {
    console.log(
      `❌ ${label}: Chip mismatch! Expected ${expected}, got ${total} (difference: ${total - expected})`,
    )
    return false
  } else {
    console.log(`✅ ${label}: Chips OK (${total})`)
    return true
  }
}

// Create a 2-player game
const players = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
]

let state = createGameState({ players, startingChips: 1000 })
console.log(`\n=== HAND REPRODUCTION TEST ===\n`)

state = startNewHand(state)
console.log(`Initial state after startNewHand:`)
validateChipTotal(state, 'After startNewHand')

// Simulate a simple hand where:
// Preflop: Alice goes all-in with a raise, Bob calls and goes all-in

const alicePos = 0
const bobPos = 1

// Alice is dealer/small blind
// Bob is big blind with 10 chips
console.log(`\nAlice (pos ${alicePos}): ${state.players[alicePos].chips} chips`)
console.log(`Bob (pos ${bobPos}): ${state.players[bobPos].chips} chips`)

// Both go all-in preflop
const aliceRaiseAmount = state.players[alicePos].chips - state.players[alicePos].currentBet

try {
  state = processAction(state, alicePos, ACTION_TYPE.RAISE, aliceRaiseAmount)
  console.log(`\nAfter Alice raises all-in:`)
  validateChipTotal(state, 'After Alice raise')
  console.log(`Pot: ${state.pot}`)

  // Bob calls and goes all-in
  state = processAction(state, bobPos, ACTION_TYPE.CALL)
  console.log(`\nAfter Bob calls:`)
  validateChipTotal(state, 'After Bob call')
  console.log(`Pot: ${state.pot}`)

  // Should auto-advance to showdown
  console.log(`\nCurrent round: ${state.currentRound}`)
  console.log(`Current player: ${state.currentPlayerPosition}`)

  // Manually trigger showdown
  if (state.currentRound !== ROUND.SHOWDOWN) {
    console.log(`\nProcessing showdown...`)
    state = processShowdown(state)
    validateChipTotal(state, 'After processShowdown')
  } else {
    console.log(`\nAlready at showdown, calling processShowdown...`)
    state = processShowdown(state)
    validateChipTotal(state, 'After processShowdown')
  }

  console.log(`\nFinal state:`)
  state.players.forEach((p) => {
    console.log(`  ${p.name}: ${p.chips} chips`)
  })

  console.log(`\nPots structure:`)
  console.log(JSON.stringify(state.pots, null, 2))

  console.log(`\n=== TEST COMPLETE ===\n`)
} catch (err) {
  console.error(`\n❌ Error:`, err.message)
  console.error(err.stack)
}
