const knex = require('knex')
const config = require('./knexfile.js')
const db = knex(config.development)

;(async () => {
  try {
    const roomCode = process.argv[2] || '9J9FZZ'
    const game = await db('games').where({ room_code: roomCode }).first()
    if (!game) {
      console.log('Game not found')
      process.exit(0)
    }

    console.log('=== GAME OBJECT KEYS ===')
    console.log(Object.keys(game))
    console.log('=== GAME OBJECT ===')
    console.log(JSON.stringify(game, null, 2))

    console.log('\n=== PLAYERS ===')
    const players = await db('players').where({ game_id: game.id }).orderBy('position')
    players.forEach((p, index) => {
      console.log(`\n--- Player ${index} ---`)
      console.log(Object.keys(p))
      console.log(JSON.stringify(p, null, 2))
    })

    process.exit(0)
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
})()
