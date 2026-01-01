/**
 * Test case for bug where both players are marked as winners
 * when one is all-in and wins the whole pot
 */

const { processShowdown } = require('./backend/lib/game-state-machine')
const { PLAYER_STATUS } = require('./backend/lib/game-constants')
const { createCard } = require('./backend/lib/poker-engine')

// Scenario: Player 0 is all-in with $50, Player 1 has $150
// Player 0 has a better hand and wins
// Expected: Only Player 0 should be marked as winner
// Bug: Both players are marked as winners

const initialState = {
  players: [
    {
      id: 1,
      name: 'Alice',
      position: 0,
      chips: 0, // all-in
      currentBet: 0,
      totalBet: 50, // bet everything
      status: PLAYER_STATUS.ALL_IN,
      holeCards: [createCard('A', 'spades'), createCard('A', 'hearts')], // Pair of Aces - BETTER HAND
    },
    {
      id: 2,
      name: 'Bob',
      position: 1,
      chips: 100, // has chips left
      currentBet: 0,
      totalBet: 50, // matched Alice's bet
      status: PLAYER_STATUS.ACTIVE,
      holeCards: [createCard('K', 'spades'), createCard('K', 'hearts')], // Pair of Kings - WORSE HAND
    },
  ],
  communityCards: [
    createCard('2', 'clubs'),
    createCard('7', 'diamonds'),
    createCard('9', 'clubs'),
    createCard('J', 'hearts'),
    createCard('3', 'spades'),
  ],
  pot: 100,
  currentRound: 'showdown',
  status: 'active',
}

console.log('=== TEST: All-In Winner Bug ===\n')

console.log('Initial State:')
console.log(`  Alice (P0): $0 chips, $50 total bet, ALL-IN, has AA`)
console.log(`  Bob (P1): $100 chips, $50 total bet, ACTIVE, has KK`)
console.log(`  Pot: $100\n`)

console.log('Expected Outcome:')
console.log(`  - Alice wins $100 (entire pot) with pair of Aces`)
console.log(`  - Only Alice should be in winners array`)
console.log(`  - Bob should NOT be in winners array\n`)

const result = processShowdown(initialState)

console.log('Actual Result:')
console.log(`  Alice (P0): $${result.players[0].chips} chips`)
console.log(`  Bob (P1): $${result.players[1].chips} chips`)
console.log(`  Winners: [${result.winners.join(', ')}]`)

// Debug: Let's manually check hand evaluation
const { evaluateHand } = require('./backend/lib/poker-engine')

// Test with proper card format
const aliceCard1 = createCard('A', 'spades')
const aliceCard2 = createCard('A', 'hearts')
const bobCard1 = createCard('K', 'spades')
const bobCard2 = createCard('K', 'hearts')
const comm1 = createCard('2', 'clubs')
const comm2 = createCard('7', 'diamonds')
const comm3 = createCard('9', 'clubs')
const comm4 = createCard('J', 'hearts')
const comm5 = createCard('3', 'spades')

const aliceHand = evaluateHand([aliceCard1, aliceCard2], [comm1, comm2, comm3, comm4, comm5])
const bobHand = evaluateHand([bobCard1, bobCard2], [comm1, comm2, comm3, comm4, comm5])
console.log(`\n  Debug - Hand evaluations with createCard:`)
console.log(`    Alice: ${aliceHand.rankName} (value: ${aliceHand.value})`)
console.log(`    Bob: ${bobHand.rankName} (value: ${bobHand.value})`)

if (result.pots && result.pots.length > 0) {
  console.log(`\n  Pots breakdown:`)
  result.pots.forEach((pot, i) => {
    console.log(`    Pot ${i + 1}: $${pot.amount}`)
    console.log(`      Eligible: [${pot.eligiblePlayers.join(', ')}]`)
    console.log(`      Winners: [${pot.winners.join(', ')}]`)
    if (pot.winningRankName) {
      console.log(`      Rank: ${pot.winningRankName}`)
    }
  })
}

console.log('\n=== TEST RESULTS ===')

const aliceChips = result.players[0].chips
const bobChips = result.players[1].chips
const totalChips = aliceChips + bobChips

console.log(`Total chips: ${totalChips} (should be 100)`)

if (result.winners.length === 1 && result.winners[0] === 0) {
  console.log('✅ PASS: Only Alice is marked as winner')
} else if (result.winners.length === 2) {
  console.log('❌ FAIL: BUG REPRODUCED - Both players marked as winners!')
  console.log('   This is the bug we need to fix.')
} else {
  console.log(`❌ FAIL: Unexpected winners array: [${result.winners.join(', ')}]`)
}

if (aliceChips === 100 && bobChips === 100) {
  console.log('✅ PASS: Chips distributed correctly')
} else {
  console.log(`❌ FAIL: Incorrect chip distribution. Alice=${aliceChips}, Bob=${bobChips}`)
}
