import {
  PLAYER_STATUS,
  ACTION_TYPE,
  ROUND,
  type PlayerStatus,
  type ActionType,
} from './game-constants'
import type { Card } from './poker-engine'

export interface Player {
  id: string | number
  name: string
  position: number
  chips: number
  currentBet: number
  totalBet?: number
  holeCards: Card[]
  status: PlayerStatus
  isDealer: boolean
  isSmallBlind: boolean
  isBigBlind: boolean
  lastAction: string | null
  showCards: boolean
}

export interface GameState {
  status: string
  smallBlind: number
  bigBlind: number
  players: Player[]
  dealerPosition: number
  currentRound: string | null
  currentPlayerPosition: number | null
  pot: number
  pots: Array<{
    amount: number
    eligiblePlayers: number[]
    winners: number[] | null
    winAmount?: number
    winningRankName?: string
  }>
  currentBet: number
  communityCards: Card[]
  deck: Card[]
  handNumber: number
  lastRaise: number
  showdownProcessed: boolean
  winners?: number[]
}

export interface ActionValidation {
  valid: boolean
  error?: string
}

export interface ValidActions {
  canAct: boolean
  canFold?: boolean
  canCheck?: boolean
  canCall?: boolean
  callAmount?: number
  canBet?: boolean
  minBet?: number
  canRaise?: boolean
  minRaise?: number
  maxRaise?: number
  canAllIn?: boolean
  allInAmount?: number
  canReveal?: boolean
  reason?: string
  nextRound?: string
}

export interface CardRevealResult {
  canReveal: boolean
  error?: string
  reason?: string
  nextRound?: string
}

export function validateAction(
  state: GameState,
  playerPosition: number,
  action: string,
  amount: number = 0,
): ActionValidation {
  const player = state.players[playerPosition]

  if (state.currentPlayerPosition !== playerPosition) {
    return { valid: false, error: 'Not your turn' }
  }

  if (player.status === PLAYER_STATUS.FOLDED) {
    return { valid: false, error: 'Already folded' }
  }

  if (player.status === PLAYER_STATUS.ALL_IN) {
    return { valid: false, error: 'Already all-in' }
  }

  if (player.status === PLAYER_STATUS.OUT) {
    return { valid: false, error: 'Out of game' }
  }

  const callAmount = state.currentBet - player.currentBet

  switch (action) {
    case ACTION_TYPE.FOLD:
      return { valid: true }

    case ACTION_TYPE.CHECK:
      if (callAmount > 0) {
        return { valid: false, error: 'Cannot check, must call or raise' }
      }
      return { valid: true }

    case ACTION_TYPE.CALL:
      if (callAmount === 0) {
        return { valid: false, error: 'Nothing to call' }
      }
      if (player.chips === 0) {
        return { valid: false, error: 'No chips to call' }
      }
      return { valid: true }

    case ACTION_TYPE.BET:
      if (state.currentBet > 0) {
        return { valid: false, error: 'Cannot bet, must call or raise' }
      }
      if (amount < state.bigBlind) {
        return { valid: false, error: `Minimum bet is ${state.bigBlind}` }
      }
      if (amount > player.chips) {
        return { valid: false, error: 'Not enough chips' }
      }
      return { valid: true }

    case ACTION_TYPE.RAISE:
      if (state.currentBet === 0) {
        return { valid: false, error: 'No bet to raise, use bet action' }
      }
      if (amount <= 0) {
        return { valid: false, error: 'Raise amount must be greater than 0' }
      }

      const totalBet = callAmount + amount
      if (totalBet > player.chips) {
        return { valid: false, error: 'Not enough chips' }
      }

      const minRaiseTo = state.currentBet + state.lastRaise
      const newPlayerBet = player.currentBet + totalBet

      const isAllIn = totalBet === player.chips
      if (!isAllIn && newPlayerBet < minRaiseTo) {
        return { valid: false, error: `Minimum raise is ${minRaiseTo}` }
      }

      return { valid: true }

    case ACTION_TYPE.ALL_IN:
      if (player.chips === 0) {
        return { valid: false, error: 'No chips to bet' }
      }
      return { valid: true }

    default:
      return { valid: false, error: 'Invalid action type' }
  }
}

export function processAction(
  state: GameState,
  playerPosition: number,
  action: string,
  amount: number = 0,
): GameState {
  const validation = validateAction(state, playerPosition, action, amount)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  const players = [...state.players]
  const player = { ...players[playerPosition] }
  let newPot = state.pot
  let newCurrentBet = state.currentBet
  let newLastRaise = state.lastRaise

  switch (action) {
    case ACTION_TYPE.FOLD:
      player.status = PLAYER_STATUS.FOLDED
      player.lastAction = ACTION_TYPE.FOLD
      break

    case ACTION_TYPE.CHECK:
      player.lastAction = ACTION_TYPE.CHECK
      break

    case ACTION_TYPE.CALL: {
      const callAmount = state.currentBet - player.currentBet
      const actualCall = Math.min(callAmount, player.chips)
      player.chips -= actualCall
      player.currentBet += actualCall
      player.totalBet = (player.totalBet || 0) + actualCall
      newPot += actualCall
      player.lastAction = ACTION_TYPE.CALL

      if (player.chips === 0) {
        player.status = PLAYER_STATUS.ALL_IN
        player.lastAction = ACTION_TYPE.ALL_IN
      }
      break
    }

    case ACTION_TYPE.BET: {
      player.chips -= amount
      player.currentBet += amount
      player.totalBet = (player.totalBet || 0) + amount
      newPot += amount
      newCurrentBet = player.currentBet
      newLastRaise = amount
      player.lastAction = ACTION_TYPE.BET

      if (player.chips === 0) {
        player.status = PLAYER_STATUS.ALL_IN
        player.lastAction = ACTION_TYPE.ALL_IN
      }
      break
    }

    case ACTION_TYPE.RAISE: {
      const callAmount = state.currentBet - player.currentBet
      const totalBet = callAmount + amount
      player.chips -= totalBet
      player.currentBet += totalBet
      player.totalBet = (player.totalBet || 0) + totalBet
      newPot += totalBet
      newCurrentBet = player.currentBet
      newLastRaise = amount
      player.lastAction = ACTION_TYPE.RAISE

      if (player.chips === 0) {
        player.status = PLAYER_STATUS.ALL_IN
        player.lastAction = ACTION_TYPE.ALL_IN
      }
      break
    }

    case ACTION_TYPE.ALL_IN: {
      const allInAmount = player.chips
      player.chips = 0
      player.currentBet += allInAmount
      player.totalBet = (player.totalBet || 0) + allInAmount
      newPot += allInAmount

      if (player.currentBet > state.currentBet) {
        const raiseAmount = player.currentBet - state.currentBet
        newCurrentBet = player.currentBet
        newLastRaise = raiseAmount
      }

      player.status = PLAYER_STATUS.ALL_IN
      player.lastAction = ACTION_TYPE.ALL_IN
      break
    }
  }

  players[playerPosition] = player

  const activePlayers = players.filter(
    (p) => p.status === PLAYER_STATUS.ACTIVE || p.status === PLAYER_STATUS.ALL_IN,
  )

  if (activePlayers.length === 0) {
    return {
      ...state,
      players,
      pot: newPot,
      currentBet: newCurrentBet,
      lastRaise: newLastRaise,
      currentPlayerPosition: null,
    }
  }

  const playersWhoCanAct = activePlayers.filter((p) => p.status === PLAYER_STATUS.ACTIVE)

  if (playersWhoCanAct.length === 0) {
    return {
      ...state,
      players,
      pot: newPot,
      currentBet: newCurrentBet,
      lastRaise: newLastRaise,
      currentPlayerPosition: null,
    }
  }

  const betJustIncreased = newCurrentBet > state.currentBet

  if (betJustIncreased) {
    const otherActivePlayers = playersWhoCanAct.filter(
      (p) => players.indexOf(p) !== playerPosition,
    )

    if (otherActivePlayers.length === 0) {
      return {
        ...state,
        players,
        pot: newPot,
        currentBet: newCurrentBet,
        lastRaise: newLastRaise,
        currentPlayerPosition: null,
      }
    }
  } else {
    const allBetsMatched = playersWhoCanAct.every((p) => p.currentBet >= newCurrentBet)
    const allHaveActed = playersWhoCanAct.every((p) => p.lastAction !== null)

    if (allBetsMatched && allHaveActed) {
      return {
        ...state,
        players,
        pot: newPot,
        currentBet: newCurrentBet,
        lastRaise: newLastRaise,
        currentPlayerPosition: null,
      }
    }
  }

  const nextPlayerPosition = getNextPlayerToAct(players, playerPosition)

  return {
    ...state,
    players,
    pot: newPot,
    currentBet: newCurrentBet,
    lastRaise: newLastRaise,
    currentPlayerPosition: nextPlayerPosition,
  }
}

export function getNextPlayerToAct(players: Player[], currentPosition: number): number | null {
  let nextPosition = (currentPosition + 1) % players.length
  let attempts = 0

  while (attempts < players.length) {
    const player = players[nextPosition]
    if (player.status === PLAYER_STATUS.ACTIVE) {
      return nextPosition
    }
    nextPosition = (nextPosition + 1) % players.length
    attempts++
  }

  return null
}

export function getValidActions(state: GameState, playerPosition: number): ValidActions {
  const player = state.players[playerPosition]

  if (state.currentPlayerPosition !== playerPosition) {
    return { canAct: false }
  }

  if (player.status !== PLAYER_STATUS.ACTIVE) {
    return { canAct: false }
  }

  const playersWithChips = state.players.filter(
    (p) => p.chips > 0 && p.status === PLAYER_STATUS.ACTIVE,
  )
  const allInPlayers = state.players.filter((p) => p.status === PLAYER_STATUS.ALL_IN)

  if (playersWithChips.length === 1 && allInPlayers.length > 0) {
    if (player.currentBet >= state.currentBet) {
      return {
        canAct: false,
        canReveal: true,
        reason: 'All other players are all-in. Reveal cards to continue.',
      }
    }
  }

  const callAmount = state.currentBet - player.currentBet
  const canCheck = callAmount === 0
  const canCall = callAmount > 0 && player.chips > 0
  const canBet = state.currentBet === 0 && player.chips >= state.bigBlind
  const canRaise = state.currentBet > 0 && player.chips >= callAmount + state.lastRaise
  const canAllIn = player.chips > 0
  const maxRaise = Math.max(0, player.chips - callAmount)

  const actualCallAmount = Math.min(callAmount, player.chips)

  return {
    canAct: true,
    canFold: true,
    canCheck,
    canCall,
    callAmount: actualCallAmount,
    canBet,
    minBet: state.bigBlind,
    canRaise,
    minRaise: state.lastRaise,
    maxRaise,
    canAllIn,
    allInAmount: player.chips,
  }
}

export function canRevealCard(state: GameState, playerPosition: number): CardRevealResult {
  if (
    !state.currentRound ||
    state.currentRound === ROUND.PREFLOP ||
    state.currentRound === ROUND.SHOWDOWN
  ) {
    return {
      canReveal: false,
      error: 'Cannot reveal card in this round',
      reason: `Current round is ${state.currentRound}`,
    }
  }

  if (state.status !== 'active') {
    return {
      canReveal: false,
      error: 'Game is not active',
      reason: `Game status is ${state.status}`,
    }
  }

  if (!state.players[playerPosition]) {
    return {
      canReveal: false,
      error: 'Player not found',
      reason: 'Invalid player position',
    }
  }

  const player = state.players[playerPosition]
  if (player.status === PLAYER_STATUS.OUT || player.status === PLAYER_STATUS.FOLDED) {
    return {
      canReveal: false,
      error: 'You cannot act',
      reason: `Your status is ${player.status}`,
    }
  }

  const playersWithChips = state.players.filter(
    (p) => p.chips > 0 && p.status === PLAYER_STATUS.ACTIVE,
  ).length

  if (playersWithChips !== 1) {
    return {
      canReveal: false,
      error: `Cannot reveal: ${playersWithChips} players still have chips`,
      reason: `Need exactly 1 player with chips, have ${playersWithChips}`,
    }
  }

  if (state.currentRound === ROUND.FLOP && state.communityCards.length === 3) {
    return { canReveal: true, nextRound: ROUND.TURN }
  }
  if (state.currentRound === ROUND.TURN && state.communityCards.length === 4) {
    return { canReveal: true, nextRound: ROUND.RIVER }
  }
  if (state.currentRound === ROUND.RIVER && state.communityCards.length === 5) {
    return { canReveal: true, nextRound: ROUND.SHOWDOWN }
  }

  return { canReveal: true }
}
