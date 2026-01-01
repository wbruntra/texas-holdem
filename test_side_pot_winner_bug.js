/**
 * Test case for the actual bug: when one player is all-in and wins,
 * both players are marked as winners due to side pot calculation
 */

const { processShowdown } = require('./backend/lib/game-state-machine')
const { PLAYER_STATUS } = require('./backend/lib/game-constants')
const { createCard } = require('./backend/lib/poker-engine')

// Scenario: Player 0 is all-in with $50, Player 1 bets $100
// Player 0 has a better hand and wins the main pot ($100)
// Player 1 should get their extra $50 back, but shouldn't be marked as "winner"
// Bug: Both players get marked as winners

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
      chips: 0, // bet everything too
      currentBet: 0,
      totalBet: 100, // bet more than Alice
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
  pot: 150,
  currentRound: 'showdown',
  status: 'active',
}

console.log('=== TEST: All-In Winner Bug with Side Pot ===\n')

console.log('Initial State:')
console.log(`  Alice (P0): $0 chips, $50 total bet, ALL-IN, has AA`)
console.log(`  Bob (P1): $0 chips, $100 total bet, ACTIVE, has KK`)
console.log(`  Total Pot: $150\n`)

console.log('Expected Outcome:')
console.log(`  - Main pot: $100 (Alice can win this)`)
console.log(`  - Side pot: $50 (Bob gets back since Alice can't contest)`)
console.log(`  - Alice wins $100 with pair of Aces`)
console.log(`  - Bob gets $50 back (his extra bet that Alice couldn't match)`)
console.log(`  - Only Alice should be in winners array (she won the main pot)`)
console.log(`  - Bob should NOT be in winners array (getting chips back ≠ winning)\n`)

const result = processShowdown(initialState)

console.log('Actual Result:')
console.log(`  Alice (P0): $${result.players[0].chips} chips`)
console.log(`  Bob (P1): $${result.players[1].chips} chips`)
console.log(`  Winners: [${result.winners.join(', ')}]`)

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

console.log(`Total chips: ${totalChips} (should be 150)`)

if (result.winners.length === 1 && result.winners[0] === 0) {
  console.log('✅ PASS: Only Alice is marked as winner')
} else if (
  result.winners.length === 2 &&
  result.winners.includes(0) &&
  result.winners.includes(1)
) {
  console.log('❌ FAIL: BUG REPRODUCED - Both players marked as winners!')
  console.log('   Bob should NOT be a winner - he only got his uncalled bet back.')
} else {
  console.log(`❌ FAIL: Unexpected winners array: [${result.winners.join(', ')}]`)
}

if (aliceChips === 100 && bobChips === 50) {
  console.log('✅ PASS: Chips distributed correctly')
  console.log('   Alice won the main pot ($100)')
  console.log('   Bob got his uncalled bet back ($50)')
} else {
  console.log(`❌ FAIL: Incorrect chip distribution. Alice=${aliceChips}, Bob=${bobChips}`)
}
