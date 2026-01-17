// @ts-ignore
import db from '@holdem/database/db'
import { EVENT_TYPES } from '@holdem/shared'

const roomCode = process.argv[2]

if (!roomCode) {
  console.error('Usage: bun run scripts/view-events.ts <ROOM_CODE>')
  process.exit(1)
}

async function main() {
  console.log(`Looking up game with room code: ${roomCode}...`)

  const game = await db('games').where({ room_code: roomCode }).first()

  if (!game) {
    console.error('Game not found!')
    process.exit(1)
  }

  console.log(`Found Game ID: ${game.id}`)
  console.log('Fetching events...\n')

  const events = await db('game_events')
    .where({ game_id: game.id })
    .orderBy('hand_number', 'asc')
    .orderBy('sequence_number', 'asc')

  if (events.length === 0) {
    console.log('No events recorded for this game.')
  } else {
    // Group by hand number for readability
    let currentHand = -1

    events.forEach((event: any) => {
      if (event.hand_number !== currentHand) {
        currentHand = event.hand_number
        console.log(`\n=== HAND ${currentHand} ===`)
      }

      const payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload

      // Format timestamp
      const time = new Date(event.created_at).toLocaleTimeString()

      // Format payload summary for readability
      let payloadSummary = JSON.stringify(payload)
      if (payloadSummary.length > 100) {
        payloadSummary = payloadSummary.substring(0, 97) + '...'
      }

      // Special formatting for known complex payloads
      if (event.event_type === EVENT_TYPES.HAND_START) {
        payloadSummary = `(Deck + ${Object.keys(payload.holeCards || {}).length} players dealt)`
      }

      console.log(
        `[${time}] #${event.sequence_number} ${event.event_type.padEnd(16)} | Player: ${event.player_id || '-'} | ${payloadSummary}`,
      )
    })
  }

  console.log(`\nTotal events: ${events.length}`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
