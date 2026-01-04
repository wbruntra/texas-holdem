// @ts-ignore
import db from '@holdem/database/db'
import { validateAction, processAction, getValidActions } from '@/lib/betting-logic'
import * as gameService from '@/services/game-service'
import * as playerService from '@/services/player-service'
import { ACTION_TYPE, PLAYER_STATUS, ROUND } from '@/lib/game-constants'
import { getNextActingPosition } from '@/lib/game-state-machine'
import eventLogger from '@/services/event-logger'
import { EVENT_TYPE } from '@/lib/event-types'
import { createShowdownHistory } from './showdown-service'

interface ActionRecord {
  id: number
  handId: number
  handNumber: number
  playerId: number
  actionType: string
  amount: number
  round: string
  sequenceNumber: number
  timestamp: Date
}

/**
 * Normalize turn to next active player if current player cannot act
 */
export async function normalizeTurnIfNeeded(gameId: number) {
  const game = await gameService.getGameById(gameId)
  if (!game || game.status !== 'active') return game

  if (game.currentPlayerPosition === null || game.currentPlayerPosition === undefined) {
    return game
  }

  const current = game.players[game.currentPlayerPosition]
  if (current && current.status === PLAYER_STATUS.ACTIVE) {
    return game
  }

  const next = getNextActingPosition(game.players, game.currentPlayerPosition)
  const patched = { ...game, currentPlayerPosition: next }
  await gameService.saveGameState(game.id, patched)

  if (next === null) {
    return gameService.advanceRoundIfReady(game.id)
  }

  return gameService.getGameById(game.id)
}

/**
 * Submit and process a player action (check, bet, call, raise, fold, all-in)
 */
export async function submitAction(playerId: number, action: string, amount: number = 0) {
  const player = await playerService.getPlayerById(playerId)
  if (!player) {
    throw new Error('Player not found')
  }

  let game = await gameService.getGameById(player.gameId)
  if (!game) {
    throw new Error('Game not found')
  }

  game = (await normalizeTurnIfNeeded(game.id)) || game

  if (game.status !== 'active') {
    throw new Error('Game is not active')
  }

  const playerPosition = game.players.findIndex((p: any) => p.id === playerId)
  if (playerPosition === -1) {
    throw new Error('Player not in game')
  }

  const validation = validateAction(game, playerPosition, action, amount)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  let newState = processAction(game, playerPosition, action, amount)

  const { shouldSetActionFinished } = await import('@/lib/game-state-machine')

  if (shouldSetActionFinished(newState)) {
    newState = { ...newState, action_finished: true }
  }

  await gameService.saveGameState(game.id, newState)

  const eventTypeMap: Record<string, string> = {
    check: EVENT_TYPE.ACTION_CHECK,
    bet: EVENT_TYPE.ACTION_BET,
    call: EVENT_TYPE.ACTION_CALL,
    raise: EVENT_TYPE.ACTION_RAISE,
    fold: EVENT_TYPE.ACTION_FOLD,
    all_in: EVENT_TYPE.ACTION_ALL_IN,
  }
  const eventType = eventTypeMap[action] || 'action:unknown'
  eventLogger.logEvent(
    eventType as any,
    {
      playerId,
      playerName: player.name,
      playerPosition,
      action,
      amount,
      round: game.currentRound,
      remainingChips: newState.players[playerPosition].chips,
    },
    game.id,
  )

  if (game.currentRound) {
    await recordAction(game.id, playerId, action, amount, game.currentRound)
  }

  const activePlayers = newState.players.filter((p: any) => p.status === PLAYER_STATUS.ACTIVE)
  const allInPlayers = newState.players.filter((p: any) => p.status === PLAYER_STATUS.ALL_IN)
  const playersStillInHand = activePlayers.length + allInPlayers.length

  if (playersStillInHand === 1) {
    const { advanceRound, processShowdown } = await import('@/lib/game-state-machine')

    if (newState.currentRound !== ROUND.SHOWDOWN) {
      newState = advanceRound(newState)
      newState.currentRound = ROUND.SHOWDOWN
    }

    newState = processShowdown(newState)

    await gameService.saveGameState(game.id, newState)

    await gameService.completeHandRecord(game.id, newState)

    // Create showdown history record
    // Get the most recent hand ID for this game
    const recentHand = await db('hands')
      .where({ game_id: game.id })
      .orderBy('hand_number', 'desc')
      .first()

    if (recentHand) {
      await createShowdownHistory(game.id, recentHand.id, newState)
    }
  }

  const { isBettingRoundComplete, shouldAutoAdvance } = await import('@/lib/game-state-machine')

  if (
    allInPlayers.length === 0 &&
    isBettingRoundComplete(newState) &&
    !shouldAutoAdvance(newState) &&
    newState.currentRound !== 'showdown'
  ) {
    await gameService.advanceOneRound(game.id)
  }

  const finalState = await gameService.getGameById(game.id)
  if (!finalState) {
    throw new Error('Game not found after action')
  }

  const normalizedState = (await normalizeTurnIfNeeded(finalState.id)) || finalState

  return normalizedState
}

/**
 * Get valid actions for a player based on current game state
 */
export async function getPlayerValidActions(playerId: number) {
  const player = await playerService.getPlayerById(playerId)
  if (!player) {
    throw new Error('Player not found')
  }

  let game = await gameService.getGameById(player.gameId)
  if (!game) {
    throw new Error('Game not found')
  }

  game = (await normalizeTurnIfNeeded(game.id)) || game

  if (game.status !== 'active') {
    return { canAct: false, reason: 'Game not active' }
  }

  const playerPosition = game.players.findIndex((p: any) => p.id === playerId)
  if (playerPosition === -1) {
    return { canAct: false, reason: 'Player not in game' }
  }

  return getValidActions(game, playerPosition)
}

/**
 * Record an action in the database for hand history
 */
export async function recordAction(
  gameId: number,
  playerId: number,
  actionType: string,
  amount: number,
  round: string,
) {
  const hand = await db('hands').where({ game_id: gameId }).orderBy('hand_number', 'desc').first()

  if (!hand) {
    console.warn('No hand record found for action', { gameId, playerId, actionType })
    return
  }

  const lastAction = await db('actions')
    .where({ hand_id: hand.id })
    .orderBy('sequence_number', 'desc')
    .first()

  const sequenceNumber = lastAction ? lastAction.sequence_number + 1 : 1

  await db('actions').insert({
    hand_id: hand.id,
    player_id: playerId,
    action_type: actionType,
    amount,
    round,
    sequence_number: sequenceNumber,
  })
}

/**
 * Record blind posting (small blind or big blind) in database and events
 */
export async function recordBlindPost(
  gameId: number,
  playerId: number,
  blindType: string,
  amount: number,
) {
  eventLogger.logEvent(
    EVENT_TYPE.BLINDS_POSTED,
    {
      playerId,
      blindType,
      amount,
    },
    gameId,
  )
  await recordAction(gameId, playerId, blindType, amount, 'preflop')
}

/**
 * Get all actions for a specific hand
 */
export async function getHandActions(handId: number) {
  const actions = await db('actions')
    .where({ hand_id: handId })
    .orderBy('sequence_number')
    .orderBy('created_at')

  return actions.map((a: any) => ({
    id: a.id,
    playerId: a.player_id,
    actionType: a.action_type,
    amount: a.amount,
    round: a.round,
    sequenceNumber: a.sequence_number,
    timestamp: a.created_at,
  }))
}

/**
 * Reveal next community card when all players are all-in
 */
export async function revealCard(playerId: number) {
  const player = await playerService.getPlayerById(playerId)
  if (!player) {
    throw new Error('Player not found')
  }

  let game = await gameService.getGameById(player.gameId)
  if (!game) {
    throw new Error('Game not found')
  }

  if (game.status !== 'active') {
    throw new Error('Game is not active')
  }

  const playerPosition = game.players.findIndex((p: any) => p.id === playerId)
  if (playerPosition === -1) {
    throw new Error('Player not in game')
  }

  const { canRevealCard } = await import('@/lib/betting-logic')
  const validation = canRevealCard(game, playerPosition)
  if (!validation.canReveal) {
    throw new Error(validation.error || 'Cannot reveal card in current game state')
  }

  const { revealNextCard } = await import('@/lib/game-state-machine')
  let newState = revealNextCard(game)

  eventLogger.logEvent(
    EVENT_TYPE.CARD_REVEALED,
    {
      playerId,
      round: newState.currentRound,
      communityCards: newState.communityCards,
    },
    game.id,
  )

  await gameService.saveGameState(game.id, newState)

  if (newState.currentRound === 'showdown') {
    const { processShowdown } = await import('@/lib/game-state-machine')
    newState = processShowdown(newState)
    await gameService.saveGameState(game.id, newState)

    // Get the most recent hand ID for this game
    const recentHand = await db('hands')
      .where({ game_id: game.id })
      .orderBy('hand_number', 'desc')
      .first()

    if (recentHand) {
      await createShowdownHistory(game.id, recentHand.id, newState)
    }
  }

  return gameService.getGameById(game.id)
}

/**
 * Get all actions for a game, optionally filtered by hand number
 */
export async function getGameActions(gameId: number, handNumber: number | null = null) {
  let query = db('actions')
    .join('hands', 'actions.hand_id', 'hands.id')
    .where('hands.game_id', gameId)

  if (handNumber !== null) {
    query = query.where('hands.hand_number', handNumber)
  }

  const actions = await query
    .select('actions.*', 'hands.hand_number')
    .orderBy('hands.hand_number')
    .orderBy('actions.sequence_number')
    .orderBy('actions.created_at')

  return actions.map((a: any) => ({
    id: a.id,
    handId: a.hand_id,
    handNumber: a.hand_number,
    playerId: a.player_id,
    actionType: a.action_type,
    amount: a.amount,
    round: a.round,
    sequenceNumber: a.sequence_number,
    timestamp: a.created_at,
  }))
}
