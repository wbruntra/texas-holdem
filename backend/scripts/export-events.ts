// @ts-ignore
import db from '../../database/db.js'
import fs from 'fs'
import path from 'path'
import readline from 'readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve)
  })
}

async function getRecentGames() {
  const games = await db('games')
    .join('rooms', 'games.room_id', 'rooms.id')
    .select('games.*', 'rooms.room_code')
    .orderBy('games.created_at', 'desc')
    .limit(20)

  return games
}

async function listGames(games: any[], title: string = 'Recent games') {
  console.log(`\n${title}:`)
  for (let i = 0; i < games.length; i++) {
    const g = games[i]
    // Get player names
    const players = await db('game_players')
      .join('room_players', 'game_players.room_player_id', 'room_players.id')
      .where('game_players.game_id', g.id)
      .select('room_players.name', 'game_players.id as playerId', 'game_players.position')

    const playerNames = players.map((p: any) => p.name).join(', ')
    let resultStr = ''

    if (g.winners) {
      try {
        // winners is stored as JSON string in DB but knex might parse it if configured
        const winners = typeof g.winners === 'string' ? JSON.parse(g.winners) : g.winners
        // @ts-ignore
        const winnerNames = winners
          .map((w) => {
            // w could be an ID, a position, or an object
            const wId = typeof w === 'object' ? w.id : w

            // Try to find by ID first
            const pById = players.find((p: any) => p.playerId === wId)
            if (pById) return pById.name

            // Try to find by position
            const pByPos = players.find((p: any) => p.position === wId)
            if (pByPos) return pByPos.name

            return `ID/Pos:${wId}`
          })
          .join(', ')
        resultStr = `| Winner(s): ${winnerNames}`
      } catch (e) {
        resultStr = '| (Error parsing winners)'
      }
    }

    const roomInfo = g.room_code ? `[Room: ${g.room_code}] ` : ''
    console.log(
      `${i + 1}. ${roomInfo}Game #${g.game_number} (${new Date(
        g.created_at,
      ).toLocaleString()}) - Players: ${playerNames} ${resultStr}`,
    )
  }
}

async function exportGame(game: any, roomCode: string) {
  console.log(`\nExporting Game #${game.game_number} (ID: ${game.id})...`)
  const events = await db('game_events').where({ game_id: game.id }).orderBy('id', 'asc')

  const cleanEvents = events.map((e: any) => ({
    id: e.id,
    gameId: e.game_id,
    eventType: e.event_type,
    payload: e.payload, // Knex usually parses JSON automatically for json columns
    playerId: e.player_id,
    sequenceNumber: e.sequence_number,
    handNumber: e.hand_number,
    timestamp: e.created_at,
  }))

  const fixturesDir = path.join(__dirname, '../__test__/fixtures')
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true })
  }

  // Use game number in filename to differentiate
  const filename = `${roomCode.toLowerCase()}-game-${game.game_number}-events.json`
  const outputPath = path.join(fixturesDir, filename)
  fs.writeFileSync(outputPath, JSON.stringify(cleanEvents, null, 2))

  console.log(`Exported ${cleanEvents.length} events to ${outputPath}`)
}

async function exportEvents() {
  try {
    const argCode = process.argv[2]

    // If room code provided in args, specific path
    if (argCode) {
      await handleSpecificRoom(argCode)
      process.exit(0)
    }

    // Otherwise, show recent games from all rooms
    const recentGames = await getRecentGames()

    if (recentGames.length === 0) {
      console.log('No games found in database.')
      process.exit(0)
    }

    await listGames(recentGames, 'Recent games (all rooms)')

    while (true) {
      const selection = await question(
        '\nSelect game number to export, or enter a Room Code (or q to quit): ',
      )

      if (selection.toLowerCase() === 'q') process.exit(0)

      const index = parseInt(selection) - 1

      // If valid number selection
      if (!isNaN(index) && index >= 0 && index < recentGames.length) {
        const game = recentGames[index]
        await exportGame(game, game.room_code)
        process.exit(0)
      }
      // Treat as room code
      else if (selection.trim().length > 0) {
        const roomCode = selection.trim()
        console.log(`\nSearching for room: ${roomCode}`)
        const found = await handleSpecificRoom(roomCode)
        if (!found) {
          console.log('Room not found or invalid selection. Try again.')
        } else {
          process.exit(0)
        }
      }
    }
  } catch (err) {
    console.error(err)
    process.exit(1)
  } finally {
    rl.close()
  }
}

async function handleSpecificRoom(roomCode: string): Promise<boolean> {
  const room = await db('rooms').where({ room_code: roomCode }).first()
  if (!room) {
    return false
  }

  // Find recent games for this room
  const games = await db('games')
    .where({ room_id: room.id })
    .orderBy('created_at', 'desc')
    .limit(10)

  // ensure room_code is on the game objects for listGames
  games.forEach((g: any) => (g.room_code = roomCode))

  if (!games.length) {
    console.log('No games found for this room')
    return true
  }

  await listGames(games, `Recent games for Room ${roomCode}`)

  while (true) {
    const selection = await question('\nSelect game number to export (or q to quit): ')
    if (selection.toLowerCase() === 'q') process.exit(0)

    const index = parseInt(selection) - 1
    if (!isNaN(index) && index >= 0 && index < games.length) {
      await exportGame(games[index], roomCode)
      return true
    } else {
      console.log('Invalid selection')
    }
  }
}

exportEvents().catch(console.error)
