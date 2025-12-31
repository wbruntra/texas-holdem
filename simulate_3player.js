import {
  createGameState,
  startNewHand,
  advanceRound,
  isBettingRoundComplete,
  shouldContinueToNextRound,
  processShowdown,
} from './backend/lib/game-state-machine.js'

import { validateAction, processAction, getValidActions } from './backend/lib/betting-logic.js'
import { calculatePots } from './backend/lib/pot-manager.js'
import { evaluateHand } from './backend/lib/poker-engine.js'

const GAME_STATUS = {
  INIT: 'init',
  ACTIVE: 'active',
  SHOWDOWN: 'showdown',
  COMPLETED: 'completed',
}

const ROUND = {
  PREFLOP: 'preflop',
  FLOP: 'flop',
  TURN: 'turn',
  RIVER: 'river',
  SHOWDOWN: 'showdown',
}

const PLAYER_STATUS = {
  ACTIVE: 'active',
  FOLDED: 'folded',
  ALL_IN: 'all-in',
  OUT: 'out',
}

const STARTING_CHIPS = 1000
let state
let handCount = 0

function validateChipTotal(context) {
  const total = state.players.reduce((sum, p) => sum + p.chips, 0) + state.pot
  if (total !== STARTING_CHIPS * 3) {
    console.log(`\n❌ ${context}: Chips don't add up!`)
    console.log(
      `Players: ${state.players.map((p) => p.chips).join(', ')}, Pot: ${state.pot}, Total: ${total} (should be ${STARTING_CHIPS * 3})`,
    )
    return false
  }
  return true
}

function displayState(state, handNum) {
  const chips = state.players.map((p, i) => `P${i}=$${p.chips}`).join(' ')
  console.log(`  After hand ${handNum}: ${chips} Pot=$${state.pot}`)
}

function playBettingRound() {
  let iterations = 0
  const maxIterations = 100

  while (iterations < maxIterations) {
    iterations++

    if (isBettingRoundComplete(state)) {
      break
    }

    const playerPos = state.currentPlayerPosition
    const player = state.players[playerPos]

    // Skip folded and out players
    if (player.status === PLAYER_STATUS.FOLDED || player.status === PLAYER_STATUS.OUT) {
      state = processAction(state, playerPos, 'fold', 0)
      continue
    }

    // Get valid actions
    const validActions = getValidActions(state, playerPos)

    if (!validActions.canAct) {
      console.log(`   ⚠️  P${playerPos} cannot act!`)
      break
    }

    // Determine action based on bot strategy
    let decision
    if (playerPos === 0) {
      // Bot 0: always bet $50 if possible, else call or check
      if (validActions.canBet) {
        decision = { action: 'bet', amount: 50 }
      } else if (validActions.canCall) {
        decision = { action: 'call', amount: 0 }
      } else if (validActions.canCheck) {
        decision = { action: 'check', amount: 0 }
      } else {
        decision = { action: 'fold', amount: 0 }
      }
    } else {
      // Bots 1 and 2: always call if possible, else check, else fold
      if (validActions.canCall) {
        decision = { action: 'call', amount: 0 }
      } else if (validActions.canCheck) {
        decision = { action: 'check', amount: 0 }
      } else {
        decision = { action: 'fold', amount: 0 }
      }
    }

    const validation = validateAction(state, playerPos, decision.action, decision.amount || 0)
    if (!validation.valid) {
      console.log(`   ⚠️  P${playerPos} ${decision.action} invalid: ${validation.error}`)
      break
    }

    state = processAction(state, playerPos, decision.action, decision.amount || 0)

    if (!validateChipTotal(`after P${playerPos} ${decision.action}`)) {
      process.exit(1)
    }
  }

  if (iterations >= maxIterations) {
    console.log(`   ⚠️  Max iterations reached!`)
  }
}

function playHand() {
  handCount++

  state = startNewHand(state)

  // Check if game ended after startNewHand
  if (state.status === 'completed') {
    console.log(`\n🎯 Game completed at start of hand ${handCount} - only one player has chips`)
    return false
  }

  const initialTotal = state.players.reduce((s, p) => s + p.chips, 0) + state.pot
  const chips = state.players.map((p, i) => `P${i}=$${p.chips}`).join(' ')
  console.log(`Hand ${handCount}: ${chips} Pot=$${state.pot} (total=$${initialTotal})`)

  if (!validateChipTotal('after startNewHand')) {
    process.exit(1)
  }

  // Play preflop
  playBettingRound()

  // Check if hand should end (fewer than 2 active players)
  const afterPreflopActive = state.players.filter(
    (p) => p.status === PLAYER_STATUS.ACTIVE || p.status === PLAYER_STATUS.ALL_IN,
  )

  if (afterPreflopActive.length < 2) {
    state = advanceRound(state)
    state = processShowdown(state)

    if (state.status === 'completed') {
      return false
    }
    return true
  }

  // Play through streets
  const streets = [ROUND.FLOP, ROUND.TURN, ROUND.RIVER]
  for (const street of streets) {
    if (!shouldContinueToNextRound(state)) break

    state = advanceRound(state)

    if (!validateChipTotal(`after advancing to ${state.currentRound}`)) {
      process.exit(1)
    }

    playBettingRound()

    const stillActive = state.players.filter(
      (p) => p.status === PLAYER_STATUS.ACTIVE || p.status === PLAYER_STATUS.ALL_IN,
    )

    if (stillActive.length < 2) {
      state = advanceRound(state)
      break
    }
  }

  // Showdown
  if (state.currentRound === ROUND.RIVER && isBettingRoundComplete(state)) {
    const chipsStr = state.players.map((p, i) => `P${i}=$${p.chips} (bet=${p.totalBet})`).join(' ')
    console.log(`  Showdown: ${chipsStr} Pot=${state.pot}`)

    state = advanceRound(state)

    if (!validateChipTotal('before processShowdown')) {
      process.exit(1)
    }

    const pots = calculatePots(state.players)
    console.log(`  Pots calculated:`, pots.map((p) => `$${p.amount}`).join(', '))

    state = processShowdown(state)

    if (state.status === 'completed') {
      console.log(`  → Game completed after showdown`)
      return false
    }

    const winners = state.winners.map((w) => `P${w}`).join(', ')
    console.log(`  → Winners: ${winners}`)

    if (!validateChipTotal('after processShowdown')) {
      console.log(`\n💥 CHIP ERROR at showdown!`)
      console.log(`Pots:`, state.pots)
      console.log(
        `Players:`,
        state.players.map((p) => ({
          chips: p.chips,
          totalBet: p.totalBet,
          status: p.status,
        })),
      )
      process.exit(1)
    }
  } else if (state.currentRound !== ROUND.SHOWDOWN) {
    // Early end
    const chipsStr = state.players.map((p, i) => `P${i}=$${p.chips} (bet=${p.totalBet})`).join(' ')
    console.log(`  Early end: ${chipsStr} Pot=${state.pot} Round=${state.currentRound}`)

    state = advanceRound(state)
    state = processShowdown(state)

    if (state.status === 'completed') {
      console.log(`  → Game completed after early showdown`)
      return false
    }
  }

  return true
}

// Initialize
console.log('🎮 3-Player Aggressive Betting Simulation')
console.log('Strategy: P0 always bets $50, P1 and P2 always call')
console.log(`Starting: $${STARTING_CHIPS} each\n`)

const players = [
  { id: '1', name: 'Aggressive Bot' },
  { id: '2', name: 'Calling Bot 1' },
  { id: '3', name: 'Calling Bot 2' },
]

state = createGameState({ players, startingChips: STARTING_CHIPS })

if (!validateChipTotal('initial state')) {
  process.exit(1)
}

// Play until game is completed
try {
  while (state.status !== 'completed') {
    const handCompleted = playHand()

    if (!handCompleted || state.status === 'completed') {
      break
    }

    // Progress update every 10 hands
    if (handCount % 10 === 0) {
      const chips = state.players.map((p, i) => `P${i}=$${p.chips}`).join(' ')
      console.log(`[${handCount} hands] ${chips}`)
    }

    // Safety limit - but for 3-player, let it run a bit longer
    if (handCount >= 300) {
      console.log(`\n⏸️  Reached 300 hands, stopping.`)
      break
    }
  }

  console.log(`\n🎯 GAME OVER!`)
  console.log(
    `Final state - ${state.players.map((p, i) => `P${i}: $${p.chips}`).join(', ')}, Pot: $${state.pot}`,
  )
  console.log(`\n✅ SIMULATION COMPLETE`)
  console.log(`Hands played: ${handCount}`)
  const finalChips = state.players.map((p) => p.chips).join(' + ')
  console.log(`Final: ${state.players.map((p, i) => `P${i}=$${p.chips}`).join(' ')}`)
  const total = state.players.reduce((s, p) => s + p.chips, 0) + state.pot
  console.log(`Total: $${total} (should be $${STARTING_CHIPS * 3})`)
} catch (error) {
  console.log(`\n❌ ERROR:`, error.message)
  console.log(error.stack)
  process.exit(1)
}
