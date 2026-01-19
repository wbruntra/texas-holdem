// @ts-ignore
import db from '@holdem/database/db'
// @ts-ignore
import { Model } from 'objection'
import crypto from 'crypto'
import {
  createGameState,
  startNewHand,
  advanceRound,
  processShowdown,
  isBettingRoundComplete,
  shouldAutoAdvance,
  shouldContinueToNextRound,
} from '../lib/game-state-machine'
import { ROUND, GAME_STATUS } from '../lib/game-constants'
// @ts-ignore
import { Card, Player, EVENT_TYPES as EVENT_TYPES_V2 } from '@holdem/shared'
import eventLogger from './event-logger'
import { EVENT_TYPE } from '@/lib/event-types'
import { appendEvents, appendEvent } from './event-store'
import { validateGameState } from './state-validator'
import { saveSnapshot } from './snapshot-store'
import { getEvents } from './event-store'
import { deriveGameStateForGame } from '@/lib/state-derivation'

function calculatePayouts(beforeState: any, afterState: any) {
  const payouts: any[] = []
  afterState.players.forEach((p: any) => {
    const beforeStats = beforeState.players.find((bp: any) => bp.id === p.id)
    if (beforeStats && p.chips > beforeStats.chips) {
      payouts.push({
        playerId: p.id,
        amount: p.chips - beforeStats.chips,
      })
    }
  })
  return payouts
}

export interface GameConfig {
  smallBlind?: number
  bigBlind?: number
  startingChips?: number
  seed?: string | number
}

export interface Game {
  id: number
  roomId: number
  roomCode?: string
  status: string
  smallBlind: number
  bigBlind: number
  startingChips: number
  seed?: string
}

export interface PlayerStackInfo {
  player_id: number
  position: number
  name: string
  chips: number
}

// Generate unique 6-character room code (moved to room-service, kept here if needed but likely unused)
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * Create new poker game in a room
 */
export async function createGameInRoom(roomId: number, config: GameConfig = {}): Promise<Game> {
  const room = await db('rooms').where({ id: roomId }).first()
  if (!room) throw new Error('Room not found')

  const lastGame = await db('games')
    .where({ room_id: roomId })
    .orderBy('game_number', 'desc')
    .first()
  const gameNumber = lastGame ? lastGame.game_number + 1 : 1

  const smallBlind = config.smallBlind || room.small_blind
  const bigBlind = config.bigBlind || room.big_blind
  const startingChips = config.startingChips || room.starting_chips

  const [id] = await db('games').insert({
    room_id: roomId,
    game_number: gameNumber,
    room_code: room.room_code, // Optional, for easy lookup
    status: GAME_STATUS.WAITING,
    small_blind: smallBlind,
    big_blind: bigBlind,
    starting_chips: startingChips,
    dealer_position: 0,
    pot: 0,
    current_bet: 0,
    hand_number: 0,
    last_raise: 0,
    seed: config.seed || crypto.randomUUID(),
  })

  // Update room's current game
  await db('rooms').where({ id: roomId }).update({ current_game_id: id })

  const game = await getGameById(id)
  if (!game) throw new Error('Failed to retrieve created game')
  return game
}

/**
 * Get static game metadata (config, room code, seed) without state
 * This is used by the derivation engine to avoid circular deps
 */
export async function getGameMetadata(gameId: number) {
  const game = await db('games').where({ id: gameId }).first()
  if (!game) return null

  return {
    id: game.id,
    roomId: game.room_id,
    roomCode: game.room_code,
    smallBlind: game.small_blind,
    bigBlind: game.big_blind,
    startingChips: game.starting_chips,
    seed: game.seed,
  }
}

/**
 * Get full game state by deriving from events
 * This is the main API for getting game state
 */
export async function getGameById(gameId: number) {
  const metadata = await getGameMetadata(gameId)
  if (!metadata) return null

  // Import dynamically to avoid circular dependency at module load
  const { deriveGameState } = await import('@/lib/state-derivation')
  const { getEvents } = await import('./event-store')

  const events = await getEvents(gameId)

  const gameConfig = {
    smallBlind: metadata.smallBlind,
    bigBlind: metadata.bigBlind,
    startingChips: metadata.startingChips,
  }

  const derivedState = deriveGameState(gameConfig, [], events)

  return {
    ...derivedState,
    id: metadata.id,
    roomId: metadata.roomId,
    roomCode: metadata.roomCode,
    seed: metadata.seed,
    startingChips: metadata.startingChips,
    pots: [],
  }
}

/**
 * Get game player record provided gameId and roomPlayerId
 * Uses event-derived state to check player membership
 */
export async function getGamePlayer(gameId: number, roomPlayerId: number) {
  const game = await getGameById(gameId)
  if (!game) return null

  const player = game.players.find((p: any) => p.id === roomPlayerId)
  if (!player) return null

  // Return a minimal object matching what the old DB query returned
  // This is used primarily for authorization checks
  return {
    game_id: gameId,
    room_player_id: roomPlayerId,
    position: player.position,
    chips: player.chips,
    status: player.status,
  }
}

/**
 * Get game by room code
 */
export async function getGameByRoomCode(roomCode: string) {
  const room = await db('rooms').where({ room_code: roomCode }).first()
  if (!room) return null
  if (!room.current_game_id) return null // No active game in this room

  return getGameById(room.current_game_id)
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

  // await saveGameState(gameId, newState) - REMOVED

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
      deck: newState.deck.slice(0, 12),
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

  // RECORD V2 EVENTS
  try {
    const holeCards: Record<number, [Card, Card]> = {}
    newState.players.forEach((p: Player) => {
      // @ts-ignore
      if (p.holeCards && p.holeCards.length === 2) {
        // @ts-ignore
        holeCards[p.id] = p.holeCards
      }
    })

    const events = []
    let seq = 0

    events.push({
      gameId,
      handNumber: newState.handNumber,
      sequenceNumber: seq++,
      eventType: EVENT_TYPES_V2.HAND_START,
      playerId: null,
      payload: {
        handNumber: newState.handNumber,
        dealerPosition: newState.dealerPosition,
        // @ts-ignore
        smallBlindPosition: newState.players.findIndex((p) => p.isSmallBlind),
        // @ts-ignore
        bigBlindPosition: newState.players.findIndex((p) => p.isBigBlind),
        deck: newState.deck.slice(0, 12),
        holeCards,
      },
    })

    // Record blinds
    // @ts-ignore
    const sbPlayer = newState.players.find((p) => p.isSmallBlind)
    // @ts-ignore
    const bbPlayer = newState.players.find((p) => p.isBigBlind)

    if (sbPlayer && sbPlayer.currentBet > 0) {
      events.push({
        gameId,
        handNumber: newState.handNumber,
        sequenceNumber: seq++,
        eventType: EVENT_TYPES_V2.POST_BLIND,
        playerId: sbPlayer.id,
        payload: {
          blindType: 'small',
          amount: sbPlayer.currentBet,
          // @ts-ignore
          isAllIn: sbPlayer.status === 'all_in',
        },
      })
    }

    if (bbPlayer && bbPlayer.currentBet > 0) {
      events.push({
        gameId,
        handNumber: newState.handNumber,
        sequenceNumber: seq++,
        eventType: EVENT_TYPES_V2.POST_BLIND,
        playerId: bbPlayer.id,
        payload: {
          blindType: 'big',
          amount: bbPlayer.currentBet,
          // @ts-ignore
          isAllIn: bbPlayer.status === 'all_in',
        },
      })
    }

    // @ts-ignore
    await appendEvents(events)
  } catch (err) {
    console.error('Failed to record V2 events:', err)
  }

  return getGameById(gameId)
}

/**
 * Save complete game state to database
 */
/**
 * Save complete game state to database
 * @deprecated - State is now derived from events. This function is removed.
 */
export async function saveGameState(gameId: number, state: any): Promise<void> {
  // Function body removed to prevent accidental usage.
  // This is kept temporarily if other modules import it, but it does nothing.
  return Promise.resolve()
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
    !gameState.action_finished &&
    gameState.currentPlayerPosition !== null // Allow advance if position is explicitly null (skipped round)
  ) {
    return gameState
  }

  if (gameState.currentRound === ROUND.SHOWDOWN) {
    return gameState
  }

  gameState.action_finished = false

  if (shouldContinueToNextRound(gameState)) {
    gameState = advanceRound(gameState)
    // await saveGameState(gameId, gameState) - REMOVED

    // RECORD V2 EVENTS (ROUND STARTED)
    await appendEvent(gameId, gameState.handNumber, EVENT_TYPES_V2.DEAL_COMMUNITY, null, {
      round: gameState.currentRound,
      communityCards: gameState.communityCards,
    })

    // Validate State
    await validateGameState(gameId)
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
      const gameStateBeforeShowdown = { ...gameState }
      gameState = processShowdown(gameState)
      //       await saveGameState(gameId, gameState)

      await completeHandRecord(gameId, gameState)

      eventLogger.logEvent(
        EVENT_TYPE.HAND_COMPLETED,
        {
          winners: gameState.winners,
          handNumber: gameState.handNumber,
        },
        gameId,
      )

      const payouts = calculatePayouts(gameStateBeforeShowdown, gameState)

      // RECORD V2 EVENTS (SHOWDOWN - informational only)
      await appendEvent(gameId, gameState.handNumber, EVENT_TYPES_V2.SHOWDOWN, null, {
        communityCards: gameState.communityCards,
        // Card rankings could go here in future
      })

      // RECORD V2 EVENTS (AWARD_POT - chip distribution)
      await appendEvent(gameId, gameState.handNumber, EVENT_TYPES_V2.AWARD_POT, null, {
        winReason: 'showdown',
        winners: gameState.winners,
        payouts,
        potTotal: gameStateBeforeShowdown.pot,
      })

      // Also record simple HAND_COMPLETE for now to close the loop
      await appendEvent(gameId, gameState.handNumber, EVENT_TYPES_V2.HAND_COMPLETE, null, {
        winners: gameState.winners,
      })

      // Validate State
      await validateGameState(gameId)

      // CREATE SNAPSHOT
      const derivedState = await deriveGameStateForGame(gameId)
      const events = await getEvents(gameId)
      const lastSeq = events.length > 0 ? events[events.length - 1].sequenceNumber : 0

      await saveSnapshot(gameId, gameState.handNumber, lastSeq, derivedState)
    } else {
      // Not advancing from river, just save the state
      // await saveGameState(gameId, gameState) - REMOVED
      // Validate State
      await validateGameState(gameId)
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
          // await saveGameState(gameId, gameState) - REMOVED

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

      // await saveGameState(gameId, gameState) - REMOVED

      // RECORD V2 EVENTS (ROUND STARTED)
      await appendEvent(gameId, gameState.handNumber, EVENT_TYPES_V2.DEAL_COMMUNITY, null, {
        round: gameState.currentRound,
        communityCards: gameState.communityCards,
      })

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
      const gameStateBeforeShowdown = { ...gameState }
      gameState = processShowdown(gameState)
      //       await saveGameState(gameId, gameState)

      await completeHandRecord(gameId, gameState)

      eventLogger.logEvent(
        EVENT_TYPE.HAND_COMPLETED,
        {
          winners: gameState.winners,
          handNumber: gameState.handNumber,
        },
        gameId,
      )

      // RECORD V2 EVENTS (SHOWDOWN - informational only)
      const payouts = calculatePayouts(gameStateBeforeShowdown, gameState)
      await appendEvent(gameId, gameState.handNumber, EVENT_TYPES_V2.SHOWDOWN, null, {
        communityCards: gameState.communityCards,
      })

      // RECORD V2 EVENTS (AWARD_POT - chip distribution)
      await appendEvent(gameId, gameState.handNumber, EVENT_TYPES_V2.AWARD_POT, null, {
        winReason: 'showdown',
        winners: gameState.winners,
        payouts,
        potTotal: gameStateBeforeShowdown.pot,
      })

      await appendEvent(gameId, gameState.handNumber, EVENT_TYPES_V2.HAND_COMPLETE, null, {
        winners: gameState.winners,
      })

      // Validate State
      await validateGameState(gameId)

      // CREATE SNAPSHOT
      const derivedState = await deriveGameStateForGame(gameId)
      const events = await getEvents(gameId)
      const lastSeq = events.length > 0 ? events[events.length - 1].sequenceNumber : 0

      await saveSnapshot(gameId, gameState.handNumber, lastSeq, derivedState)

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
  // await saveGameState(gameId, newState) - REMOVED

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
      deck: newState.deck.slice(0, 12),
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

  // RECORD V2 EVENTS
  try {
    const holeCards: Record<number, [Card, Card]> = {}
    newState.players.forEach((p: any) => {
      // @ts-ignore
      if (p.holeCards && p.holeCards.length === 2) {
        // @ts-ignore
        holeCards[p.id] = p.holeCards
      }
    })

    const events = []
    let seq = 0

    events.push({
      gameId,
      handNumber: newState.handNumber,
      sequenceNumber: seq++,
      eventType: EVENT_TYPES_V2.HAND_START,
      playerId: null,
      payload: {
        handNumber: newState.handNumber,
        dealerPosition: newState.dealerPosition,
        // @ts-ignore
        smallBlindPosition: newState.players.findIndex((p) => p.isSmallBlind),
        // @ts-ignore
        bigBlindPosition: newState.players.findIndex((p) => p.isBigBlind),
        deck: newState.deck.slice(0, 12),
        holeCards,
      },
    })

    // Record blinds
    // @ts-ignore
    const sbPlayer = newState.players.find((p) => p.isSmallBlind)
    // @ts-ignore
    const bbPlayer = newState.players.find((p) => p.isBigBlind)

    if (sbPlayer && sbPlayer.currentBet > 0) {
      events.push({
        gameId,
        handNumber: newState.handNumber,
        sequenceNumber: seq++,
        eventType: EVENT_TYPES_V2.POST_BLIND,
        playerId: sbPlayer.id,
        payload: {
          blindType: 'small',
          amount: sbPlayer.currentBet,
          // @ts-ignore
          isAllIn: sbPlayer.status === 'all_in',
        },
      })
    }

    if (bbPlayer && bbPlayer.currentBet > 0) {
      events.push({
        gameId,
        handNumber: newState.handNumber,
        sequenceNumber: seq++,
        eventType: EVENT_TYPES_V2.POST_BLIND,
        playerId: bbPlayer.id,
        payload: {
          blindType: 'big',
          amount: bbPlayer.currentBet,
          // @ts-ignore
          isAllIn: bbPlayer.status === 'all_in',
        },
      })
    }

    // @ts-ignore
    await appendEvents(events)
  } catch (err) {
    console.error('Failed to record V2 events:', err)
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

  // @ts-ignore
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
    const { createShowdownHistory } = await import('./showdown-service')
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
    // @ts-ignore
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
 * Start new game in the same room with fresh chip stacks
 */
export async function startNewGame(roomId: number) {
  const room = await db('rooms').where({ id: roomId }).first()
  if (!room) throw new Error('Room not found')

  const oldGameId = room.current_game_id

  if (oldGameId) {
    const oldGame = await db('games').where({ id: oldGameId }).first()
    if (oldGame && oldGame.status !== GAME_STATUS.COMPLETED) {
      await db('games')
        .where({ id: oldGameId })
        .update({ status: GAME_STATUS.COMPLETED, updated_at: new Date() })
    }
  }

  const newGame = await createGameInRoom(roomId)

  const [connectedRoomPlayers, oldPlayers] = await Promise.all([
    db('room_players').where({ room_id: roomId, connected: true }),
    oldGameId ? db('game_players').where({ game_id: oldGameId }) : Promise.resolve([]),
  ])

  const oldPositionMap = new Map<number, number>(
    oldPlayers.map((p: any) => [p.room_player_id, p.position]),
  )
  const usedPositions = new Set<number>()

  const gamePlayerInserts = []
  const joinEvents = []

  for (const roomPlayer of connectedRoomPlayers) {
    let position: number | undefined = oldPositionMap.get(roomPlayer.id)

    if (position === undefined || usedPositions.has(position)) {
      position = 0
      while (usedPositions.has(position)) position++
    }

    usedPositions.add(position)

    gamePlayerInserts.push({
      game_id: newGame.id,
      room_player_id: roomPlayer.id,
      position,
      chips: room.starting_chips,
      current_bet: 0,
      total_bet: 0,
      status: 'active',
      is_dealer: false,
      is_small_blind: false,
      is_big_blind: false,
      show_cards: false,
      created_at: new Date(),
      updated_at: new Date(),
    })
  }

  if (gamePlayerInserts.length === 0) {
    return getGameById(newGame.id)
  }

  await db('game_players').insert(gamePlayerInserts)

  for (let i = 0; i < connectedRoomPlayers.length; i++) {
    const roomPlayer = connectedRoomPlayers[i]

    joinEvents.push({
      gameId: newGame.id,
      handNumber: 0,
      sequenceNumber: i,
      eventType: EVENT_TYPES_V2.PLAYER_JOINED,
      playerId: roomPlayer.id,
      payload: {
        name: roomPlayer.name,
        position: gamePlayerInserts[i].position,
        startingChips: room.starting_chips,
      },
    })
  }

  await appendEvents(joinEvents)

  return getGameById(newGame.id)
}

/**
 * Delete game from database
 */
export async function deleteGame(gameId: number): Promise<void> {
  await db('games').where({ id: gameId }).delete()
}

export default {
  createGameInRoom,
  getGameById,
  getGamePlayer,
  getGameByRoomCode,
  startGame,
  saveGameState,
  advanceRoundIfReady,
  advanceOneRound,
  startNextHand,
  createHandRecord,
  completeHandRecord,
  recordHandHistory,
  startNewGame,
  deleteGame,
}
