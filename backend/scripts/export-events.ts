import db from '../../database/db.js'
import fs from 'fs'
import path from 'path'

const roomCode = process.argv[2]
if (!roomCode) {
  console.error('Please provide a room code')
  process.exit(1)
}

async function exportEvents() {
  console.log(`Looking up game with room code: ${roomCode}...`)
  const game = await db('games').where({ room_code: roomCode }).first()

  if (!game) {
    console.error('Game not found')
    process.exit(1)
  }

  console.log(`Found Game ID: ${game.id}`)
  console.log('Fetching events...')

  const events = await db('game_events').where({ game_id: game.id }).orderBy('id', 'asc')

  const cleanEvents = events.map((e) => ({
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

  const outputPath = path.join(fixturesDir, `${roomCode.toLowerCase()}-events.json`)
  fs.writeFileSync(outputPath, JSON.stringify(cleanEvents, null, 2))

  console.log(`Exported ${cleanEvents.length} events to ${outputPath}`)
  process.exit(0)
}

exportEvents().catch(console.error)
