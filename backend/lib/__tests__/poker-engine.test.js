const { describe, it, expect } = require('bun:test')
const { shuffleDeck, createDeck } = require('../poker-engine')
const {
  isAllInSituation,
  shouldSetActionFinished,
  createGameState,
  startNewHand,
  advanceRound,
} = require('../game-state-machine')

function cardsEqual(c1, c2) {
  return c1.rank === c2.rank && c1.suit === c2.suit
}

function decksEqual(d1, d2) {
  if (d1.length !== d2.length) return false
  return d1.every((c, i) => cardsEqual(c, d2[i]))
}

function createTestGameState(players) {
  return {
    ...createGameState({ players }),
    deck: createDeck(),
    communityCards: [],
    currentRound: 'flop',
    currentBet: 100,
    pot: 300,
    status: 'active',
    currentPlayerPosition: null,
    action_finished: false,
  }
}

describe('isAllInSituation', () => {
  it('returns true when one active player and one all-in player', () => {
    const state = createTestGameState([
      { id: 1, name: 'Alice', chips: 500 },
      { id: 2, name: 'Bob', chips: 0 },
      { id: 3, name: 'Charlie', chips: 500 },
    ])
    state.players[0].status = 'active'
    state.players[1].status = 'all_in'
    state.players[2].status = 'folded'

    expect(isAllInSituation(state)).toBe(true)
  })

  it('returns true when one active player and multiple all-in players', () => {
    const state = createTestGameState([
      { id: 1, name: 'Alice', chips: 500 },
      { id: 2, name: 'Bob', chips: 0 },
      { id: 3, name: 'Charlie', chips: 0 },
      { id: 4, name: 'Dave', chips: 500 },
    ])
    state.players[0].status = 'active'
    state.players[1].status = 'all_in'
    state.players[2].status = 'all_in'
    state.players[3].status = 'folded'

    expect(isAllInSituation(state)).toBe(true)
  })

  it('returns true when all remaining players are all-in', () => {
    const state = createTestGameState([
      { id: 1, name: 'Alice', chips: 0 },
      { id: 2, name: 'Bob', chips: 0 },
      { id: 3, name: 'Charlie', chips: 0 },
      { id: 4, name: 'Dave', chips: 500 },
    ])
    state.players[0].status = 'all_in'
    state.players[1].status = 'all_in'
    state.players[2].status = 'all_in'
    state.players[3].status = 'folded'

    expect(isAllInSituation(state)).toBe(true)
  })

  it('returns false when multiple active players and no all-in', () => {
    const state = createTestGameState([
      { id: 1, name: 'Alice', chips: 500 },
      { id: 2, name: 'Bob', chips: 500 },
      { id: 3, name: 'Charlie', chips: 500 },
    ])
    state.players[0].status = 'active'
    state.players[1].status = 'active'
    state.players[2].status = 'active'

    expect(isAllInSituation(state)).toBe(false)
  })

  it('returns false when everyone has folded', () => {
    const state = createTestGameState([
      { id: 1, name: 'Alice', chips: 500 },
      { id: 2, name: 'Bob', chips: 500 },
      { id: 3, name: 'Charlie', chips: 500 },
    ])
    state.players[0].status = 'folded'
    state.players[1].status = 'folded'
    state.players[2].status = 'active'

    expect(isAllInSituation(state)).toBe(false)
  })

  it('returns false when no players remain in hand', () => {
    const state = createTestGameState([
      { id: 1, name: 'Alice', chips: 500 },
      { id: 2, name: 'Bob', chips: 500 },
    ])
    state.players[0].status = 'folded'
    state.players[1].status = 'folded'

    expect(isAllInSituation(state)).toBe(false)
  })
})

describe('action_finished tracking', () => {
  it('sets action_finished to true in all-in situation during advanceRound', () => {
    const state = createTestGameState([
      { id: 1, name: 'Alice', chips: 500 },
      { id: 2, name: 'Bob', chips: 0 },
      { id: 3, name: 'Charlie', chips: 500 },
    ])
    state.players[0].status = 'active'
    state.players[1].status = 'all_in'
    state.players[2].status = 'folded'
    state.currentRound = 'flop'
    state.dealerPosition = 0

    const newState = advanceRound(state)

    expect(newState.action_finished).toBe(true)
  })

  it('does not set action_finished when not all-in situation', () => {
    const state = createTestGameState([
      { id: 1, name: 'Alice', chips: 500 },
      { id: 2, name: 'Bob', chips: 500 },
      { id: 3, name: 'Charlie', chips: 500 },
    ])
    state.players[0].status = 'active'
    state.players[1].status = 'active'
    state.players[2].status = 'active'
    state.currentRound = 'flop'
    state.dealerPosition = 0

    const newState = advanceRound(state)

    expect(newState.action_finished).toBe(false)
  })

  it('resets action_finished to false in startNewHand', () => {
    const state = createTestGameState([
      { id: 1, name: 'Alice', chips: 500 },
      { id: 2, name: 'Bob', chips: 500 },
    ])
    state.action_finished = true

    const newState = startNewHand(state)

    expect(newState.action_finished).toBe(false)
  })

  it('returns canAdvance: true when action_finished is true', () => {
    const { getValidActions } = require('../betting-logic')
    const state = createTestGameState([
      { id: 1, name: 'Alice', chips: 500 },
      { id: 2, name: 'Bob', chips: 0 },
    ])
    state.players[0].status = 'active'
    state.players[1].status = 'all_in'
    state.currentRound = 'flop'
    state.dealerPosition = 0
    state.currentPlayerPosition = null
    state.action_finished = true

    const actions = getValidActions(state, 0)

    expect(actions.canAct).toBe(false)
    expect(actions.canAdvance).toBe(true)
    expect(actions.advanceReason).toBe('all_in_situation')
  })

  it('returns canAdvance: false when action_finished is false', () => {
    const { getValidActions } = require('../betting-logic')
    const state = createTestGameState([
      { id: 1, name: 'Alice', chips: 500 },
      { id: 2, name: 'Bob', chips: 500 },
    ])
    state.players[0].status = 'active'
    state.players[1].status = 'active'
    state.currentRound = 'flop'
    state.dealerPosition = 0
    state.currentPlayerPosition = 0
    state.action_finished = false

    const actions = getValidActions(state, 0)

    expect(actions.canAct).toBe(true)
    expect(actions.canAdvance).toBe(false)
  })

  it('returns canAdvance: true between streets even when action_finished is false', () => {
    const { getValidActions } = require('../betting-logic')
    const state = createTestGameState([
      { id: 1, name: 'Alice', chips: 500 },
      { id: 2, name: 'Bob', chips: 500 },
    ])
    state.players[0].status = 'active'
    state.players[1].status = 'active'
    state.currentRound = 'preflop'
    state.currentPlayerPosition = null
    state.action_finished = false

    const actions = getValidActions(state, 1)

    expect(actions.canAct).toBe(false)
    expect(actions.canAdvance).toBe(true)
    expect(actions.advanceReason).toBe('normal')
  })

  it('does not allow folded player to advance in action_finished mode', () => {
    const { getValidActions } = require('../betting-logic')
    const state = createTestGameState([
      { id: 1, name: 'Alice', chips: 500 },
      { id: 2, name: 'Bob', chips: 0 },
    ])
    state.players[0].status = 'folded'
    state.players[1].status = 'all_in'
    state.currentRound = 'flop'
    state.currentPlayerPosition = null
    state.action_finished = true

    const actions = getValidActions(state, 0)

    expect(actions.canAct).toBe(false)
    expect(actions.canAdvance).toBe(undefined)
  })

  it('shouldSetActionFinished returns true after final call ends betting in all-in situation', () => {
    const state = createTestGameState([
      { id: 1, name: 'Bill', chips: 0 },
      { id: 2, name: 'James', chips: 80 },
    ])

    state.currentRound = 'preflop'
    state.currentBet = 420
    state.pot = 840
    state.currentPlayerPosition = null

    state.players[0].status = 'all_in'
    state.players[0].currentBet = 420
    state.players[0].lastAction = 'all_in'

    state.players[1].status = 'active'
    state.players[1].currentBet = 420
    state.players[1].lastAction = 'call'

    expect(shouldSetActionFinished(state)).toBe(true)
  })

  it('shouldSetActionFinished returns false before players have responded', () => {
    const state = createTestGameState([
      { id: 1, name: 'Bill', chips: 0 },
      { id: 2, name: 'James', chips: 80 },
    ])

    state.currentRound = 'preflop'
    state.currentBet = 420
    state.pot = 840
    state.currentPlayerPosition = 1

    state.players[0].status = 'all_in'
    state.players[0].currentBet = 420
    state.players[0].lastAction = 'all_in'

    state.players[1].status = 'active'
    state.players[1].currentBet = 0
    state.players[1].lastAction = null

    expect(shouldSetActionFinished(state)).toBe(false)
  })

  it('blocks betting actions while action_finished is true', () => {
    const { validateAction } = require('../betting-logic')
    const state = createTestGameState([
      { id: 1, name: 'Alice', chips: 500 },
      { id: 2, name: 'Bob', chips: 0 },
    ])
    state.currentRound = 'flop'
    state.currentPlayerPosition = 0
    state.action_finished = true

    const result = validateAction(state, 0, 'check', 0)
    expect(result.valid).toBe(false)
  })

  it('cannot raise when opponent is all-in, but can call', () => {
    const { getValidActions } = require('../betting-logic')
    const state = createTestGameState([
      { id: 1, name: 'Alice', chips: 500 },
      { id: 2, name: 'Bob', chips: 0 },
    ])
    state.players[0].status = 'active'
    state.players[1].status = 'all_in'
    state.currentRound = 'flop'
    state.dealerPosition = 0
    state.currentPlayerPosition = 0
    state.currentBet = 100
    state.action_finished = false

    const actions = getValidActions(state, 0)

    expect(actions.canAct).toBe(true)
    expect(actions.canCall).toBe(true)
    expect(actions.canRaise).toBe(false)
    expect(actions.canFold).toBe(true)
    expect(actions.canCheck).toBe(false)
  })
})

describe('shuffleDeck', () => {
  it('shuffles deck with no seed', () => {
    const deck = createDeck()
    const shuffled = shuffleDeck(deck)

    expect(shuffled).toHaveLength(52)
    expect(decksEqual(shuffled, deck)).toBe(false)
  })

  it('produces same result with same seed', () => {
    const deck1 = createDeck()
    const deck2 = createDeck()
    const seed = 'test-seed-123'

    const shuffled1 = shuffleDeck(deck1, seed)
    const shuffled2 = shuffleDeck(deck2, seed)

    expect(decksEqual(shuffled1, shuffled2)).toBe(true)
  })

  it('produces different results with different seeds', () => {
    const deck1 = createDeck()
    const deck2 = createDeck()

    const shuffled1 = shuffleDeck(deck1, 'seed-one')
    const shuffled2 = shuffleDeck(deck2, 'seed-two')

    expect(decksEqual(shuffled1, shuffled2)).toBe(false)
  })

  it('produces different results with numeric seeds', () => {
    const deck1 = createDeck()
    const deck2 = createDeck()

    const shuffled1 = shuffleDeck(deck1, 12345)
    const shuffled2 = shuffleDeck(deck2, 67890)

    expect(decksEqual(shuffled1, shuffled2)).toBe(false)
  })

  it('produces same result with numeric version of string seed', () => {
    const deck1 = createDeck()
    const deck2 = createDeck()

    const shuffled1 = shuffleDeck(deck1, '12345')
    const shuffled2 = shuffleDeck(deck2, 12345)

    expect(decksEqual(shuffled1, shuffled2)).toBe(true)
  })

  it('can reproduce a specific hand', () => {
    const deck1 = createDeck()
    const seed = 'reproduce-hand'

    const shuffled = shuffleDeck(deck1, seed)
    const firstCards = shuffled.slice(0, 4)

    const deck2 = createDeck()
    const shuffled2 = shuffleDeck(deck2, seed)

    const firstCards2 = shuffled2.slice(0, 4)
    expect(firstCards2.every((c, i) => cardsEqual(c, firstCards[i]))).toBe(true)
  })
})
