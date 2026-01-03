const playerService = require('./backend/services/player-service')
const gameService = require('./backend/services/game-service')

async function testRejoin() {
  console.log('Testing rejoin functionality...')

  const game = await gameService.createGame()
  console.log(`Created game ${game.id} with room code ${game.roomCode}`)

  // First join
  const player1 = await playerService.joinGame(game.id, 'TestPlayer', 'password123')
  console.log('First join:', { id: player1.id, name: player1.name, chips: player1.chips })

  // Rejoin with same password
  const player2 = await playerService.joinGame(game.id, 'TestPlayer', 'password123')
  console.log('Rejoin with correct password:', {
    id: player2.id,
    name: player2.name,
    chips: player2.chips,
  })

  // Verify it's the same player
  if (player1.id === player2.id) {
    console.log('✓ Rejoin successful - same player ID')
  } else {
    console.log('✗ Rejoin failed - different player IDs')
  }

  // Try rejoin with wrong password
  try {
    await playerService.joinGame(game.id, 'TestPlayer', 'wrongpassword')
    console.log('✗ Should have thrown error for wrong password')
  } catch (err) {
    if (err.message === 'Invalid password') {
      console.log('✓ Correctly rejected wrong password')
    } else {
      console.log('✗ Wrong error message:', err.message)
    }
  }

  // Cleanup
  await gameService.deleteGame(game.id)
  console.log('Test complete!')
}

testRejoin().catch(console.error)
