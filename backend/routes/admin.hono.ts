import { Hono } from 'hono'
// @ts-ignore
import db from '@holdem/database/db'
import { getEvents } from '../services/event-store'

const app = new Hono()

/**
 * GET /api/admin/games
 * List all games with metadata for replay selection
 */
app.get('/games', async (c) => {
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

    return c.json(formattedGames)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

/**
 * GET /api/admin/games/:gameId/events
 * Get all events for a game (for replay)
 */
app.get('/games/:gameId/events', async (c) => {
  try {
    const gameIdStr = c.req.param('gameId')
    const gameId = parseInt(gameIdStr, 10)

    if (isNaN(gameId)) {
      return c.json({ error: 'Invalid game ID' }, 400)
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
      return c.json({ error: 'Game not found' }, 404)
    }

    // Get all events for this game
    const events = await getEvents(gameId)

    return c.json({
      game: {
        id: game.id,
        roomCode: game.roomCode,
        smallBlind: game.smallBlind,
        bigBlind: game.bigBlind,
        startingChips: game.startingChips,
      },
      events,
    })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

export default app
