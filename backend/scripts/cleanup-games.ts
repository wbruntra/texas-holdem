// @ts-ignore
import db from '@holdem/database/db'

const keepRoomCode = process.argv[2]

if (!keepRoomCode) {
  console.error('Usage: bun run scripts/cleanup-games.ts <KEEP_ROOM_CODE>')
  process.exit(1)
}

async function main() {
  console.log(`Keeping game with room code: ${keepRoomCode}`)
  console.log('Deleting all other games...')

  const gameToKeep = await db('games').where({ room_code: keepRoomCode }).first()

  if (!gameToKeep) {
    console.error(
      `Game with room code ${keepRoomCode} not found! Aborting to avoid deleting everything.`,
    )
    process.exit(1)
  }

  // Delete all games where id != gameToKeep.id
  // Assuming SQLite cascade delete handles related tables (players, hands, game_events, game_snapshots)
  // If cascading is not enabled in standard SQLite setup, we might need to enable it or delete manually.
  // Knex usually handles cascade if definitions are correct, but let's be safe and check if we need PRAGMA foreign_keys = ON;

  await db.raw('PRAGMA foreign_keys = ON;')

  const deletedCount = await db('games').whereNot('id', gameToKeep.id).del()

  console.log(`Deleted ${deletedCount} old games.`)
  console.log(`Game ${keepRoomCode} (ID: ${gameToKeep.id}) preserved.`)

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
