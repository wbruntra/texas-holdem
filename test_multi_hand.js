const {
  createGameState,
  startNewHand,
  processShowdown,
  advanceRound,
  PLAYER_STATUS,
  ROUND,
  ACTION_TYPE,
} = require('./backend/lib/game-state-machine')
const { processAction } = require('./backend/lib/betting-logic')

// Create 2-player game
const players = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
]

let state = createGameState({ players, startingChips: 1000 })
console.log('Initial state:')
console.log('Alice:', state.players[0].chips)
console.log('Bob:', state.players[1].chips)
console.log('Total:', state.players[0].chips + state.players[1].chips)

// Hand 1
state = startNewHand(state)
console.log('\n=== Hand 1 Started ===')
console.log('After blinds:')
console.log('Alice:', state.players[0].chips, 'bet:', state.players[0].totalBet)
console.log('Bob:', state.players[1].chips, 'bet:', state.players[1].totalBet)
console.log('Total chips:', state.players[0].chips + state.players[1].chips + state.pot)

// Alice calls
state = processAction(state, state.currentPlayerPosition, ACTION_TYPE.CALL)
console.log('\nAfter Alice calls:')
console.log('Alice:', state.players[0].chips, 'bet:', state.players[0].totalBet)
console.log('Bob:', state.players[1].chips, 'bet:', state.players[1].totalBet)
console.log('Pot:', state.pot)
console.log('Total chips:', state.players[0].chips + state.players[1].chips + state.pot)

// Bob checks
state = processAction(state, state.currentPlayerPosition, ACTION_TYPE.CHECK)

// Go to showdown
state.currentRound = ROUND.SHOWDOWN
state.players[0].holeCards = [
  { rank: 'A', suit: 'hearts', value: 14 },
  { rank: 'K', suit: 'hearts', value: 13 },
]
state.players[1].holeCards = [
  { rank: '2', suit: 'clubs', value: 2 },
  { rank: '3', suit: 'clubs', value: 3 },
]
state.communityCards = [
  { rank: 'A', suit: 'diamonds', value: 14 },
  { rank: 'K', suit: 'spades', value: 13 },
  { rank: 'Q', suit: 'hearts', value: 12 },
  { rank: 'J', suit: 'clubs', value: 11 },
  { rank: '10', suit: 'diamonds', value: 10 },
]

console.log('\n=== Going to Showdown ===')
console.log('Before showdown:')
console.log('Alice:', state.players[0].chips, 'totalBet:', state.players[0].totalBet)
console.log('Bob:', state.players[1].chips, 'totalBet:', state.players[1].totalBet)
console.log('Pot:', state.pot)
console.log('Total chips:', state.players[0].chips + state.players[1].chips + state.pot)

state = processShowdown(state)

console.log('\nAfter showdown:')
console.log('Alice:', state.players[0].chips)
console.log('Bob:', state.players[1].chips)
console.log('Pot:', state.pot)
console.log('Total chips:', state.players[0].chips + state.players[1].chips + state.pot)
console.log('Winners:', state.winners)

if (state.players[0].chips + state.players[1].chips !== 2000) {
  console.log(
    '\n🐛 BUG DETECTED! Total chips should be 2000 but is',
    state.players[0].chips + state.players[1].chips,
  )
}
