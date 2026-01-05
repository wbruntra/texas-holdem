const { describe, it, expect } = require('bun:test')
const {
  createGameState,
  startNewHand,
  getNextActingPosition,
  shouldAutoAdvance,
  isAllInSituation,
  shouldSetActionFinished,
  getNextActivePosition,
  isBettingRoundComplete,
  advanceRound,
} = require('../game-state-machine')
const { PLAYER_STATUS, GAME_STATUS, ROUND } = require('../game-constants')

function createTestGameState(overrides = {}) {
  const defaultState = {
    status: GAME_STATUS.ACTIVE,
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
      },
      {
        id: 3,
        name: 'Charlie',
        position: 2,
        chips: 1000,
        currentBet: 0,
        totalBet: 0,
        holeCards: [],
        status: PLAYER_STATUS.ACTIVE,
        lastAction: null,
      },
    ],
  }
  return { ...defaultState, ...overrides }
}

describe('createGameState', () => {
  it('should create game with default values', () => {
    const state = createGameState()

    expect(state.status).toBe(GAME_STATUS.WAITING)
    expect(state.smallBlind).toBe(5)
    expect(state.bigBlind).toBe(10)
    expect(state.dealerPosition).toBe(0)
    expect(state.players).toHaveLength(0)
  })

  it('should create game with custom config', () => {
    const players = [
      { id: 1, name: 'Alice', chips: 2000 },
      { id: 2, name: 'Bob', chips: 1500 },
    ]
    const state = createGameState({
      smallBlind: 10,
      bigBlind: 20,
      startingChips: 1000,
      players,
    })

    expect(state.smallBlind).toBe(10)
    expect(state.bigBlind).toBe(20)
    expect(state.players).toHaveLength(2)
    expect(state.players[0].chips).toBe(2000)
    expect(state.players[1].chips).toBe(1500)
    expect(state.players[0].position).toBe(0)
    expect(state.players[1].position).toBe(1)
  })
})

describe('getNextActingPosition', () => {
  it('should return next active player', () => {
    const players = [
      { status: PLAYER_STATUS.ACTIVE },
      { status: PLAYER_STATUS.ACTIVE },
      { status: PLAYER_STATUS.ACTIVE },
    ]
    expect(getNextActingPosition(players, 0)).toBe(1)
    expect(getNextActingPosition(players, 1)).toBe(2)
    expect(getNextActingPosition(players, 2)).toBe(0)
  })

  it('should skip non-active players', () => {
    const players = [
      { status: PLAYER_STATUS.FOLDED },
      { status: PLAYER_STATUS.ALL_IN },
      { status: PLAYER_STATUS.ACTIVE },
    ]
    expect(getNextActingPosition(players, 0)).toBe(2)
    expect(getNextActingPosition(players, 2)).toBe(2)
  })

  it('should return null when no active players', () => {
    const players = [{ status: PLAYER_STATUS.FOLDED }, { status: PLAYER_STATUS.ALL_IN }]
    expect(getNextActingPosition(players, 0)).toBe(null)
  })
})

describe('isAllInSituation', () => {
  it('should return true when one active player and one all-in player', () => {
    const state = createTestGameState()
    state.players[0].status = PLAYER_STATUS.ACTIVE
    state.players[1].status = PLAYER_STATUS.ALL_IN
    state.players[2].status = PLAYER_STATUS.FOLDED

    expect(isAllInSituation(state)).toBe(true)
  })

  it('should return true when all players are all-in', () => {
    const state = createTestGameState()
    state.players[0].status = PLAYER_STATUS.ALL_IN
    state.players[1].status = PLAYER_STATUS.ALL_IN
    state.players[2].status = PLAYER_STATUS.FOLDED

    expect(isAllInSituation(state)).toBe(true)
  })

  it('should return false when multiple active players', () => {
    const state = createTestGameState()
    state.players[0].status = PLAYER_STATUS.ACTIVE
    state.players[1].status = PLAYER_STATUS.ACTIVE
    state.players[2].status = PLAYER_STATUS.FOLDED

    expect(isAllInSituation(state)).toBe(false)
  })

  it('should return false when no players in hand', () => {
    const state = createTestGameState()
    state.players[0].status = PLAYER_STATUS.FOLDED
    state.players[1].status = PLAYER_STATUS.FOLDED
    state.players[2].status = PLAYER_STATUS.FOLDED

    expect(isAllInSituation(state)).toBe(false)
  })
})

describe('isBettingRoundComplete', () => {
  it('should return true when all active players have matched current bet', () => {
    const state = createTestGameState({ currentBet: 50 })
    state.players[0].currentBet = 50
    state.players[0].lastAction = 'call'
    state.players[1].currentBet = 50
    state.players[1].lastAction = 'call'
    state.players[2].status = PLAYER_STATUS.FOLDED

    expect(isBettingRoundComplete(state)).toBe(true)
  })

  it('should return false when active players have not matched bet', () => {
    const state = createTestGameState({ currentBet: 50 })
    state.players[0].currentBet = 10
    state.players[0].lastAction = 'call'
    state.players[1].currentBet = 0
    state.players[1].lastAction = null

    expect(isBettingRoundComplete(state)).toBe(false)
  })

  it('should handle all-in players correctly', () => {
    const state = createTestGameState({ currentBet: 50 })
    state.players[0].currentBet = 50
    state.players[0].lastAction = 'call'
    state.players[1].status = PLAYER_STATUS.ALL_IN
    state.players[1].currentBet = 30 // All-in for less than current bet
    state.players[2].status = PLAYER_STATUS.FOLDED // Make sure player 2 is folded

    expect(isBettingRoundComplete(state)).toBe(true)
  })

  it('should handle multiple active players with all-in', () => {
    const state = createTestGameState({ currentBet: 50 })
    state.players[0].currentBet = 50
    state.players[0].lastAction = 'call'
    state.players[1].currentBet = 50
    state.players[1].lastAction = 'call'
    state.players[2].status = PLAYER_STATUS.ALL_IN
    state.players[2].currentBet = 30 // All-in for less than current bet

    expect(isBettingRoundComplete(state)).toBe(true)
  })

  describe('shouldAutoAdvance', () => {
    it('should return false in showdown', () => {
      const state = createTestGameState({ currentRound: ROUND.SHOWDOWN })
      expect(shouldAutoAdvance(state)).toBe(false)
    })

    it('should return true when only one player remains', () => {
      const state = createTestGameState()
      state.players[0].status = PLAYER_STATUS.ACTIVE
      state.players[1].status = PLAYER_STATUS.FOLDED
      state.players[2].status = PLAYER_STATUS.FOLDED

      expect(shouldAutoAdvance(state)).toBe(true)
    })

    it('should return true when all players are all-in', () => {
      const state = createTestGameState()
      state.players[0].status = PLAYER_STATUS.ALL_IN
      state.players[1].status = PLAYER_STATUS.ALL_IN
      state.players[2].status = PLAYER_STATUS.ALL_IN

      expect(shouldAutoAdvance(state)).toBe(true)
    })

    it('should return false when multiple players can still bet', () => {
      const state = createTestGameState()
      state.players[0].status = PLAYER_STATUS.ACTIVE
      state.players[1].status = PLAYER_STATUS.ACTIVE
      state.players[2].status = PLAYER_STATUS.FOLDED

      expect(shouldAutoAdvance(state)).toBe(false)
    })
  })

  describe('shouldSetActionFinished', () => {
    it('should return true when betting is complete and all-in situation', () => {
      const state = createTestGameState()
      state.players[0].status = PLAYER_STATUS.ACTIVE
      state.players[0].currentBet = 50
      state.players[0].lastAction = 'call'
      state.players[1].status = PLAYER_STATUS.ALL_IN
      state.players[2].status = PLAYER_STATUS.FOLDED
      state.currentPlayerPosition = null
      state.currentBet = 50

      expect(shouldSetActionFinished(state)).toBe(true)
    })

    it('should return false when not all-in situation', () => {
      const state = createTestGameState()
      state.players[0].status = PLAYER_STATUS.ACTIVE
      state.players[0].currentBet = 50
      state.players[0].lastAction = 'call'
      state.players[1].status = PLAYER_STATUS.ACTIVE
      state.players[1].currentBet = 50
      state.players[1].lastAction = 'call'
      state.currentPlayerPosition = null

      expect(shouldSetActionFinished(state)).toBe(false)
    })
  })
})
