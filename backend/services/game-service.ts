// @ts-ignore
import db from '@holdem/database/db'
import crypto from 'crypto'
import {
  createGameState,
  startNewHand,
  advanceRound,
  processShowdown,
  isBettingRoundComplete,
  shouldAutoAdvance,
  shouldContinueToNextRound,
} from '@/lib/game-state-machine'
import { GAME_STATUS, ROUND } from '@/lib/game-constants'
import eventLogger from '@/services/event-logger'
import { EVENT_TYPE } from '@/lib/event-types'
import { createShowdownHistory } from './showdown-service'
import type { Card } from '@/lib/poker-engine'
import type { Player, GameState } from '@holdem/shared/game-types'

interface GameConfig {
  smallBlind?: number
  bigBlind?: number
  startingChips?: number
  seed?: string | number
}

interface Game {
  id: number
  roomCode: string
  status: string
  smallBlind: number
  bigBlind: number
  startingChips: number
  seed?: string
}

interface PlayerStackInfo {
  player_id: number
  position: number
  name: string
  chips: number
}

/**
 * Generate unique 6-character room code
 */
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * Create new poker game with unique room code
 */
export async function createGame(config: GameConfig = {}): Promise<Game> {
  const { smallBlind = 5, bigBlind = 10, startingChips = 1000, seed } = config

  let roomCode: string
  let attempts = 0
  do {
    roomCode = generateRoomCode()
    const existing = await db('games').where({ room_code: roomCode }).first()
    if (!existing) break
    attempts++
  } while (attempts < 10)

  if (attempts >= 10) {
    throw new Error('Failed to generate unique room code')
  }

  const finalSeed = seed ? String(seed) : crypto.randomUUID()

  const [gameId] = await db('games').insert({
    room_code: roomCode,
    status: GAME_STATUS.WAITING,
    small_blind: smallBlind,
    big_blind: bigBlind,
    starting_chips: startingChips,
    dealer_position: 0,
    pot: 0,
    current_bet: 0,
    hand_number: 0,
    last_raise: 0,
    seed: finalSeed,
  })

  eventLogger.logEvent(
    EVENT_TYPE.GAME_CREATED,
    {
      roomCode,
      smallBlind,
      bigBlind,
      startingChips,
    },
    gameId,
  )

  return {
    id: gameId,
    roomCode,
    status: GAME_STATUS.WAITING,
    smallBlind,
    bigBlind,
    startingChips,
  }
}

/**
 * Get game by ID with full state
 */
export async function getGameById(gameId: number) {
  const game = await db('games').where({ id: gameId }).first()
  if (!game) return null

  const players = await db('players').where({ game_id: gameId }).orderBy('position')

  return {
    id: game.id,
    roomCode: game.room_code,
    status: game.status,
    smallBlind: game.small_blind,
    bigBlind: game.big_blind,
    startingChips: game.starting_chips,
    dealerPosition: game.dealer_position,
    currentRound: game.current_round,
    pot: game.pot,
    communityCards: game.community_cards ? JSON.parse(game.community_cards) : [],
    deck: game.deck ? JSON.parse(game.deck) : [],
    winners: game.winners ? JSON.parse(game.winners) : undefined,
    seed: game.seed,
    currentBet: game.current_bet,
    currentPlayerPosition: game.current_player_position,
    handNumber: game.hand_number,
    lastRaise: game.last_raise,
    showdownProcessed: game.showdown_processed === 1 || game.showdown_processed === true,
    action_finished: game.action_finished === 1 || game.action_finished === true,
    players: players.map((p: any) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      chips: p.chips,
      currentBet: p.current_bet,
      totalBet: p.total_bet || 0,
      holeCards: p.hole_cards ? JSON.parse(p.hole_cards) : [],
      status: p.status,
      isDealer: p.is_dealer === 1,
      isSmallBlind: p.is_small_blind === 1,
      isBigBlind: p.is_big_blind === 1,
      lastAction: p.last_action,
      connected: p.connected === 1,
      showCards: p.show_cards === 1,
    })),
    pots: [],
  }
}

/**
 * Get game by room code
 */
export async function getGameByRoomCode(roomCode: string) {
  const game = await db('games').where({ room_code: roomCode }).first()
  if (!game) return null

  return getGameById(game.id)
}

/**
 * Start poker game with first hand
 */
export async function startGame(gameId: number) {
  const game = await getGameById(gameId)
  if (!game) {
    throw new Error('Game not found')
  }

  if (game.status !== GAME_STATUS.WAITING) {
    throw new Error('Game already started')
  }

  if (game.players.length < 2) {
    throw new Error('Need at least 2 players to start')
  }

  const gameState = createGameState({
    smallBlind: game.smallBlind,
    bigBlind: game.bigBlind,
    startingChips: game.startingChips,
    players: game.players,
  })

  const newState = startNewHand(gameState, game.seed)

  await saveGameState(gameId, newState)

  await createHandRecord(gameId, newState)

  eventLogger.logEvent(
    EVENT_TYPE.GAME_STARTED,
    {
      playerCount: newState.players.length,
      dealerPosition: newState.dealerPosition,
      handNumber: newState.handNumber,
      players: newState.players.map((p) => ({
        id: p.id,
        name: p.name,
        position: p.position,
        chips: p.chips,
        holeCards: p.holeCards,
        isDealer: p.isDealer,
        isSmallBlind: p.isSmallBlind,
        isBigBlind: p.isBigBlind,
      })),
      deck: newState.deck,
    },
    gameId,
  )

  try {
    const { recordBlindPost } = await import('./action-service')
    const players = newState.players

    const sbPlayer = players.find((p) => p.isSmallBlind)
    const bbPlayer = players.find((p) => p.isBigBlind)

    if (sbPlayer && sbPlayer.currentBet > 0) {
      await recordBlindPost(gameId, Number(sbPlayer.id), 'small_blind', sbPlayer.currentBet)
    }
    if (bbPlayer && bbPlayer.currentBet > 0) {
      await recordBlindPost(gameId, Number(bbPlayer.id), 'big_blind', bbPlayer.currentBet)
    }
  } catch (error) {
    console.error('Failed to record blind posts:', error)
  }

  return getGameById(gameId)
}

/**
 * Save complete game state to database
 */
export async function saveGameState(gameId: number, state: any): Promise<void> {
  await db.transaction(async (trx: any) => {
    await trx('games')
      .where({ id: gameId })
      .update({
        status: state.status,
        dealer_position: state.dealerPosition,
        current_round: state.currentRound,
        pot: state.pot,
        community_cards:
          state.communityCards.length > 0 ? JSON.stringify(state.communityCards) : null,
        deck: state.deck && state.deck.length > 0 ? JSON.stringify(state.deck) : null,
        winners:
          Array.isArray(state.winners) && state.winners.length > 0
            ? JSON.stringify(state.winners)
            : null,
        current_bet: state.currentBet,
        current_player_position: state.currentPlayerPosition,
        hand_number: state.handNumber,
        last_raise: state.lastRaise,
        showdown_processed: state.showdownProcessed === true || state.showdownProcessed === 1,
        action_finished: state.action_finished === true || state.action_finished === 1,
        updated_at: new Date(),
      })

    for (const player of state.players) {
      await trx('players')
        .where({ id: player.id })
        .update({
          chips: player.chips,
          current_bet: player.currentBet,
          total_bet: player.totalBet || 0,
          hole_cards: player.holeCards.length > 0 ? JSON.stringify(player.holeCards) : null,
          status: player.status,
          is_dealer: player.isDealer ? 1 : 0,
          is_small_blind: player.isSmallBlind ? 1 : 0,
          is_big_blind: player.isBigBlind ? 1 : 0,
          show_cards: player.showCards ? 1 : 0,
          last_action: player.lastAction,
          updated_at: new Date(),
        })
    }
  })
}

/**
 * Advance to next betting round
 */
export async function advanceOneRound(gameId: number) {
  const game = await getGameById(gameId)
  if (!game) {
    throw new Error('Game not found')
  }

  let gameState: any = game

  if (
    !isBettingRoundComplete(gameState) &&
    !shouldAutoAdvance(gameState) &&
    !gameState.action_finished
  ) {
    return gameState
  }

  if (gameState.currentRound === ROUND.SHOWDOWN) {
    return gameState
  }

  gameState.action_finished = false

  if (shouldContinueToNextRound(gameState)) {
    gameState = advanceRound(gameState)
    await saveGameState(gameId, gameState)
  } else {
    // Check if we're advancing from river to showdown
    const isAdvancingFromRiver = gameState.currentRound === ROUND.RIVER

    gameState = advanceRound(gameState)

    if (isAdvancingFromRiver) {
      // We just moved from river to showdown, process it
      eventLogger.logEvent(
        EVENT_TYPE.SHOWDOWN,
        {
          communityCards: gameState.communityCards,
          pot: gameState.pot,
        },
        gameId,
      )
      gameState = processShowdown(gameState)
      await saveGameState(gameId, gameState)

      await completeHandRecord(gameId, gameState)

      eventLogger.logEvent(
        EVENT_TYPE.HAND_COMPLETED,
        {
          winners: gameState.winners,
          handNumber: gameState.handNumber,
        },
        gameId,
      )
    } else {
      // Not advancing from river, just save the state
      await saveGameState(gameId, gameState)
    }
  }

  return gameState
}

/**
 * Auto-advance through rounds if ready
 */
export async function advanceRoundIfReady(gameId: number) {
  const game = await getGameById(gameId)
  if (!game) {
    throw new Error('Game not found')
  }

  let gameState: any = game

  const shouldAutoAdvanceNow = shouldAutoAdvance(gameState)

  while (
    (isBettingRoundComplete(gameState) || shouldAutoAdvance(gameState)) &&
    gameState.currentRound !== ROUND.SHOWDOWN
  ) {
    if (shouldAutoAdvance(gameState) && gameState.currentPlayerPosition !== null) {
      const activePlayers = gameState.players.filter(
        (p: any) => p.status === 'active' && p.chips > 0,
      )

      if (activePlayers.length === 1 && gameState.currentBet === 0) {
        const actingPlayer = activePlayers[0]
        const playerPosition = gameState.players.findIndex((p: any) => p.id === actingPlayer.id)

        if (playerPosition === gameState.currentPlayerPosition) {
          const { processAction } = await import('@/lib/betting-logic')

          gameState = processAction(gameState, playerPosition, 'check', 0)
          await saveGameState(gameId, gameState)

          const { recordAction } = await import('./action-service')
          await recordAction(gameId, actingPlayer.id, 'check', 0, gameState.currentRound!)
        }
      }
    }

    if (shouldContinueToNextRound(gameState)) {
      gameState = advanceRound(gameState)

      eventLogger.logEvent(
        EVENT_TYPE.ROUND_STARTED,
        {
          round: gameState.currentRound,
          communityCards: gameState.communityCards,
          pot: gameState.pot,
        },
        gameId,
      )

      if (shouldAutoAdvanceNow) {
        gameState.autoAdvanceTimestamp = Date.now()
      }

      await saveGameState(gameId, gameState)

      if (shouldAutoAdvanceNow && shouldAutoAdvance(gameState)) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    } else {
      gameState = advanceRound(gameState)
      eventLogger.logEvent(
        EVENT_TYPE.SHOWDOWN,
        {
          communityCards: gameState.communityCards,
          pot: gameState.pot,
        },
        gameId,
      )
      gameState = processShowdown(gameState)
      await saveGameState(gameId, gameState)

      await completeHandRecord(gameId, gameState)

      eventLogger.logEvent(
        EVENT_TYPE.HAND_COMPLETED,
        {
          winners: gameState.winners,
          handNumber: gameState.handNumber,
        },
        gameId,
      )
      break
    }
  }

  return getGameById(gameId)
}

/**
 * Start next hand after showdown
 */
export async function startNextHand(gameId: number) {
  const game = await getGameById(gameId)
  if (!game) {
    throw new Error('Game not found')
  }

  if (game.currentRound !== ROUND.SHOWDOWN) {
    throw new Error('Current hand not finished')
  }

  const newState = startNewHand(game)
  await saveGameState(gameId, newState)

  await createHandRecord(gameId, newState)

  eventLogger.logEvent(
    EVENT_TYPE.HAND_STARTED,
    {
      handNumber: newState.handNumber,
      dealerPosition: newState.dealerPosition,
      playerCount: newState.players.filter((p: any) => p.status !== 'out').length,
      players: newState.players.map((p: any) => ({
        id: p.id,
        name: p.name,
        position: p.position,
        chips: p.chips,
        holeCards: p.holeCards,
        status: p.status,
        isDealer: p.isDealer,
        isSmallBlind: p.isSmallBlind,
        isBigBlind: p.isBigBlind,
      })),
      deck: newState.deck,
    },
    gameId,
  )

  try {
    const { recordBlindPost } = await import('./action-service')
    const players = newState.players

    const sbPlayer = players.find((p: any) => p.isSmallBlind)
    const bbPlayer = players.find((p: any) => p.isBigBlind)

    if (sbPlayer && sbPlayer.currentBet > 0) {
      await recordBlindPost(gameId, Number(sbPlayer.id), 'small_blind', sbPlayer.currentBet)
    }
    if (bbPlayer && bbPlayer.currentBet > 0) {
      await recordBlindPost(gameId, Number(bbPlayer.id), 'big_blind', bbPlayer.currentBet)
    }
  } catch (error) {
    console.error('Failed to record blind posts:', error)
  }

  return getGameById(gameId)
}

/**
 * Create hand record for database
 */
export async function createHandRecord(gameId: number, gameState: any): Promise<number> {
  const playerStacksStart: PlayerStackInfo[] = gameState.players.map((p: Player) => ({
    player_id: p.id,
    position: p.position,
    name: p.name,
    chips: p.chips,
  }))

  const playerHoleCards: Record<number, Card[]> = {}
  gameState.players.forEach((p: Player) => {
    if (p.holeCards && p.holeCards.length > 0) {
      const playerId = typeof p.id === 'number' ? p.id : parseInt(String(p.id), 10)
      playerHoleCards[playerId] = p.holeCards
    }
  })

  const [handId] = await db('hands').insert({
    game_id: gameId,
    hand_number: gameState.handNumber,
    dealer_position: gameState.dealerPosition,
    deck: gameState.deck ? JSON.stringify(gameState.deck) : null,
    player_hole_cards: JSON.stringify(playerHoleCards),
    player_stacks_start: JSON.stringify(playerStacksStart),
    small_blind: gameState.smallBlind,
    big_blind: gameState.bigBlind,
    community_cards: JSON.stringify([]),
  })

  return handId
}

/**
 * Complete hand record with final results
 */
export async function completeHandRecord(gameId: number, gameState: any): Promise<void> {
  const hand = await db('hands').where({ game_id: gameId }).orderBy('hand_number', 'desc').first()

  if (!hand) {
    console.error('No hand record found to complete')
    return
  }

  const playerStacksEnd = gameState.players.map((p: Player) => ({
    player_id: p.id,
    position: p.position,
    chips: p.chips,
  }))

  await db('hands')
    .where({ id: hand.id })
    .update({
      winners: gameState.winners ? JSON.stringify(gameState.winners) : null,
      pot_amount: gameState.pot,
      community_cards: JSON.stringify(gameState.communityCards),
      player_stacks_end: JSON.stringify(playerStacksEnd),
      completed_at: new Date(),
      updated_at: new Date(),
    })

  // Create showdown history record after hand completion
  if (gameState.currentRound === 'showdown' || gameState.showdownProcessed) {
    await createShowdownHistory(gameId, hand.id, gameState)
  }
}

/**
 * Record hand history with results
 */
export async function recordHandHistory(gameId: number, gameState: any): Promise<void> {
  const existingHand = await db('hands')
    .where({ game_id: gameId, hand_number: gameState.handNumber })
    .first()

  if (existingHand) {
    await completeHandRecord(gameId, gameState)
  } else {
    await db('hands').insert({
      game_id: gameId,
      hand_number: gameState.handNumber,
      dealer_position: gameState.dealerPosition,
      winners: gameState.winners ? JSON.stringify(gameState.winners) : null,
      pot_amount: gameState.pot,
      community_cards: JSON.stringify(gameState.communityCards),
      completed_at: new Date(),
    })
  }
}

/**
 * Reset game to waiting state
 */
export async function resetGame(gameId: number) {
  const game = await db('games').where({ id: gameId }).first()
  if (!game) {
    throw new Error('Game not found')
  }

  const players = await db('players').where({ game_id: gameId }).orderBy('position')

  if (players.length === 0) {
    throw new Error('No players in game')
  }

  await db('games').where({ id: gameId }).update({
    status: GAME_STATUS.WAITING,
    dealer_position: 0,
    current_round: null,
    pot: 0,
    community_cards: null,
    current_bet: 0,
    current_player_position: null,
    hand_number: 0,
    last_raise: 0,
    deck: null,
    winners: null,
    seed: crypto.randomUUID(),
    updated_at: new Date(),
  })

  await db('players').where({ game_id: gameId }).update({
    chips: game.starting_chips,
    current_bet: 0,
    hole_cards: null,
    status: 'active',
    is_dealer: false,
    is_small_blind: false,
    is_big_blind: false,
    last_action: null,
    total_bet: 0,
    updated_at: new Date(),
  })

  await db('actions')
    .whereIn(
      'player_id',
      players.map((p: any) => p.id),
    )
    .delete()
  await db('hands').where({ game_id: gameId }).delete()

  eventLogger.logEvent(
    EVENT_TYPE.GAME_RESET,
    {
      playerCount: players.length,
    },
    gameId,
  )

  return getGameById(gameId)
}

/**
 * Delete game from database
 */
export async function deleteGame(gameId: number): Promise<void> {
  await db('games').where({ id: gameId }).delete()
}

export default {
  createGame,
  getGameById,
  getGameByRoomCode,
  startGame,
  saveGameState,
  advanceRoundIfReady,
  advanceOneRound,
  startNextHand,
  createHandRecord,
  completeHandRecord,
  recordHandHistory,
  resetGame,
  deleteGame,
}
