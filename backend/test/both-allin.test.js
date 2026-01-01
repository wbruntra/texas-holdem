const { test, expect } = require('bun:test')
const { processAction } = require('../lib/betting-logic')
const { PLAYER_STATUS, ACTION_TYPE } = require('../lib/game-constants')

test('Both players all-in should set currentPlayerPosition to null', () => {
  console.log('\n🎯 Testing all-in scenario\n')

  // Setup: Both players after blinds
  let state = {
    currentRound: 'preflop',
    pot: 15,
    currentBet: 10,
    lastRaise: 10,
    currentPlayerPosition: 0,
    players: [
      {
        id: 'p0',
        position: 0,
        chips: 995,
        currentBet: 5,
        totalBet: 5,
        status: 'active',
        lastAction: null,
      },
      {
        id: 'p1',
        position: 1,
        chips: 990,
        currentBet: 10,
        totalBet: 10,
        status: 'active',
        lastAction: null,
      },
    ],
  }

  console.log('Initial state:')
  console.log('  P0: 995 chips, 5 bet, active')
  console.log('  P1: 990 chips, 10 bet, active')
  console.log('  Current player: 0')
  console.log('')

  // P0 goes all-in (raise by 990)
  console.log('P0 raises by 990 (goes all-in with 995 chips)')
  state = processAction(state, 0, ACTION_TYPE.RAISE, 990)

  console.log('After P0 all-in:')
  console.log(
    `  P0: ${state.players[0].chips} chips, ${state.players[0].currentBet} bet, ${state.players[0].status}`,
  )
  console.log(
    `  P1: ${state.players[1].chips} chips, ${state.players[1].currentBet} bet, ${state.players[1].status}`,
  )
  console.log(`  Current player: ${state.currentPlayerPosition}`)
  console.log(`  Current bet: ${state.currentBet}`)
  console.log('')

  expect(state.players[0].chips).toBe(0)
  expect(state.players[0].status).toBe('all_in')
  expect(state.currentPlayerPosition).not.toBe(null) // Should still have P1 to act

  // P1 calls (goes all-in with remaining 990)
  console.log('P1 calls (goes all-in with 990 chips)')
  state = processAction(state, state.currentPlayerPosition, ACTION_TYPE.CALL)

  console.log('After P1 call:')
  console.log(
    `  P0: ${state.players[0].chips} chips, ${state.players[0].currentBet} bet, ${state.players[0].status}`,
  )
  console.log(
    `  P1: ${state.players[1].chips} chips, ${state.players[1].currentBet} bet, ${state.players[1].status}`,
  )
  console.log(`  Current player: ${state.currentPlayerPosition}`)
  console.log('')

  expect(state.players[1].chips).toBe(0)
  expect(state.players[1].status).toBe('all_in')

  // Both all-in, should have null currentPlayerPosition
  console.log('✓ Both players are all-in')
  console.log(`Expected currentPlayerPosition: null`)
  console.log(`Actual currentPlayerPosition: ${state.currentPlayerPosition}`)

  expect(state.currentPlayerPosition).toBe(null)
})
