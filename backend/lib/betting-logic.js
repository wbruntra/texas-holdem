/**
 * Betting Logic - Handles player actions and bet validation
 */

const { PLAYER_STATUS, ACTION_TYPE } = require('./game-constants')

/**
 * Validate if an action is legal
 * @param {Object} state - Current game state
 * @param {number} playerPosition - Position of acting player
 * @param {string} action - Action type
 * @param {number} amount - Bet/raise amount (if applicable)
 * @returns {Object} { valid: boolean, error: string }
 */
function validateAction(state, playerPosition, action, amount = 0) {
  const player = state.players[playerPosition]

  // Check if it's player's turn
  if (state.currentPlayerPosition !== playerPosition) {
    return { valid: false, error: 'Not your turn' }
  }

  // Check if player can act
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
      // Can always fold
      return { valid: true }

    case ACTION_TYPE.CHECK:
      // Can only check if no bet to call
      if (callAmount > 0) {
        return { valid: false, error: 'Cannot check, must call or raise' }
      }
      return { valid: true }

    case ACTION_TYPE.CALL:
      // Must have amount to call
      if (callAmount === 0) {
        return { valid: false, error: 'Nothing to call' }
      }
      // Can call with remaining chips (may go all-in if stack < callAmount)
      if (player.chips === 0) {
        return { valid: false, error: 'No chips to call' }
      }
      return { valid: true }

    case ACTION_TYPE.BET:
      // Can only bet if no one else has bet
      if (state.currentBet > 0) {
        return { valid: false, error: 'Cannot bet, must call or raise' }
      }
      // Must bet at least big blind
      if (amount < state.bigBlind) {
        return { valid: false, error: `Minimum bet is ${state.bigBlind}` }
      }
      if (amount > player.chips) {
        return { valid: false, error: 'Not enough chips' }
      }
      return { valid: true }

    case ACTION_TYPE.RAISE:
      // Must have a bet to raise
      if (state.currentBet === 0) {
        return { valid: false, error: 'No bet to raise, use bet action' }
      }
      // `amount` is the raise *increment* beyond calling.
      // Player will pay: callAmount + amount.
      if (amount <= 0) {
        return { valid: false, error: 'Raise amount must be greater than 0' }
      }

      const totalBet = callAmount + amount
      if (totalBet > player.chips) {
        return { valid: false, error: 'Not enough chips' }
      }

      const minRaiseTo = state.currentBet + state.lastRaise
      const newPlayerBet = player.currentBet + totalBet // raise-to amount for this player

      // Allow short all-in raises even if below minimum
      const isAllIn = totalBet === player.chips
      if (!isAllIn && newPlayerBet < minRaiseTo) {
        return { valid: false, error: `Minimum raise is ${minRaiseTo}` }
      }

      return { valid: true }

    case ACTION_TYPE.ALL_IN:
      // Can always go all-in if you have chips
      if (player.chips === 0) {
        return { valid: false, error: 'No chips to bet' }
      }
      return { valid: true }

    default:
      return { valid: false, error: 'Invalid action type' }
  }
}

/**
 * Process a player action
 * @param {Object} state - Current game state
 * @param {number} playerPosition - Position of acting player
 * @param {string} action - Action type
 * @param {number} amount - Bet/raise amount (if applicable)
 * @returns {Object} Updated game state
 */
function processAction(state, playerPosition, action, amount = 0) {
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

      // If all-in is more than current bet, it's a raise
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

  // Check if betting round is complete
  const activePlayers = players.filter(
    (p) => p.status === PLAYER_STATUS.ACTIVE || p.status === PLAYER_STATUS.ALL_IN,
  )

  if (activePlayers.length === 0) {
    // Everyone folded or is out - betting complete
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
    // Only all-in players remain - betting complete
    return {
      ...state,
      players,
      pot: newPot,
      currentBet: newCurrentBet,
      lastRaise: newLastRaise,
      currentPlayerPosition: null,
    }
  }

  // Determine if betting round is complete.
  //
  // CRITICAL: We just updated newCurrentBet based on the current player's action.
  // But OTHER ACTIVE PLAYERS may not have acted yet in response to this new bet.
  //
  // Example: Player A bets/raises/all-ins to $100. Player B still has chips.
  // We just set newCurrentBet = $100. But Player B hasn't acted yet!
  // They need to call $100, raise, or fold.
  //
  // Solution: We can ONLY consider the round complete if:
  // - All active players have matched the NEW current bet
  // - All active players have acted at the new bet level
  // - OR there's only 1 active player left (others folded)
  //
  // To know "have they acted at the new bet level", we track the prior bet level
  // and see if everyone has acted since then.

  // Has the current bet just increased? (someone bet/raised/all-in)
  const betJustIncreased = newCurrentBet > state.currentBet

  if (betJustIncreased) {
    // New higher bet just happened. Other players must get a chance to respond.
    // Only the player who just acted can skip having to respond again (they set it).
    // Everyone else must act at this new level.

    // Count how many other ACTIVE players still need to respond
    // (we exclude the player who just acted because they set the bet)
    const otherActivePlayers = playersWhoCanAct.filter(
      (p) => players.indexOf(p) !== playerPosition,
    )

    // If there are no other active players, betting is complete
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

    // Otherwise, another player needs to act, so DON'T mark as complete
    // (this will be handled by the "Move to next player" code below)
  } else {
    // No new bet was set - the current player called, checked, or folded
    // Check if all can-act players have matched the bet and acted
    const allBetsMatched = playersWhoCanAct.every((p) => p.currentBet >= newCurrentBet)
    const allHaveActed = playersWhoCanAct.every((p) => p.lastAction !== null)

    if (allBetsMatched && allHaveActed) {
      // Betting complete
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

  // Move to next player who can act
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

/**
 * Get next player who needs to act
 * @param {Array} players - Array of players
 * @param {number} currentPosition - Current position
 * @returns {number|null} Next player position or null if round complete
 */
function getNextPlayerToAct(players, currentPosition) {
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

  return null // No active players left
}

/**
 * Calculate valid actions for a player
 * @param {Object} state - Current game state
 * @param {number} playerPosition - Position of player
 * @returns {Object} Available actions with amounts
 */
function getValidActions(state, playerPosition) {
  const player = state.players[playerPosition]

  if (state.currentPlayerPosition !== playerPosition) {
    return { canAct: false }
  }

  if (player.status !== PLAYER_STATUS.ACTIVE) {
    return { canAct: false }
  }

  // Check if all other players are all-in or folded (only this player has chips)
  const playersWithChips = state.players.filter(
    (p) => p.chips > 0 && p.status === PLAYER_STATUS.ACTIVE,
  )
  const allInPlayers = state.players.filter((p) => p.status === PLAYER_STATUS.ALL_IN)

  // If only this player has chips and there are all-in players, they should reveal cards
  // BUT ONLY if this player has already matched the current bet!
  // Otherwise, they must get a chance to respond to the all-in bet first
  if (playersWithChips.length === 1 && allInPlayers.length > 0) {
    // Check if this player has matched the current bet
    if (player.currentBet >= state.currentBet) {
      return {
        canAct: false,
        canReveal: true,
        reason: 'All other players are all-in. Reveal cards to continue.',
      }
    }
    // If player hasn't matched the bet yet, they must act first (call/fold/raise)
  }

  const callAmount = state.currentBet - player.currentBet
  const canCheck = callAmount === 0
  // Can call if there's an amount to call and player has chips (may go all-in)
  const canCall = callAmount > 0 && player.chips > 0
  const canBet = state.currentBet === 0 && player.chips >= state.bigBlind
  const canRaise = state.currentBet > 0 && player.chips >= callAmount + state.lastRaise
  const canAllIn = player.chips > 0
  const maxRaise = Math.max(0, player.chips - callAmount)

  // Calculate actual amount player needs to call (may be less than full callAmount if going all-in)
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
    // `minRaise`/`maxRaise` are raise *increments* beyond calling.
    minRaise: state.lastRaise,
    maxRaise,
    canAllIn,
    allInAmount: player.chips,
  }
}

/**
 * Check if a player can reveal the next card
 * @param {Object} state - Current game state
 * @param {number} playerPosition - Position of player requesting card reveal
 * @returns {Object} { canReveal: boolean, error: string, reason: string }
 */
function canRevealCard(state, playerPosition) {
  // Must be in a betting round (not preflop, not showdown, not completed)
  if (
    !state.currentRound ||
    state.currentRound === 'preflop' ||
    state.currentRound === 'showdown'
  ) {
    return {
      canReveal: false,
      error: 'Cannot reveal card in this round',
      reason: `Current round is ${state.currentRound}`,
    }
  }

  // Game must be active
  if (state.status !== 'active') {
    return {
      canReveal: false,
      error: 'Game is not active',
      reason: `Game status is ${state.status}`,
    }
  }

  // Player must be in game
  if (!state.players[playerPosition]) {
    return {
      canReveal: false,
      error: 'Player not found',
      reason: 'Invalid player position',
    }
  }

  // Player must have chips (not folded or out)
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

  // Check if we can actually deal more cards
  const { FLOP, TURN, RIVER, SHOWDOWN } = require('./game-constants').ROUND
  if (state.currentRound === FLOP && state.communityCards.length === 3) {
    return { canReveal: true, nextRound: TURN }
  }
  if (state.currentRound === TURN && state.communityCards.length === 4) {
    return { canReveal: true, nextRound: RIVER }
  }
  if (state.currentRound === RIVER && state.communityCards.length === 5) {
    // Allow one final "reveal" click to transition to showdown
    return { canReveal: true, nextRound: SHOWDOWN }
  }

  return { canReveal: true }
}

module.exports = {
  validateAction,
  processAction,
  getNextPlayerToAct,
  getValidActions,
  canRevealCard,
}
