const {
  createGame,
  postBlinds,
  processAction,
  isBettingComplete,
  advanceRound,
} = require('./simulate_2player')
const { calculatePots } = require('./backend/lib/pot-manager')

let game = createGame([
  { id: '1', name: 'P0' },
  { id: '2', name: 'P1' },
])

console.log('Initial: P0=$' + game.players[0].chips + ' P1=$' + game.players[1].chips)

game = postBlinds(game)
console.log(
  'After blinds: P0=$' +
    game.players[0].chips +
    ' P1=$' +
    game.players[1].chips +
    ' Pot=$' +
    game.pot,
)
console.log('  P0 total_bet: ' + game.players[0].total_bet)
console.log('  P1 total_bet: ' + game.players[1].total_bet)

game = processAction(game, 0, 'raise', 50)
game = processAction(game, 1, 'call')
console.log(
  'After betting: P0=$' +
    game.players[0].chips +
    ' P1=$' +
    game.players[1].chips +
    ' Pot=$' +
    game.pot,
)
console.log('  P0 total_bet: ' + game.players[0].total_bet)
console.log('  P1 total_bet: ' + game.players[1].total_bet)

game = advanceRound(game)
console.log(
  'After flop: P0=$' +
    game.players[0].chips +
    ' P1=$' +
    game.players[1].chips +
    ' Pot=$' +
    game.pot,
)

game = processAction(game, 0, 'bet', 50)
game = processAction(game, 1, 'call')
console.log(
  'After flop betting: P0=$' +
    game.players[0].chips +
    ' P1=$' +
    game.players[1].chips +
    ' Pot=$' +
    game.pot,
)
console.log('  P0 total_bet: ' + game.players[0].total_bet)
console.log('  P1 total_bet: ' + game.players[1].total_bet)

game = advanceRound(game)
console.log(
  'After turn: P0=$' +
    game.players[0].chips +
    ' P1=$' +
    game.players[1].chips +
    ' Pot=$' +
    game.pot,
)

game = processAction(game, 0, 'bet', 50)
game = processAction(game, 1, 'call')
console.log(
  'After turn betting: P0=$' +
    game.players[0].chips +
    ' P1=$' +
    game.players[1].chips +
    ' Pot=$' +
    game.pot,
)
console.log('  P0 total_bet: ' + game.players[0].total_bet)
console.log('  P1 total_bet: ' + game.players[1].total_bet)

game = advanceRound(game)
console.log(
  'After river: P0=$' +
    game.players[0].chips +
    ' P1=$' +
    game.players[1].chips +
    ' Pot=$' +
    game.pot,
)

const pots = calculatePots(game.players)
console.log('\nPots calculated:')
console.log(JSON.stringify(pots, null, 2))
