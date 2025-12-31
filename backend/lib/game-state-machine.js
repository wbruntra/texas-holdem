/**
 * Game State Machine - Manages Texas Hold'em game flow and state transitions
 */

const {
  shuffleDeck,
  createDeck,
  dealHoleCards,
  determineWinners,
  evaluateHand,
} = require('./poker-engine')
const { calculatePots, distributePots, awardPots, getTotalPot } = require('./pot-manager')
const { GAME_STATUS, ROUND, PLAYER_STATUS, ACTION_TYPE } = require('./game-constants')

/**
 * Create initial game state
 * @param {Object} config - Game configuration
 * @returns {Object} Initial game state
 */
function createGameState(config = {}) {
  const { smallBlind = 5, bigBlind = 10, startingChips = 1000, players = [] } = config

  return {
    status: GAME_STATUS.WAITING,
    smallBlind,
    bigBlind,
    players: players.map((p, index) => ({
      id: p.id,
      name: p.name,
      position: index,
      chips: startingChips,
      currentBet: 0,
      holeCards: [],
      status: PLAYER_STATUS.ACTIVE,
      isDealer: false,
      isSmallBlind: false,
      isBigBlind: false,
      lastAction: null,
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
  }
}

/**
 * Start a new hand
 * @param {Object} state - Current game state
 * @returns {Object} Updated game state
 */
function startNewHand(state) {
  const activePlayers = state.players.filter((p) => p.chips > 0 && p.status !== PLAYER_STATUS.OUT)

  if (activePlayers.length < 2) {
    return {
      ...state,
      status: GAME_STATUS.COMPLETED,
    }
  }

  // Reset player states
  const players = state.players.map((p) => ({
    ...p,
    currentBet: 0,
    totalBet: 0,
    holeCards: [],
    status: p.chips > 0 ? PLAYER_STATUS.ACTIVE : PLAYER_STATUS.OUT,
    lastAction: null,
    isDealer: false,
    isSmallBlind: false,
    isBigBlind: false,
  }))

  // Rotate dealer button
  let dealerPosition = state.dealerPosition
  if (state.handNumber > 0) {
    dealerPosition = getNextActivePosition(players, dealerPosition)
  }

  // Set blinds (in heads-up, dealer is small blind)
  const isHeadsUp = activePlayers.length === 2
  const smallBlindPosition = isHeadsUp
    ? dealerPosition
    : getNextActivePosition(players, dealerPosition)
  const bigBlindPosition = getNextActivePosition(players, smallBlindPosition)

  players[dealerPosition].isDealer = true
  players[smallBlindPosition].isSmallBlind = true
  players[bigBlindPosition].isBigBlind = true

  // Post blinds
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

  // Create and shuffle deck
  const deck = shuffleDeck(createDeck())

  // Deal hole cards
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

  // First to act preflop is left of big blind.
  // IMPORTANT: skip ALL_IN players (they are still eligible for showdown, but cannot act).
  const firstToAct = getNextActingPosition(players, bigBlindPosition)

  return {
    ...state,
    status: GAME_STATUS.ACTIVE,
    players,
    dealerPosition,
    currentRound: ROUND.PREFLOP,
    currentPlayerPosition: firstToAct,
    pot,
    pots: [], // Clear pots from previous hand
    currentBet: bigBlindAmount,
    communityCards: [],
    deck: dealResult.deck,
    handNumber: state.handNumber + 1,
    lastRaise: bigBlindAmount,
    winners: [], // Clear winners from previous hand
  }
}

/**
 * Get next player who is allowed to act (ACTIVE only)
 * @param {Array} players - Array of players
 * @param {number} currentPosition - Current position
 * @returns {number|null} Next acting position or null if none
 */
function getNextActingPosition(players, currentPosition) {
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

/**
 * Check if betting should auto-advance (all players all-in or only one can bet)
 * @param {Object} state - Current game state
 * @returns {boolean} True if should auto-advance
 */
function shouldAutoAdvance(state) {
  if (state.currentRound === ROUND.SHOWDOWN) {
    return false // Already at showdown
  }

  const activePlayers = state.players.filter(
    (p) => p.status === PLAYER_STATUS.ACTIVE || p.status === PLAYER_STATUS.ALL_IN,
  )

  if (activePlayers.length <= 1) {
    return true // Only one player left
  }

  const canBet = activePlayers.filter((p) => p.status === PLAYER_STATUS.ACTIVE && p.chips > 0)

  // If 0 or 1 players can bet, auto-advance
  if (canBet.length === 0) {
    return true // Everyone is all-in
  }

  if (canBet.length === 1) {
    // Check if that one player has acted (matched current bet)
    const player = canBet[0]
    return player.currentBet >= state.currentBet
  }

  return false
}

/**
 * Get next active player position
 * @param {Array} players - Array of players
 * @param {number} currentPosition - Current position
 * @returns {number} Next active position
 */
function getNextActivePosition(players, currentPosition) {
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

/**
 * Check if betting round is complete
 * @param {Object} state - Current game state
 * @returns {boolean} True if round is complete
 */
function isBettingRoundComplete(state) {
  const activePlayers = state.players.filter(
    (p) => p.status === PLAYER_STATUS.ACTIVE || p.status === PLAYER_STATUS.ALL_IN,
  )

  if (activePlayers.length === 0) return true

  // Check if only one active player remains (others folded or all-in)
  const playersWhoCanAct = activePlayers.filter((p) => p.status === PLAYER_STATUS.ACTIVE)
  if (playersWhoCanAct.length <= 1) return true

  // Check if all active players have acted and matched the current bet
  const allMatched = activePlayers.every((p) => {
    if (p.status === PLAYER_STATUS.ALL_IN) return true
    return p.currentBet === state.currentBet && p.lastAction !== null
  })

  return allMatched
}

/**
 * Advance to next round
 * @param {Object} state - Current game state
 * @returns {Object} Updated game state
 */
function advanceRound(state) {
  // Check if only one active player remains (others folded)
  const activePlayers = state.players.filter((p) => p.status === PLAYER_STATUS.ACTIVE)
  const allInPlayers = state.players.filter((p) => p.status === PLAYER_STATUS.ALL_IN)

  // If only one active player and no all-ins, skip straight to showdown (they won by fold)
  if (activePlayers.length <= 1 && allInPlayers.length === 0) {
    // Player won by fold - go straight to showdown
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

  let newRound
  let newCards = []
  let deckIndex = 0

  // Burn a card before dealing
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

  // Reset player states for new round
  const players = state.players.map((p) => ({
    ...p,
    currentBet: 0,
    lastAction: null,
  }))

  // Move bets to pot
  const newPot = state.pot // Bets already added when actions were processed

  // First to act is left of dealer.
  // IMPORTANT: skip ALL_IN players (they cannot act).
  const firstToAct = getNextActingPosition(players, state.dealerPosition)

  return {
    ...state,
    currentRound: newRound,
    players,
    communityCards: [...state.communityCards, ...newCards],
    deck: state.deck.slice(deckIndex + 1), // Skip burned card
    currentPlayerPosition: newRound === ROUND.SHOWDOWN ? null : firstToAct,
    currentBet: 0,
    pot: newPot,
    lastRaise: 0,
  }
}

/**
 * Process showdown and determine winners
 * @param {Object} state - Current game state
 * @returns {Object} Updated game state with winners
 */
function processShowdown(state) {
  const eligiblePlayers = state.players.filter(
    (p) => p.status === PLAYER_STATUS.ACTIVE || p.status === PLAYER_STATUS.ALL_IN,
  )

  if (eligiblePlayers.length === 0) {
    return state
  }

  // If only one player remains, they win all pots
  if (eligiblePlayers.length === 1) {
    const winner = eligiblePlayers[0]
    const players = state.players.map((p) =>
      p.id === winner.id ? { ...p, chips: p.chips + state.pot } : p,
    )

    // Create a single pot with "Won by fold" designation
    const pots = [
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
    }
  }

  // Calculate pots if not already done
  let pots = state.pots && state.pots.length > 0 ? state.pots : calculatePots(state.players)

  // If pots are empty (likely from old games without totalBet tracking),
  // fall back to simple pot distribution
  const hasValidPots = pots.some((pot) => pot.amount > 0)

  if (!hasValidPots) {
    // Legacy fallback: split pot evenly among eligible players
    const potShare = Math.floor(state.pot / eligiblePlayers.length)
    const remainder = state.pot % eligiblePlayers.length

    const players = state.players.map((p) => {
      const isEligible = eligiblePlayers.some((ep) => ep.id === p.id)
      if (isEligible) {
        const winnerIndex = eligiblePlayers.findIndex((ep) => ep.id === p.id)
        const bonus = winnerIndex === 0 ? remainder : 0
        return { ...p, chips: p.chips + potShare + bonus }
      }
      return p
    })

    return {
      ...state,
      players,
      pot: 0,
      pots: [],
      winners: eligiblePlayers.map((p) => p.position),
    }
  }

  // Distribute pots based on hand strength
  pots = distributePots(pots, state.players, state.communityCards, evaluateHand)

  // Award chips to winners
  const players = awardPots(pots, state.players)

  // Collect all unique winners across all pots
  const allWinners = new Set()
  pots.forEach((pot) => {
    if (pot.winners) {
      pot.winners.forEach((pos) => allWinners.add(pos))
    }
  })

  // Check if game is over (only one player has chips)
  const playersWithChips = players.filter((p) => p.chips > 0)
  const gameStatus = playersWithChips.length <= 1 ? GAME_STATUS.COMPLETED : state.status

  return {
    ...state,
    status: gameStatus,
    players,
    pot: 0,
    pots: pots, // Keep pots with winners for display
    winners: Array.from(allWinners),
  }
}

/**
 * Check if game should continue to next round
 * @param {Object} state - Current game state
 * @returns {boolean} True if should continue
 */
function shouldContinueToNextRound(state) {
  if (state.currentRound === ROUND.SHOWDOWN) {
    return false
  }

  // If only one player remains active (others folded), go to showdown
  const activePlayers = state.players.filter((p) => p.status === PLAYER_STATUS.ACTIVE)
  const allInPlayers = state.players.filter((p) => p.status === PLAYER_STATUS.ALL_IN)

  // If only one active player AND no one is all-in, hand ended by fold
  if (activePlayers.length <= 1 && allInPlayers.length === 0) {
    return false // Go to showdown to award pot to remaining player
  }

  // If at river and betting complete, go to showdown (don't continue to another street)
  if (state.currentRound === ROUND.RIVER && isBettingRoundComplete(state)) {
    return false
  }

  // If betting round complete and not at river yet, continue (even with all-ins)
  if (isBettingRoundComplete(state) && state.currentRound !== ROUND.RIVER) {
    return true
  }

  return false
}

/**
 * Reveal the next community card (manual action when only one player has chips)
 * @param {Object} state - Current game state
 * @returns {Object} Updated game state with next card revealed
 */
function revealNextCard(state) {
  // Find next round
  let nextRound
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
      // Already at river, move to showdown
      return {
        ...state,
        currentRound: ROUND.SHOWDOWN,
        currentPlayerPosition: null,
      }
    default:
      return state // Can't reveal in this round
  }

  // Get cards from deck (accounting for burn cards)
  let deckIndex = state.communityCards.length + 1 // +1 for initial burn
  if (state.currentRound === ROUND.FLOP) {
    deckIndex = 3 + 2 // After flop (3 cards + 1 burn), now burn 1 and deal turn
  } else if (state.currentRound === ROUND.TURN) {
    deckIndex = 5 + 2 // After turn (5 cards + 1 burn), now burn 1 and deal river
  }

  const newCards = state.deck.slice(deckIndex, deckIndex + cardsToDeal)
  const newDeckIndex = deckIndex + cardsToDeal + 1 // +1 for the burn card after dealing

  return {
    ...state,
    currentRound: nextRound,
    communityCards: [...state.communityCards, ...newCards],
    deck: state.deck.slice(newDeckIndex),
    currentBet: 0,
  }
}

module.exports = {
  GAME_STATUS,
  ROUND,
  PLAYER_STATUS,
  ACTION_TYPE,
  createGameState,
  startNewHand,
  getNextActivePosition,
  getNextActingPosition,
  shouldAutoAdvance,
  isBettingRoundComplete,
  advanceRound,
  processShowdown,
  shouldContinueToNextRound,
  revealNextCard,
}
