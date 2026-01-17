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

async function getRoomCode(): Promise<string> {
  const argCode = process.argv[2]
  if (argCode) return argCode

  while (true) {
    const code = await question('Enter room code: ')
    if (code.trim()) return code.trim()
  }
}

async function exportEvents() {
  try {
    const roomCode = await getRoomCode()
    console.log(`Looking up room with code: ${roomCode}...`)

    const room = await db('rooms').where({ room_code: roomCode }).first()
    if (!room) {
      console.error('Room not found')
      process.exit(1)
    }

    // Find recent games
    const games = await db('games')
      .where({ room_id: room.id })
      .orderBy('created_at', 'desc')
      .limit(10)

    if (!games.length) {
      console.error('No games found for this room')
      process.exit(1)
    }

    console.log('\nRecent games:')
    for (let i = 0; i < games.length; i++) {
      const g = games[i]
      // Get player names
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

      console.log(
        `${i + 1}. Game #${g.game_number} (${new Date(g.created_at).toLocaleString()}) - Players: ${playerNames} ${resultStr}`,
      )
    }

    let selectedGame = null
    while (!selectedGame) {
      const selection = await question('\nSelect game number to export (or q to quit): ')
      if (selection.toLowerCase() === 'q') process.exit(0)

      const index = parseInt(selection) - 1
      if (!isNaN(index) && index >= 0 && index < games.length) {
        selectedGame = games[index]
      } else {
        console.log('Invalid selection')
      }
    }

    console.log(`\nExporting Game #${selectedGame.game_number} (ID: ${selectedGame.id})...`)
    const events = await db('game_events').where({ game_id: selectedGame.id }).orderBy('id', 'asc')

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
    const filename = `${roomCode.toLowerCase()}-game-${selectedGame.game_number}-events.json`
    const outputPath = path.join(fixturesDir, filename)
    fs.writeFileSync(outputPath, JSON.stringify(cleanEvents, null, 2))

    console.log(`Exported ${cleanEvents.length} events to ${outputPath}`)
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  } finally {
    rl.close()
  }
}

exportEvents().catch(console.error)
