import {
  shuffleDeck,
  createDeck,
  dealHoleCards,
  determineWinners,
  evaluateHand,
  type Card,
  type HandEvaluation,
} from './poker-engine'
import { calculatePots, distributePots, awardPots, type Player, type Pot } from './pot-manager'
import {
  GAME_STATUS,
  ROUND,
  PLAYER_STATUS,
  ACTION_TYPE,
  type GameStatus,
  type Round,
  type PlayerStatus,
} from './game-constants'

export interface GameState {
  status: GameStatus
  smallBlind: number
  bigBlind: number
  players: Player[]
  dealerPosition: number
  currentRound: Round | null
  currentPlayerPosition: number | null
  pot: number
  pots: Pot[]
  currentBet: number
  communityCards: Card[]
  deck: Card[]
  handNumber: number
  lastRaise: number
  showdownProcessed: boolean
  winners?: number[]
}

interface GameConfig {
  smallBlind?: number
  bigBlind?: number
  startingChips?: number
  players?: Array<{ id: string | number; name: string; chips?: number }>
}

export function createGameState(config: GameConfig = {}): GameState {
  const { smallBlind = 5, bigBlind = 10, startingChips = 1000, players = [] } = config

  return {
    status: GAME_STATUS.WAITING,
    smallBlind,
    bigBlind,
    players: players.map((p, index) => ({
      id: p.id,
      name: p.name,
      position: index,
      chips: p.chips ?? startingChips,
      currentBet: 0,
      holeCards: [],
      status: PLAYER_STATUS.ACTIVE,
      isDealer: false,
      isSmallBlind: false,
      isBigBlind: false,
      lastAction: null,
      showCards: false,
    })),
    dealerPosition: 0,
    currentRound: null,
    currentPlayerPosition: null,
    pot: 0,
    pots: [],
    currentBet: 0,
    communityCards: [],
    deck: [],
    handNumber: 0,
    lastRaise: 0,
    showdownProcessed: false,
  }
}

export function startNewHand(state: GameState): GameState {
  const activePlayers = state.players.filter((p) => p.chips > 0 && p.status !== PLAYER_STATUS.OUT)

  if (activePlayers.length < 2) {
    return {
      ...state,
      status: GAME_STATUS.COMPLETED,
    }
  }

  const players: Player[] = state.players.map((p) => ({
    ...p,
    currentBet: 0,
    totalBet: 0,
    holeCards: [],
    status: p.chips > 0 ? PLAYER_STATUS.ACTIVE : PLAYER_STATUS.OUT,
    lastAction: null,
    isDealer: false,
    isSmallBlind: false,
    isBigBlind: false,
    showCards: false,
  }))

  let dealerPosition = state.dealerPosition
  if (state.handNumber > 0) {
    dealerPosition = getNextActivePosition(players, dealerPosition)
  }

  const isHeadsUp = activePlayers.length === 2
  const smallBlindPosition = isHeadsUp
    ? dealerPosition
    : getNextActivePosition(players, dealerPosition)
  const bigBlindPosition = getNextActivePosition(players, smallBlindPosition)

  players[dealerPosition].isDealer = true
  players[smallBlindPosition].isSmallBlind = true
  players[bigBlindPosition].isBigBlind = true

  const smallBlindAmount = Math.min(players[smallBlindPosition].chips, state.smallBlind)
  const bigBlindAmount = Math.min(players[bigBlindPosition].chips, state.bigBlind)

  players[smallBlindPosition].chips -= smallBlindAmount
  players[smallBlindPosition].currentBet = smallBlindAmount
  players[smallBlindPosition].totalBet = smallBlindAmount
  if (players[smallBlindPosition].chips === 0) {
    players[smallBlindPosition].status = PLAYER_STATUS.ALL_IN
  }

  players[bigBlindPosition].chips -= bigBlindAmount
  players[bigBlindPosition].currentBet = bigBlindAmount
  players[bigBlindPosition].totalBet = bigBlindAmount
  if (players[bigBlindPosition].chips === 0) {
    players[bigBlindPosition].status = PLAYER_STATUS.ALL_IN
  }

  const pot = smallBlindAmount + bigBlindAmount

  const deck = shuffleDeck(createDeck())

  const activePlayerIndices = players
    .map((p, i) => ({ player: p, index: i }))
    .filter(
      ({ player }) =>
        player.status === PLAYER_STATUS.ACTIVE || player.status === PLAYER_STATUS.ALL_IN,
    )
    .map(({ index }) => index)

  const dealResult = dealHoleCards(deck, activePlayerIndices.length)

  activePlayerIndices.forEach((playerIndex, i) => {
    players[playerIndex].holeCards = dealResult.players[i]
  })

  const firstToAct = getNextActingPosition(players, bigBlindPosition)

  return {
    ...state,
    status: GAME_STATUS.ACTIVE,
    players,
    dealerPosition,
    currentRound: ROUND.PREFLOP,
    currentPlayerPosition: firstToAct,
    pot,
    pots: [],
    currentBet: bigBlindAmount,
    communityCards: [],
    deck: dealResult.deck,
    handNumber: state.handNumber + 1,
    lastRaise: bigBlindAmount,
    winners: [],
    showdownProcessed: false,
  }
}

export function getNextActingPosition(players: Player[], currentPosition: number): number | null {
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

export function shouldAutoAdvance(state: GameState): boolean {
  if (state.currentRound === ROUND.SHOWDOWN) {
    return false
  }

  const activePlayers = state.players.filter(
    (p) => p.status === PLAYER_STATUS.ACTIVE || p.status === PLAYER_STATUS.ALL_IN,
  )

  if (activePlayers.length <= 1) {
    return true
  }

  const canBet = activePlayers.filter((p) => p.status === PLAYER_STATUS.ACTIVE && p.chips > 0)

  if (canBet.length === 0) {
    return true
  }

  if (canBet.length === 1) {
    const player = canBet[0]
    return player.currentBet >= state.currentBet
  }

  return false
}

export function getNextActivePosition(players: Player[], currentPosition: number): number {
  let nextPosition = (currentPosition + 1) % players.length
  let attempts = 0

  while (attempts < players.length) {
    const player = players[nextPosition]
    if (player.status === PLAYER_STATUS.ACTIVE || player.status === PLAYER_STATUS.ALL_IN) {
      return nextPosition
    }
    nextPosition = (nextPosition + 1) % players.length
    attempts++
  }

  return currentPosition
}

export function isBettingRoundComplete(state: GameState): boolean {
  const activePlayers = state.players.filter(
    (p) => p.status === PLAYER_STATUS.ACTIVE || p.status === PLAYER_STATUS.ALL_IN,
  )

  if (activePlayers.length === 0) return true

  const playersWhoCanAct = activePlayers.filter((p) => p.status === PLAYER_STATUS.ACTIVE)

  if (playersWhoCanAct.length === 1) {
    const lastPlayer = playersWhoCanAct[0]
    return lastPlayer.currentBet === state.currentBet && lastPlayer.lastAction !== null
  }

  if (playersWhoCanAct.length === 0) {
    return true
  }

  const allMatched = activePlayers.every((p) => {
    if (p.status === PLAYER_STATUS.ALL_IN) return true
    return p.currentBet === state.currentBet && p.lastAction !== null
  })

  return allMatched
}

export function advanceRound(state: GameState): GameState {
  const activePlayers = state.players.filter((p) => p.status === PLAYER_STATUS.ACTIVE)
  const allInPlayers = state.players.filter((p) => p.status === PLAYER_STATUS.ALL_IN)

  if (activePlayers.length <= 1 && allInPlayers.length === 0) {
    const players = state.players.map((p) => ({
      ...p,
      currentBet: 0,
      lastAction: null,
    }))

    return {
      ...state,
      currentRound: ROUND.SHOWDOWN,
      players,
      currentPlayerPosition: null,
      currentBet: 0,
      lastRaise: 0,
    }
  }

  let newRound: Round | undefined
  let newCards: Card[] = []
  let deckIndex = 0

  deckIndex = 1

  switch (state.currentRound) {
    case ROUND.PREFLOP:
      newRound = ROUND.FLOP
      newCards = state.deck.slice(deckIndex, deckIndex + 3)
      deckIndex += 3
      break
    case ROUND.FLOP:
      newRound = ROUND.TURN
      newCards = state.deck.slice(deckIndex, deckIndex + 1)
      deckIndex += 1
      break
    case ROUND.TURN:
      newRound = ROUND.RIVER
      newCards = state.deck.slice(deckIndex, deckIndex + 1)
      deckIndex += 1
      break
    case ROUND.RIVER:
      newRound = ROUND.SHOWDOWN
      break
    default:
      return state
  }

  const players = state.players.map((p) => ({
    ...p,
    currentBet: 0,
    lastAction: null,
  }))

  const newPot = state.pot

  const firstToAct = getNextActingPosition(players, state.dealerPosition)

  return {
    ...state,
    currentRound: newRound,
    players,
    communityCards: [...state.communityCards, ...newCards],
    deck: state.deck.slice(deckIndex + 1),
    currentPlayerPosition: newRound === ROUND.SHOWDOWN ? null : firstToAct,
    currentBet: 0,
    pot: newPot,
    lastRaise: 0,
  }
}

export function processShowdown(state: GameState): GameState {
  if (state.showdownProcessed) {
    return state
  }

  const eligiblePlayers = state.players.filter(
    (p) => p.status === PLAYER_STATUS.ACTIVE || p.status === PLAYER_STATUS.ALL_IN,
  )

  if (eligiblePlayers.length === 0) {
    return state
  }

  if (eligiblePlayers.length === 1) {
    const winner = eligiblePlayers[0]
    const players = state.players
      .map((p) => (p.id === winner.id ? { ...p, chips: p.chips + state.pot } : { ...p }))
      .map((p) => ({ ...p, currentBet: 0, totalBet: 0 }))

    const pots: Pot[] = [
      {
        amount: state.pot,
        eligiblePlayers: [winner.position],
        winners: [winner.position],
        winningRankName: 'Won by fold',
      },
    ]

    return {
      ...state,
      players,
      pot: 0,
      pots: pots,
      winners: [winner.position],
      showdownProcessed: true,
    }
  }

  let pots = calculatePots(state.players)

  const hasValidPots = pots.some((pot) => pot.amount > 0)

  if (!hasValidPots) {
    const potShare = Math.floor(state.pot / eligiblePlayers.length)
    const remainder = state.pot % eligiblePlayers.length

    const players = state.players.map((p) => {
      const isEligible = eligiblePlayers.some((ep) => ep.id === p.id)
      if (isEligible) {
        const winnerIndex = eligiblePlayers.findIndex((ep) => ep.id === p.id)
        const bonus = winnerIndex === 0 ? remainder : 0
        return { ...p, chips: p.chips + potShare + bonus }
      }
      return { ...p }
    })

    return {
      ...state,
      players: players,
      pot: 0,
      winners: eligiblePlayers.map((p) => p.position),
      showdownProcessed: true,
    }
  }

  pots = distributePots(pots, state.players, state.communityCards, evaluateHand)

  const players = awardPots(pots, state.players)

  const allWinners = new Set<number>()
  pots.forEach((pot) => {
    if (pot.winners && pot.eligiblePlayers.length > 1) {
      pot.winners.forEach((pos) => allWinners.add(pos))
    }
  })

  const playersWithChips = players.filter((p) => p.chips > 0)
  const gameStatus = playersWithChips.length <= 1 ? GAME_STATUS.COMPLETED : state.status

  return {
    ...state,
    status: gameStatus,
    players: players,
    pot: 0,
    winners: Array.from(allWinners),
    showdownProcessed: true,
  }
}

export function shouldContinueToNextRound(state: GameState): boolean {
  if (state.currentRound === ROUND.SHOWDOWN) {
    return false
  }

  const activePlayers = state.players.filter((p) => p.status === PLAYER_STATUS.ACTIVE)
  const allInPlayers = state.players.filter((p) => p.status === PLAYER_STATUS.ALL_IN)

  if (activePlayers.length <= 1 && allInPlayers.length === 0) {
    return false
  }

  if (state.currentRound === ROUND.RIVER && isBettingRoundComplete(state)) {
    return false
  }

  if (isBettingRoundComplete(state) && state.currentRound !== ROUND.RIVER) {
    return true
  }

  return false
}

export function revealNextCard(state: GameState): GameState {
  let nextRound: Round | undefined
  let cardsToDeal = 0

  switch (state.currentRound) {
    case ROUND.FLOP:
      nextRound = ROUND.TURN
      cardsToDeal = 1
      break
    case ROUND.TURN:
      nextRound = ROUND.RIVER
      cardsToDeal = 1
      break
    case ROUND.RIVER:
      return {
        ...state,
        currentRound: ROUND.SHOWDOWN,
        currentPlayerPosition: null,
      }
    default:
      return state
  }

  let deckIndex = state.communityCards.length + 1
  if (state.currentRound === ROUND.FLOP) {
    deckIndex = 3 + 2
  } else if (state.currentRound === ROUND.TURN) {
    deckIndex = 5 + 2
  }

  const newCards = state.deck.slice(deckIndex, deckIndex + cardsToDeal)
  const newDeckIndex = deckIndex + cardsToDeal + 1

  return {
    ...state,
    currentRound: nextRound,
    communityCards: [...state.communityCards, ...newCards],
    deck: state.deck.slice(newDeckIndex),
    currentBet: 0,
    currentPlayerPosition: null,
  }
}
