const { isAllInSituation, createGameState } = require('./backend/lib/game-state-machine')

const state = createGameState({
  smallBlind: 10,
  bigBlind: 20,
  players: [
    { id: 1, name: 'Alice', chips: 160 },
    { id: 2, name: 'Bob', chips: 0 },
  ],
})

state.players[0].status = 'active'
state.players[1].status = 'all_in'
state.id = 999
state.status = 'active'
state.currentRound = 'flop'
state.currentPlayerPosition = null
state.action_finished = false

console.log('Testing isAllInSituation...')
console.log('Player 0 status:', state.players[0].status)
console.log('Player 1 status:', state.players[1].status)
console.log('Result:', isAllInSituation(state))
