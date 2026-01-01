const { test, expect } = require('bun:test')
const { canRevealCard } = require('../lib/betting-logic')
const { PLAYER_STATUS } = require('../lib/game-constants')

test('canRevealCard allows river->showdown transition when all cards dealt', () => {
  const state = {
    status: 'active',
    currentRound: 'river',
    communityCards: [{}, {}, {}, {}, {}],
    players: [
      { status: PLAYER_STATUS.ALL_IN, chips: 0 },
      { status: PLAYER_STATUS.ACTIVE, chips: 100 },
    ],
  }

  const result = canRevealCard(state, 1)
  expect(result.canReveal).toBe(true)
})
