import type { GameState, Player, Card, Pot } from '../game-types'
import type { GameEvent } from '../event-types'
import { EVENT_TYPES } from '../event-types'

// Helper to update a specific player
function updatePlayer(state: GameState, playerId: number, update: Partial<Player>): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, ...update } : p)),
  }
}

// Helper to check if betting round is complete
function isBettingRoundComplete(state: GameState): boolean {
  const activePlayers = state.players.filter((p) => p.status === 'active' || p.status === 'all_in')

  if (activePlayers.length === 0) return true

  const playersWhoCanAct = activePlayers.filter((p) => p.status === 'active')

  if (playersWhoCanAct.length === 1) {
    const lastPlayer = playersWhoCanAct[0]
    if (!lastPlayer) return true
    return lastPlayer.currentBet === state.currentBet && lastPlayer.lastAction !== null
  }

  if (playersWhoCanAct.length === 0) {
    return true
  }

  const allMatched = activePlayers.every((p) => {
    if (p.status === 'all_in') return true
    return p.currentBet === state.currentBet && p.lastAction !== null
  })

  return allMatched
}

// Helper to get next acting position
function getNextActingPosition(players: Player[], currentPosition: number): number | null {
  let nextPosition = (currentPosition + 1) % players.length
  let attempts = 0

  while (attempts < players.length) {
    const player = players[nextPosition]
    if (player && player.status === 'active') {
      return nextPosition
    }
    nextPosition = (nextPosition + 1) % players.length
    attempts++
  }

  return null
}

// Helper to check for all-in situation
function isAllInSituation(state: GameState): boolean {
  const playersInHand = state.players.filter((p) => p.status === 'active' || p.status === 'all_in')

  if (playersInHand.length === 0) return false

  const activeCount = playersInHand.filter((p) => p.status === 'active').length
  const allInCount = playersInHand.filter((p) => p.status === 'all_in').length

  const scenario1 = activeCount === 1 && allInCount >= 1
  const scenario2 = activeCount === 0 && allInCount >= 2

  return scenario1 || scenario2
}

// Helper to reveal cards if round is complete and all-in situation exists
function checkAndRevealCards(state: GameState, isComplete: boolean): GameState {
  if (isComplete && isAllInSituation(state)) {
    return {
      ...state,
      players: state.players.map((p) => {
        if (p.status === 'active' || p.status === 'all_in') {
          return { ...p, showCards: true }
        }
        return p
      }),
    }
  }
  return state
}

export function handlePlayerJoined(state: GameState, event: GameEvent): GameState {
  const { name, position, startingChips } = event.payload
  const newPlayer: Player = {
    id: event.playerId!,
    name,
    position,
    chips: startingChips,
    currentBet: 0,
    totalBet: 0,
    holeCards: [],
    status: 'active',
    isDealer: false,
    isSmallBlind: false,
    isBigBlind: false,
    lastAction: null,
    showCards: false,
  }

  const newPlayers = [...state.players, newPlayer].sort((a, b) => a.position - b.position)

  return {
    ...state,
    players: newPlayers,
  }
}

export function handleHandStart(state: GameState, event: GameEvent): GameState {
  const { handNumber, dealerPosition, smallBlindPosition, bigBlindPosition, deck, holeCards } =
    event.payload

  return {
    ...state,
    status: 'active',
    handNumber,
    currentRound: 'preflop',
    dealerPosition,
    deck,
    pot: 0,
    pots: [],
    currentBet: 0,
    communityCards: [],
    showdownProcessed: false,
    action_finished: false,
    currentPlayerPosition: smallBlindPosition,
    players: state.players.map((p, i) => ({
      ...p,
      currentBet: 0,
      totalBet: 0,
      holeCards: holeCards[p.id] || [],
      status: p.chips > 0 ? 'active' : 'out',
      lastAction: null,
      isDealer: i === dealerPosition,
      isSmallBlind: i === smallBlindPosition,
      isBigBlind: i === bigBlindPosition,
      showCards: false,
    })),
  }
}

export function handlePostBlind(state: GameState, event: GameEvent): GameState {
  const { blindType, amount, isAllIn } = event.payload
  const playerId = event.playerId!
  const player = state.players.find((p) => p.id === playerId)

  if (!player) return state

  return {
    ...state,
    pot: state.pot + amount,
    currentBet: Math.max(state.currentBet, amount),
    lastRaise: Math.max(state.lastRaise, amount),
    players: state.players.map((p) => {
      if (p.id !== playerId) return p
      return {
        ...p,
        chips: p.chips - amount,
        currentBet: amount,
        totalBet: (p.totalBet || 0) + amount,
        status: isAllIn ? 'all_in' : p.status,
        lastAction: null,
      }
    }),
  }
}

export function handleCheck(state: GameState, event: GameEvent): GameState {
  const updatedState = {
    ...updatePlayer(state, event.playerId!, {
      lastAction: 'check',
    }),
  }

  const finish = isBettingRoundComplete(updatedState)
  const nextPos = getNextActingPosition(state.players, state.currentPlayerPosition ?? 0)

  const finalState = {
    ...updatedState,
    currentPlayerPosition: finish ? null : nextPos,
  }

  return checkAndRevealCards(finalState, finish)
}

export function handleCall(state: GameState, event: GameEvent): GameState {
  const playerId = event.playerId!
  const player = state.players.find((p) => p.id === playerId)
  if (!player) return state

  const callRequired = state.currentBet - player.currentBet
  const actualCall = Math.min(callRequired, player.chips)
  const isAllIn = actualCall === player.chips

  const updatedPlayers = state.players.map((p) => {
    if (p.id !== playerId) return p
    return {
      ...p,
      chips: p.chips - actualCall,
      currentBet: p.currentBet + actualCall,
      totalBet: (p.totalBet || 0) + actualCall,
      lastAction: 'call',
      status: isAllIn ? 'all_in' : p.status,
    }
  })

  const tempState: GameState = {
    ...state,
    pot: state.pot + actualCall,
    players: updatedPlayers,
  }

  const finish = isBettingRoundComplete(tempState)
  const nextPos = getNextActingPosition(updatedPlayers, state.currentPlayerPosition ?? 0)

  const finalState = {
    ...tempState,
    currentPlayerPosition: finish ? null : nextPos,
  }

  return checkAndRevealCards(finalState, finish)
}

export function handleBet(state: GameState, event: GameEvent): GameState {
  const playerId = event.playerId!
  const amount = event.payload.amount
  const player = state.players.find((p) => p.id === playerId)
  if (!player) return state

  const isAllIn = amount === player.chips

  const updatedPlayers = state.players.map((p) => {
    if (p.id !== playerId) return p
    return {
      ...p,
      chips: p.chips - amount,
      currentBet: amount,
      totalBet: (p.totalBet || 0) + amount,
      lastAction: 'bet',
      status: isAllIn ? 'all_in' : p.status,
    }
  })

  const tempState: GameState = {
    ...state,
    pot: state.pot + amount,
    currentBet: amount,
    lastRaise: amount,
    players: updatedPlayers,
  }

  const finish = isBettingRoundComplete(tempState)
  const nextPos = getNextActingPosition(updatedPlayers, state.currentPlayerPosition ?? 0)

  const finalState = {
    ...tempState,
    currentPlayerPosition: finish ? null : nextPos,
  }

  return checkAndRevealCards(finalState, finish)
}

export function handleRaise(state: GameState, event: GameEvent): GameState {
  const playerId = event.playerId!
  const amount = event.payload.amount
  const player = state.players.find((p) => p.id === playerId)
  if (!player) return state

  const callAmount = state.currentBet - player.currentBet
  const totalAdded = callAmount + amount
  const isAllIn = totalAdded === player.chips

  const updatedPlayers = state.players.map((p) => {
    if (p.id !== playerId) return p
    return {
      ...p,
      chips: p.chips - totalAdded,
      currentBet: p.currentBet + totalAdded,
      totalBet: (p.totalBet || 0) + totalAdded,
      lastAction: 'raise',
      status: isAllIn ? 'all_in' : p.status,
    }
  })

  const tempState: GameState = {
    ...state,
    pot: state.pot + totalAdded,
    currentBet: player.currentBet + totalAdded,
    lastRaise: amount,
    players: updatedPlayers,
  }

  const finish = isBettingRoundComplete(tempState)
  const nextPos = getNextActingPosition(updatedPlayers, state.currentPlayerPosition ?? 0)

  const finalState = {
    ...tempState,
    currentPlayerPosition: finish ? null : nextPos,
  }

  return checkAndRevealCards(finalState, finish)
}

export function handleFold(state: GameState, event: GameEvent): GameState {
  const updatedPlayers = state.players.map((p) =>
    p.id === event.playerId ? { ...p, status: 'folded' as const, lastAction: 'fold' as const } : p,
  )

  const nextPos = getNextActingPosition(updatedPlayers, state.currentPlayerPosition ?? 0)

  const tempState: GameState = {
    ...state,
    players: updatedPlayers,
  }

  const finish = isBettingRoundComplete(tempState)

  const finalState = {
    ...tempState,
    currentPlayerPosition: finish ? null : nextPos,
  }

  return finalState
}

export function handleAllIn(state: GameState, event: GameEvent): GameState {
  const playerId = event.playerId!
  const player = state.players.find((p) => p.id === playerId)
  if (!player) return state

  const allInAmount = player.chips
  const totalBetAfter = player.currentBet + allInAmount
  let newCurrentBet = state.currentBet
  let newLastRaise = state.lastRaise

  if (totalBetAfter > state.currentBet) {
    const raiseAmount = totalBetAfter - state.currentBet
    newCurrentBet = totalBetAfter
    newLastRaise = raiseAmount
  }

  const updatedPlayers = state.players.map((p) => {
    if (p.id !== playerId) return p
    return {
      ...p,
      chips: 0,
      currentBet: totalBetAfter,
      totalBet: (p.totalBet || 0) + allInAmount,
      status: 'all_in' as const,
      lastAction: 'all_in' as const,
    }
  })

  const tempState: GameState = {
    ...state,
    pot: state.pot + allInAmount,
    currentBet: newCurrentBet,
    lastRaise: newLastRaise,
    players: updatedPlayers,
  }

  const finish = isBettingRoundComplete(tempState)
  const nextPos = getNextActingPosition(updatedPlayers, state.currentPlayerPosition ?? 0)

  const finalState = {
    ...tempState,
    currentPlayerPosition: finish ? null : nextPos,
  }

  return checkAndRevealCards(finalState, finish)
}

export function handleDealCommunity(state: GameState, event: GameEvent): GameState {
  const { round, communityCards } = event.payload

  let cardsToConsume = 0
  if (round === 'flop') cardsToConsume = 4
  else if (round === 'turn') cardsToConsume = 2
  else if (round === 'river') cardsToConsume = 2

  const newDeck = state.deck.slice(cardsToConsume)

  const tempState: GameState = {
    ...state,
    currentRound: round,
    communityCards,
    currentBet: 0,
    lastRaise: 0,
    deck: newDeck,
    currentPlayerPosition: getNextActingPosition(state.players, state.dealerPosition),
    players: state.players.map((p) => ({
      ...p,
      currentBet: 0,
      lastAction: null,
    })),
  }

  if (isAllInSituation(tempState)) {
    return {
      ...tempState,
      currentPlayerPosition: null,
      action_finished: true,
      players: tempState.players.map((p) => {
        if (p.status === 'active' || p.status === 'all_in') {
          return { ...p, showCards: true }
        }
        return p
      }),
    }
  }

  return tempState
}

export function handleShowdown(state: GameState, event: GameEvent): GameState {
  const { communityCards } = event.payload

  return {
    ...state,
    currentRound: 'showdown',
    communityCards: communityCards || state.communityCards,
    showdownProcessed: true,
  }
}

export function handleAwardPot(state: GameState, event: GameEvent): GameState {
  const { winReason, winners, payouts, potTotal } = event.payload

  let newPlayers = state.players

  if (payouts && Array.isArray(payouts)) {
    newPlayers = state.players.map((p) => {
      const payout = payouts.find((po: any) => po.playerId === p.id)
      const updatedPlayer = payout ? { ...p, chips: p.chips + payout.amount } : p

      return {
        ...updatedPlayer,
        currentBet: 0,
      }
    })
  } else {
    newPlayers = state.players.map((p) => ({ ...p, currentBet: 0 }))
  }

  return {
    ...state,
    pot: 0,
    currentBet: 0,
    lastRaise: 0,
    currentRound: 'showdown',
    players: newPlayers,
    winners,
    showdownProcessed: true,
    currentPlayerPosition: null,
  }
}

export function handleHandComplete(state: GameState, event: GameEvent): GameState {
  return {
    ...state,
    action_finished: true,
    currentPlayerPosition: null,
  }
}

export function handleRevealCards(state: GameState, event: GameEvent): GameState {
  const playerId = event.playerId!
  const { holeCards } = event.payload

  return updatePlayer(state, playerId, {
    showCards: true,
    holeCards: holeCards,
  })
}

export function handleAdvanceRound(state: GameState, event: GameEvent): GameState {
  const { toRound, newCommunityCards } = event.payload

  const communityCards = [...state.communityCards, ...newCommunityCards]

  let cardsToConsume = 0
  if (toRound === 'flop') cardsToConsume = 4
  else if (toRound === 'turn') cardsToConsume = 2
  else if (toRound === 'river') cardsToConsume = 2

  const newDeck = state.deck.slice(cardsToConsume)

  const tempState: GameState = {
    ...state,
    currentRound: toRound,
    communityCards,
    currentBet: 0,
    lastRaise: 0,
    deck: newDeck,
    currentPlayerPosition: getNextActingPosition(state.players, state.dealerPosition),
    players: state.players.map((p) => ({
      ...p,
      currentBet: 0,
      lastAction: null,
    })),
  }

  if (isAllInSituation(tempState)) {
    return {
      ...tempState,
      currentPlayerPosition: null,
      players: tempState.players.map((p) => {
        if (p.status === 'active' || p.status === 'all_in') {
          return { ...p, showCards: true }
        }
        return p
      }),
    }
  }

  return tempState
}
