// @ts-ignore
import db from '@holdem/database/db'
import eventLogger from '@/services/event-logger'
import { EVENT_TYPE } from '@/lib/event-types'
import { appendEvent } from './event-store'
import { EVENT_TYPES as EVENT_TYPES_V2 } from '@holdem/shared'
import * as gameService from './game-service'

export interface Player {
  id: number // room_player_id
  gameId: number
  name: string
  position: number
  chips: number
  currentBet: number
  totalBet?: number
  holeCards: Array<{ rank: string; suit: string; value: number }>
  status: string
  isDealer: boolean
  isSmallBlind: boolean
  isBigBlind: boolean
  lastAction: string | null
  connected: boolean
  showCards: boolean
}

interface GameConfig {
  smallBlind?: number
  bigBlind?: number
  startingChips?: number
}

interface JoinGameResult {
  id: number
  name: string
  position: number
  chips: number
  gameId: number
}

/**
 * Join a game (sit down at table)
 */
export async function joinGame(gameId: number, roomPlayerId: number): Promise<JoinGameResult> {
  // Use derived state for game status check
  const game = await gameService.getGameById(gameId)
  if (!game) {
    throw new Error('Game not found')
  }

  const roomPlayer = await db('room_players').where({ id: roomPlayerId }).first()
  if (!roomPlayer) {
    throw new Error('Room player not found')
  }

  // Check if player already in derived state
  const existingPlayer = game.players.find((p: any) => p.id === roomPlayerId)
  if (existingPlayer) {
    return {
      id: roomPlayerId,
      name: existingPlayer.name,
      position: existingPlayer.position,
      chips: existingPlayer.chips,
      gameId,
    }
  }

  if (game.status !== 'waiting') {
    throw new Error('Game already started')
  }

  if (game.players.length >= 10) {
    throw new Error('Game is full')
  }

  // Calculate next position from derived state
  const maxPosition =
    game.players.length > 0 ? Math.max(...game.players.map((p: any) => p.position)) : -1
  const position = maxPosition + 1

  // Get starting chips from game metadata
  const startingChips = roomPlayer.chips > 0 ? roomPlayer.chips : game.startingChips

  await db('game_players').insert({
    game_id: gameId,
    room_player_id: roomPlayerId,
    position,
    chips: startingChips,
    current_bet: 0,
    status: 'active',
    is_dealer: 0,
    is_small_blind: 0,
    is_big_blind: 0,
    show_cards: 0,
    created_at: new Date(),
    updated_at: new Date(),
  })

  eventLogger.logEvent(
    EVENT_TYPE.PLAYER_JOINED,
    {
      playerId: roomPlayerId,
      playerName: roomPlayer.name,
      position,
      chips: startingChips,
    },
    gameId,
  )

  // RECORD V2 EVENT (PLAYER_JOINED)
  await appendEvent(gameId, 0, EVENT_TYPES_V2.PLAYER_JOINED, roomPlayerId, {
    name: roomPlayer.name,
    position,
    startingChips,
  })

  return {
    id: roomPlayerId,
    name: roomPlayer.name,
    position,
    chips: startingChips,
    gameId,
  }
}

/**
 * Get player by room_player_id with full details
 * Uses event-derived state for game-related data
 */
export async function getPlayerById(
  roomPlayerId: number,
  gameId?: number,
): Promise<Player | null> {
  const roomPlayer = await db('room_players').where({ id: roomPlayerId }).first()
  if (!roomPlayer) return null

  if (!gameId) {
    // No game context, return basic room player info
    return {
      id: roomPlayerId,
      gameId: 0,
      name: roomPlayer.name,
      position: 0,
      chips: roomPlayer.chips,
      currentBet: 0,
      holeCards: [],
      status: 'active',
      isDealer: false,
      isSmallBlind: false,
      isBigBlind: false,
      lastAction: null,
      connected: roomPlayer.connected === 1,
      showCards: false,
    }
  }

  // Get derived game state
  const game = await gameService.getGameById(gameId)
  if (!game) return null

  // Find player in derived state
  const derivedPlayer = game.players.find((p: any) => p.id === roomPlayerId)
  if (!derivedPlayer) return null

  return {
    id: roomPlayerId,
    gameId,
    name: derivedPlayer.name,
    position: derivedPlayer.position,
    chips: derivedPlayer.chips,
    currentBet: derivedPlayer.currentBet || 0,
    holeCards: derivedPlayer.holeCards || [],
    status: derivedPlayer.status,
    isDealer: derivedPlayer.isDealer || false,
    isSmallBlind: derivedPlayer.isSmallBlind || false,
    isBigBlind: derivedPlayer.isBigBlind || false,
    lastAction: derivedPlayer.lastAction || null,
    connected: roomPlayer.connected === 1,
    showCards: derivedPlayer.showCards || false,
  }
}

/**
 * Remove player from game (disconnect or delete)
 * Uses event-derived state for game status check
 */
export async function leaveGame(roomPlayerId: number, gameId: number): Promise<void> {
  const player = await getPlayerById(roomPlayerId, gameId)
  if (!player) {
    throw new Error('Player not found')
  }

  // Use derived state for game status
  const game = await gameService.getGameById(gameId)
  if (!game) {
    throw new Error('Game not found')
  }

  if (game.status !== 'waiting') {
    // Cannot remove from active game easily, just mark disconnected in room_players
    await db('room_players')
      .where({ id: roomPlayerId })
      .update({ connected: 0, updated_at: new Date() })

    eventLogger.logEvent(
      EVENT_TYPE.PLAYER_LEFT,
      {
        playerId: roomPlayerId,
        playerName: player.name,
        disconnected: true,
      },
      gameId,
    )
  } else {
    // Waiting game: remove from table
    await db('game_players').where({ room_player_id: roomPlayerId, game_id: gameId }).delete()
    eventLogger.logEvent(
      EVENT_TYPE.PLAYER_LEFT,
      {
        playerId: roomPlayerId,
        playerName: player.name,
        removed: true,
      },
      gameId,
    )
  }
}

/**
 * Update player connection status
 */
export async function updateConnectionStatus(
  roomPlayerId: number,
  connected: boolean,
): Promise<void> {
  await db('room_players')
    .where({ id: roomPlayerId })
    .update({ connected: connected ? 1 : 0, updated_at: new Date() })
}

/**
 * Get all players in a game
 * Uses event-derived state
 */
export async function getPlayersInGame(gameId: number) {
  const game = await gameService.getGameById(gameId)
  if (!game) return []

  // Get connection status from room_players (not derivable from events)
  const roomPlayerIds = game.players.map((p: any) => p.id)
  const roomPlayers = await db('room_players').whereIn('id', roomPlayerIds)
  const connectionMap = new Map(roomPlayers.map((rp: any) => [rp.id, rp.connected === 1]))

  return game.players.map((p: any) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    chips: p.chips,
    currentBet: p.currentBet || 0,
    status: p.status,
    connected: connectionMap.get(p.id) ?? false,
  }))
}

/**
 * Set player card visibility status
 */
export async function setShowCards(
  roomPlayerId: number,
  gameId: number,
  showCards: boolean,
): Promise<void> {
  const player = await getPlayerById(roomPlayerId, gameId)
  await db('game_players')
    .where({ room_player_id: roomPlayerId, game_id: gameId })
    .update({ show_cards: showCards ? 1 : 0, updated_at: new Date() })

  if (showCards && player) {
    eventLogger.logEvent(
      EVENT_TYPE.CARDS_SHOWN,
      {
        playerId: roomPlayerId,
        playerName: player.name,
      },
      player.gameId,
    )

    // RECORD V2 EVENT (REVEAL_CARDS)
    const hand = await db('hands')
      .where({ game_id: player.gameId })
      .orderBy('hand_number', 'desc')
      .first()

    if (hand && player.holeCards && player.holeCards.length > 0) {
      await appendEvent(
        player.gameId,
        hand.hand_number,
        EVENT_TYPES_V2.REVEAL_CARDS,
        roomPlayerId,
        {
          holeCards: player.holeCards,
        },
      )
    }
  }
}

/**
 * Alias for getPlayersInGame
 */
export function getAllPlayersInGame(gameId: number) {
  return getPlayersInGame(gameId)
}

export default {
  joinGame,
  getPlayerById,
  leaveGame,
  updateConnectionStatus,
  getAllPlayersInGame,
  setShowCards,
}
