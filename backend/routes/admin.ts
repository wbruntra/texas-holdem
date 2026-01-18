import express from 'express'
// @ts-ignore
import db from '@holdem/database/db'
import { getEvents } from '@/services/event-store'

const router = express.Router()

/**
 * GET /api/admin/games
 * List all games with metadata for replay selection
 */
router.get('/games', async (req, res, next) => {
  try {
    const games = await db('games')
      .join('rooms', 'games.room_id', 'rooms.id')
      .leftJoin('game_players', 'games.id', 'game_players.game_id')
      .leftJoin('room_players', 'game_players.room_player_id', 'room_players.id')
      .select(
        'games.id',
        'rooms.room_code as roomCode',
        'games.game_number as gameNumber',
        'games.status',
        'games.hand_number as handNumber',
        'games.small_blind as smallBlind',
        'games.big_blind as bigBlind',
        'games.starting_chips as startingChips',
        'games.created_at as createdAt',
        db.raw('GROUP_CONCAT(room_players.name) as playerNames'),
      )
      .groupBy('games.id')
      .orderBy('games.created_at', 'desc')
      .limit(50)

    const formattedGames = games.map((game: any) => ({
      id: game.id,
      roomCode: game.roomCode,
      gameNumber: game.gameNumber,
      status: game.status,
      handNumber: game.handNumber,
      smallBlind: game.smallBlind,
      bigBlind: game.bigBlind,
      startingChips: game.startingChips,
      createdAt: game.createdAt,
      players: game.playerNames ? game.playerNames.split(',') : [],
    }))

    res.json(formattedGames)
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/admin/games/:gameId/events
 * Get all events for a game (for replay)
 */
router.get('/games/:gameId/events', async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.gameId, 10)

    if (isNaN(gameId)) {
      return res.status(400).json({ error: 'Invalid game ID' })
    }

    // Get game metadata first
    const game = await db('games')
      .join('rooms', 'games.room_id', 'rooms.id')
      .where('games.id', gameId)
      .select(
        'games.id',
        'rooms.room_code as roomCode',
        'games.small_blind as smallBlind',
        'games.big_blind as bigBlind',
        'games.starting_chips as startingChips',
        'games.seed',
      )
      .first()

    if (!game) {
      return res.status(404).json({ error: 'Game not found' })
    }

    // Get all events for this game
    const events = await getEvents(gameId)

    res.json({
      game: {
        id: game.id,
        roomCode: game.roomCode,
        smallBlind: game.smallBlind,
        bigBlind: game.bigBlind,
        startingChips: game.startingChips,
      },
      events,
    })
  } catch (error) {
    next(error)
  }
})

export default router
