// @ts-ignore
import db from '@holdem/database/db'
import { EVENT_TYPES } from '@holdem/shared'

const roomCode = process.argv[2] || 'YU2PYD'
const handNumber = parseInt(process.argv[3] || '1', 10)

async function main() {
  console.log(`Patching event for room ${roomCode}, hand ${handNumber}...`)

  const game = await db('games').where({ room_code: roomCode }).first()
  if (!game) {
    console.error('Game not found')
    process.exit(1)
  }

  // Find the SHOWDOWN event
  const event = await db('game_events')
    .where({ game_id: game.id, hand_number: handNumber, event_type: EVENT_TYPES.SHOWDOWN })
    .first()

  if (!event) {
    console.error('SHOWDOWN event not found')
    process.exit(1)
  }

  const payload = JSON.parse(event.payload)

  if (payload.payouts) {
    console.log('Event already has payouts. Skipping.')
    process.exit(0)
  }

  // Hardcoded payout calculation based on known state
  // James (59) wins 780.
  // Bill (58) wins 0.
  const payouts = [{ playerId: 59, amount: 780 }]

  console.log('Patching payload with:', payouts)

  const newPayload = { ...payload, payouts }

  await db('game_events')
    .where({ id: event.id })
    .update({ payload: JSON.stringify(newPayload) })

  console.log('Event patched successfully.')
  process.exit(0)
}

main().catch(console.error)
