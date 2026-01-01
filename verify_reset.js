/**
 * Script to verify that reset properly deletes hands and actions
 */

const db = require('./db')

async function verifyResetCleanup(roomCode) {
  console.log(`\nVerifying reset cleanup for: ${roomCode}\n`)

  const game = await db('games').where({ room_code: roomCode }).first()
  if (!game) {
    console.error(`Game not found: ${roomCode}`)
    process.exit(1)
  }

  const players = await db('players').where({ game_id: game.id })
  const hands = await db('hands').where({ game_id: game.id })
  const actions = await db('actions')
    .leftJoin('players', 'actions.player_id', 'players.id')
    .where('players.game_id', '=', game.id)
    .select('actions.*')

  console.log(`Game Status: ${game.status}`)
  console.log(`Hand Number: ${game.hand_number}`)
  console.log(`Total Hands in DB: ${hands.length}`)
  console.log(`Total Actions in DB: ${actions.length}`)

  console.log(`\n⚠️  IF STATUS IS "waiting" AND HAND_NUMBER IS 0: Reset worked correctly`)
  console.log(`⚠️  IF STATUS IS "waiting" BUT HANDS/ACTIONS STILL EXIST: Reset incomplete!`)
  console.log(`⚠️  IF STATUS IS "active" WITH HANDS: Normal gameplay (no reset issues here)`)

  if (game.status === 'waiting' && (hands.length > 0 || actions.length > 0)) {
    console.log(`\n🔴 PROBLEM DETECTED:`)
    console.log(
      `   Game was reset (status=waiting) but ${hands.length} hands and ${actions.length} actions remain!`,
    )
    console.log(`   This is the bug - old hand data is not being cleared on reset.`)
  }

  console.log()
}

const roomCode = process.argv[2]
if (!roomCode) {
  console.error('Usage: bun verify_reset.js <ROOM_CODE>')
  process.exit(1)
}

verifyResetCleanup(roomCode)
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })
  .finally(() => process.exit(0))
