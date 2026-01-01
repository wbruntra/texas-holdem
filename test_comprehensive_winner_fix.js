/**
 * Comprehensive test for side pot winner bug fixes
 */

const { processShowdown } = require('./backend/lib/game-state-machine')
const { PLAYER_STATUS } = require('./backend/lib/game-constants')
const { createCard } = require('./backend/lib/poker-engine')

function testCase(name, initialState, expectations) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`TEST: ${name}`)
  console.log('='.repeat(60))

  const result = processShowdown(initialState)

  console.log('\nRESULTS:')
  result.players.forEach((p, i) => {
    console.log(`  P${i} (${p.name}): $${p.chips} - ${p.status}`)
  })
  console.log(`  Winners: [${result.winners.join(', ')}]`)

  if (result.pots && result.pots.length > 0) {
    console.log(`\nPOTS:`)
    result.pots.forEach((pot, i) => {
      console.log(
        `  Pot ${i + 1}: $${pot.amount} - Eligible: [${pot.eligiblePlayers}] - Winners: [${pot.winners}]`,
      )
    })
  }

  console.log('\nVALIDATION:')
  let allPass = true

  // Check chip totals
  const totalChips = result.players.reduce((sum, p) => sum + p.chips, 0)
  if (totalChips === expectations.totalChips) {
    console.log(`  ✅ Total chips: ${totalChips}`)
  } else {
    console.log(`  ❌ Total chips: ${totalChips} (expected ${expectations.totalChips})`)
    allPass = false
  }

  // Check winners
  if (
    result.winners.length === expectations.winners.length &&
    result.winners.every((w, i) => w === expectations.winners[i])
  ) {
    console.log(`  ✅ Winners: [${result.winners}]`)
  } else {
    console.log(
      `  ❌ Winners: [${result.winners}] (expected [${expectations.winners.join(', ')}])`,
    )
    allPass = false
  }

  // Check individual chip amounts
  for (let i = 0; i < result.players.length; i++) {
    if (result.players[i].chips === expectations.chips[i]) {
      console.log(`  ✅ P${i} chips: ${result.players[i].chips}`)
    } else {
      console.log(
        `  ❌ P${i} chips: ${result.players[i].chips} (expected ${expectations.chips[i]})`,
      )
      allPass = false
    }
  }

  return allPass
}

// Test 1: Basic two-player scenario - both bet same amount
const test1Pass = testCase(
  'Basic 2-player equal bets',
  {
    players: [
      {
        id: 1,
        name: 'Alice',
        position: 0,
        chips: 0,
        currentBet: 0,
        totalBet: 50,
        status: PLAYER_STATUS.ACTIVE,
        holeCards: [createCard('A', 'spades'), createCard('A', 'hearts')],
      },
      {
        id: 2,
        name: 'Bob',
        position: 1,
        chips: 0,
        currentBet: 0,
        totalBet: 50,
        status: PLAYER_STATUS.ACTIVE,
        holeCards: [createCard('K', 'spades'), createCard('K', 'hearts')],
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
  },
  {
    totalChips: 100,
    winners: [0], // Only Alice wins
    chips: [100, 0], // Alice gets it all
  },
)

// Test 2: All-in with side pot - player with smaller stack wins main pot
const test2Pass = testCase(
  'All-in with side pot - small stack wins',
  {
    players: [
      {
        id: 1,
        name: 'Alice',
        position: 0,
        chips: 0,
        currentBet: 0,
        totalBet: 50, // all-in
        status: PLAYER_STATUS.ALL_IN,
        holeCards: [createCard('A', 'spades'), createCard('A', 'hearts')],
      },
      {
        id: 2,
        name: 'Bob',
        position: 1,
        chips: 0,
        currentBet: 0,
        totalBet: 100, // bet more
        status: PLAYER_STATUS.ACTIVE,
        holeCards: [createCard('K', 'spades'), createCard('K', 'hearts')],
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
  },
  {
    totalChips: 150,
    winners: [0], // Only Alice wins (Bob just gets uncalled bet back)
    chips: [100, 50], // Alice wins main pot, Bob gets his extra bet back
  },
)

// Test 3: All-in with side pot - player with larger stack wins main pot
const test3Pass = testCase(
  'All-in with side pot - big stack wins',
  {
    players: [
      {
        id: 1,
        name: 'Alice',
        position: 0,
        chips: 0,
        currentBet: 0,
        totalBet: 50, // all-in
        status: PLAYER_STATUS.ALL_IN,
        holeCards: [createCard('K', 'spades'), createCard('K', 'hearts')], // worse hand
      },
      {
        id: 2,
        name: 'Bob',
        position: 1,
        chips: 0,
        currentBet: 0,
        totalBet: 100,
        status: PLAYER_STATUS.ACTIVE,
        holeCards: [createCard('A', 'spades'), createCard('A', 'hearts')], // better hand
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
  },
  {
    totalChips: 150,
    winners: [1], // Only Bob wins
    chips: [0, 150], // Bob wins everything
  },
)

// Test 4: Three players with complex side pots
const test4Pass = testCase(
  '3-player with multiple side pots',
  {
    players: [
      {
        id: 1,
        name: 'Alice',
        position: 0,
        chips: 0,
        currentBet: 0,
        totalBet: 30, // smallest stack
        status: PLAYER_STATUS.ALL_IN,
        holeCards: [createCard('A', 'spades'), createCard('A', 'hearts')], // best hand
      },
      {
        id: 2,
        name: 'Bob',
        position: 1,
        chips: 0,
        currentBet: 0,
        totalBet: 50, // medium stack
        status: PLAYER_STATUS.ALL_IN,
        holeCards: [createCard('K', 'spades'), createCard('K', 'hearts')], // middle hand
      },
      {
        id: 3,
        name: 'Charlie',
        position: 2,
        chips: 0,
        currentBet: 0,
        totalBet: 100, // largest stack
        status: PLAYER_STATUS.ACTIVE,
        holeCards: [createCard('Q', 'spades'), createCard('Q', 'hearts')], // worst hand
      },
    ],
    communityCards: [
      createCard('2', 'clubs'),
      createCard('7', 'diamonds'),
      createCard('9', 'clubs'),
      createCard('J', 'hearts'),
      createCard('3', 'spades'),
    ],
    pot: 180,
    currentRound: 'showdown',
    status: 'active',
  },
  {
    totalChips: 180,
    winners: [0, 1], // Alice wins main pot, Bob wins side pot 1 (Charlie just gets uncalled bet back)
    chips: [90, 40, 50], // Alice: 30*3=90, Bob: (50-30)*2=40, Charlie: (100-50)*1=50 back
  },
)

console.log('\n\n' + '='.repeat(60))
console.log('SUMMARY')
console.log('='.repeat(60))
const allPass = test1Pass && test2Pass && test3Pass && test4Pass
if (allPass) {
  console.log('✅ ALL TESTS PASSED')
} else {
  console.log('❌ SOME TESTS FAILED')
  process.exit(1)
}
