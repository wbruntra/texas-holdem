const { describe, it, expect } = require('bun:test')
const {
  validateAction,
  processAction,
  getNextPlayerToAct,
  getValidActions,
  canRevealCard,
} = require('../betting-logic')
const { PLAYER_STATUS, ACTION_TYPE, ROUND } = require('../game-constants')

function createTestGameState(overrides = {}) {
  const defaultState = {
    status: 'active',
    currentRound: ROUND.PREFLOP,
    currentPlayerPosition: 0,
    action_finished: false,
    pot: 0,
    currentBet: 0,
    lastRaise: 10,
    bigBlind: 10,
    smallBlind: 5,
    communityCards: [],
    deck: [],
    dealerPosition: 0,
    handNumber: 0,
    players: [
      {
        id: 1,
        name: 'Alice',
        position: 0,
        chips: 1000,
        currentBet: 0,
        totalBet: 0,
        holeCards: [],
        status: PLAYER_STATUS.ACTIVE,
        lastAction: null,
        showCards: false,
      },
      {
        id: 2,
        name: 'Bob',
        position: 1,
        chips: 1000,
        currentBet: 0,
        totalBet: 0,
        holeCards: [],
        status: PLAYER_STATUS.ACTIVE,
        lastAction: null,
        showCards: false,
      },
    ],
  }
  return { ...defaultState, ...overrides }
}

describe('validateAction', () => {
  it('should reject actions when action_finished is true', () => {
    const state = createTestGameState({
      action_finished: true,
      currentPlayerPosition: 0,
    })
    const result = validateAction(state, 0, ACTION_TYPE.FOLD)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Board must be advanced before actions')
  })

  it('should reject actions when not player turn', () => {
    const state = createTestGameState({ currentPlayerPosition: 1 })
    const result = validateAction(state, 0, ACTION_TYPE.FOLD)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Not your turn')
  })

  it('should reject actions for folded players', () => {
    const state = createTestGameState({ currentPlayerPosition: 0 })
    state.players[0].status = PLAYER_STATUS.FOLDED
    const result = validateAction(state, 0, ACTION_TYPE.FOLD)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Already folded')
  })

  it('should allow fold for active players', () => {
    const state = createTestGameState({ currentPlayerPosition: 0 })
    const result = validateAction(state, 0, ACTION_TYPE.FOLD)
    expect(result.valid).toBe(true)
  })

  it('should allow check when no bet to call', () => {
    const state = createTestGameState({
      currentPlayerPosition: 0,
      currentBet: 0,
    })
    state.players[0].currentBet = 0
    const result = validateAction(state, 0, ACTION_TYPE.CHECK)
    expect(result.valid).toBe(true)
  })

  it('should reject check when there is a bet to call', () => {
    const state = createTestGameState({
      currentPlayerPosition: 0,
      currentBet: 20,
    })
    state.players[0].currentBet = 0
    const result = validateAction(state, 0, ACTION_TYPE.CHECK)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Cannot check, must call or raise')
  })

  it('should allow call when there is a bet to call', () => {
    const state = createTestGameState({
      currentPlayerPosition: 0,
      currentBet: 20,
    })
    state.players[0].currentBet = 0
    const result = validateAction(state, 0, ACTION_TYPE.CALL)
    expect(result.valid).toBe(true)
  })

  it('should allow valid bet', () => {
    const state = createTestGameState({
      currentPlayerPosition: 0,
      currentBet: 0,
      bigBlind: 10,
    })
    const result = validateAction(state, 0, ACTION_TYPE.BET, 50)
    expect(result.valid).toBe(true)
  })

  it('should allow valid raise', () => {
    const state = createTestGameState({
      currentPlayerPosition: 0,
      currentBet: 20,
      lastRaise: 10,
    })
    const result = validateAction(state, 0, ACTION_TYPE.RAISE, 15)
    expect(result.valid).toBe(true)
  })

  it('should allow all-in with chips', () => {
    const state = createTestGameState({ currentPlayerPosition: 0 })
    const result = validateAction(state, 0, ACTION_TYPE.ALL_IN)
    expect(result.valid).toBe(true)
  })

  it('should reject invalid action types', () => {
    const state = createTestGameState({ currentPlayerPosition: 0 })
    const result = validateAction(state, 0, 'invalid_action')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Invalid action type')
  })
})

describe('processAction', () => {
  it('should throw error for invalid action', () => {
    const state = createTestGameState({ currentPlayerPosition: 0 })
    expect(() => {
      processAction(state, 0, 'invalid_action')
    }).toThrow('Invalid action type')
  })

  it('should process fold action', () => {
    const state = createTestGameState({ currentPlayerPosition: 0 })
    const newState = processAction(state, 0, ACTION_TYPE.FOLD)

    expect(newState.players[0].status).toBe(PLAYER_STATUS.FOLDED)
    expect(newState.players[0].lastAction).toBe(ACTION_TYPE.FOLD)
    expect(newState.currentPlayerPosition).toBe(1)
  })

  it('should process check action', () => {
    const state = createTestGameState({
      currentPlayerPosition: 0,
      currentBet: 0,
    })
    const newState = processAction(state, 0, ACTION_TYPE.CHECK)

    expect(newState.players[0].lastAction).toBe(ACTION_TYPE.CHECK)
    expect(newState.currentPlayerPosition).toBe(1)
  })

  it('should process call action', () => {
    const state = createTestGameState({
      currentPlayerPosition: 0,
      currentBet: 20,
      pot: 10,
    })
    state.players[0].currentBet = 0
    const newState = processAction(state, 0, ACTION_TYPE.CALL)

    expect(newState.players[0].chips).toBe(980)
    expect(newState.players[0].currentBet).toBe(20)
    expect(newState.players[0].totalBet).toBe(20)
    expect(newState.pot).toBe(30)
    expect(newState.players[0].lastAction).toBe(ACTION_TYPE.CALL)
  })

  it('should process bet action', () => {
    const state = createTestGameState({
      currentPlayerPosition: 0,
      currentBet: 0,
      pot: 10,
    })
    const newState = processAction(state, 0, ACTION_TYPE.BET, 50)

    expect(newState.players[0].chips).toBe(950)
    expect(newState.players[0].currentBet).toBe(50)
    expect(newState.players[0].totalBet).toBe(50)
    expect(newState.pot).toBe(60)
    expect(newState.currentBet).toBe(50)
    expect(newState.lastRaise).toBe(50)
    expect(newState.players[0].lastAction).toBe(ACTION_TYPE.BET)
  })

  it('should process raise action', () => {
    const state = createTestGameState({
      currentPlayerPosition: 0,
      currentBet: 20,
      lastRaise: 10,
      pot: 10,
    })
    state.players[0].currentBet = 0
    const newState = processAction(state, 0, ACTION_TYPE.RAISE, 30)

    expect(newState.players[0].chips).toBe(950)
    expect(newState.players[0].currentBet).toBe(50)
    expect(newState.players[0].totalBet).toBe(50)
    expect(newState.pot).toBe(60)
    expect(newState.currentBet).toBe(50)
    expect(newState.lastRaise).toBe(30)
    expect(newState.players[0].lastAction).toBe(ACTION_TYPE.RAISE)
  })

  it('should process all-in action', () => {
    const state = createTestGameState({
      currentPlayerPosition: 0,
      currentBet: 0,
      pot: 10,
    })
    const newState = processAction(state, 0, ACTION_TYPE.ALL_IN)

    expect(newState.players[0].chips).toBe(0)
    expect(newState.players[0].currentBet).toBe(1000)
    expect(newState.players[0].totalBet).toBe(1000)
    expect(newState.pot).toBe(1010)
    expect(newState.currentBet).toBe(1000)
    expect(newState.players[0].status).toBe(PLAYER_STATUS.ALL_IN)
    expect(newState.players[0].lastAction).toBe(ACTION_TYPE.ALL_IN)
  })

  it('should end betting round when all players have matched bets', () => {
    const state = createTestGameState({
      currentPlayerPosition: 0,
      currentBet: 20,
    })
    state.players[0].currentBet = 0
    state.players[1].currentBet = 20
    state.players[1].lastAction = 'call'
    const newState = processAction(state, 0, ACTION_TYPE.CALL)

    expect(newState.currentPlayerPosition).toBe(null)
    expect(newState.action_finished).toBe(false)
  })
})

describe('getNextPlayerToAct', () => {
  it('should return next active player in sequence', () => {
    const players = [{ status: PLAYER_STATUS.ACTIVE }, { status: PLAYER_STATUS.ACTIVE }]
    expect(getNextPlayerToAct(players, 0)).toBe(1)
    expect(getNextPlayerToAct(players, 1)).toBe(0)
  })

  it('should skip non-active players', () => {
    const players = [{ status: PLAYER_STATUS.FOLDED }, { status: PLAYER_STATUS.ACTIVE }]
    expect(getNextPlayerToAct(players, 0)).toBe(1)
  })

  it('should return null when no active players', () => {
    const players = [{ status: PLAYER_STATUS.FOLDED }, { status: PLAYER_STATUS.ALL_IN }]
    expect(getNextPlayerToAct(players, 0)).toBe(null)
  })
})

describe('getValidActions', () => {
  it('should return no actions when not player turn', () => {
    const state = createTestGameState({ currentPlayerPosition: 1 })
    const actions = getValidActions(state, 0)

    expect(actions.canAct).toBe(false)
  })

  it('should return no actions for non-active players', () => {
    const state = createTestGameState({ currentPlayerPosition: 0 })
    state.players[0].status = PLAYER_STATUS.ALL_IN
    const actions = getValidActions(state, 0)

    expect(actions.canAct).toBe(false)
  })

  it('should return correct actions for standard situation', () => {
    const state = createTestGameState({
      currentPlayerPosition: 0,
      currentBet: 0,
      bigBlind: 10,
    })
    const actions = getValidActions(state, 0)

    expect(actions.canAct).toBe(true)
    expect(actions.canFold).toBe(true)
    expect(actions.canCheck).toBe(true)
    expect(actions.canBet).toBe(true)
    expect(actions.minBet).toBe(10)
    expect(actions.canRaise).toBe(false)
    expect(actions.canAllIn).toBe(true)
    expect(actions.allInAmount).toBe(1000)
  })

  it('should return correct actions when there is a bet to call', () => {
    const state = createTestGameState({
      currentPlayerPosition: 0,
      currentBet: 20,
      lastRaise: 10,
    })
    state.players[0].currentBet = 0
    const actions = getValidActions(state, 0)

    expect(actions.canAct).toBe(true)
    expect(actions.canFold).toBe(true)
    expect(actions.canCheck).toBe(false)
    expect(actions.canCall).toBe(true)
    expect(actions.callAmount).toBe(20)
    expect(actions.canRaise).toBe(true)
    expect(actions.minRaise).toBe(10)
    expect(actions.canAllIn).toBe(true)
  })

  it('should allow advance when action_finished', () => {
    const state = createTestGameState({
      action_finished: true,
      currentPlayerPosition: null,
    })
    const actions = getValidActions(state, 0)

    expect(actions.canAct).toBe(false)
    expect(actions.canAdvance).toBe(true)
    expect(actions.advanceReason).toBe('all_in_situation')
  })
})

describe('canRevealCard', () => {
  it('should reject reveal in preflop', () => {
    const state = createTestGameState({
      currentRound: ROUND.PREFLOP,
      action_finished: true,
    })
    const result = canRevealCard(state, 0)

    expect(result.canReveal).toBe(false)
    expect(result.error).toBe('Cannot reveal card in this round')
  })

  it('should reject reveal when action not finished', () => {
    const state = createTestGameState({
      currentRound: ROUND.FLOP,
      action_finished: false,
    })
    const result = canRevealCard(state, 0)

    expect(result.canReveal).toBe(false)
    expect(result.error).toBe('Round not ready for advance')
  })

  it('should allow reveal when on flop with 3 cards', () => {
    const state = createTestGameState({
      currentRound: ROUND.FLOP,
      communityCards: [
        { rank: 'A', suit: 'hearts' },
        { rank: 'K', suit: 'diamonds' },
        { rank: 'Q', suit: 'clubs' },
      ],
      action_finished: true,
    })
    const result = canRevealCard(state, 0)

    expect(result.canReveal).toBe(true)
    expect(result.nextRound).toBe(ROUND.TURN)
  })

  it('should allow reveal when on turn with 4 cards', () => {
    const state = createTestGameState({
      currentRound: ROUND.TURN,
      communityCards: [
        { rank: 'A', suit: 'hearts' },
        { rank: 'K', suit: 'diamonds' },
        { rank: 'Q', suit: 'clubs' },
        { rank: 'J', suit: 'spades' },
      ],
      action_finished: true,
    })
    const result = canRevealCard(state, 0)

    expect(result.canReveal).toBe(true)
    expect(result.nextRound).toBe(ROUND.RIVER)
  })

  it('should allow reveal when on river with 5 cards', () => {
    const state = createTestGameState({
      currentRound: ROUND.RIVER,
      communityCards: [
        { rank: 'A', suit: 'hearts' },
        { rank: 'K', suit: 'diamonds' },
        { rank: 'Q', suit: 'clubs' },
        { rank: 'J', suit: 'spades' },
        { rank: '10', suit: 'hearts' },
      ],
      action_finished: true,
    })
    const result = canRevealCard(state, 0)

    expect(result.canReveal).toBe(true)
    expect(result.nextRound).toBe(ROUND.SHOWDOWN)
  })

  it('should allow reveal when cards already revealed', () => {
    const state = createTestGameState({
      currentRound: ROUND.FLOP,
      communityCards: [],
      action_finished: true,
    })
    const result = canRevealCard(state, 0)

    expect(result.canReveal).toBe(true)
    expect(result.nextRound).toBeUndefined()
  })
})
