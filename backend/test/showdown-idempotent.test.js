const { test, expect } = require('bun:test')

const { createGameState, startNewHand, processShowdown } = require('../lib/game-state-machine')

const { processAction } = require('../lib/betting-logic')
const { calculatePots, getTotalPot } = require('../lib/pot-manager')

function totalInSystem(state) {
  const chips = state.players.reduce((sum, p) => sum + p.chips, 0)
  return chips + (state.pot || 0)
}

test('processShowdown is idempotent even if pot is later recomputed', () => {
  let state = createGameState({
    players: [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
    ],
    startingChips: 1000,
    smallBlind: 5,
    bigBlind: 10,
  })

  state = startNewHand(state)

  // Minimal betting line that is known to conserve chips on first showdown:
  // small blind calls, big blind checks.
  state.currentRound = 'preflop'
  state = processAction(state, 0, 'call', 0)
  state = processAction(state, 1, 'check', 0)

  // Force showdown state
  state.currentRound = 'showdown'

  const before = totalInSystem(state)

  // First payout
  const afterFirst = processShowdown(state)
  expect(totalInSystem(afterFirst)).toBe(before)
  expect(afterFirst.showdownProcessed).toBe(true)

  // Simulate buggy/legacy behavior: pot gets recomputed from totalBet after payout.
  // (This is the scenario that previously allowed awarding twice.)
  const repotted = {
    ...afterFirst,
    pots: calculatePots(afterFirst.players),
  }
  repotted.pot = getTotalPot(repotted.pots)

  // Second payout should be a no-op
  const afterSecond = processShowdown(repotted)
  expect(totalInSystem(afterSecond)).toBe(before)
  expect(afterSecond.players.map((p) => p.chips)).toEqual(afterFirst.players.map((p) => p.chips))
})
