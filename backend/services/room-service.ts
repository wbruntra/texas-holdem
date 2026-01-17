// @ts-ignore
import db from '@holdem/database/db'
import crypto from 'crypto'
import gameService from './game-service'

export interface RoomConfig {
  smallBlind?: number
  bigBlind?: number
  startingChips?: number
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

async function createRoom(config: RoomConfig = {}) {
  const smallBlind = config.smallBlind || 5
  const bigBlind = config.bigBlind || 10
  const startingChips = config.startingChips || 1000

  let roomCode = generateRoomCode()
  let unique = false
  while (!unique) {
    const existing = await db('rooms').where({ room_code: roomCode }).first()
    if (!existing) unique = true
    else roomCode = generateRoomCode()
  }

  const [id] = await db('rooms').insert({
    room_code: roomCode,
    status: 'waiting',
    small_blind: smallBlind,
    big_blind: bigBlind,
    starting_chips: startingChips,
  })

  // Create initial game
  await gameService.createGameInRoom(id, {
    smallBlind,
    bigBlind,
    startingChips,
  })

  return getRoomById(id)
}

async function getRoomById(id: number) {
  const room = await db('rooms').where({ id }).first()
  if (!room) return null

  const players = await db('room_players').where({ room_id: id })
  const currentGame = room.current_game_id
    ? await gameService.getGameById(room.current_game_id)
    : null

  return {
    ...room,
    players,
    currentGame,
  }
}

async function getRoomByCode(roomCode: string) {
  const room = await db('rooms').where({ room_code: roomCode }).first()
  if (!room) return null
  return getRoomById(room.id)
}

async function joinRoom(roomCode: string, name: string, password: string) {
  const room = await db('rooms').where({ room_code: roomCode }).first()
  if (!room) throw new Error('Room not found')

  const existingPlayer = await db('room_players').where({ room_id: room.id, name }).first()

  // @ts-ignore
  const bcrypt = require('bcryptjs')

  if (existingPlayer) {
    const isValid = await bcrypt.compare(password, existingPlayer.password_hash)
    if (!isValid) {
      throw new Error('Invalid credentials')
    }
    // Update connected status
    await db('room_players')
      .where({ id: existingPlayer.id })
      .update({ connected: true, updated_at: new Date() })

    // Return session
    return {
      player: existingPlayer,
      token: existingPlayer.session_token,
    }
  }

  // New player
  const sessionToken = crypto.randomUUID()
  const passwordHash = await bcrypt.hash(password, 8)

  const [playerId] = await db('room_players').insert({
    room_id: room.id,
    name,
    password_hash: passwordHash,
    session_token: sessionToken,
    chips: room.starting_chips, // Initial chips
    connected: true,
  })

  // If there is an active game (waiting), auto-join it?
  // Current logic: join room, then join game.
  // We can let the frontend handle the "join game" call to be explicit,
  // OR we can auto-join if the game is in 'waiting' state.
  // For now, let's keep it simple: just join room. Frontend will call join game.

  const player = await db('room_players').where({ id: playerId }).first()

  return {
    player,
    token: sessionToken,
  }
}

async function getRoomPlayerByToken(token: string) {
  const player = await db('room_players').where({ session_token: token }).first()
  if (!player) return null
  return player
}

export default {
  createRoom,
  getRoomById,
  getRoomByCode,
  joinRoom,
  getRoomPlayerByToken,
}
