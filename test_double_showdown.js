const {
  createGameState,
  startNewHand,
  processShowdown,
} = require('./backend/lib/game-state-machine')
const { processAction } = require('./backend/lib/betting-logic')

// Create a simple 2-player game
let state = createGameState({
  players: [
    { id: 'p1', name: 'Alice' },
    { id: 'p2', name: 'Bob' },
  ],
  startingChips: 1000,
  smallBlind: 5,
  bigBlind: 10,
})

console.log(`\n=== BEFORE START HAND ===`)
console.log(`Alice: ${state.players[0].chips} chips`)
console.log(`Bob: ${state.players[1].chips} chips`)
console.log(`Total: ${state.players[0].chips + state.players[1].chips}`)

// Start a hand
state = startNewHand(state)

console.log(`\n=== AFTER START HAND (blinds posted) ===`)
console.log(`Alice: ${state.players[0].chips} chips`)
console.log(`Bob: ${state.players[1].chips} chips`)
console.log(`Total: ${state.players[0].chips + state.players[1].chips}`)

// Post blinds (already done in startNewHand)
// Move to showdown by having both players call
state.currentRound = 'preflop'
state = processAction(state, 0, 'call', 5) // Alice calls big blind
state = processAction(state, 1, 'check', 0) // Bob checks

console.log(`\n=== AFTER PREFLOP ===`)
console.log(`Alice: ${state.players[0].chips} chips (bet: ${state.players[0].currentBet})`)
console.log(`Bob: ${state.players[1].chips} chips (bet: ${state.players[1].currentBet})`)
console.log(`Pot: ${state.pot}`)
console.log(`Total: ${state.players[0].chips + state.players[1].chips + state.pot}`)

// Move to showdown
state.currentRound = 'showdown'

console.log(`\n=== BEFORE FIRST SHOWDOWN ===`)
console.log(`Alice: ${state.players[0].chips} chips`)
console.log(`Bob: ${state.players[1].chips} chips`)
console.log(`Pot: ${state.pot}`)
console.log(`Total chips: ${state.players[0].chips + state.players[1].chips + state.pot}`)

// First processShowdown call
state = processShowdown(state)

console.log(`\n=== AFTER FIRST SHOWDOWN ===`)
console.log(`Alice: ${state.players[0].chips} chips`)
console.log(`Bob: ${state.players[1].chips} chips`)
console.log(`Pot: ${state.pot}`)
console.log(`Total chips: ${state.players[0].chips + state.players[1].chips + state.pot}`)

// Second processShowdown call (THIS SHOULD NOT CREATE CHIPS)
state = processShowdown(state)

console.log(`\n=== AFTER SECOND SHOWDOWN ===`)
console.log(`Alice: ${state.players[0].chips} chips`)
console.log(`Bob: ${state.players[1].chips} chips`)
console.log(`Pot: ${state.pot}`)
console.log(`Total chips: ${state.players[0].chips + state.players[1].chips + state.pot}`)

const finalTotal = state.players[0].chips + state.players[1].chips + state.pot
if (finalTotal !== 2000) {
  console.log(`\n❌ BUG FOUND: Total chips is ${finalTotal}, should be 2000!`)
  console.log(`   Extra chips created: ${finalTotal - 2000}`)
} else {
  console.log(`\n✅ Chips conserved correctly!`)
}
