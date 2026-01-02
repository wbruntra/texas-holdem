#!/usr/bin/env node
/**
 * Example: Test event logging with a simple game flow
 * This demonstrates how events are captured during a game
 *
 * Usage: node example-event-logging.js
 */

const fetch = require('node-fetch')

const API_BASE = 'http://localhost:3000/api'

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function clearEvents() {
  const response = await fetch(`${API_BASE}/events/all`, { method: 'DELETE' })
  return response.json()
}

async function getEvents() {
  const response = await fetch(`${API_BASE}/events/all`)
  return response.json()
}

async function createGame() {
  const response = await fetch(`${API_BASE}/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      smallBlind: 5,
      bigBlind: 10,
      startingChips: 1000,
    }),
  })
  return response.json()
}

async function joinGame(gameId, name, password) {
  const response = await fetch(`${API_BASE}/games/${gameId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, password }),
  })
  return response.json()
}

async function authenticatePlayer(gameId, name, password) {
  const response = await fetch(`${API_BASE}/games/${gameId}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, password }),
  })
  return response.json()
}

async function startGame(gameId, sessionCookie) {
  const response = await fetch(`${API_BASE}/games/${gameId}/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie,
    },
  })
  return response.json()
}

async function submitAction(gameId, action, amount, sessionCookie) {
  const response = await fetch(`${API_BASE}/games/${gameId}/actions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie,
    },
    body: JSON.stringify({ action, amount }),
  })
  return response.json()
}

async function main() {
  console.log('🎯 Event Logging Example\n')

  // Clear previous events
  console.log('1. Clearing previous event log...')
  await clearEvents()
  console.log('   ✓ Event log cleared\n')

  // Create game
  console.log('2. Creating game...')
  const game = await createGame()
  console.log(`   ✓ Game created: ${game.roomCode} (ID: ${game.id})\n`)

  // Add players
  console.log('3. Adding players...')
  const player1 = await joinGame(game.id, 'Alice', 'pass1234')
  console.log(`   ✓ Alice joined (ID: ${player1.id})`)

  const player2 = await joinGame(game.id, 'Bob', 'pass1234')
  console.log(`   ✓ Bob joined (ID: ${player2.id})`)

  const player3 = await joinGame(game.id, 'Charlie', 'pass1234')
  console.log(`   ✓ Charlie joined (ID: ${player3.id})\n`)

  // Authenticate players
  console.log('4. Authenticating players...')
  const auth1 = await authenticatePlayer(game.id, 'Alice', 'pass1234')
  const session1 = `holdem=${auth1.sessionToken}`
  console.log('   ✓ Alice authenticated')

  const auth2 = await authenticatePlayer(game.id, 'Bob', 'pass1234')
  const session2 = `holdem=${auth2.sessionToken}`
  console.log('   ✓ Bob authenticated')

  const auth3 = await authenticatePlayer(game.id, 'Charlie', 'pass1234')
  const session3 = `holdem=${auth3.sessionToken}`
  console.log('   ✓ Charlie authenticated\n')

  // Start game
  console.log('5. Starting game...')
  await startGame(game.id, session1)
  console.log('   ✓ Game started\n')

  await sleep(500)

  // Sample actions (will depend on who is dealer/blinds)
  console.log('6. Players taking actions...')
  console.log('   (Check current player turn and valid actions)\n')

  // Get event log
  console.log('7. Retrieving event log...')
  const eventLog = await getEvents()
  console.log(`   ✓ Captured ${eventLog.count} events\n`)

  // Display events
  console.log('📊 Event Summary:\n')
  const eventTypes = {}
  eventLog.events.forEach((event) => {
    eventTypes[event.eventType] = (eventTypes[event.eventType] || 0) + 1
  })

  Object.entries(eventTypes).forEach(([type, count]) => {
    console.log(`   ${type.padEnd(30)} ${count}`)
  })

  console.log('\n📄 Full event log saved to: event-log.json')
  console.log('\n💡 View full details with: curl http://localhost:3000/api/events/all | jq .')
  console.log(
    `💡 View game-specific events: curl http://localhost:3000/api/events/game/${game.id} | jq .`,
  )

  console.log('\n✅ Example complete!')
}

main().catch((error) => {
  console.error('❌ Error:', error.message)
  process.exit(1)
})
