const db = require('./db')

async function clearGames() {
  console.log('🧹 Clearing all games and related data...')

  await db('actions').del()
  await db('hands').del()
  await db('players').del()
  await db('games').del()

  console.log('✅ All games and related data cleared.')
  process.exit(0)
}

clearGames()
