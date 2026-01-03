/**
 * New Game Service - Uses objection.js models for database operations
 */

const Games = require('@holdem/database/tables/games')
const Players = require('@holdem/database/tables/players')

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

async function createGame(config = {}) {
  const { smallBlind = 5, bigBlind = 10, startingChips = 1000 } = config

  let roomCode
  let attempts = 0
  do {
    roomCode = generateRoomCode()
    const existing = await Games.query().where('room_code', roomCode).first()
    if (!existing) break
    attempts++
  } while (attempts < 10)

  if (attempts >= 10) {
    throw new Error('Failed to generate unique room code')
  }

  const game = await Games.query().insert({
    room_code: roomCode,
    status: 'waiting',
    small_blind: smallBlind,
    big_blind: bigBlind,
    starting_chips: startingChips,
    dealer_position: 0,
    pot: 0,
    current_bet: 0,
    hand_number: 0,
    last_raise: 0,
  })

  return game
}

async function addPlayer(gameId, name, password) {
  const bcrypt = require('bcryptjs')
  const passwordHash = await bcrypt.hash(password, 10)

  const game = await Games.query().findById(gameId)
  if (!game) {
    throw new Error('Game not found')
  }

  const existingPlayers = await Players.query().where('game_id', gameId)
  const position = existingPlayers.length

  const player = await Players.query().insert({
    game_id: gameId,
    name,
    position,
    chips: game.starting_chips,
    current_bet: 0,
    status: 'active',
    is_dealer: position === 0,
    is_small_blind: false,
    is_big_blind: false,
    connected: true,
    password_hash: passwordHash,
    total_bet: 0,
    show_cards: false,
  })

  return player
}

async function getGameWithPlayers(gameId) {
  const game = await Games.query().findById(gameId)
  if (!game) return null

  const players = await Players.query().where('game_id', gameId).orderBy('position')

  return {
    ...game,
    players,
  }
}

async function startGame(gameId) {
  const game = await Games.query().findById(gameId)
  if (!game) {
    throw new Error('Game not found')
  }

  if (game.status !== 'waiting') {
    throw new Error('Game already started')
  }

  const players = await Players.query().where('game_id', gameId).orderBy('position')
  if (players.length < 2) {
    throw new Error('Need at least 2 players to start')
  }

  const dealerIndex = game.dealer_position
  const sbIndex = (dealerIndex + 1) % players.length
  const bbIndex = (dealerIndex + 2) % players.length

  await Players.query().where('game_id', gameId).patch({
    is_dealer: false,
    is_small_blind: false,
    is_big_blind: false,
  })

  await Players.query().where('id', players[dealerIndex].id).patch({ is_dealer: true })

  await Players.query()
    .where('id', players[sbIndex].id)
    .patch({
      is_small_blind: true,
      current_bet: game.small_blind,
      chips: players[sbIndex].chips - game.small_blind,
    })

  await Players.query()
    .where('id', players[bbIndex].id)
    .patch({
      is_big_blind: true,
      current_bet: game.big_blind,
      chips: players[bbIndex].chips - game.big_blind,
    })

  const updatedGame = await Games.query()
    .findById(gameId)
    .patch({
      status: 'playing',
      current_bet: game.big_blind,
      current_player_position: (bbIndex + 1) % players.length,
    })

  return updatedGame
}

module.exports = {
  generateRoomCode,
  createGame,
  addPlayer,
  getGameWithPlayers,
  startGame,
}
