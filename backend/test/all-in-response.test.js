/**
 * Test: All-in Bug - Player Goes All-In But Other Player Doesn't Get To Respond
 *
 * Scenario:
 * - Alice has 100 chips
 * - Bob has 100 chips
 * - Alice bets all her chips (100)
 * - Bob should get a chance to call, raise, or fold
 * - CURRENTLY BUG: The getValidActions() function is telling Bob he must "reveal cards"
 *   instead of letting him respond to Alice's all-in bet
 *
 * Expected behavior:
 * - After Alice goes all-in, currentPlayerPosition should point to Bob
 * - getValidActions(state, bobPosition) should return canCall: true
 * - Bob should be able to call, fold, or raise - NOT "reveal cards"
 *
 * Root cause:
 * - The getValidActions() function in betting-logic.js has a check at line 369-378
 * - It checks: "if only this player has chips and there are all-in players"
 * - If true, it returns canReveal: true and says "All other players are all-in. Reveal cards."
 * - BUT this check is premature! The opponent hasn't acted yet in response to the all-in
 * - The check should only apply AFTER all non-all-in players have had a chance to act
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

describe('All-In Response Bug Test', () => {
  test('player goes all-in and other player MUST get a chance to respond', () => {
    // Create 2-player heads-up game
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ]

    // Start game with 100 chips each
    let state = createGameState({ players, startingChips: 100 })
    state = startNewHand(state)

    // At this point:
    // - Alice is dealer/small blind (has 95 chips)
    // - Bob is big blind (has 90 chips)
    // - currentPlayerPosition should point to Alice (first to act)

    // Get Alice's starting position
    const alicePosition = state.players.findIndex((p) => p.name === 'Alice')
    const bobPosition = state.players.findIndex((p) => p.name === 'Bob')

    console.log('Initial state:')
    console.log('  Alice chips:', state.players[alicePosition].chips)
    console.log('  Bob chips:', state.players[bobPosition].chips)
    console.log('  Current player position:', state.currentPlayerPosition)

    // Verify Alice acts first (Alice is dealer/small blind in heads up)
    expect(state.currentPlayerPosition).toBe(alicePosition)

    // Alice decides to go all-in with all remaining chips
    const aliceAllInAmount = state.players[alicePosition].chips // 95

    // Alice must match big blind (10) and then raise to go all-in
    // Since there's already a big blind of 10, Alice uses RAISE action
    const bobBet = state.players[bobPosition].currentBet // 10 (big blind)
    const callAmount = Math.max(0, bobBet - state.players[alicePosition].currentBet)
    const raiseAmount = aliceAllInAmount - callAmount

    const validation = validateAction(state, alicePosition, ACTION_TYPE.RAISE, raiseAmount)
    expect(validation.valid).toBe(true)

    // Process Alice's all-in raise
    state = processAction(state, alicePosition, ACTION_TYPE.RAISE, raiseAmount)

    console.log('\nAfter Alice goes all-in:')
    console.log('  Alice chips:', state.players[alicePosition].chips)
    console.log('  Alice status:', state.players[alicePosition].status)
    console.log('  Alice currentBet:', state.players[alicePosition].currentBet)
    console.log('  Current bet level:', state.currentBet)
    console.log('  Current player position:', state.currentPlayerPosition)
    console.log('  Pot:', state.pot)

    // CRITICAL BUG CHECK: After Alice goes all-in, Bob MUST be the current player
    expect(state.currentPlayerPosition).toBe(bobPosition)
    expect(state.currentPlayerPosition).not.toBe(null)
    expect(state.players[alicePosition].status).toBe(PLAYER_STATUS.ALL_IN)
    expect(state.players[bobPosition].status).toBe(PLAYER_STATUS.ACTIVE)

    // Bob should have valid actions to respond to Alice's all-in
    const bobActions = getValidActions(state, bobPosition)
    console.log('\nBob valid actions:', bobActions)

    // Bob MUST be able to call, fold, or raise
    // This should now work (previously was broken)
    expect(bobActions.canCall).toBe(true) // Bob should be able to call the all-in
    expect(bobActions.canFold).toBe(true) // Bob should be able to fold
    expect(bobActions.canAllIn).toBe(true) // Bob can go all-in himself

    // Verify Bob can actually call without error
    const bobCanCall = validateAction(state, bobPosition, ACTION_TYPE.CALL)
    expect(bobCanCall.valid).toBe(true)

    // Process Bob's call
    state = processAction(state, bobPosition, ACTION_TYPE.CALL)

    console.log('\nAfter Bob calls Alice all-in:')
    console.log('  Bob chips:', state.players[bobPosition].chips)
    console.log('  Bob status:', state.players[bobPosition].status)
    console.log('  Bob currentBet:', state.players[bobPosition].currentBet)
    console.log('  Pot:', state.pot)
    console.log('  Current player position:', state.currentPlayerPosition)

    // Both should now be all-in
    expect(state.players[alicePosition].status).toBe(PLAYER_STATUS.ALL_IN)
    expect(state.players[bobPosition].status).toBe(PLAYER_STATUS.ALL_IN)

    // Betting should be complete (both all-in)
    expect(state.currentPlayerPosition).toBe(null)

    // Pot should contain both all-ins
    expect(state.pot).toBeGreaterThan(0)
  })

  test('player goes all-in preflop, opponent folds', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ]

    let state = createGameState({ players, startingChips: 100 })
    state = startNewHand(state)

    const alicePosition = state.players.findIndex((p) => p.name === 'Alice')
    const bobPosition = state.players.findIndex((p) => p.name === 'Bob')

    // Alice goes all-in with a raise
    const aliceChips = state.players[alicePosition].chips
    const bobBet = state.players[bobPosition].currentBet
    const callAmount = Math.max(0, bobBet - state.players[alicePosition].currentBet)
    const raiseAmount = aliceChips - callAmount

    state = processAction(state, alicePosition, ACTION_TYPE.RAISE, raiseAmount)

    console.log('\nAll-in Fold Scenario:')
    console.log('  After Alice all-in, current player:', state.currentPlayerPosition)

    // CRITICAL: Bob must be current player and able to fold
    expect(state.currentPlayerPosition).toBe(bobPosition)

    // Bob folds
    state = processAction(state, bobPosition, ACTION_TYPE.FOLD)

    console.log('  Bob folded')
    console.log('  Bob status:', state.players[bobPosition].status)
    console.log('  Alice status:', state.players[alicePosition].status)

    // Game should end with Alice as winner (only one active player left)
    expect(state.players[bobPosition].status).toBe(PLAYER_STATUS.FOLDED)
    expect(state.currentPlayerPosition).toBe(null) // Betting complete
  })

  test('player all-in with raise, opponent has chips to respond', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ]

    let state = createGameState({ players, startingChips: 1000 })
    state = startNewHand(state)

    const alicePosition = state.players.findIndex((p) => p.name === 'Alice')
    const bobPosition = state.players.findIndex((p) => p.name === 'Bob')

    // Setup: Alice raises big blind, Bob re-raises, Alice goes all-in
    console.log('\nRaise All-In Scenario:')

    // Alice is dealer/SB, so Alice acts first preflop
    // Bob has BB already posted. Alice raises to 300
    state = processAction(state, alicePosition, ACTION_TYPE.RAISE, 290) // Match 10 + raise 290
    console.log('  Alice raises to 300')
    console.log('  Current bet level:', state.currentBet)

    // Verify Bob is now current player
    expect(state.currentPlayerPosition).toBe(bobPosition)

    // Bob re-raises to 600
    const bobChips = state.players[bobPosition].chips
    if (bobChips >= 600) {
      state = processAction(state, bobPosition, ACTION_TYPE.RAISE, 300) // 300 call + 300 raise
      console.log('  Bob raises to 600')
    } else {
      state = processAction(state, bobPosition, ACTION_TYPE.RAISE, bobChips - 300) // All-in raise if needed
      console.log('  Bob raises all-in')
    }

    // Verify Alice is now current player
    expect(state.currentPlayerPosition).toBe(alicePosition)

    // Alice goes all-in with a raise
    const aliceChips = state.players[alicePosition].chips
    const currentBetForAlice = state.currentBet
    const aliceCurrentBet = state.players[alicePosition].currentBet
    const callAmount = Math.max(0, currentBetForAlice - aliceCurrentBet)
    const raiseAmount = Math.max(0, aliceChips - callAmount)

    if (raiseAmount >= 0) {
      state = processAction(state, alicePosition, ACTION_TYPE.RAISE, raiseAmount)
      console.log('  Alice goes all-in with raise')
      console.log('  After Alice raise, current player:', state.currentPlayerPosition)

      // Bob MUST get a chance to respond to Alice's raise
      if (state.players[bobPosition].chips > 0) {
        expect(state.currentPlayerPosition).toBe(bobPosition)
        console.log('  Bob can now respond to Alice raise: ✓')
      }
    }
  })
})
