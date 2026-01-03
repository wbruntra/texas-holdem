// @ts-ignore
import db from '@holdem/database/db'
import eventLogger from '@/services/event-logger'
import { EVENT_TYPE } from '@/lib/event-types'

interface Player {
  id: number
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

export async function joinGame(
  gameId: number,
  playerName: string,
  password: string,
): Promise<JoinGameResult> {
  if (!playerName || playerName.trim().length === 0) {
    throw new Error('Player name is required')
  }

  if (!password || password.length < 4) {
    throw new Error('Password must be at least 4 characters')
  }

  const game = await db('games').where({ id: gameId }).first()
  if (!game) {
    throw new Error('Game not found')
  }

  const existingPlayer = await db('players').where({ game_id: gameId, name: playerName }).first()

  if (existingPlayer) {
    // @ts-ignore
    const bcrypt = require('bcryptjs')
    const isValid = await bcrypt.compare(password, existingPlayer.password_hash)
    if (!isValid) {
      throw new Error('Invalid password')
    }

    await db('players')
      .where({ id: existingPlayer.id })
      .update({ connected: 1, updated_at: new Date() })

    eventLogger.logEvent(
      EVENT_TYPE.PLAYER_REJOINED,
      {
        playerId: existingPlayer.id,
        playerName,
      },
      gameId,
    )

    return {
      id: existingPlayer.id,
      name: existingPlayer.name,
      position: existingPlayer.position,
      chips: existingPlayer.chips,
      gameId,
    }
  }

  if (game.status !== 'waiting') {
    throw new Error('Game already started')
  }

  const playerCount = await db('players').where({ game_id: gameId }).count('id as count')
  if (playerCount[0].count >= 10) {
    throw new Error('Game is full')
  }

  const players = await db('players')
    .where({ game_id: gameId })
    .orderBy('position', 'desc')
    .limit(1)

  const position = players.length > 0 ? players[0].position + 1 : 0

  // @ts-ignore
  const bcrypt = require('bcryptjs')
  const passwordHash = await bcrypt.hash(password, 8)

  const [playerId] = await db('players').insert({
    game_id: gameId,
    name: playerName,
    position,
    chips: game.starting_chips,
    current_bet: 0,
    status: 'active',
    password_hash: passwordHash,
    is_dealer: 0,
    is_small_blind: 0,
    is_big_blind: 0,
    connected: 1,
  })

  eventLogger.logEvent(
    EVENT_TYPE.PLAYER_JOINED,
    {
      playerId,
      playerName,
      position,
      chips: game.starting_chips,
    },
    gameId,
  )

  return {
    id: playerId,
    name: playerName,
    position,
    chips: game.starting_chips,
    gameId,
  }
}

export async function getPlayerById(playerId: number): Promise<Player | null> {
  const player = await db('players').where({ id: playerId }).first()
  if (!player) return null

  return {
    id: player.id,
    gameId: player.game_id,
    name: player.name,
    position: player.position,
    chips: player.chips,
    currentBet: player.current_bet,
    holeCards: player.hole_cards ? JSON.parse(player.hole_cards) : [],
    status: player.status,
    isDealer: player.is_dealer === 1,
    isSmallBlind: player.is_small_blind === 1,
    isBigBlind: player.is_big_blind === 1,
    lastAction: player.last_action,
    connected: player.connected === 1,
    showCards: player.show_cards === 1,
  }
}

export async function leaveGame(playerId: number): Promise<void> {
  const player = await getPlayerById(playerId)
  if (!player) {
    throw new Error('Player not found')
  }

  const game = await db('games').where({ id: player.gameId }).first()
  if (game.status !== 'waiting') {
    await db('players').where({ id: playerId }).update({ connected: 0, updated_at: new Date() })
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
    await db('players').where({ id: playerId }).delete()
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

export async function updateConnectionStatus(playerId: number, connected: boolean): Promise<void> {
  await db('players')
    .where({ id: playerId })
    .update({ connected: connected ? 1 : 0, updated_at: new Date() })
}

export async function getPlayersInGame(gameId: number) {
  const players = await db('players').where({ game_id: gameId }).orderBy('position')

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

export async function authenticatePlayer(
  gameId: number,
  playerName: string,
  password: string,
): Promise<Player> {
  const player = await db('players').where({ game_id: gameId, name: playerName }).first()

  if (!player) {
    throw new Error('Invalid credentials')
  }

  // @ts-ignore
  const bcrypt = require('bcryptjs')
  const isValid = await bcrypt.compare(password, player.password_hash)
  if (!isValid) {
    throw new Error('Invalid credentials')
  }

  eventLogger.logEvent(
    EVENT_TYPE.PLAYER_AUTHENTICATED,
    {
      playerId: player.id,
      playerName,
    },
    gameId,
  )

  const fullPlayer = await getPlayerById(player.id)
  if (!fullPlayer) {
    throw new Error('Player not found after authentication')
  }
  return fullPlayer
}

export async function setShowCards(playerId: number, showCards: boolean): Promise<void> {
  const player = await getPlayerById(playerId)
  await db('players')
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
  }
}

export function getAllPlayersInGame(gameId: number) {
  return getPlayersInGame(gameId)
}

export default {
  joinGame,
  getPlayerById,
  authenticatePlayer,
  leaveGame,
  updateConnectionStatus,
  getAllPlayersInGame,
  setShowCards,
}
