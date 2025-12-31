/**
 * Test: Short stack call all-in creates side pots
 *
 * Scenario:
 * - Alice has 1000 chips, bets 500
 * - Bob has only 200 chips, calls all-in with 200
 * - This creates a main pot (500) and side pot (300 from Alice)
 */

import { describe, test, expect } from 'bun:test'
const {
  GAME_STATUS,
  ROUND,
  PLAYER_STATUS,
  ACTION_TYPE,
  createGameState,
  startNewHand,
} = require('../lib/game-state-machine')
const { validateAction, processAction, getValidActions } = require('../lib/betting-logic')
const { calculatePots } = require('../lib/pot-manager')

describe('Short Stack All-In Feature', () => {
  test('end-to-end: short stack call all-in creates side pot', () => {
    // Create 2-player game
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ]

    let state = createGameState({ players, startingChips: 1000 })
    state = startNewHand(state)

    // Alice is dealer/small blind with 1000 chips
    // Bob is big blind with 1000 chips
    // After blinds: Alice has 995, Bob has 990

    // Assume we're at a point where Alice bets 500
    state.currentBet = 500
    state.players[0].currentBet = 500
    state.players[0].chips = 500 // Alice has 500 left
    state.players[0].totalBet = 500
    state.players[1].chips = 200 // Bob only has 200 left
    state.players[1].currentBet = 0
    state.currentPlayerPosition = 1 // Bob's turn
    state.pot = 500 // Alice's bet already in pot

    // Bob should be able to call
    const validation = validateAction(state, 1, ACTION_TYPE.CALL)
    expect(validation.valid).toBe(true)

    // Get valid actions to show callAmount
    const actions = getValidActions(state, 1)
    expect(actions.canCall).toBe(true)
    expect(actions.callAmount).toBe(200) // Only what Bob has left

    // Process Bob's call
    state = processAction(state, 1, ACTION_TYPE.CALL)

    // Verify Bob is all-in
    expect(state.players[1].chips).toBe(0)
    expect(state.players[1].status).toBe(PLAYER_STATUS.ALL_IN)
    expect(state.players[1].currentBet).toBe(200)
    expect(state.pot).toBe(700) // 500 + 200

    // Now let's say Alice and Bob go to showdown
    // When we calculate pots, we should get a main pot and side pot
    state.players[0].totalBet = 500
    state.players[1].totalBet = 200

    const pots = calculatePots(state.players)

    // Should have one main pot (200 from each) and one side pot (300 from Alice)
    expect(pots.length).toBe(2)
    expect(pots[0].amount).toBe(400) // Main pot: 200 + 200
    expect(pots[0].eligiblePlayers).toEqual([0, 1]) // Both eligible for main pot

    expect(pots[1].amount).toBe(300) // Side pot: 300 from Alice
    expect(pots[1].eligiblePlayers).toEqual([0]) // Only Alice eligible
  })
})
