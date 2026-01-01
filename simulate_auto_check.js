#!/usr/bin/env node
/**
 * Simulation to test auto-check functionality
 * This creates a scenario where one player goes all-in early
 */

const db = require('./db')
const { createGameState, startNewHand } = require('./backend/lib/game-state-machine')
const { processAction } = require('./backend/lib/betting-logic')

async function simulateAutoCheckScenario() {
  console.log('=== Auto-Check Simulation ===\n')

  // Create a simple 2-player game state
  let state = createGameState({
    smallBlind: 20,
    bigBlind: 40,
    startingChips: 1000,
    players: [
      { id: 'test-p1', name: 'Alice' },
      { id: 'test-p2', name: 'Bob' },
    ],
  })

  // Start a hand
  state = startNewHand(state)

  console.log('Initial State:')
  console.log('Alice (P0):', state.players[0].chips, 'chips')
  console.log('Bob (P1):', state.players[1].chips, 'chips')
  console.log('Current round:', state.currentRound)
  console.log('Current player:', state.currentPlayerPosition)
  console.log('Dealer position:', state.dealerPosition)
  console.log()

  // Preflop: Alice raises, Bob goes all-in, Alice calls
  console.log('=== PREFLOP ===')

  // Alice (P0) is first to act after big blind (P1 is dealer in heads-up)
  console.log('Alice raises to $80')
  state = processAction(state, 0, 'raise', 40) // Raise by 40 (to 80 total)

  console.log('Bob goes all-in for', state.players[1].chips)
  state = processAction(state, 1, 'raise', state.players[1].chips - state.currentBet) // All-in

  console.log('Alice calls')
  state = processAction(state, 0, 'call', 0)

  console.log('\nAfter preflop betting:')
  console.log('Alice chips:', state.players[0].chips, 'status:', state.players[0].status)
  console.log('Bob chips:', state.players[1].chips, 'status:', state.players[1].status)
  console.log('Pot:', state.pot)
  console.log('Current player position:', state.currentPlayerPosition)
  console.log()

  // Check if we should auto-advance
  const { shouldAutoAdvance } = require('./backend/lib/game-state-machine')
  const shouldAuto = shouldAutoAdvance(state)

  console.log('Should auto-advance?', shouldAuto)
  console.log()

  // Count active players with chips
  const activePlayers = state.players.filter((p) => p.status === 'active' && p.chips > 0)
  console.log('Active players with chips:', activePlayers.length)
  if (activePlayers.length > 0) {
    activePlayers.forEach((p) => {
      console.log(`  - ${p.name}: ${p.chips} chips`)
    })
  }
  console.log()

  // This is the scenario where auto-check should kick in
  if (
    activePlayers.length === 1 &&
    state.currentBet === 0 &&
    state.currentPlayerPosition === null
  ) {
    console.log('✅ Betting round complete - will auto-advance through remaining streets')
  } else if (activePlayers.length === 1 && state.currentPlayerPosition !== null) {
    console.log('⚠️  One player needs to act (should be auto-checked)')
    console.log('   Current player position:', state.currentPlayerPosition)
    console.log('   Current bet:', state.currentBet)
  } else {
    console.log('ℹ️  Normal betting situation')
  }

  console.log('\n=== Summary ===')
  console.log('This scenario demonstrates when auto-check should occur:')
  console.log('- One player is all-in (cannot act)')
  console.log('- One player has chips remaining')
  console.log('- No meaningful betting can occur')
  console.log('- System should auto-check for the remaining player on each street')
}

simulateAutoCheckScenario().catch(console.error)
