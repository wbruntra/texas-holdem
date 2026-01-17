// @ts-ignore
import db from '@holdem/database/db'
import eventLogger from '@/services/event-logger'
import { EVENT_TYPE } from '@/lib/event-types'
import { appendEvent } from './event-store'
import { EVENT_TYPES as EVENT_TYPES_V2 } from '@holdem/shared'

export interface Player {
  id: number
  gameId: number
  roomPlayerId: number
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
  const game = await db('games').where({ id: gameId }).first()
  if (!game) {
    throw new Error('Game not found')
  }

  const roomPlayer = await db('room_players').where({ id: roomPlayerId }).first()
  if (!roomPlayer) {
    throw new Error('Room player not found')
  }

  const existingPlayer = await db('game_players')
    .where({ game_id: gameId, room_player_id: roomPlayerId })
    .first()

  if (existingPlayer) {
    // Player already sat in this game
    return {
      id: existingPlayer.id,
      name: roomPlayer.name,
      position: existingPlayer.position,
      chips: existingPlayer.chips,
      gameId,
    }
  }

  if (game.status !== 'waiting') {
    throw new Error('Game already started')
  }

  const playerCount = await db('game_players').where({ game_id: gameId }).count('id as count')
  if (playerCount[0].count >= 10) {
    throw new Error('Game is full')
  }

  const players = await db('game_players')
    .where({ game_id: gameId })
    .orderBy('position', 'desc')
    .limit(1)

  const position = players.length > 0 ? players[0].position + 1 : 0

  const [playerId] = await db('game_players').insert({
    game_id: gameId,
    room_player_id: roomPlayerId,
    position,
    chips: roomPlayer.chips > 0 ? roomPlayer.chips : game.starting_chips, // Use room chips or starting
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
      playerId,
      playerName: roomPlayer.name,
      position,
      chips: roomPlayer.chips,
    },
    gameId,
  )

  // RECORD V2 EVENT (PLAYER_JOINED)
  await appendEvent(gameId, 0, EVENT_TYPES_V2.PLAYER_JOINED, playerId, {
    name: roomPlayer.name,
    position,
    startingChips: roomPlayer.chips,
  })

  return {
    id: playerId,
    name: roomPlayer.name,
    position,
    chips: roomPlayer.chips,
    gameId,
  }
}

/**
 * Get player by ID with full details
 */
export async function getPlayerById(playerId: number): Promise<Player | null> {
  const player = await db('game_players').where({ id: playerId }).first()
  if (!player) return null

  const roomPlayer = await db('room_players').where({ id: player.room_player_id }).first()
  if (!roomPlayer) return null

  return {
    id: player.id,
    gameId: player.game_id,
    roomPlayerId: player.room_player_id,
    name: roomPlayer.name,
    position: player.position,
    chips: player.chips,
    currentBet: player.current_bet,
    holeCards: player.hole_cards ? JSON.parse(player.hole_cards) : [],
    status: player.status,
    isDealer: player.is_dealer === 1,
    isSmallBlind: player.is_small_blind === 1,
    isBigBlind: player.is_big_blind === 1,
    lastAction: player.last_action,
    connected: roomPlayer.connected === 1,
    showCards: player.show_cards === 1,
  }
}

/**
 * Remove player from game (disconnect or delete)
 * Logic change: update room_player connected status, or remove from game_players if waiting
 */
export async function leaveGame(playerId: number): Promise<void> {
  const player = await getPlayerById(playerId)
  if (!player) {
    throw new Error('Player not found')
  }

  const game = await db('games').where({ id: player.gameId }).first()

  // If leaving game, we might just mark room player as disconnected?
  // But leaveGame might mean "Stand Up".
  // If game is waiting, delete from game_players.

  if (game.status !== 'waiting') {
    // Cannot remove from active game easily, just mark disconnected in room_players
    await db('room_players')
      .where({ id: player.roomPlayerId })
      .update({ connected: 0, updated_at: new Date() })

    eventLogger.logEvent(
      EVENT_TYPE.PLAYER_LEFT,
      {
        playerId,
        playerName: player.name,
        disconnected: true,
      },
      player.gameId,
    )
  } else {
    // Waiting game: remove from table
    await db('game_players').where({ id: playerId }).delete()
    eventLogger.logEvent(
      EVENT_TYPE.PLAYER_LEFT,
      {
        playerId,
        playerName: player.name,
        removed: true,
      },
      player.gameId,
    )
  }
}

/**
 * Update player connection status
 */
export async function updateConnectionStatus(playerId: number, connected: boolean): Promise<void> {
  // playerId here is game_player.id?
  // If so, we need to find room_player.
  const player = await db('game_players').where({ id: playerId }).first()
  if (player) {
    await db('room_players')
      .where({ id: player.room_player_id })
      .update({ connected: connected ? 1 : 0, updated_at: new Date() })
  }
}

/**
 * Get all players in a game
 */
export async function getPlayersInGame(gameId: number) {
  // Join with room_players to get names and connection status
  const players = await db('game_players')
    .join('room_players', 'game_players.room_player_id', 'room_players.id')
    .where('game_players.game_id', gameId)
    .orderBy('game_players.position')
    .select('game_players.*', 'room_players.name', 'room_players.connected')

  return players.map((p: any) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    chips: p.chips,
    currentBet: p.current_bet,
    status: p.status,
    connected: p.connected === 1,
  }))
}

/**
 * Set player card visibility status
 */
export async function setShowCards(playerId: number, showCards: boolean): Promise<void> {
  const player = await getPlayerById(playerId)
  await db('game_players')
    .where({ id: playerId })
    .update({ show_cards: showCards ? 1 : 0, updated_at: new Date() })

  if (showCards && player) {
    eventLogger.logEvent(
      EVENT_TYPE.CARDS_SHOWN,
      {
        playerId,
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
      await appendEvent(player.gameId, hand.hand_number, EVENT_TYPES_V2.REVEAL_CARDS, playerId, {
        holeCards: player.holeCards,
      })
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
