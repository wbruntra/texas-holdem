import type { GameState, Player, Card, Pot } from '@holdem/shared'
import type { GameEvent } from '@/services/event-store'
import { EVENT_TYPES } from '@holdem/shared'

// Helper to update a specific player
function updatePlayer(state: GameState, playerId: number, update: Partial<Player>): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, ...update } : p)),
  }
}

// Helper to chek if betting round is complete (copied from game-state-machine)
function isBettingRoundComplete(state: GameState): boolean {
  const activePlayers = state.players.filter((p) => p.status === 'active' || p.status === 'all_in')

  if (activePlayers.length === 0) return true

  const playersWhoCanAct = activePlayers.filter((p) => p.status === 'active')

  if (playersWhoCanAct.length === 1) {
    const lastPlayer = playersWhoCanAct[0]
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

// Helper to get next acting position (turn rotation)
function getNextActingPosition(players: Player[], currentPosition: number): number | null {
  // Simple rotation: check next index, if active/all-in/etc?
  // We want next ACTIVE player.
  let nextPosition = (currentPosition + 1) % players.length
  let attempts = 0

  while (attempts < players.length) {
    const player = players[nextPosition]
    if (player.status === 'active') {
      // Only 'active' players can act. 'all_in' cannot.
      return nextPosition
    }
    nextPosition = (nextPosition + 1) % players.length
    attempts++
  }

  return null
}

export function handlePlayerJoined(state: GameState, event: GameEvent): GameState {
  const { name, position, startingChips } = event.payload
  const newPlayer: Player = {
    // @ts-ignore
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

  // Insert player ensuring position order
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
    deck, // Use deck from event
    pot: 0,
    pots: [],
    currentBet: 0,
    communityCards: [],
    showdownProcessed: false,
    action_finished: false,
    currentPlayerPosition: smallBlindPosition, // Starts with SB
    players: state.players.map((p, i) => ({
      ...p,
      currentBet: 0,
      totalBet: 0,
      holeCards: holeCards[p.id] || [],
      // If chips > 0, they are active.
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
  // @ts-ignore
  const playerId = event.playerId!
  const player = state.players.find((p) => p.id === playerId)

  if (!player) return state

  // Post blind updates state but does NOT rotate turn automatically
  // Turn rotation for blinds is handled by the orchestrator emitting subsequent events?
  // OR does postBlind imply turn end for that atomic action?
  // In typical game flow: SB posts, then BB posts, then UTG acts.
  // The 'currentPlayerPosition' in state determines who can act.
  // If SB posts, we might want to advance to BB?
  // But typically the 'game start' sets current to SB, SB posts, then it advances to BB?
  // Actually, usually Preflop action starts AFTER blinds are posted.
  // So 'currentPlayerPosition' should point to UTG (or SB in heads up) *after* blinds.
  // For now, we won't rotate on postBlind, assuming explicit action logic or hand start sets it.
  // Wait, if currentPlayer is SB, and they post blind... they are still currentPlayer?
  // Let's assume PostBlind is administrative and doesn't rotate 'action' turn.

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

// Helper to check for all-in situation (copied from game-state-machine)
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
  // If betting is complete AND it's an all-in situation, reveal cards
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
  // @ts-ignore
  const playerId = event.playerId!
  const player = state.players.find((p) => p.id === playerId)
  if (!player) return state

  const callRequired = state.currentBet - player.currentBet
  const actualCall = Math.min(callRequired, player.chips)
  const isAllIn = actualCall === player.chips

  // Prepare updated players list first to use in nextPos calculation if needed (though status might change)
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
  // IMPORTANT: Calculate next position based on *updated* status if they went all-in
  const nextPos = getNextActingPosition(updatedPlayers, state.currentPlayerPosition ?? 0)

  const finalState = {
    ...tempState,
    currentPlayerPosition: finish ? null : nextPos,
  }

  return checkAndRevealCards(finalState, finish)
}

export function handleBet(state: GameState, event: GameEvent): GameState {
  // @ts-ignore
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
  // @ts-ignore
  const playerId = event.playerId!
  const amount = event.payload.amount // RAISE amount (increment)
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

  // They folded, but we need to find next ACTIVE player from *their* position
  const nextPos = getNextActingPosition(updatedPlayers, state.currentPlayerPosition ?? 0)

  const tempState: GameState = {
    ...state,
    players: updatedPlayers,
  }
  // Check completion (e.g. only 1 player left)
  // Usually if only 1 active player left, round is 'complete' (showdown/win)?
  // isBettingRoundComplete checks active logic.
  const finish = isBettingRoundComplete(tempState)

  const finalState = {
    ...tempState,
    currentPlayerPosition: finish ? null : nextPos,
  }

  // Note: if fold causes win, handled elsewhere?
  // But if folded to 1 active player, round is 'complete' in a sense, but usually triggers immediate win.
  // We can still run checkAndRevealCards but scenario1 needs 1 active vs 1 All-in.
  // If everyone else folded and only 1 active, they win immediately (not all-in situation).
  return finalState
}

export function handleAllIn(state: GameState, event: GameEvent): GameState {
  // @ts-ignore
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

  // Consume cards from deck based on round (matching game-state-machine logic)
  let cardsToConsume = 0
  if (round === 'flop') cardsToConsume = 5
  else if (round === 'turn') cardsToConsume = 3
  else if (round === 'river') cardsToConsume = 3

  const newDeck = state.deck.slice(cardsToConsume)

  // Reset current bets for the new round
  const tempState: GameState = {
    ...state,
    currentRound: round,
    communityCards,
    currentBet: 0,
    lastRaise: 0,
    deck: newDeck, // Update deck!
    // When round starts, action usually starts left of Dealer?
    // or Small Blind position.
    // In Preflow, it's left of BB. In others, it's left of Dealer (SB).
    currentPlayerPosition: getNextActingPosition(state.players, state.dealerPosition),
    players: state.players.map((p) => ({
      ...p,
      currentBet: 0,
      lastAction: null,
    })),
  }

  // If it's an All-In situation immediately after dealing (e.g. 1 active, 1 all-in),
  // then NO betting can occur. Current player checks logic above might pick the active player,
  // but they shouldn't act.
  if (isAllInSituation(tempState)) {
    return {
      ...tempState,
      currentPlayerPosition: null, // No actions possible
      action_finished: true, // Betting is done, round can be advanced
      players: tempState.players.map((p) => {
        // Ensure cards are revealed if we are in this state
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

  // SHOWDOWN is now purely informational - just records that showdown is happening
  // Chip distribution is handled by AWARD_POT event
  return {
    ...state,
    currentRound: 'showdown',
    communityCards: communityCards || state.communityCards,
    showdownProcessed: true,
  }
}

export function handleAwardPot(state: GameState, event: GameEvent): GameState {
  const { winReason, winners, payouts, potTotal } = event.payload

  // Update players with payouts (chip distribution)
  let newPlayers = state.players

  if (payouts && Array.isArray(payouts)) {
    newPlayers = state.players.map((p) => {
      const payout = payouts.find((po: any) => po.playerId === p.id)
      const updatedPlayer = payout ? { ...p, chips: p.chips + payout.amount } : p

      // Also reset current bets as the hand is over
      return {
        ...updatedPlayer,
        currentBet: 0,
        // lastAction: null, // Reset for next hand
      }
    })
  } else {
    // Even if no payouts (weird), reset bets
    newPlayers = state.players.map((p) => ({ ...p, currentBet: 0 }))
  }

  return {
    ...state,
    pot: 0, // Pot is now distributed
    currentBet: 0, // Reset round betting
    lastRaise: 0,
    currentRound: 'showdown', // Force round to showdown (end state)
    players: newPlayers,
    winners,
    showdownProcessed: true,
    currentPlayerPosition: null, // Ensure explicitly null
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
  // @ts-ignore
  const playerId = event.playerId!
  const { holeCards } = event.payload

  return updatePlayer(state, playerId, {
    showCards: true,
    holeCards: holeCards,
  })
}

export function handleAdvanceRound(state: GameState, event: GameEvent): GameState {
  const { toRound, newCommunityCards } = event.payload

  // existing comm cards + new ones
  const communityCards = [...state.communityCards, ...newCommunityCards]

  // Consume cards from deck based on round (matching game-state-machine logic)
  let cardsToConsume = 0
  if (toRound === 'flop') cardsToConsume = 5
  else if (toRound === 'turn') cardsToConsume = 3
  else if (toRound === 'river') cardsToConsume = 3

  const newDeck = state.deck.slice(cardsToConsume)

  const tempState: GameState = {
    ...state,
    currentRound: toRound,
    communityCards,
    currentBet: 0,
    lastRaise: 0,
    deck: newDeck,
    // Set first player to act (left of dealer)
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
