import { describe, test, expect } from 'bun:test'

const {
  GAME_STATUS,
  ROUND,
  PLAYER_STATUS,
  ACTION_TYPE,
  createGameState,
  startNewHand,
  advanceRound,
  isBettingRoundComplete,
  shouldContinueToNextRound,
  processShowdown,
  getNextActivePosition,
} = require('../lib/game-state-machine')

const { validateAction, processAction, getValidActions } = require('../lib/betting-logic')
const { calculatePots } = require('../lib/pot-manager')

const STARTING_CHIPS = 1000
const PLAYER_COUNT = 3
const TOTAL_CHIPS = STARTING_CHIPS * PLAYER_COUNT
const MAX_HANDS = 300
const MAX_BETTING_ITERATIONS = 1000

const playerInPot = (player) =>
  player.status === PLAYER_STATUS.ACTIVE || player.status === PLAYER_STATUS.ALL_IN

function assertChipTotal(state, context) {
  const chipSum = state.players.reduce((sum, player) => sum + player.chips, 0)
  const betSum = state.players.reduce((sum, player) => sum + (player.totalBet || 0), 0)
  const total = chipSum + betSum
  if (total !== TOTAL_CHIPS) {
    throw new Error(
      `${context}: expected ${TOTAL_CHIPS}, got ${total} (chips ${chipSum}, bets ${betSum})`,
    )
  }
}

function decideAction(playerPos, player, validActions, state) {
  if (playerPos === 0 && validActions.canBet) {
    const betAmount = Math.max(state.bigBlind, Math.min(50, player.chips))
    if (betAmount <= player.chips) {
      return { action: ACTION_TYPE.BET, amount: betAmount }
    }
  }

  if (validActions.canCall) {
    return { action: ACTION_TYPE.CALL }
  }

  if (validActions.canCheck) {
    return { action: ACTION_TYPE.CHECK }
  }

  return { action: ACTION_TYPE.FOLD }
}

function playBettingRound(state) {
  let iterations = 0

  while (!isBettingRoundComplete(state) && iterations < MAX_BETTING_ITERATIONS) {
    const playerPos = state.currentPlayerPosition
    if (playerPos === null || playerPos === undefined) {
      break
    }

    const player = state.players[playerPos]
    if (player.status !== PLAYER_STATUS.ACTIVE) {
      const nextPos = getNextActivePosition(state.players, playerPos)
      state = { ...state, currentPlayerPosition: nextPos }
      iterations++
      continue
    }

    const validActions = getValidActions(state, playerPos)
    expect(validActions.canAct).toBe(true)

    const decision = decideAction(playerPos, player, validActions, state)
    const validation = validateAction(state, playerPos, decision.action, decision.amount ?? 0)
    expect(validation.valid).toBe(true)

    state = processAction(state, playerPos, decision.action, decision.amount ?? 0)
    assertChipTotal(state, `after P${playerPos} ${decision.action}`)
    iterations++
  }

  expect(iterations).toBeLessThan(MAX_BETTING_ITERATIONS)
  return state
}

function playHand(state) {
  state = startNewHand(state)
  if (state.status === GAME_STATUS.COMPLETED) {
    return state
  }

  assertChipTotal(state, 'after startNewHand')

  state = playBettingRound(state)

  const activeAfterPreflop = state.players.filter(playerInPot)
  if (activeAfterPreflop.length < 2) {
    state = advanceRound(state)
    assertChipTotal(state, 'after auto advance (preflop)')

    state = processShowdown(state)
    assertChipTotal(state, 'after early showdown')
    return state
  }

  for (const _ of [ROUND.FLOP, ROUND.TURN, ROUND.RIVER]) {
    if (!shouldContinueToNextRound(state)) {
      break
    }

    state = advanceRound(state)
    assertChipTotal(state, `after advancing to ${state.currentRound}`)

    state = playBettingRound(state)

    const stillActive = state.players.filter(playerInPot)
    if (stillActive.length < 2) {
      state = advanceRound(state)
      assertChipTotal(state, 'after auto advance (street end)')
      break
    }
  }

  if (state.currentRound === ROUND.RIVER && isBettingRoundComplete(state)) {
    state = advanceRound(state)
    assertChipTotal(state, 'before showdown')

    const pots = calculatePots(state.players)
    expect(pots.length).toBeGreaterThan(0)

    state = processShowdown(state)
    assertChipTotal(state, 'after showdown')
    return state
  }

  if (state.currentRound !== ROUND.SHOWDOWN) {
    state = advanceRound(state)
    assertChipTotal(state, 'before late showdown')

    state = processShowdown(state)
    assertChipTotal(state, 'after late showdown')
  }

  return state
}

describe('3-player aggressive simulation', () => {
  test('runs to completion without dropping chips', () => {
    const players = [
      { id: '1', name: 'Aggressive Bot' },
      { id: '2', name: 'Calling Bot 1' },
      { id: '3', name: 'Calling Bot 2' },
    ]

    let state = createGameState({ players, startingChips: STARTING_CHIPS })
    assertChipTotal(state, 'initial state')

    let handCount = 0

    while (state.status !== GAME_STATUS.COMPLETED && handCount < MAX_HANDS) {
      state = playHand(state)
      handCount += 1
    }

    expect(handCount).toBeGreaterThan(0)
    expect(handCount).toBeLessThanOrEqual(MAX_HANDS)
    expect(state.status).toBe(GAME_STATUS.COMPLETED)
    assertChipTotal(state, 'final state')
  })
})
